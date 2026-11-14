// Lessons and questions, matched both ways: the lessons the practice screens point to ("Study this
// in the lesson", "Read up on what you missed"), and the questions a lesson page links to.
import type { PracticeQuestion } from './types';
import { inSections } from './filters';

/** A lesson the practice screens can point to (lessons only, not notes or review sheets). */
export interface PracticeLesson {
  title: string;
  href: string;
  chapter: number;
  sections: string[];
  /** CED topic ids. */
  topics: string[];
}

/**
 * The lessons that teach a question: lessons from its chapter sharing a textbook section (most
 * shared sections first), else lessons from its chapter sharing an AP topic. At most `max`.
 */
export function lessonsFor(
  q: Pick<PracticeQuestion, 'chapter' | 'sections' | 'cedTopics'>,
  lessons: PracticeLesson[],
  max = 2,
): PracticeLesson[] {
  const same = lessons.filter((l) => l.chapter === q.chapter);
  const bySection = same
    .map((l, i) => ({ l, i, n: l.sections.filter((s) => q.sections.includes(s)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.l);
  const found = bySection.length ? bySection : same.filter((l) => l.topics.some((t) => q.cedTopics.includes(t)));
  return found.slice(0, max);
}

/**
 * What to read after a set: the lessons for the questions missed, most missed first, and the
 * chapters of missed questions that no lesson matched (to link their lesson lists instead).
 */
export function lessonsForMissed(
  missed: Pick<PracticeQuestion, 'chapter' | 'sections' | 'cedTopics'>[],
  lessons: PracticeLesson[],
): { lessons: { lesson: PracticeLesson; missed: number }[]; chapters: number[] } {
  const counts = new Map<PracticeLesson, number>();
  const chapters = new Set<number>();
  for (const q of missed) {
    const found = lessonsFor(q, lessons);
    if (found.length === 0) chapters.add(q.chapter);
    for (const l of found) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  const order = (l: PracticeLesson) => lessons.indexOf(l);
  return {
    lessons: [...counts]
      .map(([lesson, n]) => ({ lesson, missed: n }))
      .sort((a, b) => b.missed - a.missed || order(a.lesson) - order(b.lesson)),
    chapters: [...chapters].sort((a, b) => a - b),
  };
}

/**
 * What a lesson page's practice links pick: the questions from its chapter on its textbook
 * sections (the ones whose "Study this in the lesson" can point back to it), or the whole chapter
 * when the lesson has no sections or no question is tagged with them. Null when the chapter has
 * no questions.
 */
export function lessonPractice(
  lesson: Pick<PracticeLesson, 'chapter' | 'sections'>,
  questions: Pick<PracticeQuestion, 'chapter' | 'sections'>[],
): { query: { chapter: number[]; section?: string[] }; count: number; scope: 'lesson' | 'chapter' } | null {
  const chapter = questions.filter((q) => q.chapter === lesson.chapter);
  const own = lesson.sections.length ? chapter.filter((q) => inSections(q, lesson.sections)).length : 0;
  if (own) return { query: { chapter: [lesson.chapter], section: lesson.sections }, count: own, scope: 'lesson' };
  return chapter.length ? { query: { chapter: [lesson.chapter] }, count: chapter.length, scope: 'chapter' } : null;
}
