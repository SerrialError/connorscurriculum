// Practice links on the other pages: every "Start …" button, its wording, and "Pick your own set".
// They are practice addresses (url.ts), so a link names exactly the set the practice page opens.
//
// One rule for every pool (a chapter, a lesson, a topic, a class test): with more than
// DEFAULT_COUNT questions, the main button starts DEFAULT_COUNT random ones (a sensible length for
// one sitting) and a second one starts all of them in order; with DEFAULT_COUNT or fewer, the one
// button starts all of them in order.
import { DEFAULT_COUNT, emptyFilters } from './filters';
import { describeHow } from './labels';
import type { Filters } from './types';
import { filtersToQuery, setToQuery } from './url';
import { plural } from '../text';

/** The pool a link is for, e.g. `{ test: 'ch6-7-test' }` or `{ chapters: [7], sections: ['7.2'] }`. */
export type Pool = Partial<Pick<Filters, 'chapters' | 'sections' | 'test' | 'topics'>>;

export interface PracticeStart {
  /** Starts the set: "?test=ch6-7-test&start=1". */
  query: string;
  /** The set's filters (what a Quick start button starts). */
  filters: Filters;
  /** On a button: "Start 10 random questions", "All 116 in order", "Start all 8 questions". */
  label: string;
  /** In a sentence, as the set is named once it starts: "10 random", "all 116 in order". */
  short: string;
}

function link(pool: Pool, how: Pick<Filters, 'mode' | 'n'>, total: number, label: string): PracticeStart {
  const filters: Filters = { ...emptyFilters(), ...pool, ...how };
  return {
    query: setToQuery({ filters, seed: null, ids: null }),
    filters,
    label,
    short: describeHow(filters, Math.min(filters.n ?? total, total), total),
  };
}

/**
 * The ways to start a set on a pool of `total` questions (see the rule above): `start` is the
 * main button and `all` the second one, null when `start` already is every question.
 * `about` ends the main label: "Start 10 random questions on this lesson".
 */
export function practiceStarts(pool: Pool, total: number, about = ''): { start: PracticeStart; all: PracticeStart | null } {
  const end = about ? ` ${about}` : '';
  const inOrder = { mode: 'all', n: null } as const;
  if (total <= DEFAULT_COUNT) return { start: link(pool, inOrder, total, `Start all ${plural(total, 'question')}${end}`), all: null };
  return {
    start: link(pool, { mode: 'random', n: DEFAULT_COUNT }, total, `Start ${DEFAULT_COUNT} random questions${end}`),
    all: link(pool, inOrder, total, `All ${total} in order`),
  };
}

/** "Weakest topics first" on a pool of `total` questions, for a student with practice history. */
export function weakestStart(pool: Pool, total: number): PracticeStart {
  const label = total <= DEFAULT_COUNT ? `Start all ${total}, weakest topics first` : `Start ${DEFAULT_COUNT} on your weakest topics`;
  return link(pool, { mode: 'weak', n: DEFAULT_COUNT }, total, label);
}

/** "Pick your own set": the setup screen with the pool picked. Nothing starts until Start. */
export const pickQuery = (pool: Pool): string => filtersToQuery({ ...emptyFilters(), ...pool });
