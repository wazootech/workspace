import { deepStrictEqual, throws } from "node:assert/strict";
import { parseArgs } from "./args.ts";

Deno.test("no arguments means my own court across the org", () => {
  deepStrictEqual(parseArgs([]), { user: undefined, scope: "wazootech" });
});

Deno.test("--user picks another court, in either argument order", () => {
  const expected = { user: "octocat", scope: "wazootech/workspace" };
  deepStrictEqual(
    parseArgs(["--user", "@octocat", "wazootech/workspace"]),
    expected,
  );
  deepStrictEqual(
    parseArgs(["wazootech/workspace", "--user", "octocat"]),
    expected,
  );
});

Deno.test("bad arguments fail instead of widening the search", () => {
  throws(() => parseArgs(["--user"]));
  throws(() => parseArgs(["--user", "two words"]));
  throws(() => parseArgs(["--usr", "octocat"]));
  throws(() => parseArgs(["octocat", "wazootech"]));
});
