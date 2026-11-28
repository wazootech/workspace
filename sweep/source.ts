// Runs one repository's test files and scripts under Bun, Node and Deno.
//   bun sweep/source.ts <repo> <checkout> <result.json>
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cause, run } from "./run.ts";

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

const DENO = [
  "deno",
  "test",
  "--allow-all",
  "--no-check",
  "--node-modules-dir=manual",
];
const COMMANDS: Record<string, (file: string) => string[]> = {
  bun: (f) => ["bun", "test", "--timeout", "120000", `./${f}`],
  node: (f) => [
    "node",
    "--test",
    "--test-reporter=tap",
    "--test-timeout=120000",
    f,
  ],
  deno: (f) => [...DENO, f],
};

function count(runtime: string, out: string, word: "pass" | "fail"): number {
  const pattern = {
    bun: new RegExp(`^\\s*(\\d+) ${word}$`, "m"),
    node: new RegExp(`^# ${word} (\\d+)$`, "m"),
    deno: new RegExp(`\\| (\\d+) ${word === "pass" ? "passed" : "failed"}`),
  }[runtime];
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

const SCRIPT: Record<string, string[]> = {
  bun: ["bun"],
  node: ["node"],
  deno: ["deno", "run", "--allow-all", "--node-modules-dir=manual"],
};
const scripts = (target.scripts ?? []).flatMap((script) =>
  Object.entries(SCRIPT).map(([runtime, command]) => {
    run(["git", "clean", "-qfdx", "-e", "node_modules"], dir);
    const r = run([...command, script], dir);
    if (r.code)
      console.log(
        `::group::${runtime} ${script}\n${r.out.slice(-4000)}\n::endgroup::`,
      );
    // Hash what the script wrote, so runtimes can be compared.
    const written = run(
      ["git", "status", "--porcelain", "--ignored", "-uall", "."],
      dir,
    )
      .out.split("\n")
      .map((l) => l.slice(3).trim())
      .filter((f) => f && !f.includes("node_modules"))
      .toSorted();
    const hash = createHash("sha256");
    for (const f of written)
      hash.update(f).update(run(["git", "hash-object", f], checkout).out);
    const printed = createHash("sha256")
      .update(r.stdout.replaceAll("\r", ""))
      .digest("hex");
    const digest = `${written.length} files ${hash.digest("hex").slice(0, 10)}, stdout ${printed.slice(0, 10)}`;
    return {
      script,
      runtime,
      ok: r.code === 0,
      digest,
      error: r.code ? cause(r.out) : undefined,
    };
  }),
);

const sha = run(["git", "rev-parse", "--short", "HEAD"], checkout).out.trim();
writeFileSync(
  output,
  JSON.stringify({ repo, sha, files: files.length, tests, scripts }),
);
