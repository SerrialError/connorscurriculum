import { describe, expect, it } from 'vitest';
import { type PracticeLesson, lessonPractice, lessonsFor, lessonsForMissed } from './lessons';

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

describe('lessonPractice', () => {
  const qs = [
    { chapter: 7, sections: ['7.2'] },
    { chapter: 7, sections: ['7.2', '7.3'] },
    { chapter: 7, sections: ['7.4'] },
    { chapter: 7, sections: [] },
    { chapter: 6, sections: ['7.2'] },
  ];

  it("picks the questions on the lesson's sections, in its chapter", () => {
    expect(lessonPractice({ chapter: 7, sections: ['7.2'] }, qs)).toEqual({
      pool: { chapters: [7], sections: ['7.2'] },
      count: 2,
      scope: 'lesson',
    });
    expect(lessonPractice({ chapter: 7, sections: ['7.3', '7.4'] }, qs)?.count).toBe(2);
  });
  it('falls back to the chapter with no sections, or none tagged with them', () => {
    const chapter = { pool: { chapters: [7] }, count: 4, scope: 'chapter' };
    expect(lessonPractice({ chapter: 7, sections: [] }, qs)).toEqual(chapter);
    expect(lessonPractice({ chapter: 7, sections: ['7.8'] }, qs)).toEqual(chapter);
  });
  it('is null for a chapter with no questions', () => {
    expect(lessonPractice({ chapter: 8, sections: ['8.1'] }, qs)).toBeNull();
  });
});
