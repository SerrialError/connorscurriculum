// Practice links that no longer fit the class: a chapter, topic, or test it doesn't have, a set
// whose questions were renamed or removed, filters nothing matches, or a damaged seed. The
// practice page says what happened in one line and shows the filters, so Start (or removing a
// filter) is one click away.
import { CLASS_ONLY_UNIT } from './filters';
import { filterChips } from './labels';
import type { Filters, PracticeQuestion, PracticeTest } from './types';
import { plural } from '../text';

/** What a class has, for checking a link's filters against. */
export interface KnownValues {
  chapters: number[];
  tests: PracticeTest[];
  units: { id: string; topics: { id: string }[] }[];
  questions: Pick<PracticeQuestion, 'sections'>[];
}

/**
 * The filters with every value the class doesn't have left out, and the names of those values
 * as their filter chips say them ("Ch. 99", "Topic 9.9").
 */
export function knownFilters(f: Filters, known: KnownValues): { filters: Filters; unknown: string[] } {
  const sections = new Set(known.questions.flatMap((q) => q.sections));
  const units = new Set([...known.units.map((u) => u.id), ...(known.units.length ? [CLASS_ONLY_UNIT] : [])]);
  const topics = new Set(known.units.flatMap((u) => u.topics.map((t) => t.id)));
  const filters: Filters = {
    ...f,
    chapters: f.chapters.filter((n) => known.chapters.includes(n)),
    sections: f.sections.filter((s) => sections.has(s)),
    test: f.test && known.tests.some((t) => t.id === f.test) ? f.test : null,
    units: f.units.filter((u) => units.has(u)),
    topics: f.topics.filter((t) => topics.has(t)),
  };
  const kept = new Set(filterChips(filters, known.tests, []).map((c) => c.label));
  const unknown = filterChips(f, known.tests, [])
    .map((c) => c.label)
    .filter((l) => !kept.has(l));
  return { filters, unknown };
}

/** Why a practice link didn't open the set it names. */
export type LinkProblem =
  /** Filter values the class doesn't have, left out (their chip names). */
  | { kind: 'unknown'; values: string[] }
  /** A set of exact questions (?ids=), none of which exist any more; `filtered`: it came from narrowing filters. */
  | { kind: 'gone'; filtered: boolean }
  /** The link's filters match no questions. */
  | { kind: 'empty' };

/** The line the setup screen shows about a link that didn't open. */
export function linkNotice(p: LinkProblem): string {
  if (p.kind === 'unknown') {
    const one = p.values.length === 1;
    return `That link asked for ${p.values.join(', ')}, which this class doesn't have, so ${one ? 'it was' : 'they were'} left out.`;
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
