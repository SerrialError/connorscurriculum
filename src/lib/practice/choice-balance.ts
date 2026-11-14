// How much a multiple-choice question's choices give the answer away without the chemistry: the
// correct choice being the longest one, or one answer letter coming up far more than the others.

export interface ChoiceLengths {
  /** Plain-text length of each choice (math written out), in order. */
  lengths: { id: string; length: number }[];
  answer: string;
}

/** The choice longer than every other one, or undefined when the longest ones tie. */
export function longestChoice(q: ChoiceLengths): string | undefined {
  const max = Math.max(...q.lengths.map((c) => c.length));
  const longest = q.lengths.filter((c) => c.length === max);
  return longest.length === 1 ? longest[0]!.id : undefined;
}

export interface ChoiceBalance {
  questions: number;
  /** Questions whose correct choice is longer than every other choice. */
  longest: number;
  /**
   * What `longest` would be if the answer were a random choice: each question with one longest
   * choice counts 1/(number of choices), and one whose longest choices tie counts 0.
   */
  expectedLongest: number;
  /** How often each letter is the answer. */
  letters: Record<string, number>;
  /** How often each letter would be the answer if answers were random. */
  expectedLetters: Record<string, number>;
}

export function choiceBalance(questions: ChoiceLengths[]): ChoiceBalance {
  const b: ChoiceBalance = { questions: questions.length, longest: 0, expectedLongest: 0, letters: {}, expectedLetters: {} };
  for (const q of questions) {
    const id = longestChoice(q);
    if (id !== undefined) b.expectedLongest += 1 / q.lengths.length;
    if (id === q.answer) b.longest += 1;
    b.letters[q.answer] = (b.letters[q.answer] ?? 0) + 1;
    for (const c of q.lengths) b.expectedLetters[c.id] = (b.expectedLetters[c.id] ?? 0) + 1 / q.lengths.length;
  }
  return b;
}

/** Above this many times what chance gives, the answer is the longest choice (or one letter) too often. */
export const MAX_OVER_CHANCE = 1.5;
/** Below this fraction of chance, a letter is the answer too rarely (students learn to rule it out). */
export const MIN_LETTER_SHARE = 0.5;

/** What's off about a group of questions, in words; empty when nothing is. */
export function balanceProblems(b: ChoiceBalance): string[] {
  const out: string[] = [];
  const pct = (x: number) => `${Math.round((x / b.questions) * 100)}%`;
  if (b.longest > b.expectedLongest * MAX_OVER_CHANCE) {
    out.push(
      `the correct choice is the longest in ${b.longest} of ${b.questions} questions, but chance gives about ${Math.round(b.expectedLongest)}: shorten some answers or lengthen their wrong choices`,
    );
  }
  for (const [letter, fair] of Object.entries(b.expectedLetters)) {
    const n = b.letters[letter] ?? 0;
    if (n > fair * MAX_OVER_CHANCE) out.push(`(${letter.toUpperCase()}) is the answer ${n} times (${pct(n)}); move some answers to other letters`);
    else if (n < fair * MIN_LETTER_SHARE) out.push(`(${letter.toUpperCase()}) is the answer only ${n} times (${pct(n)}); move some answers to it`);
  }
  return out;
}
