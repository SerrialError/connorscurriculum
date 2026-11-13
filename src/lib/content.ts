// Queries over lessons and questions, keyed by subject. Pages should go through these
// so draft handling and sorting stay consistent.
import { type CollectionEntry, getCollection } from 'astro:content';
import { type SubjectData, getSubjectData, loadRegistry } from './registry';
import { type FrqLink, flattenFrqs } from './frqs';
import { topicIdFromRef } from './validate';

export type Lesson = CollectionEntry<'lessons'>;
export type Question = CollectionEntry<'questions'>;

export const subjectIds = () => [...loadRegistry().keys()];

/** For getStaticPaths of /[subject]/... pages. */
export const subjectPaths = () => subjectIds().map((subject) => ({ params: { subject } }));

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

/** Lessons and questions in a class test (whole chapters, or only the listed sections). */
export function inTest(test: SubjectData['tests'][number], entry: Lesson | Question): boolean {
  if (!test.chapters.includes(entry.data.chapter)) return false;
  return test.sections.length === 0 || entry.data.sections.some((s) => test.sections.includes(s));
}

export function practiceHref(subject: string, query: Record<string, string | string[] | number[]>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    const s = Array.isArray(v) ? v.join(',') : v;
    if (s) p.set(k, s);
  }
  const qs = p.toString().replaceAll('%2C', ',');
  return url(`${subject}/practice/${qs ? `?${qs}` : ''}`);
}

export { getSubjectData };

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
 * The chapter to study next: the first chapter the class is working on now (progress.json "current"),
 * else the first unfinished chapter after the last finished one (else the first unfinished).
 */
export function nextChapter(data: SubjectData) {
  const current = data.progress.current.map((n) => data.chapterMap.get(n)).find((c) => c !== undefined);
  if (current) return current;
  const lastDone = Math.max(0, ...data.progress.chapters);
  const unfinished = data.chapters.filter((c) => !data.progress.chapters.has(c.number));
  return unfinished.find((c) => c.number > lastDone) ?? unfinished[0];
}

/** Chapters the class is on now (progress.json "current"), in class order. */
export function currentChapters(data: SubjectData) {
  return data.progress.current.map((n) => data.chapterMap.get(n)!).filter(Boolean);
}

/** Class tests, latest first (undated tests last, in file order). */
export function testsByDate(data: SubjectData) {
  return [...data.tests].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export const LESSON_KINDS = [
  { kind: 'review', heading: 'Test review' },
  { kind: 'lesson', heading: 'Lessons' },
  { kind: 'notes', heading: 'Class notes' },
] as const;

/** Lessons split into review sheets, lessons, and classmates' notes, leaving out empty groups. */
export function groupLessons(lessons: Lesson[]) {
  return LESSON_KINDS.map((k) => ({ ...k, lessons: lessons.filter((l) => l.data.kind === k.kind) })).filter(
    (g) => g.lessons.length > 0,
  );
}

/** "Ch. 8–9", "Ch. 6, 8", "Ch. 7" */
export function chapterRange(ns: number[]): string {
  const sorted = [...ns].sort((a, b) => a - b);
  const consecutive = sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1);
  if (sorted.length > 1 && consecutive) return `Ch. ${sorted[0]}–${sorted.at(-1)}`;
  return `Ch. ${sorted.join(', ')}`;
}
