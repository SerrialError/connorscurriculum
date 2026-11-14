import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { renderPlainText } from '../markdown';
import { type ChoiceLengths, balanceProblems, choiceBalance, longestChoice } from './choice-balance';

const q = (lengths: number[], answer: string): ChoiceLengths => ({
  lengths: lengths.map((length, i) => ({ id: 'abcd'[i]!, length })),
  answer,
});

describe('longestChoice', () => {
  it('is the one choice longer than the rest', () => {
    expect(longestChoice(q([10, 30, 20, 5], 'a'))).toBe('b');
  });

  it('is nothing when the longest choices tie', () => {
    expect(longestChoice(q([30, 30, 20, 5], 'a'))).toBeUndefined();
  });
});

describe('choiceBalance', () => {
  it('compares the longest-is-correct count with what chance gives', () => {
    const b = choiceBalance([q([10, 30, 20, 5], 'b'), q([30, 30, 20, 5], 'a'), q([1, 2, 3, 4], 'a')]);
    expect(b.longest).toBe(1);
    // The tie can't be "longest", so only two questions count, each 1/4.
    expect(b.expectedLongest).toBe(0.5);
    expect(b.letters).toEqual({ a: 2, b: 1 });
    expect(b.expectedLetters).toEqual({ a: 0.75, b: 0.75, c: 0.75, d: 0.75 });
  });

  it('flags a longest-is-correct habit and a lopsided letter', () => {
    const lopsided = Array.from({ length: 20 }, () => q([10, 40, 20, 30], 'b'));
    const problems = balanceProblems(choiceBalance(lopsided));
    expect(problems.some((p) => p.includes('longest in 20 of 20'))).toBe(true);
    expect(problems.some((p) => p.startsWith('(B) is the answer 20 times'))).toBe(true);
    expect(problems.some((p) => p.startsWith('(D) is the answer only 0 times'))).toBe(true);
  });

  it('passes answers spread over the letters, longest no more than chance', () => {
    const spread = Array.from({ length: 20 }, (_, i) => q([10, 20, 30, 40], 'abcd'[i % 4]!));
    expect(balanceProblems(choiceBalance(spread))).toEqual([]);
  });
});

// Every chapter's real questions: the answer shouldn't be guessable from choice length or letter.
// Small chapters (a few sample questions) are left out, since chance alone can skew them.
const MIN_QUESTIONS = 20;
const QUESTIONS_DIR = join(process.cwd(), 'src', 'content', 'questions');

interface YamlMcq {
  type: string;
  subject: string;
  chapter: number;
  choices: { id: string; text: string }[];
  answer: string;
}

function chapters(): Map<string, YamlMcq[]> {
  const files = readdirSync(QUESTIONS_DIR, { recursive: true, encoding: 'utf8' }).filter((f) => /\.ya?ml$/.test(f));
  const out = new Map<string, YamlMcq[]>();
  for (const f of files) {
    for (const item of parse(readFileSync(join(QUESTIONS_DIR, f), 'utf8')) as YamlMcq[]) {
      if (item.type !== 'mcq') continue;
      const key = `${item.subject} chapter ${item.chapter}`;
      out.set(key, [...(out.get(key) ?? []), item]);
    }
  }
  return out;
}

describe(`MCQ choices in ${relative(process.cwd(), QUESTIONS_DIR)}`, () => {
  for (const [chapter, mcqs] of chapters()) {
    if (mcqs.length < MIN_QUESTIONS) continue;
    it(`${chapter}: the answer isn't given away by length or letter`, async () => {
      const measured = await Promise.all(
        mcqs.map(async (m) => ({
          answer: m.answer,
          lengths: await Promise.all(m.choices.map(async (c) => ({ id: c.id, length: (await renderPlainText(c.text)).length }))),
        })),
      );
      expect(balanceProblems(choiceBalance(measured))).toEqual([]);
    });
  }
});
