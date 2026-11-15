// Repeatable randomness: a set's seed picks the same questions in the same order every time.

export type Rng = () => number;

/** A repeatable random number generator for a seed (FNV-1a hash of the seed, then mulberry32). */
export function seededRng(seed: string): Rng {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A new set's seed: six URL-safe characters. */
export function newSeed(rng: Rng = Math.random): string {
  return Math.floor(rng() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
