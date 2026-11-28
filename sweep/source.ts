// Runs one repository's test files and scripts under Bun, Node and Deno.
//   bun sweep/source.ts <repo> <checkout> <result.json>
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cause, run } from "./run.ts";
import { runScripts } from "./scripts.ts";

type Target = {
  repo: string;
  paths?: string[];
  scripts?: string[];
  dir?: string;
};

const [repo, checkout, output] = process.argv.slice(2);
const all = JSON.parse(
  readFileSync(new URL("./targets.json", import.meta.url), "utf8"),
);
const target: Target = all.source.find((t: Target) => t.repo === repo);
const dir = join(checkout, target.dir ?? ".");

const TEST = /[._](test|spec)\.(ts|tsx|js|mjs)$/;
const files = run(["git", "ls-files"], dir)
  .out.split("\n")
  .map((f) => f.trim())
  .filter(
    (f) => TEST.test(f) && (target.paths ?? [""]).some((p) => f.startsWith(p)),
  );

// Used by the assisted Deno pass only.
const map = join(tmpdir(), "sweep-import-map.json");
const src = `${pathToFileURL(resolve(dir, "src")).href}/`;
writeFileSync(map, JSON.stringify({ imports: { "@/": src } }));

const NODE = ["node", "--test", "--test-reporter=tap", "--test-timeout=120000"];
const DENO = ["deno", "test", "--allow-all", "--no-check"];
const MANUAL = "--node-modules-dir=manual";
const HOOK = new URL("./alias.mjs", import.meta.url).href;
const COMMANDS: Record<string, (file: string) => string[]> = {
  bun: (f) => ["bun", "test", "--timeout", "120000", `./${f}`],
  node: (f) => [...NODE, f],
  deno: (f) => [...DENO, MANUAL, f],
  "node-assisted": (f) => [
    "node",
    "--experimental-transform-types",
    `--import=${HOOK}`,
    ...NODE.slice(1),
    f,
  ],
  "deno-assisted": (f) => [
    ...DENO,
    MANUAL,
    "--sloppy-imports",
    `--import-map=${map}`,
    f,
  ],
};

function count(runtime: string, out: string, word: "pass" | "fail"): number {
  const pattern = {
    bun: new RegExp(`^\\s*(\\d+) ${word}$`, "m"),
    node: new RegExp(`^# ${word} (\\d+)$`, "m"),
    deno: new RegExp(`\\| (\\d+) ${word === "pass" ? "passed" : "failed"}`),
  }[runtime.replace("-assisted", "")];
  return Number(pattern?.exec(out)?.[1] ?? 0);
}

const tests = Object.entries(COMMANDS).map(([runtime, command]) => {
  const results = files.map((file) => {
    const r = run(command(file), dir);
    const pass = count(runtime, r.out, "pass");
    const fail = count(runtime, r.out, "fail");
    const ok = r.code === 0 && fail === 0;
    if (!ok)
      console.log(
        `::group::${runtime} ${file}\n${r.out.slice(-4000)}\n::endgroup::`,
      );
    return { file, ok, pass, fail, error: ok ? undefined : cause(r.out) };
  });
  return { runtime, results };
});

const scripts = runScripts(target.scripts ?? [], dir, checkout);
const sha = run(["git", "rev-parse", "--short", "HEAD"], checkout).out.trim();
writeFileSync(
  output,
  JSON.stringify({ repo, sha, files: files.length, tests, scripts }),
);
