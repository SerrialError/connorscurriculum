// The question YAML files as plain data, for tests that check the real questions (no Astro needed).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export const QUESTIONS_DIR = join(process.cwd(), 'src', 'content', 'questions');

export interface QuestionFileEntry {
  id: string;
  type: 'mcq' | 'frq';
  subject: string;
  chapter: number;
  sections?: string[];
  calculation?: boolean;
  difficulty: number;
  /** As written in the YAML: one group or a list. */
  group?: string | string[];
  prompt: string;
  choices?: { id: string; text: string }[];
  /** FRQ parts. */
  parts?: { prompt: string }[];
  answer?: string;
}

/** Every question in every YAML file under src/content/questions. */
export function readQuestionFiles(): QuestionFileEntry[] {
  return readdirSync(QUESTIONS_DIR, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) => parse(readFileSync(join(QUESTIONS_DIR, f), 'utf8')) as QuestionFileEntry[]);
}
