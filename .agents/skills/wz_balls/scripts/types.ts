/** Shared shapes for the read-only "balls in my court" collector. */

export interface Actor {
  login: string;
  __typename: string;
}

export interface ReactionGroup {
  content: string;
  users: { nodes: { login: string }[] };
}

export interface CommentNode {
  author: Actor | null;
  body: string;
  createdAt: string;
  reactionGroups: ReactionGroup[] | null;
}

export interface ReviewNode {
  author: Actor | null;
  body: string;
  state: string;
  createdAt: string;
}

export interface ReviewRequestNode {
  requestedReviewer: { login?: string; name?: string } | null;
}

export interface ReviewThreadNode {
  isResolved: boolean;
  comments: { nodes: CommentNode[] };
}

export interface Item {
  __typename: "Issue" | "PullRequest";
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  closed: boolean;
  merged?: boolean;
  isDraft?: boolean;
  mergeable?: string | null;
  repository: { nameWithOwner: string; isArchived: boolean };
  author: Actor | null;
  assignees: { nodes: { login: string }[] };
  reactionGroups: ReactionGroup[] | null;
  comments: { nodes: CommentNode[] };
  reviews?: { nodes: ReviewNode[] };
  reviewRequests?: { nodes: ReviewRequestNode[] };
  reviewThreads?: { nodes: ReviewThreadNode[] };
  statusCheckRollup?: { state: string } | null;
}

export interface SearchPage {
  nodes: (Item | null)[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

export type Move = "Fix" | "Reply" | "Review" | "Merge";

export interface Ball {
  key: string;
  kind: "issue" | "pr";
  move: Move;
  secondary: Move[];
  title: string;
  url: string;
  repo: string;
  number: number;
  who: string;
  since: string;
  evidence: string;
}
