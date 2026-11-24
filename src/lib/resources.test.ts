import { describe, expect, it } from 'vitest';
import { groupResources, resourceMeta, siteName, type Resource } from './resources';

const r = (kind: Resource['kind'], title: string, url: string, by: string, minutes?: number): Resource => ({
  kind,
  title,
  url,
  by,
  minutes,
  why: 'x',
});

describe('resources', () => {
  it('names the common sites and falls back to the host', () => {
    expect(siteName('https://www.youtube.com/watch?v=abc')).toBe('YouTube');
    expect(siteName('https://www.khanacademy.org/science/x')).toBe('Khan Academy');
    expect(siteName('https://phet.colorado.edu/en/simulations/molecule-shapes')).toBe('PhET');
    expect(siteName('https://chem.libretexts.org/a')).toBe('chem.libretexts.org');
  });

  it('shows who made it, how long it is, and the site, without repeating the site', () => {
    expect(resourceMeta(r('video', 'VSEPR', 'https://www.youtube.com/watch?v=a', 'Jeremy Krug', 18))).toBe('Jeremy Krug · 18 min · YouTube');
    expect(resourceMeta(r('practice', 'VSEPR', 'https://www.khanacademy.org/e/vsepr', 'Khan Academy'))).toBe('Khan Academy');
  });

  it('groups in watch, try, practice order and keeps the order within a group', () => {
    const groups = groupResources([
      r('practice', 'P1', 'https://a.org', 'A'),
      r('video', 'V1', 'https://a.org', 'A'),
      r('simulation', 'S1', 'https://a.org', 'A'),
      r('video', 'V2', 'https://a.org', 'A'),
    ]);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.title)])).toEqual([
      ['Watch', ['V1', 'V2']],
      ['Try it yourself', ['S1']],
      ['Practice', ['P1']],
    ]);
  });
});
