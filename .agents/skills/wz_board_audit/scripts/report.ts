/** Turns complete reads into the Markdown report. Pure. */
import { FIXED, merged, STALE, stale } from "./activity.ts";
import { notRun, section } from "./markdown.ts";
import type { BoardItem, Fetched } from "./types.ts";

const MISSING = "Check 1: open issues not on the board";
const UNTRIAGED = "Check 2: open items with no Priority, to triage";
const PARKED = "Check 2: open items with no Priority, marked needs triage";
const UNSYNCED = "Check 3: closed issues whose Status is not Done";
const DRIFT = "Check 6: open issues whose Status is Done";

function missing(board: BoardItem[], open: string[]): string {
  const known = new Set(board.map((item) => item.url));
  return section(MISSING, open.filter((url) => !known.has(url)));
}

function boardChecks(board: BoardItem[], takenAt: string): string[] {
  const live = board.filter((item) => !item.archived);
  const urls = (keep: (item: BoardItem) => boolean) =>
    live.filter(keep).flatMap((item) => item.url ?? []);
  const bare = (item: BoardItem) =>
    item.state === "OPEN" && item.priority === null;
  const parked = (item: BoardItem) => item.signal === "needs triage";
  const issue = (item: BoardItem, state: string) =>
    item.type === "Issue" && item.state === state;
  return [
    section(UNTRIAGED, urls((i) => bare(i) && !parked(i))),
    section(PARKED, urls((i) => bare(i) && parked(i))),
    section(
      UNSYNCED,
      urls((i) => issue(i, "CLOSED") && i.status !== "Done"),
    ),
    merged(live),
    stale(live, takenAt),
    section(DRIFT, urls((i) => issue(i, "OPEN") && i.status === "Done")),
  ];
}

export function report(
  board: Fetched<BoardItem[]>,
  open: Fetched<string[]>,
  takenAt: string,
): string {
  const out = [`## Board audit, ${takenAt}`];
  if (board.ok) {
    out.push(`Board items read: ${board.value.length}`);
    const hidden = board.value.filter((i) => i.type === "Unreadable").length;
    if (hidden > 0) {
      out.push(`WARNING: ${hidden} items are unreadable; lists may be short.`);
    }
  }
  if (open.ok) {
    out.push(`Open issues in unarchived repos: ${open.value.length}`);
  }
  if (board.ok && open.ok) out.push(missing(board.value, open.value));
  else if (!board.ok) out.push(notRun(MISSING, board.reason));
  else if (!open.ok) out.push(notRun(MISSING, open.reason));
  if (board.ok) out.push(...boardChecks(board.value, takenAt));
  else {
    const titles = [UNTRIAGED, PARKED, UNSYNCED, FIXED, STALE, DRIFT];
    out.push(...titles.map((title) => notRun(title, board.reason)));
  }
  return out.join("\n\n");
}
