// Search result tidying, kept separate from the Search component so it can be unit tested.

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');

/**
 * Pagefind excerpts often start with the page's own heading, which the result already shows as
 * its title ("1.7 Periodic Trends. 1.7 Periodic Trends …"). Drop the title (or the end of it, when
 * the excerpt starts mid-heading) from the start of the excerpt. `html` is Pagefind's excerpt:
 * escaped text with <mark> tags.
 */
export function trimTitle(html: string, title: string): string {
  // Plain text of the excerpt, and for each character the index in `html` just after it.
  let text = '';
  const ends: number[] = [];
  for (let i = 0; i < html.length; ) {
    if (html[i] === '<') {
      const close = html.indexOf('>', i);
      if (close === -1) break;
      i = close + 1;
      continue;
    }
    if (html[i] === '&') {
      const semi = html.indexOf(';', i);
      if (semi !== -1 && semi - i <= 8) {
        text += ' ';
        i = semi + 1;
        ends.push(i);
        continue;
      }
    }
    text += html[i];
    i++;
    ends.push(i);
  }
  const t = norm(title.trim());
  const start = norm(text);
  if (t.length === 0 || text.length !== start.length) return html; // only plain single spaces handled
  // The whole title, or the tail of it starting at a word (at least two words long).
  const candidates = [t, ...[...t.matchAll(/ (?=\S)/g)].map((m) => t.slice(m.index! + 1)).filter((s) => s.includes(' '))];
  const hit = candidates.find((c) => start.startsWith(c) && /^($|[.:;,!?]?\s)/.test(start.slice(c.length)));
  if (!hit) return html;
  const cut = ends[hit.length - 1]!;
  // Skip the ". " Pagefind puts between blocks, and a </mark> that closed a highlighted title word
  // (Pagefind highlights the punctuation with the word: "<mark>Trends.</mark>").
  const rest = html.slice(cut).replace(/^[.:;,!?]?(?:<\/mark>)?[.:;,!?]?\s*/, '');
  if (!rest.trim()) return html;
  return rest;
}

const letters = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Pagefind sometimes matches a query to a much shorter word ("xyzzy" highlights "X"). A result
 * counts as a real match when some highlighted word starts with the first three letters of a query
 * word (the whole word if it is shorter). Excerpts with no highlights are kept: the match may be in
 * the title or metadata.
 */
export function isRealMatch(query: string, excerptHtml: string): boolean {
  const marks = [...excerptHtml.matchAll(/<mark>([^<]*)<\/mark>/g)].map((m) => letters(m[1]!)).filter(Boolean);
  if (marks.length === 0) return true;
  const words = query.split(/\s+/).map(letters).filter(Boolean);
  return words.some((w) => {
    const head = w.slice(0, 3);
    return marks.some((m) => m.startsWith(head));
  });
}
