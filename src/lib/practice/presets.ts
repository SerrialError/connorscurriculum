// "Quick start" on the practice setup screen: ready-made sets, one tap each.
import { type Pool, practiceStarts } from './links';
import type { Filters } from './types';
import { chapterRange, plural } from '../text';

export interface Preset {
  label: string;
  filters: Filters;
  note: string;
  /** A second, smaller way to start it, e.g. "All 116 in order". */
  alt?: { label: string; filters: Filters };
}

/**
 * "Mixed review": random questions from the chapters the class has reached. Returns its pool, the
 * chapters it draws from, and how many questions it has, or null if none are taught. When every
 * chapter with questions is taught, the pool has no chapter filter.
 */
export function mixedReview(
  questions: { chapter: number }[],
  taught: ReadonlySet<number>,
): { pool: Pool; chapters: number[]; count: number } | null {
  const withQuestions = [...new Set(questions.map((q) => q.chapter))].sort((a, b) => a - b);
  const chapters = withQuestions.filter((n) => taught.has(n));
  if (chapters.length === 0) return null;
  const count = questions.filter((q) => taught.has(q.chapter)).length;
  return { pool: chapters.length === withQuestions.length ? {} : { chapters }, chapters, count };
}

/**
 * The quick starts: the latest class test with questions, and a mixed review of the chapters the
 * class has reached when that isn't the same pool. Each starts like a practice link elsewhere on
 * the site (links.ts). `tests` are latest first, each with how many questions it has.
 */
export function quickStarts(
  tests: { id: string; title: string; count: number }[],
  questions: { chapter: number }[],
  taught: ReadonlySet<number>,
): Preset[] {
  const presets: Preset[] = [];
  const latest = tests.find((t) => t.count > 0);
  if (latest) {
    const { start, all } = practiceStarts({ test: latest.id }, latest.count);
    presets.push({
      label: latest.title,
      filters: start.filters,
      note: all ? `${start.short} from its ${plural(latest.count, 'question')}` : `All ${plural(latest.count, 'question')}, in order`,
      ...(all && { alt: { label: all.label, filters: all.filters } }),
    });
  }
  const mixed = mixedReview(questions, taught);
  if (mixed && mixed.count !== latest?.count) {
    const where = chapterRange(mixed.chapters, { nbsp: true });
    const { start, all } = practiceStarts(mixed.pool, mixed.count);
    presets.push({
      label: 'Mixed review',
      filters: start.filters,
      note: all ? `${start.short} from the ${mixed.count} questions in ${where}` : `All ${plural(mixed.count, 'question')} in ${where}, in order`,
    });
  }
  return presets;
}
