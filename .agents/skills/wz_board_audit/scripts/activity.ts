/** Checks 4 and 5: merged fixes and stale high-priority items. Pure. */
import { link, listing } from "./markdown.ts";
import type { BoardItem } from "./types.ts";

export const FIXED = "Check 4: open In Progress items and merged linked fixes";
export const STALE = "Check 5: open P0/P1 items not updated for 14 days";
const DAY = 24 * 60 * 60 * 1000;

export function merged(items: BoardItem[]): string {
  const rows = items
    .filter((item) => item.state === "OPEN" && item.status === "In Progress")
    .flatMap((item) => {
      if (item.url === null) return [];
      const fixes = item.mergedFixes.map(link).join(", ");
      return [`- ${link(item.url)}: ${fixes || "no merged linked fix"}`];
    });
  return listing(FIXED, rows.sort());
}

export function stale(items: BoardItem[], takenAt: string): string {
  const now = Date.parse(takenAt);
  const rows = items.flatMap((item) => {
    const hot = item.priority === "P0" || item.priority === "P1";
    if (!hot || item.state !== "OPEN") return [];
    if (item.url === null || item.updatedAt === null) return [];
    const days = Math.floor((now - Date.parse(item.updatedAt)) / DAY);
    if (days < 14) return [];
    return [`- ${item.priority} ${link(item.url)}: ${days} days`];
  });
  return listing(STALE, rows.sort());
}
