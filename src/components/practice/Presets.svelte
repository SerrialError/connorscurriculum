<script lang="ts">
  // "Quick start" on the setup screen: ready-made sets (presets.ts), one tap each, and "Weakest
  // topics" once there is history with weak topics.
  import { emptyFilters, filterQuestions, sessionSize } from '../../lib/practice/filters';
  import type { Filters, QuestionMeta } from '../../lib/practice/types';
  import { plural } from '../../lib/text';
  import { getCourse } from './context';

  interface Props {
    all: QuestionMeta[];
    /** Show "Weakest topics". */
    weakest: boolean;
    onstart: (f: Filters, exam?: boolean) => void;
  }

  let { all, weakest, onstart }: Props = $props();
  const { tests, presets } = getCourse();

  const weakestFirst: Filters = { ...emptyFilters(), mode: 'weak' };
  const weakestSize = $derived(sessionSize(filterQuestions(all, weakestFirst, tests).length, weakestFirst));
</script>

<section class="presets" aria-labelledby="presets-h">
  <h2 id="presets-h" class="section-h">Quick start</h2>
  <div class="preset-row">
    {#each presets as p (p.label)}
      <div class="preset">
        <button type="button" class="preset-main" onclick={() => onstart(p.filters, p.exam)}>
          <span class="preset-label">{p.label} <span aria-hidden="true">→</span></span>
          {#if p.note}<span class="small muted">{p.note}</span>{/if}
        </button>
        {#if p.alt}
          {@const alt = p.alt}
          <button type="button" class="link-button small preset-alt" onclick={() => onstart(alt.filters)}>
            {alt.label}<span class="visually-hidden"> ({p.label})</span> <span aria-hidden="true">→</span>
          </button>
        {/if}
      </div>
    {/each}
    {#if weakest}
      <div class="preset">
        <button type="button" class="preset-main" onclick={() => onstart(weakestFirst)}>
          <span class="preset-label">Weakest topics <span aria-hidden="true">→</span></span>
          <span class="small muted">{plural(weakestSize, 'question')} on what you've missed most</span>
        </button>
      </div>
    {/if}
  </div>
</section>

<style>
  .presets {
    margin-bottom: 1.25rem;
  }
  /* The cards share the row's width, however many there are. */
  .preset-row {
    display: grid;
    gap: 0.6rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  }
  /* A card: the main button fills it; an optional second way to start sits under it. */
  .preset {
    display: grid;
    align-content: start;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .preset:has(.preset-main:hover) {
    border-color: var(--accent);
  }
  .preset-main {
    display: grid;
    gap: 0.1rem;
    text-align: left;
    font: inherit;
    color: var(--text);
    background: none;
    border: 0;
    border-radius: var(--radius);
    padding: 0.65rem 0.85rem;
    cursor: pointer;
  }
  .preset-label {
    font-weight: 700;
    color: var(--link);
  }
  .preset-alt {
    justify-self: start;
    margin: -0.35rem 0.85rem 0.45rem;
  }
  /* A single card is a strip across the row, its second way to start on the right. */
  .preset:only-child {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 1rem;
  }
  .preset:only-child .preset-main {
    flex: 1 1 16rem;
  }
  .preset:only-child .preset-alt {
    margin: -0.35rem 0.85rem 0.6rem;
  }
  @media (min-width: 641px) {
    .preset:only-child .preset-alt {
      margin: 0 1rem 0 0;
    }
  }
</style>
