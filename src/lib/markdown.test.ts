import { describe, expect, it } from 'vitest';
import { renderMarkdown, renderPlainText } from './markdown';

describe('rehypeMathPunctuation', () => {
  it('keeps a comma after inline math on the same line', async () => {
    const html = await renderMarkdown('rate of $0.060$, water forms.');
    expect(html).toMatch(/<span class="nowrap"><span class="katex">[\s\S]*<\/span>,<\/span> water forms\./);
  });

  it('leaves math without trailing punctuation alone', async () => {
    const html = await renderMarkdown('so $x$ is');
    expect(html).not.toContain('nowrap');
  });

  it('still renders mhchem', async () => {
    expect(await renderMarkdown('$\\ce{H2O}$.')).not.toContain('katex-error');
  });
});

describe('rehypeMathSearchText', () => {
  it('keeps both KaTeX copies out of the search index and adds a hidden plain-text copy', async () => {
    const html = await renderMarkdown('$\\ce{X(g) -> X+(g) + e-}$');
    expect(html).toMatch(/<span class="katex-mathml" data-pagefind-ignore="all">/);
    expect(html).toMatch(/<span class="katex-html" aria-hidden="true" data-pagefind-ignore="all">/);
    expect(html).toContain('<span class="katex-text" hidden>X(g) → X⁺(g) + e⁻</span>');
  });
});

describe('renderPlainText', () => {
  const cases: [string, string][] = [
    ["Use Slater's rules to find $Z_\\text{eff}$ in magnesium ($Z = 12$).", "Use Slater's rules to find Z_eff in magnesium (Z = 12)."],
    ['The ions $\\ce{S^2-}$, $\\ce{Cl-}$, and $\\ce{SO4^2-}$', 'The ions S²⁻, Cl⁻, and SO₄²⁻'],
    ['$1.5 \\times 10^{-1}$ and $\\frac{c}{\\lambda}$', '1.5 × 10⁻¹ and c/λ'],
    ['$\\Delta H^\\circ = -92\\ \\text{kJ/mol}$', 'ΔH° = −92 kJ/mol'],
    ['$\\ce{N2 + 3H2 <=> 2NH3}$', 'N₂ + 3 H₂ ⇌ 2 NH₃'],
    ['from $n = 2$ to $n=5$', 'from n = 2 to n = 5'],
    ['$e^{-E_a/RT}$', 'e^(−E_a/RT)'],
    ['$$E = h\\nu$$\n\nThen **bold**.', 'E = hν Then bold.'],
  ];
  it.each(cases)('%s', async (source, text) => {
    expect(await renderPlainText(source)).toBe(text);
  });
});

describe('remarkDisplayMathParagraphs', () => {
  it('renders a paragraph of only $$…$$ as display math', async () => {
    expect(await renderMarkdown('Step:\n\n$$\\nu = \\frac{c}{\\lambda}$$\n\nDone.')).toContain('katex-display');
  });
  it('leaves single-dollar math and $$ inside a sentence inline', async () => {
    expect(await renderMarkdown('$1.50 \\times 10^{2}$')).not.toContain('katex-display');
    expect(await renderMarkdown('so $$x$$ is')).not.toContain('katex-display');
  });
});
