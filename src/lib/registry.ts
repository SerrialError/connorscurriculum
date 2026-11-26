// Structural data for every subject: subjects.json plus data/<subject>/*.json. Only chapters.json
// is required; a class without ced.json (standards), tests.json, or past-frqs.json simply has no
// topic pages, tests, or past FRQs (see features.ts).
// Read synchronously from disk so content schemas can validate tags against it.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'astro/zod';
import { chapterRange } from './text';

export const DATA_DIR = join(process.cwd(), 'src', 'data');

export const subjectSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'subject id must be lowercase letters, digits, or dashes'),
  name: z.string().min(1),
  textbook: z.string().min(1),
  /**
   * The official AP Course and Exam Description (College Board's PDF) that ced.json follows,
   * linked from the AP topics page. Only for a class with a ced.json.
   */
  standardsUrl: z.url({ protocol: /^https$/ }).optional(),
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

const sciencePracticeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().optional(),
  skills: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).min(1),
});

export const cedSchema = z.object({
  verified: z.boolean().default(false),
  source: z.string().optional(),
  units: z.array(cedUnitSchema).min(1),
  sciencePractices: z.array(sciencePracticeSchema).default([]),
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

/**
 * One section of a practice exam's multiple choice: `count` questions that `match` (a chapter in
 * `chapters` and, when `sections` lists textbook sections, tagged with one of them).
 */
const examSectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'section id must be lowercase letters, digits, or dashes'),
  /** Shown in the exam's results, e.g. "Energy, wavelength, and frequency". */
  label: z.string().min(1),
  count: z.number().int().positive(),
  match: z.object({
    chapters: z.array(z.number().int()).min(1, 'list at least one chapter'),
    sections: z.array(z.string()).default([]),
  }),
  /** At least this many of the group's questions must be calculations (questions with calculation: true). */
  minCalculations: z.number().int().nonnegative().optional(),
  /** At most this many of the group's questions may be calculations. */
  maxCalculations: z.number().int().nonnegative().optional(),
});

/**
 * A practice exam in the class test's format. The multiple-choice questions come from `sections`
 * (a question counts in the first group it fits), plus `extra` more from any of them, then
 * `frq.count` free-response questions from the test's chapters.
 */
export const examSchema = z.object({
  mcqPoints: z.number().positive(),
  sections: z.array(examSectionSchema).min(1),
  /** Multiple-choice questions beyond the groups' counts, drawn from all the groups together. */
  extra: z.number().int().nonnegative().default(0),
  /** Only questions at least this hard (1 easy, 2 medium, 3 hard) are drawn, multiple choice and FRQ. */
  minDifficulty: z.number().int().min(1).max(3).default(1),
  /** The teacher hasn't announced the format yet, so this one is a stand-in; pages say so. */
  tentative: z.boolean().default(false),
  frq: z.object({
    count: z.number().int().nonnegative(),
    points: z.number().nonnegative(),
    /** false: never draw an FRQ that needs a calculation (questions with calculation: true). */
    calculations: z.boolean().default(true),
  }),
});

export const testSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'test id must be lowercase letters, digits, or dashes'),
  title: z.string().min(1),
  /**
   * test: a class test the teacher gives. quiz: a practice quiz written for this site, not a class
   * test; it's listed separately and never counts as the class's next or latest test.
   */
  kind: z.enum(['test', 'quiz']).default('test'),
  /** About how long it takes (quizzes). */
  minutes: z.number().int().positive().optional(),
  /** One line on what it covers (quizzes). */
  summary: z.string().min(1).optional(),
  date: z.iso.date().optional(),
  chapters: z.array(z.number().int()).min(1),
  sections: z.array(z.string()).default([]),
  /**
   * Question ids in the test's chapters and sections that it doesn't cover (off-topic for a quiz, or
   * AP-only material the teacher left out). They're left out of the test everywhere, practice exam included.
   */
  exclude: z.array(z.string()).default([]),
  /** Handed out with the test, e.g. an equation sheet: linked from the test page. */
  handouts: z.array(z.object({ title: z.string().min(1), url: z.url({ protocol: /^https$/ }) })).default([]),
  exam: examSchema.optional(),
});

export const progressSchema = z.object({
  // Chapters the class has finished. Topic progress is derived from chapters.json.
  chapters: z.array(z.number().int()).default([]),
  // Chapters the class is working on now (not finished yet), in class order.
  current: z.array(z.number().int()).default([]),
  // CED topics the class skipped even though a chapter teaching them is finished: topic id -> what
  // happened, shown to students. These get no checkmark.
  notCovered: z.record(z.string(), z.string().min(1)).default({}),
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

/**
 * AP topics the textbook teaches thinly or not at all, so students know to learn them elsewhere.
 * One entry per topic, plus general skills (labs, science practices) that aren't a single topic.
 */
const gapSchema = z.object({
  /** "missing": the book doesn't teach it; "thin": a short treatment that won't be enough for the exam. */
  coverage: z.enum(['missing', 'thin']),
  /** What the textbook does. */
  book: z.string().min(1),
  /** What students need from somewhere else. */
  learn: z.string().min(1),
});

export const textbookGapsSchema = z.object({
  topics: z.array(gapSchema.extend({ id: z.string().min(1) })).default([]),
  other: z.array(gapSchema.extend({ title: z.string().min(1) })).default([]),
});

export type TextbookGap = z.infer<typeof gapSchema>;

const frqPartSchema = z.object({
  label: z.string().min(1),
  points: z.number().int().positive(),
  cedTopics: z.array(z.string()).min(1, 'tag each part with at least one CED topic'),
  /** Science-practice skill codes from ced.json, e.g. "5.F". */
  skills: z.array(z.string()).default([]),
});

export const pastFrqsSchema = z.object({
  source: z.string().optional(),
  exams: z.array(
    z.object({
      year: z.number().int(),
      questionsUrl: z.url(),
      scoringUrl: z.url(),
      note: z.string().optional(),
      /** "official" when skills come from College Board's commentary or Chief Reader Report. */
      skillsSource: z.enum(['official', 'unofficial']).optional(),
      questions: z.array(
        z.object({
          number: z.number().int().positive(),
          title: z.string().min(1),
          /** Page in the questions PDF where this question starts. */
          page: z.number().int().positive().optional(),
          /** Scoring commentary with sample student responses. */
          samplesUrl: z.url().optional(),
          parts: z.array(frqPartSchema).min(1),
        }),
      ),
    }),
  ),
});

const officialSourceSchema = z.object({
  label: z.string().min(1),
  url: z.url({ protocol: /^https$/ }),
  /** Where it's from or what it is, after the label ("the PDF handed out with the AP exam"). */
  note: z.string().min(1).optional(),
});

/**
 * The reference sheet students get on tests (reference.json): equations, constants, and unit
 * tables, plus a periodic table if periodic-table.json exists. Math is TeX; table cells may hold
 * inline math in $…$. Shown in the Reference panel and on the class's reference page.
 */
export const referenceSchema = z.object({
  title: z.string().min(1),
  /** The official sheet this one copies, always linked next to it. */
  official: officialSourceSchema,
  tables: z
    .array(
      z.union([
        z.object({ title: z.string().min(1), columns: z.array(z.string().min(1)).min(1), rows: z.array(z.array(z.string())).min(1) }),
        z.object({ title: z.string().min(1), math: z.array(z.string().min(1)).min(1) }),
      ]),
    )
    .default([]),
  sections: z
    .array(
      z.object({
        title: z.string().min(1),
        equations: z.array(z.string().min(1)).min(1),
        /** Symbol (TeX) and what it stands for. */
        key: z.array(z.tuple([z.string().min(1), z.string().min(1)])).default([]),
        keyTitle: z.string().min(1).optional(),
        /** Name and value (TeX). */
        constants: z.array(z.tuple([z.string().min(1), z.string().min(1)])).default([]),
      }),
    )
    .min(1),
  /** Where the periodic table's values come from (required when periodic-table.json exists). */
  periodicTable: officialSourceSchema.optional(),
});

export const elementSchema = z.object({
  number: z.number().int().min(1).max(118),
  symbol: z.string().regex(/^[A-Z][a-z]?$/),
  name: z.string().min(1),
  /** As printed on the official table, e.g. "207.2"; null where it shows none. */
  mass: z.string().regex(/^\d+\.\d+$/).nullable(),
});

export type Subject = z.infer<typeof subjectSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type Element = z.infer<typeof elementSchema>;
export type PastFrqExam = z.infer<typeof pastFrqsSchema>['exams'][number];
export type PastFrq = PastFrqExam['questions'][number];
export type Ced = z.infer<typeof cedSchema>;
export type CedUnit = Ced['units'][number];
export type CedTopic = z.infer<typeof cedTopicSchema> & { unitId: string };
export type SciencePractice = z.infer<typeof sciencePracticeSchema>;
export interface Skill {
  id: string;
  text: string;
  practice: SciencePractice;
}
export type Chapter = z.infer<typeof chapterSchema> & {
  /** AP units of this chapter's cedTopics, in CED order. */
  apUnits: string[];
};
export type ClassTest = z.infer<typeof testSchema>;
export type ExamBlueprint = z.infer<typeof examSchema>;
/**
 * done:    every chapter that teaches it is finished this year
 * review:  not done this year, but fully covered in last year's course
 * partial: started this year and/or partly covered last year
 * skipped: its chapters are finished, but the class didn't cover it (progress.json notCovered)
 * null:    new
 */
export type TopicProgress = 'done' | 'review' | 'partial' | 'skipped' | null;

export interface Progress {
  chapters: Set<number>;
  /** Chapters being studied now, in the order listed in progress.json. */
  current: number[];
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
  /** skill id ("5.F") -> skill with its science practice */
  skills: Map<string, Skill>;
  /** chapter number -> chapter */
  chapterMap: Map<number, Chapter>;
  /** topic id -> chapter numbers that teach it (from chapters.json), ascending */
  topicChapters: Map<string, number[]>;
  /** Class progress from progress.json (empty if the file is missing). */
  progress: Progress;
  /** Released AP FRQs with per-part topic tags, newest first (empty if past-frqs.json is missing). */
  pastFrqs: PastFrqExam[];
  /** Topics the textbook covers thinly or not at all (empty if textbook-gaps.json is missing). */
  textbookGaps: {
    topics: Map<string, TextbookGap>;
    other: (TextbookGap & { title: string })[];
  };
  /** The test reference sheet (null if reference.json is missing). */
  reference: Reference | null;
  /** Elements 1–118 in order (empty if periodic-table.json is missing). */
  elements: Element[];
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

function loadSubject(subject: Subject, dataDir: string): SubjectData {
  const dir = join(dataDir, subject.id);
  const cedFile = join(dir, 'ced.json');
  const chaptersFile = join(dir, 'chapters.json');
  const testsFile = join(dir, 'tests.json');

  const ced: Ced = existsSync(cedFile) ? readJson(cedFile, cedSchema) : { verified: false, units: [], sciencePractices: [] };
  if (subject.standardsUrl && ced.units.length === 0) {
    throw new DataError(join(dataDir, 'subjects.json'), `${subject.id}.standardsUrl`, `only for a class with a ced.json (${relative(process.cwd(), cedFile)})`);
  }
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
  const skills = new Map<string, Skill>();
  ced.sciencePractices.forEach((practice, p) => {
    practice.skills.forEach((skill, k) => {
      if (skills.has(skill.id)) {
        throw new DataError(cedFile, `sciencePractices[${p}].skills[${k}].id`, `duplicate skill id "${skill.id}"`);
      }
      skills.set(skill.id, { ...skill, practice });
    });
  });

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

  checkTests(tests, chapterMap, testsFile);

  const progressFile = join(dir, 'progress.json');
  const rawProgress = existsSync(progressFile) ? readJson(progressFile, progressSchema) : progressSchema.parse({});
  rawProgress.chapters.forEach((n, i) => {
    if (!chapterMap.has(n)) throw new DataError(progressFile, `chapters[${i}]`, `chapter ${n} is not in chapters.json`);
  });
  rawProgress.current.forEach((n, i) => {
    const field = `current[${i}]`;
    if (!chapterMap.has(n)) throw new DataError(progressFile, field, `chapter ${n} is not in chapters.json`);
    if (rawProgress.chapters.includes(n)) throw new DataError(progressFile, field, `chapter ${n} is already listed as finished`);
    if (rawProgress.current.indexOf(n) !== i) throw new DataError(progressFile, field, `chapter ${n} is listed twice`);
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
  for (const id of Object.keys(rawProgress.notCovered)) {
    const field = `notCovered.${id}`;
    if (!topics.has(id)) throw new DataError(progressFile, field, `topic "${id}" is not in ced.json`);
    if (!topicChapters.get(id)!.some((n) => rawProgress.chapters.includes(n))) {
      throw new DataError(progressFile, field, `no finished chapter teaches topic "${id}" yet, so there is nothing to override`);
    }
  }
  const progress = deriveProgress(
    new Set(rawProgress.chapters),
    topicChapters,
    lastYear,
    rawProgress.current,
    rawProgress.notCovered,
  );

  const gapsFile = join(dir, 'textbook-gaps.json');
  const rawGaps = existsSync(gapsFile) ? readJson(gapsFile, textbookGapsSchema) : textbookGapsSchema.parse({});
  const gapTopics = new Map<string, TextbookGap>();
  rawGaps.topics.forEach(({ id, ...gap }, i) => {
    const field = `topics[${i}].id`;
    if (!topics.has(id)) throw new DataError(gapsFile, field, `topic "${id}" is not in ced.json`);
    if (gapTopics.has(id)) throw new DataError(gapsFile, field, `topic "${id}" is listed twice`);
    gapTopics.set(id, gap);
  });
  // Keep CED order regardless of the file's order.
  const textbookGaps = {
    topics: new Map([...topics.keys()].filter((id) => gapTopics.has(id)).map((id) => [id, gapTopics.get(id)!])),
    other: rawGaps.other,
  };

  const frqFile = join(dir, 'past-frqs.json');
  const pastFrqs = existsSync(frqFile) ? readJson(frqFile, pastFrqsSchema).exams : [];
  pastFrqs.forEach((exam, e) => {
    exam.questions.forEach((q, i) => {
      q.parts.forEach((part, p) => {
        part.skills.forEach((id, k) => {
          if (!skills.has(id)) {
            throw new DataError(frqFile, `exams[${e}].questions[${i}].parts[${p}].skills[${k}]`, `skill "${id}" is not in ced.json sciencePractices`);
          }
        });
        part.cedTopics.forEach((id, t) => {
          if (!topics.has(id)) {
            throw new DataError(frqFile, `exams[${e}].questions[${i}].parts[${p}].cedTopics[${t}]`, `topic "${id}" is not in ced.json`);
          }
        });
      });
    });
  });
  pastFrqs.sort((a, b) => b.year - a.year);

  const referenceFile = join(dir, 'reference.json');
  const reference = existsSync(referenceFile) ? readJson(referenceFile, referenceSchema) : null;
  const elementsFile = join(dir, 'periodic-table.json');
  const elements = existsSync(elementsFile) ? readJson(elementsFile, z.array(elementSchema)) : [];
  if (elements.length > 0) {
    if (!reference?.periodicTable) throw new DataError(referenceFile, 'periodicTable', 'say where periodic-table.json comes from');
    elements.forEach((e, i) => {
      if (e.number !== i + 1) throw new DataError(elementsFile, `[${i}].number`, `expected ${i + 1} (list every element in order)`);
    });
    if (elements.length !== 118) throw new DataError(elementsFile, '(root)', `lists ${elements.length} elements, not 118`);
  }

  return { subject, ced, chapters, tests, topics, skills, chapterMap, topicChapters, progress, pastFrqs, textbookGaps, reference, elements };
}

/** Cross-checks for tests.json: unique ids, and chapters and sections the class has. */
export function checkTests(tests: ClassTest[], chapterMap: ReadonlyMap<number, Pick<Chapter, 'sections'>>, file: string): void {
  const testIds = new Set<string>();
  tests.forEach((test, i) => {
    if (testIds.has(test.id)) throw new DataError(file, `[${i}].id`, `duplicate test id "${test.id}"`);
    testIds.add(test.id);
    test.chapters.forEach((n, j) => {
      if (!chapterMap.has(n)) throw new DataError(file, `[${i}].chapters[${j}]`, `chapter ${n} is not in chapters.json`);
    });
    const known = test.chapters.flatMap((n) => chapterMap.get(n)!.sections.map((s) => s.id));
    test.sections.forEach((s, j) => {
      if (known.length > 0 && !known.includes(s)) {
        throw new DataError(file, `[${i}].sections[${j}]`, `section "${s}" is not in the test's chapters`);
      }
    });
    if (test.exam) checkExam(test, `[${i}].exam`, chapterMap, file);
  });
}

function checkExam(test: ClassTest, at: string, chapterMap: ReadonlyMap<number, Pick<Chapter, 'sections'>>, file: string): void {
  const exam = test.exam!;
  const ids = new Set<string>();
  exam.sections.forEach((group, g) => {
    const field = `${at}.sections[${g}]`;
    if (ids.has(group.id)) throw new DataError(file, `${field}.id`, `duplicate section id "${group.id}"`);
    ids.add(group.id);
    group.match.chapters.forEach((n, j) => {
      if (!test.chapters.includes(n)) throw new DataError(file, `${field}.match.chapters[${j}]`, `chapter ${n} is not one of the test's chapters (${test.chapters.join(', ')})`);
    });
    const known = group.match.chapters.flatMap((n) => chapterMap.get(n)!.sections.map((s) => s.id));
    group.match.sections.forEach((s, j) => {
      if (known.length > 0 && !known.includes(s)) {
        throw new DataError(file, `${field}.match.sections[${j}]`, `section "${s}" is not in chapter ${group.match.chapters.join(' or ')} in chapters.json`);
      }
      if (test.sections.length > 0 && !test.sections.includes(s)) {
        throw new DataError(file, `${field}.match.sections[${j}]`, `section "${s}" is not one of the test's sections`);
      }
    });
    if (group.maxCalculations !== undefined && group.maxCalculations > group.count) {
      throw new DataError(file, `${field}.maxCalculations`, `is ${group.maxCalculations}, more than the section's count (${group.count})`);
    }
    if (group.minCalculations !== undefined && group.minCalculations > Math.min(group.count, group.maxCalculations ?? group.count)) {
      throw new DataError(file, `${field}.minCalculations`, `is ${group.minCalculations}, more than the section's count or maxCalculations`);
    }
  });
}

/**
 * Combine this year's finished chapters with last year's course. This year's ✓ wins; otherwise a
 * topic fully covered last year is "review"; otherwise any partial coverage is "partial".
 */
export function deriveProgress(
  finished: Set<number>,
  topicChapters: Map<string, number[]>,
  lastYear?: LastYear,
  current: number[] = [],
  notCovered: Record<string, string> = {},
): Progress {
  const progress: Progress = {
    chapters: finished,
    current,
    lastYearCourse: lastYear?.course ?? null,
    topics: new Map(),
    notes: new Map(),
  };
  for (const [id, chs] of topicChapters) {
    const done = chs.filter((n) => finished.has(n));
    const thisYear = done.length === 0 ? null : done.length === chs.length ? 'done' : 'partial';
    const before = lastYear?.covered.includes(id) ? 'full' : lastYear?.partial.includes(id) ? 'partial' : null;
    const skipped = notCovered[id];

    if (skipped !== undefined) {
      // Skipped in class: no checkmark, even if every chapter teaching it is finished.
      progress.topics.set(id, before === 'full' ? 'review' : 'skipped');
      const notes = [`Not covered in class: ${skipped}`];
      if (before) {
        const detail = lastYear!.notes[id];
        notes.push(`${before === 'full' ? 'Covered' : 'Partly covered'} in ${lastYear!.course}${detail ? `: ${detail}` : '.'}`);
      }
      progress.notes.set(id, notes);
      continue;
    }

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
      notes.push(`Started in ${chapterRange(done)}; continues in ${chapterRange(left)}.`);
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

/**
 * All subjects with their data, sorted by `order`. Re-read on every call so dev picks up edits.
 * `dataDir` is for tests, which load fixture subjects.
 */
export function loadRegistry(dataDir = DATA_DIR): Map<string, SubjectData> {
  const subjectsFile = join(dataDir, 'subjects.json');
  const subjects = readJson(subjectsFile, z.array(subjectSchema));
  const registry = new Map<string, SubjectData>();
  [...subjects]
    .sort((a, b) => a.order - b.order)
    .forEach((subject, i) => {
      if (registry.has(subject.id)) throw new DataError(subjectsFile, `[${i}].id`, `duplicate subject "${subject.id}"`);
      registry.set(subject.id, loadSubject(subject, dataDir));
    });
  return registry;
}

export function getSubjectData(subjectId: string): SubjectData {
  const data = loadRegistry().get(subjectId);
  if (!data) throw new Error(`Unknown subject "${subjectId}"`);
  return data;
}
