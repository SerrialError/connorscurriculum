// Draws the Lewis-structure figures for the Chapter 8–9 practice questions as SVG files in
// src/content/questions/apchem/images/ch8-9/. Run with `node scripts/question-figures.mjs`;
// edit a figure here, not in its .svg, or the next run will undo the change.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/content/questions/apchem/images/ch8-9');
const INK = '#1d2321';
const ACCENT = '#1f6f8b';
const FONT = 26;

const rad = (deg) => (deg * Math.PI) / 180;
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * A figure: `atoms` maps an id to [symbol, x, y]; `bonds` are [a, b, order, style?] with style
 * 'wedge' for a bond toward the viewer or 'dash' for one going away; `pairs` are [atom, ...angles] in degrees (0 = right,
 * 90 = down), one lone pair per angle, or [angle, extra distance] to move a pair clear of bonds; `labels` are [text, x, y] numbered markers; `extra` is raw SVG.
 */
function draw({ width, height, atoms, bonds = [], pairs = [], labels = [], extra = '' }) {
  const out = [];
  // How far a bond stops short of an atom's center, and how far out its lone pairs sit.
  const gap = (id) => (atoms[id][0].length > 1 ? 21 : 15);
  const reach = (id) => (atoms[id][0].length > 1 ? 25 : 19);

  for (const [a, b, order, style] of bonds) {
    const [, x1, y1] = atoms[a];
    const [, x2, y2] = atoms[b];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
    const [sx, sy, ex, ey] = [x1 + ux * gap(a), y1 + uy * gap(a), x2 - ux * gap(b), y2 - uy * gap(b)];
    if (style === 'wedge') {
      const [px, py] = [-uy * 5, ux * 5];
      out.push(`<path d="M${r1(sx)},${r1(sy)} L${r1(ex + px)},${r1(ey + py)} L${r1(ex - px)},${r1(ey - py)} Z" fill="${INK}"/>`);
      continue;
    }
    if (style === 'dash') {
      // Short crossbars that widen toward the far atom.
      for (let t = 0.1; t <= 0.95; t += 0.14) {
        const [cx, cy, w] = [sx + (ex - sx) * t, sy + (ey - sy) * t, 1.5 + 4 * t];
        out.push(`<line x1="${r1(cx - uy * w)}" y1="${r1(cy + ux * w)}" x2="${r1(cx + uy * w)}" y2="${r1(cy - ux * w)}" stroke="${INK}" stroke-width="2"/>`);
      }
      continue;
    }
    const offsets = order === 1 ? [0] : order === 2 ? [-4.5, 4.5] : [-7, 0, 7];
    for (const o of offsets) {
      const [px, py] = [-uy * o, ux * o];
      out.push(`<line x1="${r1(sx + px)}" y1="${r1(sy + py)}" x2="${r1(ex + px)}" y2="${r1(ey + py)}" stroke="${INK}" stroke-width="2.2"/>`);
    }
  }

  for (const [id, ...angles] of pairs) {
    const [, x, y] = atoms[id];
    for (const spec of angles) {
      const [angle, extra = 0] = Array.isArray(spec) ? spec : [spec];
      const [ux, uy] = [Math.cos(rad(angle)), Math.sin(rad(angle))];
      // Text is wider than it is tall, so pairs beside a symbol sit a little farther out.
      const d = reach(id) + Math.abs(ux) * 2 + extra;
      const [cx, cy] = [x + ux * d, y - 2 + uy * d];
      for (const s of [-5, 5]) out.push(`<circle cx="${r1(cx - uy * s)}" cy="${r1(cy + ux * s)}" r="2.8" fill="${INK}"/>`);
    }
  }

  for (const [sym, x, y] of Object.values(atoms)) {
    out.push(`<text x="${x}" y="${y + 9}" text-anchor="middle" font-size="${FONT}" fill="${INK}">${sym}</text>`);
  }

  for (const [text, x, y] of labels) {
    out.push(
      `<circle cx="${x}" cy="${y}" r="12" fill="#fff" stroke="${ACCENT}" stroke-width="2"/>`,
      `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="16" font-weight="bold" fill="${ACCENT}">${text}</text>`,
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect width="${width}" height="${height}" fill="#fff"/>`,
    ...out,
    extra,
    '</svg>',
  ].join('\n');
}

const figures = {};

// --- Which of these has resonance? (apchem-08-resonance-which-drawn) ---
figures['resonance-h2co'] = {
  width: 280, height: 170,
  atoms: { c: ['C', 120, 85], o: ['O', 200, 85], h1: ['H', 70, 45], h2: ['H', 70, 125] },
  bonds: [['c', 'o', 2], ['c', 'h1', 1], ['c', 'h2', 1]],
  pairs: [['o', -45, 45]],
};
figures['resonance-o3'] = {
  width: 280, height: 170,
  atoms: { m: ['O', 140, 65], l: ['O', 85, 120], r: ['O', 195, 120] },
  bonds: [['m', 'l', 1], ['m', 'r', 2]],
  pairs: [['m', 270], ['l', 45, 135, 225], ['r', 0, 90]],
};
figures['resonance-hocl'] = {
  width: 280, height: 170,
  atoms: { o: ['O', 135, 70], h: ['H', 80, 120], cl: ['Cl', 195, 120] },
  bonds: [['o', 'h', 1], ['o', 'cl', 1]],
  pairs: [['o', 240, 300], ['cl', 320, 40, 120]],
};
figures['resonance-h2o2'] = {
  width: 280, height: 170,
  atoms: { o1: ['O', 105, 95], o2: ['O', 180, 95], h1: ['H', 55, 140], h2: ['H', 230, 50] },
  bonds: [['o1', 'o2', 1], ['o1', 'h1', 1], ['o2', 'h2', 1]],
  pairs: [['o1', 230, 300], ['o2', 50, 120]],
};

// --- Which bonds are double? Connections only. (apchem-08-skeleton-double-bonds) ---
figures['skeleton-acrylic-acid'] = {
  width: 450, height: 200,
  atoms: {
    ca: ['C', 110, 120], h1: ['H', 60, 80], h2: ['H', 60, 160],
    cb: ['C', 190, 120], h3: ['H', 190, 55],
    cc: ['C', 270, 120], o1: ['O', 270, 50],
    o2: ['O', 350, 120], h4: ['H', 410, 120],
  },
  bonds: [['ca', 'h1', 1], ['ca', 'h2', 1], ['ca', 'cb', 1], ['cb', 'h3', 1], ['cb', 'cc', 1], ['cc', 'o1', 1], ['cc', 'o2', 1], ['o2', 'h4', 1]],
  labels: [['1', 150, 148], ['2', 230, 148], ['3', 294, 85], ['4', 310, 148]],
};

// --- The Lewis structure of ClF₃ (apchem-08-clf3-lewis-drawn) ---
const clf3 = { cl: ['Cl', 160, 110], fu: ['F', 160, 38], fd: ['F', 160, 182], fl: ['F', 82, 110] };
const fPairs = [['fu', 180, 270, 0], ['fd', 180, 90, 0], ['fl', 270, 180, 90]];
figures['clf3-one-pair'] = { width: 270, height: 220, atoms: clf3, bonds: [['cl', 'fu', 1], ['cl', 'fd', 1], ['cl', 'fl', 1]], pairs: [...fPairs, ['cl', 0]] };
figures['clf3-two-pairs'] = { width: 270, height: 220, atoms: clf3, bonds: [['cl', 'fu', 1], ['cl', 'fd', 1], ['cl', 'fl', 1]], pairs: [...fPairs, ['cl', 330, 30]] };
figures['clf3-three-pairs'] = { width: 270, height: 220, atoms: clf3, bonds: [['cl', 'fu', 1], ['cl', 'fd', 1], ['cl', 'fl', 1]], pairs: [...fPairs, ['cl', [315, 8], [0, 6], [45, 8]]] };
figures['clf3-double-bond'] = {
  width: 270, height: 220, atoms: clf3,
  bonds: [['cl', 'fu', 1], ['cl', 'fd', 1], ['cl', 'fl', 2]],
  pairs: [['fu', 180, 270, 0], ['fd', 180, 90, 0], ['fl', 225, 135], ['cl', 330, 30]],
};

// --- Which element is X? (apchem-08-identify-x-xf4) ---
figures['identify-x-xf4'] = {
  width: 320, height: 240,
  atoms: { x: ['X', 160, 120], fu: ['F', 160, 42], fd: ['F', 160, 198], fl: ['F', 82, 120], fr: ['F', 238, 120] },
  bonds: [['x', 'fu', 1], ['x', 'fd', 1], ['x', 'fl', 1], ['x', 'fr', 1]],
  pairs: [['x', [315, 10]], ['fu', 180, 270, 0], ['fd', 180, 90, 0], ['fl', 270, 180, 90], ['fr', 270, 0, 90]],
};

// --- SO₂Cl₂ with formal charges closest to zero (apchem-08-so2cl2-formal-charge) ---
const so2cl2 = { s: ['S', 160, 120], ou: ['O', 160, 42], od: ['O', 160, 198], cll: ['Cl', 74, 120], clr: ['Cl', 246, 120] };
const clPairs = [['cll', 270, 180, 90], ['clr', 270, 0, 90]];
const so2cl2Bonds = (up, down) => [['s', 'ou', up], ['s', 'od', down], ['s', 'cll', 1], ['s', 'clr', 1]];
const oPairs = (id, order, side) => [id, ...(order === 2 ? [side - 45, side + 45] : [side - 90, side, side + 90])];
figures['so2cl2-single'] = { width: 320, height: 240, atoms: so2cl2, bonds: so2cl2Bonds(1, 1), pairs: [...clPairs, oPairs('ou', 1, 270), oPairs('od', 1, 90)] };
figures['so2cl2-double'] = { width: 320, height: 240, atoms: so2cl2, bonds: so2cl2Bonds(2, 2), pairs: [...clPairs, oPairs('ou', 2, 270), oPairs('od', 2, 90)] };
figures['so2cl2-one-double'] = { width: 320, height: 240, atoms: so2cl2, bonds: so2cl2Bonds(2, 1), pairs: [...clPairs, oPairs('ou', 2, 270), oPairs('od', 1, 90)] };
figures['so2cl2-double-pair'] = {
  width: 320, height: 240, atoms: so2cl2, bonds: so2cl2Bonds(2, 2),
  pairs: [...clPairs, oPairs('ou', 2, 270), oPairs('od', 2, 90), ['s', [45, 10]]],
};

// --- Hybridization count, lone pairs not shown (apchem-09-count-hybridizations) ---
figures['hybrid-count'] = {
  width: 520, height: 200,
  atoms: {
    c1: ['C', 70, 110], h1: ['H', 70, 50], h2: ['H', 70, 170], h3: ['H', 20, 110],
    c2: ['C', 150, 110], h4: ['H', 150, 170], o: ['O', 150, 45], h5: ['H', 205, 45],
    c3: ['C', 230, 110], h6: ['H', 230, 170],
    c4: ['C', 310, 110], h7: ['H', 310, 50],
    c5: ['C', 390, 110], n: ['N', 470, 110],
  },
  bonds: [
    ['c1', 'h1', 1], ['c1', 'h2', 1], ['c1', 'h3', 1], ['c1', 'c2', 1], ['c2', 'h4', 1], ['c2', 'o', 1], ['o', 'h5', 1],
    ['c2', 'c3', 1], ['c3', 'h6', 1], ['c3', 'c4', 2], ['c4', 'h7', 1], ['c4', 'c5', 1], ['c5', 'n', 3],
  ],
};

// --- σ and π bonds, lone pairs not shown (apchem-09-count-sigma-pi-drawn) ---
figures['sigma-pi-count'] = {
  width: 560, height: 200,
  atoms: {
    c1: ['C', 70, 110], h1: ['H', 30, 70], h2: ['H', 30, 150],
    c2: ['C', 145, 110], h3: ['H', 145, 170],
    c3: ['C', 225, 110], c4: ['C', 305, 110],
    c5: ['C', 385, 110], h4: ['H', 385, 50], h5: ['H', 385, 170],
    o: ['O', 465, 110], h6: ['H', 525, 110],
  },
  bonds: [
    ['c1', 'h1', 1], ['c1', 'h2', 1], ['c1', 'c2', 2], ['c2', 'h3', 1], ['c2', 'c3', 1], ['c3', 'c4', 3],
    ['c4', 'c5', 1], ['c5', 'h4', 1], ['c5', 'h5', 1], ['c5', 'o', 1], ['o', 'h6', 1],
  ],
};

// --- AsH₃ in 3D: one bond toward the viewer, one away (apchem-09-ash3-drawn) ---
figures['ash3-3d'] = {
  width: 260, height: 200,
  atoms: { as: ['As', 130, 85], h1: ['H', 60, 135], h2: ['H', 175, 160], h3: ['H', 205, 120] },
  bonds: [['as', 'h1', 1], ['as', 'h2', 1, 'wedge'], ['as', 'h3', 1, 'dash']],
  pairs: [['as', 270]],
};

// --- A central atom with two bonds and one lone pair (apchem-09-domains-drawing) ---
figures['two-bonds-one-pair'] = {
  width: 260, height: 200,
  atoms: { a: ['A', 130, 115], b1: ['B', 60, 160], b2: ['B', 200, 160] },
  bonds: [['a', 'b1', 1], ['a', 'b2', 1]],
  // The lone pair as a lobe above A.
  extra: `<path d="M130,95 C95,55 105,22 130,22 C155,22 165,55 130,95 Z" fill="none" stroke="${INK}" stroke-width="2.2"/>
<circle cx="124" cy="45" r="2.8" fill="${INK}"/><circle cx="136" cy="45" r="2.8" fill="${INK}"/>`,
};

mkdirSync(OUT, { recursive: true });
for (const [name, fig] of Object.entries(figures)) writeFileSync(join(OUT, `${name}.svg`), draw(fig) + '\n');
console.log(`Wrote ${Object.keys(figures).length} figures to ${OUT}`);
