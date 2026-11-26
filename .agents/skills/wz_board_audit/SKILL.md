---
name: wz_board_audit
description: Lists where the Wazoo Platform Big Picture board disagrees with GitHub — open issues missing from the board, items with no Priority, closed issues not marked Done, and open issues marked Done. Use when asked to audit, check, or reconcile the board, or to verify a triage run's report.
---

# Audit the Big Picture board

The script only reads. It writes nothing to GitHub and creates no files.

## Run

Needs an authenticated `gh` with access to the org project, and Node 22.18 or
newer, Bun, or Deno. From the workspace root:

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

Checks 1, 2, 3, and 6 of the nightly routine (wazootech/workspace#15). Merged
fixes (check 4) and stale P0/P1 items (check 5) are not covered. Check 1
compares every open issue in unarchived repos with the board, not only the ones
created since the last run.

An empty list means nothing matched among the repos your token can see.

## Test

```sh
deno task board:test
```
