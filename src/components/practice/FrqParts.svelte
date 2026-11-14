<script lang="ts">
  // A free-response question's parts. Each part's scoring stays hidden until asked for; then the
  // student checks every point they earned.
  import type { FrqQuestion } from '../../lib/practice/types';
  import { plural } from '../../lib/text';
  import type { Attempt } from './attempt.svelte';

  interface Props {
    q: FrqQuestion;
    attempt: Attempt;
    /** A point was checked or unchecked. */
    onmark: (part: number, point: number, earned: boolean) => void;
  }

  let { q, attempt, onmark }: Props = $props();
</script>

{#each q.parts as part, p (part.label)}
  <section class="frq-part">
    <h3>({part.label}) <span class="small muted">{plural(part.points, 'pt')}</span></h3>
    <div class="prompt" data-scroll-x={`Part (${part.label})`}>{@html part.promptHtml}</div>
    {#if attempt.revealed[q.id]?.[p]}
      <fieldset class="scoring">
        <legend class="small">Scoring: check each point you earned</legend>
        {#each part.scoringHtml as s, k (k)}
          <label class="option-row point">
            <input type="checkbox" checked={!!attempt.marks[q.id]?.[p]?.[k]} onchange={(e) => onmark(p, k, e.currentTarget.checked)} />
            <span>{@html s}</span>
          </label>
        {/each}
      </fieldset>
    {:else}
      <button class="button secondary small" type="button" onclick={() => attempt.reveal(q, p)}>Show scoring for ({part.label})</button>
    {/if}
  </section>
{/each}

<style>
  .frq-part {
    margin: 0.75rem 0 1rem;
  }
  .frq-part h3 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
  }
  /* As in Session: wide math scrolls sideways only. */
  .prompt {
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    font-size: 1.05rem;
  }
  .scoring {
    border: 0;
    min-width: 0;
    margin: 0.5rem 0 0;
    padding: 0.5rem 0.6rem 0.6rem;
    border-radius: 8px;
    background: var(--surface-2);
  }
  .scoring legend {
    float: left;
    width: 100%;
    margin-bottom: 0.2rem;
    font-weight: 700;
    color: var(--text-2);
  }
  .point {
    /* The legend floats (so it sits inside the grey box); each row starts below it. */
    clear: both;
    min-height: 2.75rem;
    margin-top: 0.4rem;
  }
  /* A 24px box in place of the small native checkbox. */
  .point input {
    appearance: none;
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    margin: 0;
    border: 2px solid var(--muted);
    border-radius: 6px;
    background: var(--surface);
    cursor: pointer;
  }
  .point input:focus-visible {
    outline: none;
  }
  .point input:checked {
    border-color: var(--accent);
    background: var(--accent);
  }
  .point input:checked::after {
    content: '✓';
    color: var(--accent-ink);
    font-weight: 800;
    font-size: 1rem;
    line-height: 1;
  }
  .point > span {
    min-width: 0;
    padding-top: 0.1rem;
  }
</style>
