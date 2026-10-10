import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

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
