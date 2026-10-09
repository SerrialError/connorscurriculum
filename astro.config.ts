import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';
import { rehypePlugins, remarkPlugins } from './src/lib/markdown';

// BASE_PATH lets the site live under a sub-path (e.g. GitHub Pages "/<repo>/") without code changes.
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'always',
  integrations: [mdx(), svelte()],
  markdown: {
    processor: unified({ remarkPlugins, rehypePlugins }),
  },
});
