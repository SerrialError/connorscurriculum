// Scoring answers, and the practice history kept on this device (recent scores per question),
// with what it says about each topic.
import type { FrqQuestion, McqQuestion, PracticeQuestion, History } from './types';
import { byId } from '../text';

// ---------------------------------------------------------------------------
// One question
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

/** The 0–1 score of an answered question: right/wrong for MCQ, points earned for FRQ. */
export function questionScore(
  q: PracticeQuestion,
  a: { picks: Record<string, string>; checked: Record<string, boolean>; marks: Record<string, boolean[][]>; finished: Record<string, boolean> },
): number | undefined {
  if (q.type === 'mcq') return a.checked[q.id] ? (isCorrect(q, a.picks[q.id] ?? '') ? 1 : 0) : undefined;
  return a.finished[q.id] ? frqEarned(q, a.marks[q.id] ?? []) / frqTotal(q) : undefined;
}

export type ScoreStatus = 'todo' | 'right' | 'wrong' | 'partial';

/** A question's status from its 0–1 score (undefined: not answered). */
export const scoreStatus = (score: number | undefined): ScoreStatus =>
  score === undefined ? 'todo' : score === 1 ? 'right' : score === 0 ? 'wrong' : 'partial';

// ---------------------------------------------------------------------------
// One set
// ---------------------------------------------------------------------------

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

/** What a question's score counts towards: an AP topic, or (with no AP topic) its chapter. */
export type ScoreArea = { kind: 'topic'; topic: string } | { kind: 'chapter'; chapter: number };

/** The areas a question counts towards: its AP topics, or its chapter. */
export function scoreAreas(q: PracticeQuestion): ScoreArea[] {
  return q.cedTopics.length ? q.cedTopics.map((topic) => ({ kind: 'topic', topic })) : [{ kind: 'chapter', chapter: q.chapter }];
}

/** An area as a map key and sort key: the topic id ("5.4"), or "chapter-7". */
export const areaKey = (a: ScoreArea): string => (a.kind === 'topic' ? a.topic : `chapter-${a.chapter}`);

export interface TopicScore {
  area: ScoreArea;
  /** areaKey(area) */
  key: string;
  /** Sum of the scores (0–1 each). */
  score: number;
  count: number;
}

/** Every area the questions count towards, with the sum and number of their `scoresOf` scores. */
function scoresByArea(questions: PracticeQuestion[], scoresOf: (q: PracticeQuestion) => number[]): TopicScore[] {
  const map = new Map<string, TopicScore>();
  for (const q of questions) {
    const scores = scoresOf(q);
    if (scores.length === 0) continue;
    for (const area of scoreAreas(q)) {
      const key = areaKey(area);
      const t = map.get(key) ?? { area, key, score: 0, count: 0 };
      for (const s of scores) {
        t.score += s;
        t.count += 1;
      }
      map.set(key, t);
    }
  }
  return [...map.values()];
}

/**
 * Per-topic scores for one set: AP topics, then class-only chapters, each weakest first (ties by
 * key in CED order).
 * `scores` maps question id to its 0–1 score; unanswered questions are left out.
 */
export function topicBreakdown(questions: PracticeQuestion[], scores: Record<string, number>): TopicScore[] {
  const classOnly = (t: TopicScore) => Number(t.area.kind === 'chapter');
  return scoresByArea(questions, (q) => (scores[q.id] === undefined ? [] : [scores[q.id]!])).sort(
    (a, b) => classOnly(a) - classOnly(b) || a.score / a.count - b.score / b.count || byId(a.key, b.key),
  );
}

// ---------------------------------------------------------------------------
// Practice history
// ---------------------------------------------------------------------------

export const HISTORY_LIMIT = 10;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function recordResult(history: History, questionId: string, score: number): History {
  const prev = history[questionId] ?? [];
  return { ...history, [questionId]: [...prev, clamp01(score)].slice(-HISTORY_LIMIT) };
}

/** Replace the most recent score for a question (a corrected self-mark), or record it if there is none. */
export function amendLastResult(history: History, questionId: string, score: number): History {
  const prev = history[questionId] ?? [];
  if (prev.length === 0) return recordResult(history, questionId, score);
  return { ...history, [questionId]: [...prev.slice(0, -1), clamp01(score)] };
}

/** Mean recent score per area (by areaKey), across all questions with history. */
export function topicAccuracy(questions: PracticeQuestion[], history: History): Map<string, number> {
  return new Map(scoresByArea(questions, (q) => history[q.id] ?? []).map((t) => [t.key, t.score / t.count]));
}

/** Topics never attempted rank between weak (<0.5) and strong topics. */
export const UNSEEN_ACCURACY = 0.5;

/** Below this recent accuracy a topic is listed under "Topics to work on". */
export const WEAK_THRESHOLD = 0.75;

/**
 * Topics with history that are below WEAK_THRESHOLD, weakest first (CED topics only: class-only
 * chapter keys have no topic page or practice link of their own).
 */
export function weakTopics(questions: PracticeQuestion[], history: History, max = 4): [string, number][] {
  return scoresByArea(questions, (q) => history[q.id] ?? [])
    .flatMap((t): [string, number][] => (t.area.kind === 'topic' ? [[t.area.topic, t.score / t.count]] : []))
    .filter(([, acc]) => acc < WEAK_THRESHOLD)
    .sort((a, b) => a[1] - b[1])
    .slice(0, max);
}

/**
 * True when "weakest topics first" has nothing to go on: none of the matching questions has been
 * answered on this device, so the order is effectively random. (A class test's page offers
 * "weakest topics" only when this is false.)
 */
export function weakHasNoHistory(matching: Pick<PracticeQuestion, 'id'>[], history: History): boolean {
  return !matching.some((q) => history[q.id]?.length);
}
