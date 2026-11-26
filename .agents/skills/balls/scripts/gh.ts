/** gh CLI wrapper. The GraphQL query is piped through stdin: PowerShell
 * mangles inline `-f query=...`, but `-F query=@-` works everywhere. */
import { SEARCH_QUERY } from "./query.ts";
import type { Item, SearchPage } from "./types.ts";

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

async function run(args: string[], input?: string): Promise<string> {
  const cmd = new Deno.Command("gh", {
    args,
    stdin: input === undefined ? undefined : "piped",
    stdout: "piped",
    stderr: "piped",
  });
  let output: Deno.CommandOutput;
  try {
    if (input === undefined) {
      output = await cmd.output();
    } else {
      const child = cmd.spawn();
      const writer = child.stdin.getWriter();
      await writer.write(new TextEncoder().encode(input));
      await writer.close();
      output = await child.output();
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not run gh (install and authenticate it first): ${detail}`,
    );
  }
  if (output.code !== 0) {
    throw new Error(
      decode(output.stderr).trim() || `gh ${args.join(" ")} failed`,
    );
  }
  return decode(output.stdout);
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
        `GitHub GraphQL error: ${
          result.errors.map((e) => e.message).join("; ")
        }`,
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
