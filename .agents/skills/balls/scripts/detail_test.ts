import { deepStrictEqual } from "node:assert/strict";
import { test } from "node:test";
import { comments } from "./detail.ts";

test("REST comments name their author under user", () => {
  deepStrictEqual(
    comments([{
      user: { login: "octocat" },
      body: "hi",
      created_at: "2026-11-24T00:00:00Z",
    }]),
    [{ author: "octocat", body: "hi", at: "2026-11-24T00:00:00Z" }],
  );
});
