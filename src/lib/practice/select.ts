// Picking a set's questions: in order, shuffled with the set's seed, weakest topics first, or a
// practice exam drawn by its class test's blueprint.
import { drawExam } from './exam';
import { emptyFilters, filterQuestions } from './filters';
import { type Rng, seededRng, shuffle } from './random';
import { UNSEEN_ACCURACY, areaKey, scoreAreas, topicAccuracy } from './score';
import type { Filters, History, PracticeQuestion, PracticeTest } from './types';

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
 * The questions of the set a URL names: its ids (skipping any that no longer exist), a practice
 * exam for its class test (none if the test has no exam), or the questions its filters match,
 * picked with its seed.
 */
export function questionsForSet(
  all: PracticeQuestion[],
  spec: { filters: Filters; exam: boolean; seed: string; ids: string[] | null },
  tests: PracticeTest[],
  history: History,
): PracticeQuestion[] {
  if (spec.ids) {
    const byId = new Map(all.map((q) => [q.id, q]));
    return [...new Set(spec.ids)].flatMap((id) => byId.get(id) ?? []);
  }
  if (spec.exam) {
    const exam = tests.find((t) => t.id === spec.filters.test)?.exam;
    return exam ? drawExam(filterQuestions(all, { ...emptyFilters(), test: spec.filters.test }, tests), exam, seededRng(spec.seed)) : [];
  }
  return selectQuestions(filterQuestions(all, spec.filters, tests), spec.filters, history, seededRng(spec.seed));
}
