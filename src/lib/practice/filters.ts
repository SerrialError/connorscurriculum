// The practice filters: their defaults, and which questions they match.
import type { Filters, Mode, PracticeQuestion, PracticeTest } from './types';

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

/**
 * Pseudo unit for questions with no CED topic (class-test material that is not on the AP exam),
 * so the unit filter can select them and the unit counts add up to the total. URL: ?unit=class.
 */
export const CLASS_ONLY_UNIT = 'class';

export function emptyFilters(): Filters {
  return { chapters: [], test: null, units: [], topics: [], difficulty: [], type: null, mode: DEFAULT_MODE, n: DEFAULT_COUNT };
}

/** Number of filters that narrow the question pool (order and count are not filters). */
export function activeFilterCount(f: Filters): number {
  return f.chapters.length + (f.test ? 1 : 0) + f.units.length + f.topics.length + f.difficulty.length + (f.type ? 1 : 0);
}

/** Every control at its default (nothing for "Reset all" to reset). */
export const isDefaultFilters = (f: Filters): boolean =>
  activeFilterCount(f) === 0 && f.mode === DEFAULT_MODE && f.n === DEFAULT_COUNT;

/** "Other" in How many: a count that isn't one of the COUNT_CHOICES chips. */
export const isCustomCount = (n: number | null): boolean => n !== null && !COUNT_CHOICES.includes(n);

/**
 * Filters combine with AND across kinds and OR within a kind. Units and topics are one
 * "CED" kind: a question matches if it is in any selected unit or has any selected topic.
 * The CLASS_ONLY_UNIT unit matches questions with no CED topic.
 * `extra` questions (samples, chapters not taught yet) only match when their chapter is picked,
 * by the chapter filter or by the class test's chapters: no chapter picked means the class's
 * chapters, not everything.
 */
export function filterQuestions(questions: PracticeQuestion[], f: Filters, tests: PracticeTest[]): PracticeQuestion[] {
  const test = f.test ? tests.find((t) => t.id === f.test) : undefined;
  return questions.filter((q) => {
    if (f.chapters.length && !f.chapters.includes(q.chapter)) return false;
    if (q.extra && !f.chapters.includes(q.chapter) && !test?.chapters.includes(q.chapter)) return false;
    if (f.test) {
      if (!test || !test.chapters.includes(q.chapter)) return false;
      if (test.sections.length && !q.sections.some((s) => test.sections.includes(s))) return false;
    }
    if (f.units.length || f.topics.length) {
      const inUnit =
        q.units.some((u) => f.units.includes(u)) || (q.cedTopics.length === 0 && f.units.includes(CLASS_ONLY_UNIT));
      const hasTopic = q.cedTopics.some((t) => f.topics.includes(t));
      if (!inUnit && !hasTopic) return false;
    }
    if (f.difficulty.length && !f.difficulty.includes(q.difficulty)) return false;
    if (f.type && q.type !== f.type) return false;
    return true;
  });
}

/**
 * How many questions would match if `patch` replaced part of the filters. Used to show a count
 * next to each filter option (e.g. "Ch. 7 · 64") given the other filters already chosen.
 */
export function countWith(
  questions: PracticeQuestion[],
  f: Filters,
  tests: PracticeTest[],
  patch: Partial<Filters>,
): number {
  return filterQuestions(questions, { ...f, ...patch }, tests).length;
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
