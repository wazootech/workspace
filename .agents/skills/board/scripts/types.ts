/** Shapes shared by the board audit. */
export interface BoardItem {
  /** Issue, PullRequest, DraftIssue, or Unreadable when GitHub hides it. */
  type: string;
  url: string | null;
  state: string | null;
  archived: boolean;
  status: string | null;
  priority: string | null;
  signal: string | null;
  updatedAt: string | null;
  /** Merged pull requests GitHub links as closing this issue. */
  mergedFixes: string[];
}

/** A read that either finished completely or says why it did not. */
export type Fetched<T> = { ok: true; value: T } | { ok: false; reason: string };

export interface Page<T> {
  total: number;
  hasNext: boolean;
  cursor: string | null;
  nodes: T[];
}
