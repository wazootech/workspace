// Runs a repository's scripts under each runtime and fingerprints what they print
// and write, ignoring timings, so runtimes can be compared.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cause, run } from "./run.ts";

const COMMANDS: Record<string, string[]> = {
  bun: ["bun"],
  node: ["node"],
  deno: ["deno", "run", "--allow-all", "--node-modules-dir=manual"],
};

const steady = (text: string) =>
  text
    .replaceAll("\r", "")
    .replace(/\d+(\.\d+)?\s?ms\b/g, "<ms>")
    .replace(/("\w*[mM]s"\s*:\s*)[\d.]+/g, "$1<ms>")
    .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "<time>");

const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 10);

export function runScripts(scripts: string[], dir: string, checkout: string) {
  return scripts.flatMap((script) =>
    Object.entries(COMMANDS).map(([runtime, command]) => {
      run(["git", "checkout", "-q", "--", "."], dir);
      run(["git", "clean", "-qfdx", "-e", "node_modules"], dir);
      const r = run([...command, script], dir);
      if (r.code)
        console.log(
          `::group::${runtime} ${script}\n${r.out.slice(-4000)}\n::endgroup::`,
        );
      const status = [
        "git",
        "status",
        "--porcelain",
        "--ignored",
        "-uall",
        ".",
      ];
      const written = run(status, dir)
        .stdout.split("\n")
        .map((l) => l.slice(3).trim())
        .filter((f) => f && !f.includes("node_modules"))
        .toSorted();
      const content = written
        .map((f) => join(checkout, f))
        .filter((p) => statSync(p, { throwIfNoEntry: false })?.isFile())
        .map((p) => steady(readFileSync(p, "utf8")));
      return {
        script,
        runtime,
        ok: r.code === 0,
        files: written,
        filesDigest: digest(content.join("\0")),
        stdoutDigest: digest(steady(r.stdout)),
        stdout: r.stdout.slice(0, 1500),
        error: r.code ? cause(r.out) : undefined,
      };
    }),
  );
}
