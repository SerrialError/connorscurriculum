// Picking a set's questions: in order, shuffled with the set's seed, or weakest topics first.
import { filterQuestions } from './filters';
import { UNSEEN_ACCURACY, areaKey, scoreAreas, topicAccuracy } from './score';
import type { Filters, History, PracticeQuestion, PracticeTest } from './types';

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

export function selectQuestions(
  matching: PracticeQuestion[],
  f: Pick<Filters, 'mode' | 'n'>,
  history: History,
  rng: Rng,
): PracticeQuestion[] {
  const n = f.n ?? matching.length;
  if (f.mode === 'all') return matching.slice(0, n);
  if (f.mode === 'random') return shuffle(matching, rng).slice(0, n);

  const accuracy = topicAccuracy(matching, history);
  const weakness = (q: PracticeQuestion) => Math.min(...scoreAreas(q).map((a) => accuracy.get(areaKey(a)) ?? UNSEEN_ACCURACY));
  // Shuffle first so ties are broken randomly; sort is stable.
  return shuffle(matching, rng)
    .map((q) => ({ q, w: weakness(q) }))
    .sort((a, b) => a.w - b.w)
    .slice(0, n)
    .map(({ q }) => q);
}

/**
 * The questions of the set a URL names: its ids (skipping any that no longer exist), or the
 * questions its filters match, picked with its seed.
 */
export function questionsForSet(
  all: PracticeQuestion[],
  spec: { filters: Filters; seed: string; ids: string[] | null },
  tests: PracticeTest[],
  history: History,
): PracticeQuestion[] {
  if (spec.ids) {
    const byId = new Map(all.map((q) => [q.id, q]));
    return [...new Set(spec.ids)].flatMap((id) => byId.get(id) ?? []);
  }
  return selectQuestions(filterQuestions(all, spec.filters, tests), spec.filters, history, seededRng(spec.seed));
}
