// Queries over lessons and questions, keyed by subject. Pages should go through these
// so draft handling and sorting stay consistent.
import { type CollectionEntry, getCollection } from 'astro:content';
import { type SubjectData, getSubjectData, loadRegistry } from './registry';
import { type FrqLink, flattenFrqs } from './frqs';
import { DEFAULT_COUNT } from './practice';
import { isPast, isoDate } from './dates';
import { plural } from './text';
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

/**
 * Practice links follow one rule across the site:
 * - a "Start …" button (practiceStart) begins a set right away (?start=1);
 * - a "Pick your own set" link (practiceHref without start) opens the setup screen with those
 *   filters already picked, and nothing starts until the student presses Start practice.
 */
export function practiceStart(
  subject: string,
  query: { chapter?: number[]; topic?: string[] },
  total: number,
  /** Appended to the label, e.g. "on these topics". */
  about = '',
): { href: string; label: string } {
  const what = total <= DEFAULT_COUNT ? `Start all ${plural(total, 'question')}` : `Start ${DEFAULT_COUNT} random questions`;
  return {
    // The defaults are DEFAULT_COUNT questions, shuffled.
    href: practiceHref(subject, { ...query, start: '1' }),
    label: about ? `${what} ${about}` : what,
  };
}

/**
 * Practice links for a class test: a set of DEFAULT_COUNT random questions (the main action, a
 * sensible length for one sitting) and all of them in order. With DEFAULT_COUNT or fewer
 * questions there is only "all".
 */
export function testPracticeLinks(
  subject: string,
  testId: string,
  total: number,
): { random: { href: string; label: string } | null; all: { href: string; label: string } } {
  const all = { href: practiceHref(subject, { test: testId, mode: 'all', n: 'all', start: '1' }), label: `All ${total} in order` };
  if (total <= DEFAULT_COUNT) return { random: null, all: { ...all, label: `Start all ${plural(total, 'question')}` } };
  return {
    random: { href: practiceHref(subject, { test: testId, start: '1' }), label: `Start ${DEFAULT_COUNT} random questions` },
    all,
  };
}

export function practiceHref(subject: string, query: Record<string, string | string[] | number[] | undefined>): string {
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

/** What to show as "Now in class": the current chapters, or the next unfinished one ("Up next"). */
export function nowChapters(data: SubjectData) {
  const now = currentChapters(data);
  if (now.length) return { label: 'Now in class', chapters: now };
  const next = nextChapter(data);
  return { label: 'Up next', chapters: next ? [next] : [] };
}

/**
 * Has the test happened, as of the build? Pages mark tests with data-test-date and Base.astro's
 * script decides again by the reader's date.
 */
export const isPastTest = (test: { date?: string } | undefined): boolean => isPast(test?.date, isoDate(new Date()));

/** Class tests, latest first (undated tests last, in file order). */
export function testsByDate(data: SubjectData) {
  return [...data.tests].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/** The class has reached this chapter: it's finished or being studied now (progress.json). */
export function isTaught(data: SubjectData, chapter: number): boolean {
  return data.progress.chapters.has(chapter) || data.progress.current.includes(chapter);
}

/**
 * Sample content: pages written to show the format (authors: ["sample"]), not class material.
 * They're labelled as samples and kept out of the home page and the lessons list's main part.
 */
export function isSample(entry: Lesson | Question): boolean {
  return entry.data.authors.length === 1 && entry.data.authors[0]!.trim().toLowerCase() === 'sample';
}

/** Class material: not a sample, and from a chapter the class has reached. */
export function isClassContent(data: SubjectData, entry: Lesson | Question): boolean {
  return !isSample(entry) && isTaught(data, entry.data.chapter);
}

/** "By Jaya", or "Sample page" for samples. */
export function byline(lesson: Lesson): string {
  return isSample(lesson) ? 'Sample page' : `By ${lesson.data.authors.join(', ')}`;
}

export const lessonHref = (lesson: Lesson) => url(`${lesson.data.subject.id}/lessons/${lessonSlug(lesson)}/`);

export const LESSON_KINDS = [
  { kind: 'review', heading: 'Test review', label: 'Review sheet' },
  { kind: 'lesson', heading: 'Lessons', label: 'Lesson' },
  { kind: 'notes', heading: "Classmates' notes", label: 'Notes' },
] as const;

/** "Lesson", "Notes", or "Review sheet", for search results and tags. */
export function kindLabel(lesson: Lesson): string {
  return LESSON_KINDS.find((k) => k.kind === lesson.data.kind)!.label;
}

/** Lessons split into review sheets, lessons, and classmates' notes, leaving out empty groups. */
export function groupLessons(lessons: Lesson[]) {
  return LESSON_KINDS.map((k) => ({ ...k, lessons: lessons.filter((l) => l.data.kind === k.kind) })).filter(
    (g) => g.lessons.length > 0,
  );
}

export { chapterRange } from './practice';
