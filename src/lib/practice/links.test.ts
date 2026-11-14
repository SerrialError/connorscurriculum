import { describe, expect, it } from 'vitest';
import { DEFAULT_COUNT } from './filters';
import { pickQuery, practiceStarts, weakestStart } from './links';
import { parseFilters, parseSet } from './url';

describe('practiceStarts', () => {
  it(`starts ${DEFAULT_COUNT} random from a bigger pool, with all in order second`, () => {
    const { start, all } = practiceStarts({ test: 'ch6-7-test' }, 116);
    expect(start).toMatchObject({ query: '?test=ch6-7-test&start=1', label: 'Start 10 random questions', short: '10 random' });
    expect(all).toMatchObject({ query: '?test=ch6-7-test&mode=all&n=all&start=1', label: 'All 116 in order', short: 'all 116 in order' });
  });

  it('starts a small pool all in order, with no second button', () => {
    const { start, all } = practiceStarts({ chapters: [7] }, 8);
    expect(start).toMatchObject({ query: '?chapter=7&mode=all&n=all&start=1', label: 'Start all 8 questions', short: 'all 8 in order' });
    expect(all).toBeNull();
    expect(practiceStarts({ chapters: [7] }, 1).start.label).toBe('Start all 1 question');
  });

  it('ends the main label with `about`', () => {
    const { start, all } = practiceStarts({ chapters: [7], sections: ['7.2'] }, 12, 'on this lesson');
    expect(start.label).toBe('Start 10 random questions on this lesson');
    expect(start.query).toBe('?chapter=7&section=7.2&start=1');
    expect(all?.label).toBe('All 12 in order');
  });

  it('gives links the practice page reads back as the same set', () => {
    const { start, all } = practiceStarts({ topics: ['5.2'] }, 30);
    expect(parseSet(start.query)?.filters).toEqual(start.filters);
    expect(parseSet(all!.query)?.filters).toEqual(all!.filters);
  });
});

describe('weakestStart', () => {
  it('starts weakest topics first', () => {
    expect(weakestStart({ test: 't' }, 40)).toMatchObject({
      query: '?test=t&mode=weak&start=1',
      label: 'Start 10 on your weakest topics',
      short: '10 on your weakest topics',
    });
    expect(weakestStart({ test: 't' }, 6).label).toBe('Start all 6, weakest topics first');
  });
});

describe('pickQuery', () => {
  it('opens the setup screen with the pool picked', () => {
    expect(pickQuery({ chapters: [7], sections: ['7.3', '7.2'] })).toBe('?chapter=7&section=7.2,7.3');
    expect(parseFilters(pickQuery({ test: 't' })).test).toBe('t');
    expect(parseSet(pickQuery({ test: 't' }))).toBeNull();
  });
});
