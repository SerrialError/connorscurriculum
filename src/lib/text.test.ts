import { describe, expect, it } from 'vitest';
import { plural, truncate } from './text';

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
