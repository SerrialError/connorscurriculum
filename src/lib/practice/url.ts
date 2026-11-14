// Practice addresses: the filters, and a set made from them.
//
// Filters: ?chapter=14,15&test=ch14-test&unit=5&topic=5.1,5.2&difficulty=1,2&type=mcq&mode=all&n=5
// `mode` and `n` are written only when they differ from the defaults (shuffled, 10 questions);
// `n=all` means every matching question. Lists are written sorted, so the same filters always
// give the same address, whatever order they were picked in.
//
// A set: while a set is on screen the address names it, so reloading, bookmarking, or sharing the
// link reopens the same set:
//   ?chapter=7&difficulty=3&start=1&seed=k3x9a0          the filters that made it, plus a seed
//   ?chapter=7&start=1&seed=k3x9a0&ids=q1,q7,q9          exact questions (retrying the missed ones)
// The seed fixes the shuffle, so the same link gives the same questions (except "weakest first",
// which depends on the student's own answers). It also names this attempt, so a reload finds the
// answers saved for it. The setup screen's address is the same minus start/seed/ids: the filters
// that produced the set, which is where "← Filters" returns.
import { DEFAULT_COUNT, DEFAULT_MODE, MAX_COUNT, emptyFilters } from './filters';
import type { Filters } from './types';

const list = (v: string | null) => [...new Set(v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])];
const byNumber = (a: number, b: number) => a - b;
const byId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function parseFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  const f = emptyFilters();
  f.chapters = list(p.get('chapter')).map(Number).filter((n) => Number.isInteger(n));
  f.test = p.get('test') || null;
  f.units = list(p.get('unit'));
  f.topics = list(p.get('topic'));
  f.difficulty = list(p.get('difficulty')).map(Number).filter((d) => d >= 1 && d <= 3);
  const type = p.get('type');
  f.type = type === 'mcq' || type === 'frq' ? type : null;
  const mode = p.get('mode');
  f.mode = mode === 'all' || mode === 'random' || mode === 'weak' ? mode : DEFAULT_MODE;
  const rawN = p.get('n');
  const n = Number(rawN);
  if (rawN === 'all') f.n = null;
  else if (rawN && Number.isInteger(n) && n > 0) f.n = Math.min(n, MAX_COUNT);
  else f.n = DEFAULT_COUNT;
  return f;
}

export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.chapters.length) p.set('chapter', [...f.chapters].sort(byNumber).join(','));
  if (f.test) p.set('test', f.test);
  if (f.units.length) p.set('unit', [...f.units].sort(byId).join(','));
  if (f.topics.length) p.set('topic', [...f.topics].sort(byId).join(','));
  if (f.difficulty.length) p.set('difficulty', [...f.difficulty].sort(byNumber).join(','));
  if (f.type) p.set('type', f.type);
  if (f.mode !== DEFAULT_MODE) p.set('mode', f.mode);
  if (f.n !== DEFAULT_COUNT) p.set('n', f.n === null ? 'all' : String(f.n));
  return toSearch(p);
}

const toSearch = (p: URLSearchParams) => {
  const s = p.toString().replaceAll('%2C', ',');
  return s ? `?${s}` : '';
};

/** Practice filters for one AP topic. */
export const topicQuery = (topic: string): string => filtersToQuery({ ...emptyFilters(), topics: [topic] });

/** `?start=1` on a practice link starts the set right away instead of showing the setup screen. */
export function wantsStart(search: string): boolean {
  const v = new URLSearchParams(search).get('start');
  return v !== null && v !== '0' && v !== 'false';
}

/** A set's seed as it may appear in an address or in storage. */
export const isSeed = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9]{1,16}$/i.test(s);

export interface SetSpec {
  filters: Filters;
  /** Null for a link that asks to start a set (?start=1) but has no seed yet. */
  seed: string | null;
  /** The exact questions, in order, or null to pick them from the filters with the seed. */
  ids: string[] | null;
}

/** The set a URL names, or null for the setup screen. */
export function parseSet(search: string): SetSpec | null {
  if (!wantsStart(search)) return null;
  const p = new URLSearchParams(search);
  const ids = list(p.get('ids'));
  const seed = p.get('seed');
  return {
    filters: parseFilters(search),
    seed: isSeed(seed) ? seed : null,
    ids: ids.length ? ids : null,
  };
}

export function setToQuery(spec: SetSpec): string {
  const p = new URLSearchParams(filtersToQuery(spec.filters));
  p.set('start', '1');
  if (spec.seed) p.set('seed', spec.seed);
  if (spec.ids) p.set('ids', spec.ids.join(','));
  return toSearch(p);
}

/** The setup screen's address for any practice URL: its filters alone. */
export const setupQuery = (search: string): string => filtersToQuery(parseFilters(search));
