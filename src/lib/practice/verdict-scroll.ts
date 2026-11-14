// Where the page scrolls after Check or Done marking (Session.svelte), so the verdict shows and
// Next is in reach. Positions are viewport pixels, as getBoundingClientRect gives them.

export interface VerdictLayout {
  /** Top of the verdict line ("✓ Correct"). */
  verdictTop: number;
  /** Top and bottom of the action bar that holds Next. */
  barTop: number;
  barBottom: number;
  viewportHeight: number;
  /** The bar is stuck to the bottom of the screen (phones), so Next is always in view. */
  sticky: boolean;
}

/** Space kept between the verdict or the bar and the edge of the screen. */
const MARGIN = 12;

/**
 * How far to scroll (positive is down, 0 is not at all):
 * - bar stuck to the bottom: put the verdict near the top, so as much of the explanation as fits
 *   shows above the bar, unless it's already in the top half;
 * - verdict through Next fit on screen: scroll as little as shows them all;
 * - they don't fit: put the verdict near the top, unless it's already in the top third.
 */
export function verdictScroll({ verdictTop: v, barTop, barBottom, viewportHeight, sticky }: VerdictLayout): number {
  const toTop = v - MARGIN;
  if (sticky) {
    const visible = Math.min(barTop, viewportHeight);
    return v < MARGIN || v > visible / 2 ? toTop : 0;
  }
  if (barBottom - v + 2 * MARGIN <= viewportHeight) {
    if (barBottom + MARGIN > viewportHeight) return barBottom + MARGIN - viewportHeight;
    return v < MARGIN ? toTop : 0;
  }
  return v < MARGIN || v > viewportHeight / 3 ? toTop : 0;
}
