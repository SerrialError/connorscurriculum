<script lang="ts">
  // A multiple-choice question's choices. Picked with a click or a letter key (Session handles
  // the keys); once checked, the right answer and a wrong pick are marked.
  import { isCorrect } from '../../lib/practice/score';
  import type { McqQuestion } from '../../lib/practice/types';
  import type { Attempt } from './attempt.svelte';

  interface Props {
    q: McqQuestion;
    attempt: Attempt;
  }

  let { q, attempt }: Props = $props();
  const done = $derived(!!attempt.checked[q.id]);
</script>

<fieldset class="choices" disabled={done}>
  <legend class="visually-hidden">Choices</legend>
  {#each q.choices as c (c.id)}
    {@const isAnswer = done && c.id === q.answer}
    {@const isWrongPick = done && attempt.picks[q.id] === c.id && c.id !== q.answer}
    <label class="option-row choice" class:right={isAnswer} class:wrong={isWrongPick}>
      <input
        type="radio"
        name={`pick-${q.id}`}
        value={c.id}
        aria-label={[c.text, isAnswer && 'correct answer', isWrongPick && 'your answer'].filter(Boolean).join(', ')}
        bind:group={attempt.picks[q.id]}
      />
      <span class="letter" aria-hidden="true">{c.id.toUpperCase()}</span>
      <span class="choice-text" data-scroll-x={`Choice ${c.id.toUpperCase()}`}>{@html c.html}</span>
      {#if isAnswer}<span class="mark">✓ Correct answer</span>{/if}
      {#if isWrongPick}<span class="mark">✗ Your answer</span>{/if}
    </label>
  {/each}
</fieldset>

<style>
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  .choices {
    display: grid;
    gap: 0.5rem;
    margin: 1rem 0;
  }
  .choice {
    flex-wrap: wrap;
  }
  .choices:disabled .choice {
    cursor: default;
  }
  .choices:disabled .choice:not(.right, .wrong) {
    opacity: 0.7;
  }
  .choice.right,
  .choice.right:has(input:checked) {
    border-color: var(--good);
    background: var(--good-soft);
    opacity: 1;
  }
  .choice.wrong,
  .choice.wrong:has(input:checked) {
    border-color: var(--bad);
    background: var(--bad-soft);
    opacity: 1;
  }
  .choice input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .letter {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    border: 1px solid var(--border);
    font-weight: 700;
    font-size: 0.85rem;
    background: var(--surface-2);
  }
  .choice.right .letter {
    background: var(--good);
    border-color: var(--good);
    color: var(--surface);
  }
  .choice.wrong .letter {
    background: var(--bad);
    border-color: var(--bad);
    color: var(--surface);
  }
  .choice:not(.right, .wrong):has(input:checked) .letter {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  /* Takes the row, but drops "✓ Correct answer" to its own line before squeezing the text. */
  .choice-text {
    flex: 1 1 12rem;
    padding-top: 0.05rem;
    /* Wide math scrolls sideways, as in the question (Session). */
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .mark {
    font-weight: 700;
    font-size: 0.875rem;
    margin-left: auto;
  }
  .right .mark {
    color: var(--good);
  }
  .wrong .mark {
    color: var(--bad);
  }
</style>
