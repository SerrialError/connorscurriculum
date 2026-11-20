// Ball-and-stick models for the 3D molecule viewer (components/molecule/). Shapes are the ideal
// VSEPR geometries, not measured structures: every bond around a central atom has the same length
// and lone pairs are drawn where VSEPR puts them. Coordinates use y up, with the viewer on +z.

export type Vec = [number, number, number];

export interface Atom {
  el: string;
  pos: Vec;
}

export interface Bond {
  a: number;
  b: number;
  order: 1 | 2 | 3;
}

export interface LonePair {
  atom: number;
  dir: Vec;
}

/** A bond angle to mark: the angle at `at` between the bonds to atoms `from` and `to`. */
export interface AngleMark {
  at: number;
  from: number;
  to: number;
  label: string;
}

export interface Molecule {
  /** Formula as text, with charge, e.g. "SO₄²⁻". */
  formula: string;
  atoms: Atom[];
  bonds: Bond[];
  lonePairs: LonePair[];
  angles: AngleMark[];
  /** Electron-domain geometry and molecular geometry, as the class table names them. */
  domainGeometry: string;
  molecularGeometry: string;
  /** Short note under the model, e.g. which atom the geometry describes. */
  note?: string;
}

// ---------------------------------------------------------------------------
// VSEPR shapes
// ---------------------------------------------------------------------------

export interface Shape {
  domains: number;
  lonePairs: number;
  domainGeometry: string;
  molecularGeometry: string;
  /** Bond angles to show in the explorer, including how lone pairs squeeze them. */
  idealAngles: string;
  hybridization: string;
  /** A molecule with this shape that has a model below. */
  example: string;
  /** More molecules and ions with this shape, as text. */
  examples: string[];
}

/** Every shape in the class's molecular-geometry table, in table order. */
export const SHAPES: Shape[] = [
  { domains: 2, lonePairs: 0, domainGeometry: 'linear', molecularGeometry: 'linear', idealAngles: '180°', hybridization: 'sp', example: 'co2', examples: ['CO₂', 'HCN', 'BeCl₂'] },
  { domains: 3, lonePairs: 0, domainGeometry: 'trigonal planar', molecularGeometry: 'trigonal planar', idealAngles: '120°', hybridization: 'sp²', example: 'bf3', examples: ['BF₃', 'SO₃', 'NO₃⁻'] },
  { domains: 3, lonePairs: 1, domainGeometry: 'trigonal planar', molecularGeometry: 'bent', idealAngles: 'less than 120°', hybridization: 'sp²', example: 'so2', examples: ['SO₂', 'O₃', 'NO₂⁻'] },
  { domains: 4, lonePairs: 0, domainGeometry: 'tetrahedral', molecularGeometry: 'tetrahedral', idealAngles: '109.5°', hybridization: 'sp³', example: 'ch4', examples: ['CH₄', 'NH₄⁺', 'SO₄²⁻'] },
  { domains: 4, lonePairs: 1, domainGeometry: 'tetrahedral', molecularGeometry: 'trigonal pyramidal', idealAngles: 'less than 109.5° (107° in NH₃)', hybridization: 'sp³', example: 'nh3', examples: ['NH₃', 'PCl₃', 'H₃O⁺'] },
  { domains: 4, lonePairs: 2, domainGeometry: 'tetrahedral', molecularGeometry: 'bent', idealAngles: 'less than 109.5° (104.5° in H₂O)', hybridization: 'sp³', example: 'h2o', examples: ['H₂O', 'OF₂', 'SCl₂'] },
  { domains: 5, lonePairs: 0, domainGeometry: 'trigonal bipyramidal', molecularGeometry: 'trigonal bipyramidal', idealAngles: '90°, 120°, and 180°', hybridization: 'sp³d', example: 'pcl5', examples: ['PCl₅', 'PF₅'] },
  { domains: 5, lonePairs: 1, domainGeometry: 'trigonal bipyramidal', molecularGeometry: 'seesaw', idealAngles: 'less than 90° and 120°', hybridization: 'sp³d', example: 'sf4', examples: ['SF₄', 'SeF₄'] },
  { domains: 5, lonePairs: 2, domainGeometry: 'trigonal bipyramidal', molecularGeometry: 'T-shaped', idealAngles: 'less than 90°', hybridization: 'sp³d', example: 'clf3', examples: ['ClF₃', 'BrF₃'] },
  { domains: 5, lonePairs: 3, domainGeometry: 'trigonal bipyramidal', molecularGeometry: 'linear', idealAngles: '180°', hybridization: 'sp³d', example: 'xef2', examples: ['XeF₂', 'I₃⁻'] },
  { domains: 6, lonePairs: 0, domainGeometry: 'octahedral', molecularGeometry: 'octahedral', idealAngles: '90° and 180°', hybridization: 'sp³d²', example: 'sf6', examples: ['SF₆'] },
  { domains: 6, lonePairs: 1, domainGeometry: 'octahedral', molecularGeometry: 'square pyramidal', idealAngles: 'less than 90°', hybridization: 'sp³d²', example: 'brf5', examples: ['BrF₅', 'IF₅'] },
  { domains: 6, lonePairs: 2, domainGeometry: 'octahedral', molecularGeometry: 'square planar', idealAngles: '90°', hybridization: 'sp³d²', example: 'xef4', examples: ['XeF₄', 'ICl₄⁻'] },
];

export function shapeFor(domains: number, lonePairs: number): Shape | undefined {
  return SHAPES.find((s) => s.domains === domains && s.lonePairs === lonePairs);
}

const S = Math.sqrt(2 / 3); // sin 54.74°, half the tetrahedral angle
const C = Math.sqrt(1 / 3); // cos 54.74°
const R = Math.sqrt(8) / 3; // tetrahedron: radius of the three lower corners when one points up
const Q = Math.sqrt(3) / 2;

/**
 * Directions of the electron domains around a central atom; the first `lonePairs` are the lone
 * pairs. Each case is oriented so the molecule reads well from the default view.
 */
export function domainDirections(domains: number, lonePairs: number): Vec[] {
  const up: Vec = [0, 1, 0];
  const down: Vec = [0, -1, 0];
  switch (`${domains}/${lonePairs}`) {
    case '2/0':
      return [[1, 0, 0], [-1, 0, 0]];
    case '3/0':
    case '3/1':
      return [up, [-Q, -0.5, 0], [Q, -0.5, 0]];
    case '4/0':
    case '4/1':
      return [up, [0, -1 / 3, R], [-R * Q, -1 / 3, -R / 2], [R * Q, -1 / 3, -R / 2]];
    case '4/2':
      // Two lone pairs: put the bonds in the plane of the page so the bent shape faces the viewer.
      return [[0, C, S], [0, C, -S], [S, -C, 0], [-S, -C, 0]];
    // Five domains: lone pairs always go in equatorial positions.
    case '5/0':
      return [up, down, [1, 0, 0], [-0.5, 0, Q], [-0.5, 0, -Q]];
    case '5/1':
      return [[-1, 0, 0], up, down, [0.5, 0, Q], [0.5, 0, -Q]];
    case '5/2':
      return [[-0.5, 0, Q], [-0.5, 0, -Q], up, down, [1, 0, 0]];
    case '5/3':
      return [[1, 0, 0], [-0.5, 0, Q], [-0.5, 0, -Q], up, down];
    // Six domains: a second lone pair goes opposite the first.
    case '6/0':
      return [up, down, [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    case '6/1':
      return [down, up, [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    case '6/2':
      return [up, down, [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    default:
      throw new Error(`no VSEPR shape with ${domains} domains and ${lonePairs} lone pairs`);
  }
}

const bondLength = (el: string) => (el === 'H' ? 0.95 : 1.25);

const angleBetween = (u: Vec, v: Vec) => (Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]))) * 180) / Math.PI;

/** Lone pairs squeeze the bond angles, except where they sit symmetrically (XeF₂, XeF₄). */
function squeezed(shape: Shape): boolean {
  return shape.lonePairs > 0 && !['linear', 'square planar'].includes(shape.molecularGeometry);
}

/**
 * Bond angles worth marking: one example of each different ideal angle between bonds. 180° is left
 * out when a smaller angle is marked (the axial bonds of a trigonal bipyramid, say).
 */
function angleMarks(dirs: Vec[], shape: Shape): AngleMark[] {
  const found = new Map<number, AngleMark>();
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const deg = Math.round(angleBetween(dirs[i]!, dirs[j]!) * 10) / 10;
      if (found.has(deg)) continue;
      const shown = deg === 109.5 || deg === 180 || deg === 120 || deg === 90 ? deg : Math.round(deg);
      found.set(deg, { at: 0, from: i + 1, to: j + 1, label: `${squeezed(shape) ? '<' : ''}${shown}°` });
    }
  }
  if (found.size > 1) found.delete(180);
  return [...found.values()];
}

type Ligand = string | { el: string; order: 1 | 2 | 3 };

/** A molecule with one central atom, built from its VSEPR shape. */
export function vsepr(formula: string, central: string, ligands: Ligand[], lonePairs: number, note?: string): Molecule {
  const domains = ligands.length + lonePairs;
  const shape = shapeFor(domains, lonePairs);
  if (!shape) throw new Error(`${formula}: no VSEPR shape with ${domains} domains and ${lonePairs} lone pairs`);
  const dirs = domainDirections(domains, lonePairs);
  const bondDirs = dirs.slice(lonePairs);
  const atoms: Atom[] = [{ el: central, pos: [0, 0, 0] }];
  const bonds: Bond[] = [];
  ligands.forEach((ligand, i) => {
    const { el, order } = typeof ligand === 'string' ? { el: ligand, order: 1 as const } : ligand;
    const d = bondDirs[i]!;
    const len = bondLength(el);
    atoms.push({ el, pos: [d[0] * len, d[1] * len, d[2] * len] });
    bonds.push({ a: 0, b: i + 1, order });
  });
  return {
    formula,
    atoms,
    bonds,
    lonePairs: dirs.slice(0, lonePairs).map((dir) => ({ atom: 0, dir })),
    angles: angleMarks(bondDirs, shape),
    domainGeometry: shape.domainGeometry,
    molecularGeometry: shape.molecularGeometry,
    note,
  };
}

// ---------------------------------------------------------------------------
// Molecules with more than one interior atom
// ---------------------------------------------------------------------------

function ethylene(): Molecule {
  const cc = 0.67;
  const h = (x: number, sy: number): Vec => [x + Math.sign(x) * 0.95 * 0.5, sy * 0.95 * Q, 0];
  return {
    formula: 'C₂H₄',
    atoms: [
      { el: 'C', pos: [-cc, 0, 0] },
      { el: 'C', pos: [cc, 0, 0] },
      { el: 'H', pos: h(-cc, 1) },
      { el: 'H', pos: h(-cc, -1) },
      { el: 'H', pos: h(cc, 1) },
      { el: 'H', pos: h(cc, -1) },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 },
      { a: 0, b: 2, order: 1 },
      { a: 0, b: 3, order: 1 },
      { a: 1, b: 4, order: 1 },
      { a: 1, b: 5, order: 1 },
    ],
    lonePairs: [],
    angles: [{ at: 1, from: 0, to: 4, label: '120°' }],
    domainGeometry: 'trigonal planar',
    molecularGeometry: 'trigonal planar',
    note: 'Around each carbon. The whole molecule is flat.',
  };
}

function nitricAcid(): Molecule {
  const L = 1.25;
  const o3: Vec = [L * Q, -L * 0.5, 0];
  // The O–H bond bends about 105° away from the N–O bond.
  const a = (-105 * Math.PI) / 180;
  return {
    formula: 'HNO₃',
    atoms: [
      { el: 'N', pos: [0, 0, 0] },
      { el: 'O', pos: [0, L, 0] },
      { el: 'O', pos: [-L * Q, -L * 0.5, 0] },
      { el: 'O', pos: o3 },
      { el: 'H', pos: [o3[0] + 0.95 * Math.cos(a), o3[1] + 0.95 * Math.sin(a), 0] },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 },
      { a: 0, b: 2, order: 1 },
      { a: 0, b: 3, order: 1 },
      { a: 3, b: 4, order: 1 },
    ],
    lonePairs: [],
    angles: [{ at: 0, from: 1, to: 2, label: '120°' }],
    domainGeometry: 'trigonal planar',
    molecularGeometry: 'trigonal planar',
    note: 'Around the nitrogen. One resonance structure is shown; the N=O can be drawn to either O without the H.',
  };
}

const d = (el: string): Ligand => ({ el, order: 2 });
const t = (el: string): Ligand => ({ el, order: 3 });

/** Every model a lesson can show, by id: <Molecule id="sf4" />. */
export const MOLECULES: Record<string, Molecule> = {
  // One example per shape (the VSEPR explorer).
  co2: vsepr('CO₂', 'C', [d('O'), d('O')], 0),
  bf3: vsepr('BF₃', 'B', ['F', 'F', 'F'], 0),
  so2: vsepr('SO₂', 'S', [d('O'), 'O'], 1, 'One resonance structure is shown; the double bond can be drawn to either O.'),
  ch4: vsepr('CH₄', 'C', ['H', 'H', 'H', 'H'], 0),
  nh3: vsepr('NH₃', 'N', ['H', 'H', 'H'], 1),
  h2o: vsepr('H₂O', 'O', ['H', 'H'], 2),
  pcl5: vsepr('PCl₅', 'P', ['Cl', 'Cl', 'Cl', 'Cl', 'Cl'], 0),
  sf4: vsepr('SF₄', 'S', ['F', 'F', 'F', 'F'], 1),
  clf3: vsepr('ClF₃', 'Cl', ['F', 'F', 'F'], 2),
  xef2: vsepr('XeF₂', 'Xe', ['F', 'F'], 3),
  sf6: vsepr('SF₆', 'S', ['F', 'F', 'F', 'F', 'F', 'F'], 0),
  brf5: vsepr('BrF₅', 'Br', ['F', 'F', 'F', 'F', 'F'], 1),
  xef4: vsepr('XeF₄', 'Xe', ['F', 'F', 'F', 'F'], 2),
  bef2: vsepr('BeF₂', 'Be', ['F', 'F'], 0),

  // The Lewis structures lab, items 1–20.
  ncl3: vsepr('NCl₃', 'N', ['Cl', 'Cl', 'Cl'], 1),
  hcn: vsepr('HCN', 'C', ['H', t('N')], 0),
  h2s: vsepr('H₂S', 'S', ['H', 'H'], 2),
  seo3: vsepr('SeO₃²⁻', 'Se', ['O', 'O', 'O'], 1),
  hno3: nitricAcid(),
  ch2cl2: vsepr('CH₂Cl₂', 'C', ['H', 'H', 'Cl', 'Cl'], 0),
  scl2: vsepr('SCl₂', 'S', ['Cl', 'Cl'], 2),
  icl4: vsepr('ICl₄⁻', 'I', ['Cl', 'Cl', 'Cl', 'Cl'], 2),
  scl6: vsepr('SCl₆', 'S', ['Cl', 'Cl', 'Cl', 'Cl', 'Cl', 'Cl'], 0),
  h3o: vsepr('H₃O⁺', 'O', ['H', 'H', 'H'], 1),
  clo3: vsepr('ClO₃⁻', 'Cl', ['O', 'O', 'O'], 1),
  pcl4: vsepr('PCl₄⁺', 'P', ['Cl', 'Cl', 'Cl', 'Cl'], 0),
  sih4: vsepr('SiH₄', 'Si', ['H', 'H', 'H', 'H'], 0),
  no2: vsepr('NO₂⁻', 'N', [d('O'), 'O'], 1, 'One resonance structure is shown; the double bond can be drawn to either O.'),
  brf3: vsepr('BrF₃', 'Br', ['F', 'F', 'F'], 2),
  sef4: vsepr('SeF₄', 'Se', ['F', 'F', 'F', 'F'], 1),
  po4: vsepr('PO₄³⁻', 'P', ['O', 'O', 'O', 'O'], 0),
  c2h4: ethylene(),
};

export function getMolecule(id: string): Molecule {
  const m = MOLECULES[id];
  if (!m) throw new Error(`<Molecule id="${id}">: no model with that id (see src/lib/molecules.ts)`);
  return m;
}

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------

/** Atom colors: the usual CPK colors, which match the class model kit for H, C, N, O, and Cl. */
export const ELEMENT_COLORS: Record<string, string> = {
  H: '#f2f2f2',
  Be: '#b8d84a',
  B: '#f0a0a0',
  C: '#3a3a3a',
  N: '#3359e0',
  O: '#e0261e',
  F: '#8fd14f',
  Si: '#d6b48c',
  P: '#f08a1c',
  S: '#e8d23a',
  Cl: '#2fb83a',
  Se: '#e09a2a',
  Br: '#9a2a2a',
  I: '#8a2a9a',
  Xe: '#3f9fb5',
};

/** Drawn sizes, roughly following covalent radii. */
export function atomRadius(el: string): number {
  if (el === 'H') return 0.2;
  if (['B', 'Be', 'C', 'N', 'O', 'F'].includes(el)) return 0.3;
  if (['Si', 'P', 'S', 'Cl'].includes(el)) return 0.36;
  return 0.42;
}
