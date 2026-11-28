import {
  deepStrictEqual,
  match,
  rejects,
  strictEqual,
  throws,
} from "node:assert/strict";
import { test } from "node:test";
import {
  apply,
  type BoardIo,
  type Item,
  parseChanges,
  refusal,
} from "./guard.ts";

const item = (state: string, Status: string): Item => ({
  state,
  values: { Status, Priority: "P1" },
});

/** A board that shows `after` once something has been written. */
function board(before: Item, after: Item, fail?: Error) {
  const log: string[] = [];
  const io: BoardIo = {
    read: () => (log.includes("write") ? after : before),
    prepare: () => () => {
      log.push("write");
      if (fail) throw fail;
    },
    settle: () => Promise.resolve(void log.push("settle")),
  };
  return { io, log };
}

test("an open Done item allows only a move off Done", () => {
  const done = item("OPEN", "Done");
  const check = (...args: string[]) => refusal(done, parseChanges(args));
  match(check("Priority=P2") ?? "", /move Status off Done first/);
  match(check("Priority=") ?? "", /move Status off Done first/);
  match(check("Status=Todo", "Priority=P2") ?? "", /as its own edit/);
  match(check("Status=Done") ?? "", /close the issue instead/);
  strictEqual(check("Status=In Progress"), null);
  strictEqual(check("Status="), null);
});

test("an open item is never marked Done; a closed one is editable", () => {
  const done = parseChanges(["Status=Done"]);
  match(refusal(item("OPEN", "Todo"), done) ?? "", /close the issue instead/);
  strictEqual(refusal(item("CLOSED", "Todo"), done), null);
  const priority = parseChanges(["Priority=P2"]);
  strictEqual(refusal(item("CLOSED", "Done"), priority), null);
});

test("a refused edit writes nothing", async () => {
  const { io, log } = board(item("OPEN", "Done"), item("CLOSED", "Done"));
  await rejects(apply(parseChanges(["Priority=P2"]), io), /nothing changed/);
  deepStrictEqual(log, []);
});

test("an edit reports old and new values and the kept state", async () => {
  const { io, log } = board(item("OPEN", "Done"), item("OPEN", "Todo"));
  const result = await apply(parseChanges(["Status=Todo"]), io);
  strictEqual(result, "Status: Done -> Todo; state still OPEN");
  deepStrictEqual(log, ["write", "settle"]);
});

test("a state change fails the edit, even when the write failed", async () => {
  const changes = parseChanges(["Priority=P2"]);
  for (const fail of [undefined, new Error("HTTP 502")]) {
    const { io } = board(item("OPEN", "Todo"), item("CLOSED", "Done"), fail);
    await rejects(apply(changes, io), /CHANGED STATE: OPEN -> CLOSED/);
  }
});

test("a failed or overwritten write is not reported as done", async () => {
  const same = item("OPEN", "Todo");
  const changes = parseChanges(["Priority=P2"]);
  const failing = board(same, same, new Error("HTTP 502"));
  await rejects(apply(changes, failing.io), /HTTP 502/);
  await rejects(
    apply(changes, board(same, same).io),
    /another value for: Priority/,
  );
});

test("changes must be well formed and name each field once", () => {
  throws(() => parseChanges([]), /at least one change/);
  throws(() => parseChanges(["Status"]), /expected Field=Value/);
  throws(() => parseChanges(["Status=Todo", "Status=Done"]), /only once/);
});
