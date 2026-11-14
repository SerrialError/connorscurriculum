import { describe, expect, it } from 'vitest';
import { emptyFilters, filterQuestions } from './filters';
import { recordResult, topicAccuracy } from './score';
import { newSeed, questionsForSet, seededRng, selectQuestions } from './select';
import { mcq, questions, tests } from './test-fixtures';

describe('questions for a set', () => {
  it('gives the same questions for the same seed, so a shared link opens the same set', () => {
    const many = Array.from({ length: 30 }, (_, i) => mcq(`m${i}`));
    const spec = { filters: { ...emptyFilters(), chapters: [14], n: 5 }, seed: 'abc123', ids: null };
    const a = questionsForSet(many, spec, tests, {}).map((q) => q.id);
    const b = questionsForSet(many, spec, tests, {}).map((q) => q.id);
    expect(a).toHaveLength(5);
    expect(b).toEqual(a);
    const other = questionsForSet(many, { ...spec, seed: 'zzz999' }, tests, {}).map((q) => q.id);
    expect(other).not.toEqual(a);
  });

  it('uses the exact ids when given, in order, skipping missing and repeated ones', () => {
    const spec = { filters: emptyFilters(), seed: 'abc', ids: ['f1', 'gone', 'q1', 'f1'] };
    expect(questionsForSet(questions, spec, tests, {}).map((q) => q.id)).toEqual(['f1', 'q1']);
  });

  it('keeps "in order" in order', () => {
    const spec = { filters: { ...emptyFilters(), mode: 'all' as const, n: null }, seed: 'abc', ids: null };
    expect(questionsForSet(questions, spec, tests, {}).map((q) => q.id)).toEqual(filterQuestions(questions, spec.filters, tests).map((q) => q.id));
  });

  it('makes short URL-safe seeds and a repeatable rng per seed', () => {
    expect(newSeed(seededRng('x'))).toMatch(/^[a-z0-9]{6}$/);
    const r1 = seededRng('abc');
    const r2 = seededRng('abc');
    expect([r1(), r1()]).toEqual([r2(), r2()]);
    expect(seededRng('abd')()).not.toBe(seededRng('abc')());
  });
});

describe('selection', () => {
  it('returns matching questions in order for mode "all", up to n', () => {
    expect(selectQuestions(questions, { mode: 'all', n: null }, {}, seededRng('a'))).toEqual(questions);
    expect(selectQuestions(questions, { mode: 'all', n: 2 }, {}, seededRng('a')).map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('shuffles every matching question when n is null', () => {
    expect(selectQuestions(questions, { mode: 'random', n: null }, {}, seededRng('3'))).toHaveLength(questions.length);
  });

  it('returns N random questions for mode "random"', () => {
    const picked = selectQuestions(questions, { mode: 'random', n: 2 }, {}, seededRng('1'));
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((q) => q.id)).size).toBe(2);
  });

  it('prefers the weakest topics for mode "weak"', () => {
    let h = {};
    h = recordResult(h, 'q1', 1);
    h = recordResult(h, 'q2', 0);
    h = recordResult(h, 'f1', 0.4);
    const acc = topicAccuracy(questions, h);
    expect(acc.get('5.1')).toBe(1);
    expect(acc.get('5.2')).toBe(0);
    expect(acc.get('chapter-13')).toBeUndefined();
    // 5.2 (0) < 7.3 (0.4) < unseen chapter-13 (0.5) < 5.1 (1)
    const picked = selectQuestions(questions, { mode: 'weak', n: 4 }, h, seededRng('7'));
    expect(picked.map((q) => q.id)).toEqual(['q2', 'f1', 'q3', 'q1']);
  });
});
