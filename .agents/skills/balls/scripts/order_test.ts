import { deepStrictEqual } from "node:assert/strict";
import { test } from "node:test";
import { byPriority } from "./order.ts";
import type { Ball, Move } from "./types.ts";

function ball(key: string, since: string, ...moves: Move[]): Ball {
  return {
    key,
    kind: "issue",
    move: moves[0],
    secondary: moves.slice(1),
    title: key,
    url: "",
    repo: "wazootech/workspace",
    number: 1,
    who: "someone",
    since,
    evidence: "",
  };
}

test("merges lead, then people waiting, then everything else", () => {
  const sorted = [
    ball("old-assignment", "2026-08-01", "Fix"),
    ball("new-reply", "2026-11-20", "Reply"),
    ball("fix-with-reply", "2026-11-10", "Fix", "Reply"),
    ball("re-review", "2026-11-15", "Fix", "Review"),
    ball("merge", "2026-11-25", "Merge"),
    ball("newer-assignment", "2026-09-01", "Fix"),
  ].sort(byPriority);
  deepStrictEqual(sorted.map((b) => b.key), [
    "merge",
    "fix-with-reply",
    "re-review",
    "new-reply",
    "old-assignment",
    "newer-assignment",
  ]);
});
