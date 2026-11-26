import { describe, expect, it } from 'vitest';
import { mixedReview, quickStarts } from './presets';
import { filtersToQuery } from './url';

/** Questions with ids q0, q1, … in these chapters. */
const inChapters = (...chapters: number[]) => chapters.map((chapter, i) => ({ id: `q${i}`, chapter }));

describe('mixedReview', () => {
  const qs = inChapters(6, 6, 7, 14);
  it('draws only from taught chapters', () => {
    expect(mixedReview(qs, new Set([1, 6, 7, 8]))).toEqual({ pool: { chapters: [6, 7] }, chapters: [6, 7], ids: ['q0', 'q1', 'q2'] });
  });
  it('needs no chapter filter when every chapter with questions is taught', () => {
    expect(mixedReview(qs, new Set([6, 7, 14]))).toEqual({ pool: {}, chapters: [6, 7, 14], ids: ['q0', 'q1', 'q2', 'q3'] });
  });
  it('is null when nothing with questions is taught', () => {
    expect(mixedReview(qs, new Set([1]))).toBeNull();
  });
});

describe('quickStarts', () => {
  const qs = inChapters(6, 7, 8);
  /** A test with `n` questions (ids t0, t1, …). */
  const test = (n: number, ids = Array.from({ length: n }, (_, i) => `t${i}`)) => ({ id: 'ch6-7-test', title: 'Chapters 6–7 Test', questions: ids });
  /** A preset with its filters written as practice queries, for reading. */
  const asQueries = (p: ReturnType<typeof quickStarts>[number]) => ({
    label: p.label,
    query: filtersToQuery(p.filters),
    note: p.note,
    ...(p.alt && { alt: { label: p.alt.label, query: filtersToQuery(p.alt.filters) } }),
  });

  it('offers the latest test with questions, as 10 random or all in order', () => {
    const [first] = quickStarts([{ id: 'ch8-test', title: 'Ch. 8 Test', questions: [] }, test(116)], qs, new Set([6, 7]));
    expect(asQueries(first!)).toEqual({
      label: 'Chapters 6–7 Test',
      query: '?test=ch6-7-test',
      note: '10 random from its 116 questions',
      alt: { label: 'All 116 in order', query: '?test=ch6-7-test&mode=all&n=all' },
    });
  });

  it('starts a short test all in order, with no second way', () => {
    const [first] = quickStarts([test(8)], qs, new Set([6, 7]));
    expect(asQueries(first!)).toEqual({ label: 'Chapters 6–7 Test', query: '?test=ch6-7-test&mode=all&n=all', note: 'All 8 questions, in order' });
  });

  it('adds a mixed review only when its questions differ from the test', () => {
    // The test is exactly the taught chapters' questions (in another order): no mixed review.
    expect(quickStarts([test(2, ['q1', 'q0'])], qs, new Set([6, 7])).map((p) => p.label)).toEqual(['Chapters 6–7 Test']);
    // Same size, different questions: both.
    const presets = quickStarts([test(2, ['q0', 'q2'])], qs, new Set([6, 7]));
    expect(presets.map((p) => p.label)).toEqual(['Chapters 6–7 Test', 'Mixed review']);
    expect(asQueries(presets[1]!)).toEqual({ label: 'Mixed review', query: '?chapter=6,7&mode=all&n=all', note: 'All 2 questions in Ch.\u00a06–7, in order' });
    expect(quickStarts([], qs, new Set()).length).toBe(0);
  });

  it('starts a big mixed review as 10 random', () => {
    const big = inChapters(...Array.from({ length: 30 }, (_, i) => 6 + (i % 3)));
    const [mixed] = quickStarts([], big, new Set([6, 7]));
    expect(asQueries(mixed!)).toEqual({ label: 'Mixed review', query: '?chapter=6,7', note: '10 random from the 20 questions in Ch.\u00a06–7' });
  });

  it("offers the latest test's practice exam right after the test", () => {
    const exam = { mcqPoints: 2.8, sections: [{ id: 's', label: 'All', count: 36, match: { chapters: [6], sections: [] } }], extra: 0, frq: { count: 1, points: 7.2 } };
    const presets = quickStarts([{ ...test(116), exam }], qs, new Set([6, 7]));
    expect(presets.map((p) => p.label)).toEqual(['Chapters 6–7 Test', 'Practice exam: Chapters 6–7 Test', 'Mixed review']);
    expect(presets[1]).toMatchObject({ exam: true, note: '36 multiple choice and 1 free response, 108 points in all' });
    expect(filtersToQuery(presets[1]!.filters)).toBe('?test=ch6-7-test');
  });

  it("says when the practice exam's format is a stand-in", () => {
    const exam = { mcqPoints: 2, sections: [{ id: 's', label: 'All', count: 50, match: { chapters: [6], sections: [] } }], extra: 0, frq: { count: 2, points: 20 }, tentative: true };
    const presets = quickStarts([{ ...test(116), exam }], qs, new Set([6, 7]));
    expect(presets[1]!.note).toBe('50 multiple choice and 2 free response, 120 points in all (a stand-in until the format is announced)');
  });
});
