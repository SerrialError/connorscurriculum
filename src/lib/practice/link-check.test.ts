import { describe, expect, it } from 'vitest';
import { emptyFilters } from './filters';
import { type KnownValues, knownFilters, linkNotice, missingNote } from './link-check';
import { questions, tests } from './test-fixtures';

const known: KnownValues = {
  chapters: [13, 14, 15],
  tests,
  units: [{ id: '5', topics: [{ id: '5.1' }, { id: '5.2' }] }],
  questions,
};

describe('knownFilters', () => {
  it('keeps every value the class has', () => {
    const f = { ...emptyFilters(), chapters: [14], sections: ['15.2'], test: 'ch14', units: ['5'], topics: ['5.2'], ap: 'class' as const };
    expect(knownFilters(f, known)).toEqual({ filters: f, unknown: null });
  });

  it('leaves out unknown chapters, sections, tests, units, and topics, naming all but the test', () => {
    const f = { ...emptyFilters(), chapters: [14, 99], sections: ['99.1'], test: 'bogus', units: ['9'], topics: ['5.1', '9.9'], difficulty: [3] };
    const { filters, unknown } = knownFilters(f, known);
    expect(filters).toEqual({ ...emptyFilters(), chapters: [14], topics: ['5.1'], difficulty: [3] });
    expect(unknown).toEqual({ values: ['Ch. 99', '§99.1', 'Unit 9', 'Topic 9.9'], test: true });
  });

  it('flags an unknown test without naming its id', () => {
    expect(knownFilters({ ...emptyFilters(), test: 'ch6-7-test-old' }, known).unknown).toEqual({ values: [], test: true });
  });

  it('drops the AP-exam filter in a class without AP topics', () => {
    expect(knownFilters({ ...emptyFilters(), ap: 'class' }, { ...known, units: [] }).unknown).toEqual({ values: ['Class only'], test: false });
  });
});

describe('link notices', () => {
  it('says what was left out, and why nothing opened', () => {
    expect(linkNotice({ kind: 'unknown', values: ['Ch. 99'], test: false })).toBe("That link asked for Ch. 99, which this class doesn't have, so it was left out.");
    expect(linkNotice({ kind: 'unknown', values: ['Ch. 99', 'Topic 9.9'], test: false })).toMatch(/Ch\. 99, Topic 9\.9, .* so they were left out\.$/);
    expect(linkNotice({ kind: 'unknown', values: [], test: true })).toBe("That link asked for a class test that isn't on the site any more, so it was left out.");
    expect(linkNotice({ kind: 'unknown', values: ['Ch. 99'], test: true })).toBe(
      "That link asked for Ch. 99, which this class doesn't have, and a class test that isn't on the site any more, so they were left out.",
    );
    expect(linkNotice({ kind: 'gone', filtered: true })).toBe("That set's questions aren't on the site any more. Here are the filters it was made from.");
    expect(linkNotice({ kind: 'gone', filtered: false })).toBe("That set's questions aren't on the site any more.");
    expect(linkNotice({ kind: 'empty' })).toMatch(/^No questions match that link/);
  });

  it('counts the questions missing from a set', () => {
    expect(missingNote(3, 2)).toBe("1 of that set's questions isn't on the site any more, so it has 2 questions.");
    expect(missingNote(5, 1)).toBe("4 of that set's questions aren't on the site any more, so it has 1 question.");
  });
});
