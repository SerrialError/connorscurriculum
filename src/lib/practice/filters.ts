// The practice filters: their defaults, and which questions they match.
import type { Filters, Mode, PracticeQuestion, PracticeTest, QuestionMeta } from './types';

export const DEFAULT_COUNT = 10;

/** The "How many" choices; "All" and "Other" (a number box) come with them. */
export const COUNT_CHOICES: readonly number[] = [5, 10, 20];

/** The largest count "Other" accepts. */
export const MAX_COUNT = 200;

/**
 * Every control starts at its default: 10 questions, shuffled. Order and count are independent
 * (neither changes the other), so "How many: All" with "Order: Shuffled" is every question shuffled.
 */
export const DEFAULT_MODE: Mode = 'random';

/** Could be on the AP exam: tagged with at least one AP topic. Untagged questions are class-only. */
export const onApExam = (q: Pick<PracticeQuestion, 'cedTopics'>): boolean => q.cedTopics.length > 0;

export function emptyFilters(): Filters {
  return { chapters: [], sections: [], test: null, units: [], topics: [], difficulty: [], type: null, ap: null, mode: DEFAULT_MODE, n: DEFAULT_COUNT };
}

/** Number of filters that narrow the question pool (order and count are not filters). */
export function activeFilterCount(f: Filters): number {
  return f.chapters.length + f.sections.length + (f.test ? 1 : 0) + f.units.length + f.topics.length + f.difficulty.length + (f.type ? 1 : 0) + (f.ap ? 1 : 0);
}

/** Every control at its default (nothing for "Reset all" to reset). */
export const isDefaultFilters = (f: Filters): boolean =>
  activeFilterCount(f) === 0 && f.mode === DEFAULT_MODE && f.n === DEFAULT_COUNT;

/** "Other" in How many: a count that isn't one of the COUNT_CHOICES chips. */
export const isCustomCount = (n: number | null): boolean => n !== null && !COUNT_CHOICES.includes(n);

/** `list` with `value` added, or removed if it was there: a filter chip being toggled. */
export const toggled = <T>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/** In any of these textbook sections (any question, when the list is empty). */
export const inSections = (q: Pick<PracticeQuestion, 'sections'>, sections: readonly string[]): boolean =>
  sections.length === 0 || q.sections.some((s) => sections.includes(s));

/**
 * Filters combine with AND across kinds and OR within a kind. Units and topics are one
 * "CED" kind: a question matches if it is in any selected unit or has any selected topic.
 * `ap` keeps only questions that could be on the AP exam, or only class-only ones.
 * `extra` questions (samples, chapters not taught yet) only match when their chapter is picked,
 * by the chapter filter or by the class test's chapters: no chapter picked means the class's
 * chapters, not everything.
 */
export function filterQuestions<Q extends QuestionMeta>(questions: Q[], f: Filters, tests: PracticeTest[]): Q[] {
  // Read each filter once: `f` is often the setup screen's reactive state, where every read costs
  // something, and the setup screen runs this for every filter chip's count.
  const chapters = new Set(f.chapters);
  const sections = [...f.sections];
  const units = new Set(f.units);
  const topics = new Set(f.topics);
  const difficulty = new Set(f.difficulty);
  const { type, ap } = f;
  const test = f.test ? tests.find((t) => t.id === f.test) : undefined;
  if (f.test && !test) return [];
  const testChapters = new Set(test?.chapters ?? []);
  const testSections = test?.sections ?? [];
  return questions.filter((q) => {
    if (chapters.size && !chapters.has(q.chapter)) return false;
    if (!inSections(q, sections)) return false;
    if (q.extra && !chapters.has(q.chapter) && !testChapters.has(q.chapter)) return false;
    if (test && (!testChapters.has(q.chapter) || !inSections(q, testSections))) return false;
    if (units.size || topics.size) {
      if (!q.units.some((u) => units.has(u)) && !q.cedTopics.some((t) => topics.has(t))) return false;
    }
    if (difficulty.size && !difficulty.has(q.difficulty)) return false;
    if (type && q.type !== type) return false;
    if (ap && onApExam(q) !== (ap === 'ap')) return false;
    return true;
  });
}

/**
 * How many questions would match if `patch` replaced part of the filters. Used to show a count
 * next to each filter option (e.g. "Ch. 7 · 64") given the other filters already chosen.
 */
export function countWith(
  questions: QuestionMeta[],
  f: Filters,
  tests: PracticeTest[],
  patch: Partial<Filters>,
): number {
  return filterQuestions(questions, { ...f, ...patch }, tests).length;
}

/**
 * Every unit's and topic's countWith(questions, f, tests, { units: [id], topics: [] }) (or
 * topics: [id]), in one pass over the questions instead of one per chip.
 */
export function cedCounts(questions: QuestionMeta[], f: Filters, tests: PracticeTest[]): { units: Map<string, number>; topics: Map<string, number> } {
  const units = new Map<string, number>();
  const topics = new Map<string, number>();
  const add = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const q of filterQuestions(questions, { ...f, units: [], topics: [] }, tests)) {
    new Set(q.units).forEach((u) => add(units, u));
    new Set(q.cedTopics).forEach((t) => add(topics, t));
  }
  return { units, topics };
}

/** Number of questions a set with these settings will have. */
export function sessionSize(matching: number, f: Pick<Filters, 'n'>): number {
  return f.n === null ? matching : Math.min(f.n, matching);
}

/**
 * CED topics covered by the filters (for the past AP FRQs on them): selected topics, every topic
 * in selected units, and the topics taught by selected chapters or by the selected test's
 * chapters. Empty when no topic-related filter is set.
 */
export function filterTopics(
  f: Filters,
  units: { id: string; topics: { id: string }[] }[],
  chapterTopics: Record<string, string[]>,
  tests: PracticeTest[],
): Set<string> {
  const out = new Set(f.topics);
  for (const u of units) if (f.units.includes(u.id)) for (const t of u.topics) out.add(t.id);
  const chapters = [...f.chapters, ...(tests.find((t) => t.id === f.test)?.chapters ?? [])];
  for (const n of chapters) for (const t of chapterTopics[String(n)] ?? []) out.add(t);
  return out;
}
