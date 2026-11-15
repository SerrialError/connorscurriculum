<script lang="ts">
  // A submitted practice exam's score, the way the class test is scored: points out of the test's
  // total, with the multiple choice and the self-scored free response.
  import { formatPoints } from '../../lib/practice/exam';
  import type { ExamScore } from '../../lib/practice/exam';
  import { plural } from '../../lib/text';

  interface Props {
    score: ExamScore;
    /** Open the (first) FRQ to score it. */
    onscorefrq: () => void;
  }

  let { score, onscorefrq }: Props = $props();
  const pct = $derived(Math.round((score.points / score.max) * 100));
</script>

<div class="exam-score">
  <p class="total">
    <span class="big">{formatPoints(score.points)}</span>
    <span class="of">out of {formatPoints(score.max)} points</span>
    <span class="pct">{pct}%</span>
  </p>
  <dl class="parts">
    <div>
      <dt>Multiple choice</dt>
      <dd>
        <strong>{formatPoints(score.mcq.points)}</strong> of {formatPoints(score.mcq.max)} points
        <span class="small muted">({score.mcq.correct} of {score.mcq.count} correct)</span>
      </dd>
    </div>
    {#if score.frq.max > 0}
      <div>
        <dt>Free response</dt>
        <dd>
          {#if score.frq.marked}
            <strong>{formatPoints(score.frq.points)}</strong> of {formatPoints(score.frq.max)} points
            <span class="small muted">({score.frq.earned} of {plural(score.frq.possible, 'rubric point')})</span>
          {:else}
            <span class="muted">Not scored yet, so it counts 0 for now.</span>
            <button type="button" class="button small" onclick={() => onscorefrq()}>Score your free response</button>
          {/if}
        </dd>
      </div>
    {/if}
  </dl>
</div>

<style>
  .exam-score {
    margin-bottom: 0.75rem;
  }
  .total {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.6rem;
    margin: 0 0 0.75rem;
  }
  .big {
    font-size: 2.2rem;
    font-weight: 800;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .of {
    color: var(--text-2);
  }
  .pct {
    padding: 0.1rem 0.5rem;
    border-radius: var(--pill);
    background: var(--accent-soft);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .parts {
    display: grid;
    gap: 0.4rem;
    margin: 0;
  }
  .parts div {
    display: grid;
    grid-template-columns: 9rem minmax(0, 1fr);
    gap: 0.75rem;
    align-items: baseline;
  }
  dt {
    color: var(--text-2);
  }
  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  dd .button {
    margin-left: 0.4rem;
  }
  @media (max-width: 520px) {
    .parts div {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.1rem;
    }
    dd .button {
      display: flex;
      margin: 0.4rem 0 0;
    }
  }
</style>
