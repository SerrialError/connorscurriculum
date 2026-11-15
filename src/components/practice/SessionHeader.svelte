<script lang="ts">
  // Above the question: ← Filters, how many are answered, End set; the progress bar; the set's
  // name; and the question numbers to jump between. In a practice exam being taken, "answered"
  // counts the multiple-choice questions with a choice picked, and End set is Submit exam.
  import { tick } from 'svelte';
  import type { Attempt } from './attempt.svelte';
  import QuestionDot from './QuestionDot.svelte';

  interface Props {
    attempt: Attempt;
    /** The set's name, e.g. "Ch. 7 · Hard · 10 random", and an optional note. */
    label: string;
    note: string;
    /** Opened from the results screen: the top button goes back there. */
    reviewing: boolean;
    onfilters: () => void;
    /** End set / See results / Back to results, or Submit exam. */
    onresults: () => void;
  }

  let { attempt, label, note, reviewing, onfilters, onresults }: Props = $props();

  /**
   * Sets longer than this keep the question grid closed until it's wanted. A practice exam always
   * shows it: moving around and seeing what's left is how an exam is taken.
   */
  const LONG_SET = 24;

  let jumpOpen = $state(false);
  let qnavEl = $state<HTMLElement | null>(null);
  const total = $derived(attempt.questions.length);
  const collapsible = $derived(total > LONG_SET && !attempt.exam);
  const counted = $derived(attempt.taking ? attempt.mcqs.length : total);
  const done = $derived(attempt.taking ? attempt.mcqs.length - attempt.unpicked.length : attempt.answered);
  const endLabel = $derived(
    reviewing ? 'Back to results' : attempt.taking ? 'Submit exam' : attempt.answered === total ? 'See results' : 'End set',
  );

  // On phones the question numbers are one scrolling row: bring the current one into the middle of it.
  $effect(() => {
    void attempt.index;
    void tick().then(() => {
      const dot = qnavEl?.querySelector<HTMLElement>('[aria-current]');
      if (qnavEl && dot) qnavEl.scrollLeft = dot.offsetLeft - (qnavEl.clientWidth - dot.offsetWidth) / 2;
    });
  });
</script>

<div class="session-bar">
  <button class="link-button" type="button" onclick={() => onfilters()}>{attempt.exam ? '← Practice' : '← Filters'}</button>
  <span class="small muted">{done} of {counted}{#if attempt.taking && counted < total}<span class="wide-only">{' multiple choice'}</span>{/if} answered</span>
  <button class="button secondary small" type="button" onclick={() => onresults()}>{endLabel}</button>
</div>
<div class="progress" role="progressbar" aria-label="Answered" aria-valuemin="0" aria-valuemax={counted} aria-valuenow={done}>
  <span style:width={`${(done / counted) * 100}%`}></span>
</div>
<div class="set-line">
  <p class="set-label small"><strong>{label}</strong>{#if note}<span class="muted">{' · '}{note}</span>{/if}</p>
  {#if collapsible}
    <button type="button" class="link-button small jump-toggle" aria-expanded={jumpOpen} aria-controls="qnav" onclick={() => (jumpOpen = !jumpOpen)}>
      {jumpOpen ? 'Hide question list' : 'Question list'}
    </button>
  {/if}
</div>

{#if collapsible ? jumpOpen : total > 1}
  <nav class="qnav" id="qnav" aria-label="Questions in this set" bind:this={qnavEl}>
    {#each attempt.questions as s, i (s.id)}
      <QuestionDot n={i + 1} status={attempt.dot(s)} current={i === attempt.index} onclick={() => attempt.go(i)} />
    {/each}
  </nav>
{/if}

<style>
  .session-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .session-bar > :global(button) {
    flex: none;
    white-space: nowrap;
  }
  .session-bar > span {
    text-align: center;
  }
  .progress {
    height: 6px;
    border-radius: var(--pill);
    background: var(--surface-2);
    overflow: hidden;
    margin-bottom: 0.75rem;
  }
  .progress span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }
  /* The set's name and "Question list" share one line under the progress bar. */
  .set-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.1rem 1rem;
    margin: -0.35rem 0 0.6rem;
  }
  .set-label {
    margin: 0;
    color: var(--text-2);
  }
  .jump-toggle {
    margin-left: auto;
  }
  .qnav {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 1rem;
  }
  /* Phones: one row that scrolls sideways, so the question starts high on the screen. The padding
     keeps the current number's outline inside the scrolling box. */
  @media (max-width: 520px) {
    .qnav {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      gap: 0.25rem;
      padding: 3px;
      margin: -3px -3px calc(0.75rem - 3px);
    }
    .qnav :global(.qdot) {
      flex: none;
    }
  }
</style>
