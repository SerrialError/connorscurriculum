// Browser entry for /admin/: registers the lesson preview (KaTeX, mhchem, lesson
// components, site styles) and starts Sveltia CMS with the generated config.
import katexCss from 'katex/dist/katex.min.css?inline';
import siteCss from '../styles/global.css?inline';
import { renderLessonPreview } from './lesson-preview';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Immutable = { get(key: string): any; getIn(path: string[]): any; toJS?(): any };
interface PreviewProps {
  entry: Immutable;
  getAsset(path: string): any;
}
interface SveltiaCms {
  React: { createElement: (...args: any[]) => any; useEffect: (fn: () => void | (() => void), deps: unknown[]) => void; useState: <T>(v: T) => [T, (v: T) => void] };
  registerPreviewStyle(css: string, options?: { raw: boolean }): void;
  registerPreviewTemplate(name: string, component: (props: PreviewProps) => unknown): void;
  init(options: { config: unknown }): void;
}

const CMS = (window as unknown as { CMS: SveltiaCms }).CMS;
const config = JSON.parse(document.getElementById('cms-config')!.textContent!) as { collections: { name: string }[] };
const { createElement: h, useEffect, useState } = CMS.React;

const toArray = (v: any): string[] => (v?.toJS ? v.toJS() : Array.isArray(v) ? v : []);

// The preview iframe loads styles from blob: URLs, where "/_astro/font.woff2" would not resolve.
const absoluteUrls = (css: string) => css.replace(/url\((["']?)\/(?!\/)/g, `url($1${location.origin}/`);

CMS.registerPreviewStyle(absoluteUrls(katexCss), { raw: true });
CMS.registerPreviewStyle(absoluteUrls(siteCss), { raw: true });
CMS.registerPreviewStyle(
  `body { padding: 1rem 1.25rem 3rem; }
   .preview-problem { display: block; border: 1px solid var(--bad); background: var(--bad-soft); color: var(--text);
     border-radius: 6px; padding: 0.4rem 0.7rem; margin: 0.75rem 0; }
   mark.preview-problem { display: inline; padding: 0 0.25rem; margin: 0; }
   .preview-problem p { margin: 0; }
   .preview-meta { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.25rem 0 0.5rem; }`,
  { raw: true },
);

async function assetUrl(getAsset: PreviewProps['getAsset'], src: string): Promise<string | undefined> {
  try {
    const asset = await getAsset(src);
    const url = asset?.url ?? asset?.toString?.();
    return typeof url === 'string' && url !== '[object Object]' ? url : undefined;
  } catch {
    return undefined;
  }
}

function LessonPreview({ entry, getAsset }: PreviewProps) {
  const title: string = entry.getIn(['data', 'title']) ?? '';
  const body: string = entry.getIn(['data', 'body']) ?? '';
  const chapter = entry.getIn(['data', 'chapter']);
  const topics = toArray(entry.getIn(['data', 'cedTopics']));
  const authors = toArray(entry.getIn(['data', 'authors'])).filter(Boolean);
  const [html, setHtml] = useState('');

  useEffect(() => {
    let current = true;
    // Short debounce so KaTeX doesn't re-render on every keystroke.
    const timer = setTimeout(() => {
      void renderLessonPreview(body, { resolveImage: (src) => assetUrl(getAsset, src) }).then((out) => {
        if (current) setHtml(out);
      });
    }, 150);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [body]);

  return h(
    'article',
    { className: 'prose' },
    h('h1', null, title || 'Untitled lesson'),
    h(
      'div',
      { className: 'preview-meta' },
      chapter != null && h('span', { className: 'badge' }, `Ch. ${chapter}`),
      ...(topics.length ? topics.map((t) => h('span', { className: 'badge topic', key: t }, t)) : [h('span', { className: 'badge not-ap', key: 'none' }, 'Class only')]),
    ),
    authors.length > 0 && h('p', { className: 'small muted' }, `By ${authors.join(', ')}`),
    h('div', { dangerouslySetInnerHTML: { __html: html } }),
  );
}

for (const collection of config.collections) CMS.registerPreviewTemplate(collection.name, LessonPreview);
CMS.init({ config });
