/** Phase two: fetch the whole thread for one shortlisted item. */
import { ghJson } from "./gh.ts";

interface RestComment {
  author: { login: string } | null;
  body: string;
  created_at: string;
}
interface RestReview {
  user: { login: string } | null;
  body: string;
  state: string;
  submitted_at: string;
}
interface RestIssue {
  title: string;
  html_url: string;
  body: string | null;
}

export interface Detail {
  key: string;
  title: string;
  url: string;
  body: string;
  comments: { author: string; body: string; at: string }[];
  reviews: { author: string; body: string; state: string; at: string }[];
  reviewComments: { author: string; body: string; at: string }[];
}

const comments = (list: RestComment[]) =>
  list.map((c) => ({
    author: c.author?.login ?? "unknown",
    body: c.body,
    at: c.created_at,
  }));

export async function detail(key: string): Promise<Detail> {
  const parts = /^([\w.-]+\/[\w.-]+)#(\d+)$/.exec(key);
  if (parts === null) throw new Error("detail expects owner/repo#number");
  const [, repo, number] = parts;
  const base = `repos/${repo}/issues/${number}`;
  const issue = await ghJson(["api", base]) as RestIssue;
  const thread = await ghJson([
    "api",
    `${base}/comments?per_page=100`,
  ]) as RestComment[];
  let reviews: RestReview[] = [];
  let reviewComments: RestComment[] = [];
  try {
    reviews = await ghJson([
      "api",
      `repos/${repo}/pulls/${number}/reviews?per_page=100`,
    ]) as RestReview[];
    reviewComments = await ghJson([
      "api",
      `repos/${repo}/pulls/${number}/comments?per_page=100`,
    ]) as RestComment[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Issues have no pull-request endpoints; auth and rate-limit failures must
    // surface instead of yielding a silently incomplete thread.
    if (!/not found|404/i.test(message)) throw error;
  }
  return {
    key,
    title: issue.title,
    url: issue.html_url,
    body: issue.body ?? "",
    comments: comments(thread),
    reviews: reviews.map((r) => ({
      author: r.user?.login ?? "unknown",
      body: r.body,
      state: r.state,
      at: r.submitted_at,
    })),
    reviewComments: comments(reviewComments),
  };
}
