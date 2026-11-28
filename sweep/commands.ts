// Command-line entry points of an installed package. JSR's npm layer adds no
// `bin`, so on Bun and Node both the command name and the file path are tried.
import { cause, run } from "./run.ts";

export function checkCommands(
  runtime: string,
  jsr: string,
  name: string,
  path: string,
  dir: string,
): Record<string, string> {
  const attempt = (argv: string[]) => {
    const r = run([...argv, "--help"], dir, 120_000);
    return r.code ? cause(r.out) : "ok";
  };
  if (runtime === "deno") {
    const age = "--minimum-dependency-age=0";
    const deno = ["deno", "run", "--no-config", age, "--allow-all", jsr];
    return { "deno run jsr:…/cli": attempt(deno) };
  }
  const bun = runtime === "bun";
  const command = name === "@wazoo/workspace" ? "wspace" : "wiki";
  return {
    "by command name": attempt(
      bun ? ["bun", "run", command] : ["npx", "--no-install", command],
    ),
    "by file path": attempt([
      bun ? "bun" : "node",
      `node_modules/${name}/${path}`,
    ]),
  };
}
