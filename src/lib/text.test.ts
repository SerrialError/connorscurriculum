import { describe, expect, it } from 'vitest';
import { chapterName, chapterRange, plural, truncate } from './text';

describe('plural', () => {
  it('adds an s except for one', () => {
    expect(plural(0, 'question')).toBe('0 questions');
    expect(plural(1, 'question')).toBe('1 question');
    expect(plural(2, 'pt')).toBe('2 pts');
  });
});

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('short text', 20)).toBe('short text');
  });
  it('cuts at a word boundary and adds an ellipsis', () => {
    expect(truncate('one two three four five', 12)).toBe('one two…');
    expect(truncate('one two three four five', 12).length).toBeLessThanOrEqual(12);
  });
  it('cuts mid-word when there is no space late enough', () => {
    expect(truncate('abcdefghijklmnop', 8)).toBe('abcdefg…');
  });
});

describe('chapterName', () => {
  it('names a chapter with its title', () => {
    expect(chapterName({ number: 7, title: 'Periodic Properties of the Elements' })).toBe('Chapter 7: Periodic Properties of the Elements');
  });
});

describe('chapterRange', () => {
  it('joins consecutive chapters with a dash and others with commas', () => {
    expect(chapterRange([9, 8])).toBe('Ch. 8–9');
    expect(chapterRange([6, 8])).toBe('Ch. 6, 8');
    expect(chapterRange([7])).toBe('Ch. 7');
  });
  it('spells the word out, or keeps it with the number', () => {
    expect(chapterRange([8, 9], { long: true })).toBe('Chapters 8–9');
    expect(chapterRange([7], { long: true })).toBe('Chapter 7');
    expect(chapterRange([6, 7], { nbsp: true })).toBe('Ch.\u00a06–7');
  });
});
