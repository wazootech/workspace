import { match, ok, strictEqual, throws } from "node:assert/strict";
import { attempt, readAll } from "./paginate.ts";
import { report } from "./report.ts";
import type { BoardItem } from "./types.ts";

const url = (n: number) => `https://github.com/acme/app/issues/${n}`;
const item = (n: number, over: Partial<BoardItem> = {}): BoardItem => ({
  type: "Issue",
  url: url(n),
  state: "OPEN",
  archived: false,
  status: "Todo",
  priority: "P2",
  signal: "Active",
  ...over,
});
const good = <T>(value: T) => ({ ok: true as const, value });
const bad = { ok: false as const, reason: "HTTP 502" };

/** The links listed under one heading. */
function listed(text: string, heading: string): string[] {
  const block = text.split("### ").find((b) => b.startsWith(heading)) ?? "";
  return [...block.matchAll(/\[app#(\d+)\]/g)].map((m) => m[1]);
}

Deno.test("each check lists exactly its matches, with links", () => {
  const board = [
    item(1),
    item(2, { priority: null }),
    item(3, { priority: null, signal: "needs triage" }),
    item(4, { state: "CLOSED", status: "In Progress", priority: null }),
    item(5, { status: "Done" }),
    item(6, { status: "Done", archived: true }),
  ];
  const text = report(good(board), good([1, 6, 7].map(url)), "now");
  strictEqual(listed(text, "Check 1").join(), "7");
  strictEqual(
    listed(text, "Check 2: open items with no Priority, to").join(),
    "2",
  );
  match(text, /marked needs triage: 1\n- \[app#3\]\(https:/);
  strictEqual(listed(text, "Check 3").join(), "4");
  strictEqual(listed(text, "Check 6").join(), "5");
});

Deno.test("a failed issue search marks only check 1 as NOT RUN", () => {
  const text = report(good([item(1)]), bad, "now");
  match(text, /Check 1: [^\n]+: NOT RUN\nHTTP 502/);
  strictEqual(text.match(/NOT RUN/g)?.length, 1);
});

Deno.test("a failed board read never reports a check as passed", () => {
  const text = report(bad, good([url(1)]), "now");
  strictEqual(text.match(/NOT RUN/g)?.length, 5);
  ok(!/: 0$/m.test(text));
});

Deno.test("hidden board items are called out", () => {
  const hidden = item(1, { type: "Unreadable", url: null, state: null });
  match(report(good([hidden]), good([]), "now"), /1 items are unreadable/);
});

Deno.test("a short or broken page sequence throws", () => {
  const page = { total: 2, hasNext: false, cursor: null, nodes: [1] };
  throws(() => readAll(() => page), /1 of 2/);
  throws(() => readAll(() => ({ ...page, hasNext: true })), /no cursor/);
  const result = attempt(() => readAll(() => page));
  strictEqual(result.ok, false);
});
