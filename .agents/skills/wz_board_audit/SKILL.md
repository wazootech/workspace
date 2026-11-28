---
name: wz_board_audit
description: Lists where the Wazoo Platform Big Picture board disagrees with GitHub — open issues missing from the board, items with no Priority, closed issues not marked Done, open issues marked Done, In Progress items with merged fixes, and stale P0/P1 items. Use when asked to audit, check, or reconcile the board, to verify a triage run's report, or before changing any field of a board item.
---

# Audit the Big Picture board

`audit.ts` only reads: it writes nothing to GitHub and creates no files.
`edit.ts` is the one script here that writes.

## Run

Needs an authenticated `gh` with access to the org project, and Node 22.18 or
newer, or Bun. From the workspace root:

```sh
node .agents/skills/wz_board_audit/scripts/audit.ts
```

## Read the output

Paste the report exactly as printed. Do not rewrite its counts, drop its links,
or add items to its lists. If you acted on anything, run it again and paste the
new report.

A check printed as `NOT RUN` did not pass. The script exits 1 when any check did
not run.

## Scope

The six checks of the nightly routine (wazootech/workspace#15). Check 1 compares
every open issue in unarchived repos with the board, not only the ones created
since the last run.

Check 4 sees only pull requests GitHub links as closing an issue, and a merged
fix does not show that production runs it. Never set Status to Done from this
list: the board may close an issue that is marked Done. Check 5 counts the days
since the issue or pull request was last updated.

An empty list means nothing matched among the repos your token can see.

## Edit an item

Mark an item Done only when its issue is ready to close, and do that by closing
the issue: the board then sets Done. The board's Auto-close workflow can close
an issue marked Done, and editing another field of an open Done item has closed it
too. Change board fields only with this script, from the workspace root:

```sh
bun run board:edit worlds-api#176 "Status=In Progress"
bun run board:edit stream#39 Priority=P2 Signal=Active
bun run board:edit stream#39 Priority=
```

Names must match the board exactly, and `Field=` clears a field. The script
refuses to mark an open item Done, and to edit an open item marked Done except
to move it off Done as its own edit. After writing it waits 15 seconds, then
exits 1 if the item changed state or shows another value. It checks only the
item it edited, and it cannot stop an edit made any other way.

## Test

```sh
bun run board:test
```
