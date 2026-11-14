import { describe, expect, it } from 'vitest';
import { type FilterItem, filterLessons, isFiltering, lessonFilterQuery, parseLessonFilter, words } from './lesson-filter';

const item = (title: string, kind: string, sample = false): FilterItem => ({ text: words(title).join(' '), kind, sample });
const items = [
  item('The Bohr Model by Ana', 'lesson'),
  item("Rebecca's notes: Bohr and line spectra", 'notes'),
  item('Effective nuclear charge', 'lesson'),
  item('Ch. 6–7 review sheet', 'review'),
  item('Bohr preview (sample)', 'lesson', true),
];
const kinds = ['lesson', 'notes', 'review'];

describe('words', () => {
  it('lower-cases, drops accents, and splits on any spacing', () => {
    expect(words('  Bohr\tMODÈL  ')).toEqual(['bohr', 'model']);
    expect(words('')).toEqual([]);
  });
});

describe('filterLessons', () => {
  it('shows everything when nothing is filtered', () => {
    const r = filterLessons(items, { kind: '', q: '' });
    expect(r.shown).toEqual([true, true, true, true, true]);
    expect([r.shownCount, r.shownClass]).toEqual([5, 4]);
    expect(Object.fromEntries(r.counts)).toEqual({ '': 4, lesson: 2, notes: 1, review: 1 });
  });

  it('needs every word, in any order and case', () => {
    expect(filterLessons(items, { kind: '', q: 'BOHR spectra' }).shown).toEqual([false, true, false, false, false]);
    expect(filterLessons(items, { kind: '', q: 'model bohr' }).shown).toEqual([true, false, false, false, false]);
  });

  it('counts each kind by the words alone, so a chip says what it would show', () => {
    const r = filterLessons(items, { kind: 'notes', q: 'bohr' });
    expect(r.shown).toEqual([false, true, false, false, false]);
    expect(Object.fromEntries(r.counts)).toEqual({ '': 2, lesson: 1, notes: 1 });
  });

  it('shows sample pages but leaves them out of the counts', () => {
    const r = filterLessons(items, { kind: '', q: 'preview' });
    expect([r.shownCount, r.shownClass]).toEqual([1, 0]);
    expect(r.counts.size).toBe(0);
  });
});

describe('the filter in the address', () => {
  it('round-trips', () => {
    const f = { kind: 'notes', q: 'bohr model' };
    expect(lessonFilterQuery(f)).toBe('?kind=notes&q=bohr+model');
    expect(parseLessonFilter(lessonFilterQuery(f), kinds)).toEqual(f);
  });

  it('writes nothing when nothing is filtered, and ignores unknown kinds', () => {
    expect(lessonFilterQuery({ kind: '', q: '  ' })).toBe('');
    expect(parseLessonFilter('?kind=video&q=bohr', kinds)).toEqual({ kind: '', q: 'bohr' });
    expect(parseLessonFilter('', kinds)).toEqual({ kind: '', q: '' });
  });

  it('counts only a kind or real words as filtering', () => {
    expect(isFiltering({ kind: '', q: '   ' })).toBe(false);
    expect(isFiltering({ kind: 'review', q: '' })).toBe(true);
    expect(isFiltering({ kind: '', q: 'bohr' })).toBe(true);
  });
});
