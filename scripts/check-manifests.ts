/**
 * check-manifests keeps package.json (what Bun installs and tests against) in
 * lockstep with jsr.json (what `jsr publish` ships): the same export map and
 * the same dependency ranges, with each `jsr:` dependency spelled as its
 * `npm:@jsr/<scope>__<name>` alias in package.json.
 *
 * Usage: `bun scripts/check-manifests.ts [repoDir]` (defaults to the current
 * directory). Temporary home: copy it into a repo's `scripts/` until it moves
 * into workspace-cli (see wazootech/workspace#50).
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] ?? ".");
const read = (name: string) =>
  JSON.parse(readFileSync(join(dir, name), "utf8")) as {
    exports?: unknown;
    imports?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
const jsr = read("jsr.json");
const pkg = read("package.json");

const problems: string[] = [];
const fail = (message: string) => problems.push(message);

/** expectedPackageSpec maps a jsr.json import specifier to package.json's. */
function expectedPackageSpec(spec: string): string {
  if (spec.startsWith("npm:")) {
    return spec.slice("npm:".length).replace(/^.+?@/, "");
  }
  const [, scope, name, range] = /^jsr:@([^/]+)\/([^@]+)@(.+)$/.exec(spec) ??
    [];
  return `npm:@jsr/${scope}__${name}@${range}`;
}

if (JSON.stringify(jsr.exports) !== JSON.stringify(pkg.exports)) {
  fail("exports differ between jsr.json and package.json");
}

const deps = pkg.dependencies ?? {};
const imports = jsr.imports ?? {};
for (const [alias, spec] of Object.entries(imports)) {
  if (alias === "@/") continue;
  if (!(alias in deps)) {
    fail(`jsr.json imports "${alias}" but package.json does not depend on it`);
  } else if (deps[alias] !== expectedPackageSpec(spec)) {
    fail(`"${alias}": jsr.json ${spec} vs package.json ${deps[alias]}`);
  }
}
for (const alias of Object.keys(deps)) {
  if (!(alias in imports)) {
    fail(`package.json depends on "${alias}" but jsr.json does not import it`);
  }
}

if (problems.length > 0) {
  console.error(problems.map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}
console.log("package.json and jsr.json agree on exports and dependencies.");
