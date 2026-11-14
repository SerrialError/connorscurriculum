import { describe, expect, it } from 'vitest';
import { emptyFilters, isDefaultFilters } from './filters';
import { filtersToQuery, isSeed, parseFilters, parseSet, setToQuery, setupQuery, topicQuery, wantsStart } from './url';

describe('URL filters', () => {
  it('round-trips through the query string', () => {
    const f = { ...emptyFilters(), chapters: [14, 15], sections: ['14.10', '14.2'], test: 'ch14', topics: ['5.1', '5.2'], units: ['7'], difficulty: [1, 3], type: 'mcq' as const, mode: 'all' as const, n: 5 };
    const q = filtersToQuery(f);
    expect(q).toBe('?chapter=14,15&section=14.2,14.10&test=ch14&unit=7&topic=5.1,5.2&difficulty=1,3&type=mcq&mode=all&n=5');
    expect(parseFilters(q)).toEqual({ ...f, sections: ['14.2', '14.10'] });
  });

  it('ignores junk values', () => {
    const f = parseFilters('?chapter=abc,14&difficulty=0,2,9&type=essay&mode=nope&n=-3');
    expect(f.chapters).toEqual([14]);
    expect(f.difficulty).toEqual([2]);
    expect(f.type).toBeNull();
    expect(f.mode).toBe('random');
    expect(f.n).toBe(10);
  });

  it('defaults to 10 shuffled questions, and order and count never depend on each other', () => {
    expect(emptyFilters()).toMatchObject({ mode: 'random', n: 10 });
    expect(parseFilters('')).toMatchObject({ mode: 'random', n: 10 });
    expect(parseFilters('?mode=all')).toMatchObject({ mode: 'all', n: 10 });
    expect(parseFilters('?n=all')).toMatchObject({ mode: 'random', n: null });
    expect(parseFilters('?mode=weak&n=-1')).toMatchObject({ mode: 'weak', n: 10 });
    expect(parseFilters('?n=5')).toMatchObject({ mode: 'random', n: 5 });
    expect(parseFilters('?n=9999').n).toBe(200);
  });

  it('writes order and count only when they differ from the defaults', () => {
    expect(filtersToQuery({ ...emptyFilters(), mode: 'random', n: 10 })).toBe('');
    expect(filtersToQuery({ ...emptyFilters(), mode: 'all', n: null })).toBe('?mode=all&n=all');
    expect(filtersToQuery({ ...emptyFilters(), n: 5 })).toBe('?n=5');
    for (const f of [
      { ...emptyFilters(), mode: 'random' as const, n: null },
      { ...emptyFilters(), mode: 'weak' as const, n: 25 },
      { ...emptyFilters(), mode: 'all' as const, n: 3 },
      { ...emptyFilters(), n: 3 },
    ]) {
      expect(parseFilters(filtersToQuery(f))).toEqual(f);
    }
  });

  it('keeps explicit older links (?mode=random&n=10) working', () => {
    const f = parseFilters('?test=ch6-7-test&mode=random&n=10');
    expect(f).toMatchObject({ test: 'ch6-7-test', mode: 'random', n: 10 });
    expect(filtersToQuery(f)).toBe('?test=ch6-7-test');
  });

  it('writes lists sorted, so the same filters always give the same address', () => {
    expect(filtersToQuery({ ...emptyFilters(), difficulty: [2, 1], chapters: [7, 6], topics: ['1.10', '1.7'], units: ['3', '1'] })).toBe(
      '?chapter=6,7&unit=1,3&topic=1.7,1.10&difficulty=1,2',
    );
    expect(setupQuery('?difficulty=3,1,3&chapter=7,6')).toBe('?chapter=6,7&difficulty=1,3');
  });

  it('gives an empty query for default filters', () => {
    expect(filtersToQuery(emptyFilters())).toBe('');
    expect(isDefaultFilters(emptyFilters())).toBe(true);
    expect(isDefaultFilters({ ...emptyFilters(), mode: 'all' })).toBe(false);
    expect(isDefaultFilters({ ...emptyFilters(), n: null })).toBe(false);
    expect(isDefaultFilters({ ...emptyFilters(), chapters: [7] })).toBe(false);
  });
});

describe('wantsStart', () => {
  it('starts only when start is set to something truthy', () => {
    expect(wantsStart('?test=x&start=1')).toBe(true);
    expect(wantsStart('?start')).toBe(true);
    expect(wantsStart('?test=x')).toBe(false);
    expect(wantsStart('?start=0')).toBe(false);
  });

  it('is not a filter: it never ends up in the filter query', () => {
    expect(filtersToQuery(parseFilters('?test=x&mode=all&start=1&seed=abc&ids=q1'))).toBe('?test=x&mode=all');
  });
});

describe('a set in the URL', () => {
  it('is the setup screen without start=1', () => {
    expect(parseSet('?chapter=7&seed=abc')).toBeNull();
    expect(parseSet('')).toBeNull();
  });

  it('round-trips filters, seed, and ids', () => {
    const spec = { filters: { ...emptyFilters(), chapters: [7], difficulty: [3], mode: 'all' as const, n: 5 }, seed: 'k3x9a0', ids: null };
    const q = setToQuery(spec);
    expect(q).toBe('?chapter=7&difficulty=3&mode=all&n=5&start=1&seed=k3x9a0');
    expect(parseSet(q)).toEqual(spec);
    const picked = { filters: emptyFilters(), seed: 'abc123', ids: ['q2', 'q1'] };
    expect(setToQuery(picked)).toBe('?start=1&seed=abc123&ids=q2,q1');
    expect(parseSet(setToQuery(picked))).toEqual(picked);
  });

  it('accepts a link with no seed yet, and rejects junk seeds', () => {
    expect(parseSet('?chapter=7&start=1')).toEqual({ filters: { ...emptyFilters(), chapters: [7] }, seed: null, ids: null });
    expect(parseSet('?start=1&seed=<script>')?.seed).toBeNull();
  });

  it('returns to exactly the filters that made the set', () => {
    const f = { ...emptyFilters(), test: 'ch14', type: 'frq' as const, mode: 'all' as const, n: null };
    expect(setupQuery(setToQuery({ filters: f, seed: 'abc', ids: ['q1'] }))).toBe(filtersToQuery(f));
    expect(setupQuery('?chapter=7&start=1')).toBe('?chapter=7');
  });

  it('accepts only short letter-and-digit seeds', () => {
    expect(isSeed('k3x9a0')).toBe(true);
    expect(isSeed('')).toBe(false);
    expect(isSeed('a'.repeat(17))).toBe(false);
    expect(isSeed(42)).toBe(false);
  });
});

describe('topicQuery', () => {
  it('links a topic to its practice filters', () => {
    expect(topicQuery('1.7')).toBe('?topic=1.7');
  });
});
