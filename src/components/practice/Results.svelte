<script lang="ts">
  // The score for a set, what to do next, what to read, and every question with its status.
  import { tick } from 'svelte';
  import type { matchFrqs } from '../../lib/frqs';
  import { STATUS_TEXT, againLabel, retryWords } from '../../lib/practice/labels';
  import { lessonsForMissed } from '../../lib/practice/lessons';
  import { scoreStatus, topicBreakdown } from '../../lib/practice/score';
  import type { Filters } from '../../lib/practice/types';
  import { plural, truncate } from '../../lib/text';
  import type { Attempt } from './attempt.svelte';
  import { getCourse } from './context';
  import PastFrqs from './PastFrqs.svelte';
  import QuestionDot from './QuestionDot.svelte';

  interface Props {
    attempt: Attempt;
    label: string;
    /** The filters that made the set. */
    filters: Filters;
    frqMatches: ReturnType<typeof matchFrqs>;
    onretry: (words: string) => void;
    /** Open question `i` from the results (to answer or review it). */
    onreview: (i: number) => void;
    /** The same filters again: a new set, or the same one from the start when it's in order. */
    onagain: () => void;
    onfilters: () => void;
  }

  let { attempt, label, filters, frqMatches, onretry, onreview, onagain, onfilters }: Props = $props();
  const { lessons, hrefs, topicLabel, units } = getCourse();

  let heading = $state<HTMLElement | null>(null);
  const summary = $derived(attempt.summary);
  const missed = $derived(attempt.missed);
  const skipped = $derived(attempt.skipped);
  const retry = $derived(retryWords(missed.map((q) => attempt.scores[q.id]!)));
  const breakdown = $derived(topicBreakdown(attempt.questions, attempt.scores));
  const study = $derived(lessonsForMissed(missed, lessons));
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  $effect(() => {
    void tick().then(() => {
      window.scrollTo({ top: 0 });
      heading?.focus({ preventScroll: true });
    });
  });
</script>

<section class="results" aria-labelledby="results-h">
  <div class="card score">
    <h2 id="results-h" tabindex="-1" bind:this={heading}>Results</h2>
    <p class="small muted set-label">{label}</p>
    <div class="score-row">
      {#if summary.mcqAnswered}
        <div class="stat">
          <span class="big">{summary.mcqCorrect}/{summary.mcqAnswered}</span>
          <span class="small muted">multiple choice correct ({pct(summary.mcqCorrect / summary.mcqAnswered)})</span>
        </div>
      {/if}
      {#if summary.frqDone}
        <div class="stat">
          <span class="big">{summary.frqEarned}/{summary.frqPossible}</span>
          <span class="small muted">free-response points</span>
        </div>
      {/if}
      {#if attempt.answered === 0}
        <p class="muted">You didn’t answer any questions in this set.</p>
      {/if}
    </div>
    {#if skipped.length > 0 && attempt.answered > 0}
      <p class="small muted">{plural(skipped.length, 'question')} skipped.</p>
    {/if}
    <div class="actions">
      {#if missed.length > 0}
        <button class="button" type="button" onclick={() => onretry(retry.set)}>{retry.button}</button>
      {/if}
      {#if skipped.length > 0}
        <button class="button" class:secondary={missed.length > 0} type="button" onclick={() => onreview(attempt.questions.indexOf(skipped[0]!))}>
          Answer the {skipped.length} skipped
        </button>
      {/if}
      <button class="button" class:secondary={missed.length > 0 || skipped.length > 0} type="button" onclick={() => onagain()}>{againLabel(filters)}</button>
      <button class="button secondary" type="button" onclick={() => onfilters()}>Change filters</button>
    </div>
  </div>

  {#if study.lessons.length > 0 || study.chapters.length > 0}
    <section class="card" aria-labelledby="study-h">
      <h3 id="study-h" class="section-h">Read up on what you missed</h3>
      <ul class="plain-list study-list">
        {#each study.lessons as s (s.lesson.href)}
          <li>
            <a href={s.lesson.href}>{s.lesson.title}</a>
            <span class="small muted">Ch. {s.lesson.chapter} · {plural(s.missed, 'missed question')}</span>
          </li>
        {/each}
        {#each study.chapters as n (n)}
          <li>
            <a href={`${hrefs.chapters}${n}/#lessons`}>Chapter {n} lessons and notes</a>
            <span class="small muted">for the other questions you missed</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if breakdown.length > 0}
    <section class="card" aria-labelledby="topics-h">
      <h3 id="topics-h" class="section-h">{units.length > 0 ? 'By topic' : 'By chapter'}</h3>
      <ul class="plain-list breakdown">
        {#each breakdown as t (t.key)}
          {@const frac = t.score / t.count}
          <li>
            <span class="b-label">
              {#if t.key.startsWith('chapter-')}{topicLabel(t.key)}{:else}<a href={`${hrefs.topics}${t.key}/`}>{topicLabel(t.key)}</a>{/if}
            </span>
            <span class="bar" aria-hidden="true"><span class:low={frac < 0.5} class:high={frac >= 0.8} style:width={pct(frac)}></span></span>
            <span class="small b-num">{pct(frac)} <span class="muted">of {plural(t.count, 'question')}</span></span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="card" aria-labelledby="questions-h">
    <h3 id="questions-h" class="section-h">Questions</h3>
    <ol class="plain-list review">
      {#each attempt.questions as s, i (s.id)}
        {@const st = scoreStatus(attempt.scores[s.id])}
        <li>
          <QuestionDot n={i + 1} status={st} />
          <span class="r-text">
            <span class="visually-hidden">Question {i + 1}, {STATUS_TEXT[st]}:</span>
            {truncate(s.promptText, 240)}
          </span>
          <button type="button" class="link-button small" onclick={() => onreview(i)}>
            {st === 'todo' ? 'Answer' : 'Review'}<span class="visually-hidden"> question {i + 1}</span>
          </button>
        </li>
      {/each}
    </ol>
  </section>

  <PastFrqs matches={frqMatches} />
</section>

<style>
  .results {
    display: grid;
    gap: 1rem;
  }
  .results :global(.past-frqs) {
    margin: 0;
  }
  .score h2 {
    margin: 0 0 0.5rem;
    font-size: 1.3rem;
  }
  .score h2:focus {
    outline: none;
  }
  .set-label {
    margin: -0.35rem 0 0.6rem;
    color: var(--text-2);
  }
  .score-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 2rem;
  }
  .stat {
    display: grid;
  }
  .big {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .score .actions {
    margin-bottom: 0;
  }
  .study-list li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.1rem 0.6rem;
    padding: 0.35rem 0;
  }
  .study-list a {
    font-weight: 600;
  }
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
  /* Phones: the topic name gets the whole line; its bar and score go underneath. */
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
  .review li {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.4rem 0;
    border-top: 1px solid var(--border);
  }
  .r-text {
    flex: 1;
    min-width: 0;
    font-size: 0.92rem;
    color: var(--text-2);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
</style>
