export const TINT_COUNT = 6

/** Picks one of the soft avatar tints, stable for a given seed (the friend id). */
export function tintIndex(seed: string): number {
  let hash = 0
  for (const char of seed) hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) >>> 0
  return hash % TINT_COUNT
}
