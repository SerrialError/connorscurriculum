// Flat SVG drawings of the 3D models, for pages that show many shapes at once (a WebGL viewer per
// shape would be too heavy). The model is seen from the same angle the 3D viewer starts at, with
// shaded balls and far-to-near drawing order, so it reads as 3D.
import { ELEMENT_COLORS, type Molecule, type Vec, atomRadius } from './molecules';

/** The 3D viewer's starting view (components/molecule/viewport.ts): 64° from straight down, turned 20°. */
const POLAR = (64 * Math.PI) / 180;
const AZIMUTH = (20 * Math.PI) / 180;

const cam: Vec = [Math.sin(POLAR) * Math.sin(AZIMUTH), Math.cos(POLAR), Math.sin(POLAR) * Math.cos(AZIMUTH)];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec): Vec => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
// Camera axes, as three.js's lookAt builds them with "up" = +y.
const zAxis = norm(cam);
const xAxis = norm(cross([0, 1, 0], zAxis));
const yAxis = cross(zAxis, xAxis);

/** Screen x, screen y (down), and depth (bigger is nearer). */
function project(p: Vec): [number, number, number] {
  return [dot(p, xAxis), -dot(p, yAxis), dot(p, zAxis)];
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const c = (n >> shift) & 255;
    const out = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.round(out).toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

interface Item {
  depth: number;
  svg: string;
  /** Screen-space bounding box (model units): x0, y0, x1, y1. */
  box: [number, number, number, number];
}

export interface SvgOptions {
  /** Draw every electron domain as a lobe (the electron-domain geometry), with no outer atoms. */
  domainsOnly?: boolean;
  /** Accessible name for the drawing. */
  title: string;
  /** Pixels per model unit. */
  scale?: number;
}

/** An SVG drawing of `m` (ids in the markup are prefixed with `idPrefix` so several fit on one page). */
export function moleculeSvg(m: Molecule, idPrefix: string, opts: SvgOptions): string {
  const k = opts.scale ?? 34;
  const items: Item[] = [];
  const defs = new Set<string>();
  const gradient = (key: string, color: string) => {
    const id = `${idPrefix}-${key}`;
    defs.add(
      `<radialGradient id="${id}" cx="35%" cy="32%" r="70%"><stop offset="0" stop-color="${shade(color, 0.55)}"/><stop offset="0.55" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -0.45)}"/></radialGradient>`,
    );
    return `url(#${id})`;
  };
  const pos = m.atoms.map((a) => project(a.pos));
  const center = m.atoms[0]!;

  const lobe = (from: Vec, dir: Vec, length: number, width: number, fill: string, opacity: number) => {
    const d = norm(dir);
    const mid: Vec = [from[0] + d[0] * length * 0.55, from[1] + d[1] * length * 0.55, from[2] + d[2] * length * 0.55];
    const [x, y, depth] = project(mid);
    const [dx, dy] = project(d);
    const along = Math.hypot(dx, dy);
    const rx = Math.max(width, (length / 2) * along) * k;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const ext = Math.max(rx / k, width);
    items.push({
      depth,
      box: [x - ext, y - ext, x + ext, y + ext],
      svg: `<ellipse cx="${r2(x * k)}" cy="${r2(y * k)}" rx="${r2(rx)}" ry="${r2(width * k)}" transform="rotate(${r2(angle)} ${r2(x * k)} ${r2(y * k)})" fill="${fill}" fill-opacity="${opacity}" stroke="${shade(fill, -0.3)}" stroke-opacity="0.5" stroke-width="1"/>`,
    });
  };

  if (opts.domainsOnly) {
    // Every domain (bond or lone pair) as the same lobe: the electron-domain geometry.
    const dirs = [...m.lonePairs.map((lp) => lp.dir), ...m.bonds.map((b) => m.atoms[b.b]!.pos)];
    for (const d of dirs) lobe(center.pos, d, 1.1, 0.26, '#8a74e8', 0.55);
  } else {
    for (const b of m.bonds) {
      const [x1, y1, d1] = pos[b.a]!;
      const [x2, y2, d2] = pos[b.b]!;
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / len;
      const ny = (x2 - x1) / len;
      const offsets = b.order === 1 ? [0] : b.order === 2 ? [-1, 1] : [-1.6, 0, 1.6];
      const lines = offsets
        .map((o) => {
          const ox = nx * o * 3;
          const oy = ny * o * 3;
          return `<line x1="${r2(x1 * k + ox)}" y1="${r2(y1 * k + oy)}" x2="${r2(x2 * k + ox)}" y2="${r2(y2 * k + oy)}"/>`;
        })
        .join('');
      items.push({ depth: (d1 + d2) / 2 - 0.01, box: [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)], svg: `<g stroke="#8e959a" stroke-width="${b.order === 1 ? 4 : 2.6}" stroke-linecap="round">${lines}</g>` });
    }
    for (const lp of m.lonePairs) lobe(m.atoms[lp.atom]!.pos, lp.dir, 1.05, 0.27, '#8a74e8', 0.45);
  }

  m.atoms.forEach((a, i) => {
    if (opts.domainsOnly && i > 0) return;
    const [x, y, depth] = pos[i]!;
    const color = opts.domainsOnly ? '#7d8790' : (ELEMENT_COLORS[a.el] ?? '#c0c0c0');
    const r = atomRadius(a.el);
    items.push({
      depth,
      box: [x - r, y - r, x + r, y + r],
      svg: `<circle cx="${r2(x * k)}" cy="${r2(y * k)}" r="${r2(atomRadius(a.el) * k)}" fill="${gradient(opts.domainsOnly ? 'center' : a.el, color)}"/>`,
    });
  });

  items.sort((a, b) => a.depth - b.depth);
  // A square around everything drawn, so every drawing fills its card the same way.
  const x0 = Math.min(...items.map((i) => i.box[0]));
  const y0 = Math.min(...items.map((i) => i.box[1]));
  const x1 = Math.max(...items.map((i) => i.box[2]));
  const y1 = Math.max(...items.map((i) => i.box[3]));
  const side = Math.max(x1 - x0, y1 - y0, 1.6) + 0.25;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return (
    `<svg viewBox="${r2((cx - side / 2) * k)} ${r2((cy - side / 2) * k)} ${r2(side * k)} ${r2(side * k)}" role="img" aria-label="${opts.title}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>${[...defs].join('')}</defs>${items.map((i) => i.svg).join('')}</svg>`
  );
}
