import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lessonsPage } from './lessons-page';
import { type SubjectData, loadRegistry } from './registry';

// The fixture "chem" class, given five chapters: 1–3 finished, 4 and 5 in class now.
const base = loadRegistry(join(import.meta.dirname, 'fixtures', 'two-classes')).get('chem')!;
const chapters = [1, 2, 3, 4, 5, 6].map((number) => ({ ...base.chapters[0]!, number, title: `Chapter ${number}` }));
const data: SubjectData = {
  ...base,
  chapters,
  chapterMap: new Map(chapters.map((c) => [c.number, c])),
  progress: { ...base.progress, chapters: new Set([1, 2, 3]), current: [5, 4] },
};
const page = (chapter: number, kind: 'lesson' | 'notes' | 'review' = 'lesson', sample = false) => ({ data: { chapter, kind, sample } });

describe('lessonsPage', () => {
  const all = [page(1), page(1, 'review'), page(3, 'notes'), page(4), page(6), page(2, 'lesson', true)];
  const questions = Array.from({ length: 12 }, () => ({ data: { chapter: 1, sample: false } }));
  const p = lessonsPage(data, all, questions);

  it('lists chapters with lessons, the ones in class now first, then the latest finished', () => {
    expect(p.chapters.map((c) => [c.chapter.number, c.now])).toEqual([
      [4, true],
      [3, false],
      [1, false],
    ]);
    expect(p.chapters.find((c) => c.chapter.number === 1)?.practice?.label).toBe('Start 10 random questions');
    expect(p.chapters.find((c) => c.chapter.number === 3)?.practice).toBeNull();
  });

  it('names the taught chapters with nothing yet, and keeps samples apart', () => {
    expect(p.emptyNow.map((c) => c.number)).toEqual([5]);
    expect(p.emptyDone).toEqual([2]);
    expect(p.samples).toEqual([all[4], all[5]]);
  });

  it('offers a chip per kind the class has, review sheets last', () => {
    expect(p.kinds.map((k) => [k.kind, k.n])).toEqual([
      ['lesson', 2],
      ['notes', 1],
      ['review', 1],
    ]);
  });
});
