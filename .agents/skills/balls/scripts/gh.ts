/** gh CLI wrapper. The GraphQL query is piped through stdin: PowerShell
 * mangles inline `-f query=...`, but `-F query=@-` works everywhere. */
import { spawn } from "node:child_process";
import { SEARCH_QUERY } from "./query.ts";
import type { Item, SearchPage } from "./types.ts";

function run(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("gh", args);
    const out: string[] = [];
    const err: string[] = [];
    child.stdout.setEncoding("utf8").on("data", (c: string) => out.push(c));
    child.stderr.setEncoding("utf8").on("data", (c: string) => err.push(c));
    child.on("error", (error) => {
      reject(
        new Error(
          `Could not run gh (install and authenticate it first): ${error.message}`,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) resolve(out.join(""));
      else reject(new Error(err.join("").trim() || `gh ${args[0]} failed`));
    });
    // gh can exit before reading its input; the exit code reports that.
    child.stdin.on("error", () => {});
    child.stdin.end(input ?? "");
  });
}

export async function ghJson(args: string[]): Promise<unknown> {
  return JSON.parse(await run(args)) as unknown;
}

export async function ghText(args: string[]): Promise<string> {
  return (await run(args)).trim();
}

export async function viewer(): Promise<string> {
  const login = await ghText(["api", "user", "--jq", ".login"]);
  if (login.length === 0) {
    throw new Error("could not determine the authenticated GitHub user");
  }
  return login;
}

/** Canonical casing for a login; classification compares logins exactly. */
export async function resolveLogin(login: string): Promise<string> {
  try {
    return await ghText(["api", `users/${login}`, "--jq", ".login"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/not found|404/i.test(message)) throw error;
    throw new Error(`no GitHub user named ${login}`);
  }
}

export interface SearchResult {
  items: Item[];
  pages: number;
  truncated: boolean;
}

export async function searchAll(
  search: string,
  maxPages = 10,
): Promise<SearchResult> {
  const items: Item[] = [];
  let after: string | null = null;
  let pages = 0;
  while (pages < maxPages) {
    const args = ["api", "graphql", "-f", `search=${search}`];
    if (after === null) {
      args.push("-F", "after=null");
    } else {
      args.push("-f", `after=${after}`);
    }
    args.push("-F", "query=@-");
    const text = await run(args, SEARCH_QUERY);
    const result = JSON.parse(text) as {
      data?: { search: SearchPage };
      errors?: { message: string }[];
    };
    if (result.errors?.length) {
      throw new Error(
        `GitHub GraphQL error: ${result.errors
          .map((e) => e.message)
          .join("; ")}`,
      );
    }
    if (result.data === undefined) {
      throw new Error("GitHub GraphQL returned no data");
    }
    const page = result.data.search;
    for (const node of page.nodes) {
      if (node !== null) items.push(node);
    }
    pages++;
    if (!page.pageInfo.hasNextPage) {
      return { items, pages, truncated: false };
    }
    after = page.pageInfo.endCursor;
    if (after === null) break;
  }
  return { items, pages, truncated: after !== null || pages === maxPages };
}
