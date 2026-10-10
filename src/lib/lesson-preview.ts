// Renders a lesson body (MDX) to HTML in the browser for the CMS preview pane.
// Uses the same parser and math plugins as the site build, and turns the lesson
// components (Callout, Reveal, YouTube) into the same markup the .astro components emit.
// Anything the real build would reject (bad MDX, unknown components, stray { }) is shown
// inline as a problem box instead, so writers can fix it before saving.
import 'katex/contrib/mhchem';
import type { Element, Root as HastRoot } from 'hast';
import type { Paragraph, PhrasingContent, Root, RootContent } from 'mdast';
import type {} from 'mdast-util-mdx'; // MDX node types on mdast
import type { MdxJsxAttribute, MdxJsxExpressionAttribute, MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { CALLOUT_TYPES, type CalloutType } from './callouts';
import { rehypeMathPunctuation } from './markdown';

type JsxNode = MdxJsxFlowElement | MdxJsxTextElement;

/** A node remark-rehype turns into `<tag class=...>children</tag>` via data.hName. */
function box(tag: string, className: string[], children: RootContent[], props: Record<string, unknown> = {}): RootContent {
  return {
    type: 'blockquote', // any parent type works; hName overrides the tag
    children: children as never,
    data: { hName: tag, hProperties: { className, ...props } },
  };
}

const text = (value: string): PhrasingContent => ({ type: 'text', value });
const para = (className: string[], children: PhrasingContent[]): Paragraph => ({
  type: 'paragraph',
  children,
  data: { hProperties: { className } },
});

function problem(message: string, inline: boolean): RootContent {
  const node = inline
    ? ({ type: 'emphasis', children: [text(`⚠ ${message}`)], data: { hName: 'mark', hProperties: { className: ['preview-problem'] } } } as const)
    : box('div', ['preview-problem'], [para([], [text(`⚠ ${message}`)])]);
  return node as RootContent;
}

function attrs(node: JsxNode): Record<string, string | number | true> {
  const out: Record<string, string | number | true> = {};
  for (const a of node.attributes as (MdxJsxAttribute | MdxJsxExpressionAttribute)[]) {
    if (a.type !== 'mdxJsxAttribute') continue;
    if (a.value == null) out[a.name] = true;
    else if (typeof a.value === 'string') out[a.name] = a.value;
    else out[a.name] = Number.isFinite(Number(a.value.value)) ? Number(a.value.value) : a.value.value;
  }
  return out;
}

function component(node: JsxNode): RootContent {
  const inline = node.type === 'mdxJsxTextElement';
  const a = attrs(node);
  const children = node.children as RootContent[];
  switch (node.name) {
    case 'Callout': {
      const type = String(a.type ?? 'note');
      const label = CALLOUT_TYPES[type as CalloutType];
      if (!label) return problem(`<Callout type="${type}">: type must be note, warning, ap-tip, or not-on-ap`, inline);
      const title = typeof a.title === 'string' ? a.title : label.text;
      return box('aside', ['callout', type], [
        para(['callout-title'], [text(`${label.icon} ${title}`)]),
        box('div', ['callout-body'], children),
      ]);
    }
    case 'Reveal': {
      const label = typeof a.label === 'string' ? a.label : 'Show answer';
      return box('details', ['reveal'], [
        { type: 'paragraph', children: [text(label)], data: { hName: 'summary' } } as Paragraph,
        box('div', ['reveal-body'], children),
      ]);
    }
    case 'YouTube': {
      const id = String(a.id ?? '');
      if (!/^[\w-]{11}$/.test(id)) return problem(`<YouTube id="${id}">: expected an 11-character video id`, inline);
      const start = typeof a.start === 'number' && a.start > 0 ? `?start=${Math.floor(a.start)}` : '';
      const iframe = box('iframe', [], [], {
        src: `https://www.youtube-nocookie.com/embed/${id}${start}`,
        title: typeof a.title === 'string' ? a.title : 'YouTube video',
        allowFullScreen: true,
      });
      return box('figure', ['youtube'], [iframe]);
    }
    default:
      return problem(
        node.name ? `<${node.name}> is not a lesson component (use Callout, Reveal, or YouTube)` : 'Empty <> fragment',
        inline,
      );
  }
}

/** What to put in place of an MDX-only node: undefined keeps it, null drops it. */
function replacement(node: RootContent): RootContent | null | undefined {
  switch (node.type) {
    case 'mdxJsxFlowElement':
    case 'mdxJsxTextElement':
      return component(node);
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
      return problem(
        `{${node.value}} is read as code. Write \\{ and \\} for literal braces, or put them inside \$…\$.`,
        node.type === 'mdxTextExpression',
      );
    case 'mdxjsEsm':
      return null;
    default:
      return undefined;
  }
}

/** Replace MDX-only nodes with plain mdast that remark-rehype understands, innermost first. */
function remarkLessonComponents() {
  const transform = (parent: { children: RootContent[] }) => {
    parent.children = parent.children.flatMap((child) => {
      if ('children' in child) transform(child as { children: RootContent[] });
      const r = replacement(child);
      return r === undefined ? [child] : r === null ? [] : [r];
    });
  };
  return (tree: Root) => transform(tree);
}

export type ImageResolver = (src: string) => string | undefined | Promise<string | undefined>;

/** Point relative image paths (images saved next to the lesson) at the CMS's copy. */
function rehypeResolveImages(resolve?: ImageResolver) {
  return async (tree: HastRoot) => {
    if (!resolve) return;
    const images: Element[] = [];
    visit(tree, 'element', (el: Element) => {
      if (el.tagName === 'img' && typeof el.properties.src === 'string' && !/^(https?:|data:|blob:|\/)/.test(el.properties.src)) images.push(el);
    });
    await Promise.all(
      images.map(async (el) => {
        const url = await resolve(el.properties.src as string);
        if (url) el.properties.src = url;
      }),
    );
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export async function renderLessonPreview(body: string, options: { resolveImage?: ImageResolver } = {}): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkLessonComponents)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeMathPunctuation)
    .use(rehypeResolveImages, options.resolveImage)
    .use(rehypeStringify);
  try {
    return String(await processor.process(body));
  } catch (err) {
    // MDX syntax errors end with their position, e.g. "(3:1-3:10)" = line 3, column 1.
    const e = err as { reason?: string; message: string };
    return `<div class="preview-problem"><p><strong>⚠ This lesson won't build:</strong> ${escapeHtml(e.reason ?? e.message)}</p></div>`;
  }
}
