// The practice page's browser history: what each entry shows, and what each action does to the
// history (push an entry, replace this one, or go back to an earlier one). Pure, so every path
// through Back and Forward can be tested; Practice.svelte applies the steps.
//
// The address always says what's on screen (see url.ts):
// - setup: the filters, e.g. ?chapter=7&difficulty=3, whichever way the page was opened.
// - a set or its results: the filters plus start=1 and a seed (or the exact question ids), so a
//   reload, a bookmark, or a shared link reopens the same set.
//
// Starting a set from setup first writes that set's filters into the setup entry, then adds an
// entry for the set, so Back and "← Filters" always return to the filters that made the current
// set. A set opened from a link (?start=1) replaces the link's entry instead, so Back returns to
// the page the link was on, and "← Filters" swaps the set for its filters.
import { setupQuery, wantsStart } from './url';

/** A set's history entry (`history.state`). Setup entries have none: null. */
export interface SetEntry {
  phase: 'session' | 'results';
  /**
   * How many entries above the setup entry this one is: 1 for the set or its results, 2 when
   * reviewing a question from the results, and so on for sets started from the results. 0 when
   * there is no setup entry below (a set opened from a link), so "← Filters" replaces instead.
   */
  depth: number;
  /** A question opened from the results: Back (and "Back to results") return there. */
  reviewing?: boolean;
  /** The set's seed. */
  set: string;
}

export type Entry = SetEntry | null;

/** The screen showing when an action happens. */
export type Screen = 'setup' | SetEntry['phase'];

/** The current set's address and seed. */
export interface CurrentSet {
  query: string;
  id: string;
}

export type Step = { op: 'push' | 'replace'; query: string; entry: Entry } | { op: 'go'; delta: number };

/** The practice entry in `history.state`, or null for a setup entry (or anything else). */
export function readEntry(state: unknown): Entry {
  const s = state as Partial<SetEntry> | null;
  if (!s || (s.phase !== 'session' && s.phase !== 'results') || typeof s.set !== 'string') return null;
  const depth = Number.isInteger(s.depth) && s.depth! > 0 ? s.depth! : 0;
  return { phase: s.phase, depth, ...(s.reviewing ? { reviewing: true } : {}), set: s.set };
}

/** The depth of an entry added above `current`: 0 stays 0 (no setup entry to go back to). */
const above = (current: Entry) => (current?.depth ? current.depth + 1 : 0);

/**
 * The page landed on an entry (first load, reload, Back, Forward), and `opened` is the set the
 * address named, if it could be opened. Returns the entry to show (null: setup) and the steps
 * that make the entry and address agree: a link with no seed gets one, and a set address that
 * can't be opened (or a stray ?start=1) becomes the setup address.
 */
export function land(search: string, current: Entry, opened: CurrentSet | null): { entry: Entry; steps: Step[] } {
  if (!opened) {
    const clean = current !== null || wantsStart(search);
    return { entry: null, steps: clean ? [{ op: 'replace', query: setupQuery(search), entry: null }] : [] };
  }
  if (current && current.set === opened.id && search === opened.query) return { entry: current, steps: [] };
  const entry: SetEntry = { phase: current?.phase ?? 'session', depth: current?.depth ?? 0, set: opened.id };
  if (current?.reviewing) entry.reviewing = true;
  return { entry, steps: [{ op: 'replace', query: opened.query, entry }] };
}

/** The setup screen's filters changed: the address follows, without adding an entry. */
export function syncSetup(search: string, filtersQuery: string): Step[] {
  return search === filtersQuery ? [] : [{ op: 'replace', query: filtersQuery, entry: null }];
}

/**
 * Starting a set (Start, a quick start, Resume, or retry / new set on the results). From setup,
 * the setup entry first takes the filters that made the set (`setupFilters`), then the set goes
 * on top, so Back returns to them. From a set's screens, the new set goes above the current entry,
 * so Back returns to the results it was started from.
 */
export function startSet(from: Screen, current: Entry, setupFilters: string, set: CurrentSet): Step[] {
  if (from === 'setup') {
    return [
      { op: 'replace', query: setupFilters, entry: null },
      { op: 'push', query: set.query, entry: { phase: 'session', depth: 1, set: set.id } },
    ];
  }
  return [{ op: 'push', query: set.query, entry: { phase: 'session', depth: above(current), set: set.id } }];
}

/**
 * "← Filters" / "Change filters": back to the setup entry the set was started from, so Forward
 * returns to the set; or, with none below (a set opened from a link), this entry becomes the
 * setup screen for the set's filters.
 */
export function toSetup(current: Entry, set: CurrentSet): Step[] {
  if (current?.depth) return [{ op: 'go', delta: -current.depth }];
  return [{ op: 'replace', query: setupQuery(set.query), entry: null }];
}

/** End set / See results / Back to results. A question reviewed from the results has its own entry: Back removes it. */
export function toResults(current: Entry, set: CurrentSet): Step[] {
  if (current?.reviewing) return [{ op: 'go', delta: -1 }];
  return [{ op: 'replace', query: set.query, entry: { phase: 'results', depth: current?.depth ?? 0, set: set.id } }];
}

/** Opening a question from the results: an entry of its own, so Back returns to the results. */
export function toReview(current: Entry, set: CurrentSet): Step[] {
  if (current?.reviewing) return [];
  return [{ op: 'push', query: set.query, entry: { phase: 'session', depth: above(current), reviewing: true, set: set.id } }];
}
