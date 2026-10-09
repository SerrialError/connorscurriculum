// Structural data for every subject: subjects.json plus data/<subject>/{ced,chapters,tests}.json.
// Read synchronously from disk so content schemas can validate tags against it.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'astro/zod';

export const DATA_DIR = join(process.cwd(), 'src', 'data');

export const subjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'subject id must be lowercase letters, digits, or dashes'),
  name: z.string().min(1),
  textbook: z.string().min(1),
  standardsName: z.string().min(1),
  order: z.number().default(0),
});

const cedTopicSchema = z.object({
  id: z.string().regex(/^\d+\.\d+$/, 'topic id must look like "5.4"'),
  title: z.string().min(1),
});

const cedUnitSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  examWeight: z.string().optional(),
  topics: z.array(cedTopicSchema).min(1),
});

export const cedSchema = z.object({
  verified: z.boolean().default(false),
  source: z.string().optional(),
  units: z.array(cedUnitSchema).min(1),
});

const sectionSchema = z.object({ id: z.string().min(1), title: z.string().min(1) });

export const chapterSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  // CED topics this chapter teaches. Drives class progress and the chapter's AP units.
  cedTopics: z.array(z.string()).default([]),
  notOnAP: z.array(z.string()).default([]),
  sections: z.array(sectionSchema).default([]),
});

export const testSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'test id must be lowercase letters, digits, or dashes'),
  title: z.string().min(1),
  date: z.iso.date().optional(),
  chapters: z.array(z.number().int()).min(1),
  sections: z.array(z.string()).default([]),
});

export const progressSchema = z.object({
  // Chapters the class has finished. Topic progress is derived from chapters.json.
  chapters: z.array(z.number().int()).default([]),
  // CED topics already seen in an earlier course. Shown with their own mark until covered this year.
  lastYear: z
    .object({
      course: z.string().min(1),
      covered: z.array(z.string()).default([]),
      partial: z.array(z.string()).default([]),
      notes: z.record(z.string(), z.string()).default({}),
    })
    .optional(),
});

export type LastYear = NonNullable<z.infer<typeof progressSchema>['lastYear']>;

export type Subject = z.infer<typeof subjectSchema>;
export type Ced = z.infer<typeof cedSchema>;
export type CedUnit = Ced['units'][number];
export type CedTopic = z.infer<typeof cedTopicSchema> & { unitId: string };
export type Chapter = z.infer<typeof chapterSchema> & {
  /** AP units of this chapter's cedTopics, in CED order. */
  apUnits: string[];
};
export type ClassTest = z.infer<typeof testSchema>;
/**
 * done:    every chapter that teaches it is finished this year
 * review:  not done this year, but fully covered in last year's course
 * partial: started this year and/or partly covered last year
 * null:    new
 */
export type TopicProgress = 'done' | 'review' | 'partial' | null;

export interface Progress {
  chapters: Set<number>;
  /** Name of last year's course, if progress.json has a lastYear block. */
  lastYearCourse: string | null;
  /** Topics with any progress. */
  topics: Map<string, Exclude<TopicProgress, null>>;
  /** Short explanations, shown under the topic (topics already done this year have none). */
  notes: Map<string, string[]>;
}

export interface SubjectData {
  subject: Subject;
  ced: Ced;
  chapters: Chapter[];
  tests: ClassTest[];
  /** topic id ("5.4") -> topic */
  topics: Map<string, CedTopic>;
  /** chapter number -> chapter */
  chapterMap: Map<number, Chapter>;
  /** topic id -> chapter numbers that teach it (from chapters.json), ascending */
  topicChapters: Map<string, number[]>;
  /** Class progress from progress.json (empty if the file is missing). */
  progress: Progress;
}

export class DataError extends Error {
  constructor(file: string, field: string, message: string) {
    super(`${relative(process.cwd(), file)} → ${field}: ${message}`);
    this.name = 'DataError';
  }
}

function readJson<T>(file: string, schema: z.ZodType<T>): T {
  if (!existsSync(file)) throw new DataError(file, '(file)', 'file is missing');
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new DataError(file, '(file)', `invalid JSON: ${(err as Error).message}`);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    throw new DataError(file, formatPath(issue.path), issue.message);
  }
  return result.data;
}

export function formatPath(path: PropertyKey[]): string {
  return path.length === 0
    ? '(root)'
    : path.map((p, i) => (typeof p === 'number' ? `[${p}]` : `${i ? '.' : ''}${String(p)}`)).join('');
}

function loadSubject(subject: Subject): SubjectData {
  const dir = join(DATA_DIR, subject.id);
  const cedFile = join(dir, 'ced.json');
  const chaptersFile = join(dir, 'chapters.json');
  const testsFile = join(dir, 'tests.json');

  const ced = readJson(cedFile, cedSchema);
  const rawChapters = readJson(chaptersFile, z.array(chapterSchema));
  const tests = existsSync(testsFile) ? readJson(testsFile, z.array(testSchema)) : [];

  const topics = new Map<string, CedTopic>();
  const unitIds = new Set<string>();
  ced.units.forEach((unit, u) => {
    if (unitIds.has(unit.id)) throw new DataError(cedFile, `units[${u}].id`, `duplicate unit id "${unit.id}"`);
    unitIds.add(unit.id);
    unit.topics.forEach((topic, t) => {
      if (topics.has(topic.id)) {
        throw new DataError(cedFile, `units[${u}].topics[${t}].id`, `duplicate topic id "${topic.id}"`);
      }
      topics.set(topic.id, { ...topic, unitId: unit.id });
    });
  });

  const unitOrder = ced.units.map((u) => u.id);
  const chapterMap = new Map<number, Chapter>();
  const topicChapters = new Map<string, number[]>([...topics.keys()].map((id) => [id, []]));
  const chapters: Chapter[] = rawChapters.map((raw, i) => {
    if (chapterMap.has(raw.number)) {
      throw new DataError(chaptersFile, `[${i}].number`, `duplicate chapter ${raw.number}`);
    }
    raw.cedTopics.forEach((id, j) => {
      const field = `[${i}].cedTopics[${j}]`;
      if (!topics.has(id)) throw new DataError(chaptersFile, field, `topic "${id}" is not in ced.json`);
      if (raw.cedTopics.indexOf(id) !== j) throw new DataError(chaptersFile, field, `topic "${id}" is listed twice`);
      topicChapters.get(id)!.push(raw.number);
    });
    const units = new Set(raw.cedTopics.map((id) => topics.get(id)!.unitId));
    const chapter = { ...raw, apUnits: unitOrder.filter((u) => units.has(u)) };
    chapterMap.set(chapter.number, chapter);
    return chapter;
  });
  chapters.sort((a, b) => a.number - b.number);
  for (const list of topicChapters.values()) list.sort((a, b) => a - b);

  const testIds = new Set<string>();
  tests.forEach((test, i) => {
    if (testIds.has(test.id)) throw new DataError(testsFile, `[${i}].id`, `duplicate test id "${test.id}"`);
    testIds.add(test.id);
    test.chapters.forEach((n, j) => {
      if (!chapterMap.has(n)) throw new DataError(testsFile, `[${i}].chapters[${j}]`, `chapter ${n} is not in chapters.json`);
    });
    const known = test.chapters.flatMap((n) => chapterMap.get(n)!.sections.map((s) => s.id));
    test.sections.forEach((s, j) => {
      if (known.length > 0 && !known.includes(s)) {
        throw new DataError(testsFile, `[${i}].sections[${j}]`, `section "${s}" is not in the test's chapters`);
      }
    });
  });

  const progressFile = join(dir, 'progress.json');
  const rawProgress = existsSync(progressFile) ? readJson(progressFile, progressSchema) : progressSchema.parse({});
  rawProgress.chapters.forEach((n, i) => {
    if (!chapterMap.has(n)) throw new DataError(progressFile, `chapters[${i}]`, `chapter ${n} is not in chapters.json`);
  });
  const lastYear = rawProgress.lastYear;
  if (lastYear) {
    const seen = new Set<string>();
    for (const list of ['covered', 'partial'] as const) {
      lastYear[list].forEach((id, i) => {
        const field = `lastYear.${list}[${i}]`;
        if (!topics.has(id)) throw new DataError(progressFile, field, `topic "${id}" is not in ced.json`);
        if (seen.has(id)) throw new DataError(progressFile, field, `topic "${id}" is listed twice`);
        seen.add(id);
      });
    }
    for (const id of Object.keys(lastYear.notes)) {
      if (!seen.has(id)) {
        throw new DataError(progressFile, `lastYear.notes.${id}`, `topic "${id}" is not in lastYear.covered or lastYear.partial`);
      }
    }
  }
  const progress = deriveProgress(new Set(rawProgress.chapters), topicChapters, lastYear);

  return { subject, ced, chapters, tests, topics, chapterMap, topicChapters, progress };
}

const listChapters = (ns: number[]) => `Ch. ${ns.join(', ')}`;

/**
 * Combine this year's finished chapters with last year's course. This year's ✓ wins; otherwise a
 * topic fully covered last year is "review"; otherwise any partial coverage is "partial".
 */
export function deriveProgress(
  finished: Set<number>,
  topicChapters: Map<string, number[]>,
  lastYear?: LastYear,
): Progress {
  const progress: Progress = {
    chapters: finished,
    lastYearCourse: lastYear?.course ?? null,
    topics: new Map(),
    notes: new Map(),
  };
  for (const [id, chs] of topicChapters) {
    const done = chs.filter((n) => finished.has(n));
    const thisYear = done.length === 0 ? null : done.length === chs.length ? 'done' : 'partial';
    const before = lastYear?.covered.includes(id) ? 'full' : lastYear?.partial.includes(id) ? 'partial' : null;

    if (thisYear === 'done') {
      progress.topics.set(id, 'done');
      continue;
    }
    if (before === 'full') progress.topics.set(id, 'review');
    else if (thisYear || before) progress.topics.set(id, 'partial');
    else continue;

    const notes: string[] = [];
    if (thisYear === 'partial') {
      const left = chs.filter((n) => !finished.has(n));
      notes.push(`Started in ${listChapters(done)}; continues in ${listChapters(left)}.`);
    }
    if (before) {
      const detail = lastYear!.notes[id];
      const what = before === 'full' ? 'Covered' : 'Partly covered';
      notes.push(`${what} in ${lastYear!.course}${detail ? `: ${detail}` : '.'}`);
    }
    progress.notes.set(id, notes);
  }
  return progress;
}

/** All subjects with their data, sorted by `order`. Re-read on every call so dev picks up edits. */
export function loadRegistry(): Map<string, SubjectData> {
  const subjectsFile = join(DATA_DIR, 'subjects.json');
  const subjects = readJson(subjectsFile, z.array(subjectSchema));
  const registry = new Map<string, SubjectData>();
  [...subjects]
    .sort((a, b) => a.order - b.order)
    .forEach((subject, i) => {
      if (registry.has(subject.id)) throw new DataError(subjectsFile, `[${i}].id`, `duplicate subject "${subject.id}"`);
      registry.set(subject.id, loadSubject(subject));
    });
  return registry;
}

export function getSubjectData(subjectId: string): SubjectData {
  const data = loadRegistry().get(subjectId);
  if (!data) throw new Error(`Unknown subject "${subjectId}"`);
  return data;
}
