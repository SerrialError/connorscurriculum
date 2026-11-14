import { describe, expect, it } from 'vitest';
import { type PracticeLesson, lessonsFor, lessonsForMissed } from './lessons';

describe('lessonsFor', () => {
  const lesson = (title: string, chapter: number, sections: string[], topics: string[]): PracticeLesson => ({
    title,
    href: `/${title}/`,
    chapter,
    sections,
    topics,
  });
  const light = lesson('light', 6, ['6.1', '6.2'], ['3.11', '3.12']);
  const bohr = lesson('bohr', 6, ['6.3'], ['3.12']);
  const qn = lesson('qn', 6, ['6.4', '6.5', '6.6', '6.7'], []);
  const config = lesson('config', 6, ['6.7', '6.8', '6.9'], ['1.5']);
  const zeff = lesson('zeff', 7, ['7.2'], ['1.7']);
  const all = [light, bohr, qn, config, zeff];

  it('prefers lessons sharing a textbook section, most shared first', () => {
    expect(lessonsFor({ chapter: 6, sections: ['6.3'], cedTopics: ['3.12'] }, all)).toEqual([bohr]);
    expect(lessonsFor({ chapter: 6, sections: ['6.7'], cedTopics: [] }, all)).toEqual([qn, config]);
    expect(lessonsFor({ chapter: 6, sections: ['6.8', '6.9', '6.5'], cedTopics: [] }, all)).toEqual([config, qn]);
  });
  it('falls back to a shared AP topic in the same chapter', () => {
    expect(lessonsFor({ chapter: 6, sections: [], cedTopics: ['1.5'] }, all)).toEqual([config]);
    expect(lessonsFor({ chapter: 7, sections: [], cedTopics: ['3.12'] }, all)).toEqual([]);
  });
  it('caps the list', () => {
    expect(lessonsFor({ chapter: 6, sections: [], cedTopics: ['3.12'] }, all, 1)).toEqual([light]);
  });
  it('collects lessons for missed questions, most missed first, and chapters with no match', () => {
    const missed = [
      { chapter: 6, sections: ['6.3'], cedTopics: ['3.12'] },
      { chapter: 6, sections: ['6.2'], cedTopics: ['3.12'] },
      { chapter: 6, sections: ['6.3'], cedTopics: ['3.12'] },
      { chapter: 7, sections: ['7.5'], cedTopics: ['1.8'] },
    ];
    expect(lessonsForMissed(missed, all)).toEqual({
      lessons: [
        { lesson: bohr, missed: 2 },
        { lesson: light, missed: 1 },
      ],
      chapters: [7],
    });
  });
});
