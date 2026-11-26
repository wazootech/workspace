/**
 * balls collector. Read-only: GitHub GraphQL search plus REST thread reads,
 * JSON on stdout, no writes and no cache file.
 *
 * Usage: collect.ts [--user login] [owner|owner/repo]
 *        collect.ts --detail owner/repo#number
 */
import { parseArgs } from "./args.ts";
import { classify } from "./classify.ts";
import { detail } from "./detail.ts";
import { resolveLogin, searchAll, viewer } from "./gh.ts";
import { byPriority } from "./order.ts";
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

  const { user, scope } = parseArgs(args);
  const me = await viewer();
  const who = user === undefined ? me : await resolveLogin(user);
  const selector = scope.includes("/") ? `repo:${scope}` : `org:${scope}`;
  const searches = [
    `${selector} is:open involves:${who}`,
    `${selector} is:open is:pr review-requested:${who}`,
  ];

  const items: Item[] = [];
  const seen = new Set<string>();
  let pages = 0;
  let truncated = false;
  // Hits of the review-requested search, which also covers the user's teams.
  const requested = new Set<string>();
  for (const search of searches) {
    const result = await searchAll(search, MAX_PAGES);
    pages += result.pages;
    truncated ||= result.truncated;
    for (const item of result.items) {
      const key = `${item.repository.nameWithOwner}#${item.number}`;
      if (search.includes("review-requested:")) requested.add(key);
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
      const key = `${item.repository.nameWithOwner}#${item.number}`;
      const ball = classify(item, who, requested.has(key));
      if (ball === null) skipped.notActionable++;
      else balls.push(ball);
    }
  }
  balls.sort(byPriority);

  const counts = Object.fromEntries(
    MOVES.map((move) => [move, 0]),
  ) as Record<Move, number>;
  for (const ball of balls) counts[ball.move]++;
  console.log(JSON.stringify(
    {
      user: who,
      viewer: me,
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
