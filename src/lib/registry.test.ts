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
