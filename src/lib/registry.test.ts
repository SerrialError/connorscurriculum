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
    expect(p.notes.get('1.5')).toBe('Started in Ch. 2; continues in Ch. 6.');
    expect(p.topics.has('5.1')).toBe(false);
    expect(p.topics.has('9.9')).toBe(false);
  });

  it('upgrades partial topics when the last chapter is finished', () => {
    const p = deriveProgress(new Set([2, 3, 6]), topicChapters);
    expect(p.topics.get('1.5')).toBe('done');
    expect(p.notes.has('1.5')).toBe(false);
  });
});

describe('apchem data', () => {
  it('maps every CED topic to at least one chapter', () => {
    const data = getSubjectData('apchem');
    const unmapped = [...data.topicChapters].filter(([, chs]) => chs.length === 0).map(([id]) => id);
    expect(unmapped).toEqual([]);
  });
});
