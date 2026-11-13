// Filtering, selection, grading, and history for the practice island.
// Plain TypeScript with no DOM or Astro imports so it can be unit tested.

export interface PracticeChoice {
  id: string;
  html: string;
}

export interface PracticePart {
  label: string;
  promptHtml: string;
  points: number;
  scoringHtml: string[];
}

interface PracticeQuestionBase {
  id: string;
  chapter: number;
  sections: string[];
  /** Topic ids like "5.4" (subject prefix removed). */
  cedTopics: string[];
  /** Unit ids derived from cedTopics. */
  units: string[];
  difficulty: number;
  promptHtml: string;
  /** The prompt as one line of plain text (math written out), for the results list. */
  promptText: string;
  image?: { src: string; width: number; height: number; alt: string };
  explanationHtml: string;
  /**
   * Not class material yet: a sample question, or one from a chapter the class hasn't reached.
   * Left out of practice unless its chapter is picked (see filterQuestions).
   */
  extra?: boolean;
}

export interface McqQuestion extends PracticeQuestionBase {
  type: 'mcq';
  choices: PracticeChoice[];
  answer: string;
}

export interface FrqQuestion extends PracticeQuestionBase {
  type: 'frq';
  parts: PracticePart[];
}

export type PracticeQuestion = McqQuestion | FrqQuestion;

export interface PracticeTest {
  id: string;
  title: string;
  chapters: number[];
  sections: string[];
}

export type Mode = 'all' | 'random' | 'weak';
export type QuestionType = 'mcq' | 'frq';

export interface Filters {
  chapters: number[];
  test: string | null;
  units: string[];
  topics: string[];
  difficulty: number[];
  type: QuestionType | null;
  /** Question order: as listed (chapter order), shuffled, or weakest topics first. */
  mode: Mode;
  /** How many questions to practice; null means every matching question. */
  n: number | null;
}

export const DEFAULT_COUNT = 10;

/** The "How many" choices; "All" and "Other" (a number box) come with them. */
export const COUNT_CHOICES: readonly number[] = [5, 10, 20];

export const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
export const MODE_LABELS: Record<Mode, string> = { all: 'In order', random: 'Shuffled', weak: 'Weakest first' };
export const TYPE_LABELS: Record<QuestionType, string> = { mcq: 'Multiple choice', frq: 'Free response' };

/**
 * Pseudo unit for questions with no CED topic (class-test material that is not on the AP exam),
 * so the unit filter can select them and the unit counts add up to the total. URL: ?unit=class.
 */
export const CLASS_ONLY_UNIT = 'class';

export const unitLabel = (u: string): string => (u === CLASS_ONLY_UNIT ? 'Not on the AP exam' : `Unit ${u}`);

/** `?start=1` on a practice link starts the set right away instead of showing the setup screen. */
export function wantsStart(search: string): boolean {
  const v = new URLSearchParams(search).get('start');
  return v !== null && v !== '0' && v !== 'false';
}
export const MAX_COUNT = 200;

/**
 * Every control starts at its default: 10 questions, shuffled. Order and count are independent
 * (neither changes the other), so "How many: All" with "Order: Shuffled" is every question shuffled.
 */
export const DEFAULT_MODE: Mode = 'random';

export function emptyFilters(): Filters {
  return { chapters: [], test: null, units: [], topics: [], difficulty: [], type: null, mode: DEFAULT_MODE, n: DEFAULT_COUNT };
}

/** Number of filters that narrow the question pool (order and count are not filters). */
export function activeFilterCount(f: Filters): number {
  return f.chapters.length + (f.test ? 1 : 0) + f.units.length + f.topics.length + f.difficulty.length + (f.type ? 1 : 0);
}

// ---------------------------------------------------------------------------
// URL encoding: ?chapter=14,15&test=ch14-test&unit=5&topic=5.1,5.2&difficulty=1,2&type=mcq&mode=all&n=5
// `mode` and `n` are written only when they differ from the defaults (shuffled, 10 questions);
// `n=all` means every matching question.
// ---------------------------------------------------------------------------

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

export function parseFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  const f = emptyFilters();
  f.chapters = list(p.get('chapter')).map(Number).filter((n) => Number.isInteger(n));
  f.test = p.get('test') || null;
  f.units = list(p.get('unit'));
  f.topics = list(p.get('topic'));
  f.difficulty = list(p.get('difficulty')).map(Number).filter((d) => d >= 1 && d <= 3);
  const type = p.get('type');
  f.type = type === 'mcq' || type === 'frq' ? type : null;
  const mode = p.get('mode');
  f.mode = mode === 'all' || mode === 'random' || mode === 'weak' ? mode : DEFAULT_MODE;
  const rawN = p.get('n');
  const n = Number(rawN);
  if (rawN === 'all') f.n = null;
  else if (rawN && Number.isInteger(n) && n > 0) f.n = Math.min(n, MAX_COUNT);
  else f.n = DEFAULT_COUNT;
  return f;
}

export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.chapters.length) p.set('chapter', f.chapters.join(','));
  if (f.test) p.set('test', f.test);
  if (f.units.length) p.set('unit', f.units.join(','));
  if (f.topics.length) p.set('topic', f.topics.join(','));
  if (f.difficulty.length) p.set('difficulty', f.difficulty.join(','));
  if (f.type) p.set('type', f.type);
  if (f.mode !== DEFAULT_MODE) p.set('mode', f.mode);
  if (f.n !== DEFAULT_COUNT) p.set('n', f.n === null ? 'all' : String(f.n));
  return toSearch(p);
}

const toSearch = (p: URLSearchParams) => {
  const s = p.toString().replaceAll('%2C', ',');
  return s ? `?${s}` : '';
};

/** Every control at its default (nothing for "Reset all" to reset). */
export const isDefaultFilters = (f: Filters): boolean =>
  activeFilterCount(f) === 0 && f.mode === DEFAULT_MODE && f.n === DEFAULT_COUNT;

// ---------------------------------------------------------------------------
// A set in the URL. While a set is on screen the address names it, so reloading, bookmarking, or
// sharing the link reopens the same set:
//   ?chapter=7&difficulty=3&start=1&seed=k3x9a0          the filters that made it, plus a seed
//   ?chapter=7&start=1&seed=k3x9a0&ids=q1,q7,q9          exact questions (retrying the missed ones)
// The seed fixes the shuffle, so the same link gives the same questions (except "weakest first",
// which depends on the student's own answers). It also names this attempt, so a reload finds the
// answers saved for it. The setup screen's address is the same minus start/seed/ids: the filters
// that produced the set, which is where "← Filters" returns.
// ---------------------------------------------------------------------------

export interface SetSpec {
  filters: Filters;
  /** Null for a link that asks to start a set (?start=1) but has no seed yet. */
  seed: string | null;
  /** The exact questions, in order, or null to pick them from the filters with the seed. */
  ids: string[] | null;
}

/** The set a URL names, or null for the setup screen. */
export function parseSet(search: string): SetSpec | null {
  if (!wantsStart(search)) return null;
  const p = new URLSearchParams(search);
  const ids = list(p.get('ids'));
  const seed = p.get('seed');
  return {
    filters: parseFilters(search),
    seed: seed && /^[a-z0-9]{1,16}$/i.test(seed) ? seed : null,
    ids: ids.length ? ids : null,
  };
}

export function setToQuery(spec: SetSpec): string {
  const p = new URLSearchParams(filtersToQuery(spec.filters));
  p.set('start', '1');
  if (spec.seed) p.set('seed', spec.seed);
  if (spec.ids) p.set('ids', spec.ids.join(','));
  return toSearch(p);
}

/** The setup screen's address for any practice URL: its filters alone. */
export const setupQuery = (search: string): string => filtersToQuery(parseFilters(search));

export function newSeed(rng: Rng = Math.random): string {
  return Math.floor(rng() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
}

/** A PRNG from a seed string (FNV-1a hash into seededRng). */
export function rngFromSeed(seed: string): Rng {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return seededRng(h >>> 0);
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
  return selectQuestions(filterQuestions(all, spec.filters, tests), spec.filters, history, rngFromSeed(spec.seed));
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

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

/** Number of questions a session with these settings will have. */
export function sessionSize(matching: number, f: Pick<Filters, 'n'>): number {
  return f.n === null ? matching : Math.min(f.n, matching);
}

// ---------------------------------------------------------------------------
// History (localStorage) and selection
// ---------------------------------------------------------------------------

/** Per question: recent scores (0–1), newest last. */
export type History = Record<string, number[]>;

export const HISTORY_LIMIT = 10;

export function recordResult(history: History, questionId: string, score: number): History {
  const prev = history[questionId] ?? [];
  return { ...history, [questionId]: [...prev, Math.max(0, Math.min(1, score))].slice(-HISTORY_LIMIT) };
}

/** Replace the most recent score for a question (a corrected self-mark), or record it if there is none. */
export function amendLastResult(history: History, questionId: string, score: number): History {
  const prev = history[questionId] ?? [];
  if (prev.length === 0) return recordResult(history, questionId, score);
  return { ...history, [questionId]: [...prev.slice(0, -1), Math.max(0, Math.min(1, score))] };
}

/** Keys used for "weak topics": CED topics, or the chapter for class-only questions. */
export function topicKeys(q: PracticeQuestion): string[] {
  return q.cedTopics.length ? q.cedTopics : [`chapter-${q.chapter}`];
}

/** Mean recent score per topic key, across all questions with history. */
export function topicAccuracy(questions: PracticeQuestion[], history: History): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const q of questions) {
    const scores = history[q.id];
    if (!scores?.length) continue;
    for (const key of topicKeys(q)) {
      const s = sums.get(key) ?? { total: 0, count: 0 };
      for (const score of scores) {
        s.total += score;
        s.count += 1;
      }
      sums.set(key, s);
    }
  }
  return new Map([...sums].map(([k, s]) => [k, s.total / s.count]));
}

/** Topics never attempted rank between weak (<0.5) and strong topics. */
export const UNSEEN_ACCURACY = 0.5;

export type Rng = () => number;

/** Deterministic PRNG for tests; production uses Math.random. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  rng: Rng = Math.random,
): PracticeQuestion[] {
  const n = f.n ?? matching.length;
  if (f.mode === 'all') return matching.slice(0, n);
  if (f.mode === 'random') return shuffle(matching, rng).slice(0, n);

  const accuracy = topicAccuracy(matching, history);
  const weakness = (q: PracticeQuestion) => Math.min(...topicKeys(q).map((k) => accuracy.get(k) ?? UNSEEN_ACCURACY));
  // Shuffle first so ties are broken randomly; sort is stable.
  return shuffle(matching, rng)
    .map((q) => ({ q, w: weakness(q) }))
    .sort((a, b) => a.w - b.w)
    .slice(0, n)
    .map(({ q }) => q);
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export function isCorrect(q: McqQuestion, choiceId: string): boolean {
  return q.answer === choiceId;
}

export function frqTotal(q: FrqQuestion): number {
  return q.parts.reduce((sum, p) => sum + p.points, 0);
}

/** `earned[partIndex][statementIndex]` is true when the student gave themselves that point. */
export function frqEarned(q: FrqQuestion, earned: boolean[][]): number {
  return q.parts.reduce(
    (sum, part, i) => sum + part.scoringHtml.filter((_, j) => earned[i]?.[j] === true).length,
    0,
  );
}

export interface Summary {
  mcqCorrect: number;
  mcqAnswered: number;
  frqEarned: number;
  frqPossible: number;
  frqDone: number;
}

export type QuestionResult = { type: 'mcq'; correct: boolean } | { type: 'frq'; earned: number; possible: number };

export function summarize(results: QuestionResult[]): Summary {
  const s: Summary = { mcqCorrect: 0, mcqAnswered: 0, frqEarned: 0, frqPossible: 0, frqDone: 0 };
  for (const r of results) {
    if (r.type === 'mcq') {
      s.mcqAnswered += 1;
      if (r.correct) s.mcqCorrect += 1;
    } else {
      s.frqDone += 1;
      s.frqEarned += r.earned;
      s.frqPossible += r.possible;
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Past AP FRQs for the current filters
// ---------------------------------------------------------------------------

/**
 * CED topics covered by the current filters: selected topics, every topic in selected units,
 * and the topics taught by selected chapters or by the selected test's chapters.
 * Empty when no topic-related filter is set.
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

// ---------------------------------------------------------------------------
// Results screen
// ---------------------------------------------------------------------------

export interface TopicScore {
  /** CED topic id, or "chapter-N" for class-only questions (see topicKeys). */
  key: string;
  /** Sum of question scores (0–1 each). */
  score: number;
  count: number;
}

/**
 * Per-topic scores for one session, weakest first (ties by key in CED order).
 * `scores` maps question id to its 0–1 score; unanswered questions are left out.
 */
export function topicBreakdown(questions: PracticeQuestion[], scores: Record<string, number>): TopicScore[] {
  const map = new Map<string, TopicScore>();
  for (const q of questions) {
    const s = scores[q.id];
    if (s === undefined) continue;
    for (const key of topicKeys(q)) {
      const t = map.get(key) ?? { key, score: 0, count: 0 };
      t.score += s;
      t.count += 1;
      map.set(key, t);
    }
  }
  return [...map.values()].sort(
    (a, b) => a.score / a.count - b.score / b.count || a.key.localeCompare(b.key, undefined, { numeric: true }),
  );
}

// ---------------------------------------------------------------------------
// Naming a set
// ---------------------------------------------------------------------------

/** "Ch. 8–9", "Ch. 6, 8", "Ch. 7" */
export function chapterRange(ns: number[]): string {
  const sorted = [...ns].sort((a, b) => a - b);
  const consecutive = sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1);
  if (sorted.length > 1 && consecutive) return `Ch. ${sorted[0]}–${sorted.at(-1)}`;
  return `Ch. ${sorted.join(', ')}`;
}


/**
 * What the filters select, e.g. "Chapters 6–7 Test · Hard" or "All questions". `everything` names
 * the pool when no chapter or test is picked (e.g. "Ch. 6–7" when later chapters are left out).
 */
export function describeScope(f: Filters, tests: PracticeTest[], everything = 'All questions'): string {
  const parts: string[] = [];
  // "Ch. 6–7 · Hard": name the default pool unless a chapter, test, unit, or topic already says where from.
  if (!f.test && !f.chapters.length && !f.units.length && !f.topics.length && everything !== 'All questions') parts.push(everything);
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
 * True when "weakest topics" has nothing to go on: none of the matching questions has been
 * answered on this device, so the order is effectively random.
 */
/** Shown with a "weakest first" set when weakHasNoHistory. */
export const WEAK_NO_HISTORY_NOTE = 'No practice history on these yet, so the order is random.';

export function weakHasNoHistory(matching: PracticeQuestion[], history: History): boolean {
  return topicAccuracy(matching, history).size === 0;
}

// ---------------------------------------------------------------------------
// Quick start and links back to lessons
// ---------------------------------------------------------------------------

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
  const query = chapters.length === withQuestions.length ? '' : `?chapter=${chapters.join(',')}`;
  return { query, chapters, count };
}

/** A lesson the practice screens can point to (lessons only, not notes or review sheets). */
export interface PracticeLesson {
  title: string;
  href: string;
  chapter: number;
  sections: string[];
  /** CED topic ids. */
  topics: string[];
}

/**
 * The lessons that teach a question: lessons from its chapter sharing a textbook section (most
 * shared sections first), else lessons from its chapter sharing an AP topic. At most `max`.
 */
export function lessonsFor(
  q: Pick<PracticeQuestion, 'chapter' | 'sections' | 'cedTopics'>,
  lessons: PracticeLesson[],
  max = 2,
): PracticeLesson[] {
  const same = lessons.filter((l) => l.chapter === q.chapter);
  const bySection = same
    .map((l, i) => ({ l, i, n: l.sections.filter((s) => q.sections.includes(s)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.l);
  const found = bySection.length ? bySection : same.filter((l) => l.topics.some((t) => q.cedTopics.includes(t)));
  return found.slice(0, max);
}

/**
 * What to read after a set: the lessons for the questions missed, most missed first, and the
 * chapters of missed questions that no lesson matched (to link their lesson lists instead).
 */
export function lessonsForMissed(
  missed: Pick<PracticeQuestion, 'chapter' | 'sections' | 'cedTopics'>[],
  lessons: PracticeLesson[],
): { lessons: { lesson: PracticeLesson; missed: number }[]; chapters: number[] } {
  const counts = new Map<PracticeLesson, number>();
  const chapters = new Set<number>();
  for (const q of missed) {
    const found = lessonsFor(q, lessons);
    if (found.length === 0) chapters.add(q.chapter);
    for (const l of found) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  const order = (l: PracticeLesson) => lessons.indexOf(l);
  return {
    lessons: [...counts]
      .map(([lesson, n]) => ({ lesson, missed: n }))
      .sort((a, b) => b.missed - a.missed || order(a.lesson) - order(b.lesson)),
    chapters: [...chapters].sort((a, b) => a - b),
  };
}

/**
 * Words for the questions to retry after a set (score below 1). With partial credit on any of
 * them (FRQs), "missed" would be wrong, so they are "without full marks".
 */
export function retryWords(scores: number[]): { button: string; set: string } {
  const n = scores.length;
  if (scores.some((s) => s > 0)) {
    return { button: `Retry the ${n} without full marks`, set: `retrying the ${n} without full marks` };
  }
  return { button: `Retry the ${n} I missed`, set: `retrying the ${n} you missed` };
}

// ---------------------------------------------------------------------------
// Setup screen helpers
// ---------------------------------------------------------------------------

/** "Other" in How many: a count that isn't one of the COUNT_CHOICES chips. */
export const isCustomCount = (n: number | null): boolean => n !== null && !COUNT_CHOICES.includes(n);

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

/** Below this recent accuracy a topic is listed under "Topics to work on". */
export const WEAK_THRESHOLD = 0.75;

/**
 * Topics with history that are below WEAK_THRESHOLD, weakest first (CED topics only: class-only
 * chapter keys have no topic page or practice link of their own).
 */
export function weakTopics(questions: PracticeQuestion[], history: History, max = 4): [string, number][] {
  return [...topicAccuracy(questions, history)]
    .filter(([k, acc]) => !k.startsWith('chapter-') && acc < WEAK_THRESHOLD)
    .sort((a, b) => a[1] - b[1])
    .slice(0, max);
}

/** Practice filters for one AP topic. */
export const topicQuery = (topic: string): string => filtersToQuery({ ...emptyFilters(), topics: [topic] });

// ---------------------------------------------------------------------------
// Answer status
// ---------------------------------------------------------------------------

export type ScoreStatus = 'todo' | 'right' | 'wrong' | 'partial';

/** A question's status from its 0–1 score (undefined: not answered). */
export const scoreStatus = (score: number | undefined): ScoreStatus =>
  score === undefined ? 'todo' : score === 1 ? 'right' : score === 0 ? 'wrong' : 'partial';

export const STATUS_TEXT: Record<ScoreStatus, string> = { todo: 'not answered', right: 'correct', wrong: 'incorrect', partial: 'partial credit' };
/** Shown with the colour, so right and wrong don't depend on telling red from green. */
export const STATUS_MARK: Record<ScoreStatus, string> = { todo: '', right: '✓', wrong: '✗', partial: '½' };

/** The 0–1 score of an answered question: right/wrong for MCQ, points earned for FRQ. */
export function questionScore(
  q: PracticeQuestion,
  a: { picks: Record<string, string>; checked: Record<string, boolean>; marks: Record<string, boolean[][]>; finished: Record<string, boolean> },
): number | undefined {
  if (q.type === 'mcq') return a.checked[q.id] ? (isCorrect(q, a.picks[q.id] ?? '') ? 1 : 0) : undefined;
  return a.finished[q.id] ? frqEarned(q, a.marks[q.id] ?? []) / frqTotal(q) : undefined;
}
