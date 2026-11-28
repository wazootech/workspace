// "Assisted" Node pass only: resolves the `@/` tsconfig alias and extensionless
// relative imports the way Bun does, so test behaviour can be measured.
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const isFile = (path) => existsSync(path) && statSync(path).isFile();
const SUFFIXES = ["", ".ts", ".tsx", "/mod.ts", "/index.ts"];
const find = (base) => SUFFIXES.map((s) => base + s).find(isFile);

registerHooks({
  resolve(specifier, context, next) {
    let base;
    if (specifier.startsWith("@/")) {
      base = join(process.cwd(), "src", specifier.slice(2));
    } else if (
      specifier.startsWith(".") &&
      context.parentURL?.startsWith("file:") &&
      !context.parentURL.includes("node_modules")
    ) {
      base = fileURLToPath(new URL(specifier, context.parentURL));
    }
    const hit = base && find(base);
    return next(hit ? pathToFileURL(hit).href : specifier, context);
  },
});
