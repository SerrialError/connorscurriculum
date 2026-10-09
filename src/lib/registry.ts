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
  apUnits: z.array(z.string()).default([]),
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

export type Subject = z.infer<typeof subjectSchema>;
export type Ced = z.infer<typeof cedSchema>;
export type CedUnit = Ced['units'][number];
export type CedTopic = z.infer<typeof cedTopicSchema> & { unitId: string };
export type Chapter = z.infer<typeof chapterSchema>;
export type ClassTest = z.infer<typeof testSchema>;

export interface SubjectData {
  subject: Subject;
  ced: Ced;
  chapters: Chapter[];
  tests: ClassTest[];
  /** topic id ("5.4") -> topic */
  topics: Map<string, CedTopic>;
  /** chapter number -> chapter */
  chapterMap: Map<number, Chapter>;
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
  const chapters = readJson(chaptersFile, z.array(chapterSchema));
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

  const chapterMap = new Map<number, Chapter>();
  chapters.forEach((chapter, i) => {
    if (chapterMap.has(chapter.number)) {
      throw new DataError(chaptersFile, `[${i}].number`, `duplicate chapter ${chapter.number}`);
    }
    chapterMap.set(chapter.number, chapter);
    chapter.apUnits.forEach((unitId, j) => {
      if (!unitIds.has(unitId)) {
        throw new DataError(chaptersFile, `[${i}].apUnits[${j}]`, `unit "${unitId}" is not in ced.json`);
      }
    });
  });
  chapters.sort((a, b) => a.number - b.number);

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

  return { subject, ced, chapters, tests, topics, chapterMap };
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
