import { describe, expect, it } from 'vitest';
import { ORBITAL_SCENES, boxDiagram, getOrbitalScene } from './orbitals';

const electrons = (cols: ReturnType<typeof boxDiagram>, i: number) =>
  cols[i]!.levels.flatMap((l) => l.boxes).reduce((n, b) => n + b.electrons, 0);
const arrows = (cols: ReturnType<typeof boxDiagram>, i: number, level: string) =>
  cols[i]!.levels.find((l) => l.name === level)!.boxes.map((b) => b.electrons);

describe('boxDiagram', () => {
  it('keeps the electron count in every column', () => {
    for (const [el, n] of [['Be', 2], ['B', 3], ['C', 4], ['N', 5], ['O', 6]] as const) {
      for (const h of [1, 2, 3] as const) {
        const cols = boxDiagram(el, h);
        cols.forEach((_, i) => expect(electrons(cols, i), `${el} sp${h} column ${i}`).toBe(n));
      }
    }
  });

  it('promotes a 2s electron for Be, B, and C but not N or O', () => {
    expect(boxDiagram('C', 3).map((c) => c.title)).toEqual(['Ground state', 'Promote one 2s electron', 'sp³ hybridized']);
    expect(boxDiagram('B', 2)).toHaveLength(3);
    expect(boxDiagram('Be', 1)).toHaveLength(3);
    expect(boxDiagram('N', 3)).toHaveLength(2);
    expect(boxDiagram('O', 3)).toHaveLength(2);
  });

  it('fills hybrids singly, then leftover p orbitals, then pairs', () => {
    expect(arrows(boxDiagram('C', 3), 2, 'sp³')).toEqual([1, 1, 1, 1]);
    expect(arrows(boxDiagram('N', 3), 1, 'sp³')).toEqual([2, 1, 1, 1]);
    expect(arrows(boxDiagram('O', 3), 1, 'sp³')).toEqual([2, 2, 1, 1]);
    // Ethylene's carbons: three sp² with one each, one electron left in p for the π bond.
    expect(arrows(boxDiagram('C', 2), 2, 'sp²')).toEqual([1, 1, 1]);
    expect(arrows(boxDiagram('C', 2), 2, '2p')).toEqual([1]);
    // BF₃: the leftover p is empty.
    expect(arrows(boxDiagram('B', 2), 2, '2p')).toEqual([0]);
    // The O in formaldehyde: one bonding sp², two lone pairs, one p electron for the π bond.
    expect(arrows(boxDiagram('O', 2), 1, 'sp²')).toEqual([2, 2, 1]);
    expect(arrows(boxDiagram('O', 2), 1, '2p')).toEqual([1]);
  });
});

describe('ORBITAL_SCENES', () => {
  it('gives every scene three named stages with something to draw', () => {
    for (const s of Object.values(ORBITAL_SCENES)) {
      expect(s.stages.length, s.id).toBe(3);
      for (const st of s.stages) {
        expect(st.title && st.caption, s.id).toBeTruthy();
        expect(st.shapes.length, `${s.id}: ${st.title}`).toBeGreaterThan(0);
      }
    }
  });

  it('puts the right number of electrons in the central atom’s hybrids', () => {
    const hybridElectrons = (id: string) =>
      getOrbitalScene(id).stages[1]!.shapes.reduce((n, s) => n + (s.kind === 'orbital' && typeof s.type === 'number' && typeof s.electrons === 'number' ? s.electrons : 0), 0);
    expect(hybridElectrons('ch4')).toBe(4);
    expect(hybridElectrons('nh3')).toBe(5);
    expect(hybridElectrons('h2o')).toBe(6);
    expect(hybridElectrons('bf3')).toBe(3);
    expect(hybridElectrons('bef2')).toBe(2);
  });

  it('counts σ and π bonds the way the lesson says', () => {
    const count = (id: string, kind: 'sigma' | 'cloud') => getOrbitalScene(id).stages[2]!.shapes.filter((s) => s.kind === kind).length;
    expect([count('c2h4', 'sigma'), count('c2h4', 'cloud')]).toEqual([5, 1]);
    expect([count('c2h2', 'sigma'), count('c2h2', 'cloud')]).toEqual([3, 2]);
    expect([count('h2co', 'sigma'), count('h2co', 'cloud')]).toEqual([3, 1]);
    expect([count('co2', 'sigma'), count('co2', 'cloud')]).toEqual([2, 2]);
  });

  it('rejects an unknown id', () => {
    expect(() => getOrbitalScene('nope')).toThrow(/doesn't exist/);
  });
});
