// Installs the latest JSR release of each package into a fresh project and
// imports every export under one runtime.  bun sweep/published.ts <runtime> <label>
import { readFileSync, writeFileSync } from "node:fs";
import { checkCommands } from "./commands.ts";
import { consumer } from "./consumer.ts";
import { cause, run } from "./run.ts";

const [runtime, label] = process.argv.slice(2);
const targets = JSON.parse(
  readFileSync(new URL("./targets.json", import.meta.url), "utf8"),
);
const get = async (url: string) =>
  (await fetch(url, { headers: { accept: "application/json" } })).json();
const AGE = "--minimum-dependency-age=0";

const packages = [];
for (const name of targets.packages as string[]) {
  const version: string = (await get(`https://jsr.io/${name}/meta.json`))
    .latest;
  const meta = await get(`https://jsr.io/${name}/${version}_meta.json`);
  const [scope, short] = name.slice(1).split("/");
  const detail = await get(
    `https://api.jsr.io/scopes/${scope}/packages/${short}/versions`,
  );
  const items: { version: string; createdAt: string }[] =
    detail.items ?? detail;
  const published = items
    .find((v) => v.version === version)
    ?.createdAt.slice(0, 10);
  const spec = `${name}@npm:@jsr/${scope}__${short}@${version}`;
  const { dir, write, install } = consumer(runtime, spec);
  const exports = Object.keys(meta.exports as Record<string, string>).map(
    (key, i) => {
      if (install) return { key, load: install };
      const base = runtime === "deno" ? `jsr:${name}@${version}` : name;
      const from = base + (key === "." ? "" : key.slice(1));
      const json = key.endsWith(".json");
      const options = json ? ', { with: { type: "json" } }' : "";
      const file = `load${i}.mjs`;
      write(
        file,
        `const m = await import("${from}"${options});\nconsole.log("NAMES " + Object.keys(m).sort());\n`,
      );
      const loaded =
        runtime === "deno"
          ? run(["deno", "run", "--no-config", AGE, "--allow-all", file], dir)
          : run([runtime === "bun" ? "bun" : "node", file], dir);
      const names = /^NAMES (.*)$/m.exec(loaded.out)?.[1];
      const typed = `types${i}.ts`;
      const statement = json
        ? `import m from "${from}" with { type: "json" };`
        : `import * as m from "${from}";`;
      write(typed, `${statement}\nexport default m;\n`);
      let check;
      if (runtime === "deno")
        check = run(["deno", "check", "--no-config", AGE, typed], dir);
      if (runtime.startsWith("node")) {
        const flags =
          "--noEmit --strict --skipLibCheck --module nodenext --target es2022 --resolveJsonModule";
        check = run(
          ["npx", "tsc", ...flags.split(" "), "--types", "node", typed],
          dir,
        );
      }
      return {
        key,
        load: names === undefined ? cause(loaded.out) : "ok",
        names,
        types: check && (check.code ? cause(check.out) : "ok"),
      };
    },
  );
  const path: string | undefined = targets.bins[name];
  const commands =
    path && !install
      ? checkCommands(runtime, `jsr:${name}@${version}/cli`, name, path, dir)
      : undefined;
  console.log(
    name,
    version,
    JSON.stringify(exports.map((e) => [e.key, e.load, e.types])),
    JSON.stringify(commands ?? ""),
  );
  packages.push({ name, version, published, exports, commands });
}
writeFileSync(`${label}.json`, JSON.stringify({ label, packages }));
