import { describe, expect, it } from 'vitest';
import { mixedReview, quickStarts } from './presets';
import { filtersToQuery } from './url';

describe('mixedReview', () => {
  const qs = [{ chapter: 6 }, { chapter: 6 }, { chapter: 7 }, { chapter: 14 }];
  it('draws only from taught chapters', () => {
    expect(mixedReview(qs, new Set([1, 6, 7, 8]))).toEqual({ pool: { chapters: [6, 7] }, chapters: [6, 7], count: 3 });
  });
  it('needs no chapter filter when every chapter with questions is taught', () => {
    expect(mixedReview(qs, new Set([6, 7, 14]))).toEqual({ pool: {}, chapters: [6, 7, 14], count: 4 });
  });
  it('is null when nothing with questions is taught', () => {
    expect(mixedReview(qs, new Set([1]))).toBeNull();
  });
});

describe('quickStarts', () => {
  const qs = [{ chapter: 6 }, { chapter: 7 }, { chapter: 8 }];
  const many = { id: 'ch6-7-test', title: 'Chapters 6–7 Test', count: 116 };
  /** A preset with its filters written as practice queries, for reading. */
  const asQueries = (p: ReturnType<typeof quickStarts>[number]) => ({
    label: p.label,
    query: filtersToQuery(p.filters),
    note: p.note,
    ...(p.alt && { alt: { label: p.alt.label, query: filtersToQuery(p.alt.filters) } }),
  });

  it('offers the latest test with questions, as 10 random or all in order', () => {
    const [test] = quickStarts([{ id: 'ch8-test', title: 'Ch. 8 Test', count: 0 }, many], qs, new Set([6, 7]));
    expect(asQueries(test!)).toEqual({
      label: 'Chapters 6–7 Test',
      query: '?test=ch6-7-test',
      note: '10 random from its 116 questions',
      alt: { label: 'All 116 in order', query: '?test=ch6-7-test&mode=all&n=all' },
    });
  });

  it('starts a short test all in order, with no second way', () => {
    const [test] = quickStarts([{ ...many, count: 8 }], qs, new Set([6, 7]));
    expect(asQueries(test!)).toEqual({ label: 'Chapters 6–7 Test', query: '?test=ch6-7-test&mode=all&n=all', note: 'All 8 questions, in order' });
  });

  it('adds a mixed review only when its pool differs from the test', () => {
    expect(quickStarts([{ ...many, count: 2 }], qs, new Set([6, 7])).map((p) => p.label)).toEqual(['Chapters 6–7 Test']);
    const presets = quickStarts([{ ...many, count: 1 }], qs, new Set([6, 7]));
    expect(asQueries(presets[1]!)).toEqual({ label: 'Mixed review', query: '?chapter=6,7&mode=all&n=all', note: 'All 2 questions in Ch. 6–7, in order' });
    expect(quickStarts([], qs, new Set()).length).toBe(0);
  });

  it('starts a big mixed review as 10 random', () => {
    const big = Array.from({ length: 30 }, (_, i) => ({ chapter: 6 + (i % 3) }));
    const [mixed] = quickStarts([], big, new Set([6, 7]));
    expect(asQueries(mixed!)).toEqual({ label: 'Mixed review', query: '?chapter=6,7', note: '10 random from the 20 questions in Ch. 6–7' });
  });
});
