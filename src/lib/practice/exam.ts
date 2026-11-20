// Practice exams in a class test's format (tests.json "exam"): which questions each section can
// draw, drawing one exam with a set's seed, and scoring it the way the test is scored.
import { type Rng, shuffle } from './random';
import type { ExamSection, PracticeExam, PracticeQuestion } from './types';
import { plural } from '../text';

/** What drawing needs to know about a question; content entries and practice questions both have it. */
export interface ExamCandidate {
  id: string;
  type: 'mcq' | 'frq';
  chapter: number;
  sections: string[];
  calculation?: boolean;
  difficulty: number;
}

/** The questions an exam can draw from `questions` (its test's): those at least as hard as minDifficulty. */
export const examQuestions = <Q extends ExamCandidate>(questions: Q[], exam: PracticeExam): Q[] =>
  questions.filter((q) => q.difficulty >= (exam.minDifficulty ?? 1));

const fits = (q: ExamCandidate, s: ExamSection) =>
  s.match.chapters.includes(q.chapter) && (s.match.sections.length === 0 || q.sections.some((x) => s.match.sections.includes(x)));

/** The exam section a multiple-choice question counts in: the first one it fits. */
export function sectionOf(q: ExamCandidate, exam: PracticeExam): ExamSection | undefined {
  return q.type === 'mcq' ? exam.sections.find((s) => fits(q, s)) : undefined;
}

/** Orders textbook section ids numerically ("6.9" before "6.10"); questions without one go last. */
export function compareSections(a: string | undefined, b: string | undefined): number {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1;
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface ExamPool<Q> {
  section: ExamSection;
  questions: Q[];
  /** Of those, the ones that aren't calculations. */
  concepts: number;
}

/** Each section's questions out of `questions` (the test's questions), in their order. */
export function examPools<Q extends ExamCandidate>(questions: Q[], exam: PracticeExam): ExamPool<Q>[] {
  return exam.sections.map((section) => {
    const own = questions.filter((q) => sectionOf(q, exam) === section);
    return { section, questions: own, concepts: own.filter((q) => !q.calculation).length };
  });
}

export const examFrqs = <Q extends ExamCandidate>(questions: Q[]): Q[] => questions.filter((q) => q.type === 'frq');

/** The exam's multiple-choice count: the sections' counts plus the extras. */
export const mcqCount = (exam: PracticeExam): number => exam.sections.reduce((n, s) => n + s.count, 0) + exam.extra;

/** Points for the whole exam, e.g. 36 × 2.8 + 7.2 = 108. */
export const examMax = (exam: PracticeExam): number => round1(mcqCount(exam) * exam.mcqPoints + exam.frq.points);

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Why `questions` can't fill the exam (empty when they can): a section with fewer questions than
 * its count, or fewer non-calculation questions than its count needs, too few for the extras, or
 * too few FRQs. The build stops on these.
 */
export function examShortfalls(all: ExamCandidate[], exam: PracticeExam): string[] {
  const out: string[] = [];
  const questions = examQuestions(all, exam);
  const pools = examPools(questions, exam);
  for (const { section: s, questions: qs, concepts } of pools) {
    if (qs.length < s.count) out.push(`section "${s.id}" needs ${plural(s.count, 'multiple-choice question')} but only ${qs.length} match`);
    const needed = s.count - (s.maxCalculations ?? s.count);
    if (concepts < needed) {
      out.push(`section "${s.id}" allows ${plural(s.maxCalculations!, 'calculation')}, so it needs ${needed} other questions, but only ${concepts} aren't calculations`);
    }
  }
  const spare = pools.reduce((n, p) => n + Math.max(0, p.questions.length - p.section.count), 0);
  if (spare < exam.extra) out.push(`"extra" needs ${plural(exam.extra, 'question')} beyond the sections' counts, but there are only ${spare}`);
  const frqs = examFrqs(questions).length;
  if (frqs < exam.frq.count) out.push(`needs ${plural(exam.frq.count, 'free-response question')} but only ${frqs} match`);
  return out;
}

/**
 * One exam drawn from the test's questions with `rng`: each section's count (with no more than its
 * maxCalculations), the extras from what's left of every section, then the FRQs. Multiple choice
 * comes in section order and, within a section, by textbook section, so the exam reads like the test;
 * questions from the same textbook section come in random order. The FRQs come last.
 */
export function drawExam<Q extends ExamCandidate>(all: Q[], exam: PracticeExam, rng: Rng): Q[] {
  const questions = examQuestions(all, exam);
  const pools = examPools(questions, exam);
  const picked = new Set<string>();
  const calcs = new Map<string, number>();
  const room = (q: Q, s: ExamSection) => !q.calculation || (calcs.get(s.id) ?? 0) < (s.maxCalculations ?? Infinity);
  const take = (q: Q, s: ExamSection) => {
    picked.add(q.id);
    if (q.calculation) calcs.set(s.id, (calcs.get(s.id) ?? 0) + 1);
  };
  for (const { section, questions: qs } of pools) {
    let left = section.count;
    for (const q of shuffle(qs, rng)) {
      if (left === 0) break;
      if (!room(q, section)) continue;
      take(q, section);
      left -= 1;
    }
  }
  let extra = exam.extra;
  const rest = shuffle(
    pools.flatMap((p) => p.questions.filter((q) => !picked.has(q.id)).map((q) => ({ q, s: p.section }))),
    rng,
  );
  for (const { q, s } of rest) {
    if (extra === 0) break;
    if (!room(q, s)) continue;
    take(q, s);
    extra -= 1;
  }
  const mcqs = pools.flatMap((p) =>
    shuffle(p.questions.filter((q) => picked.has(q.id)), rng).sort((a, b) => compareSections(a.sections[0], b.sections[0])),
  );
  return [...mcqs, ...shuffle(examFrqs(questions), rng).slice(0, exam.frq.count)];
}

export interface SectionScore {
  section: ExamSection;
  correct: number;
  count: number;
}

export interface ExamScore {
  mcq: { correct: number; count: number; points: number; max: number };
  /** `earned` of `possible` rubric points, scaled to the exam's FRQ points; `marked` once every FRQ is marked. */
  frq: { earned: number; possible: number; points: number; max: number; marked: boolean };
  points: number;
  max: number;
  sections: SectionScore[];
}

/**
 * The exam's score: each correct multiple-choice answer earns mcqPoints, and the FRQ rubric points
 * the student gave themselves are scaled to the exam's FRQ points (4 of 6 rubric points on a 7.2-point
 * FRQ is 4.8). `mcqRight` says whether each multiple-choice question was answered right; `frqMarks`
 * has each marked FRQ's earned and possible rubric points.
 */
export function scoreExam(
  questions: PracticeQuestion[],
  exam: PracticeExam,
  mcqRight: Record<string, boolean>,
  frqMarks: Record<string, { earned: number; possible: number }>,
): ExamScore {
  const mcqs = questions.filter((q) => q.type === 'mcq');
  const frqs = questions.filter((q) => q.type === 'frq');
  const correct = mcqs.filter((q) => mcqRight[q.id]).length;
  const marked = frqs.filter((q) => frqMarks[q.id]);
  const earned = marked.reduce((n, q) => n + frqMarks[q.id]!.earned, 0);
  const possible = frqs.reduce((n, q) => n + (q.type === 'frq' ? q.parts.reduce((m, p) => m + p.points, 0) : 0), 0);
  const frqMax = frqs.length ? exam.frq.points : 0;
  const frqPoints = possible ? round1((earned / possible) * frqMax) : 0;
  const mcqPoints = round1(correct * exam.mcqPoints);
  const mcqMax = round1(mcqs.length * exam.mcqPoints);
  return {
    mcq: { correct, count: mcqs.length, points: mcqPoints, max: mcqMax },
    frq: { earned, possible, points: frqPoints, max: frqMax, marked: marked.length === frqs.length },
    points: round1(mcqPoints + frqPoints),
    max: round1(mcqMax + frqMax),
    sections: exam.sections.map((section) => {
      const own = mcqs.filter((q) => sectionOf(q, exam) === section);
      return { section, correct: own.filter((q) => mcqRight[q.id]).length, count: own.length };
    }),
  };
}

// ---------------------------------------------------------------------------
// Words for an exam
// ---------------------------------------------------------------------------

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** "2.8", "7.2", "108" */
export const formatPoints = (x: number): string => String(round1(x));

/** "36 multiple choice and 1 free response, 108 points in all" */
export function examFormat(exam: PracticeExam): string {
  const frq = exam.frq.count ? ` and ${exam.frq.count} free response` : '';
  return `${mcqCount(exam)} multiple choice${frq}, ${formatPoints(examMax(exam))} points in all`;
}

/** How the points are split: "2.8 points per multiple-choice question; the free response is worth 7.2" */
export function examPointsNote(exam: PracticeExam): string {
  const frq = exam.frq.count ? `; the free response is worth ${formatPoints(exam.frq.points)}` : '';
  return `${formatPoints(exam.mcqPoints)} points per multiple-choice question${frq}`;
}

/**
 * What an exam draws, one line each: "8 on energy, wavelength, and frequency (no more than 3
 * calculations)", …, "1 more from any of these" (the extras), "1 free-response question".
 */
export function examParts(exam: PracticeExam): string[] {
  const parts = exam.sections.map((s) => {
    const calc = s.maxCalculations === undefined ? '' : ` (no more than ${s.maxCalculations} ${s.maxCalculations === 1 ? 'calculation' : 'calculations'})`;
    return `${s.count} on ${lowerFirst(s.label)}${calc}`;
  });
  if (exam.extra) parts.push(`${exam.extra} more from any of ${exam.sections.length > 1 ? 'these' : 'that'}`);
  if (exam.frq.count) parts.push(`${exam.frq.count} free-response ${exam.frq.count === 1 ? 'question' : 'questions'}`);
  if ((exam.minDifficulty ?? 1) === 2) parts.push('medium and hard questions only');
  if (exam.minDifficulty === 3) parts.push('hard questions only');
  return parts;
}
