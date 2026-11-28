// Installs the latest JSR release of each package into a fresh project and
// imports every export under one runtime.  bun sweep/published.ts <runtime> <label>
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  const dir = mkdtempSync(join(tmpdir(), "sweep-"));
  const write = (file: string, text: string) =>
    writeFileSync(join(dir, file), text);
  let install: string | undefined;
  if (runtime !== "deno") {
    write("package.json", '{"name":"consumer","private":true,"type":"module"}');
    write(".npmrc", "@jsr:registry=https://npm.jsr.io\n");
    const spec = `${name}@npm:@jsr/${scope}__${short}@${version}`;
    const r =
      runtime === "bun"
        ? run(["bun", "add", "--minimum-release-age", "0", spec], dir)
        : run(["npm", "install", "--no-audit", "--no-fund", spec], dir);
    if (r.code) install = cause(r.out);
    if (!install && runtime.startsWith("node")) {
      run(
        [
          "npm",
          "install",
          "--no-audit",
          "--no-fund",
          "typescript@5",
          "@types/node@24",
        ],
        dir,
      );
    }
  }
  const exports = Object.keys(meta.exports as Record<string, string>).map(
    (key, i) => {
      if (install) return { key, load: install };
      const base = runtime === "deno" ? `jsr:${name}@${version}` : name;
      const spec = base + (key === "." ? "" : key.slice(1));
      const file = `load${i}.mjs`;
      write(
        file,
        `const m = await import("${spec}");\nconsole.log("NAMES " + Object.keys(m).sort());\n`,
      );
      const loaded =
        runtime === "deno"
          ? run(["deno", "run", "--no-config", AGE, "--allow-all", file], dir)
          : run([runtime === "bun" ? "bun" : "node", file], dir);
      const names = /^NAMES (.*)$/m.exec(loaded.out)?.[1];
      const typed = `types${i}.ts`;
      write(typed, `import * as m from "${spec}";\nexport default m;\n`);
      let check;
      if (runtime === "deno")
        check = run(["deno", "check", "--no-config", AGE, typed], dir);
      if (runtime.startsWith("node")) {
        const flags =
          "--noEmit --strict --skipLibCheck --module nodenext --target es2022";
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
  let bin: string | undefined;
  const command: string | undefined = targets.bins[name];
  if (command && !install) {
    const argv =
      runtime === "deno"
        ? [
            "deno",
            "run",
            "--no-config",
            AGE,
            "--allow-all",
            `jsr:${name}@${version}/cli`,
          ]
        : runtime === "bun"
          ? ["bun", "run", command]
          : ["npx", "--no-install", command];
    const r = run([...argv, "--help"], dir, 120_000);
    bin = r.code ? cause(r.out) : "ok";
  }
  console.log(
    name,
    version,
    JSON.stringify(exports.map((e) => [e.key, e.load, e.types])),
    bin ?? "",
  );
  packages.push({ name, version, published, exports, bin });
}
writeFileSync(`${label}.json`, JSON.stringify({ label, packages }));
