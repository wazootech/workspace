import { deepStrictEqual, throws } from "node:assert/strict";
import { test } from "node:test";
import { parseArgs } from "./args.ts";

test("no arguments means my own court across the org", () => {
  deepStrictEqual(parseArgs([]), { user: undefined, scope: "wazootech" });
});

test("--user picks another court, in either argument order", () => {
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

test("bad arguments fail instead of widening the search", () => {
  throws(() => parseArgs(["--user"]));
  throws(() => parseArgs(["--user", "two words"]));
  throws(() => parseArgs(["--usr", "octocat"]));
  throws(() => parseArgs(["octocat", "wazootech"]));
});
