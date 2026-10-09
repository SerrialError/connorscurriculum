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
  image?: { src: string; width: number; height: number; alt: string };
  explanationHtml: string;
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
  mode: Mode;
  n: number;
}

export const DEFAULT_COUNT = 10;

export function emptyFilters(): Filters {
  return { chapters: [], test: null, units: [], topics: [], difficulty: [], type: null, mode: 'all', n: DEFAULT_COUNT };
}

// ---------------------------------------------------------------------------
// URL encoding: ?chapter=14,15&test=ch14-test&unit=5&topic=5.1,5.2&difficulty=1,2&type=mcq&mode=random&n=10
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
  f.mode = mode === 'random' || mode === 'weak' ? mode : 'all';
  const n = Number(p.get('n'));
  f.n = Number.isInteger(n) && n > 0 ? Math.min(n, 200) : DEFAULT_COUNT;
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
  if (f.mode !== 'all') p.set('mode', f.mode);
  if (f.mode !== 'all' && f.n !== DEFAULT_COUNT) p.set('n', String(f.n));
  const s = p.toString().replaceAll('%2C', ',');
  return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * Filters combine with AND across kinds and OR within a kind. Units and topics are one
 * "CED" kind: a question matches if it is in any selected unit or has any selected topic.
 */
export function filterQuestions(questions: PracticeQuestion[], f: Filters, tests: PracticeTest[]): PracticeQuestion[] {
  const test = f.test ? tests.find((t) => t.id === f.test) : undefined;
  return questions.filter((q) => {
    if (f.chapters.length && !f.chapters.includes(q.chapter)) return false;
    if (f.test) {
      if (!test || !test.chapters.includes(q.chapter)) return false;
      if (test.sections.length && !q.sections.some((s) => test.sections.includes(s))) return false;
    }
    if (f.units.length || f.topics.length) {
      const inUnit = q.units.some((u) => f.units.includes(u));
      const hasTopic = q.cedTopics.some((t) => f.topics.includes(t));
      if (!inUnit && !hasTopic) return false;
    }
    if (f.difficulty.length && !f.difficulty.includes(q.difficulty)) return false;
    if (f.type && q.type !== f.type) return false;
    return true;
  });
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
  if (f.mode === 'all') return matching;
  if (f.mode === 'random') return shuffle(matching, rng).slice(0, f.n);

  const accuracy = topicAccuracy(matching, history);
  const weakness = (q: PracticeQuestion) => Math.min(...topicKeys(q).map((k) => accuracy.get(k) ?? UNSEEN_ACCURACY));
  // Shuffle first so ties are broken randomly; sort is stable.
  return shuffle(matching, rng)
    .map((q) => ({ q, w: weakness(q) }))
    .sort((a, b) => a.w - b.w)
    .slice(0, f.n)
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
