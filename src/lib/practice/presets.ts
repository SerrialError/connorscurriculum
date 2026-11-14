// "Quick start" on the practice setup screen: ready-made sets, one tap each.
import { DEFAULT_COUNT, emptyFilters } from './filters';
import { filtersToQuery } from './url';
import { chapterRange, plural } from '../text';

export interface Preset {
  label: string;
  /** Filters as a practice query string, e.g. "?test=ch6-7-test". */
  query: string;
  note?: string;
  /** A second, smaller way to start it, e.g. "All 116 in order". */
  alt?: { label: string; query: string };
}

/**
 * "Mixed review": random questions from the chapters the class has reached. Returns the practice
 * query, the chapters it draws from, and how many questions it has, or null if none are taught.
 * When every chapter with questions is taught, the query has no chapter filter.
 */
export function mixedReview(
  questions: { chapter: number }[],
  taught: ReadonlySet<number>,
): { query: string; chapters: number[]; count: number } | null {
  const withQuestions = [...new Set(questions.map((q) => q.chapter))].sort((a, b) => a - b);
  const chapters = withQuestions.filter((n) => taught.has(n));
  if (chapters.length === 0) return null;
  const count = questions.filter((q) => taught.has(q.chapter)).length;
  const query = chapters.length === withQuestions.length ? '' : filtersToQuery({ ...emptyFilters(), chapters });
  return { query, chapters, count };
}

/**
 * The quick starts: the latest class test with questions (DEFAULT_COUNT random, or all in order),
 * and a mixed review of the chapters the class has reached when that isn't the same pool.
 * `tests` are latest first, each with how many questions it has.
 */
export function quickStarts(
  tests: { id: string; title: string; count: number }[],
  questions: { chapter: number }[],
  taught: ReadonlySet<number>,
): Preset[] {
  const presets: Preset[] = [];
  const latest = tests.find((t) => t.count > 0);
  if (latest) {
    const { id, title, count } = latest;
    const random = filtersToQuery({ ...emptyFilters(), test: id });
    const inOrder = filtersToQuery({ ...emptyFilters(), test: id, mode: 'all', n: null });
    presets.push(
      count > DEFAULT_COUNT
        ? { label: title, query: random, note: `${DEFAULT_COUNT} random from its ${count} questions`, alt: { label: `All ${count} in order`, query: inOrder } }
        : { label: title, query: inOrder, note: `All ${plural(count, 'question')}, in order` },
    );
  }
  const mixed = mixedReview(questions, taught);
  if (mixed && mixed.count !== latest?.count) {
    const where = chapterRange(mixed.chapters, { nbsp: true });
    presets.push({ label: 'Mixed review', query: mixed.query, note: `${DEFAULT_COUNT} random from the ${mixed.count} questions in ${where}` });
  }
  return presets;
}
