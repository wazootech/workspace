import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { classify } from "./classify.ts";
import { isNoise } from "./signals.ts";
import type { Item } from "./types.ts";

const VIEWER = "EthanThatOneKid";

function item(patch: Partial<Item> = {}): Item {
  return {
    __typename: "Issue",
    number: 1,
    title: "Something needs you",
    url: "https://github.com/wazootech/workspace/issues/1",
    createdAt: "2026-11-20T00:00:00Z",
    updatedAt: "2026-11-21T00:00:00Z",
    closed: false,
    repository: { nameWithOwner: "wazootech/workspace", isArchived: false },
    author: { login: "someone", __typename: "User" },
    assignees: { nodes: [] },
    comments: { nodes: [] },
    ...patch,
  };
}

const thumbsUp = { nodes: [{ user: { login: VIEWER } }] };

function comment(author: string, body: string, reacted = false) {
  return {
    author: { login: author, __typename: "User" },
    body,
    createdAt: "2026-11-24T00:00:00Z",
    thumbs: reacted ? thumbsUp : undefined,
  };
}

test("noise is filtered by content, not by account", () => {
  strictEqual(isNoise("all checks have passed"), true);
  strictEqual(isNoise("bump foo from 1.0.0 to 1.0.1"), true);
  strictEqual(isNoise("Can you take a look at this?"), false);
});

test("an assigned issue is Fix", () => {
  const result = classify(
    item({ assignees: { nodes: [{ login: VIEWER }] } }),
    VIEWER,
  );
  strictEqual(result?.move, "Fix");
});

test("a review request is Review", () => {
  const pr = item({
    __typename: "PullRequest",
    reviewRequests: {
      nodes: [{ requestedReviewer: { login: VIEWER } }],
    },
  });
  strictEqual(classify(pr, VIEWER)?.move, "Review");
});

test("a team request counts only when the user's search matched", () => {
  const team = item({
    __typename: "PullRequest",
    reviewRequests: {
      nodes: [{ requestedReviewer: { name: "eng" } }],
    },
  });
  strictEqual(classify(team, VIEWER, true)?.move, "Review");
  strictEqual(classify(team, "outsider"), null);
});

test("the same thread reads differently from each court", () => {
  const thread = item({
    author: { login: VIEWER, __typename: "User" },
    assignees: { nodes: [{ login: "teammate" }] },
    comments: { nodes: [comment("teammate", "Can you take a look?")] },
  });
  strictEqual(classify(thread, VIEWER)?.move, "Reply");
  const theirs = classify(thread, "teammate");
  strictEqual(theirs?.move, "Fix");
  deepStrictEqual(theirs?.secondary, []);
});

test("a reply from someone else is Reply when I am involved", () => {
  const result = classify(
    item({
      comments: {
        nodes: [comment("someone", "Pushed a fix, please re-check")],
      },
      author: { login: VIEWER, __typename: "User" },
    }),
    VIEWER,
  );
  strictEqual(result?.move, "Reply");
  strictEqual(result?.who, "someone");
});

test("a thumbs-up on an older comment does not hide a newer ask", () => {
  const result = classify(
    item({
      author: { login: VIEWER, __typename: "User" },
      comments: {
        nodes: [
          comment("someone", "Heads up", true),
          {
            ...comment("someone", "Can you decide?"),
            createdAt: "2026-11-25T00:00:00Z",
          },
        ],
      },
    }),
    VIEWER,
  );
  strictEqual(result?.move, "Reply");
});

test("a thumbs-up on a thread's last comment acknowledges it", () => {
  const thread = (reacted: boolean) =>
    item({
      __typename: "PullRequest",
      author: { login: VIEWER, __typename: "User" },
      reviewThreads: {
        nodes: [
          {
            isResolved: false,
            comments: { nodes: [comment("someone", "Rename this", reacted)] },
          },
        ],
      },
    });
  strictEqual(classify(thread(false), VIEWER)?.move, "Reply");
  strictEqual(classify(thread(true), VIEWER), null);
});

test("a thumbs-up on the last comment clears Reply, not other moves", () => {
  const reacted = item({
    assignees: { nodes: [{ login: VIEWER }] },
    comments: { nodes: [comment("someone", "Need a decision here", true)] },
  });
  strictEqual(classify(reacted, VIEWER)?.move, "Fix");

  const quiet = item({
    author: { login: VIEWER, __typename: "User" },
    comments: { nodes: [comment("someone", "Need a decision here", true)] },
  });
  strictEqual(classify(quiet, VIEWER), null);
});

test("bot noise alone is not a ball; a bot reply on my thread is", () => {
  const noise = item({
    comments: {
      nodes: [
        {
          author: { login: "dependabot", __typename: "Bot" },
          body: "bump foo from 1.0.0 to 1.0.1",
          createdAt: "2026-11-24T00:00:00Z",
        },
      ],
    },
    author: { login: VIEWER, __typename: "User" },
  });
  strictEqual(classify(noise, VIEWER), null);

  const reply = item({
    comments: {
      nodes: [
        {
          author: { login: "published-bot", __typename: "Bot" },
          body: "I addressed your comments; ready for another pass",
          createdAt: "2026-11-24T00:00:00Z",
        },
      ],
    },
    author: { login: VIEWER, __typename: "User" },
  });
  strictEqual(classify(reply, VIEWER)?.move, "Reply");
});

test("a reply after theirs clears the ball", () => {
  const answered = item({
    author: { login: VIEWER, __typename: "User" },
    comments: {
      nodes: [
        comment("someone", "Can you take a look?"),
        {
          ...comment(VIEWER, "Done, thanks!"),
          createdAt: "2026-11-25T00:00:00Z",
        },
      ],
    },
  });
  strictEqual(classify(answered, VIEWER), null);
});

test("a question mark inside a URL is not an ask", () => {
  const link = item({
    author: { login: VIEWER, __typename: "User" },
    comments: {
      nodes: [
        comment("someone", "See https://x.dev/?utm_source=gh for details"),
      ],
    },
  });
  strictEqual(classify(link, VIEWER), null);
});

test("closed, merged, and archived items are skipped", () => {
  strictEqual(classify(item({ closed: true }), VIEWER), null);
  strictEqual(classify(item({ merged: true }), VIEWER), null);
  strictEqual(
    classify(item({ __typename: "PullRequest", isDraft: true }), VIEWER),
    null,
  );
  strictEqual(
    classify(
      item({
        repository: { nameWithOwner: "wazootech/old", isArchived: true },
      }),
      VIEWER,
    ),
    null,
  );
});

test("an approved green PR authored by me is Merge", () => {
  const pr = item({
    __typename: "PullRequest",
    author: { login: VIEWER, __typename: "User" },
    mergeable: "MERGEABLE",
    statusCheckRollup: { state: "SUCCESS" },
    reviews: {
      nodes: [
        {
          author: { login: "reviewer", __typename: "User" },
          body: "LGTM",
          state: "APPROVED",
          createdAt: "2026-11-24T00:00:00Z",
        },
      ],
    },
  });
  strictEqual(classify(pr, VIEWER)?.move, "Merge");
});
