// Words shown on the practice screens: filter names, a set's one-line name, and button labels.
import { CLASS_ONLY_UNIT } from './filters';
import type { ScoreStatus } from './score';
import type { Filters, Mode, PracticeTest, QuestionType } from './types';
import { chapterRange } from '../text';

export const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
export const MODE_LABELS: Record<Mode, string> = { all: 'In order', random: 'Shuffled', weak: 'Weakest first' };
export const TYPE_LABELS: Record<QuestionType, string> = { mcq: 'Multiple choice', frq: 'Free response' };

export const STATUS_TEXT: Record<ScoreStatus, string> = { todo: 'not answered', right: 'correct', wrong: 'incorrect', partial: 'partial credit' };
/** Shown with the colour, so right and wrong don't depend on telling red from green. */
export const STATUS_MARK: Record<ScoreStatus, string> = { todo: '', right: '✓', wrong: '✗', partial: '½' };

const unitLabel = (u: string): string => (u === CLASS_ONLY_UNIT ? 'Not on the AP exam' : `Unit ${u}`);

/** A topic key from topicKeys: "5.4 Elementary Reactions", or the chapter for class-only questions. */
export const topicKeyLabel = (key: string, topicTitles: ReadonlyMap<string, string>): string =>
  key.startsWith('chapter-') ? `Ch. ${key.slice(8)} material not on the AP exam` : `${key} ${topicTitles.get(key) ?? ''}`.trim();

/** The name of the whole question pool, when no chapter is left out of it. */
export const ALL_QUESTIONS = 'All questions';

/** Shown with a "weakest first" set when none of its questions has been answered (weakHasNoHistory). */
export const WEAK_NO_HISTORY_NOTE = 'No practice history on these yet, so the order is random.';

/**
 * What the filters select, e.g. "Chapters 6–7 Test · Hard" or "All questions". `everything` names
 * the pool when no chapter or test is picked (e.g. "Ch. 6–7" when later chapters are left out).
 */
export function describeScope(f: Filters, tests: PracticeTest[], everything = ALL_QUESTIONS): string {
  const parts: string[] = [];
  // "Ch. 6–7 · Hard": name the default pool unless a chapter, test, unit, or topic already says where from.
  if (!f.test && !f.chapters.length && !f.units.length && !f.topics.length && everything !== ALL_QUESTIONS) parts.push(everything);
  if (f.test) parts.push(tests.find((t) => t.id === f.test)?.title ?? f.test);
  if (f.chapters.length) parts.push(chapterRange(f.chapters));
  const units = f.units.map(unitLabel);
  if (units.length) parts.push(units.join(', '));
  if (f.topics.length) parts.push(`${f.topics.length === 1 ? 'Topic' : 'Topics'} ${f.topics.join(', ')}`);
  if (f.difficulty.length) parts.push([...f.difficulty].sort((a, b) => a - b).map((d) => DIFFICULTY_LABELS[d]).join(', '));
  if (f.type) parts.push(TYPE_LABELS[f.type]);
  return parts.length ? parts.join(' · ') : everything;
}

/**
 * A one-line name for a set, shown above its questions and results:
 * "Chapters 6–7 Test · 10 random", "Ch. 7 · Hard · 10 on your weakest topics".
 */
export function describeSet(f: Filters, tests: PracticeTest[], size: number, matching: number, everything?: string): string {
  const all = size >= matching;
  const how =
    f.mode === 'random'
      ? all
        ? `all ${size}, shuffled`
        : `${size} random`
      : f.mode === 'weak'
        ? all
          ? `all ${size}, weakest topics first`
          : `${size} on your weakest topics`
        : all
          ? `all ${size} in order`
          : `first ${size} in order`;
  return `${describeScope(f, tests, everything)} · ${how}`;
}

/**
 * Words for the questions to retry after a set (score below 1). With partial credit on any of
 * them (FRQs), "missed" would be wrong, so they are "without full marks".
 */
export function retryWords(scores: number[]): { button: string; set: string } {
  const which = `the ${scores.length} ${scores.some((s) => s > 0) ? 'without full marks' : 'missed'}`;
  return { button: `Retry ${which}`, set: `retrying ${which}` };
}

/**
 * The results screen's "same filters again" button. In order, the same filters pick the same
 * questions, so it starts the set over rather than promising a new one.
 */
export const againLabel = (f: Pick<Filters, 'mode'>): string => (f.mode === 'all' ? 'Start this set again' : 'New set, same filters');

export interface FilterChip {
  label: string;
  /** The control is under "More options" (its summary names these chips while it's closed). */
  more: boolean;
  /** The filters with this one removed. */
  without: Filters;
}

/**
 * The narrowing filters as removable chips, in the order the controls appear. `laterChapters`
 * are the chapters listed under More options.
 */
export function filterChips(f: Filters, tests: PracticeTest[], laterChapters: number[]): FilterChip[] {
  const out: FilterChip[] = [];
  const add = (label: string, more: boolean, patch: Partial<Filters>) => out.push({ label, more, without: { ...f, ...patch } });
  for (const n of f.chapters) add(`Ch. ${n}`, laterChapters.includes(n), { chapters: f.chapters.filter((x) => x !== n) });
  if (f.test) add(tests.find((t) => t.id === f.test)?.title ?? f.test, true, { test: null });
  for (const u of f.units) add(unitLabel(u), true, { units: f.units.filter((x) => x !== u) });
  for (const t of f.topics) add(`Topic ${t}`, true, { topics: f.topics.filter((x) => x !== t) });
  for (const d of f.difficulty) add(DIFFICULTY_LABELS[d]!, false, { difficulty: f.difficulty.filter((x) => x !== d) });
  if (f.type) add(TYPE_LABELS[f.type], true, { type: null });
  return out;
}
