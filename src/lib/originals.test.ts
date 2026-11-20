import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { isImage, isPdf, originalPath } from './originals';

const LESSONS = join(process.cwd(), 'src', 'content', 'lessons');

/** Every lesson's id ("apchem/08-notes-jaya") and its frontmatter "originals". */
function lessonOriginals(): { id: string; originals: { file: string }[] }[] {
  return readdirSync(LESSONS, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('index.mdx'))
    .map((f) => {
      const front = /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(LESSONS, f), 'utf8'))?.[1] ?? '';
      return { id: f.replace(/\/index\.mdx$/, ''), originals: parse(front)?.originals ?? [] };
    });
}

describe('originals', () => {
  it('resolves paths relative to the lesson folder, including a shared file next door', () => {
    expect(originalPath('apchem/07-notes-jaya', 'originals/a.jpg')).toBe('/src/content/lessons/apchem/07-notes-jaya/originals/a.jpg');
    expect(originalPath('apchem/07-notes-jaya', '../06-notes-jaya/originals/a.jpg')).toBe('/src/content/lessons/apchem/06-notes-jaya/originals/a.jpg');
  });

  it('points every lesson original at an image or PDF that exists', () => {
    const all = lessonOriginals().flatMap((l) => l.originals.map((o) => ({ id: l.id, file: o.file })));
    expect(all.length).toBeGreaterThan(0);
    for (const { id, file } of all) {
      expect(isImage(file) || isPdf(file), `${id}: ${file}`).toBe(true);
      expect(existsSync(join(process.cwd(), originalPath(id, file))), `${id}: ${file}`).toBe(true);
    }
  });

  it('gives every classmate notes page its originals', () => {
    const notes = lessonOriginals().filter((l) => /\/\d\d-notes-/.test(l.id));
    for (const l of notes) expect(l.originals.length, l.id).toBeGreaterThan(0);
  });
});
