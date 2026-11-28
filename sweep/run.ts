import { spawnSync } from "node:child_process";
import { stripVTControlCharacters } from "node:util";

export type Result = { code: number; out: string; stdout: string };

/** Runs a command and returns its exit code and combined output. */
export function run(command: string[], cwd: string, timeout = 600_000): Result {
  const windows = process.platform === "win32";
  const [head, ...rest] = command;
  // npm and npx are .cmd shims on Windows and need a shell.
  const shell = windows && (head === "npm" || head === "npx");
  const r = spawnSync(head, rest, {
    cwd,
    shell,
    timeout,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
  });
  const raw = `${r.stdout ?? ""}\n${r.stderr ?? ""}\n${r.error?.message ?? ""}`;
  const out = stripVTControlCharacters(raw);
  return { code: r.status ?? 1, out, stdout: r.stdout ?? "" };
}

// Most specific first: the first pattern that matches any line wins.
const CAUSES = [
  /Cannot find (module|package) .*/,
  /(ERR_[A-Z_]+|SyntaxError)[^:]*: .*/,
  /Import ".*" not a dependency.*/,
  /TS\d{4}.*/,
  /(error|Error|TypeError|AssertionError)[:[ ].*/,
];

/** The line of output that best says why a command failed. */
export function cause(out: string): string {
  const lines = out.split("\n").map((l) => l.trim());
  const found = CAUSES.map((p) =>
    lines.map((l) => p.exec(l)?.[0]).find(Boolean),
  );
  const hit = found.find(Boolean) ?? lines.findLast((l) => l.length > 0) ?? "";
  return hit.replaceAll(process.cwd(), ".").slice(0, 300);
}
