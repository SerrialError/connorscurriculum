// Sets saved in localStorage, so a reload, Back/Forward, or "Resume" returns to the same set with
// its answers. Pure functions; the practice island does the reading and writing.
import { isSeed, parseFilters, parseSet, setToQuery, wantsStart } from './url';

/** The answers given so far in a set, by question id. */
export interface Answers {
  picks: Record<string, string>;
  checked: Record<string, boolean>;
  /** FRQ: which parts' scoring is shown. */
  revealed: Record<string, boolean[]>;
  /** FRQ: marks[part][point], true when the student gave themselves that point. */
  marks: Record<string, boolean[][]>;
  /** FRQ: "Done marking" pressed. */
  finished: Record<string, boolean>;
}

export interface SavedSet extends Answers {
  /** The set's seed, which names this attempt in the URL and in history entries. */
  id: string;
  /** "Chapters 6–7 Test · 10 random" */
  label: string;
  /** e.g. why "weakest first" is random for now. */
  note: string;
  /** The set's URL query (…&start=1&seed=…). */
  query: string;
  ids: string[];
  index: number;
  phase: 'session' | 'results';
}

/** How many sets are kept: enough for Back from a retry to reach the earlier sets' results. */
export const MAX_SAVED = 5;


/**
 * The usable saved sets from storage, newest first: any whose questions no longer all exist are
 * dropped, and sets saved by older versions (no id or label, or a query without start/seed) are
 * brought up to date.
 */
export function readSavedSets(raw: unknown, questionIds: ReadonlySet<string>): SavedSet[] {
  const list: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.flatMap((x, i) => {
    const s = x as Partial<SavedSet> | null;
    if (!s || !Array.isArray(s.ids) || s.ids.length === 0 || !s.ids.every((id) => questionIds.has(id))) return [];
    const query = typeof s.query === 'string' ? s.query : '';
    const id = isSeed(s.id) ? s.id : `saved${i}`;
    return [
      {
        id,
        label: s.label ?? '',
        note: s.note ?? '',
        query: wantsStart(query) && s.id === id ? query : setToQuery({ filters: parseFilters(query), exam: parseSet(query)?.exam ?? false, seed: id, ids: s.ids }),
        ids: s.ids,
        index: Math.min(Math.max(0, Number(s.index) || 0), s.ids.length - 1),
        phase: s.phase === 'results' ? 'results' : 'session',
        picks: s.picks ?? {},
        checked: s.checked ?? {},
        revealed: s.revealed ?? {},
        marks: s.marks ?? {},
        finished: s.finished ?? {},
      },
    ];
  });
}

/** `saved` first, replacing any older copy of the same set, keeping at most MAX_SAVED. */
export const withSaved = (sets: SavedSet[], saved: SavedSet): SavedSet[] =>
  [saved, ...sets.filter((s) => s.id !== saved.id)].slice(0, MAX_SAVED);

/** Questions answered so far: checked or marked, or in a practice exam not yet submitted, picked. */
export function answeredIn(s: Answers & { ids: string[]; query: string }): number {
  const taking = parseSet(s.query)?.exam && !Object.values(s.checked).some(Boolean);
  return s.ids.filter((id) => s.checked[id] || s.finished[id] || (taking && s.picks[id])).length;
}

/**
 * The set to offer under "Unfinished set": the newest one, if it was started (something
 * answered) and not finished. A set left with nothing answered isn't worth a banner.
 */
export function resumable(sets: SavedSet[]): SavedSet | null {
  const s = sets[0];
  if (!s || s.phase !== 'session') return null;
  const n = answeredIn(s);
  return n > 0 && n < s.ids.length ? s : null;
}
