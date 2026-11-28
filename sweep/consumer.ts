// A fresh consumer project with one dependency installed, as a user would.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cause, run } from "./run.ts";

export function consumer(runtime: string, spec: string) {
  const dir = mkdtempSync(join(tmpdir(), "sweep-"));
  const write = (file: string, text: string) =>
    writeFileSync(join(dir, file), text);
  let install: string | undefined;
  if (runtime !== "deno") {
    write("package.json", '{"name":"consumer","private":true,"type":"module"}');
    write(".npmrc", "@jsr:registry=https://npm.jsr.io\n");
    const npm = ["npm", "install", "--no-audit", "--no-fund"];
    const r =
      runtime === "bun"
        ? run(["bun", "add", "--minimum-release-age", "0", spec], dir)
        : run([...npm, spec], dir);
    if (r.code) install = cause(r.out);
    if (!install && runtime.startsWith("node")) {
      run([...npm, "typescript@5", "@types/node@24"], dir);
    }
  }
  return { dir, write, install };
}
