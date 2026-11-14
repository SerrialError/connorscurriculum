<script lang="ts">
  // Building a set: Quick start, then the filters. Nothing starts until a Quick start button or
  // "Start practice" is pressed (Enter on a chip only toggles it). Every control just shows
  // `filters`, and changing one changes only that one.
  import { matchFrqs } from '../../lib/frqs';
  import { countWith, emptyFilters, filterQuestions, filterTopics, isDefaultFilters, sessionSize, toggled } from '../../lib/practice/filters';
  import { ALL_QUESTIONS, DIFFICULTY_LABELS, MODE_LABELS, TYPE_LABELS, filterChips } from '../../lib/practice/labels';
  import type { Filters, PracticeQuestion } from '../../lib/practice/types';
  import { filtersToQuery } from '../../lib/practice/url';
  import { byId, plural } from '../../lib/text';
  import Chip from './Chip.svelte';
  import { type PracticeChapter, getCourse } from './context';
  import CountPicker from './CountPicker.svelte';
  import PastFrqs from './PastFrqs.svelte';
  import TopicPicker from './TopicPicker.svelte';

  interface Props {
    all: PracticeQuestion[];
    filters: Filters;
    /** Show the "Weakest topics" quick start (there is history with weak topics). */
    weakest: boolean;
    onstart: (f: Filters) => void;
  }

  let { all, filters = $bindable(), weakest, onstart }: Props = $props();
  const { tests, chapters, laterChapters, units, presets, everything, chapterTopics, frqs, hrefs } = getCourse();

  let moreOpen = $state(false);
  let copied = $state(false);
  /** Bumped by "Reset all", which starts the count picker over (its "Other" box closes). */
  let resets = $state(0);

  const matching = $derived(filterQuestions(all, filters, tests));
  const setSize = $derived(sessionSize(matching.length, filters));
  /** Chapter chips: chapters with class questions (and any other picked chapter, e.g. from a link). */
  const mainChapters = $derived(chapters.filter((c) => (c.hasQuestions || filters.chapters.includes(c.number)) && !laterChapters.includes(c.number)));
  const laterChapterList = $derived(chapters.filter((c) => laterChapters.includes(c.number)));
  const emptyCurrent = $derived(chapters.filter((c) => c.current && !c.hasQuestions));
  /**
   * Textbook sections come only from links (a lesson page's practice links). Once picked they stay
   * listed, so unticking one doesn't make its chip vanish.
   */
  let sectionChoices = $state<string[]>([]);
  $effect.pre(() => {
    const added = filters.sections.filter((s) => !sectionChoices.includes(s));
    if (added.length) sectionChoices = [...sectionChoices, ...added].sort(byId);
  });
  const chips = $derived(filterChips(filters, tests, laterChapters));
  const moreChips = $derived(chips.filter((c) => c.more));
  const frqTopics = $derived(filterTopics(filters, units, chapterTopics, tests));
  const frqMatches = $derived(frqTopics.size ? matchFrqs(frqs, frqTopics) : []);
  /** What's under More options, while it's closed and nothing in it is set. */
  const moreSummary = [units.length > 0 && 'AP unit or topic', tests.length > 0 && 'class test', 'question type', laterChapters.length > 0 && 'later chapters']
    .filter(Boolean)
    .join(', ')
    .replace(/^./, (c) => c.toUpperCase());

  const weakestFirst: Filters = { ...emptyFilters(), mode: 'weak' };
  const weakestSize = $derived(sessionSize(filterQuestions(all, weakestFirst, tests).length, weakestFirst));

  /** Enter on a filter chip toggles it, like Space. It never starts the set. */
  function onFilterKey(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    e.preventDefault();
    if (t.type === 'checkbox' || t.type === 'radio') t.click();
  }

  function resetAll() {
    filters = emptyFilters();
    resets++;
  }

  async function copyLink() {
    const link = location.origin + location.pathname + filtersToQuery(filters);
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      prompt('Copy this link:', link);
    }
  }
</script>

{#snippet chapterChip(c: PracticeChapter)}
  <Chip
    title={c.title}
    checked={filters.chapters.includes(c.number)}
    onchange={() => (filters.chapters = toggled(filters.chapters, c.number))}
    count={countWith(all, filters, tests, { chapters: [c.number] })}
  >
    Ch. {c.number} <span class="chip-sub">{c.title}</span>
  </Chip>
{/snippet}

{#if presets.length > 0 || weakest}
  <section class="presets" aria-labelledby="presets-h">
    <h2 id="presets-h" class="section-h">Quick start</h2>
    <div class="preset-row">
      {#each presets as p (p.label)}
        <div class="preset">
          <button type="button" class="preset-main" onclick={() => onstart(p.filters)}>
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
{/if}

<form class="card filters" onsubmit={(e) => e.preventDefault()} onkeydown={onFilterKey} aria-labelledby="filters-h">
  <div class="filters-head">
    <h2 id="filters-h" class="section-h">{presets.length > 0 || weakest ? 'Or pick your own set' : 'Pick your own set'}</h2>
    <!-- Always laid out (hidden when there's nothing to reset), so picking a filter doesn't move the chips. -->
    <button class="link-button reset" class:invisible={isDefaultFilters(filters)} type="button" onclick={() => resetAll()}>Reset all</button>
  </div>

  <fieldset>
    <legend>Chapter</legend>
    <div class="chips">
      {#each mainChapters as c (c.number)}
        {@render chapterChip(c)}
      {/each}
    </div>
    {#if emptyCurrent.length > 0}
      <p class="small muted chapter-note">
        No questions yet for
        {#each emptyCurrent as c, i (c.number)}{i > 0 ? ' or ' : ''}<a href={`${hrefs.chapters}${c.number}/`}>Ch.&nbsp;{c.number}</a>{/each}
        (in class now).
      </p>
    {/if}
  </fieldset>

  {#if sectionChoices.length > 0}
    <fieldset>
      <legend>Textbook section</legend>
      <div class="chips">
        {#each sectionChoices as s (s)}
          <Chip checked={filters.sections.includes(s)} onchange={() => (filters.sections = toggled(filters.sections, s))} count={countWith(all, filters, tests, { sections: [s] })}>
            §{s}
          </Chip>
        {/each}
      </div>
    </fieldset>
  {/if}

  <!-- Each group is as wide as its chips, so a whole group moves to the next line instead of one chip dropping under the others. -->
  <div class="groups">
    <fieldset>
      <legend>Difficulty</legend>
      <div class="chips">
        {#each [1, 2, 3] as d (d)}
          <Chip
            checked={filters.difficulty.includes(d)}
            onchange={() => (filters.difficulty = toggled(filters.difficulty, d))}
            count={countWith(all, filters, tests, { difficulty: [d] })}
          >
            {DIFFICULTY_LABELS[d]}
          </Chip>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>How many</legend>
      {#key resets}
        <CountPicker bind:n={filters.n} matching={matching.length} />
      {/key}
    </fieldset>

    <fieldset>
      <legend>Order</legend>
      <div class="chips">
        {#each ['all', 'random', 'weak'] as const as m (m)}
          <Chip type="radio" name="mode" checked={filters.mode === m} onchange={() => (filters.mode = m)}>{MODE_LABELS[m]}</Chip>
        {/each}
      </div>
    </fieldset>
  </div>

  <details class="more" bind:open={moreOpen}>
    <summary>
      <span class="more-title">More options</span>
      <!-- Closed: what's set inside, or what's there. -->
      {#if !moreOpen && moreChips.length > 0}
        <span class="badge topic">{moreChips.map((c) => c.label).join(' · ')}</span>
      {:else if !moreOpen}
        <span class="small muted">{moreSummary}</span>
      {/if}
    </summary>

    {#if units.length > 0}
      <fieldset>
        <legend>AP unit or topic</legend>
        <TopicPicker {all} bind:filters />
      </fieldset>
    {/if}

    <div class="groups">
      {#if tests.length > 0}
        <fieldset>
          <legend>Class test</legend>
          <div class="chips">
            {#each tests as t (t.id)}
              <Chip checked={filters.test === t.id} onchange={(on) => (filters.test = on ? t.id : null)} count={countWith(all, filters, tests, { test: t.id })}>
                {t.title}
              </Chip>
            {/each}
          </div>
        </fieldset>
      {/if}

      <fieldset>
        <legend>Question type</legend>
        <div class="chips">
          {#each ['mcq', 'frq'] as const as value (value)}
            <Chip checked={filters.type === value} onchange={(on) => (filters.type = on ? value : null)} count={countWith(all, filters, tests, { type: value })}>
              {TYPE_LABELS[value]}
            </Chip>
          {/each}
        </div>
      </fieldset>

      {#if laterChapterList.length > 0}
        <!-- Sample questions for chapters the class hasn't reached: never in a set unless picked here. -->
        <fieldset>
          <legend>Later chapters <span class="legend-sub">samples, not taught yet</span></legend>
          <div class="chips">
            {#each laterChapterList as c (c.number)}
              {@render chapterChip(c)}
            {/each}
          </div>
        </fieldset>
      {/if}
    </div>
    <p class="copy-row">
      <button class="link-button small" type="button" onclick={() => copyLink()}>{copied ? 'Link copied' : 'Copy a link to these filters'}</button>
    </p>
  </details>

  <!-- Sticky, so Start is always in reach. On phones it is one short row: the count and Start. -->
  <div class="start-bar">
    <div class="start-info" aria-live="polite">
      {#if matching.length === 0}
        <strong>No questions match.</strong>
        <span class="small muted sub">Remove a filter.</span>
      {:else}
        <strong>{plural(setSize, 'question')}</strong>
        <span class="small muted sub">
          {#if setSize < matching.length}from {matching.length} matching{:else if chips.length === 0}{everything === ALL_QUESTIONS ? 'all questions' : `all of ${everything}`}{:else}all that match{/if}
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
    <button class="button start" type="button" disabled={matching.length === 0} onclick={() => onstart($state.snapshot(filters))}>
      Start<span class="wide-only"> practice</span> →
    </button>
  </div>
</form>

<PastFrqs matches={frqMatches} />

<style>
  /* Quick start */
  .presets {
    margin-bottom: 1.25rem;
  }
  .filters-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.1rem 0.75rem;
    margin-bottom: 0.5rem;
  }
  .filters-head .section-h {
    margin: 0;
  }
  .reset.invisible {
    visibility: hidden;
  }
  .preset-row {
    display: grid;
    gap: 0.6rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
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

  /* Filters */
  .filters {
    padding: 1rem 1.1rem 0;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0 0 1.1rem;
    min-width: 0;
  }
  legend {
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.45rem;
    padding: 0;
  }
  .legend-sub {
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
  }
  .chapter-note {
    margin: 0.5rem 0 0;
  }
  .groups {
    display: flex;
    flex-wrap: wrap;
    column-gap: 2rem;
  }
  .groups > fieldset {
    flex: 0 1 auto;
  }

  /* More options */
  .more {
    border-top: 1px solid var(--border);
    margin: 0 -1.1rem;
    padding: 0 1.1rem;
  }
  .more > summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    align-items: baseline;
    padding: 0.8rem 0;
    list-style: none;
    cursor: pointer;
  }
  .more > summary::-webkit-details-marker {
    display: none;
  }
  .more > summary::before {
    content: '▸';
    color: var(--muted);
    transition: transform 0.15s;
  }
  .more[open] > summary::before {
    transform: rotate(90deg);
  }
  .more[open] > summary {
    margin-bottom: 0.25rem;
  }
  .more-title {
    font-weight: 700;
    color: var(--link);
  }
  .copy-row {
    margin: 0 0 1rem;
  }

  /* Sticky start bar: always in reach while choosing filters. */
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
  }
</style>
