/** Content filters and involvement checks shared by the classifier. */
import type { CommentNode, Item, ReactionGroup } from "./types.ts";

export interface Activity {
  author: string;
  body: string;
  createdAt: string;
  state?: string;
}

// Filters read message content, not account names: an agent can post a real ask
// and a human can post a CI status line. Short automated chatter is noise;
// longer text may carry a request and is left for the classifier.
const NOISE_MAX_CHARS = 240;
const NOISE =
  /\b(ci|all checks|checks (passed|failed)|build (passed|failed)|deploy(ed|ment)?|preview|dependabot|renovate|bump \S+ from \S+ to \S+)\b/i;
const ASK =
  /\b(please|can you|could you|would you|need you|needs? your|waiting on you|waiting on your|your call|let me know|take a look|re-review|re-check|ready for|addressed your|any progress|any update|thoughts|how exactly|should we|assign this to you)\b/i;

export function isNoise(body: string): boolean {
  const text = body.trim();
  return text.length === 0 ||
    (text.length < NOISE_MAX_CHARS && NOISE.test(text));
}

export function needsReply(body: string, viewer: string): boolean {
  const text = body.replace(/https?:\/\/\S+/g, " ");
  return text.includes("?") || text.includes(`@${viewer}`) || ASK.test(text);
}

function reacted(groups: ReactionGroup[] | null | undefined, viewer: string) {
  return (groups ?? []).some((g) =>
    g.users.nodes.some((u) => u.login === viewer)
  );
}

export function suppressed(item: Item, viewer: string): boolean {
  const comments: CommentNode[] = item.comments?.nodes ?? [];
  return reacted(item.reactionGroups, viewer) ||
    comments.some((c) => reacted(c.reactionGroups, viewer));
}

export function requestedBy(item: Item, viewer: string): boolean {
  return (item.reviewRequests?.nodes ?? []).some((r) => {
    const who = r.requestedReviewer;
    return who !== null && (who.login === viewer || who.name !== undefined);
  });
}

export function collect(item: Item): Activity[] {
  const comments: CommentNode[] = item.comments?.nodes ?? [];
  const reviews = item.reviews?.nodes ?? [];
  return [
    ...comments.filter((c) => !isNoise(c.body)).map((c) => ({
      author: c.author?.login ?? "unknown",
      body: c.body,
      createdAt: c.createdAt,
    })),
    ...reviews.filter((r) => !isNoise(r.body) && r.state !== "APPROVED")
      .map((r) => ({
        author: r.author?.login ?? "unknown",
        body: r.body,
        createdAt: r.createdAt,
        state: r.state,
      })),
  ];
}

export function involved(
  item: Item,
  acts: Activity[],
  viewer: string,
  asked: boolean,
) {
  const texts = [item.title, ...acts.map((a) => a.body)];
  return item.author?.login === viewer ||
    item.assignees.nodes.some((a) => a.login === viewer) || asked ||
    acts.some((a) => a.author === viewer) ||
    texts.some((t) => t.includes(`@${viewer}`));
}

export function needsThreadReply(
  item: Item,
  viewer: string,
  asked: boolean,
): boolean {
  const threads = item.reviewThreads?.nodes ?? [];
  return threads.some((t) => {
    const comments = t.comments.nodes;
    const tail = comments.at(-1);
    return !t.isResolved && tail !== undefined &&
      tail.author?.login !== viewer &&
      (comments.some((c) => c.author?.login === viewer) ||
        item.author?.login === viewer || asked);
  });
}
