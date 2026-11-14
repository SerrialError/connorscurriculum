import { describe, expect, it } from 'vitest';
import { emptyFilters, CLASS_ONLY_UNIT } from './filters';
import { againLabel, answerRestLabel, describeScope, describeSet, filterChips, retryWords, topicKeyLabel } from './labels';
import type { PracticeTest } from './types';
import { parseFilters } from './url';
import { tests as fixtureTests } from './test-fixtures';

describe('naming a set', () => {
  const tests: PracticeTest[] = [{ id: 'ch6-7-test', title: 'Chapters 6–7 Test', chapters: [6, 7], sections: [] }];
  it('names the test and how the set was picked', () => {
    expect(describeSet(parseFilters('?test=ch6-7-test&mode=random'), tests, 10, 116)).toBe('Chapters 6–7 Test · 10 random');
    expect(describeSet(parseFilters('?test=ch6-7-test&mode=weak'), tests, 10, 116)).toBe(
      'Chapters 6–7 Test · 10 on your weakest topics',
    );
    expect(describeSet(parseFilters('?test=ch6-7-test&mode=all&n=all'), tests, 116, 116)).toBe('Chapters 6–7 Test · all 116 in order');
  });
  it('lists the other filters, and says "All questions" when there are none', () => {
    expect(describeScope(parseFilters('?chapter=7,6&difficulty=3,1&type=mcq'), tests)).toBe('Ch. 6–7 · Easy, Hard · Multiple choice');
    expect(describeScope(parseFilters(`?unit=1,${CLASS_ONLY_UNIT}&topic=1.7`), tests)).toBe('Unit 1, Not on the AP exam · Topic 1.7');
    // A test the class no longer has is never named by its id.
    expect(describeScope(parseFilters('?test=old-test-id'), tests)).toBe('Class test');
    expect(describeSet(parseFilters('?mode=random&n=5'), tests, 3, 3)).toBe('All questions · all 3, shuffled');
  });
  it('names the default pool when later chapters are left out', () => {
    expect(describeScope(emptyFilters(), tests, 'Ch. 6–7')).toBe('Ch. 6–7');
    expect(describeScope(parseFilters('?difficulty=3'), tests, 'Ch. 6–7')).toBe('Ch. 6–7 · Hard');
    expect(describeScope(parseFilters('?chapter=7&difficulty=3'), tests, 'Ch. 6–7')).toBe('Ch. 7 · Hard');
    expect(describeScope(parseFilters('?test=ch6-7-test'), tests, 'Ch. 6–7')).toBe('Chapters 6–7 Test');
    expect(describeScope(parseFilters('?topic=3.12'), tests, 'Ch. 6–7')).toBe('Topic 3.12');
    expect(describeScope(parseFilters('?section=7.3,7.2'), tests, 'Ch. 6–7')).toBe('§7.2, §7.3');
    expect(describeScope(parseFilters('?chapter=7&section=7.2'), tests)).toBe('Ch. 7 · §7.2');
    expect(describeSet(parseFilters('?mode=weak'), tests, 10, 116, 'Ch. 6–7')).toBe('Ch. 6–7 · 10 on your weakest topics');
  });
});

describe('retryWords', () => {
  it('says "missed" when every question scored zero', () => {
    expect(retryWords([0, 0, 0])).toEqual({ button: 'Retry the 3 missed', set: 'retrying the 3 missed' });
  });
  it('says "without full marks" when any got partial credit', () => {
    expect(retryWords([0.5, 0.25, 0.8]).button).toBe('Retry the 3 without full marks');
    expect(retryWords([0, 0.5]).set).toBe('retrying the 2 without full marks');
  });
});

describe('buttons and chips', () => {
  it('offers "start again" instead of a new set when the order is fixed', () => {
    expect(againLabel({ mode: 'all' })).toBe('Start this set again');
    expect(againLabel({ mode: 'random' })).toBe('New set, same filters');
    expect(againLabel({ mode: 'weak' })).toBe('New set, same filters');
  });

  it('goes back to the unanswered questions, or to the start when none were answered', () => {
    expect(answerRestLabel(3, 7)).toBe('Answer the remaining 3');
    expect(answerRestLabel(10, 0)).toBe('Back to question 1');
  });

  it('names topic keys, including class-only chapters', () => {
    const titles = new Map([['5.4', 'Elementary Reactions']]);
    expect(topicKeyLabel('5.4', titles)).toBe('5.4 Elementary Reactions');
    expect(topicKeyLabel('9.9', titles)).toBe('9.9');
    expect(topicKeyLabel('chapter-7', titles)).toBe('Ch. 7 material not on the AP exam');
    expect(topicKeyLabel('chapter-7', new Map())).toBe('Ch. 7');
  });

  it('lists the narrowing filters as chips, each removing only itself', () => {
    const f = { ...emptyFilters(), chapters: [7, 14], sections: ['7.2'], test: 'ch14', difficulty: [3], type: 'frq' as const, mode: 'all' as const };
    const chips = filterChips(f, fixtureTests, [14]);
    expect(chips.map((c) => [c.label, c.more])).toEqual([
      ['Ch. 7', false],
      ['Ch. 14', true],
      ['§7.2', false],
      ['Ch 14', true],
      ['Hard', false],
      ['Free response', true],
    ]);
    expect(chips[0]!.without).toEqual({ ...f, chapters: [14] });
    expect(chips[2]!.without).toEqual({ ...f, sections: [] });
    expect(chips[5]!.without).toEqual({ ...f, type: null });
    expect(filterChips(emptyFilters(), fixtureTests, [])).toEqual([]);
  });
});
