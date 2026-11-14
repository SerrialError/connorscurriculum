import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, amendLastResult, frqEarned, frqTotal, isCorrect, questionScore, recordResult, scoreStatus, summarize, topicBreakdown, weakHasNoHistory, weakTopics } from './score';
import { frq, mcq, questions } from './test-fixtures';

describe('grading', () => {
  it('grades MCQ', () => {
    expect(isCorrect(mcq('x'), 'b')).toBe(true);
    expect(isCorrect(mcq('x'), 'a')).toBe(false);
  });

  it('totals FRQ self-marks', () => {
    expect(frqTotal(frq)).toBe(3);
    expect(frqEarned(frq, [[true, false], [true]])).toBe(2);
    expect(frqEarned(frq, [])).toBe(0);
  });

  it('summarizes a session', () => {
    expect(
      summarize([
        { type: 'mcq', correct: true },
        { type: 'mcq', correct: false },
        { type: 'frq', earned: 2, possible: 3 },
      ]),
    ).toEqual({ mcqCorrect: 1, mcqAnswered: 2, frqEarned: 2, frqPossible: 3, frqDone: 1 });
  });
});

describe('topicBreakdown', () => {
  it('scores each topic in a session, weakest first, skipping unanswered questions', () => {
    const b = topicBreakdown(questions, { q1: 1, q2: 0, f1: 0.5 });
    expect(b).toEqual([
      { key: '5.2', score: 0, count: 1 },
      { key: '7.3', score: 0.5, count: 1 },
      { key: '5.1', score: 1, count: 1 },
    ]);
    expect(topicBreakdown(questions, { q3: 0 })).toEqual([{ key: 'chapter-13', score: 0, count: 1 }]);
  });
  it('lists class-only chapters after the AP topics', () => {
    expect(topicBreakdown(questions, { q1: 1, q3: 0 }).map((t) => t.key)).toEqual(['5.1', 'chapter-13']);
  });
});

describe('amendLastResult', () => {
  it('replaces the latest score instead of adding one', () => {
    expect(amendLastResult({ q: [1, 0.5] }, 'q', 1)).toEqual({ q: [1, 1] });
  });
  it('records a score when there is none yet', () => {
    expect(amendLastResult({}, 'q', 0.25)).toEqual({ q: [0.25] });
  });
});

describe('practice history', () => {
  it('keeps only recent results', () => {
    let h = {};
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = recordResult(h, 'q1', i % 2);
    expect((h as Record<string, number[]>).q1).toHaveLength(HISTORY_LIMIT);
});

  it('knows when "weakest topics" has no history to go on', () => {
    const qs = [mcq('a'), mcq('b', { cedTopics: ['5.2'] })];
    expect(weakHasNoHistory(qs, {})).toBe(true);
    expect(weakHasNoHistory(qs, { other: [1] })).toBe(true);
    expect(weakHasNoHistory(qs, { b: [0] })).toBe(false);
  });

  it('lists weak topics, weakest first, leaving out strong and class-only ones', () => {
    const qs = [mcq('a', { cedTopics: ['1.1'] }), mcq('b', { cedTopics: ['1.2'] }), mcq('c', { cedTopics: ['1.3'] }), mcq('d', { cedTopics: [] })];
    const history = { a: [0, 1], b: [0], c: [1], d: [0] };
    expect(weakTopics(qs, history)).toEqual([
      ['1.2', 0],
      ['1.1', 0.5],
    ]);
    expect(weakTopics(qs, history, 1)).toHaveLength(1);
  });
});

describe('scores', () => {
  const none = { picks: {}, checked: {}, marks: {}, finished: {} };
  it('scores a checked MCQ 1 or 0, and nothing before Check', () => {
    const q = mcq('m');
    expect(questionScore(q, { ...none, picks: { m: 'b' } })).toBeUndefined();
    expect(questionScore(q, { ...none, picks: { m: 'b' }, checked: { m: true } })).toBe(1);
    expect(questionScore(q, { ...none, picks: { m: 'a' }, checked: { m: true } })).toBe(0);
  });

  it('scores an FRQ by points earned once marking is done', () => {
    const marks = { f1: [[true, false], [true]] };
    expect(questionScore(frq, { ...none, marks })).toBeUndefined();
    expect(questionScore(frq, { ...none, marks, finished: { f1: true } })).toBeCloseTo(2 / 3);
  });

  it('turns a score into a status', () => {
    expect([undefined, 1, 0, 0.5].map(scoreStatus)).toEqual(['todo', 'right', 'wrong', 'partial']);
  });
});
