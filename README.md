# Wazoo workspace harness

Canonical launchpoint for local Wazoo development. Each child directory under
`repos/` is an independent Git repository listed in `workspace.json`. Not a
monorepo. No Git submodules.

The workspace root is the canonical checkout of this harness. Child repositories
under `repos/` are independent project checkouts managed by the manifest.

Workspace management tasks delegate to the published
[`@wazoo/workspace`](https://jsr.io/@wazoo/workspace) package.

## Install

### Package managers

```sh
# Deno (first-class JSR support)
deno add jsr:@wazoo/workspace

# Bun / npm / pnpm / Yarn (via JSR npm compatibility layer)
npx jsr add @wazoo/workspace
```

### CDN (browser / no build step)

[esm.sh](https://esm.sh) serves JSR packages as ES modules — no install, no
bundler needed.

```js
import { ... } from "https://esm.sh/jsr/@wazoo/workspace@0.6.0";
```

With an import map:

```html
<script type="importmap">
{
  "imports": {
    "@wazoo/workspace": "https://esm.sh/jsr/@wazoo/workspace@0.6.0"
  }
}
</script>
<script type="module">
  import { ... } from "@wazoo/workspace";
</script>
```

Pin to an exact build for deterministic caching:

```js
import { ... } from "https://esm.sh/jsr/@wazoo/workspace@0.6.0?pin=v1724100000";
```

## Commands

```sh
deno task workspace:validate
deno task workspace:check
deno task workspace:install
deno task workspace:update
```

`wspace init` scaffolds a brand-new workspace in an empty directory;
`workspace:install` clones the repositories listed in `workspace.json`.

## Security

Do not commit agent session transcripts, exported conversation logs, local
configuration, credentials, or command output that may contain secrets. Store
local credentials in your approved local secrets manager. For per-repository
manual setup, copy files into the target checkout without committing them.

Pull requests and pushes are checked by the Secret scan workflow. A clean scan
helps prevent new leaks; it does not remove secrets already present in Git
history. If a credential is exposed, revoke or rotate it first, then remove the
sensitive files from every reachable Git ref and coordinate a force-push with
all repository users.
