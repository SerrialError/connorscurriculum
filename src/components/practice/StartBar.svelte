<script lang="ts">
  // The setup screen's sticky bar: how many questions the set will have, the picked filters (each
  // removable), and Start.
  import { sessionSize } from '../../lib/practice/filters';
  import { ALL_QUESTIONS, type FilterChip, MODE_LABELS } from '../../lib/practice/labels';
  import type { Filters } from '../../lib/practice/types';
  import { plural } from '../../lib/text';
  import { getCourse } from './context';

  interface Props {
    filters: Filters;
    /** How many questions the filters match. */
    matching: number;
    /** The picked filters (filterChips). */
    chips: FilterChip[];
    onstart: (f: Filters) => void;
  }

  let { filters = $bindable(), matching, chips, onstart }: Props = $props();
  const { everything } = getCourse();
  const setSize = $derived(sessionSize(matching, filters));
</script>

<!-- Sticky, so Start is always in reach. On phones it is one short row: the count and Start. -->
<!-- With nothing matching, the picked filters show at every width, each with its remove button. -->
<div class="start-bar" class:none={matching === 0}>
  <div class="start-info" aria-live="polite">
    {#if matching === 0 && chips.length === 0}
      <strong>No practice questions yet.</strong>
    {:else if matching === 0}
      <strong>No questions match.</strong>
      <span class="small muted sub">Remove a filter.</span>
    {:else}
      <strong>{plural(setSize, 'question')}</strong>
      <span class="small muted sub">
        {#if setSize < matching}from {matching} matching{:else if chips.length === 0}{everything === ALL_QUESTIONS ? 'all questions' : `all of ${everything}`}{:else}all that match{/if}
        <span class="mode">· {MODE_LABELS[filters.mode].toLowerCase()}</span>
      </span>
    {/if}
  </div>
  {#if chips.length > 0}
    <ul class="plain-list active-chips" aria-label="Active filters">
      {#each chips as c (c.label)}
        <li>
          <button type="button" class="active-chip" onclick={() => (filters = c.without)} aria-label={`Remove filter: ${c.label}`}>
            {c.label} <span aria-hidden="true">×</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <button class="button start" type="button" disabled={matching === 0} onclick={() => onstart($state.snapshot(filters))}>
    Start<span class="wide-only"> practice</span> →
  </button>
</div>

<style>
  /* Sticky start bar: always in reach while choosing filters. It spans the filters card, whose
     padding is 1.1rem at the sides. */
  .start-bar {
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'info start' 'chips start';
    gap: 0.4rem 1rem;
    align-items: center;
    margin: 0 -1.1rem;
    padding: 0.75rem 1.1rem;
    border-top: 1px solid var(--border);
    background: var(--surface);
    border-radius: 0 0 var(--radius) var(--radius);
    box-shadow: 0 -6px 16px -10px rgb(0 0 0 / 0.25);
  }
  .start-bar:not(:has(.active-chips)) {
    grid-template-areas: 'info start';
  }
  .start-info {
    grid-area: info;
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.5rem;
    align-items: baseline;
    min-width: 0;
  }
  .active-chips {
    grid-area: chips;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0;
  }
  .active-chip {
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.1rem 0.55rem;
    border-radius: var(--pill);
    border: 1px solid transparent;
    background: var(--accent-soft);
    color: var(--link);
    cursor: pointer;
  }
  .active-chip:hover {
    border-color: var(--accent);
  }
  .start {
    grid-area: start;
    min-width: 10rem;
  }
  /* Phones: one short row (count on the left, Start on the right); the picked chips are in the form above. */
  @media (max-width: 640px) {
    .start-bar {
      grid-template-areas: 'info start';
      padding: 0.45rem 1.1rem;
      column-gap: 0.75rem;
    }
    .start-info {
      display: grid;
      line-height: 1.25;
    }
    .start-info .sub {
      font-size: 0.8rem;
    }
    .start-info .mode,
    .active-chips {
      display: none;
    }
    .start {
      min-width: 0;
      min-height: 2.75rem;
      padding-inline: 1.1rem;
    }
    .start-bar.none:has(.active-chips) {
      grid-template-areas: 'info start' 'chips chips';
      padding-bottom: 0.6rem;
    }
    .start-bar.none .active-chips {
      display: flex;
    }
  }
</style>
