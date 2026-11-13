// One Markdown + math pipeline shared by MDX lessons (via astro.config.ts) and
// question text (rendered to HTML at build time for the practice island).
import 'katex/contrib/mhchem'; // registers \ce{} and \pu{} on the shared KaTeX instance
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import type { Element, ElementContent, Root } from 'hast';
import type { Root as MdRoot } from 'mdast';
import type { VFile } from 'vfile';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { hasClass, mathText, plainText } from './math-text';

/** Punctuation that belongs to the math next to it: closing marks after it, an opening bracket before it. */
const AFTER = /^[,.;:!?)\]]+/;
const BEFORE = /[([]$/;
const isInlineMath = (node: ElementContent | undefined): node is Element =>
  node?.type === 'element' &&
  node.tagName === 'span' &&
  Array.isArray(node.properties?.className) &&
  node.properties.className.includes('katex');

/** Inline math up to this many characters (as plain text) never breaks across lines. */
export const SHORT_MATH = 20;

/**
 * Keep inline math and the punctuation touching it on one line, so a narrow screen never starts
 * a line with ", water…" or ends one with "(": the math and that punctuation are wrapped in
 * <span class="nowrap">. Short inline math ("n = 3 → 2", "Mg²⁺") also gets class "katex-short",
 * which keeps it on one line; longer math can still wrap between terms.
 */
export function rehypeMathPunctuation() {
  const walk = (parent: Root | Element) => {
    const out: (typeof parent.children)[number][] = [];
    const kids = parent.children;
    const display = parent.type === 'element' && hasClass(parent, 'katex-display');
    for (let i = 0; i < kids.length; i++) {
      const node = kids[i]!;
      if (!isInlineMath(node as ElementContent)) {
        if (node.type === 'element') walk(node);
        out.push(node);
        continue;
      }
      const math = node as Element;
      if (!display && plainText(math).length <= SHORT_MATH) math.properties.className = [...(math.properties.className as string[]), 'katex-short'];
      const prev = out.at(-1);
      const next = kids[i + 1];
      const before = prev?.type === 'text' ? prev.value.match(BEFORE)?.[0] : undefined;
      const after = next?.type === 'text' ? next.value.match(AFTER)?.[0] : undefined;
      if (!before && !after) {
        out.push(math);
        continue;
      }
      if (before && prev?.type === 'text') prev.value = prev.value.slice(0, -before.length);
      if (after && next?.type === 'text') next.value = next.value.slice(after.length);
      const children: ElementContent[] = [math];
      if (before) children.unshift({ type: 'text', value: before });
      if (after) children.push({ type: 'text', value: after });
      out.push({ type: 'element', tagName: 'span', properties: { className: ['nowrap'] }, children });
    }
    parent.children = out as typeof parent.children;
  };
  return (tree: Root) => walk(tree);
}

/**
 * Search sees math as plain text. KaTeX writes each formula twice (a MathML copy for screen
 * readers, and HTML for the eye, which also has layout-only glyphs such as mhchem's invisible "X"),
 * so search excerpts showed "X(g)XX+(g)+eX−". Both copies are kept out of the Pagefind index and a
 * hidden plain-text copy ("X(g) → X⁺(g) + e⁻") is indexed instead. It has the `hidden` attribute,
 * so browsers and screen readers skip it.
 */
export function rehypeMathSearchText() {
  // visit() also reaches math inside MDX components such as <Callout>.
  return (tree: Root) =>
    visit(tree, 'element', (node: Element) => {
      if (!hasClass(node, 'katex')) return;
      const math = node.children.find((k): k is Element => k.type === 'element' && hasClass(k, 'katex-mathml'));
      if (!math) return;
      for (const k of node.children) {
        if (k.type === 'element' && (hasClass(k, 'katex-mathml') || hasClass(k, 'katex-html'))) k.properties['dataPagefindIgnore'] = 'all';
      }
      node.children.push({
        type: 'element',
        tagName: 'span',
        properties: { className: ['katex-text'], hidden: true },
        children: [{ type: 'text', value: mathText(math) }],
      });
      return 'skip';
    });
}

/**
 * A paragraph that is only `$$…$$` (on one line) is display math. remark-math reads it as inline
 * math, which shrinks fractions to text size; question explanations write their worked steps
 * this way.
 */
export function remarkDisplayMathParagraphs() {
  return (tree: MdRoot, file: VFile) => {
    const source = String(file.value ?? '');
    visit(tree, 'paragraph', (node, i, parent) => {
      const only = node.children.length === 1 ? node.children[0] : undefined;
      const start = only?.position?.start.offset;
      if (!parent || i === undefined || only?.type !== 'inlineMath' || start === undefined) return;
      if (!source.startsWith('$$', start)) return;
      parent.children[i] = {
        type: 'math',
        value: only.value,
        position: node.position,
        data: {
          hName: 'pre',
          hChildren: [{ type: 'element', tagName: 'code', properties: { className: ['language-math', 'math-display'] }, children: [{ type: 'text', value: only.value }] }],
        },
      };
    });
  };
}

export const remarkPlugins = [remarkMath, remarkDisplayMathParagraphs];
export const rehypePlugins = [rehypeKatex, rehypeMathPunctuation, rehypeMathSearchText];

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDisplayMathParagraphs)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeMathPunctuation)
  .use(rehypeMathSearchText)
  .use(rehypeStringify);

/** Markdown as one line of plain text, math included (for previews such as the results list). */
export async function renderPlainText(source: string): Promise<string> {
  const tree = await processor.run(processor.parse(source));
  return plainText(tree as Root);
}

export async function renderMarkdown(source: string): Promise<string> {
  return String(await processor.process(source));
}

/** For short one-line strings (choices): render and drop the wrapping <p>. */
export async function renderInlineMarkdown(source: string): Promise<string> {
  const html = (await renderMarkdown(source)).trim();
  const m = html.match(/^<p>([\s\S]*)<\/p>$/);
  return m && !m[1]!.includes('<p>') ? m[1]! : html;
}
