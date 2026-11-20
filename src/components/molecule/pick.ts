// "Turn in 3D" links on the shape cards (ShapeGrid.astro) choose a shape in the shape explorer.
// The explorer may not be loaded yet when the link is clicked (it loads when scrolled into view),
// so the choice waits here until it asks for it.

export interface ShapePick {
  domains: number;
  lonePairs: number;
}

const EVENT = 'vsepr-pick';
let pending: ShapePick | null = null;

export function pickShape(p: ShapePick) {
  pending = p;
  window.dispatchEvent(new CustomEvent<ShapePick>(EVENT, { detail: p }));
}

/** The pick waiting for the explorer, if any (it's then cleared). */
export function takePick(): ShapePick | null {
  const p = pending;
  pending = null;
  return p;
}

/** Calls `fn` on every pick from now on; returns a function that stops listening. */
export function onPick(fn: (p: ShapePick) => void): () => void {
  const handler = (e: Event) => {
    pending = null;
    fn((e as CustomEvent<ShapePick>).detail);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
