---
name: wz_balls
description: Show what is waiting on the authenticated GitHub user across open wazootech issues and pull requests — unanswered replies, requested reviews, fixes, and merges. Use when asked "what's in my court?", "what am I blocking?", "what balls are in my court?", or for a daily waiting-on-me rundown.
---

# What is waiting on me?

Read-only. Never write to GitHub, change notifications, or create a cache file.
Run everything from the workspace root.

## Collect

```sh
deno task balls:collect
```

The script authenticates with `gh`, searches `org:wazootech` by default, and
prints JSON to stdout. Pass `owner` or `owner/repo` to replace the scope:

```sh
deno task balls:collect wazootech/workspace
```

It pages up to 1000 results per search and reports truncation. Every item is
classified by the mechanical table:

| Move   | Signal                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fix    | Assigned to you; you requested changes; your PR has requested changes, failing required checks, or a conflict                                                 |
| Reply  | You are involved (authored, assigned, commented, reviewed, or @mentioned) and someone else commented or reviewed last; unresolved thread you joined or opened |
| Review | A review is requested from you (including a requested team)                                                                                                   |
| Merge  | Your PR is approved, green, unconflicted, with no changes requested                                                                                           |

Precedence is **Fix > Reply > Review > Merge**; secondary moves are listed.
Closed, merged, archived, and draft pull requests are skipped. Content-based bot
noise (CI, deploy, preview, dependency bumps) is filtered and counted; a bot
reply on a thread you own still counts. A reaction from you anywhere on an item
suppresses its Reply move only. Agent-signed comments count as human.

## Judge

1. Dedupe by `key` if the same item appears in both searches.
2. Read `meta` first: if `truncated` is true, say coverage is partial; report
   `skipped` counts.
3. For each shortlisted ball, fetch the whole thread:

   ```sh
   deno task balls:collect --detail wazootech/workspace#56
   ```

4. Spot-check the classification against the thread. Write **one line per
   item**, grouped by move and oldest-waiting first: link, who is waiting, since
   when, and one short sentence on what they asked. Show the top 10 overall,
   then counts for the rest. Drop any false positive from the output and say
   why.

## Notes

- `.claude/skills/wz_balls` is a symlink to this directory so Claude Code and
  OpenCode/Codex share one source of truth. Fresh Windows clones need
  `core.symlinks=true` (or Developer Mode) for the symlink to materialize.
- The collector is Deno TypeScript today; issue #50 tracks porting skill scripts
  to Node-compatible TypeScript under Bun.
