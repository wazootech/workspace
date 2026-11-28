import { spawnSync } from "node:child_process";

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
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}\n${r.error?.message ?? ""}`;
  return { code: r.status ?? 1, out, stdout: r.stdout ?? "" };
}

const CAUSE =
  /(ERR_[A-Z_]+|Cannot find|Could not resolve|SyntaxError|TypeError|ReferenceError|RangeError|AssertionError|NotCapable|Unsupported|not supported|not implemented|error:|Error:)/;

/** The first line of output that says why a command failed. */
export function cause(out: string): string {
  const lines = out.split("\n").map((l) => l.trim());
  const hit =
    lines.find((l) => CAUSE.test(l)) ??
    lines.findLast((l) => l.length > 0) ??
    "";
  return hit.replaceAll(process.cwd(), ".").slice(0, 300);
}
