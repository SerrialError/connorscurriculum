// What the Lessons page lists, worked out from the class's data so the page only renders it:
// chapters in study order (the ones in class now, then finished chapters, latest first), each
// with its lessons and practice link; the taught chapters with no lessons yet; the sample pages
// for chapters the class hasn't reached; and the kind filter's chips.
import { isClassContent, isTaught } from './class-status';
import { LESSON_KINDS } from './lesson-kinds';
import { practiceStarts } from './practice/links';
import type { SubjectData } from './registry';

interface PageLesson {
  data: { chapter: number; sample: boolean; kind: 'lesson' | 'notes' | 'review' };
}
interface PageQuestion {
  data: { chapter: number; sample: boolean };
}

export function lessonsPage<L extends PageLesson>(data: SubjectData, all: L[], questions: PageQuestion[]) {
  const lessons = all.filter((l) => isClassContent(data, l));
  const current = new Set(data.progress.current);
  const taught = data.chapters
    .filter((c) => isTaught(data, c.number))
    .sort((a, b) => Number(current.has(b.number)) - Number(current.has(a.number)) || b.number - a.number);
  const chapters = taught
    .map((c) => {
      const count = questions.filter((q) => q.data.chapter === c.number && isClassContent(data, q)).length;
      return {
        chapter: c,
        now: current.has(c.number),
        lessons: lessons.filter((l) => l.data.chapter === c.number),
        practice: count > 0 ? practiceStarts({ chapters: [c.number] }, count).start : null,
      };
    })
    .filter((s) => s.lessons.length > 0);
  const empty = taught.filter((c) => !chapters.some((s) => s.chapter === c));
  return {
    lessons,
    chapters,
    /** Chapters in class now with no lessons yet, in class order. */
    emptyNow: empty.filter((c) => current.has(c.number)).sort((a, b) => a.number - b.number),
    /** Finished chapters with no lessons. */
    emptyDone: empty.filter((c) => !current.has(c.number)).map((c) => c.number),
    samples: all.filter((l) => !isClassContent(data, l)),
    /** The kind filter's chips, everyday kinds first, each with how many class pages it has. */
    kinds: [...LESSON_KINDS]
      .sort((a, b) => Number(a.kind === 'review') - Number(b.kind === 'review'))
      .map((k) => ({ ...k, n: lessons.filter((l) => l.data.kind === k.kind).length }))
      .filter((k) => k.n > 0),
  };
}
