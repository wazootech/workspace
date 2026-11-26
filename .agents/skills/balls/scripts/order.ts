/** Shortlist order: what to look at first. Move precedence is separate. */
import type { Ball, Move } from "./types.ts";

function tier(ball: Ball): number {
  const moves: Move[] = [ball.move, ...ball.secondary];
  if (moves.includes("Merge")) return 0; // ready to merge
  if (moves.includes("Reply") || moves.includes("Review")) return 1; // waiting
  return 2; // everything else, including plain assignments
}

/** Tier first, then the longest wait. */
export function byPriority(a: Ball, b: Ball): number {
  return tier(a) - tier(b) || a.since.localeCompare(b.since);
}
