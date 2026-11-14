// Small text helpers shared by pages and components.

/** "1 question", "3 questions" */
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** At most `max` characters, cut at a word boundary where possible and ending in "…". */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space >= max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Sorts ids like topics and sections in reading order: "5.2" before "5.10". */
export const byId = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true });

/**
 * "Ch. 8–9", "Ch. 6, 8", "Ch. 7". `long` spells it out ("Chapters 8–9", "Chapter 7"); `nbsp`
 * joins the word and the first number with a no-break space, so a line never ends after "Ch.".
 */
export function chapterRange(ns: number[], { long = false, nbsp = false } = {}): string {
  const sorted = [...ns].sort((a, b) => a - b);
  const consecutive = sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1);
  const numbers = sorted.length > 1 && consecutive ? `${sorted[0]}–${sorted.at(-1)}` : sorted.join(', ');
  const word = long ? (sorted.length > 1 ? 'Chapters' : 'Chapter') : 'Ch.';
  return `${word}${nbsp ? '\u00a0' : ' '}${numbers}`;
}
