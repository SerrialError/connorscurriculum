import { describe, expect, it } from 'vitest';
import { MOLECULES, SHAPES, type Vec, domainDirections, getMolecule } from './molecules';

const dot = (u: Vec, v: Vec) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const angle = (u: Vec, v: Vec) => Math.round((Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI);
/** The unit vector from v to u. */
const sub = (u: Vec, v: Vec): Vec => {
  const d: Vec = [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const n = Math.hypot(...d);
  return [d[0] / n, d[1] / n, d[2] / n];
};

/** Every angle between two domains, as a sorted multiset. */
function angles(dirs: Vec[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) out.push(angle(dirs[i]!, dirs[j]!));
  return out.sort((a, b) => a - b);
}

const IDEAL: Record<number, number[]> = {
  2: [180],
  3: [120, 120, 120],
  4: Array(6).fill(109),
  5: [...Array(6).fill(90), 120, 120, 120, 180],
  6: [...Array(12).fill(90), 180, 180, 180],
};

describe('domainDirections', () => {
  for (const s of SHAPES) {
    it(`${s.domains} domains, ${s.lonePairs} lone pairs: unit vectors at the ideal angles`, () => {
      const dirs = domainDirections(s.domains, s.lonePairs);
      expect(dirs).toHaveLength(s.domains);
      for (const d of dirs) expect(Math.hypot(...d)).toBeCloseTo(1, 6);
      expect(angles(dirs)).toEqual(IDEAL[s.domains]);
    });
  }

  it('puts lone pairs in equatorial positions of a trigonal bipyramid', () => {
    for (const lp of [1, 2, 3]) {
      for (const d of domainDirections(5, lp).slice(0, lp)) expect(d[1]).toBeCloseTo(0, 6);
    }
  });

  it('puts two lone pairs of an octahedron opposite each other', () => {
    const [a, b] = domainDirections(6, 2);
    expect(angle(a!, b!)).toBe(180);
  });
});

describe('MOLECULES', () => {
  it('has a model for every shape, with that shape', () => {
    for (const s of SHAPES) {
      const m = getMolecule(s.example);
      expect(m.molecularGeometry).toBe(s.molecularGeometry);
      expect(m.lonePairs).toHaveLength(s.lonePairs);
    }
  });

  it('bonds only atoms that exist, and marks angles between bonded atoms', () => {
    for (const [id, m] of Object.entries(MOLECULES)) {
      for (const b of m.bonds) expect(m.atoms[b.a] && m.atoms[b.b], id).toBeTruthy();
      const bonded = (x: number, y: number) => m.bonds.some((b) => (b.a === x && b.b === y) || (b.a === y && b.b === x));
      for (const a of m.angles) expect(bonded(a.at, a.from) && bonded(a.at, a.to), id).toBe(true);
    }
  });

  it('labels angles squeezed by lone pairs with "<", and leaves symmetric ones exact', () => {
    expect(getMolecule('nh3').angles.map((a) => a.label)).toEqual(['<109.5°']);
    expect(getMolecule('ch4').angles.map((a) => a.label)).toEqual(['109.5°']);
    expect(getMolecule('xef4').angles.map((a) => a.label)).toEqual(['90°']);
    expect(getMolecule('xef2').angles.map((a) => a.label)).toEqual(['180°']);
    expect(getMolecule('pcl5').angles.map((a) => a.label).sort()).toEqual(['120°', '90°']);
  });

  it('builds ethylene with 120° angles around each carbon', () => {
    const m = getMolecule('c2h4');
    const [c1, c2, h1, h2] = m.atoms.map((a) => a.pos);
    expect(angle(sub(h1!, c1!), sub(c2!, c1!))).toBe(120);
    expect(angle(sub(h1!, c1!), sub(h2!, c1!))).toBe(120);
  });

  it('rejects an unknown id', () => {
    expect(() => getMolecule('nope')).toThrow(/no model/);
  });
});
