// The Lessons page filter: a kind (lesson, notes, review sheet) and words to look for. It lives
// in the address (?kind=notes&q=bohr), so Back, reload, and shared links show the same list.

export interface LessonFilter {
  /** A lesson kind, or "" for every kind. */
  kind: string;
  /** What's typed in the filter box, as typed. */
  q: string;
}

/** One entry in the list, as the filter sees it. */
export interface FilterItem {
  /** The entry's text, already passed through `words` and joined with spaces. */
  text: string;
  kind: string;
  /** A sample page for a later chapter (not counted on the kind chips). */
  sample: boolean;
}

export interface FilterResult {
  /** Whether each item shows, in the same order as the items. */
  shown: boolean[];
  /** How many class pages of each kind match the words: the chip counts. */
  counts: Map<string, number>;
  shownCount: number;
  /** Shown items that are not sample pages. */
  shownClass: number;
}

/** Lower case, accents removed, split at spaces: "Bohr  Modèl" → ["bohr", "model"]. */
export const words = (s: string): string[] =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(Boolean);

/** The filter in a page address. An unknown kind means every kind. */
export function parseLessonFilter(search: string, kinds: readonly string[]): LessonFilter {
  const p = new URLSearchParams(search);
  const kind = p.get('kind') ?? '';
  return { kind: kinds.includes(kind) ? kind : '', q: p.get('q') ?? '' };
}

/** The address query for a filter: "" when nothing is filtered. */
export function lessonFilterQuery(f: LessonFilter): string {
  const p = new URLSearchParams();
  if (f.kind) p.set('kind', f.kind);
  if (f.q.trim()) p.set('q', f.q.trim());
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const isFiltering = (f: LessonFilter): boolean => f.kind !== '' || words(f.q).length > 0;

/** An item shows when it has every word (anywhere in its text) and is of the picked kind. */
export function filterLessons(items: FilterItem[], f: LessonFilter): FilterResult {
  const q = words(f.q);
  const counts = new Map<string, number>();
  const shown: boolean[] = [];
  let shownCount = 0;
  let shownClass = 0;
  for (const item of items) {
    const textOk = q.every((w) => item.text.includes(w));
    if (textOk && !item.sample) {
      counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    }
    const ok = textOk && (!f.kind || item.kind === f.kind);
    shown.push(ok);
    if (ok) {
      shownCount++;
      if (!item.sample) shownClass++;
    }
  }
  return { shown, counts, shownCount, shownClass };
}
