# Wazoo Technologies workspace guide

This workspace root (`wazootech/workspace`) federates Wazoo Technologies
repositories via [`workspace.json`](workspace.json).

## Context routing

Do not duplicate child repo guidance here. Route to local docs and source code:

- **Child repos**: Read local `AGENTS.md`, `README.md`, or `skills/` before
  working inside any child directory under `repos/`.

- **Company brain**: [`repos/memory`](repos/memory) is the org's brain of record
  — the durable, typed record of how Wazoo operates and what it knows, validated
  by the wiki CLI and canonical at `memory.wazoo.dev`. GitHub issues, pull
  requests, and boards stay the source of truth for work state; the brain holds
  the context those items link. The former `wazoopedia` repository was archived
  and renamed to `memory`, so a surviving `wazoopedia` reference is stale —
  route it to `repos/memory` rather than reviving the old repo.
- **Workspace CLI**: For workspace CLI usage and task execution, see
  [`repos/workspace-cli/skills/wspace/SKILL.md`](repos/workspace-cli/skills/wspace/SKILL.md)
  and [`workspace-cli`](repos/workspace-cli).
  - **Recurring state check**: run `wspace check` at session launch **and**
    again before finishing every session to confirm the latest workspace state
    (and catch strays/state changes created mid-session). Prefer
    `wspace check --json` over ad-hoc per-repo `ls`/`git status` probes.
  - **Root checkout coverage**: `check` and `update` include the workspace root
    checkout itself (reported as `(workspace root)`), so a stale federation repo
    shows up as `DIVERGED` rather than silently drifting; untracked
    `repos/`/`worktrees/` content never marks it dirty.
- **Wiki toolchain**: For wiki CLI usage, validation, and maintenance, see
  [`repos/wiki/skills/wiki/SKILL.md`](repos/wiki/skills/wiki/SKILL.md) and
  [`wiki`](repos/wiki).

**⚠ Worktree isolation always applies.** Even if a child repo's `AGENTS.md` does
not mention worktrees, the hard boundary in this file (below) is in effect. If
your cwd is inside `repos/<repo>/` and you need to make code changes, stop and
create a worktree first — regardless of what the child repo's docs say.

## Core rules

### Manifest membership

- [`workspace.json`](workspace.json) is the single source of truth for
  allowlisted repositories checked out under `repos/`.
- The manifest lists current repositories only. Remove an entry when its
  repository is archived; an archived repo is not a dependency anyone should
  clone, and the manifest is read as a dependency list.
- An entry must be readable by whoever checks this workspace out. `memory` and
  `memsdk-e2e` are private and named deliberately, so a reader without org
  access gets a partial `wspace install` rather than a full one. Say so where
  the install is documented instead of letting it fail one repo at a time.

### Agent-file classes

Agent-facing files across the family fall under one membership test with three
answers:

1. **Workspace-development skills** — developed here, for here. They live in
   root `skills/`, carry the `wazootech_` prefix, and may couple to harness
   artifacts (`workspace.json`, board IDs).
2. **Packaged product skills** — built for anyone, shipped inside product repos
   at `repos/<product>/skills/<skill>/SKILL.md` and installed via
   `npx skills add <owner>/<repo>@<skill>`. Bare names; origin rides the install
   slug. The 2026-08 collision survey found zero conflicts, but origin is not
   machine-detectable post-install, so residual naming risk stays documented,
   not eliminated.
3. **External forks and vendored copies** — someone else's; excluded from this
   taxonomy entirely (e.g. the memorybench fork, factory-vendored Neon skills).
   Never edit or grade them as if first-party.

Placement outcomes: ambient rules live in AGENTS.md (this constitution for the
family, each repo's manual for repo specifics); procedures live in SKILL.md
files. Mechanical rules: skill files are named `SKILL.md` (exact casing); a
skill's frontmatter `name:` equals its directory name; a directory directly
under root `skills/` without the `wazootech_` prefix fails, as does a
`wazootech_*` name anywhere outside root `skills/`; wiki-template payloads
(`repos/wiki-templates/templates/*/AGENTS.md`) — shipped content that doubles as
live instructions in scaffolded sites — must carry their `template-payload`
header.

### Cross-repo changes (read before opening a PR that others depend on)

A green `verify` job means **this repo** is correct. It does not mean the change
is safe to merge, because for every deployed service the deploy-and-verify gates
are gated on
`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`. **The
first time your code reaches a live environment is after it is already merged.**
Treat that as the default hazard for any change with a blast radius beyond one
repo.

Before opening a PR that changes an OpenAPI schema, a published client's types,
a route contract, or a shared identifier:

1. **List the downstream dependents** in the PR body, and state the required
   merge order. Do not leave the ordering to be discovered from red CI.
2. **Say what you could not observe.** "Tests pass" is not observation of a
   deployed system. If you could not run the change against a real environment,
   name the gate that would have caught it and why it was unavailable.
3. **Fast-forward before you conclude anything.** A clone behind `origin/main`
   will confidently report stale state. Run `wspace update`, or
   `git -C repos/<repo> pull --ff-only`, before citing any file as evidence.

Known dependency edges in this family:

- `worlds-api` / `wazoo-api` OpenAPI + contract changes → `worlds-client-ts` /
  `wazoo-client-ts` → `wazoo-console` / `wazoo-cli`.
- Clients are consumed as **published packages**. A merged client change is not
  available to downstream repos until it is published; a downstream typecheck
  can fail against a stale published version even when both PRs are correct.
- Never hand-edit a generated client or an OpenAPI snapshot. Regenerate; an edit
  is silently overwritten and desynchronizes the contract.

### Feature worktrees

Feature work uses raw Git worktrees. The workspace does not manage their
location or lifecycle. Resolve the workspace root by finding the nearest
ancestor containing `workspace.json`, then create a worktree explicitly:

```powershell
$WORKSPACE_ROOT = (Get-Location).Path
while ($WORKSPACE_ROOT -and -not (Test-Path (Join-Path $WORKSPACE_ROOT "workspace.json"))) {
  $WORKSPACE_ROOT = Split-Path $WORKSPACE_ROOT -Parent
}
$repo = "workspace-cli"
$feature = "my-feature"
$wrk = Join-Path $WORKSPACE_ROOT "worktrees/$repo/$feature"
git -C (Join-Path $WORKSPACE_ROOT "repos/$repo") worktree add $wrk -b $feature
```

Use `git worktree list`, `git worktree remove`, and `git worktree prune` for
inspection and cleanup. Keep the chosen worktree path consistent with the child
repository's local instructions.

### Local secrets

- Never edit or commit credentials or `.env` files.
- Store secrets in the approved local vault or secret manager.
- Copy per-repository files manually into the target checkout when needed.

### Agent self-improvement (friction-gated)

File an issue **then and only then** when real work surfaced genuine friction:

- A bug (something is broken or wrong).
- A divergence (behavior does not match the intended/designed/built semantics).
- A genuine QoL gap (the friction measurably cost time or trust during a task).

Never hunt for improvements or file "nice-to-have" tickets. Sequence: finish the
current task first, then at the next natural break check the repo's issues/PRs
for existing effort, and only if a genuine gap remains open one precise issue
with a recommended fix (root cause, expected vs actual, concrete change).

**Per-repo snippet** — child repos may paste this into their own `AGENTS.md`
independently and as-needed (never mass-applied):

> **Agent self-improvement (friction-gated)** — File an issue only when real
> work surfaced a bug, a divergence from intended semantics, or a genuine QoL
> gap that measurably cost time or trust. Never hunt for improvements. Finish
> the current task first, check existing issues, then file one precise issue
> with a recommended fix.

### Worktree isolation (hard boundary)

All feature work must happen in a raw Git worktree. Never create branches or
commit directly inside `repos/<repo>`. If an agent's cwd is inside a child
checkout, it must create and enter a worktree before editing.

### Hard boundaries (human approval required)

- Creating or deleting repositories or manifest entries.
- Pushing directly to `main` (resets, force operations).
- Deploying or publishing artifacts.

### Publishing to JSR

Each family package publishes through its own `.github/workflows/publish.yml`:
the runner syncs the OpenAPI snapshot, compares `deno.json`'s `version` against
the published JSR latest, skips cleanly when they already match, and fails
loudly when a bump still ends up "already published". The trigger differs per
repo — `wazoo-client-ts` and `worlds-client-ts` fire on `release: published`,
the rest on a push to `main`. For the two release-triggered repos, creating the
GitHub release _is_ the publish step: a version bump merged to `main` on its own
is not enough there (measured 2026-09-26 — `worlds-client-ts` 0.2.1 sat
unpublished for 12+ minutes after the bump, then went out ~40s after the release
was created). JSR's `meta.json` does list a `githubRepository` for these
packages, so a connection exists on paper, but it did not fire in that test.
Publishing is an external action, so it still needs approval.

### Code-health standards

Every repo in this family follows these rules, and each repo's `AGENTS.md` links
here for the canonical statement. CI enforces what a tool can check; the rest is
review discipline.

- **Gates.** Format, lint, and typecheck run on every pull request and push to
  `main` and must pass. Strict typing is on. No `any` and no `@ts-ignore`: use
  `unknown` and narrow it, or `@ts-expect-error <reason>`. A lint disable needs
  a reason on the same line.
- **File size.** At most 120 lines of code per file (300 for tests), counting
  neither blank, comment, nor import lines. Generated, vendored, schema,
  snapshot, and fixture files are exempt. The check (`code-health.yml`) is
  warn-only while existing files are split; never add a new violation, and split
  a file when you touch it. Function limits worth holding in review: about 40
  lines, complexity 10, nesting 3, four parameters.
- **TODOs.** A `TODO` or `FIXME` links an issue.
- **Supply chain.** Pin third-party workflow actions to a full commit SHA with a
  `# vX.Y.Z` comment, pin toolchains exactly (`deno-version`, `.node-version`),
  and install from the lockfile frozen. Renovate proposes bumps; do not
  hand-edit pins to float.
- **Secrets.** `secret-scan.yml` (gitleaks, pinned and checksummed) runs on
  every pull request. A real finding is fixed and rotated, never allowlisted.
  Only a verified false positive gets an exact-fingerprint `.gitleaksignore`
  line, with no regex allowlists and no rule disables. Never print a flagged
  value.
- **Changes.** Keep pull requests under about 400 changed lines or say why. A
  change to an OpenAPI schema, a client's types, a route contract, or a shared
  identifier lists its downstream dependents, the merge order, and what could
  not be observed (see Cross-repo changes). Coverage floors only rise: raise
  them in the PR that earns it, never lower one without a named exemption.
- **Ownership.** Every repo has `.github/CODEOWNERS` and a README with its
  owner, purpose, and the one command that sets up, builds, and tests it.

### Keep this repository simple

This repository is public and was recreated on 2026-10-10 as a single clean
commit. The version it replaced stopped being a harness because it accumulated
files, and the rebuild only worked because nothing carried over. The rules below
exist so that does not happen again.

- **Keep it simple.** This repository is a harness and a pointer. Anything with
  content belongs in the repository that owns it; this one federates checkouts,
  it does not document them.
- **Add no files, ever.** Twelve tracked files is the ceiling, not a starting
  point. A scratch note, agent transcript, runbook, secret inventory, run log,
  design document, or generated report is not a candidate here. If one genuinely
  seems needed, ask Ethan first and expect the answer to be a different
  repository.
- **Never add session-shaped material.** Agent transcripts, exported
  conversation logs, captured command output, and environment dumps are
  gitignored for that reason. An unfiltered log is how a private repository
  becomes an unsafe public one.
- **Secret-shaped material goes elsewhere.** Inventories, secret names, which
  service needs which value, and infrastructure runbooks belong in the private
  ops home: `wazootech/memory` for durable records, plus a private repository
  for secrets-adjacent material. A value-free inventory is still the map worth
  stealing.
- **Say only what is true.** If `README.md` claims a control,
  `.github/workflows/` holds it. `secret-scan.yml` exists so the claim about
  scanning is real, and scanning and push protection are enabled on the
  repository as the second line behind CI.
- **Prefer deletion to accumulation.** Edits that shrink the tree are welcome.

Treat any repository meant for publication as public from its first commit, and
scan it for secrets before the push that makes it public.

The predecessor, [`workspace-v1`](https://github.com/wazootech/workspace-v1), is
archived and read-only: history to consult if needed, never a source to copy
back in.

Public repositories in this family carry a `LICENSE` file and allow forking.
