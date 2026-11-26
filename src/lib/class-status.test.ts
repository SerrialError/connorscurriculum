import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classSummary, inCedOrder, inTest, isClassContent, nowChapters, reviewSheets, testsByDate } from './class-status';
import { type SubjectData, loadRegistry } from './registry';

// The fixture "chem" class, given three chapters: 1 finished, 2 in class now, 3 not reached.
const base = loadRegistry(join(import.meta.dirname, 'fixtures', 'two-classes')).get('chem')!;
const chapters = [1, 2, 3].map((number) => ({ ...base.chapters[0]!, number, title: `Chapter ${number}` }));
const withProgress = (finished: number[], current: number[]): SubjectData => ({
  ...base,
  chapters,
  chapterMap: new Map(chapters.map((c) => [c.number, c])),
  progress: { ...base.progress, chapters: new Set(finished), current },
  tests: [
    { id: 'undated', title: 'Pop quiz', kind: 'test', chapters: [1], sections: [], exclude: [], handouts: [] },
    { id: 'early', title: 'Chapter 1 Test', kind: 'test', date: '2026-10-01', chapters: [1], sections: [], exclude: [], handouts: [] },
    { id: 'late', title: 'Chapter 2 Test', kind: 'test', date: '2026-11-20', chapters: [2], sections: [], exclude: [], handouts: [] },
    { id: 'practice', title: 'Practice quiz', kind: 'quiz', chapters: [2], sections: [], exclude: [], handouts: [] },
  ],
});
const entry = (chapter: number, sample = false) => ({ data: { chapter, sample } });

describe('class status', () => {
  const data = withProgress([1], [2]);

  it('counts finished and current chapters as class material, never samples', () => {
    expect([1, 2, 3].map((n) => isClassContent(data, entry(n)))).toEqual([true, true, false]);
    expect(isClassContent(data, entry(1, true))).toBe(false);
  });

  it('shows the current chapters as "Now in class", else the next one as "Up next"', () => {
    expect(nowChapters(data)).toMatchObject({ label: 'Now in class', chapters: [{ number: 2 }] });
    expect(nowChapters(withProgress([1, 2], []))).toMatchObject({ label: 'Up next', chapters: [{ number: 3 }] });
    expect(nowChapters(withProgress([1, 2, 3], [])).chapters).toEqual([]);
  });

  it('puts entries in a test by chapter and listed sections, and a review sheet in by chapter alone', () => {
    const test = { id: 't', title: 'Chapter 2 Test', kind: 'test' as const, chapters: [2], sections: ['2.1', '2.2'], exclude: [], handouts: [] };
    const at = (chapter: number, sections: string[], kind?: string, id = 'x') => ({ id, data: { chapter, sections, kind } });
    expect(inTest(test, at(2, ['2.2']))).toBe(true);
    expect(inTest(test, at(2, ['2.3']))).toBe(false);
    expect(inTest(test, at(2, [], 'notes'))).toBe(false);
    expect(inTest(test, at(2, [], 'review'))).toBe(true);
    expect(inTest(test, at(1, [], 'review'))).toBe(false);
    expect(inTest({ ...test, sections: [] }, at(2, []))).toBe(true);
  });

  it("lists a test's review sheets newest chapter first", () => {
    const final = { id: 'final', title: 'Final', kind: 'test' as const, chapters: [1, 2, 3], sections: ['1.1'], exclude: [], handouts: [] };
    const sheet = (id: string, chapter: number, kind = 'review') => ({ id, data: { chapter, sections: [], kind } });
    const lessons = [sheet('ch1-2', 2), sheet('lesson', 3, 'lesson'), sheet('final', 3), sheet('other', 4)];
    expect(reviewSheets(final, lessons).map((l) => l.id)).toEqual(['final', 'ch1-2']);
  });

  it('leaves out the ids a test excludes', () => {
    const test = { id: 't', title: 'Chapter 2 Test', kind: 'test' as const, chapters: [2], sections: [], exclude: ['ap-only'], handouts: [] };
    expect(inTest(test, { id: 'ap-only', data: { chapter: 2, sections: [] } })).toBe(false);
    expect(inTest(test, { id: 'other', data: { chapter: 2, sections: [] } })).toBe(true);
  });

  it('sorts topic ids in CED order', () => {
    const ced = { ...data, topics: new Map(['1.2', '1.10', '1.1'].map((id) => [id, base.topics.get('1.1')!])) };
    expect(inCedOrder(ced, new Set(['1.1', '1.10', '1.2']))).toEqual(['1.2', '1.10', '1.1']);
  });

  it('orders tests latest first, undated last', () => {
    // The site's own practice quiz isn't a class test.
    expect(testsByDate(data).map((t) => t.id)).toEqual(['late', 'early', 'undated']);
  });

  it('summarizes a class the same way for the dashboard and the class home', () => {
    const lessons = [entry(1), entry(2), entry(3), entry(2, true)];
    const questions = [entry(2), entry(3)];
    const s = classSummary(data, lessons, questions);
    expect(s.lessons).toEqual([lessons[0], lessons[1]]);
    expect(s.questions).toEqual([questions[0]]);
    expect(s.now.label).toBe('Now in class');
    expect(s.test?.id).toBe('late');
  });
});
