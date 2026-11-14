// Queries over lessons and questions, keyed by subject. Pages should go through these
// so draft handling and sorting stay consistent.
import { type CollectionEntry, getCollection } from 'astro:content';
import { type SubjectData, getSubjectData, loadRegistry } from './registry';
import { classSummary, isSample } from './class-status';
import { type FrqLink, flattenFrqs } from './frqs';
import { isPast, isoDate } from './dates';
import { topicIdFromRef } from './validate';

export type Lesson = CollectionEntry<'lessons'>;
export type Question = CollectionEntry<'questions'>;

export const subjectIds = () => [...loadRegistry().keys()];

/** For getStaticPaths of /[subject]/... pages. */
export const subjectPaths = () => subjectIds().map((subject) => ({ params: { subject } }));

/** For pages only some classes have, e.g. `subjectPathsWith(hasPastFrqs)` (lib/features.ts). */
export const subjectPathsWith = (has: (data: SubjectData) => boolean) => () =>
  [...loadRegistry()].filter(([, data]) => has(data)).map(([subject]) => ({ params: { subject } }));

/** "apchem/14-reaction-rates" -> "14-reaction-rates" */
export const lessonSlug = (lesson: Lesson) => lesson.id.split('/').slice(1).join('/');

export const topicIds = (entry: Lesson | Question) =>
  entry.data.cedTopics.map((ref) => topicIdFromRef(entry.data.subject.id, ref));

export async function getLessons(subject: string): Promise<Lesson[]> {
  const lessons = await getCollection(
    'lessons',
    (l) => l.data.subject.id === subject && !(import.meta.env.PROD && l.data.draft),
  );
  return lessons.sort(
    (a, b) => a.data.chapter - b.data.chapter || a.data.order - b.data.order || a.data.title.localeCompare(b.data.title),
  );
}

export async function getQuestions(subject: string): Promise<Question[]> {
  const questions = await getCollection('questions', (q) => q.data.subject.id === subject);
  // Chapter order, then the order questions appear in their files.
  return questions.sort((a, b) => a.data.chapter - b.data.chapter || a.data.position - b.data.position);
}

export interface TopicCoverage {
  lessons: Lesson[];
  questions: number;
  chapters: number[];
}

export function coverage(data: SubjectData, lessons: Lesson[], questions: Question[]): Map<string, TopicCoverage> {
  const map = new Map<string, TopicCoverage>();
  for (const id of data.topics.keys()) map.set(id, { lessons: [], questions: 0, chapters: [] });
  const addChapter = (c: TopicCoverage, n: number) => {
    if (!c.chapters.includes(n)) c.chapters.push(n);
  };
  for (const lesson of lessons) {
    for (const t of topicIds(lesson)) {
      const c = map.get(t)!;
      c.lessons.push(lesson);
      addChapter(c, lesson.data.chapter);
    }
  }
  for (const q of questions) {
    for (const t of topicIds(q)) {
      const c = map.get(t)!;
      c.questions += 1;
      addChapter(c, q.data.chapter);
    }
  }
  for (const c of map.values()) {
    c.chapters.sort((a, b) => a - b);
  }
  return map;
}

/**
 * A class's practice page at a practice query (lib/practice/links.ts builds them): a "Start …"
 * link begins that set right away, a "Pick your own set" link opens the setup screen with its
 * filters picked, and nothing starts until the student presses Start.
 */
export const practiceUrl = (subject: string, query = '') => url(`${subject}/practice/${query}`);

export { getSubjectData };
export { currentChapters, inCedOrder, inTest, isClassContent, isSample, isTaught, nextChapter, nowChapters, testsByDate } from './class-status';
export { LESSON_KINDS, groupLessons, kindCounts, kindLabel } from './lesson-kinds';

/** A class's dashboard data (see classSummary), loaded from its content. */
export async function getClassSummary(data: SubjectData) {
  return classSummary(data, await getLessons(data.subject.id), await getQuestions(data.subject.id));
}

/** Prefix a site-relative path with the configured base. */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Past AP FRQs for a subject, flattened for display. */
export function pastFrqLinks(data: SubjectData): FrqLink[] {
  return flattenFrqs(data.pastFrqs);
}

/** A topic counts as learned for FRQ readiness if it is done this year or was covered last year. */
export function learnedTopic(data: SubjectData) {
  return (topic: string) => {
    const s = data.progress.topics.get(topic);
    return s === 'done' || s === 'review';
  };
}

/**
 * Has the test happened, as of the build? Pages mark tests with data-test-date and Base.astro's
 * script decides again by the reader's date.
 */
export const isPastTest = (test: { date?: string } | undefined): boolean => isPast(test?.date, isoDate(new Date()));

/** "By Jaya", or "Sample page" for samples. */
export function byline(lesson: Lesson): string {
  return isSample(lesson) ? 'Sample page' : `By ${lesson.data.authors.join(', ')}`;
}

export const lessonHref = (lesson: Lesson) => url(`${lesson.data.subject.id}/lessons/${lessonSlug(lesson)}/`);
