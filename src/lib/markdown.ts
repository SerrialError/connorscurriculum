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
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const PUNCTUATION = /^[,.;:!?)\]]+/;
const isInlineMath = (node: ElementContent | undefined): node is Element =>
  node?.type === 'element' &&
  node.tagName === 'span' &&
  Array.isArray(node.properties?.className) &&
  node.properties.className.includes('katex');

/**
 * Keep punctuation that directly follows inline math on the same line as the math,
 * so a narrow screen never starts a line with ", water…". Wraps both in <span class="nowrap">.
 */
export function rehypeMathPunctuation() {
  const walk = (parent: Root | Element) => {
    const out: (typeof parent.children)[number][] = [];
    const kids = parent.children;
    for (let i = 0; i < kids.length; i++) {
      const node = kids[i]!;
      const next = kids[i + 1];
      if (isInlineMath(node as ElementContent) && next?.type === 'text') {
        const punct = next.value.match(PUNCTUATION)?.[0];
        if (punct) {
          out.push({
            type: 'element',
            tagName: 'span',
            properties: { className: ['nowrap'] },
            children: [node as ElementContent, { type: 'text', value: punct }],
          });
          next.value = next.value.slice(punct.length);
          continue;
        }
      }
      if (node.type === 'element' && !isInlineMath(node)) walk(node);
      out.push(node);
    }
    parent.children = out as typeof parent.children;
  };
  return (tree: Root) => walk(tree);
}

/**
 * Keep KaTeX's hidden MathML copy (and its TeX source annotation, e.g. "\ce{X(g) -> ...}") out of
 * the search index, so search excerpts show the rendered math once instead of three times.
 */
export function rehypeMathSearchIgnore() {
  // visit() also reaches math inside MDX components such as <Callout>.
  return (tree: Root) =>
    visit(tree, 'element', (node: Element) => {
      const cls = node.properties?.className;
      if (Array.isArray(cls) && cls.includes('katex-mathml')) node.properties['dataPagefindIgnore'] = 'all';
    });
}

export const remarkPlugins = [remarkMath];
export const rehypePlugins = [rehypeKatex, rehypeMathPunctuation, rehypeMathSearchIgnore];

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeMathPunctuation)
  .use(rehypeMathSearchIgnore)
  .use(rehypeStringify);

export async function renderMarkdown(source: string): Promise<string> {
  return String(await processor.process(source));
}

/** For short one-line strings (choices): render and drop the wrapping <p>. */
export async function renderInlineMarkdown(source: string): Promise<string> {
  const html = (await renderMarkdown(source)).trim();
  const m = html.match(/^<p>([\s\S]*)<\/p>$/);
  return m && !m[1]!.includes('<p>') ? m[1]! : html;
}
