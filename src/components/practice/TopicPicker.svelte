<script lang="ts">
  // "AP unit or topic" under More options: one closed box per unit (open when a topic in it is
  // picked), with a "Whole unit" chip and a chip for each topic that has questions. Only units and
  // topics with questions in the picked chapters show, plus any already picked (from a link).
  import { CLASS_ONLY_UNIT, countWith, emptyFilters, filterQuestions, toggled } from '../../lib/practice/filters';
  import type { Filters, PracticeQuestion } from '../../lib/practice/types';
  import Chip from './Chip.svelte';
  import { getCourse } from './context';

  interface Props {
    all: PracticeQuestion[];
    filters: Filters;
  }

  let { all, filters = $bindable() }: Props = $props();
  const { tests, units } = getCourse();

  /** Questions the chapter filter allows (all class chapters when none is picked). */
  const inChapters = $derived(filterQuestions(all, { ...emptyFilters(), chapters: filters.chapters }, tests));
  const usedTopics = $derived(new Set(inChapters.flatMap((q) => q.cedTopics)));
  const usedUnits = $derived(new Set(inChapters.flatMap((q) => q.units)));
  const hasClassOnly = $derived(inChapters.some((q) => q.cedTopics.length === 0));
  const visibleUnits = $derived(
    units.filter((u) => usedUnits.has(u.id) || filters.units.includes(u.id) || u.topics.some((t) => filters.topics.includes(t.id))),
  );
  /** Questions a unit (and none of the picked topics) would give. */
  const unitCount = (id: string) => countWith(all, filters, tests, { units: [id], topics: [] });
</script>

{#each visibleUnits as u (u.id)}
  {@const picked = u.topics.filter((t) => filters.topics.includes(t.id)).length}
  <details class="unit" open={picked > 0}>
    <summary>
      <span>
        Unit {u.id}: {u.title}
        {#if filters.units.includes(u.id)}<span class="badge topic">whole unit</span>{:else if picked}<span class="badge topic">{picked} selected</span>{/if}
      </span>
      <span class="chip-count" class:zero={unitCount(u.id) === 0}>{unitCount(u.id)}</span>
    </summary>
    <div class="chips">
      <Chip checked={filters.units.includes(u.id)} onchange={() => (filters.units = toggled(filters.units, u.id))} count={unitCount(u.id)}>Whole unit</Chip>
      {#each u.topics.filter((t) => usedTopics.has(t.id) || filters.topics.includes(t.id)) as t (t.id)}
        <Chip
          checked={filters.topics.includes(t.id)}
          onchange={() => (filters.topics = toggled(filters.topics, t.id))}
          count={countWith(all, filters, tests, { units: [], topics: [t.id] })}
        >
          {t.id} <span class="chip-sub">{t.title}</span>
        </Chip>
      {/each}
    </div>
  </details>
{:else}
  <p class="small muted">No tagged questions yet.</p>
{/each}
{#if hasClassOnly || filters.units.includes(CLASS_ONLY_UNIT)}
  <div class="chips class-only">
    <Chip
      checked={filters.units.includes(CLASS_ONLY_UNIT)}
      onchange={() => (filters.units = toggled(filters.units, CLASS_ONLY_UNIT))}
      count={unitCount(CLASS_ONLY_UNIT)}
    >
      Not on the AP exam <span class="chip-sub">class tests only</span>
    </Chip>
  </div>
{/if}

<style>
  .unit {
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 0.4rem;
    background: var(--bg);
  }
  .unit > summary {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.25rem 0.5rem;
    align-items: baseline;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    list-style: none;
    cursor: pointer;
  }
  .unit > summary::-webkit-details-marker {
    display: none;
  }
  .unit > summary::before {
    content: '▸';
    color: var(--muted);
    transition: transform 0.15s;
  }
  .unit[open] > summary::before {
    transform: rotate(90deg);
  }
  .unit .chips {
    padding: 0 0.75rem 0.65rem;
  }
  .class-only {
    margin-top: 0.4rem;
  }
</style>
