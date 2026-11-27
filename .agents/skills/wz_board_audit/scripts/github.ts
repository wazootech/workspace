/** GitHub reads for the board audit, through the `gh` CLI. Never writes. */
import { execFileSync } from "node:child_process";
import { readAll } from "./paginate.ts";
import { BOARD_QUERY, OPEN_ISSUES_QUERY } from "./query.ts";
import type { BoardItem, Page } from "./types.ts";

const PROJECT_ID = "PVT_kwDOC8Sdbc4BpyaL";
const SEARCH = "org:wazootech is:issue is:open archived:false";

interface Connection<N> {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: N[];
}
type Value = { name?: string } | null;
interface BoardNode {
  isArchived: boolean;
  status: Value;
  priority: Value;
  signal: Value;
  content: Content | null;
}
interface Content {
  __typename: string;
  url?: string;
  state?: string;
  updatedAt?: string;
  closedByPullRequestsReferences?: {
    nodes: { url: string; state: string }[];
  };
}

/** Retries because large GraphQL reads sometimes fail with HTTP 502. */
function graphql(query: string, variables: Record<string, string>): unknown {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    args.push("-f", `${key}=${value}`);
  }
  for (let tries = 1;; tries++) {
    try {
      const text = execFileSync("gh", args, {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return (JSON.parse(text) as { data: unknown }).data;
    } catch (error) {
      if (tries < 3) continue;
      // gh explains itself on stderr; Node's message repeats the whole query.
      const { stderr } = error as { stderr?: string };
      throw stderr?.trim() ? new Error(stderr.trim()) : error;
    }
  }
}

function page<N, T>(
  c: Connection<N>,
  total: number,
  map: (n: N) => T,
): Page<T> {
  const { hasNextPage: hasNext, endCursor: cursor } = c.pageInfo;
  return { total, hasNext, cursor, nodes: c.nodes.map(map) };
}

function toBoardItem(node: BoardNode): BoardItem {
  return {
    type: node.content?.__typename ?? "Unreadable",
    url: node.content?.url ?? null,
    state: node.content?.state ?? null,
    archived: node.isArchived,
    status: node.status?.name ?? null,
    priority: node.priority?.name ?? null,
    signal: node.signal?.name ?? null,
    updatedAt: node.content?.updatedAt ?? null,
    mergedFixes: (node.content?.closedByPullRequestsReferences?.nodes ?? [])
      .filter((pr) => pr.state === "MERGED")
      .map((pr) => pr.url),
  };
}

export function readBoard(): BoardItem[] {
  return readAll((after) => {
    const vars: Record<string, string> = { id: PROJECT_ID };
    if (after !== null) vars.after = after;
    const { node } = graphql(BOARD_QUERY, vars) as {
      node: { items: Connection<BoardNode> & { totalCount: number } };
    };
    return page(node.items, node.items.totalCount, toBoardItem);
  });
}

export function readOpenIssues(): string[] {
  return readAll((after) => {
    const vars: Record<string, string> = { search: SEARCH };
    if (after !== null) vars.after = after;
    const { search } = graphql(OPEN_ISSUES_QUERY, vars) as {
      search: Connection<{ url: string }> & { issueCount: number };
    };
    return page(search, search.issueCount, (n) => n.url);
  });
}
