import { describe, expect, it } from 'vitest';
import { isPast, isoDate } from './dates';

describe('dates', () => {
  it('formats a local date', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('counts a test as past only after its day, and undated tests as upcoming', () => {
    expect(isPast('2026-11-03', '2026-11-04')).toBe(true);
    expect(isPast('2026-11-04', '2026-11-04')).toBe(false);
    expect(isPast(undefined, '2026-11-04')).toBe(false);
  });
});
