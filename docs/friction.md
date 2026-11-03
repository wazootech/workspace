# Rule friction

- 2026-10-12 — **Wikipedia template pins the CLI to 0.1.23, splitting repo toolchains.**
  Adopting `wazootech/wiki-templates/wikipedia` in a real repo
  (`EthanThatOneKid/codecampus-memory`) locks the repo into the 0.1.23-era
  toolchain twice over: (1) `build.py` imports the 0.1.23 Python library API
  (`wiki.site.build`, `wiki.schemas.metadata`, …) which no later PyPI release
  exposes (post-0.1.23 wheels bundle a Deno binary, no importable library);
  (2) the template's `wiki.yml` fmt keys are the old mdformat set
  (`wrap`/`end_of_line`/`extensions`), which the modern Deno CLI rejects at
  config load (it expects `textWrap`/`newLineKind`, extensions dropped).
  Net effect: local `wiki` (≥0.2) cannot run in the adopted repo, and the
  template cannot run on the current CLI — a repo on the Wikipedia theme must
  pin `wazootech-wiki==0.1.23` everywhere and use the venv copy for local
  checks. Suggested follow-up: either teach the modern CLI the theme tokens
  (retire `build.py`) or add a config-compat shim plus a template release note
  stating the required CLI range.

- 2026-10-13 — **A feature worktree under `worktrees/<repo>/` was reclaimed
  mid-session, twice.** Working `workspace-cli` on branch
  `cross-runtime-engine`, the worktree at
  `worktrees/workspace-cli/cross-runtime-engine` disappeared twice within
  minutes of being created. The deletion was clean rather than a wipe:
  `git worktree list` showed only the main checkout and `.git/worktrees/`
  held no stale registration, so something deregistered it properly. It was not
  a blanket sweep either: other repos' worktrees survived (`wazoo-api`,
  `wazoo-console`, `wiki-desktop`, `wiki-templates`,
  `worlds-cloudflare`), and two other `opencode` sessions had been running
  since 10:33. I could not identify the process. No work was lost, because every
  commit had already been pushed, but finishing the task meant moving to a clone
  outside the workspace. The cost is not the lost files; it is that this failure
  presents as "my edits vanished" when an agent's working directory is deleted,
  which invites a phantom-bug hunt, and the only recovery the rules prescribe
  (recreate the worktree) is defeated by the same actor that removed it.
  Suggested follow-up: find what reclaims worktrees and have it skip a worktree
  whose branch has unpushed commits or an open pull request, log every removal,
  and never act on a directory that is a session's working directory.

- 2026-10-14 — **The secrets contract has no conforming implementation for
  PR-triggered preview deploys.** R5 says a PR-triggered job must not hold
  `CLOUDFLARE_API_TOKEN`, and its implementation flags
  `secrets.CLOUDFLARE_API_TOKEN`; R1/R3 push such a job toward a named Infisical
  fetch instead. But the shared machine identity refuses OIDC from a
  `pull_request` context — verified on `wazoo-console#121`:
  `Access denied: OIDC claim not allowed` (401) — and all eleven
  `Infisical/secrets-action` fetches in the family, across eleven jobs, are
  gated on push-to-main, `workflow_dispatch`, or a schedule, none on a PR. So a job that deploys a preview Worker per
  PR has exactly two states: red check (GitHub secret) or red job (fetched
  token), and only a credential decision resolves it — a dedicated preview
  token and identity, or dropping PR previews. The refusal is invisible from the
  lint, which passes on the conformed branch, so the cost is paid at runtime
  only; worse, the lint's job scanner hid a second violation in the same file
  (a blank line ends a job — `wazootech/workspace-cli#163`), so the first PR
  after the lint landed read as 2 findings where there were 3. Suggested
  follow-up: say in the contract that PR-triggered deploys need their own
  credential, and have R5 emit that guidance instead of pointing at a fetch the
  identity will refuse.
- 2026-10-15 — **The worktree rule cannot be satisfied when a managed checkout
  holds another session's uncommitted work.** Feature work belongs in a raw Git
  worktree, but a parallel session had left the song-anchor and Strudel changes
  uncommitted in `repos/codecampus-skills`, in the same files the word-bank work
  touched (`SKILL.md`, `draft_specs.py`, `render_onepager.py`). Branching a
  worktree from HEAD would have dropped that work from the tree the next commit
  was made in, and stashing or committing it would mean committing changes this
  session did not author. The work was therefore committed on a branch in the
  managed checkout, split by file so the parallel work sits in its own commit
  with its own message. Suggested follow-up: say what to do when a checkout is
  shared — either an explicit "commit the parallel work as its own commit on the
  feature branch" rule, or a session-scoped lock so only one session writes a
  checkout at a time.
