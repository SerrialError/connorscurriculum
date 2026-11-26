// What a class home page shows, worked out from the class's data so the page only renders it:
// the chapters it's on now, its latest test, the lessons of its latest chapters, and its progress
// through the AP topics.
import { inCedOrder, inTest, type nowChapters } from './class-status';
import { hasTopics } from './features';
import { type FrqLink, frqCountLabel, matchFrqs } from './frqs';
import { kindCounts } from './lesson-kinds';
import { type PracticeStart, examStart, practiceStarts } from './practice/links';
import type { SubjectData } from './registry';

interface HomeLesson {
  id: string;
  data: { chapter: number; sections: string[]; kind: 'lesson' | 'notes' | 'review' };
}
interface HomeQuestion {
  id: string;
  data: { chapter: number; sections: string[] };
}

export interface HomeChapter<L> {
  chapter: SubjectData['chapters'][number];
  /** Its AP topics, in CED order. */
  topics: string[];
  /** "3 lessons · 2 notes pages", or "" with none. */
  pages: string;
  lessons: L[];
  notes: L[];
  /** Questions from this chapter. */
  questions: number;
  /** The chapter's main practice button, or null with no questions. */
  practice: PracticeStart | null;
  /** "4 past FRQs (6 parts)", or "" with none. */
  frqs: string;
}

/** How many of the class's AP topics are at each stage, and which were skipped. */
export interface TopicProgress {
  total: number;
  done: number;
  partial: number;
  /** Seen in last year's course. */
  review: number;
  /** Not covered in class, in CED order. */
  skipped: { id: string; title: string }[];
  /** Not started. */
  untouched: number;
  /** Topics the textbook covers thinly. */
  gaps: number;
}

/** How many lesson cards the class home shows: the latest finished chapters with lessons. */
export const RECENT_CHAPTERS = 3;

export function classHome<L extends HomeLesson, Q extends HomeQuestion>(
  data: SubjectData,
  /** From classSummary: the class material, what it's on now, and its latest test. */
  summary: { lessons: L[]; questions: Q[]; now: ReturnType<typeof nowChapters>; test: SubjectData['tests'][number] | undefined },
  frqs: FrqLink[],
) {
  const { lessons, questions, now, test } = summary;

  const chapter = (n: number): HomeChapter<L> => {
    const c = data.chapterMap.get(n)!;
    const own = lessons.filter((l) => l.data.chapter === n);
    const count = questions.filter((q) => q.data.chapter === n).length;
    const frqMatches = matchFrqs(frqs, new Set(c.cedTopics));
    return {
      chapter: c,
      topics: inCedOrder(data, c.cedTopics),
      pages: kindCounts(own),
      lessons: own.filter((l) => l.data.kind === 'lesson'),
      notes: own.filter((l) => l.data.kind === 'notes'),
      questions: count,
      practice: count > 0 ? practiceStarts({ chapters: [n] }, count).start : null,
      frqs: frqMatches.length ? frqCountLabel(frqMatches) : '',
    };
  };

  const testCount = test ? questions.filter((q) => inTest(test, q)).length : 0;
  const counts = { done: 0, review: 0, partial: 0, skipped: 0 };
  for (const s of data.progress.topics.values()) counts[s] += 1;
  const skipped = inCedOrder(data, [...data.progress.topics].filter(([, s]) => s === 'skipped').map(([id]) => id));

  return {
    now: { label: now.label, chapters: now.chapters.map((c) => chapter(c.number)) },
    test: test && {
      test,
      review: lessons.filter((l) => l.data.kind === 'review' && inTest(test, l)),
      practice: testCount > 0 ? practiceStarts({ test: test.id }, testCount) : null,
      /** The test's practice exam (tests.json "exam"), or null without one or with no questions. */
      exam: testCount > 0 && test.exam ? examStart(test.id) : null,
    },
    /** The latest finished chapters with lessons, most recent first. */
    recent: [...data.progress.chapters]
      .sort((a, b) => b - a)
      .map(chapter)
      .filter((c) => c.pages !== '')
      .slice(0, RECENT_CHAPTERS),
    topics: hasTopics(data)
      ? ({
          total: data.topics.size,
          done: counts.done,
          partial: counts.partial,
          review: counts.review,
          skipped: skipped.map((id) => ({ id, title: data.topics.get(id)!.title })),
          untouched: data.topics.size - counts.done - counts.review - counts.partial - counts.skipped,
          gaps: data.textbookGaps.topics.size,
        } satisfies TopicProgress)
      : null,
  };
}
