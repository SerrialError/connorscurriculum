<script lang="ts">
  // The score for a set, what to do next, what to read, and every question with its status. A
  // practice exam's score is in the test's points (ExamScore), broken down by the exam's sections.
  import { tick } from 'svelte';
  import type { matchFrqs } from '../../lib/frqs';
  import { STATUS_TEXT, againLabel, answerRestLabel, retryWords } from '../../lib/practice/labels';
  import { lessonsForMissed } from '../../lib/practice/lessons';
  import { topicBreakdown } from '../../lib/practice/score';
  import type { Filters } from '../../lib/practice/types';
  import { plural, truncate } from '../../lib/text';
  import type { Attempt } from './attempt.svelte';
  import Breakdown, { type BreakdownRow } from './Breakdown.svelte';
  import { getCourse } from './context';
  import ExamScore from './ExamScore.svelte';
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
  const { lessons, hrefs, areaLabel, units } = getCourse();

  let heading = $state<HTMLElement | null>(null);
  const summary = $derived(attempt.summary);
  const missed = $derived(attempt.missed);
  const unanswered = $derived(attempt.unanswered);
  const retry = $derived(retryWords(missed.map((q) => attempt.scores[q.id]!)));
  const exam = $derived(attempt.examScore);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const breakdown = $derived.by((): BreakdownRow[] => {
    if (exam) {
      return exam.sections.map((s) => ({
        key: s.section.id,
        label: s.section.label,
        frac: s.count ? s.correct / s.count : 0,
        value: `${s.correct} of ${s.count}`,
        detail: 'correct',
      }));
    }
    return topicBreakdown(attempt.questions, attempt.scores).map((t) => ({
      key: t.key,
      label: areaLabel(t.area),
      href: t.area.kind === 'topic' ? `${hrefs.topics}${t.area.topic}/` : undefined,
      frac: t.score / t.count,
      value: pct(t.score / t.count),
      detail: `of ${plural(t.count, 'question')}`,
    }));
  });
  const study = $derived(lessonsForMissed(missed, lessons));
  /** The practice exam's free-response questions not scored yet. */
  const unscored = $derived(exam ? unanswered.filter((q) => q.type === 'frq') : []);

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
    {#if exam}
      <ExamScore score={exam} onscorefrq={() => onreview(attempt.questions.indexOf(unscored[0]!))} />
    {:else}
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
      {#if unanswered.length > 0 && attempt.answered > 0}
        <p class="small muted">{plural(unanswered.length, 'question')} not answered.</p>
      {/if}
    {/if}
    <div class="actions">
      {#if missed.length > 0}
        <button class="button" type="button" onclick={() => onretry(retry.set)}>{retry.button}</button>
      {/if}
      {#if unanswered.length > 0 && !exam}
        <button class="button" class:secondary={missed.length > 0} type="button" onclick={() => onreview(attempt.questions.indexOf(unanswered[0]!))}>
          {answerRestLabel(unanswered.length, attempt.answered)}
        </button>
      {/if}
      {#if exam}
        <button class="button" class:secondary={missed.length > 0} type="button" onclick={() => onagain()}>New practice exam</button>
      {:else if attempt.answered > 0 || filters.mode !== 'all'}
        <!-- In order with nothing answered, starting again would be the same set from the same place. -->
        <button class="button" class:secondary={missed.length > 0 || unanswered.length > 0} type="button" onclick={() => onagain()}>{againLabel(filters)}</button>
      {/if}
      {#if !exam}
        <button class="button secondary" type="button" onclick={() => onfilters()}>Change filters</button>
      {/if}
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

  {#if exam}
    <Breakdown id="sections-h" title="Multiple choice by section" rows={breakdown}>
      {#if attempt.exam?.extra}
        <p class="small muted extra-note">
          {attempt.exam.extra === 1 ? 'One question' : `${attempt.exam.extra} questions`} beyond the sections' usual counts can come from any of
          them, so one section may have more.
        </p>
      {/if}
    </Breakdown>
  {:else if breakdown.length > 0}
    <Breakdown id="topics-h" title={units.length > 0 ? 'By topic' : 'By chapter'} rows={breakdown} />
  {/if}

  <section class="card" aria-labelledby="questions-h">
    <h3 id="questions-h" class="section-h">Questions</h3>
    <ol class="plain-list review">
      {#each attempt.questions as s, i (s.id)}
        {@const st = attempt.dot(s)}
        {@const open = attempt.checked[s.id] || attempt.finished[s.id]}
        <li>
          <QuestionDot n={i + 1} status={st} />
          <span class="r-text">
            <span class="visually-hidden">Question {i + 1}, {STATUS_TEXT[st]}:</span>
            {truncate(s.promptText, 240)}
          </span>
          <button type="button" class="link-button small" onclick={() => onreview(i)}>
            {open ? 'Review' : s.type === 'frq' && exam ? 'Score it' : 'Answer'}<span class="visually-hidden"> question {i + 1}</span>
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
  .extra-note {
    margin: 0.5rem 0 0;
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
