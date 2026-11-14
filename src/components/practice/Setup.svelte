<script lang="ts">
  // Building a set: Quick start, then the filters. Nothing starts until a Quick start button or
  // "Start practice" is pressed (Enter on a chip only toggles it). Every control just shows
  // `filters`, and changing one changes only that one.
  import { matchFrqs } from '../../lib/frqs';
  import {
    CLASS_ONLY_UNIT,
    COUNT_CHOICES,
    DEFAULT_COUNT,
    MAX_COUNT,
    countWith,
    emptyFilters,
    filterQuestions,
    filterTopics,
    isCustomCount,
    isDefaultFilters,
    sessionSize,
  } from '../../lib/practice/filters';
  import { ALL_QUESTIONS, DIFFICULTY_LABELS, MODE_LABELS, TYPE_LABELS, filterChips } from '../../lib/practice/labels';
  import type { Filters, PracticeQuestion } from '../../lib/practice/types';
  import { filtersToQuery, parseFilters } from '../../lib/practice/url';
  import { plural } from '../../lib/text';
  import { type PracticeChapter, getCourse } from './context';
  import PastFrqs from './PastFrqs.svelte';

  interface Props {
    all: PracticeQuestion[];
    filters: Filters;
    /** Show the "Weakest topics" quick start (there is history with weak topics). */
    weakest: boolean;
    onstart: (f: Filters) => void;
  }

  let { all, filters = $bindable(), weakest, onstart }: Props = $props();
  const { tests, chapters, laterChapters, units, presets, everything, chapterTopics, frqs, hrefs } = getCourse();

  /** "Other" in How many is picked (its number box is showing). */
  let customCount = $state(isCustomCount(filters.n));
  /** What the number box shows while typing (filters.n only takes valid numbers). */
  let countText = $state(String(filters.n ?? DEFAULT_COUNT));
  let countInput = $state<HTMLInputElement | null>(null);
  let moreOpen = $state(false);
  let copied = $state(false);

  const matching = $derived(filterQuestions(all, filters, tests));
  const setSize = $derived(sessionSize(matching.length, filters));
  /** Questions the chapter filter allows (all class chapters when none is picked): topic and unit lists come from these. */
  const inChapters = $derived(filterQuestions(all, { ...emptyFilters(), chapters: filters.chapters }, tests));
  const usedTopics = $derived(new Set(inChapters.flatMap((q) => q.cedTopics)));
  const usedUnits = $derived(new Set(inChapters.flatMap((q) => q.units)));
  const hasClassOnly = $derived(inChapters.some((q) => q.cedTopics.length === 0));
  const visibleUnits = $derived(
    units.filter((u) => usedUnits.has(u.id) || filters.units.includes(u.id) || u.topics.some((t) => filters.topics.includes(t.id))),
  );
  /** Chapter chips: chapters with class questions (and any other picked chapter, e.g. from a link). */
  const mainChapters = $derived(chapters.filter((c) => (c.hasQuestions || filters.chapters.includes(c.number)) && !laterChapters.includes(c.number)));
  const laterChapterList = $derived(chapters.filter((c) => laterChapters.includes(c.number)));
  const emptyCurrent = $derived(chapters.filter((c) => c.current && !c.hasQuestions));
  const chips = $derived(filterChips(filters, tests, laterChapters));
  const moreChips = $derived(chips.filter((c) => c.more));
  const frqTopics = $derived(filterTopics(filters, units, chapterTopics, tests));
  const frqMatches = $derived(frqTopics.size ? matchFrqs(frqs, frqTopics) : []);
  const countInvalid = $derived.by(() => {
    if (!customCount) return false;
    const v = Number(countText);
    return countText.trim() === '' || !Number.isInteger(v) || v < 1;
  });

  const presetSize = (query: string) => {
    const f = parseFilters(query);
    return sessionSize(filterQuestions(all, f, tests).length, f);
  };

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  /** Enter on a filter chip toggles it, like Space. It never starts the set. */
  function onFilterKey(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    e.preventDefault();
    if (t.type === 'checkbox' || t.type === 'radio') t.click();
  }

  /** How many: changes only the count. "Other" puts the cursor in its number box. */
  function setCount(n: number | null, custom = false) {
    customCount = custom;
    filters.n = n;
    countText = String(n ?? DEFAULT_COUNT);
    if (custom) {
      // The box appears with "Other"; focus it once it's there.
      queueMicrotask(() => {
        countInput?.focus();
        countInput?.select();
      });
    }
  }

  /** The "Other" number box: whole numbers from 1 to MAX_COUNT; anything else is ignored. */
  function onCountInput(text: string) {
    countText = text;
    const v = Number(text);
    if (text.trim() !== '' && Number.isInteger(v) && v > 0) filters.n = Math.min(v, MAX_COUNT);
  }

  /** Leaving the box: show the number the set will really have (at most what matches). */
  function onCountBlur() {
    const n = filters.n ?? DEFAULT_COUNT;
    filters.n = matching.length > 0 ? Math.min(n, matching.length) : n;
    countText = String(filters.n);
  }

  function resetAll() {
    filters = emptyFilters();
    setCount(filters.n);
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

{#snippet count(n: number)}
  <span class="count" class:zero={n === 0}>{n}</span>
{/snippet}

{#snippet chapterChip(c: PracticeChapter)}
  <label class="chip" title={c.title}>
    <input type="checkbox" checked={filters.chapters.includes(c.number)} onchange={() => (filters.chapters = toggle(filters.chapters, c.number))} />
    <span>Ch. {c.number} <span class="chip-sub">{c.title}</span></span>
    {@render count(countWith(all, filters, tests, { chapters: [c.number] }))}
  </label>
{/snippet}

{#if presets.length > 0 || weakest}
  <section class="presets" aria-labelledby="presets-h">
    <div class="presets-head">
      <h2 id="presets-h" class="section-h">Quick start</h2>
      <span class="small muted">One tap starts the set.</span>
    </div>
    <div class="preset-row">
      {#each presets as p (p.query)}
        <div class="preset">
          <button type="button" class="preset-main" onclick={() => onstart(parseFilters(p.query))}>
            <span class="preset-label">{p.label} <span aria-hidden="true">→</span></span>
            {#if p.note}<span class="small muted">{p.note}</span>{/if}
          </button>
          {#if p.alt}
            {@const alt = p.alt}
            <button type="button" class="link-button small preset-alt" onclick={() => onstart(parseFilters(alt.query))}>
              {alt.label}<span class="visually-hidden"> ({p.label})</span> <span aria-hidden="true">→</span>
            </button>
          {/if}
        </div>
      {/each}
      {#if weakest}
        <div class="preset">
          <button type="button" class="preset-main" onclick={() => onstart(parseFilters('?mode=weak'))}>
            <span class="preset-label">Weakest topics <span aria-hidden="true">→</span></span>
            <span class="small muted">{plural(presetSize('?mode=weak'), 'question')} on what you've missed most</span>
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

  <!-- Each group is as wide as its chips, so a whole group moves to the next line instead of one chip dropping under the others. -->
  <div class="groups">
    <fieldset>
      <legend>Difficulty</legend>
      <div class="chips">
        {#each [1, 2, 3] as d (d)}
          <label class="chip">
            <input type="checkbox" checked={filters.difficulty.includes(d)} onchange={() => (filters.difficulty = toggle(filters.difficulty, d))} />
            <span>{DIFFICULTY_LABELS[d]}</span>
            {@render count(countWith(all, filters, tests, { difficulty: [d] }))}
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>How many</legend>
      <div class="chips">
        <label class="chip">
          <input type="radio" name="count" checked={filters.n === null && !customCount} onchange={() => setCount(null)} />
          <span>All</span>
        </label>
        {#each COUNT_CHOICES as c (c)}
          <label class="chip">
            <input type="radio" name="count" checked={filters.n === c && !customCount} onchange={() => setCount(c)} />
            <span>{c}</span>
          </label>
        {/each}
        <label class="chip">
          <input type="radio" name="count" checked={customCount} onchange={() => setCount(filters.n ?? DEFAULT_COUNT, true)} />
          <span>Other</span>
        </label>
        {#if customCount}
          <label>
            <span class="visually-hidden">Number of questions</span>
            <input
              class="num"
              type="number"
              inputmode="numeric"
              min="1"
              max={Math.max(1, Math.min(MAX_COUNT, matching.length))}
              value={countText}
              bind:this={countInput}
              aria-invalid={countInvalid}
              aria-describedby="count-help"
              oninput={(e) => onCountInput(e.currentTarget.value)}
              onblur={() => onCountBlur()}
            />
          </label>
          <span id="count-help" class="small count-help" class:warn={countInvalid || (filters.n ?? 0) > matching.length}>
            {#if countInvalid}Type a whole number{:else if (filters.n ?? 0) > matching.length}Only {matching.length} match{:else}max {Math.min(MAX_COUNT, matching.length)}{/if}
          </span>
        {/if}
      </div>
    </fieldset>

    <fieldset>
      <legend>Order</legend>
      <div class="chips">
        {#each ['all', 'random', 'weak'] as const as m (m)}
          <label class="chip">
            <input type="radio" name="mode" checked={filters.mode === m} onchange={() => (filters.mode = m)} />
            <span>{MODE_LABELS[m]}</span>
          </label>
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
        <span class="small muted">AP unit or topic{tests.length > 0 ? ', class test' : ''}, question type{laterChapterList.length > 0 ? ', later chapters' : ''}</span>
      {/if}
    </summary>

    <fieldset>
      <legend>AP unit or topic</legend>
      {#each visibleUnits as u (u.id)}
        {@const picked = u.topics.filter((t) => filters.topics.includes(t.id)).length}
        <details class="unit" open={picked > 0}>
          <summary>
            <span>
              Unit {u.id}: {u.title}
              {#if filters.units.includes(u.id)}<span class="badge topic">whole unit</span>{:else if picked}<span class="badge topic">{picked} selected</span>{/if}
            </span>
            {@render count(countWith(all, filters, tests, { units: [u.id], topics: [] }))}
          </summary>
          <div class="chips">
            <label class="chip">
              <input type="checkbox" checked={filters.units.includes(u.id)} onchange={() => (filters.units = toggle(filters.units, u.id))} />
              <span>Whole unit</span>
              {@render count(countWith(all, filters, tests, { units: [u.id], topics: [] }))}
            </label>
            {#each u.topics.filter((t) => usedTopics.has(t.id) || filters.topics.includes(t.id)) as t (t.id)}
              <label class="chip">
                <input type="checkbox" checked={filters.topics.includes(t.id)} onchange={() => (filters.topics = toggle(filters.topics, t.id))} />
                <span>{t.id} <span class="chip-sub">{t.title}</span></span>
                {@render count(countWith(all, filters, tests, { units: [], topics: [t.id] }))}
              </label>
            {/each}
          </div>
        </details>
      {:else}
        <p class="small muted">No tagged questions yet.</p>
      {/each}
      {#if hasClassOnly || filters.units.includes(CLASS_ONLY_UNIT)}
        <div class="chips class-only">
          <label class="chip">
            <input type="checkbox" checked={filters.units.includes(CLASS_ONLY_UNIT)} onchange={() => (filters.units = toggle(filters.units, CLASS_ONLY_UNIT))} />
            <span>Not on the AP exam <span class="chip-sub">class tests only</span></span>
            {@render count(countWith(all, filters, tests, { units: [CLASS_ONLY_UNIT], topics: [] }))}
          </label>
        </div>
      {/if}
    </fieldset>

    <div class="groups">
      {#if tests.length > 0}
        <fieldset>
          <legend>Class test</legend>
          <div class="chips">
            {#each tests as t (t.id)}
              <label class="chip">
                <input type="checkbox" checked={filters.test === t.id} onchange={(e) => (filters.test = e.currentTarget.checked ? t.id : null)} />
                <span>{t.title}</span>
                {@render count(countWith(all, filters, tests, { test: t.id }))}
              </label>
            {/each}
          </div>
        </fieldset>
      {/if}

      <fieldset>
        <legend>Question type</legend>
        <div class="chips">
          {#each ['mcq', 'frq'] as const as value (value)}
            <label class="chip">
              <input type="checkbox" checked={filters.type === value} onchange={(e) => (filters.type = e.currentTarget.checked ? value : null)} />
              <span>{TYPE_LABELS[value]}</span>
              {@render count(countWith(all, filters, tests, { type: value }))}
            </label>
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
  .presets-head,
  .filters-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.1rem 0.75rem;
    margin-bottom: 0.5rem;
  }
  .presets-head .section-h,
  .filters-head .section-h {
    margin: 0;
  }
  .filters-head {
    justify-content: space-between;
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
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.25rem;
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 1.15rem;
    background: var(--surface);
    color: var(--text);
    font-size: 0.92rem;
    line-height: 1.35;
    cursor: pointer;
    user-select: none;
    max-width: 100%;
  }
  .chip input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
  .chip:hover {
    border-color: var(--accent);
  }
  .chip:has(input:checked) {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .chip:has(input[type='checkbox']:checked)::before {
    content: '✓';
    font-weight: 700;
  }
  .chip:has(input:focus-visible) {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .chip-sub {
    color: var(--muted);
  }
  .chip:has(input:checked) .chip-sub {
    color: inherit;
    opacity: 0.85;
  }
  .count {
    font-size: 0.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-2);
  }
  .count.zero {
    opacity: 0.6;
  }
  /* Options that would match nothing stay usable but recede. */
  .chip:has(.count.zero):not(:has(input:checked)) {
    border-style: dashed;
    color: var(--muted);
  }
  .chip:has(input:checked) .count {
    background: var(--accent-ink);
    color: var(--accent);
  }
  .num {
    font: inherit;
    width: 5rem;
    min-height: 2.25rem;
    padding: 0.3rem 0.5rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
  }
  .num[aria-invalid='true'] {
    border-color: var(--warn);
  }
  .count-help {
    color: var(--muted);
  }
  .count-help.warn {
    color: var(--warn);
    font-weight: 600;
  }

  /* More options */
  .more {
    border-top: 1px solid var(--border);
    margin: 0 -1.1rem;
    padding: 0 1.1rem;
  }
  .more > summary,
  .unit > summary {
    list-style: none;
    cursor: pointer;
  }
  .more > summary::-webkit-details-marker,
  .unit > summary::-webkit-details-marker {
    display: none;
  }
  .more > summary::before,
  .unit > summary::before {
    content: '▸';
    color: var(--muted);
    transition: transform 0.15s;
  }
  .more[open] > summary::before,
  .unit[open] > summary::before {
    transform: rotate(90deg);
  }
  .more > summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    align-items: baseline;
    padding: 0.8rem 0;
  }
  .more[open] > summary {
    margin-bottom: 0.25rem;
  }
  .more-title {
    font-weight: 700;
    color: var(--link);
  }
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
  }
  .unit .chips {
    padding: 0 0.75rem 0.65rem;
  }
  .class-only {
    margin-top: 0.4rem;
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
    border-radius: 999px;
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
