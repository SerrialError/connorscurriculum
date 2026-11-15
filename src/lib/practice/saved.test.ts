import { describe, expect, it } from 'vitest';
import { MAX_SAVED, type SavedSet, answeredIn, readSavedSets, resumable, withSaved } from './saved';

const set = (over: Partial<SavedSet> = {}): SavedSet => ({
  id: 'abc123',
  label: 'Ch. 7 · 10 random',
  note: '',
  query: '?chapter=7&start=1&seed=abc123',
  ids: ['q1', 'q2', 'q3'],
  index: 0,
  phase: 'session',
  picks: {},
  checked: {},
  revealed: {},
  marks: {},
  finished: {},
  ...over,
});
const ids = new Set(['q1', 'q2', 'q3']);

describe('readSavedSets', () => {
  it('keeps valid sets as they are', () => {
    expect(readSavedSets([set()], ids)).toEqual([set()]);
  });

  it('drops sets whose questions are gone, and junk', () => {
    expect(readSavedSets([set({ ids: ['q1', 'gone'] }), null, 7, { ids: [] }], ids)).toEqual([]);
    expect(readSavedSets(null, ids)).toEqual([]);
  });

  it('accepts the single set older versions stored', () => {
    expect(readSavedSets(set(), ids)).toHaveLength(1);
  });

  it('gives sets from before sets had an address one, with their exact questions', () => {
    const [s] = readSavedSets([{ ...set(), id: 'lq3k2x9a', query: '?chapter=7', label: undefined }], ids);
    expect(s!.query).toBe('?chapter=7&start=1&seed=lq3k2x9a&ids=q1,q2,q3');
    expect(s!.label).toBe('');
    const [t] = readSavedSets([{ ...set(), id: undefined }], ids);
    expect(t!.id).toBe('saved0');
    expect(t!.query).toContain('seed=saved0');
  });

  it('keeps the index in range', () => {
    expect(readSavedSets([set({ index: 99 })], ids)[0]!.index).toBe(2);
  });
});

describe('withSaved', () => {
  it('puts the set first, replaces its old copy, and keeps a few', () => {
    const many = Array.from({ length: 8 }, (_, i) => set({ id: `s${i}` }));
    const out = withSaved(many, set({ id: 's3', index: 2 }));
    expect(out[0]).toMatchObject({ id: 's3', index: 2 });
    expect(out.filter((s) => s.id === 's3')).toHaveLength(1);
    expect(out).toHaveLength(MAX_SAVED);
  });
});

describe('resumable', () => {
  it('offers the newest set only when it is started and unfinished', () => {
    expect(resumable([set()])).toBeNull();
    expect(resumable([set({ checked: { q1: true } })])?.id).toBe('abc123');
    expect(resumable([set({ checked: { q1: true, q2: true }, finished: { q3: true } })])).toBeNull();
    expect(resumable([set({ checked: { q1: true }, phase: 'results' })])).toBeNull();
    expect(resumable([])).toBeNull();
  });

  it('counts MCQs checked and FRQs marked as answered', () => {
    expect(answeredIn(set({ checked: { q1: true }, finished: { q2: true } }))).toBe(2);
  });
});

describe('answeredIn a practice exam', () => {
  const exam = (over: Partial<SavedSet> = {}) => set({ query: '?test=ch6-7-test&exam=1&start=1&seed=abc123', ...over });

  it('counts picked choices while the exam is being taken, so it can be resumed', () => {
    expect(answeredIn(exam({ picks: { q1: 'a', q2: 'c' } }))).toBe(2);
    expect(resumable([exam({ picks: { q1: 'a' } })])?.id).toBe('abc123');
  });

  it('counts checked answers once it is submitted, as in any set', () => {
    expect(answeredIn(exam({ picks: { q1: 'a' }, checked: { q1: true, q2: true } }))).toBe(2);
  });
});
