import { describe, expect, it } from 'vitest';
import { isRealMatch, pickExcerpt, trimTitle } from './search-excerpt';

describe('trimTitle', () => {
  it('drops the page title from the start of an excerpt', () => {
    expect(trimTitle('1.7 Periodic Trends. Atomic radius decreases across a period.', '1.7 Periodic Trends')).toBe(
      'Atomic radius decreases across a period.',
    );
  });

  it('handles highlighted words in the title', () => {
    expect(trimTitle("Effective Nuclear Charge and <mark>Slater's</mark> Rules. Use <mark>Slater's</mark> rules", "Effective Nuclear Charge and Slater's Rules")).toBe(
      "Use <mark>Slater's</mark> rules",
    );
    expect(trimTitle('Periodic <mark>Trends</mark>. Radius shrinks', 'Periodic Trends')).toBe('Radius shrinks');
    expect(trimTitle('1.7 <mark>Periodic</mark> <mark>Trends.</mark> Started in Ch. 7', '1.7 Periodic Trends')).toBe('Started in Ch. 7');
  });

  it('drops the end of the title when the excerpt starts mid-heading', () => {
    expect(trimTitle("Charge and Slater's Rules. Shielding by inner electrons", "Effective Nuclear Charge and Slater's Rules")).toBe(
      'Shielding by inner electrons',
    );
  });

  it('leaves other excerpts alone', () => {
    expect(trimTitle('Atomic radius decreases', '1.7 Periodic Trends')).toBe('Atomic radius decreases');
    expect(trimTitle('Periodic Trendsetters are', 'Periodic Trends')).toBe('Periodic Trendsetters are');
    expect(trimTitle('1.7 Periodic Trends', '1.7 Periodic Trends')).toBe('1.7 Periodic Trends');
  });
});

describe('isRealMatch', () => {
  it('drops matches on a much shorter word', () => {
    expect(isRealMatch('xyzzy', 'the <mark>X</mark> → <mark>X⁺</mark> + e⁻')).toBe(false);
  });
  it('keeps real and stemmed matches', () => {
    expect(isRealMatch('slater', "Use <mark>Slater’s</mark> rules")).toBe(true);
    expect(isRealMatch('ionization energies', 'first <mark>ionization</mark> energy')).toBe(true);
    expect(isRealMatch('Zeff', '<mark>Z_eff</mark> grows')).toBe(true);
    expect(isRealMatch('zeff', '<mark>Zeff</mark> grows')).toBe(true);
    expect(isRealMatch('pe', 'the <mark>PES</mark> spectrum')).toBe(true);
    expect(isRealMatch('anything', 'no highlights here')).toBe(true);
  });
});

describe('pickExcerpt', () => {
  const title = 'Line Spectra and the Bohr Model';
  const subs = [
    { title, excerpt: 'Line Spectra and the <mark>Bohr</mark> Model.' },
    { title: '2. The Bohr model', excerpt: '2. The <mark>Bohr</mark> model. <mark>Bohr</mark> explained hydrogen.' },
  ];
  it('keeps the page excerpt when it still has a match after the title', () => {
    expect(pickExcerpt('Atoms. The <mark>Bohr</mark> model works.', title, subs)).toBe('Atoms. The <mark>Bohr</mark> model works.');
  });
  it('uses a section with the match when the match was only in the title', () => {
    expect(pickExcerpt('and the <mark>Bohr</mark> Model. 1. Continuous spectra.', title, subs)).toBe('<mark>Bohr</mark> explained hydrogen.');
  });
  it('falls back to a matching section heading, then to the page excerpt', () => {
    const headingOnly = [{ title: 'Bohr', excerpt: '<mark>Bohr</mark>. Next.' }];
    expect(pickExcerpt('and the <mark>Bohr</mark> Model. Spectra.', title, headingOnly)).toBe('<mark>Bohr</mark>. Next.');
    expect(pickExcerpt('and the <mark>Bohr</mark> Model. Spectra.', title, [])).toBe('Spectra.');
    expect(pickExcerpt('No match here.', title, subs)).toBe('No match here.');
  });
});
