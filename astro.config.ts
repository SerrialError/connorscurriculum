import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import svelte from '@astrojs/svelte';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { defineConfig } from 'astro/config';
import { rehypePlugins, remarkPlugins } from './src/lib/markdown';
import { pageText, runTogether } from './src/lib/text-joins';

/** Fails the build when a page has words run together, e.g. "yet.See" (see src/lib/text-joins.ts). */
const textJoins: AstroIntegration = {
  name: 'text-joins',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const root = fileURLToPath(dir);
      const pages = (await readdir(root, { recursive: true })).filter((f) => f.endsWith('.html'));
      const found: string[] = [];
      for (const page of pages) {
        const hits = runTogether(pageText(await readFile(join(root, page), 'utf8')));
        if (hits.length) found.push(`  ${page}: ${hits.join(', ')}`);
      }
      if (found.length) throw new Error(`Words run together (add {' '} between the two pieces of text):\n${found.join('\n')}`);
    },
  },
};

// BASE_PATH lets the site live under a sub-path (e.g. GitHub Pages "/<repo>/") without code changes.
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'always',
  integrations: [mdx(), svelte(), textJoins],
  markdown: {
    processor: unified({ remarkPlugins, rehypePlugins }),
  },
  vite: {
    // The /admin/ lesson preview and the 3D viewers import these in the browser. Pre-bundle them at
    // startup so the dev server doesn't re-bundle mid-session and serve stale copies (a blank editor
    // page, or a 3D viewer that never draws).
    optimizeDeps: {
      include: [
        'three',
        'three/examples/jsm/controls/OrbitControls.js',
        'three/examples/jsm/renderers/CSS2DRenderer.js',
        'katex/contrib/mhchem',
        'rehype-katex',
        'rehype-stringify',
        'remark-gfm',
        'remark-math',
        'remark-mdx',
        'remark-parse',
        'remark-rehype',
        'unified',
        'unist-util-visit',
      ],
    },
  },
});
