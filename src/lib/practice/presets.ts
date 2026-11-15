// "Quick start" on the practice setup screen: ready-made sets, one tap each.
import { examFormat } from './exam';
import { type Pool, examStart, practiceStarts } from './links';
import type { Filters, PracticeExam } from './types';
import { chapterRange, plural } from '../text';

export interface Preset {
  label: string;
  filters: Filters;
  /** A practice exam of the filters' class test. */
  exam?: boolean;
  note: string;
  /** A second, smaller way to start it, e.g. "All 116 in order". */
  alt?: { label: string; filters: Filters };
}

interface PresetQuestion {
  id: string;
  chapter: number;
}

/**
 * "Mixed review": random questions from the chapters the class has reached. Returns its pool, the
 * chapters it draws from, and the ids of its questions, or null if none are taught. When every
 * chapter with questions is taught, the pool has no chapter filter.
 */
export function mixedReview(
  questions: PresetQuestion[],
  taught: ReadonlySet<number>,
): { pool: Pool; chapters: number[]; ids: string[] } | null {
  const withQuestions = [...new Set(questions.map((q) => q.chapter))].sort((a, b) => a - b);
  const chapters = withQuestions.filter((n) => taught.has(n));
  if (chapters.length === 0) return null;
  const ids = questions.filter((q) => taught.has(q.chapter)).map((q) => q.id);
  return { pool: chapters.length === withQuestions.length ? {} : { chapters }, chapters, ids };
}

/** The same questions, in any order. */
function samePool(a: readonly string[], b: readonly string[]): boolean {
  const set = new Set(a);
  return set.size === new Set(b).size && b.every((id) => set.has(id));
}

/**
 * The quick starts: the latest class test with questions, its practice exam if it has one, and a
 * mixed review of the chapters the class has reached unless it has exactly the test's questions.
 * Each starts like a practice link elsewhere on the site (links.ts). `tests` are latest first,
 * each with the ids of its questions.
 */
export function quickStarts(
  tests: { id: string; title: string; questions: string[]; exam?: PracticeExam }[],
  questions: PresetQuestion[],
  taught: ReadonlySet<number>,
): Preset[] {
  const presets: Preset[] = [];
  const latest = tests.find((t) => t.questions.length > 0);
  if (latest) {
    const count = latest.questions.length;
    const { start, all } = practiceStarts({ test: latest.id }, count);
    presets.push({
      label: latest.title,
      filters: start.filters,
      note: all ? `${start.short} from its ${plural(count, 'question')}` : `All ${plural(count, 'question')}, in order`,
      ...(all && { alt: { label: all.label, filters: all.filters } }),
    });
    if (latest.exam) {
      presets.push({ label: `Practice exam: ${latest.title}`, filters: examStart(latest.id).filters, exam: true, note: examFormat(latest.exam) });
    }
  }
  const mixed = mixedReview(questions, taught);
  if (mixed && !(latest && samePool(mixed.ids, latest.questions))) {
    const count = mixed.ids.length;
    const where = chapterRange(mixed.chapters, { nbsp: true });
    const { start, all } = practiceStarts(mixed.pool, count);
    presets.push({
      label: 'Mixed review',
      filters: start.filters,
      note: all ? `${start.short} from the ${count} questions in ${where}` : `All ${plural(count, 'question')} in ${where}, in order`,
    });
  }
  return presets;
}
