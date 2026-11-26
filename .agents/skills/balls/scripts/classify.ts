/** Mechanical pass over the issue table. The model does the final judgment. */
import {
  collect,
  involved,
  needsReply,
  needsThreadReply,
  requestedBy,
  suppressed,
} from "./signals.ts";
import { MOVES } from "./types.ts";
import type { Ball, Item } from "./types.ts";

// Short enough to skim a shortlist, long enough to see what was asked.
const EVIDENCE_CHARS = 200;

export function classify(
  item: Item,
  user: string,
  searchRequested = false,
): Ball | null {
  if (
    item.closed || item.merged === true || item.isDraft === true ||
    item.repository.isArchived
  ) {
    return null;
  }
  const asked = searchRequested || requestedBy(item, user);
  const acts = collect(item);
  if (!involved(item, acts, user, asked)) return null;
  const ordered = [...acts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const newest = ordered[0];
  const last = ordered.find((a) => a.author !== user);

  const isPr = item.__typename === "PullRequest";
  const reviews = item.reviews?.nodes ?? [];
  const assigned = item.assignees.nodes.some((a) => a.login === user);
  const changes = reviews.some((r) =>
    r.author?.login !== user && r.state === "CHANGES_REQUESTED"
  );
  const theirChanges = reviews.some((r) =>
    r.author?.login === user && r.state === "CHANGES_REQUESTED"
  );
  const approvals = reviews.some((r) =>
    r.author?.login !== user && r.state === "APPROVED"
  );
  const state = item.statusCheckRollup?.state ?? "";
  const failing = state === "FAILURE" || state === "ERROR";
  const conflict = item.mergeable === "CONFLICTING";
  const green = state === "SUCCESS" && item.mergeable === "MERGEABLE";
  const userAuthored = item.author?.login === user;

  const fix = assigned || (isPr &&
    ((userAuthored && (changes || failing || conflict)) || theirChanges));
  const lastAsks = newest !== undefined && newest.author !== user &&
    (newest.state === "CHANGES_REQUESTED" || needsReply(newest.body, user));
  const reply = !suppressed(item, user) &&
    (lastAsks || needsThreadReply(item, user, asked));
  const review = isPr && asked && !userAuthored;
  const merge = isPr && userAuthored && approvals && !changes && green;

  const moves = MOVES.filter((m) =>
    (m === "Fix" && fix) || (m === "Reply" && reply) ||
    (m === "Review" && review) || (m === "Merge" && merge)
  );
  if (moves.length === 0) return null;

  return {
    key: `${item.repository.nameWithOwner}#${item.number}`,
    kind: isPr ? "pr" : "issue",
    move: moves[0],
    secondary: moves.slice(1),
    title: item.title,
    url: item.url,
    repo: item.repository.nameWithOwner,
    number: item.number,
    who: last?.author ??
      (assigned ? "assignment" : asked ? "review request" : user),
    since: last?.createdAt ?? item.updatedAt,
    evidence: (last?.body ?? "").replace(/\s+/g, " ").slice(0, EVIDENCE_CHARS),
  };
}
