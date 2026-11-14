// What each class has, and the navigation and search wording that follow from it. A class
// without standards (ced.json), class tests, or past FRQs gets no nav item, pages, or search
// hint for them, so nothing here assumes AP Chemistry.
import type { SubjectData } from './registry';

export const hasTopics = (d: SubjectData): boolean => d.topics.size > 0;
export const hasTests = (d: SubjectData): boolean => d.tests.length > 0;
export const hasPastFrqs = (d: SubjectData): boolean => d.pastFrqs.length > 0;

export type NavKey = 'home' | 'lessons' | 'practice' | 'tests' | 'topics' | 'frqs';

export interface NavItem {
  key: NavKey;
  /** Path inside the class, e.g. "lessons/" ("" for the class home). */
  path: string;
  label: string;
  /** Shorter label for phones. */
  short?: string;
  /** Other paths whose pages belong to this item (Lessons owns the chapter pages). */
  also?: string[];
}

/** The class nav: Home, Lessons, Practice, then what this class has. */
export function subjectNav(d: SubjectData): NavItem[] {
  const items: (NavItem | false)[] = [
    { key: 'home', path: '', label: 'Home' },
    { key: 'lessons', path: 'lessons/', label: 'Lessons', also: ['chapters/'] },
    { key: 'practice', path: 'practice/', label: 'Practice' },
    hasTests(d) && { key: 'tests', path: 'tests/', label: 'Tests' },
    hasTopics(d) && { key: 'topics', path: 'ap/', label: d.subject.topicsLabel },
    hasPastFrqs(d) && { key: 'frqs', path: 'frqs/', label: 'Past FRQs', short: 'FRQs' },
  ];
  return items.filter((n) => n !== false);
}

/** The nav item a page belongs to, from its path inside the class ("" is the class home). */
export function navKeyFor(items: NavItem[], path: string): NavKey | null {
  const owns = (n: NavItem) => (n.path === '' ? path === '' : [n.path, ...(n.also ?? [])].some((p) => path.startsWith(p)));
  return items.find(owns)?.key ?? null;
}

/** The search box's hint: what can be found (the dialog's title or the page says in which class). */
export function searchPlaceholder(d?: SubjectData): string {
  return `Search lessons, notes, chapters${d && hasTopics(d) ? `, ${d.subject.topicsLabel}` : ''}…`;
}
