// One attempt at a set: its questions, where the student is, and their answers. Shared by the
// session and results screens; the practice island saves it after every change.
// A practice exam is answered the same way, except that nothing is checked until it's submitted:
// then every multiple-choice question is checked at once (an unanswered one scores 0).
import { scoreExam } from '../../lib/practice/exam';
import type { Answers } from '../../lib/practice/saved';
import { type DotStatus, type QuestionResult, frqEarned, frqTotal, isCorrect, questionScore, scoreStatus, summarize } from '../../lib/practice/score';
import type { FrqQuestion, McqQuestion, PracticeExam, PracticeQuestion } from '../../lib/practice/types';

export class Attempt {
  questions = $state<PracticeQuestion[]>([]);
  index = $state(0);
  picks = $state<Answers['picks']>({});
  checked = $state<Answers['checked']>({});
  revealed = $state<Answers['revealed']>({});
  marks = $state<Answers['marks']>({});
  finished = $state<Answers['finished']>({});
  /** The blueprint, when this set is a practice exam. */
  exam = $state<PracticeExam | null>(null);

  current = $derived(this.questions[this.index]);
  /** Multiple-choice questions, in order. */
  mcqs = $derived(this.questions.filter((q): q is McqQuestion => q.type === 'mcq'));
  /** A practice exam that has been submitted: every multiple-choice question is checked. */
  submitted = $derived(!!this.exam && this.mcqs.length > 0 && this.mcqs.every((q) => this.checked[q.id]));
  /** A practice exam being taken: answers can change and nothing is shown until it's submitted. */
  taking = $derived(!!this.exam && !this.submitted);
  /** Multiple-choice questions with no choice picked. */
  unpicked = $derived(this.mcqs.filter((q) => !this.picks[q.id]));
  /** 0–1 score per answered question. */
  scores = $derived.by(() => {
    const out: Record<string, number> = {};
    for (const q of this.questions) {
      const s = questionScore(q, this);
      if (s !== undefined) out[q.id] = s;
    }
    return out;
  });
  answered = $derived(Object.keys(this.scores).length);
  missed = $derived(this.questions.filter((q) => this.scores[q.id] !== undefined && this.scores[q.id]! < 1));
  unanswered = $derived(this.questions.filter((q) => this.scores[q.id] === undefined));
  /** A practice exam's score, out of the test's points. */
  examScore = $derived.by(() => {
    if (!this.exam) return null;
    const right = Object.fromEntries(this.mcqs.map((q) => [q.id, !!this.checked[q.id] && isCorrect(q, this.picks[q.id] ?? '')]));
    const marks = Object.fromEntries(
      this.questions.flatMap((q) => (q.type === 'frq' && this.finished[q.id] ? [[q.id, { earned: this.earned(q), possible: frqTotal(q) }]] : [])),
    );
    return scoreExam(this.questions, this.exam, right, marks);
  });
  summary = $derived(
    summarize(
      this.questions.flatMap((q): QuestionResult[] => {
        if (this.scores[q.id] === undefined) return [];
        return q.type === 'mcq'
          ? [{ type: 'mcq' as const, correct: this.scores[q.id] === 1 }]
          : [{ type: 'frq' as const, earned: frqEarned(q, this.marks[q.id] ?? []), possible: frqTotal(q) }];
      }),
    ),
  );

  /** Start over with `questions` (or the saved `answers`), at question `index`; `exam` for a practice exam. */
  load(questions: PracticeQuestion[], answers?: Answers, index = 0, exam: PracticeExam | null = null) {
    this.exam = exam;
    this.questions = questions;
    this.index = Math.min(Math.max(0, index), questions.length - 1);
    this.picks = answers?.picks ?? {};
    this.checked = answers?.checked ?? {};
    this.revealed = answers?.revealed ?? {};
    this.marks = answers?.marks ?? {};
    this.finished = answers?.finished ?? {};
  }

  /** The answers as plain data, for saving. */
  answers(): Answers {
    return {
      picks: $state.snapshot(this.picks),
      checked: $state.snapshot(this.checked),
      revealed: $state.snapshot(this.revealed),
      marks: $state.snapshot(this.marks),
      finished: $state.snapshot(this.finished),
    };
  }

  go(i: number) {
    this.index = Math.max(0, Math.min(this.questions.length - 1, i));
  }

  /** A question's square in the question list. While an exam is being taken it only shows whether a choice is picked. */
  dot(q: PracticeQuestion): DotStatus {
    if (this.taking) return this.picks[q.id] ? 'picked' : 'todo';
    if (this.exam && q.type === 'mcq' && !this.picks[q.id]) return 'todo';
    return scoreStatus(this.scores[q.id]);
  }

  /**
   * Submit a practice exam: check every multiple-choice question. Returns the 0–1 scores of the
   * ones that were answered (for practice history; a question left blank says nothing about the topic).
   */
  submit(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const q of this.mcqs) {
      this.checked[q.id] = true;
      if (this.picks[q.id]) out[q.id] = isCorrect(q, this.picks[q.id]!) ? 1 : 0;
    }
    return out;
  }

  pick(q: McqQuestion, choice: string) {
    if (!this.checked[q.id]) this.picks[q.id] = choice;
  }

  /** MCQ: check the picked choice. False when there is nothing to check (no pick, or checked already). */
  check(q: McqQuestion): boolean {
    if (!this.picks[q.id] || this.checked[q.id]) return false;
    this.checked[q.id] = true;
    return true;
  }

  /** FRQ: "Done marking". */
  finish(q: FrqQuestion) {
    this.finished[q.id] = true;
  }

  /** FRQ: show the scoring for one part (and start its marks, all unchecked). */
  reveal(q: FrqQuestion, part: number) {
    this.revealed[q.id] ??= q.parts.map(() => false);
    this.revealed[q.id]![part] = true;
    this.marks[q.id] ??= q.parts.map((p) => p.scoringHtml.map(() => false));
  }

  setMark(q: FrqQuestion, part: number, point: number, value: boolean) {
    this.marks[q.id] ??= q.parts.map((p) => p.scoringHtml.map(() => false));
    this.marks[q.id]![part]![point] = value;
  }

  anyShown = (q: FrqQuestion) => !!this.revealed[q.id]?.some(Boolean);
  allShown = (q: FrqQuestion) => q.parts.every((_, p) => this.revealed[q.id]?.[p]);
  earned = (q: FrqQuestion) => frqEarned(q, this.marks[q.id] ?? []);
}
