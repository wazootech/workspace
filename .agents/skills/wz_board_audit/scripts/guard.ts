/** Rules and steps for a safe board edit. All GitHub access comes in as `io`. */
export interface Change {
  field: string;
  /** Null clears the field. */
  value: string | null;
}
export interface Item {
  /** OPEN, CLOSED, or MERGED. */
  state: string;
  /** Single-select values on the board, by field name. */
  values: Record<string, string>;
}
export interface BoardIo {
  read(): Item;
  /** Resolves every change before writing any; returns the write. */
  prepare(changes: Change[]): () => void;
  /** Gives board workflows time to act on the write. */
  settle(): Promise<void>;
}

export function parseChanges(args: string[]): Change[] {
  const changes = args.map((text) => {
    const at = text.indexOf("=");
    if (at < 1) {
      throw new Error(`expected Field=Value or Field=, got "${text}"`);
    }
    return { field: text.slice(0, at), value: text.slice(at + 1) || null };
  });
  const fields = new Set(changes.map((change) => change.field));
  if (changes.length === 0 || fields.size < changes.length) {
    throw new Error("give at least one change, and each field only once");
  }
  return changes;
}

/** Why these changes must not be made, or null when they may be. */
export function refusal(item: Item, changes: Change[]): string | null {
  if (item.state !== "OPEN") return null;
  const status = changes.find((change) => change.field === "Status");
  if (status?.value === "Done") {
    return "marking an open item Done can close its issue; close the issue instead";
  }
  if (item.values.Status !== "Done") return null;
  if (status && changes.length === 1) return null;
  return (
    "this item is open and marked Done, so an edit can close its issue; " +
    "move Status off Done first, as its own edit"
  );
}

const shown = (value: string | null | undefined) => value ?? "(none)";

/** The item after a write, saying plainly when it cannot be read. */
function readBack(io: BoardIo): Item {
  try {
    return io.read();
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    throw new Error(
      `tried to write, but cannot read the item. Check it: ${why}`,
    );
  }
}

/** Makes the changes, then confirms the issue kept its state. */
export async function apply(changes: Change[], io: BoardIo): Promise<string> {
  const before = io.read();
  const reason = refusal(before, changes);
  if (reason !== null) throw new Error(`refused, nothing changed: ${reason}`);
  const write = io.prepare(changes);
  let failed: { error: unknown } | null = null;
  try {
    write();
  } catch (error) {
    failed = { error };
  }
  // A failed write may have landed in part, so the state is checked either way.
  await io.settle();
  const after = readBack(io);
  if (after.state !== before.state) {
    throw new Error(
      `THE ISSUE CHANGED STATE: ${before.state} -> ${after.state}. Check it now.`,
    );
  }
  if (failed !== null) throw failed.error;
  const wrong = changes.filter(
    (change) => (after.values[change.field] ?? null) !== change.value,
  );
  if (wrong.length > 0) {
    const names = wrong.map((change) => change.field).join(", ");
    throw new Error(`written, but the board shows another value for: ${names}`);
  }
  const edits = changes.map(
    ({ field, value }) =>
      `${field}: ${shown(before.values[field])} -> ${shown(value)}`,
  );
  return `${edits.join(", ")}; state still ${after.state}`;
}
