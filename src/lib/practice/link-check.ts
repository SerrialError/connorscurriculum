// Practice links that no longer fit the class: a chapter, topic, or test it doesn't have, a set
// whose questions were renamed or removed, filters nothing matches, or a damaged seed. The
// practice page says what happened in one line and shows the filters, so Start (or removing a
// filter) is one click away.
import { filterChips } from './labels';
import type { Filters, PracticeTest, QuestionMeta } from './types';
import { plural } from '../text';

/** What a class has, for checking a link's filters against. */
export interface KnownValues {
  chapters: number[];
  tests: PracticeTest[];
  units: { id: string; topics: { id: string }[] }[];
  questions: Pick<QuestionMeta, 'sections'>[];
}

/** Filter values a link asked for that the class doesn't have. */
export interface UnknownValues {
  /** As their filter chips say them ("Ch. 99", "Topic 9.9"). */
  values: string[];
  /** The link named a class test that isn't on the site (its id is no name to show). */
  test: boolean;
}

/** The filters with every value the class doesn't have left out, and what was left out (null: nothing). */
export function knownFilters(f: Filters, known: KnownValues): { filters: Filters; unknown: UnknownValues | null } {
  const sections = new Set(known.questions.flatMap((q) => q.sections));
  const units = new Set(known.units.map((u) => u.id));
  const topics = new Set(known.units.flatMap((u) => u.topics.map((t) => t.id)));
  const filters: Filters = {
    ...f,
    chapters: f.chapters.filter((n) => known.chapters.includes(n)),
    sections: f.sections.filter((s) => sections.has(s)),
    test: f.test && known.tests.some((t) => t.id === f.test) ? f.test : null,
    units: f.units.filter((u) => units.has(u)),
    topics: f.topics.filter((t) => topics.has(t)),
    // A class with no AP topics has nothing to split on.
    ap: known.units.length ? f.ap : null,
  };
  // Compared without the test: an unknown test's chip would be its id.
  const labels = (x: Filters) => filterChips({ ...x, test: null }, known.tests, []).map((c) => c.label);
  const kept = new Set(labels(filters));
  const values = labels(f).filter((l) => !kept.has(l));
  const test = f.test !== null && filters.test === null;
  return { filters, unknown: values.length || test ? { values, test } : null };
}

/** Why a practice link didn't open the set it names. */
export type LinkProblem =
  /** Filter values the class doesn't have, left out. */
  | ({ kind: 'unknown' } & UnknownValues)
  /** A set of exact questions (?ids=), none of which exist any more; `filtered`: it came from narrowing filters. */
  | { kind: 'gone'; filtered: boolean }
  /** The link's filters match no questions. */
  | { kind: 'empty' };

/** The line the setup screen shows about a link that didn't open. */
export function linkNotice(p: LinkProblem): string {
  if (p.kind === 'unknown') {
    const asked = [
      p.values.length > 0 && `${p.values.join(', ')}, which this class doesn't have`,
      p.test && "a class test that isn't on the site any more",
    ].filter(Boolean);
    const one = p.values.length + Number(p.test) === 1;
    return `That link asked for ${asked.join(', and ')}, so ${one ? 'it was' : 'they were'} left out.`;
  }
  if (p.kind === 'gone') return `That set's questions aren't on the site any more.${p.filtered ? ' Here are the filters it was made from.' : ''}`;
  return 'No questions match that link. Remove a filter below to start a set.';
}

/** Shown with a set of exact questions when some of them are gone. */
export const missingNote = (asked: number, found: number): string => {
  const gone = asked - found;
  return `${gone} of that set's questions ${gone === 1 ? "isn't" : "aren't"} on the site any more, so it has ${plural(found, 'question')}.`;
};

/** Shown with a set opened from a link whose seed was damaged: its questions are picked afresh. */
export const RESHUFFLED_NOTE = "That link's set couldn't be read, so this is a new set with the same filters.";
