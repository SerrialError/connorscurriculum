import { describe, expect, it } from 'vitest';
import { CLASS_ONLY_UNIT, activeFilterCount, countWith, emptyFilters, filterQuestions, filterTopics, isCustomCount, sessionSize, toggled } from './filters';
import type { PracticeQuestion, PracticeTest } from './types';
import { parseFilters } from './url';
import { mcq, questions, tests } from './test-fixtures';

describe('filterQuestions', () => {
  const ids = (qs: PracticeQuestion[]) => qs.map((q) => q.id);

  it('filters by chapter', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), chapters: [14] }, tests))).toEqual(['q1', 'q2']);
  });

  it('filters by test chapters and sections', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), test: 'ch14' }, tests))).toEqual(['q1', 'q2']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), test: 'ch15-part' }, tests))).toEqual([]);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), test: 'missing' }, tests))).toEqual([]);
  });

  it('treats units and topics as one OR group', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), topics: ['5.2'] }, tests))).toEqual(['q2']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), topics: ['5.2'], units: ['7'] }, tests))).toEqual(['q2', 'f1']);
  });

  it('selects class-only questions (no CED topic) with the class-only unit', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), units: [CLASS_ONLY_UNIT] }, tests))).toEqual(['q3']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), units: [CLASS_ONLY_UNIT, '7'] }, tests))).toEqual(['q3', 'f1']);
    // With the class-only entry, unit counts add up to the total.
    const total = ['5', '7', CLASS_ONLY_UNIT].reduce((n, u) => n + countWith(questions, emptyFilters(), tests, { units: [u] }), 0);
    expect(total).toBe(questions.length);
    expect(parseFilters('?unit=class').units).toEqual([CLASS_ONLY_UNIT]);
  });

  it('counts matches for a changed filter without changing the others', () => {
    const f = { ...emptyFilters(), difficulty: [1] };
    expect(countWith(questions, f, tests, { chapters: [14] })).toBe(1);
    expect(countWith(questions, f, tests, { chapters: [13] })).toBe(1);
    expect(countWith(questions, f, tests, { chapters: [15] })).toBe(0);
    expect(f.chapters).toEqual([]);
  });

  it('counts active filters, leaving out order and count', () => {
    expect(activeFilterCount({ ...emptyFilters(), mode: 'random', n: 5 })).toBe(0);
    expect(activeFilterCount({ ...emptyFilters(), chapters: [6, 7], test: 'x', type: 'mcq' })).toBe(4);
  });

  it('leaves out samples and later chapters unless their chapter is picked', () => {
    const qs = [mcq('a'), mcq('b', { chapter: 15, extra: true, difficulty: 2 })];
    const later: PracticeTest[] = [{ id: 't15', title: 'Ch. 15 Test', chapters: [15], sections: [] }];
    expect(ids(filterQuestions(qs, emptyFilters(), later))).toEqual(['a']);
    expect(ids(filterQuestions(qs, { ...emptyFilters(), topics: ['5.1'] }, later))).toEqual(['a']);
    expect(ids(filterQuestions(qs, { ...emptyFilters(), difficulty: [2] }, later))).toEqual([]);
    expect(ids(filterQuestions(qs, { ...emptyFilters(), chapters: [15] }, later))).toEqual(['b']);
    expect(ids(filterQuestions(qs, { ...emptyFilters(), chapters: [14, 15] }, later))).toEqual(['a', 'b']);
    expect(ids(filterQuestions(qs, { ...emptyFilters(), test: 't15' }, later))).toEqual(['b']);
    expect(countWith(qs, emptyFilters(), later, { chapters: [15] })).toBe(1);
  });

  it('filters by difficulty and type', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), difficulty: [2, 3] }, tests))).toEqual(['q2', 'f1']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), type: 'frq' }, tests))).toEqual(['f1']);
  });
});

describe('set size', () => {
  it('reports the session size', () => {
    expect(sessionSize(40, { n: null })).toBe(40);
    expect(sessionSize(40, { n: 10 })).toBe(10);
    expect(sessionSize(4, { n: 10 })).toBe(4);
  });

  it('treats only counts without their own chip as "Other"', () => {
    expect(isCustomCount(null)).toBe(false);
    expect(isCustomCount(10)).toBe(false);
    expect(isCustomCount(7)).toBe(true);
  });
});

describe('filterTopics', () => {
  const units = [{ id: '5', topics: [{ id: '5.1' }, { id: '5.2' }] }];
  const chapterTopics = { '14': ['5.1', '5.2', '3.13'], '15': ['7.1'] };

  it('is empty without topic, unit, chapter, or test filters', () => {
    expect(filterTopics({ ...emptyFilters(), difficulty: [1] }, units, chapterTopics, tests).size).toBe(0);
  });

  it('combines topics, units, chapters, and the test', () => {
    const f = { ...emptyFilters(), topics: ['9.1'], units: ['5'], chapters: [15], test: 'ch14' };
    expect([...filterTopics(f, units, chapterTopics, tests)].sort()).toEqual(['3.13', '5.1', '5.2', '7.1', '9.1']);
  });
});

describe('toggled', () => {
  it('adds a missing value and removes a present one, leaving the list alone', () => {
    const list = [1, 2];
    expect(toggled(list, 3)).toEqual([1, 2, 3]);
    expect(toggled(list, 1)).toEqual([2]);
    expect(list).toEqual([1, 2]);
  });
});
