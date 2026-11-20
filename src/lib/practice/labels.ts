// Words shown on the practice screens: filter names, a set's one-line name, and button labels.
import { CLASS_ONLY_UNIT } from './filters';
import type { DotStatus, ScoreArea } from './score';
import type { Filters, Mode, PracticeTest, QuestionType } from './types';
import { byId, chapterRange } from '../text';

export const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
export const MODE_LABELS: Record<Mode, string> = { all: 'In order', random: 'Shuffled', weak: 'Weakest first' };
export const TYPE_LABELS: Record<QuestionType, string> = { mcq: 'Multiple choice', frq: 'Free response' };

export const STATUS_TEXT: Record<DotStatus, string> = { todo: 'not answered', picked: 'answered', right: 'correct', wrong: 'incorrect', partial: 'partial credit' };
/** Shown with the colour, so right and wrong don't depend on telling red from green. */
export const STATUS_MARK: Record<DotStatus, string> = { todo: '', picked: '', right: '✓', wrong: '✗', partial: '½' };

/** "§7.2", "§7.3, §7.4" */
const sectionLabel = (sections: string[]): string => [...sections].sort(byId).map((s) => `§${s}`).join(', ');

/** A class test's name, or plain words for one the class doesn't have (never its id). */
const testLabel = (id: string, tests: PracticeTest[]): string => tests.find((t) => t.id === id)?.title ?? 'Class test';

const unitLabel = (u: string): string => (u === CLASS_ONLY_UNIT ? 'Not on the AP exam' : `Unit ${u}`);

/**
 * What a score counts towards: "5.4 Elementary Reactions", or the chapter for class-only questions
 * ("Ch. 7 material not on the AP exam", or just "Ch. 7" in a class with no AP topics).
 */
export function areaLabel(area: ScoreArea, topicTitles: ReadonlyMap<string, string>): string {
  if (area.kind === 'topic') return `${area.topic} ${topicTitles.get(area.topic) ?? ''}`.trim();
  const chapter = `Ch. ${area.chapter}`;
  return topicTitles.size ? `${chapter} material not on the AP exam` : chapter;
}

/** The name of the whole question pool, when no chapter is left out of it. */
export const ALL_QUESTIONS = 'All questions';

/** "4", "4 and 17", "4, 17, and 30" */
export function listNumbers(ns: number[]): string {
  if (ns.length <= 2) return ns.join(' and ');
  return `${ns.slice(0, -1).join(', ')}, and ${ns.at(-1)}`;
}

/** A practice exam's name: "Chapters 6–7 Test · Practice exam". */
export const examLabel = (testId: string, tests: PracticeTest[]): string =>
  tests.find((t) => t.id === testId)?.kind === 'quiz' ? testLabel(testId, tests) : `${testLabel(testId, tests)} · Practice exam`;

/** Shown with a practice exam while it's being taken. */
export const EXAM_NOTE = 'No answers are shown until you submit.';

/** Shown with a "weakest first" set when none of its questions has been answered (weakHasNoHistory). */
export const WEAK_NO_HISTORY_NOTE = 'No practice history on these yet, so the order is random.';

/**
 * What the filters select, e.g. "Chapters 6–7 Test · Hard" or "All questions". `everything` names
 * the pool when no chapter or test is picked (e.g. "Ch. 6–7" when later chapters are left out).
 */
export function describeScope(f: Filters, tests: PracticeTest[], everything = ALL_QUESTIONS): string {
  const parts: string[] = [];
  // "Ch. 6–7 · Hard": name the default pool unless a chapter, section, test, unit, or topic already says where from.
  if (!f.test && !f.chapters.length && !f.sections.length && !f.units.length && !f.topics.length && everything !== ALL_QUESTIONS) parts.push(everything);
  if (f.test) parts.push(testLabel(f.test, tests));
  if (f.chapters.length) parts.push(chapterRange(f.chapters));
  if (f.sections.length) parts.push(sectionLabel(f.sections));
  const units = f.units.map(unitLabel);
  if (units.length) parts.push(units.join(', '));
  if (f.topics.length) parts.push(`${f.topics.length === 1 ? 'Topic' : 'Topics'} ${f.topics.join(', ')}`);
  if (f.difficulty.length) parts.push([...f.difficulty].sort((a, b) => a - b).map((d) => DIFFICULTY_LABELS[d]).join(', '));
  if (f.type) parts.push(TYPE_LABELS[f.type]);
  return parts.length ? parts.join(' · ') : everything;
}

/**
 * How a set picks `size` of its `matching` questions: "10 random", "all 8 in order",
 * "10 on your weakest topics". The end of describeSet, and how practice links say it (links.ts).
 */
export function describeHow(f: Pick<Filters, 'mode'>, size: number, matching: number): string {
  const all = size >= matching;
  if (f.mode === 'random') return all ? `all ${size}, shuffled` : `${size} random`;
  if (f.mode === 'weak') return all ? `all ${size}, weakest topics first` : `${size} on your weakest topics`;
  return all ? `all ${size} in order` : `first ${size} in order`;
}

/**
 * A one-line name for a set, shown above its questions and results:
 * "Chapters 6–7 Test · 10 random", "Ch. 7 · Hard · 10 on your weakest topics".
 */
export function describeSet(f: Filters, tests: PracticeTest[], size: number, matching: number, everything?: string): string {
  return `${describeScope(f, tests, everything)} · ${describeHow(f, size, matching)}`;
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

/**
 * The results screen's button back to the questions not answered yet. With none answered (the set
 * was ended straight away) nothing was skipped: it goes back to the start.
 */
export const answerRestLabel = (unanswered: number, answered: number): string =>
  answered === 0 ? 'Back to question 1' : `Answer the remaining ${unanswered}`;

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
  for (const s of f.sections) add(sectionLabel([s]), false, { sections: f.sections.filter((x) => x !== s) });
  if (f.test) add(testLabel(f.test, tests), true, { test: null });
  for (const u of f.units) add(unitLabel(u), true, { units: f.units.filter((x) => x !== u) });
  for (const t of f.topics) add(`Topic ${t}`, true, { topics: f.topics.filter((x) => x !== t) });
  for (const d of f.difficulty) add(DIFFICULTY_LABELS[d]!, false, { difficulty: f.difficulty.filter((x) => x !== d) });
  if (f.type) add(TYPE_LABELS[f.type], true, { type: null });
  return out;
}
