import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classSummary, inCedOrder, isClassContent, nowChapters, testsByDate } from './class-status';
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
    { id: 'undated', title: 'Quiz', chapters: [1], sections: [] },
    { id: 'early', title: 'Chapter 1 Test', date: '2026-10-01', chapters: [1], sections: [] },
    { id: 'late', title: 'Chapter 2 Test', date: '2026-11-20', chapters: [2], sections: [] },
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

  it('sorts topic ids in CED order', () => {
    const ced = { ...data, topics: new Map(['1.2', '1.10', '1.1'].map((id) => [id, base.topics.get('1.1')!])) };
    expect(inCedOrder(ced, new Set(['1.1', '1.10', '1.2']))).toEqual(['1.2', '1.10', '1.1']);
  });

  it('orders tests latest first, undated last', () => {
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
