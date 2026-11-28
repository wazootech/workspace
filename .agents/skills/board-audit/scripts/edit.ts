/** Edits one board item, refusing edits that can close its issue. */
import { ghBoard } from "./board_io.ts";
import { apply, parseChanges } from "./guard.ts";

const [target, ...changes] = process.argv.slice(2);

try {
  if (!target) {
    throw new Error("usage: edit.ts <repo>#<number> Field=Value [Field=...]");
  }
  const result = await apply(parseChanges(changes), ghBoard(target));
  console.log(`${target}: ${result}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${target ?? "edit"}: ${message}`);
  process.exitCode = 1;
}
