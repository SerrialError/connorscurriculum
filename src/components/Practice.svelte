<script lang="ts">
  import { onMount } from 'svelte';
  import {
    type Filters,
    type FrqQuestion,
    type History,
    type McqQuestion,
    type PracticeQuestion,
    type PracticeTest,
    type QuestionResult,
    emptyFilters,
    filterQuestions,
    filtersToQuery,
    frqEarned,
    frqTotal,
    isCorrect,
    parseFilters,
    recordResult,
    selectQuestions,
    summarize,
  } from '../lib/practice';
  import { readJson, storageKey, writeJson } from '../lib/storage';

  interface Props {
    subject: string;
    questionsUrl: string;
    chapters: { number: number; title: string; hasQuestions: boolean }[];
    units: { id: string; title: string; topics: { id: string; title: string }[] }[];
    tests: PracticeTest[];
  }

  let { subject, questionsUrl, chapters, units, tests }: Props = $props();

  const historyKey = storageKey(subject, 'practice-history');
  const difficultyLabels: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

  let all = $state<PracticeQuestion[] | null>(null);
  let loadError = $state('');
  let filters = $state<Filters>(emptyFilters());
  let session = $state<PracticeQuestion[]>([]);
  let history = $state<History>({});
  let copied = $state(false);

  // Per-question answer state, keyed by question id.
  let picks = $state<Record<string, string>>({});
  let checked = $state<Record<string, boolean>>({});
  let revealed = $state<Record<string, boolean[]>>({});
  let marks = $state<Record<string, boolean[][]>>({});
  let finished = $state<Record<string, boolean>>({});

  const matching = $derived(all ? filterQuestions(all, filters, tests) : []);
  const topicTitles = $derived(new Map(units.flatMap((u) => u.topics.map((t) => [t.id, t.title] as const))));
  const usedTopics = $derived(new Set(all?.flatMap((q) => q.cedTopics) ?? []));
  const usedUnits = $derived(new Set(all?.flatMap((q) => q.units) ?? []));

  const results = $derived(
    session.flatMap((q): QuestionResult[] => {
      if (q.type === 'mcq' && checked[q.id]) return [{ type: 'mcq', correct: isCorrect(q, picks[q.id]!) }];
      if (q.type === 'frq' && finished[q.id]) return [{ type: 'frq', earned: frqEarned(q, marks[q.id] ?? []), possible: frqTotal(q) }];
      return [];
    }),
  );
  const summary = $derived(summarize(results));
  const allDone = $derived(session.length > 0 && results.length === session.length);

  onMount(async () => {
    filters = parseFilters(location.search);
    history = readJson<History>(historyKey, {});
    try {
      const res = await fetch(questionsUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      all = (await res.json()) as PracticeQuestion[];
      start(false);
    } catch (err) {
      loadError = `Could not load questions (${(err as Error).message}).`;
    }
  });

  function start(updateUrl = true) {
    session = selectQuestions(matching, filters, history);
    picks = {};
    checked = {};
    revealed = {};
    marks = {};
    finished = {};
    if (updateUrl) history_replace();
  }

  function history_replace() {
    window.history.replaceState(null, '', location.pathname + filtersToQuery(filters));
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function save(id: string, score: number) {
    history = recordResult(history, id, score);
    writeJson(historyKey, history);
  }

  function check(q: McqQuestion) {
    if (!picks[q.id] || checked[q.id]) return;
    checked[q.id] = true;
    save(q.id, isCorrect(q, picks[q.id]!) ? 1 : 0);
  }

  function reveal(q: FrqQuestion, part: number) {
    revealed[q.id] ??= q.parts.map(() => false);
    revealed[q.id]![part] = true;
    marks[q.id] ??= q.parts.map((p) => p.scoringHtml.map(() => false));
  }

  function finish(q: FrqQuestion) {
    finished[q.id] = true;
    save(q.id, frqEarned(q, marks[q.id] ?? []) / frqTotal(q));
  }

  function clearFilters() {
    filters = emptyFilters();
  }

  async function copyLink() {
    history_replace();
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      prompt('Copy this link:', location.href);
    }
  }

  const activeCount = $derived(
    filters.chapters.length + (filters.test ? 1 : 0) + filters.units.length + filters.topics.length + filters.difficulty.length + (filters.type ? 1 : 0),
  );
</script>

{#if loadError}
  <p class="notice">{loadError}</p>
{:else if !all}
  <p class="muted">Loading questions…</p>
{:else}
  <details class="filters card" open={activeCount === 0 && filters.mode === 'all'}>
    <summary>
      <strong>Filters</strong>
      <span class="muted small">
        {activeCount} active · {matching.length} matching question{matching.length === 1 ? '' : 's'}
      </span>
    </summary>

    <div class="filter-grid">
      <fieldset>
        <legend>Chapters</legend>
        {#each chapters.filter((c) => c.hasQuestions || filters.chapters.includes(c.number)) as c (c.number)}
          <label class="opt">
            <input
              type="checkbox"
              checked={filters.chapters.includes(c.number)}
              onchange={() => (filters.chapters = toggle(filters.chapters, c.number))}
            />
            {c.number}. {c.title}
          </label>
        {:else}
          <p class="small muted">No questions yet.</p>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Class test</legend>
        <select bind:value={filters.test} aria-label="Class test">
          <option value={null}>Any</option>
          {#each tests as t (t.id)}
            <option value={t.id}>{t.title}</option>
          {/each}
        </select>
      </fieldset>

      <fieldset class="wide">
        <legend>AP units and topics</legend>
        {#each units.filter((u) => usedUnits.has(u.id) || filters.units.includes(u.id) || u.topics.some((t) => filters.topics.includes(t.id))) as u (u.id)}
          <div class="unit">
            <label class="opt">
              <input type="checkbox" checked={filters.units.includes(u.id)} onchange={() => (filters.units = toggle(filters.units, u.id))} />
              <strong>Unit {u.id}: {u.title}</strong>
            </label>
            <div class="topics">
              {#each u.topics.filter((t) => usedTopics.has(t.id) || filters.topics.includes(t.id)) as t (t.id)}
                <label class="opt small">
                  <input type="checkbox" checked={filters.topics.includes(t.id)} onchange={() => (filters.topics = toggle(filters.topics, t.id))} />
                  {t.id} {t.title}
                </label>
              {/each}
            </div>
          </div>
        {:else}
          <p class="small muted">No tagged questions yet.</p>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Difficulty</legend>
        {#each [1, 2, 3] as d (d)}
          <label class="opt">
            <input type="checkbox" checked={filters.difficulty.includes(d)} onchange={() => (filters.difficulty = toggle(filters.difficulty, d))} />
            {difficultyLabels[d]}
          </label>
        {/each}
      </fieldset>

      <fieldset>
        <legend>Type</legend>
        <label class="opt"><input type="radio" name="type" value={null} bind:group={filters.type} /> Any</label>
        <label class="opt"><input type="radio" name="type" value="mcq" bind:group={filters.type} /> Multiple choice</label>
        <label class="opt"><input type="radio" name="type" value="frq" bind:group={filters.type} /> Free response</label>
      </fieldset>

      <fieldset>
        <legend>Mode</legend>
        <label class="opt"><input type="radio" name="mode" value="all" bind:group={filters.mode} /> All, in order</label>
        <label class="opt"><input type="radio" name="mode" value="random" bind:group={filters.mode} /> Random set</label>
        <label class="opt"><input type="radio" name="mode" value="weak" bind:group={filters.mode} /> Weak topics first</label>
        {#if filters.mode !== 'all'}
          <label class="opt">How many <input class="num" type="number" min="1" max="200" bind:value={filters.n} /></label>
        {/if}
      </fieldset>
    </div>

    <div class="actions">
      <button class="button" type="button" onclick={() => start()} disabled={matching.length === 0}>
        Start ({filters.mode === 'all' ? matching.length : Math.min(filters.n, matching.length)} questions)
      </button>
      <button class="button secondary" type="button" onclick={clearFilters}>Clear filters</button>
    </div>
  </details>

  <div class="toolbar">
    <p class="small muted">
      {session.length} question{session.length === 1 ? '' : 's'}
      {#if filters.mode === 'random'}· random set{:else if filters.mode === 'weak'}· weakest topics first{/if}
    </p>
    <button class="button secondary small" type="button" onclick={copyLink}>{copied ? 'Link copied' : 'Copy link to this set'}</button>
  </div>

  {#if session.length === 0}
    <p class="notice">No questions match these filters yet. Try clearing some filters.</p>
  {/if}

  <ol class="plain-list stack">
    {#each session as q, i (q.id)}
      <li>
        <article class="card question" aria-labelledby={`q-${q.id}`}>
          <header class="q-head">
            <h2 id={`q-${q.id}`}>Question {i + 1}</h2>
            <div class="badges">
              <span class="badge">{q.type === 'mcq' ? 'MCQ' : 'FRQ'}</span>
              <span class="badge">Ch. {q.chapter}</span>
              {#each q.cedTopics as t (t)}
                <span class="badge topic" title={topicTitles.get(t)}>{t}</span>
              {:else}
                <span class="badge not-ap">Class only</span>
              {/each}
              <span class="badge">{difficultyLabels[q.difficulty]}</span>
            </div>
          </header>

          <div class="prompt">{@html q.promptHtml}</div>
          {#if q.image}
            <img src={q.image.src} width={q.image.width} height={q.image.height} alt={q.image.alt} loading="lazy" decoding="async" />
          {/if}

          {#if q.type === 'mcq'}
            {@const done = !!checked[q.id]}
            <fieldset class="choices" disabled={done}>
              <legend class="visually-hidden">Choices</legend>
              {#each q.choices as c (c.id)}
                {@const isAnswer = done && c.id === q.answer}
                {@const isWrongPick = done && picks[q.id] === c.id && c.id !== q.answer}
                <label class="choice" class:right={isAnswer} class:wrong={isWrongPick}>
                  <input type="radio" name={`pick-${q.id}`} value={c.id} bind:group={picks[q.id]} />
                  <span class="letter">{c.id.toUpperCase()}</span>
                  <span class="choice-text">{@html c.html}</span>
                  {#if isAnswer}<span class="mark">✓ Correct answer</span>{/if}
                  {#if isWrongPick}<span class="mark">✗ Your answer</span>{/if}
                </label>
              {/each}
            </fieldset>
            {#if !done}
              <button class="button" type="button" disabled={!picks[q.id]} onclick={() => check(q)}>Check</button>
            {:else}
              <p class="verdict" class:ok={isCorrect(q, picks[q.id]!)} role="status">
                {isCorrect(q, picks[q.id]!) ? '✓ Correct' : `✗ Not quite. The answer is ${q.answer.toUpperCase()}.`}
              </p>
              <div class="explanation">{@html q.explanationHtml}</div>
            {/if}
          {:else}
            {#each q.parts as part, p (part.label)}
              <section class="part">
                <h3>({part.label}) <span class="small muted">{part.points} pt{part.points === 1 ? '' : 's'}</span></h3>
                <div>{@html part.promptHtml}</div>
                {#if revealed[q.id]?.[p]}
                  <fieldset class="scoring" disabled={!!finished[q.id]}>
                    <legend class="small">Scoring: check each point you earned</legend>
                    {#each part.scoringHtml as s, k (k)}
                      <label class="opt">
                        <input type="checkbox" bind:checked={marks[q.id]![p]![k]} />
                        <span>{@html s}</span>
                      </label>
                    {/each}
                  </fieldset>
                {:else}
                  <button class="button secondary" type="button" onclick={() => reveal(q, p)}>Show scoring</button>
                {/if}
              </section>
            {/each}
            {#if !finished[q.id]}
              <button
                class="button"
                type="button"
                disabled={!q.parts.every((_, p) => revealed[q.id]?.[p])}
                onclick={() => finish(q)}
              >
                Done marking ({frqEarned(q, marks[q.id] ?? [])}/{frqTotal(q)})
              </button>
            {:else}
              <p class="verdict ok" role="status">You earned {frqEarned(q, marks[q.id] ?? [])} of {frqTotal(q)} points.</p>
              <div class="explanation">{@html q.explanationHtml}</div>
            {/if}
          {/if}
        </article>
      </li>
    {/each}
  </ol>

  {#if session.length > 0}
    <section class="card summary" aria-live="polite">
      <h2>Score</h2>
      <p>
        {#if summary.mcqAnswered}Multiple choice: <strong>{summary.mcqCorrect}/{summary.mcqAnswered}</strong> correct.{/if}
        {#if summary.frqDone}Free response: <strong>{summary.frqEarned}/{summary.frqPossible}</strong> points.{/if}
        {#if results.length === 0}Answer a question to see your score.{/if}
      </p>
      <p class="small muted">{results.length} of {session.length} done.</p>
      {#if allDone}
        <div class="actions">
          <button class="button" type="button" onclick={() => start()}>Start again</button>
          {#if filters.mode !== 'weak'}
            <button class="button secondary" type="button" onclick={() => { filters.mode = 'weak'; start(); }}>Practice weak topics</button>
          {/if}
        </div>
      {/if}
    </section>
  {/if}
{/if}

<style>
  .filters summary {
    cursor: pointer;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
  }
  .filter-grid {
    display: grid;
    gap: 0.75rem 1.25rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
    margin-top: 0.75rem;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  legend {
    font-weight: 700;
    margin-bottom: 0.3rem;
    padding: 0;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .opt {
    display: flex;
    gap: 0.45rem;
    align-items: baseline;
    padding: 0.15rem 0;
    cursor: pointer;
  }
  .topics {
    padding-left: 1.6rem;
  }
  select,
  .num {
    font: inherit;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    max-width: 100%;
  }
  .num {
    width: 5rem;
  }
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin: 1rem 0 0.5rem;
  }
  .toolbar p {
    margin: 0;
  }
  .button.small {
    min-height: 2rem;
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
  }
  .question h2 {
    font-size: 1.05rem;
    margin: 0;
  }
  .q-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .question img {
    display: block;
    margin: 0.75rem 0;
    border-radius: 8px;
    background: #fff;
  }
  .choices {
    display: grid;
    gap: 0.4rem;
    margin: 0.75rem 0;
  }
  .choice {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    flex-wrap: wrap;
  }
  .choice:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .choice.right {
    border-color: var(--good);
    background: var(--good-soft);
  }
  .choice.wrong {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .choice input {
    margin-top: 0.3rem;
  }
  .letter {
    font-weight: 700;
  }
  .choice-text {
    flex: 1;
    min-width: 0;
  }
  .mark {
    font-weight: 700;
    font-size: 0.875rem;
  }
  .right .mark {
    color: var(--good);
  }
  .wrong .mark {
    color: var(--bad);
  }
  .verdict {
    font-weight: 700;
    color: var(--bad);
  }
  .verdict.ok {
    color: var(--good);
  }
  .explanation {
    border-top: 1px solid var(--border);
    margin-top: 0.5rem;
    padding-top: 0.25rem;
  }
  .part {
    margin: 0.75rem 0 1rem;
  }
  .part h3 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
  }
  .scoring {
    background: var(--surface-2);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    margin-top: 0.5rem;
  }
  .summary {
    margin-top: 1.5rem;
  }
  .summary h2 {
    margin: 0 0 0.3rem;
    font-size: 1.15rem;
  }
</style>
