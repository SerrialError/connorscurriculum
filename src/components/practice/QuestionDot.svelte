<script lang="ts">
  // A numbered square for one question, coloured (and marked ✓ ✗ ½) by its status. A button in
  // the question grid; a plain label in the results list.
  import { STATUS_MARK, STATUS_TEXT } from '../../lib/practice/labels';
  import type { DotStatus } from '../../lib/practice/score';

  interface Props {
    n: number;
    status: DotStatus;
    current?: boolean;
    /** Makes it a button. */
    onclick?: () => void;
  }

  let { n, status, current = false, onclick }: Props = $props();
</script>

{#if onclick}
  <button type="button" class={`qdot ${status}`} aria-current={current ? 'step' : undefined} aria-label={`Question ${n}, ${STATUS_TEXT[status]}`} {onclick}>
    {#if STATUS_MARK[status]}<span class="qmark" aria-hidden="true">{STATUS_MARK[status]}</span>{/if}{n}
  </button>
{:else}
  <span class={`qdot static ${status}`} aria-hidden="true">{#if STATUS_MARK[status]}<span class="qmark">{STATUS_MARK[status]}</span>{/if}{n}</span>
{/if}

<style>
  .qdot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    min-width: 2rem;
    height: 2rem;
    padding: 0 0.3rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-2);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }
  .qmark {
    font-size: 0.72rem;
  }
  .static {
    cursor: default;
    flex: none;
  }
  .right {
    background: var(--good-soft);
    border-color: var(--good);
    color: var(--good);
  }
  .wrong {
    background: var(--bad-soft);
    border-color: var(--bad);
    color: var(--bad);
  }
  /* Picked in a practice exam that isn't submitted yet: filled, but not marked right or wrong. */
  .picked {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--text);
  }
  .partial {
    background: var(--warn-soft);
    border-color: var(--warn);
    color: var(--warn);
  }
  [aria-current='step'] {
    outline: 2px solid var(--text);
    outline-offset: 1px;
  }
</style>
