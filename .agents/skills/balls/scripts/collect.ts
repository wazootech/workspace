/**
 * balls collector. Read-only: GitHub GraphQL search plus REST thread reads,
 * JSON on stdout, no writes and no cache file.
 *
 * Usage: collect.ts [owner|owner/repo]
 *        collect.ts --detail owner/repo#number
 */
import { classify } from "./classify.ts";
import { detail } from "./detail.ts";
import { searchAll, viewer } from "./gh.ts";
import { MOVES } from "./types.ts";
import type { Ball, Item, Move } from "./types.ts";

// GitHub returns 100 items per page; 10 pages caps each search at 1000 items.
const MAX_PAGES = 10;

async function main(): Promise<void> {
  const args = Deno.args;
  if (args[0] === "--detail") {
    const key = args[1];
    if (key === undefined) {
      throw new Error("--detail expects owner/repo#number");
    }
    console.log(JSON.stringify(await detail(key), null, 2));
    return;
  }

  const scope = args[0] ?? "wazootech";
  const who = await viewer();
  const selector = scope.includes("/") ? `repo:${scope}` : `org:${scope}`;
  const searches = [
    `${selector} is:open involves:${who}`,
    `${selector} is:open is:pr review-requested:${who}`,
  ];

  const items: Item[] = [];
  const seen = new Set<string>();
  let pages = 0;
  let truncated = false;
  for (const search of searches) {
    const result = await searchAll(search, MAX_PAGES);
    pages += result.pages;
    truncated ||= result.truncated;
    for (const item of result.items) {
      const key = `${item.repository.nameWithOwner}#${item.number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  const balls: Ball[] = [];
  const skipped = { closed: 0, drafts: 0, archived: 0, notActionable: 0 };
  for (const item of items) {
    if (item.closed || item.merged === true) {
      skipped.closed++;
    } else if (item.isDraft === true) {
      skipped.drafts++;
    } else if (item.repository.isArchived) {
      skipped.archived++;
    } else {
      const ball = classify(item, who);
      if (ball === null) skipped.notActionable++;
      else balls.push(ball);
    }
  }
  balls.sort((a, b) =>
    MOVES.indexOf(a.move) - MOVES.indexOf(b.move) ||
    a.since.localeCompare(b.since)
  );

  const counts = Object.fromEntries(
    MOVES.map((move) => [move, 0]),
  ) as Record<Move, number>;
  for (const ball of balls) counts[ball.move]++;
  console.log(JSON.stringify(
    {
      viewer: who,
      scope,
      generatedAt: new Date().toISOString(),
      searches,
      meta: { pages, truncated, scanned: items.length, skipped, counts },
      balls,
    },
    null,
    2,
  ));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  Deno.exit(1);
});
