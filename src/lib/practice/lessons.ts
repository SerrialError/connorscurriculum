// Lessons the practice screens point to: "Study this in the lesson" and "Read up on what you missed".
import type { PracticeQuestion } from './types';

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
