// The one npm release in the sweep: the `wazootech-wiki` command.
//   bun sweep/npm.ts <runtime> <label>
import { writeFileSync } from "node:fs";
import { consumer } from "./consumer.ts";
import { cause, run } from "./run.ts";

const [runtime, label] = process.argv.slice(2);
const name = "wazootech-wiki";
const response = await fetch(`https://registry.npmjs.org/${name}/latest`);
const { version } = (await response.json()) as { version: string };
const { dir, install } = consumer(runtime, `${name}@${version}`);
const age = "--minimum-dependency-age=0";
const argv =
  runtime === "deno"
    ? ["deno", "run", "--no-config", age, "-A", `npm:${name}@${version}`]
    : runtime === "bun"
      ? ["bun", "run", "wiki"]
      : ["npx", "--no-install", "wiki"];
const r = install ? undefined : run([...argv, "--help"], dir, 180_000);
const result = install ?? (r?.code ? cause(r.out) : "ok");
console.log(name, version, result);
writeFileSync(
  `npm-${label}.json`,
  JSON.stringify({ label, npm: { name, version, result } }),
);
