// Queries over lessons and questions, keyed by subject. Pages should go through these
// so draft handling and sorting stay consistent.
import { type CollectionEntry, getCollection } from 'astro:content';
import { type SubjectData, getSubjectData, loadRegistry } from './registry';
import { classSummary, isSample } from './class-status';
import { type FrqLink, flattenFrqs } from './frqs';
import { DEFAULT_COUNT } from './practice/filters';
import { isPast, isoDate } from './dates';
import { plural } from './text';
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
  query: { chapter?: number[]; section?: string[]; topic?: string[] },
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
export { currentChapters, isClassContent, isSample, isTaught, nextChapter, nowChapters, testsByDate } from './class-status';

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

export const LESSON_KINDS = [
  { kind: 'review', heading: 'Test review', label: 'Review sheet', chip: 'Review sheets', one: 'review sheet' },
  { kind: 'lesson', heading: 'Lessons', label: 'Lesson', chip: 'Lessons', one: 'lesson' },
  { kind: 'notes', heading: "Classmates' notes", label: 'Notes', chip: 'Notes', one: 'notes page' },
] as const;

/**
 * "4 lessons · 3 notes pages · 1 review sheet": how many pages of each kind, leaving out kinds
 * with none. Every count of lessons on the site uses this, so the numbers agree from page to page.
 */
export function kindCounts(lessons: Lesson[]): string {
  return (['lesson', 'notes', 'review'] as const)
    .map((kind) => [LESSON_KINDS.find((k) => k.kind === kind)!.one, lessons.filter((l) => l.data.kind === kind).length] as const)
    .filter(([, n]) => n > 0)
    .map(([word, n]) => plural(n, word))
    .join(' · ');
}

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
