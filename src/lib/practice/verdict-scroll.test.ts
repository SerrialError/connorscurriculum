import { describe, expect, it } from 'vitest';
import { verdictScroll } from './verdict-scroll';

describe('verdictScroll', () => {
  const phone = { viewportHeight: 640, barTop: 580, barBottom: 640, sticky: true };
  const desktop = { viewportHeight: 900, sticky: false };

  it('phones: brings a low verdict up near the top, leaves one in the top half', () => {
    expect(verdictScroll({ ...phone, verdictTop: 500 })).toBe(488);
    expect(verdictScroll({ ...phone, verdictTop: 200 })).toBe(0);
  });
  it('phones: brings a verdict above the screen back down', () => {
    expect(verdictScroll({ ...phone, verdictTop: -40 })).toBe(-52);
  });
  it('phones: measures the top half above the bar', () => {
    expect(verdictScroll({ ...phone, verdictTop: 300, barTop: 560 })).toBe(288);
    expect(verdictScroll({ ...phone, verdictTop: 270, barTop: 560 })).toBe(0);
  });
  it('wide screens: scrolls just enough to show the verdict through Next', () => {
    expect(verdictScroll({ ...desktop, verdictTop: 700, barTop: 950, barBottom: 1000 })).toBe(112);
    expect(verdictScroll({ ...desktop, verdictTop: 300, barTop: 600, barBottom: 650 })).toBe(0);
    expect(verdictScroll({ ...desktop, verdictTop: -20, barTop: 300, barBottom: 350 })).toBe(-32);
  });
  it("wide screens: puts the verdict near the top when it and Next don't fit together", () => {
    expect(verdictScroll({ ...desktop, verdictTop: 600, barTop: 1600, barBottom: 1650 })).toBe(588);
    expect(verdictScroll({ ...desktop, verdictTop: 200, barTop: 1600, barBottom: 1650 })).toBe(0);
  });
});
