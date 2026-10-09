// One Markdown + math pipeline shared by MDX lessons (via astro.config.ts) and
// question text (rendered to HTML at build time for the practice island).
import 'katex/contrib/mhchem'; // registers \ce{} and \pu{} on the shared KaTeX instance
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

export const remarkPlugins = [remarkMath];
export const rehypePlugins = [rehypeKatex];

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
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
