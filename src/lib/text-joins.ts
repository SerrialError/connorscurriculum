// A check on the built pages: sentences run together because a line break between two bits of
// template text collapsed to nothing ("no lessons yet.See the chapter list"). Run on every page
// after the build (astro.config.ts), so a missing {' '} fails the build instead of shipping.

/** Elements whose text isn't prose: code, math, scripts, and anything not shown. */
const SKIP = new Set(['script', 'style', 'svg', 'code', 'pre', 'math', 'textarea', 'template', 'noscript']);

/** Elements that end a line of text, so text on either side of them never runs together. */
const BLOCK = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'details', 'dialog', 'div', 'dl', 'dt',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header',
  'hr', 'legend', 'li', 'main', 'nav', 'ol', 'option', 'p', 'section', 'summary', 'table', 'td', 'th',
  'tr', 'ul',
]);

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** The page's text, with a space wherever a block starts or ends. Code, math, and decoration (aria-hidden) are left out. */
export function pageText(html: string): string {
  const out: string[] = [];
  /** Open elements, each marked if its text is skipped. */
  const stack: { name: string; skip: boolean }[] = [];
  const skipping = () => stack.length > 0 && stack[stack.length - 1]!.skip;
  const tag = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  let last = 0;
  for (const m of html.matchAll(tag)) {
    if (!skipping()) out.push(html.slice(last, m.index));
    last = m.index + m[0].length;
    const [, closing, rawName, attrs = ''] = m;
    if (!rawName) continue; // a comment
    const name = rawName.toLowerCase();
    if (BLOCK.has(name)) out.push(' ');
    if (closing) {
      const i = stack.findLastIndex((e) => e.name === name);
      if (i >= 0) stack.length = i;
      continue;
    }
    if (VOID.has(name) || attrs.endsWith('/')) continue;
    const skip = skipping() || SKIP.has(name) || /\sclass="[^"]*\bkatex\b/.test(attrs) || /\saria-hidden="true"/.test(attrs);
    stack.push({ name, skip });
  }
  if (!skipping()) out.push(html.slice(last));
  return out
    .join('')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/**
 * Places where two sentences or words run together: "yet.See", "Ch. 7,Hard", "notes:Ryan".
 * Abbreviations with a capital after the stop ("e.g.", "U.S.", "a.m.") aren't prose joins and
 * are rare in this site's own copy; anything that is meant to look like this can be wrapped in
 * <code>.
 */
export function runTogether(text: string): string[] {
  return [...text.matchAll(/\S*[a-z][.,;:!?][A-Z]\S*/g)].map((m) => m[0]);
}
