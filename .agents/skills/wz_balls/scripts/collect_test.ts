import { strictEqual } from "node:assert/strict";
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
    reactionGroups: [],
    comments: { nodes: [] },
    ...patch,
  };
}

function comment(author: string, body: string, reacted = false) {
  return {
    author: { login: author, __typename: "User" },
    body,
    createdAt: "2026-11-24T00:00:00Z",
    reactionGroups: reacted
      ? [{
        content: "THUMBS_UP",
        users: { nodes: [{ login: VIEWER }] },
      }]
      : [],
  };
}

Deno.test("noise is filtered by content, not by account", () => {
  strictEqual(isNoise("all checks have passed"), true);
  strictEqual(isNoise("bump foo from 1.0.0 to 1.0.1"), true);
  strictEqual(isNoise("Can you take a look at this?"), false);
});

Deno.test("an assigned issue is Fix", () => {
  const result = classify(
    item({ assignees: { nodes: [{ login: VIEWER }] } }),
    VIEWER,
  );
  strictEqual(result?.move, "Fix");
});

Deno.test("a review request is Review, and a team request counts", () => {
  const pr = item({
    __typename: "PullRequest",
    reviewRequests: {
      nodes: [{ requestedReviewer: { login: VIEWER } }],
    },
  });
  strictEqual(classify(pr, VIEWER)?.move, "Review");
  const team = item({
    __typename: "PullRequest",
    reviewRequests: {
      nodes: [{ requestedReviewer: { name: "eng" } }],
    },
  });
  strictEqual(classify(team, VIEWER)?.move, "Review");
});

Deno.test("a reply from someone else is Reply when I am involved", () => {
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

Deno.test("a reaction suppresses Reply but not other moves", () => {
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

Deno.test("bot noise alone is not a ball; a bot reply on my thread is", () => {
  const noise = item({
    comments: {
      nodes: [{
        author: { login: "dependabot", __typename: "Bot" },
        body: "bump foo from 1.0.0 to 1.0.1",
        createdAt: "2026-11-24T00:00:00Z",
        reactionGroups: [],
      }],
    },
    author: { login: VIEWER, __typename: "User" },
  });
  strictEqual(classify(noise, VIEWER), null);

  const reply = item({
    comments: {
      nodes: [{
        author: { login: "published-bot", __typename: "Bot" },
        body: "I addressed your comments; ready for another pass",
        createdAt: "2026-11-24T00:00:00Z",
        reactionGroups: [],
      }],
    },
    author: { login: VIEWER, __typename: "User" },
  });
  strictEqual(classify(reply, VIEWER)?.move, "Reply");
});

Deno.test("a reply after theirs clears the ball", () => {
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

Deno.test("a question mark inside a URL is not an ask", () => {
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

Deno.test("closed, merged, and archived items are skipped", () => {
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

Deno.test("an approved green PR authored by me is Merge", () => {
  const pr = item({
    __typename: "PullRequest",
    author: { login: VIEWER, __typename: "User" },
    mergeable: "MERGEABLE",
    statusCheckRollup: { state: "SUCCESS" },
    reviews: {
      nodes: [{
        author: { login: "reviewer", __typename: "User" },
        body: "LGTM",
        state: "APPROVED",
        createdAt: "2026-11-24T00:00:00Z",
      }],
    },
  });
  strictEqual(classify(pr, VIEWER)?.move, "Merge");
});
