// Orbital pictures for the 3D orbital viewer (components/molecule/OrbitalViewer.svelte): how atomic
// orbitals mix into hybrids, how hybrids overlap into σ bonds, how leftover p orbitals overlap side
// by side into π bonds, and how π electrons spread out (delocalize). Each scene is a few stages
// you step through. Shapes are idealized (VSEPR angles, equal bond lengths), not to scale.
import { type Vec, domainDirections } from './molecules';

/** s, p, or a hybrid. The number is how many p orbitals were mixed with the s (sp = 1, sp² = 2, sp³ = 3). */
export type OrbitalType = 's' | 'p' | 1 | 2 | 3;

/** What an orbital is, which sets its color. */
export type OrbitalRole = 's' | 'p' | 'hybrid' | 'partner';

export interface OrbitalShape {
  kind: 'orbital';
  at: Vec;
  /** The direction the (larger) lobe points. */
  dir: Vec;
  type: OrbitalType;
  role: OrbitalRole;
  /** Electrons drawn in it as dots; 'empty' draws it faint; null draws no dots. */
  electrons: 0 | 1 | 2 | 'empty' | null;
  label?: string;
  /** Lobe length. */
  size?: number;
}

export interface AtomShape {
  kind: 'atom';
  el: string;
  at: Vec;
}

/** A σ bond, drawn as a stick along the line between the nuclei. */
export interface SigmaShape {
  kind: 'sigma';
  from: Vec;
  to: Vec;
  label?: string;
}

/**
 * π electron density: a sausage above and a sausage below each segment (on the ±`normal` sides).
 * One segment is an ordinary π bond; several joined segments are a delocalized π system.
 */
export interface CloudShape {
  kind: 'cloud';
  segments: [Vec, Vec][];
  normal: Vec;
  label?: string;
}

export interface LabelShape {
  kind: 'label';
  at: Vec;
  text: string;
}

export type Shape = OrbitalShape | AtomShape | SigmaShape | CloudShape | LabelShape;

export interface Stage {
  /** Short name for the step button. */
  title: string;
  /** One or two sentences under the model saying what changed. */
  caption: string;
  shapes: Shape[];
}

export interface OrbitalScene {
  id: string;
  /** Formula as text, e.g. "CH₄". */
  formula: string;
  /** The atom being hybridized, for the orbital box diagram. */
  boxes?: { el: BoxElement; hybrid: 1 | 2 | 3 };
  stages: Stage[];
}

export type BoxElement = 'Be' | 'B' | 'C' | 'N' | 'O';

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a: Vec): Vec => scale(a, 1 / Math.hypot(...a));
const at = (origin: Vec, dir: Vec, dist: number): Vec => add(origin, scale(unit(dir), dist));
/** A unit vector in the xy-plane at `deg` degrees from +x. */
const polar = (deg: number): Vec => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0];
const O: Vec = [0, 0, 0];
const X: Vec = [1, 0, 0];
const Y: Vec = [0, 1, 0];
const Z: Vec = [0, 0, 1];

const HYBRID_NAME = { 1: 'sp', 2: 'sp²', 3: 'sp³' } as const;

/** An orbital shape with defaults. */
function orb(
  atPos: Vec,
  dir: Vec,
  type: OrbitalType,
  electrons: OrbitalShape['electrons'],
  label?: string,
  role: OrbitalRole = type === 's' ? 's' : type === 'p' ? 'p' : 'hybrid',
): OrbitalShape {
  return { kind: 'orbital', at: atPos, dir: unit(dir), type, role, electrons, label };
}

const atom = (el: string, p: Vec): AtomShape => ({ kind: 'atom', el, at: p });
const sigma = (from: Vec, to: Vec, label = 'σ'): SigmaShape => ({ kind: 'sigma', from, to, label });
const pi = (from: Vec, to: Vec, normal: Vec, label = 'π'): CloudShape => ({ kind: 'cloud', segments: [[from, to]], normal, label });

/** A hydrogen atom at `p` with its 1s orbital (1 electron). */
const hydrogen = (p: Vec, label?: string): Shape[] => [atom('H', p), { ...orb(p, X, 's', 1, label, 'partner'), size: 0.42 }];

// ---------------------------------------------------------------------------
// Hybridization: atomic orbitals → hybrids → σ bonds
// ---------------------------------------------------------------------------

const P_LABELS: [Vec, string][] = [
  [X, '2pₓ'],
  [Y, '2p_y'],
  [Z, '2p_z'],
];

/** Stage 1 of a hybridization scene: the central atom's 2s and three 2p orbitals. */
function valenceOrbitals(el: string, s: 0 | 1 | 2, p: [OrbitalShape['electrons'], OrbitalShape['electrons'], OrbitalShape['electrons']]): Shape[] {
  return [
    atom(el, O),
    { ...orb(O, X, 's', s, '2s'), size: 0.55 },
    ...P_LABELS.map(([dir, name], i) => orb(O, dir, 'p', p[i]!, p[i] === 'empty' ? `${name} (empty)` : name)),
  ];
}

interface Domain {
  dir: Vec;
  electrons: 1 | 2;
}

/**
 * The three stages for one central atom: valence orbitals, hybrids, then σ bonds to `partners`
 * (an H 1s, or an F 2p pointing back at the center) in the hybrids that hold one electron.
 */
function hybridScene(
  id: string,
  formula: string,
  el: BoxElement,
  hybrid: 1 | 2 | 3,
  ground: Parameters<typeof valenceOrbitals>,
  domains: Domain[],
  partner: 'H' | 'F',
  captions: [string, string, string],
): OrbitalScene {
  const name = HYBRID_NAME[hybrid];
  const hybrids: Shape[] = domains.map((d) => orb(O, d.dir, hybrid, d.electrons, d.electrons === 2 ? 'lone pair' : name));
  // Unhybridized p orbitals are left over when fewer than three p orbitals were mixed in.
  const leftover: Shape[] =
    hybrid === 3 ? [] : (hybrid === 2 ? [Z] : [Y, Z]).map((dir) => orb(O, dir, 'p', 'empty', 'empty p'));
  const bonded: Shape[] = [];
  for (const d of domains) {
    if (d.electrons !== 1) continue;
    const dist = partner === 'H' ? 1.45 : 1.75;
    const p = at(O, d.dir, dist);
    bonded.push(sigma(O, p));
    if (partner === 'H') bonded.push(...hydrogen(p));
    else bonded.push(atom('F', p), { ...orb(p, scale(d.dir, -1), 'p', 1, undefined, 'partner'), size: 0.75 });
  }
  return {
    id,
    formula,
    boxes: { el, hybrid },
    stages: [
      { title: 'Atomic orbitals', caption: captions[0], shapes: valenceOrbitals(...ground) },
      { title: `Mix into ${name}`, caption: captions[1], shapes: [atom(el, O), ...hybrids, ...leftover] },
      { title: 'Form σ bonds', caption: captions[2], shapes: [atom(el, O), ...hybrids, ...leftover, ...bonded] },
    ],
  };
}

const tetra = (lonePairs: number) => domainDirections(4, lonePairs);

const methane = hybridScene(
  'ch4',
  'CH₄',
  'C',
  3,
  ['C', 2, [1, 1, 'empty']],
  tetra(0).map((dir) => ({ dir, electrons: 1 })),
  'H',
  [
    "Carbon's valence orbitals: one 2s (holding 2 electrons) and three 2p at 90° to each other, only two of them with an electron. As they are, they can't make four identical bonds 109.5° apart.",
    'The 2s and all three 2p orbitals mix into four identical sp³ hybrids, each with one big lobe pointing to a corner of a tetrahedron and one electron in it.',
    "Each sp³ lobe overlaps an H 1s orbital head-on: four σ bonds, 109.5° apart. That's methane's tetrahedral shape.",
  ],
);

const ammonia = hybridScene(
  'nh3',
  'NH₃',
  'N',
  3,
  ['N', 2, [1, 1, 1]],
  tetra(1).map((dir, i) => ({ dir, electrons: i === 0 ? 2 : 1 })),
  'H',
  [
    'Nitrogen has 5 valence electrons: two in 2s and one in each 2p.',
    'Mixing gives four sp³ hybrids. Five electrons fill them as 2 + 1 + 1 + 1: one hybrid holds the lone pair.',
    'The three half-filled hybrids each overlap an H 1s orbital (three σ bonds). The lone pair stays in the fourth hybrid, so the molecule is trigonal pyramidal.',
  ],
);

const water = hybridScene(
  'h2o',
  'H₂O',
  'O',
  3,
  ['O', 2, [2, 1, 1]],
  tetra(2).map((dir, i) => ({ dir, electrons: i < 2 ? 2 : 1 })),
  'H',
  [
    'Oxygen has 6 valence electrons: 2s², and 2p with one pair and two unpaired electrons.',
    'Four sp³ hybrids, filled 2 + 2 + 1 + 1: two lone pairs and two half-filled hybrids.',
    'Two σ bonds to H, and two lone pairs in the other hybrids: a bent molecule with a tetrahedral arrangement of electron domains.',
  ],
);

const boronTrifluoride = hybridScene(
  'bf3',
  'BF₃',
  'B',
  2,
  ['B', 2, [1, 'empty', 'empty']],
  domainDirections(3, 0).map((dir) => ({ dir, electrons: 1 })),
  'F',
  [
    "Boron has only 3 valence electrons: 2s² 2p¹. Only one is unpaired, but it makes three bonds.",
    "The 2s and two 2p orbitals mix into three sp² hybrids, 120° apart in a plane, each with one electron. The third 2p wasn't mixed in: it stays, empty, at 90° to the plane.",
    "Each sp² lobe overlaps a 2p orbital on an F atom: three σ bonds in a flat triangle. The empty p orbital is why BF₃ can accept a lone pair from NH₃.",
  ],
);

const berylliumFluoride = hybridScene(
  'bef2',
  'BeF₂',
  'Be',
  1,
  ['Be', 2, ['empty', 'empty', 'empty']],
  [
    { dir: X, electrons: 1 },
    { dir: scale(X, -1), electrons: 1 },
  ],
  'F',
  [
    'Beryllium has 2 valence electrons, both paired in 2s. Its 2p orbitals are empty, so as it is it has nothing to share.',
    'The 2s and one 2p mix into two sp hybrids pointing opposite ways (180°), one electron in each. Two 2p orbitals are left over, empty.',
    'Each sp lobe overlaps an F 2p orbital: two σ bonds in a straight line.',
  ],
);

// ---------------------------------------------------------------------------
// σ and π bonds
// ---------------------------------------------------------------------------

/** A carbon's sp² or sp hybrids toward its neighbors, each with one electron. */
const hybridsToward = (c: Vec, targets: Vec[], hybrid: 1 | 2): Shape[] => targets.map((tPos) => orb(c, sub(tPos, c), hybrid, 1, HYBRID_NAME[hybrid]));

function ethylene(): OrbitalScene {
  const c1: Vec = [-0.75, 0, 0];
  const c2: Vec = [0.75, 0, 0];
  const hs: Vec[] = [at(c1, polar(120), 1.2), at(c1, polar(240), 1.2), at(c2, polar(60), 1.2), at(c2, polar(-60), 1.2)];
  const frame = [atom('C', c1), atom('C', c2), ...hs.flatMap((h) => [atom('H', h)])];
  const sigmas = [sigma(c1, c2), sigma(c1, hs[0]!), sigma(c1, hs[1]!), sigma(c2, hs[2]!), sigma(c2, hs[3]!)];
  const pOrbitals = [orb(c1, Z, 'p', 1, 'p'), orb(c2, Z, 'p', 1, 'p')];
  return {
    id: 'c2h4',
    formula: 'C₂H₄',
    boxes: { el: 'C', hybrid: 2 },
    stages: [
      {
        title: 'sp² + p',
        caption:
          'Each carbon is sp²: three hybrids in the plane (toward the other C and two H atoms), plus one unhybridized p orbital standing straight up and down, with one electron.',
        shapes: [
          ...frame,
          ...hybridsToward(c1, [c2, hs[0]!, hs[1]!], 2),
          ...hybridsToward(c2, [c1, hs[2]!, hs[3]!], 2),
          ...pOrbitals,
          ...hs.map((h) => ({ ...orb(h, X, 's', 1, undefined, 'partner'), size: 0.42 })),
        ],
      },
      {
        title: 'σ bonds',
        caption:
          'Head-on overlap along the line between the nuclei makes the σ bonds: one C–C and four C–H. The two p orbitals are still separate, side by side.',
        shapes: [...frame, ...sigmas, ...pOrbitals],
      },
      {
        title: 'π bond',
        caption:
          'The parallel p orbitals overlap side by side, above and below the C–C line: one π bond. C=C is 1 σ + 1 π, so ethylene has 5 σ and 1 π. Twisting one end would pull the p orbitals apart and break the π bond, which is why there is no rotation around a double bond.',
        shapes: [...frame, ...sigmas, pi(c1, c2, Z)],
      },
    ],
  };
}

function acetylene(): OrbitalScene {
  const c1: Vec = [-0.65, 0, 0];
  const c2: Vec = [0.65, 0, 0];
  const h1: Vec = [-1.8, 0, 0];
  const h2: Vec = [1.8, 0, 0];
  const frame = [atom('C', c1), atom('C', c2), atom('H', h1), atom('H', h2)];
  const sigmas = [sigma(c1, c2), sigma(c1, h1), sigma(c2, h2)];
  const ps = [c1, c2].flatMap((c) => [orb(c, Y, 'p', 1, 'p'), orb(c, Z, 'p', 1, 'p')]);
  return {
    id: 'c2h2',
    formula: 'C₂H₂',
    boxes: { el: 'C', hybrid: 1 },
    stages: [
      {
        title: 'sp + 2 p',
        caption:
          'Each carbon is sp: two hybrids pointing opposite ways along the axis, and two leftover p orbitals at right angles to the axis and to each other.',
        shapes: [...frame, ...hybridsToward(c1, [c2, h1], 1), ...hybridsToward(c2, [c1, h2], 1), ...ps],
      },
      {
        title: 'σ bonds',
        caption: 'Head-on overlap makes three σ bonds along one straight line: H–C, C–C, and C–H.',
        shapes: [...frame, ...sigmas, ...ps],
      },
      {
        title: 'Two π bonds',
        caption:
          'Each pair of parallel p orbitals overlaps side by side: one π bond above and below the axis, and a second in front and behind. C≡C is 1 σ + 2 π.',
        shapes: [...frame, ...sigmas, pi(c1, c2, Y), pi(c1, c2, Z)],
      },
    ],
  };
}

function formaldehyde(): OrbitalScene {
  const c: Vec = [-0.5, 0, 0];
  const o: Vec = [0.9, 0, 0];
  const h1 = at(c, polar(120), 1.2);
  const h2 = at(c, polar(240), 1.2);
  const lp1 = polar(60);
  const lp2 = polar(-60);
  const frame = [atom('C', c), atom('O', o), atom('H', h1), atom('H', h2)];
  const oLonePairs = [orb(o, lp1, 2, 2, 'lone pair'), orb(o, lp2, 2, 2, 'lone pair')];
  const sigmas = [sigma(c, o), sigma(c, h1), sigma(c, h2)];
  const ps = [orb(c, Z, 'p', 1, 'p'), orb(o, Z, 'p', 1, 'p')];
  return {
    id: 'h2co',
    formula: 'H₂CO',
    stages: [
      {
        title: 'Both sp²',
        caption:
          'C and O are both sp² here (each has 3 electron domains). C points its hybrids at O and the two H atoms. O points one hybrid at C, and its two lone pairs sit in the other two.',
        shapes: [...frame, ...hybridsToward(c, [o, h1, h2], 2), orb(o, sub(c, o), 2, 1, 'sp²'), ...oLonePairs, ...ps],
      },
      {
        title: 'σ bonds',
        caption: 'Three σ bonds: C–O and two C–H. The O lone pairs stay in their sp² hybrids, in the plane of the molecule.',
        shapes: [...frame, ...sigmas, ...oLonePairs, ...ps],
      },
      {
        title: 'π bond',
        caption: "The p orbitals on C and O overlap side by side into the π part of C=O. The molecule's 3 σ + 1 π bonds hold 8 electrons; the O lone pairs hold the other 4.",
        shapes: [...frame, ...sigmas, ...oLonePairs, pi(c, o, Z)],
      },
    ],
  };
}

function carbonDioxide(): OrbitalScene {
  const oL: Vec = [-1.4, 0, 0];
  const oR: Vec = [1.4, 0, 0];
  const frame = [atom('C', O), atom('O', oL), atom('O', oR)];
  // The left C=O π bond uses p_z, the right one p_y. Each O's sp² hybrids lie at right angles to its p.
  const leftLp = [orb(oL, [-0.5, Math.sqrt(3) / 2, 0], 2, 2, 'lone pair'), orb(oL, [-0.5, -Math.sqrt(3) / 2, 0], 2, 2, 'lone pair')];
  const rightLp = [orb(oR, [0.5, 0, Math.sqrt(3) / 2], 2, 2, 'lone pair'), orb(oR, [0.5, 0, -Math.sqrt(3) / 2], 2, 2, 'lone pair')];
  const sigmas = [sigma(oL, O), sigma(O, oR)];
  const ps = [orb(O, Z, 'p', 1, 'p'), orb(oL, Z, 'p', 1, 'p'), orb(O, Y, 'p', 1, 'p'), orb(oR, Y, 'p', 1, 'p')];
  return {
    id: 'co2',
    formula: 'CO₂',
    stages: [
      {
        title: 'C sp, O sp²',
        caption:
          "C is sp (2 domains), with its two leftover p orbitals at right angles. Each O is sp² (3 domains): one hybrid toward C, two holding lone pairs, and one p orbital that lines up with one of carbon's.",
        shapes: [...frame, ...hybridsToward(O, [oL, oR], 1), orb(oL, X, 2, 1, 'sp²'), orb(oR, scale(X, -1), 2, 1, 'sp²'), ...leftLp, ...rightLp, ...ps],
      },
      {
        title: 'σ bonds',
        caption: 'Two σ bonds along the axis, one to each O.',
        shapes: [...frame, ...sigmas, ...leftLp, ...rightLp, ...ps],
      },
      {
        title: 'π bonds',
        caption:
          "Two π bonds, one to each O, in planes at right angles to each other (turn the model to see it). Each C=O is 1 σ + 1 π, so CO₂ has 2 σ and 2 π. The two π bonds use different p orbitals on C, which is why carbon's p orbitals have to be at 90°.",
        shapes: [...frame, ...sigmas, ...leftLp, ...rightLp, pi(oL, O, Z), pi(O, oR, Y)],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Delocalized π bonding
// ---------------------------------------------------------------------------

function benzene(): OrbitalScene {
  const r = 1.3;
  const cs = [0, 1, 2, 3, 4, 5].map((k) => scale(polar(90 + 60 * k), r));
  const hs = [0, 1, 2, 3, 4, 5].map((k) => scale(polar(90 + 60 * k), r + 1.0));
  const frame = [...cs.map((c) => atom('C', c)), ...hs.map((h) => atom('H', h))];
  const sigmas = [...cs.map((c, k) => sigma(c, cs[(k + 1) % 6]!, '')), ...cs.map((c, k) => sigma(c, hs[k]!, ''))];
  const ring = cs.map((c, k): [Vec, Vec] => [c, cs[(k + 1) % 6]!]);
  return {
    id: 'benzene',
    formula: 'C₆H₆',
    stages: [
      {
        title: 'One structure',
        caption:
          'One resonance structure puts three π bonds in fixed places (alternating with single bonds). If that were the real molecule, the double bonds would be shorter than the single bonds. They aren\'t: all six C–C bonds are the same length.',
        shapes: [...frame, ...sigmas, ...[0, 2, 4].map((k) => pi(cs[k]!, cs[k + 1]!, Z, ''))],
      },
      {
        title: 'Six p orbitals',
        caption:
          'Every carbon is sp² with one p orbital standing straight up. All six are parallel, and each overlaps both of its neighbors equally, so no pairing is better than another.',
        shapes: [...frame, ...sigmas, ...cs.map((c) => orb(c, Z, 'p', 1))],
      },
      {
        title: 'Delocalized',
        caption:
          'The six π electrons spread around the whole ring, above and below it. They belong to all six carbons at once (delocalized), which is what the circle in the hexagon drawing means.',
        shapes: [...frame, ...sigmas, { kind: 'cloud', segments: ring, normal: Z, label: '6 π electrons shared by all 6 C' }],
      },
    ],
  };
}

function carbonate(): OrbitalScene {
  const os = [90, 210, 330].map((d) => scale(polar(d), 1.4));
  const frame = [atom('C', O), ...os.map((p) => atom('O', p))];
  const sigmas = os.map((p) => sigma(O, p, ''));
  return {
    id: 'co3',
    formula: 'CO₃²⁻',
    stages: [
      {
        title: 'One structure',
        caption:
          'One resonance structure has a C=O π bond to just one of the three O atoms. It would make that bond shorter than the other two, but in real carbonate all three are the same.',
        shapes: [...frame, ...sigmas, pi(O, os[0]!, Z)],
      },
      {
        title: 'Four p orbitals',
        caption: 'C and all three O atoms have a p orbital perpendicular to the plane, all parallel, so the π bond could form with any of the three O atoms.',
        shapes: [...frame, ...sigmas, orb(O, Z, 'p', null), ...os.map((p) => orb(p, Z, 'p', null))],
      },
      {
        title: 'Delocalized',
        caption:
          'The π electrons spread over all four atoms. Each C–O bond is an average of one double and two singles: bond order 1⅓, all three identical, each O carrying −⅔ on average.',
        shapes: [...frame, ...sigmas, { kind: 'cloud', segments: os.map((p): [Vec, Vec] => [O, p]), normal: Z, label: 'π shared by C and all 3 O' }],
      },
    ],
  };
}

function ozone(): OrbitalScene {
  const mid: Vec = [0, 0.35, 0];
  const half = (117 / 2) * (Math.PI / 180);
  const ends: Vec[] = [-1, 1].map((s): Vec => add(mid, [s * 1.3 * Math.sin(half), -1.3 * Math.cos(half), 0]));
  const frame = [atom('O', mid), ...ends.map((p) => atom('O', p))];
  const sigmas = ends.map((p) => sigma(mid, p, ''));
  return {
    id: 'o3',
    formula: 'O₃',
    stages: [
      {
        title: 'One structure',
        caption: 'One resonance structure: O=O–O. The double bond could just as well be drawn on the other side.',
        shapes: [...frame, ...sigmas, pi(ends[0]!, mid, Z)],
      },
      {
        title: 'Three p orbitals',
        caption: 'Each O has a p orbital perpendicular to the plane of the molecule. All three are parallel and overlap their neighbors.',
        shapes: [...frame, ...sigmas, ...[mid, ...ends].map((p) => orb(p, Z, 'p', null))],
      },
      {
        title: 'Delocalized',
        caption: 'The π electrons spread over all three O atoms, so both O–O bonds are the same: bond order 1½, between a single and a double bond.',
        shapes: [...frame, ...sigmas, { kind: 'cloud', segments: ends.map((p): [Vec, Vec] => [mid, p]), normal: Z, label: 'π shared by all 3 O' }],
      },
    ],
  };
}

/**
 * Lays a flat molecule (drawn in the xy-plane, p orbitals along z) down horizontally: the plane
 * becomes xz and the p orbitals point up (y). The viewer looks from slightly above, so π lobes then
 * show clearly above and below the bonds instead of one behind the other.
 */
function layFlat(scene: OrbitalScene): OrbitalScene {
  const turn = (p: Vec): Vec => [p[0], p[2], -p[1]];
  const shape = (sh: Shape): Shape => {
    switch (sh.kind) {
      case 'orbital':
        return { ...sh, at: turn(sh.at), dir: turn(sh.dir) };
      case 'atom':
      case 'label':
        return { ...sh, at: turn(sh.at) };
      case 'sigma':
        return { ...sh, from: turn(sh.from), to: turn(sh.to) };
      case 'cloud':
        return { ...sh, segments: sh.segments.map(([a, b]): [Vec, Vec] => [turn(a), turn(b)]), normal: turn(sh.normal) };
    }
  };
  return { ...scene, stages: scene.stages.map((st) => ({ ...st, shapes: st.shapes.map(shape) })) };
}

/** Every orbital scene, by id: <OrbitalViewer ids="ch4,nh3" />. */
export const ORBITAL_SCENES: Record<string, OrbitalScene> = Object.fromEntries(
  [
    methane,
    ammonia,
    water,
    layFlat(boronTrifluoride),
    berylliumFluoride,
    layFlat(ethylene()),
    acetylene(),
    layFlat(formaldehyde()),
    carbonDioxide(),
    layFlat(benzene()),
    layFlat(carbonate()),
    layFlat(ozone()),
  ].map((s) => [s.id, s]),
);

export function getOrbitalScene(id: string): OrbitalScene {
  const s = ORBITAL_SCENES[id];
  if (!s) throw new Error(`orbital scene "${id}" doesn't exist (see src/lib/orbitals.ts)`);
  return s;
}

// ---------------------------------------------------------------------------
// Orbital box diagrams (ground state → promoted → hybridized)
// ---------------------------------------------------------------------------

const VALENCE: Record<BoxElement, number> = { Be: 2, B: 3, C: 4, N: 5, O: 6 };

/** One box: the orbital's name and how many electrons are in it. */
export interface Box {
  name: string;
  electrons: 0 | 1 | 2;
}

/** A column of the diagram: boxes grouped by energy level, highest first. */
export interface BoxColumn {
  title: string;
  levels: { name: string; boxes: Box[] }[];
}

/** Fills `n` electrons into `count` boxes: one each first (Hund's rule), then pairs. */
function fill(n: number, count: number): (0 | 1 | 2)[] {
  return Array.from({ length: count }, (_, i) => (n >= count + i + 1 ? 2 : n > i ? 1 : 0));
}

/**
 * The orbital box diagram for a period-2 atom: the ground state, the promoted state when it needs
 * more unpaired electrons than it has, and the hybridized state. In the hybridized state electrons
 * go one per hybrid first, then one into each leftover p (those form π bonds), and any left pair
 * up in hybrids as lone pairs.
 */
export function boxDiagram(el: BoxElement, hybrid: 1 | 2 | 3): BoxColumn[] {
  const n = VALENCE[el];
  const name = HYBRID_NAME[hybrid];
  const pNames = ['2pₓ', '2p_y', '2p_z'];
  const ground: BoxColumn = {
    title: 'Ground state',
    levels: [
      { name: '2p', boxes: fill(Math.max(0, n - 2), 3).map((e, i) => ({ name: pNames[i]!, electrons: e })) },
      { name: '2s', boxes: [{ name: '2s', electrons: Math.min(n, 2) as 0 | 1 | 2 }] },
    ],
  };
  const unpaired = ground.levels.flatMap((l) => l.boxes).filter((b) => b.electrons === 1).length;
  const hybrids = hybrid + 1;
  const leftoverP = 3 - hybrid;
  // Electrons: one per hybrid, then one per leftover p, then pairs in hybrids.
  const inHybrids = Math.min(n, hybrids) + Math.max(0, n - hybrids - leftoverP);
  const inP = Math.min(Math.max(0, n - hybrids), leftoverP);
  const hybridized: BoxColumn = {
    title: `${name} hybridized`,
    levels: [
      ...(leftoverP ? [{ name: '2p', boxes: fill(inP, leftoverP).map((e, i) => ({ name: pNames[hybrid + i]!, electrons: e })) }] : []),
      { name, boxes: fill(inHybrids, hybrids).map((e) => ({ name, electrons: e })) },
    ],
  };
  // Be, B, and C have fewer unpaired electrons than the bonds they make, so one 2s electron is
  // promoted first. N and O already have enough.
  const needsPromotion = n <= 4 && unpaired < Math.min(n, hybrids + leftoverP);
  if (!needsPromotion) return [ground, hybridized];
  const promoted: BoxColumn = {
    title: 'Promote one 2s electron',
    levels: [
      { name: '2p', boxes: fill(n - 1, 3).map((e, i) => ({ name: pNames[i]!, electrons: e })) },
      { name: '2s', boxes: [{ name: '2s', electrons: 1 }] },
    ],
  };
  return [ground, promoted, hybridized];
}
