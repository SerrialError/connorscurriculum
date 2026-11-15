<script module lang="ts">
  export interface BreakdownRow {
    key: string;
    label: string;
    /** Makes the name a link. */
    href?: string;
    /** 0–1 */
    frac: number;
    /** "80% of 5 questions", "11 of 13 correct": the number, then (muted) what it counts. */
    value: string;
    detail: string;
  }
</script>

<script lang="ts">
  // A results card of scores by area (topics, or a practice exam's sections): each row a name,
  // a bar, and a number.
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    title: string;
    rows: BreakdownRow[];
    /** A line under the rows. */
    children?: Snippet;
  }

  let { id, title, rows, children }: Props = $props();
  const pct = (x: number) => `${Math.round(x * 100)}%`;
</script>

<section class="card" aria-labelledby={id}>
  <h3 {id} class="section-h">{title}</h3>
  <ul class="plain-list breakdown">
    {#each rows as r (r.key)}
      <li>
        <span class="b-label">{#if r.href}<a href={r.href}>{r.label}</a>{:else}{r.label}{/if}</span>
        <span class="bar" aria-hidden="true"><span class:low={r.frac < 0.5} class:high={r.frac >= 0.8} style:width={pct(r.frac)}></span></span>
        <span class="small b-num">{r.value} <span class="muted">{r.detail}</span></span>
      </li>
    {/each}
  </ul>
  {@render children?.()}
</section>

<style>
  .breakdown li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(4rem, 8rem) 10rem;
    gap: 0.75rem;
    align-items: center;
    padding: 0.35rem 0;
    border-top: 1px solid var(--border);
  }
  .bar {
    height: 8px;
    border-radius: var(--pill);
    background: var(--surface-2);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--warn);
  }
  .bar span.low {
    background: var(--bad);
  }
  .bar span.high {
    background: var(--good);
  }
  .b-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  /* Phones: the name gets the whole line; its bar and number go underneath. */
  @media (max-width: 520px) {
    .breakdown li {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'label label' 'bar num';
      gap: 0.2rem 0.75rem;
    }
    .b-label {
      grid-area: label;
    }
    .bar {
      grid-area: bar;
    }
    .b-num {
      grid-area: num;
    }
  }
</style>
