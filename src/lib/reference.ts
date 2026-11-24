// The test reference sheet (data/<subject>/reference.json): math rendering for its equations and
// tables, at build time only. The periodic table's layout and search are in elements.ts.
import katex from 'katex';

/** TeX to KaTeX HTML. Bad TeX fails the build rather than showing red text on the page. */
export function tex(source: string): string {
  return katex.renderToString(source, { throwOnError: true, output: 'html' });
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A table cell: plain text with optional inline math in $…$. */
export function cell(text: string): string {
  return text
    .split(/(\$[^$]+\$)/)
    .map((part) => (part.startsWith('$') && part.endsWith('$') && part.length > 2 ? tex(part.slice(1, -1)) : escapeHtml(part)))
    .join('');
}

/** What the site's copies change from the official sheets, said under each one. */
export const EQUATION_DIFFERENCES =
  'Same equations and constants as the official sheet, laid out for screens: one equation per line, and the unit tables at the end.';
export const TABLE_DIFFERENCES =
  'Same numbers and masses as the official table. Element names and the metalloid shading are added here.';
