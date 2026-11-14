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

/** "Ch. 8–9", "Ch. 6, 8", "Ch. 7" */
export function chapterRange(ns: number[]): string {
  const sorted = [...ns].sort((a, b) => a - b);
  const consecutive = sorted.every((n, i) => i === 0 || n === sorted[i - 1]! + 1);
  if (sorted.length > 1 && consecutive) return `Ch. ${sorted[0]}–${sorted.at(-1)}`;
  return `Ch. ${sorted.join(', ')}`;
}
