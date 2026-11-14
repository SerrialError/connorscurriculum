// Where a class is: the chapters it has reached, what it's on now, its latest test, and which
// lessons and questions are class material. Plain functions over the registry data, so the
// dashboard and the class home compute the same thing (classSummary) and it can be tested.
import type { SubjectData } from './registry';

/** A lesson or question, as far as these functions look at it. */
interface Entry {
  data: { chapter: number; authors: string[] };
}

/** The class has reached this chapter: it's finished or being studied now (progress.json). */
export function isTaught(data: SubjectData, chapter: number): boolean {
  return data.progress.chapters.has(chapter) || data.progress.current.includes(chapter);
}

/**
 * Sample content: pages written to show the format (authors: ["sample"]), not class material.
 * They're labelled as samples and kept out of the home page and the lessons list's main part.
 */
export function isSample(entry: Entry): boolean {
  return entry.data.authors.length === 1 && entry.data.authors[0]!.trim().toLowerCase() === 'sample';
}

/** Class material: not a sample, and from a chapter the class has reached. */
export function isClassContent(data: SubjectData, entry: Entry): boolean {
  return !isSample(entry) && isTaught(data, entry.data.chapter);
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

/** Topic ids sorted in the order the CED lists them. */
export function inCedOrder(data: SubjectData, ids: Iterable<string>): string[] {
  const order = [...data.topics.keys()];
  return [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Lessons and questions in a class test (whole chapters, or only the listed sections). */
export function inTest(test: SubjectData['tests'][number], entry: { data: { chapter: number; sections: string[] } }): boolean {
  if (!test.chapters.includes(entry.data.chapter)) return false;
  return test.sections.length === 0 || entry.data.sections.some((s) => test.sections.includes(s));
}

/** Class tests, latest first (undated tests last, in file order). */
export function testsByDate(data: SubjectData) {
  return [...data.tests].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/**
 * What a class's cards show, on the dashboard and on the class home: its class-material lessons
 * and questions (no samples, nothing from chapters it hasn't reached), what it's on now, and its
 * latest test.
 */
export function classSummary<L extends Entry, Q extends Entry>(data: SubjectData, lessons: L[], questions: Q[]) {
  return {
    lessons: lessons.filter((l) => isClassContent(data, l)),
    questions: questions.filter((q) => isClassContent(data, q)),
    now: nowChapters(data),
    test: testsByDate(data)[0],
  };
}
