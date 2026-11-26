---
name: balls
description: Shows what is waiting on the authenticated GitHub user across open wazootech issues and pull requests — unanswered replies, requested reviews, fixes, and merges. Use when asked "what's in my court?", "what am I blocking?", "what balls are in my court?", or for a daily waiting-on-me rundown.
---

# What is waiting on me?

Read-only. Never write to GitHub, change notifications, or create a cache file.
Run everything from the workspace root.

## Requirements

- Deno 2.x — the tasks below use `deno task`.
- `gh` installed and authenticated (`gh auth status`). The collector reads
  GitHub over the network with your credentials.

## Collect

```sh
deno task balls:collect
```

The task executes `.agents/skills/balls/scripts/collect.ts`. Run it; there is no
need to read the scripts. It authenticates with `gh`, searches `org:wazootech`
by default, and prints JSON to stdout. Pass `owner` or `owner/repo` to replace
the scope:

```sh
deno task balls:collect wazootech/workspace
```

It pages up to 1000 results per search (10 pages of 100) and reports truncation.
Every item is classified by the mechanical table:

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

The JSON has `viewer`, `scope`, `searches`, and `meta` (`pages`, `truncated`,
`scanned`, `skipped`, `counts`) alongside `balls`. Each ball carries `key`,
`move`, `secondary`, `title`, `url`, `repo`, `number`, `who`, `since`, and
`evidence`; see `scripts/types.ts` for the full shape.

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
   why; if a signal rule is at fault, note it for a code fix rather than working
   around it silently.

## Notes

- `.claude/skills/balls` is a symlink to this directory so Claude Code and
  OpenCode/Codex share one source of truth. Fresh Windows clones need
  `core.symlinks=true` (or Developer Mode) for the symlink to materialize.
- Script map: `collect.ts` (search and shortlist), `detail.ts` (whole thread),
  `classify.ts` and `signals.ts` (rules), `gh.ts` and `query.ts` (GitHub
  access), `types.ts` (JSON shapes), `collect_test.ts` (unit tests).
- The collector uses Deno TypeScript; issue #50 tracks porting skill scripts to
  Node-compatible TypeScript under Bun.
