/** Reads every page or throws, so a partial list is never reported. */
import type { Fetched, Page } from "./types.ts";

export function readAll<T>(fetchPage: (after: string | null) => Page<T>): T[] {
  const all: T[] = [];
  let after: string | null = null;
  let total = 0;
  do {
    const page: Page<T> = fetchPage(after);
    all.push(...page.nodes);
    total = page.total;
    if (page.hasNext && page.cursor === null) {
      throw new Error("GitHub reported another page but gave no cursor");
    }
    after = page.hasNext ? page.cursor : null;
  } while (after !== null);
  if (all.length < total) {
    throw new Error(`read only ${all.length} of ${total} results`);
  }
  return all;
}

export function attempt<T>(read: () => T): Fetched<T> {
  try {
    return { ok: true, value: read() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: message.split("\n")[0].slice(0, 200) };
  }
}
