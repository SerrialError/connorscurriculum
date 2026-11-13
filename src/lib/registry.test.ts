import { describe, expect, it } from 'vitest';
import { deriveProgress, getSubjectData } from './registry';

describe('deriveProgress', () => {
  const topicChapters = new Map([
    ['1.1', [3]],
    ['1.5', [2, 6]],
    ['5.1', [14]],
    ['9.9', []],
  ]);

  it('marks a topic done only when every chapter teaching it is finished', () => {
    const p = deriveProgress(new Set([2, 3]), topicChapters);
    expect(p.topics.get('1.1')).toBe('done');
    expect(p.topics.get('1.5')).toBe('partial');
    expect(p.notes.get('1.5')).toEqual(['Started in Ch. 2; continues in Ch. 6.']);
    expect(p.topics.has('5.1')).toBe(false);
    expect(p.topics.has('9.9')).toBe(false);
  });

  it('upgrades partial topics when the last chapter is finished', () => {
    const p = deriveProgress(new Set([2, 3, 6]), topicChapters);
    expect(p.topics.get('1.5')).toBe('done');
    expect(p.notes.has('1.5')).toBe(false);
  });
});

describe('deriveProgress with last year', () => {
  const topicChapters = new Map([
    ['1.5', [2, 6]],
    ['3.4', [10]],
    ['3.5', [10]],
    ['8.2', [16]],
    ['9.5', [19]],
  ]);
  const lastYear = {
    course: 'Scholars Chemistry',
    covered: ['3.4', '8.2'],
    partial: ['1.5', '3.5'],
    notes: { '3.5': 'no Maxwell-Boltzmann.' },
  };

  it('marks topics fully covered last year as review, and partly covered ones as partial', () => {
    const p = deriveProgress(new Set([2]), topicChapters, lastYear);
    expect(p.lastYearCourse).toBe('Scholars Chemistry');
    expect(p.topics.get('3.4')).toBe('review');
    expect(p.notes.get('3.4')).toEqual(['Covered in Scholars Chemistry.']);
    expect(p.topics.get('3.5')).toBe('partial');
    expect(p.notes.get('3.5')).toEqual(['Partly covered in Scholars Chemistry: no Maxwell-Boltzmann.']);
    expect(p.topics.get('1.5')).toBe('partial');
    expect(p.notes.get('1.5')).toHaveLength(2);
    expect(p.topics.has('9.5')).toBe(false);
  });

  it("lets this year's checkmark replace last year's mark", () => {
    const p = deriveProgress(new Set([2, 6, 10]), topicChapters, lastYear);
    expect(p.topics.get('3.4')).toBe('done');
    expect(p.topics.get('1.5')).toBe('done');
    expect(p.notes.has('3.4')).toBe(false);
  });
});

describe('apchem data', () => {
  it('maps every CED topic to at least one chapter', () => {
    const data = getSubjectData('apchem');
    const unmapped = [...data.topicChapters].filter(([, chs]) => chs.length === 0).map(([id]) => id);
    expect(unmapped).toEqual([]);
  });
});

describe('current chapters', () => {
  it('passes the chapters being studied through to progress, in order', () => {
    const p = deriveProgress(new Set([1]), new Map([['1.1', [1]]]), undefined, [9, 8]);
    expect(p.current).toEqual([9, 8]);
    expect(deriveProgress(new Set(), new Map()).current).toEqual([]);
  });

  it('apchem: current chapters exist and are not already finished', () => {
    const data = getSubjectData('apchem');
    for (const n of data.progress.current) {
      expect(data.chapterMap.has(n)).toBe(true);
      expect(data.progress.chapters.has(n)).toBe(false);
    }
  });
});

describe('topics not covered in class', () => {
  const topicChapters = new Map([
    ['1.6', [6, 7]],
    ['3.4', [10]],
    ['1.7', [7, 8]],
  ]);
  const lastYear = { course: 'Scholars Chemistry', covered: ['3.4'], partial: ['1.7'], notes: {} };

  it('marks a topic skipped instead of done when its chapters are finished', () => {
    const p = deriveProgress(new Set([6, 7]), topicChapters, undefined, [], { '1.6': 'learn it on your own.' });
    expect(p.topics.get('1.6')).toBe('skipped');
    expect(p.notes.get('1.6')).toEqual(['Not covered in class: learn it on your own.']);
  });

  it("keeps last year's review mark and notes for a skipped topic", () => {
    const p = deriveProgress(new Set([7, 10]), topicChapters, lastYear, [], { '3.4': 'skipped.', '1.7': 'skipped.' });
    expect(p.topics.get('3.4')).toBe('review');
    expect(p.notes.get('3.4')).toEqual(['Not covered in class: skipped.', 'Covered in Scholars Chemistry.']);
    expect(p.topics.get('1.7')).toBe('skipped');
    expect(p.notes.get('1.7')).toHaveLength(2);
  });

  it('apchem: PES (1.6) is not checked off', () => {
    const data = getSubjectData('apchem');
    expect(data.progress.topics.get('1.6')).toBe('skipped');
  });
});

describe('textbook gaps', () => {
  it('apchem: lists gap topics that exist, in CED order', () => {
    const data = getSubjectData('apchem');
    const ids = [...data.textbookGaps.topics.keys()];
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(data.topics.has(id)).toBe(true);
    const order = [...data.topics.keys()];
    expect([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(ids);
    expect(data.textbookGaps.topics.get('1.6')?.coverage).toBe('missing');
  });
});
