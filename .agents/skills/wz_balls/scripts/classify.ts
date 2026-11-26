/** Mechanical pass over the issue table. The model does the final judgment. */
import {
  collect,
  involved,
  needsReply,
  needsThreadReply,
  requestedBy,
  suppressed,
} from "./signals.ts";
import type { Ball, Item, Move } from "./types.ts";

const ORDER: Move[] = ["Fix", "Reply", "Review", "Merge"];

export function classify(item: Item, viewer: string): Ball | null {
  if (
    item.closed || item.merged === true || item.isDraft === true ||
    item.repository.isArchived
  ) {
    return null;
  }
  const asked = requestedBy(item, viewer);
  const acts = collect(item);
  if (!involved(item, acts, viewer, asked)) return null;
  const ordered = [...acts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const newest = ordered[0];
  const last = ordered.find((a) => a.author !== viewer);

  const isPr = item.__typename === "PullRequest";
  const reviews = item.reviews?.nodes ?? [];
  const assigned = item.assignees.nodes.some((a) => a.login === viewer);
  const changes = reviews.some((r) =>
    r.author?.login !== viewer && r.state === "CHANGES_REQUESTED"
  );
  const myChanges = reviews.some((r) =>
    r.author?.login === viewer && r.state === "CHANGES_REQUESTED"
  );
  const approvals = reviews.some((r) =>
    r.author?.login !== viewer && r.state === "APPROVED"
  );
  const state = item.statusCheckRollup?.state ?? "";
  const failing = state === "FAILURE" || state === "ERROR";
  const conflict = item.mergeable === "CONFLICTING";
  const green = state === "SUCCESS" && item.mergeable === "MERGEABLE";
  const viewerAuthor = item.author?.login === viewer;

  const fix = assigned || (isPr &&
    ((viewerAuthor && (changes || failing || conflict)) || myChanges));
  const lastAsks = newest !== undefined && newest.author !== viewer &&
    (newest.state === "CHANGES_REQUESTED" || needsReply(newest.body, viewer));
  const reply = !suppressed(item, viewer) &&
    (lastAsks || needsThreadReply(item, viewer, asked));
  const review = isPr && asked && !viewerAuthor;
  const merge = isPr && viewerAuthor && approvals && !changes && green;

  const moves = ORDER.filter((m) =>
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
      (assigned ? "assignment" : asked ? "review request" : "you"),
    since: last?.createdAt ?? item.updatedAt,
    evidence: (last?.body ?? "").replace(/\s+/g, " ").slice(0, 200),
  };
}
