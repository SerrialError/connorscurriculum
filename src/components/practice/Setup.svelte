<script lang="ts">
  // Building a set: Quick start, then the filters. Nothing starts until a Quick start button or
  // "Start practice" is pressed (Enter on a chip only toggles it). Every control just shows
  // `filters`, and changing one changes only that one.
  import { matchFrqs } from '../../lib/frqs';
  import { countWith, emptyFilters, filterQuestions, filterTopics, isDefaultFilters, toggled } from '../../lib/practice/filters';
  import { AP_LABELS, DIFFICULTY_LABELS, MODE_LABELS, TYPE_LABELS, filterChips } from '../../lib/practice/labels';
  import type { Filters, PracticeQuestion } from '../../lib/practice/types';
  import { filtersToQuery } from '../../lib/practice/url';
  import { byId } from '../../lib/text';
  import Chip from './Chip.svelte';
  import { type PracticeChapter, getCourse } from './context';
  import CountPicker from './CountPicker.svelte';
  import PastFrqs from './PastFrqs.svelte';
  import Presets from './Presets.svelte';
  import StartBar from './StartBar.svelte';
  import TopicPicker from './TopicPicker.svelte';

  interface Props {
    all: PracticeQuestion[];
    filters: Filters;
    /** Show the "Weakest topics" quick start (there is history with weak topics). */
    weakest: boolean;
    /** Start a set from these filters; `exam`: a practice exam of their class test. */
    onstart: (f: Filters, exam?: boolean) => void;
  }

  let { all, filters = $bindable(), weakest, onstart }: Props = $props();
  const { tests, chapters, laterChapters, units, presets, chapterTopics, frqs, hrefs } = getCourse();
  /** The teacher's tests; practice quizzes start from Quick start, not as a filter. */
  const classTests = tests.filter((t) => t.kind !== 'quiz');

  let moreOpen = $state(false);
  let copied = $state(false);
  /** Bumped by "Reset all", which starts the count picker over (its "Other" box closes). */
  let resets = $state(0);

  const matching = $derived(filterQuestions(all, filters, tests));
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
  const moreSummary = [units.length > 0 && 'AP unit or topic', classTests.length > 0 && 'class test', 'question type', laterChapters.length > 0 && 'later chapters']
    .filter(Boolean)
    .join(', ')
    .replace(/^./, (c) => c.toUpperCase());
  const hasQuickStart = $derived(presets.length > 0 || weakest);

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

{#if hasQuickStart}
  <Presets {all} {weakest} {onstart} />
{/if}

<form class="card filters" onsubmit={(e) => e.preventDefault()} onkeydown={onFilterKey} aria-labelledby="filters-h">
  <div class="filters-head">
    <h2 id="filters-h" class="section-h">{hasQuickStart ? 'Or pick your own set' : 'Pick your own set'}</h2>
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
    {#if units.length > 0}
      <!-- Every question is either tagged with an AP topic (could be on the AP exam) or class-only. -->
      <fieldset>
        <legend>AP exam</legend>
        <div class="chips">
          {#each ['ap', 'class'] as const as value (value)}
            <Chip
              title={AP_LABELS[value]}
              checked={filters.ap === value}
              onchange={(on) => (filters.ap = on ? value : null)}
              count={countWith(all, filters, tests, { ap: value })}
            >
              {value === 'ap' ? 'On the AP exam' : 'Class only'}
            </Chip>
          {/each}
        </div>
      </fieldset>
    {/if}
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
      {#if classTests.length > 0}
        <fieldset>
          <legend>Class test</legend>
          <div class="chips">
            {#each classTests as t (t.id)}
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

  <StartBar bind:filters matching={matching.length} {chips} {onstart} />
</form>

<PastFrqs matches={frqMatches} />

<style>

  /* Filters */
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

</style>
