// Plain-text versions of rendered math, for places that can't show KaTeX: search excerpts and
// one-line question previews. Built from KaTeX's MathML (not its HTML, which contains layout-only
// glyphs such as mhchem's invisible "X" placeholders, and not the TeX source).
import type { Element, ElementContent, Root } from 'hast';

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '−': '⁻', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', '∘': '°', '°': '°',
};
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '−': '₋', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
};
/** Operators written with a space on each side ("n = 2", "A → B"). */
const SPACED = new Set(['=', '→', '⟶', '←', '⇌', '⇄', '↔', '⇒', '≈', '≠', '≤', '≥', '<', '>', '×', '÷', '±', '+', '−', '∝', '≡']);
/** "+" and "−" right after one of these (or at the start) are signs, not operators: "= −92". */
const BEFORE_SIGN = /(^|[=→⟶←⇌⇄↔⇒≈≠≤≥<>×÷±+−(,])\s*$/;

/** Superscript or subscript a script: Unicode when every character has a form, else "^x" / "_(xy)". */
function script(text: string, map: Record<string, string>, mark: string): string {
  const t = text.replace(/\u0000/g, '').trim();
  if (!t) return '';
  const chars = [...t];
  if (chars.every((c) => map[c])) return chars.map((c) => map[c]).join('');
  return mark + (chars.length > 1 && /[^\p{L}\p{N}.]/u.test(t) ? `(${t})` : t);
}

/** Wrap a fraction part in parentheses unless it's a single number or word. */
const group = (t: string) => (/^[\p{L}\p{N}.°]+$/u.test(t) ? t : `(${t})`);

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type !== 'element') return '';
  const kids = node.children;
  const at = (i: number) => (kids.filter((k) => k.type === 'element')[i] as Element | undefined);
  const of = (i: number) => {
    const k = at(i);
    return k ? textOf(k).trim() : '';
  };
  switch (node.tagName) {
    case 'annotation':
    case 'annotation-xml':
    case 'mphantom':
      return '';
    case 'mspace': {
      const w = parseFloat(String(node.properties?.width ?? '0'));
      return w >= 0.25 ? ' ' : '';
    }
    case 'mo': {
      const op = kids.map(textOf).join('').trim();
      return SPACED.has(op) ? `\u0000${op}\u0000` : op;
    }
    case 'msup':
      return of(0) + script(of(1), SUP, '^');
    case 'msub':
      return of(0) + script(of(1), SUB, '_');
    case 'msubsup':
      return of(0) + script(of(1), SUB, '_') + script(of(2), SUP, '^');
    case 'mfrac':
      return `${group(of(0))}/${group(of(1))}`;
    case 'msqrt':
      return `√${group(kids.map(textOf).join('').trim())}`;
    case 'mroot':
      return `${script(of(1), SUP, '^')}√${group(of(0))}`;
    // \overset, \underbrace, and mhchem arrows with text above: keep the base.
    case 'mover':
    case 'munder':
    case 'munderover':
      return of(0);
    case 'mtr':
      return kids.map(textOf).join(' ').trim() + '; ';
    case 'mtd':
      return kids.map(textOf).join('') + ' ';
    default:
      return kids.map(textOf).join('');
  }
}

/** Resolve operator markers into spaced operators or signs, and tidy spacing. */
function finish(raw: string): string {
  let out = '';
  for (const piece of raw.split('\u0000')) {
    if (SPACED.has(piece) && (piece === '+' || piece === '−') && BEFORE_SIGN.test(out)) out += piece;
    else if (SPACED.has(piece)) out = `${out.trimEnd()} ${piece} `;
    else out += piece;
  }
  return out
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+([),;])/g, '$1')
    .replace(/;\s*$/, '')
    .trim();
}

/** Plain text for a KaTeX <math> element (or any element containing one). */
export function mathText(math: Element): string {
  return finish(textOf(math));
}

export const hasClass = (n: Element, cls: string) =>
  Array.isArray(n.properties?.className) && n.properties.className.includes(cls);

const BLOCK = /^(p|div|li|h[1-6]|tr|td|th|br|ul|ol|table|blockquote|pre|figure|figcaption)$/;

/**
 * Plain text of a rendered HTML tree, with math written out by mathText (for one-line previews).
 * A table becomes "(table)": its cells run together on one line would read as a list of numbers.
 */
export function plainText(node: Root | ElementContent): string {
  const walk = (n: Root | ElementContent): string => {
    if (n.type === 'text') return n.value;
    if (n.type === 'root') return n.children.map((k) => walk(k as ElementContent)).join('');
    if (n.type !== 'element') return '';
    if (hasClass(n, 'katex')) {
      const math = n.children.find((k): k is Element => k.type === 'element' && hasClass(k, 'katex-mathml'));
      return math ? mathText(math) : '';
    }
    if (n.tagName === 'script' || n.tagName === 'style') return '';
    if (n.tagName === 'table') return ' (table) ';
    const inner = n.children.map(walk).join('');
    return BLOCK.test(n.tagName) ? ` ${inner} ` : inner;
  };
  return walk(node)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .trim();
}
