import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cmsConfig } from './cms';
import { hasPastFrqs, hasTests, hasTopics, navKeyFor, searchPlaceholder, subjectNav } from './features';
import { DataError, loadRegistry } from './registry';

// Two made-up classes: "chem" has standards, a test, and past FRQs; "bio" has only chapters.
// Nothing in the registry, nav, search, or editor config should assume AP Chemistry.
const fixtures = join(import.meta.dirname, 'fixtures');
const registry = loadRegistry(join(fixtures, 'two-classes'));
const chem = registry.get('chem')!;
const bio = registry.get('bio')!;

describe('a site with two classes', () => {
  it('loads both, in subjects.json order, and a class needs only chapters.json', () => {
    expect([...registry.keys()]).toEqual(['chem', 'bio']);
    expect(bio.chapters.map((c) => c.title)).toEqual(['Cells']);
    expect([hasTopics(bio), hasTests(bio), hasPastFrqs(bio)]).toEqual([false, false, false]);
    expect([hasTopics(chem), hasTests(chem), hasPastFrqs(chem)]).toEqual([true, true, true]);
    expect(bio.subject.topicsLabel).toBe('Topics');
  });

  it("builds each class's nav from what it has", () => {
    expect(subjectNav(chem).map((n) => n.label)).toEqual(['Home', 'Lessons', 'Practice', 'Tests', 'AP topics', 'Past FRQs']);
    expect(subjectNav(bio).map((n) => n.label)).toEqual(['Home', 'Lessons', 'Practice']);
  });

  it('highlights nav items by route, whatever they are labelled', () => {
    const nav = subjectNav(chem);
    expect(navKeyFor(nav, '')).toBe('home');
    expect(navKeyFor(nav, 'chapters/1/')).toBe('lessons');
    expect(navKeyFor(nav, 'ap/1.1/')).toBe('topics');
    expect(navKeyFor(subjectNav(bio), 'ap/')).toBeNull();
  });

  it('only mentions topics in search when the class has them', () => {
    expect(searchPlaceholder(chem)).toBe('Search lessons, notes, chapters, AP topics…');
    expect(searchPlaceholder(bio)).toBe('Search lessons, notes, chapters…');
    expect(searchPlaceholder()).toBe('Search lessons, notes, chapters…');
  });

  it('gives the editor a topic picker only for a class with standards', () => {
    const fields = (id: string) => cmsConfig(registry).collections.find((c) => c.name === `lessons-${id}`)!.fields.map((f) => f.name);
    expect(fields('chem')).toContain('cedTopics');
    expect(fields('bio')).not.toContain('cedTopics');
  });

  it('asks for standardsName when a class has a ced.json', () => {
    expect(() => loadRegistry(join(fixtures, 'no-standards-name'))).toThrow(DataError);
  });
});
