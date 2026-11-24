import { describe, expect, it } from 'vitest';
import { loadRegistry } from './registry';
import { periodicPosition, searchElements } from './elements';
import { cell, tex } from './reference';

describe('periodic table layout', () => {
  it('places the main groups, transition metals, and the f-block rows', () => {
    expect(periodicPosition(1)).toEqual({ row: 1, col: 1 });
    expect(periodicPosition(2)).toEqual({ row: 1, col: 18 });
    expect(periodicPosition(5)).toEqual({ row: 2, col: 13 }); // B
    expect(periodicPosition(18)).toEqual({ row: 3, col: 18 }); // Ar
    expect(periodicPosition(26)).toEqual({ row: 4, col: 8 }); // Fe
    expect(periodicPosition(56)).toEqual({ row: 6, col: 2 }); // Ba
    expect(periodicPosition(72)).toEqual({ row: 6, col: 4 }); // Hf
    expect(periodicPosition(86)).toEqual({ row: 6, col: 18 }); // Rn
    expect(periodicPosition(104)).toEqual({ row: 7, col: 4 }); // Rf
    expect(periodicPosition(118)).toEqual({ row: 7, col: 18 }); // Og
    expect(periodicPosition(57)).toEqual({ row: 9, col: 4 }); // La
    expect(periodicPosition(71)).toEqual({ row: 9, col: 18 }); // Lu
    expect(periodicPosition(103)).toEqual({ row: 10, col: 18 }); // Lr
  });

  it('gives every element its own cell', () => {
    const cells = new Set(Array.from({ length: 118 }, (_, i) => JSON.stringify(periodicPosition(i + 1))));
    expect(cells.size).toBe(118);
  });
});

describe('element search', () => {
  const els = [
    { number: 6, symbol: 'C', name: 'Carbon' },
    { number: 17, symbol: 'Cl', name: 'Chlorine' },
    { number: 20, symbol: 'Ca', name: 'Calcium' },
    { number: 26, symbol: 'Fe', name: 'Iron' },
  ];
  it('puts an exact symbol or number first, then names', () => {
    expect(searchElements(els, 'c').map((e) => e.symbol)).toEqual(['C', 'Cl', 'Ca']); // then by atomic number
    expect(searchElements(els, 'Fe').map((e) => e.symbol)).toEqual(['Fe']);
    expect(searchElements(els, 'iron').map((e) => e.symbol)).toEqual(['Fe']);
    expect(searchElements(els, '17').map((e) => e.symbol)).toEqual(['Cl']);
    expect(searchElements(els, 'lor').map((e) => e.symbol)).toEqual(['Cl']);
    expect(searchElements(els, ' ')).toEqual([]);
  });
});

describe('reference math', () => {
  it('renders inline math in table cells and escapes the rest', () => {
    expect(cell('a < b')).toBe('a &lt; b');
    expect(cell('$10^{9}$')).toContain('katex');
  });

  it('renders every equation, key, and constant on each class sheet', () => {
    for (const [id, data] of loadRegistry()) {
      const ref = data.reference;
      if (!ref) continue;
      for (const s of ref.sections) {
        for (const t of [...s.equations, ...s.key.map((k) => k[0]), ...s.constants.map((c) => c[1])]) {
          expect(() => tex(t), `${id}: ${t}`).not.toThrow();
        }
      }
      for (const t of ref.tables) {
        if ('math' in t) t.math.forEach((m) => expect(() => tex(m), `${id}: ${m}`).not.toThrow());
        else t.rows.flat().forEach((c) => expect(() => cell(c), `${id}: ${c}`).not.toThrow());
      }
    }
  });

  it('keeps the AP periodic table to the official values', () => {
    const els = loadRegistry().get('apchem')!.elements;
    const mass = (sym: string) => els.find((e) => e.symbol === sym)?.mass;
    expect(els).toHaveLength(118);
    expect([mass('H'), mass('C'), mass('Cl'), mass('Pb'), mass('Tc'), mass('U')]).toEqual(['1.008', '12.01', '35.45', '207.2', null, '238.03']);
  });
});
