// One attempt at a set: its questions, where the student is, and their answers. Shared by the
// session and results screens; the practice island saves it after every change.
import type { Answers } from '../../lib/practice/saved';
import { type QuestionResult, frqEarned, frqTotal, questionScore, summarize } from '../../lib/practice/score';
import type { FrqQuestion, McqQuestion, PracticeQuestion } from '../../lib/practice/types';

export class Attempt {
  questions = $state<PracticeQuestion[]>([]);
  index = $state(0);
  picks = $state<Answers['picks']>({});
  checked = $state<Answers['checked']>({});
  revealed = $state<Answers['revealed']>({});
  marks = $state<Answers['marks']>({});
  finished = $state<Answers['finished']>({});

  current = $derived(this.questions[this.index]);
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
  skipped = $derived(this.questions.filter((q) => this.scores[q.id] === undefined));
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

  /** Start over with `questions` (or the saved `answers`), at question `index`. */
  load(questions: PracticeQuestion[], answers?: Answers, index = 0) {
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

  allShown = (q: FrqQuestion) => q.parts.every((_, p) => this.revealed[q.id]?.[p]);
  shownCount = (q: FrqQuestion) => q.parts.filter((_, p) => this.revealed[q.id]?.[p]).length;
  earned = (q: FrqQuestion) => frqEarned(q, this.marks[q.id] ?? []);
}
