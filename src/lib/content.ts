// Queries over lessons and questions, keyed by subject. Pages should go through these
// so draft handling and sorting stay consistent.
import { type CollectionEntry, getCollection } from 'astro:content';
import { type SubjectData, getSubjectData, loadRegistry } from './registry';
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
  status: 'none' | 'partial' | 'covered';
}

export function coverage(data: SubjectData, lessons: Lesson[], questions: Question[]): Map<string, TopicCoverage> {
  const map = new Map<string, TopicCoverage>();
  for (const id of data.topics.keys()) map.set(id, { lessons: [], questions: 0, chapters: [], status: 'none' });
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
    const hasL = c.lessons.length > 0;
    const hasQ = c.questions > 0;
    c.status = hasL && hasQ ? 'covered' : hasL || hasQ ? 'partial' : 'none';
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
