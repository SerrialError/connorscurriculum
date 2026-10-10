import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderLessonPreview } from './lesson-preview';

const LESSONS = join(process.cwd(), 'src', 'content', 'lessons', 'apchem');
const bodyOf = (file: string) => readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');

describe('renderLessonPreview', () => {
  for (const dir of readdirSync(LESSONS)) {
    it(`renders ${dir} without problems`, async () => {
      const html = await renderLessonPreview(bodyOf(join(LESSONS, dir, 'index.mdx')));
      expect(html).not.toContain('preview-problem');
      expect(html).not.toContain('katex-error');
      expect(html).toContain('class="katex"');
      expect(html).toContain('class="callout');
    });
  }

  it('renders callouts, reveals, and videos like the site components', async () => {
    const html = await renderLessonPreview(
      [
        '<Callout type="ap-tip" title="Heads up">',
        'Rate is $k[\\ce{A}]$.',
        '</Callout>',
        '',
        '<Reveal label="Answer">',
        '',
        '<Callout type="warning">Nested</Callout>',
        '',
        '</Reveal>',
        '',
        '<YouTube id="wYqQCojggyM" start={30} />',
      ].join('\n'),
    );
    expect(html).toMatch(/<aside class="callout ap-tip">\s*<p class="callout-title">★ Heads up<\/p>\s*<div class="callout-body">/);
    expect(html).toMatch(/<details class="reveal">\s*<summary>Answer<\/summary>\s*<div class="reveal-body">[\s\S]*class="callout warning"/);
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/wYqQCojggyM?start=30"');
    expect(html).not.toContain('preview-problem');
  });

  it('flags what the build would reject', async () => {
    expect(await renderLessonPreview('<Callout type="tip">x</Callout>')).toContain('type must be note, warning, ap-tip, or not-on-ap');
    expect(await renderLessonPreview('<YouTube id="nope" />')).toContain('expected an 11-character video id');
    expect(await renderLessonPreview('<Chart />')).toContain('&#x3C;Chart> is not a lesson component');
    expect(await renderLessonPreview('a set {1, 2} here')).toContain('is read as code');
  });

  it('reports MDX syntax errors with a line number', async () => {
    const html = await renderLessonPreview('ok\n\n<Callout>\nnever closed');
    expect(html).toMatch(/won't build:.*\(3:1-/);
  });

  it('resolves relative image paths through the CMS', async () => {
    const html = await renderLessonPreview('![graph](./a.png) ![web](https://x.org/b.png)', {
      resolveImage: async (src) => `blob:${src}`,
    });
    expect(html).toContain('src="blob:./a.png"');
    expect(html).toContain('src="https://x.org/b.png"');
  });
});
