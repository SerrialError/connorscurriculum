import { describe, expect, it } from 'vitest';
import { pageText, runTogether } from './text-joins';

describe('pageText', () => {
  it('joins inline elements and spaces out blocks', () => {
    expect(pageText('<p>No lessons yet.<a href="/x">See</a> the list.</p><p>Next</p>').trim()).toBe('No lessons yet.See the list. Next');
    expect(pageText('<li>Ch. 7</li><li>Hard</li>').trim()).toBe('Ch. 7 Hard');
  });

  it('leaves out code, math, scripts, and decoration', () => {
    const html =
      '<p>a<code>x.Y</code>b<span class="katex"><span>c.D</span></span>e<script>f.G</script>h<span aria-hidden="true">!</span>i<br>j</p>';
    expect(pageText(html).trim()).toBe('abehi j');
  });

  it('reads entities for spaces', () => {
    expect(pageText('<p>Ch.&nbsp;9</p>').trim()).toBe('Ch. 9');
  });
});

describe('runTogether', () => {
  it('finds words joined across a stop', () => {
    expect(runTogether('no lessons on the site yet.See the chapter list')).toEqual(['yet.See']);
    expect(runTogether('Practice:Start 10 random')).toEqual(['Practice:Start']);
  });

  it('passes normal prose, numbers, and ids', () => {
    expect(runTogether('Ch. 7 · Hard. See the list, then start: 10 questions. 6.02×10²³, §7.2, 5.4, d(i)')).toEqual([]);
  });
});
