import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { defineCollection, reference } from 'astro:content';
import { file, glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse as parseYaml } from 'yaml';
import { DATA_DIR, loadRegistry, subjectSchema } from './lib/registry';
import { checkTags, expandTopicIds } from './lib/validate';

const ROOT = process.cwd();
const QUESTIONS_DIR = join(ROOT, 'src', 'content', 'questions');

// ---------------------------------------------------------------------------
// Structural collections (from src/data)
// ---------------------------------------------------------------------------

const subjects = defineCollection({
  loader: file('src/data/subjects.json'),
  schema: subjectSchema,
});

/** One entry per CED topic, id "<subject>-<topicId>" (e.g. "apchem-5.4"). */
function cedTopicsLoader(): Loader {
  return {
    name: 'ced-topics',
    load: async ({ store, parseData, watcher }) => {
      const sync = async () => {
        store.clear();
        for (const [subjectId, data] of loadRegistry()) {
          for (const [u, unit] of data.ced.units.entries()) {
            for (const [t, topic] of unit.topics.entries()) {
              const id = `${subjectId}-${topic.id}`;
              const entry = await parseData({
                id,
                data: {
                  subject: subjectId,
                  topicId: topic.id,
                  title: topic.title,
                  unitId: unit.id,
                  unitTitle: unit.title,
                  examWeight: unit.examWeight,
                  order: u * 1000 + t,
                },
                filePath: relative(ROOT, join(DATA_DIR, subjectId, 'ced.json')),
              });
              store.set({ id, data: entry });
            }
          }
        }
      };
      await sync();
      watcher?.add(DATA_DIR);
      watcher?.on('change', (path) => {
        if (path.startsWith(DATA_DIR) && path.endsWith('.json')) void sync();
      });
    },
  };
}

const cedTopics = defineCollection({
  loader: cedTopicsLoader(),
  schema: z.object({
    subject: z.string(),
    topicId: z.string(),
    title: z.string(),
    unitId: z.string(),
    unitTitle: z.string(),
    examWeight: z.string().optional(),
    order: z.number(),
  }),
});

// ---------------------------------------------------------------------------
// Shared tag fields
// ---------------------------------------------------------------------------

const tagShape = {
  subject: reference('subjects'),
  chapter: z.number().int(),
  sections: z.array(z.string()).default([]),
  // Required, but may be empty: [] means "class-only content".
  cedTopics: z.array(reference('cedTopics')),
  authors: z.array(z.string().min(1)).min(1, 'authors needs at least one name'),
};

// ---------------------------------------------------------------------------
// Lessons: src/content/lessons/<subject>/<chapter>-<slug>/index.mdx
// ---------------------------------------------------------------------------

const lessons = defineCollection({
  loader: glob({
    pattern: '**/index.mdx',
    base: './src/content/lessons',
    generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, ''),
  }),
  schema: z.preprocess(
    expandTopicIds,
    z
      .object({
        title: z.string().min(1),
        ...tagShape,
        order: z.number().default(0),
        draft: z.boolean().default(false),
        summary: z.string().optional(),
      })
      .superRefine(checkTags),
  ),
});

// ---------------------------------------------------------------------------
// Questions: src/content/questions/<subject>/<chapter>-<slug>.yaml (a list per file)
// ---------------------------------------------------------------------------

const questionBase = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be lowercase letters, digits, or dashes'),
  ...tagShape,
  difficulty: z.number().int().min(1).max(3),
  prompt: z.string().min(1),
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  explanation: z.string().min(1),
  // Set by the loader from file order; authors do not write this.
  position: z.number().int().default(0),
};

const mcq = z
  .object({
    ...questionBase,
    type: z.literal('mcq'),
    choices: z
      .array(z.object({ id: z.string().regex(/^[a-z]$/, 'choice id must be a single letter'), text: z.string().min(1) }))
      .min(2, 'mcq needs 2–5 choices')
      .max(5, 'mcq needs 2–5 choices'),
    answer: z.string(),
  })
  .superRefine((q, ctx) => {
    const ids = q.choices.map((c) => c.id);
    ids.forEach((id, i) => {
      if (ids.indexOf(id) !== i) ctx.addIssue({ code: 'custom', path: ['choices', i, 'id'], message: `duplicate choice id "${id}"` });
    });
    if (!ids.includes(q.answer)) {
      ctx.addIssue({
        code: 'custom',
        path: ['answer'],
        message: `answer "${q.answer}" is not one of the choice ids (${ids.join(', ')})`,
      });
    }
  });

const frq = z
  .object({
    ...questionBase,
    type: z.literal('frq'),
    parts: z
      .array(
        z.object({
          label: z.string().min(1),
          prompt: z.string().min(1),
          points: z.number().int().positive(),
          scoring: z.array(z.string().min(1)).min(1),
        }),
      )
      .min(1),
  })
  .superRefine((q, ctx) => {
    q.parts.forEach((part, i) => {
      if (part.scoring.length !== part.points) {
        ctx.addIssue({
          code: 'custom',
          path: ['parts', i, 'scoring'],
          message: `part (${part.label}) is worth ${part.points} point(s) but lists ${part.scoring.length} scoring statement(s); list one statement per point`,
        });
      }
    });
  });

const questionSchema = z.preprocess(
  expandTopicIds,
  z.discriminatedUnion('type', [mcq, frq]).superRefine(checkTags),
);

function listYaml(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((d) => d.isFile() && /\.ya?ml$/.test(d.name))
    .map((d) => join(d.parentPath, d.name))
    .sort();
}

/** Each YAML file holds a list of questions; each question becomes one entry keyed by its id. */
function questionsLoader(): Loader {
  return {
    name: 'question-lists',
    load: async ({ store, parseData, watcher }) => {
      const sync = async () => {
        store.clear();
        const seen = new Map<string, string>();
        let position = 0;
        for (const abs of listYaml(QUESTIONS_DIR)) {
          const filePath = relative(ROOT, abs);
          let items: unknown;
          try {
            items = parseYaml(readFileSync(abs, 'utf8'));
          } catch (err) {
            throw new Error(`${filePath}: invalid YAML: ${(err as Error).message}`);
          }
          if (!Array.isArray(items)) throw new Error(`${filePath}: the file must be a YAML list of questions (start each question with "- ")`);
          for (const [i, item] of items.entries()) {
            const id = (item as { id?: unknown })?.id;
            if (typeof id !== 'string' || id === '') throw new Error(`${filePath} → [${i}].id: every question needs a string id`);
            if (seen.has(id)) {
              throw new Error(`${filePath} → [${i}].id: duplicate question id "${id}" (already used in ${seen.get(id)})`);
            }
            seen.set(id, filePath);
            const image = (item as { image?: unknown }).image;
            if (typeof image === 'string' && !existsSync(join(dirname(abs), image))) {
              throw new Error(`${filePath} → ${id}.image: file "${image}" not found next to the YAML file`);
            }
            const data = await parseData({ id, data: { ...(item as Record<string, unknown>), position: position++ }, filePath });
            store.set({ id, data, filePath });
          }
        }
      };
      await sync();
      watcher?.add(QUESTIONS_DIR);
      const onChange = (path: string) => {
        if (path.startsWith(QUESTIONS_DIR) && /\.ya?ml$/.test(path)) void sync();
      };
      watcher?.on('change', onChange);
      watcher?.on('add', onChange);
      watcher?.on('unlink', onChange);
    },
  };
}

const questions = defineCollection({
  loader: questionsLoader(),
  schema: questionSchema,
});

export const collections = { subjects, cedTopics, lessons, questions };
