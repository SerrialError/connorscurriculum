import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classHome } from './class-home';
import { classSummary } from './class-status';
import { flattenFrqs } from './frqs';
import { type SubjectData, loadRegistry } from './registry';

// The fixture "chem" class (one AP topic, 1.1, with a past FRQ on it), given four chapters:
// 1–3 finished, 4 in class now. Chapter 1 teaches topic 1.1.
const registry = loadRegistry(join(import.meta.dirname, 'fixtures', 'two-classes'));
const base = registry.get('chem')!;
const chapters = [1, 2, 3, 4].map((number) => ({ ...base.chapters[0]!, number, title: `Chapter ${number}`, cedTopics: number === 1 ? ['1.1'] : [] }));
const data: SubjectData = {
  ...base,
  chapters,
  chapterMap: new Map(chapters.map((c) => [c.number, c])),
  progress: { ...base.progress, chapters: new Set([1, 2, 3]), current: [4], topics: new Map([['1.1', 'skipped']]) },
  tests: [{ id: 'ch1-test', title: 'Chapter 1 Test', date: '2026-10-01', chapters: [1], sections: [] }],
};
const lesson = (chapter: number, kind: 'lesson' | 'notes' | 'review', sample = false) => ({ data: { chapter, kind, sample, sections: [] } });
const question = (chapter: number) => ({ data: { chapter, sections: [], sample: false } });

describe('classHome', () => {
  const lessons = [lesson(1, 'lesson'), lesson(1, 'notes'), lesson(1, 'review'), lesson(3, 'lesson'), lesson(4, 'lesson', true)];
  const questions = [...Array.from({ length: 12 }, () => question(1)), question(4)];
  const home = classHome(data, classSummary(data, lessons, questions), flattenFrqs(data.pastFrqs));

  it("shows the chapters in class now, each with its practice link", () => {
    expect(home.now.label).toBe('Now in class');
    expect(home.now.chapters).toHaveLength(1);
    // The sample lesson isn't class material.
    expect(home.now.chapters[0]).toMatchObject({ pages: '', questions: 1, frqs: '' });
    expect(home.now.chapters[0]!.practice).toMatchObject({ query: '?chapter=4&mode=all&n=all&start=1', label: 'Start all 1 question' });
  });

  it('gives the latest test its review sheets and practice links', () => {
    expect(home.test?.review).toEqual([lessons[2]]);
    expect(home.test?.practice?.start.short).toBe('10 random');
    expect(home.test?.practice?.all?.short).toBe('all 12 in order');
  });

  it('lists the latest finished chapters with lessons, most recent first', () => {
    expect(home.recent.map((c) => c.chapter.number)).toEqual([3, 1]);
    expect(home.recent[1]).toMatchObject({ topics: ['1.1'], pages: '1 lesson · 1 notes page · 1 review sheet', frqs: '1 past FRQ' });
    expect(home.recent[1]!.lessons).toEqual([lessons[0]]);
    expect(home.recent[1]!.notes).toEqual([lessons[1]]);
  });

  it('counts AP topic progress, naming the skipped ones', () => {
    expect(home.topics).toEqual({ total: 1, done: 0, partial: 0, review: 0, skipped: [{ id: '1.1', title: 'Moles' }], untouched: 0, gaps: 0 });
  });

  it('has no topic progress for a class without AP topics', () => {
    const bio = registry.get('bio')!;
    expect(classHome(bio, classSummary(bio, [], []), []).topics).toBeNull();
  });
});
