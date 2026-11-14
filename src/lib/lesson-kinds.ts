// The three kinds of lesson page (review sheet, lesson, classmates' notes) and their wording.
import { plural } from './text';

type Kind = 'review' | 'lesson' | 'notes';
interface WithKind {
  data: { kind: Kind };
}

export const LESSON_KINDS = [
  { kind: 'review', heading: 'Test review', label: 'Review sheet', chip: 'Review sheets', one: 'review sheet' },
  { kind: 'lesson', heading: 'Lessons', label: 'Lesson', chip: 'Lessons', one: 'lesson' },
  { kind: 'notes', heading: "Classmates' notes", label: 'Notes', chip: 'Notes', one: 'notes page' },
] as const;

/**
 * "4 lessons · 3 notes pages · 1 review sheet": how many pages of each kind, leaving out kinds
 * with none. Every count of lessons on the site uses this, so the numbers agree from page to page.
 */
export function kindCounts(lessons: WithKind[]): string {
  return (['lesson', 'notes', 'review'] as const)
    .map((kind) => [LESSON_KINDS.find((k) => k.kind === kind)!.one, lessons.filter((l) => l.data.kind === kind).length] as const)
    .filter(([, n]) => n > 0)
    .map(([word, n]) => plural(n, word))
    .join(' · ');
}

/** "Lesson", "Notes", or "Review sheet", for search results and tags. */
export function kindLabel(lesson: WithKind): string {
  return LESSON_KINDS.find((k) => k.kind === lesson.data.kind)!.label;
}

/** Lessons split into review sheets, lessons, and classmates' notes, leaving out empty groups. */
export function groupLessons<L extends WithKind>(lessons: L[]) {
  return LESSON_KINDS.map((k) => ({ ...k, lessons: lessons.filter((l) => l.data.kind === k.kind) })).filter(
    (g) => g.lessons.length > 0,
  );
}
