<script lang="ts">
  // "How many": All, the COUNT_CHOICES, or Other with a number box. Changes only the count.
  import { COUNT_CHOICES, DEFAULT_COUNT, MAX_COUNT, isCustomCount } from '../../lib/practice/filters';
  import Chip from './Chip.svelte';

  interface Props {
    /** The count (null is All); only ever set to a valid number. */
    n: number | null;
    /** How many questions match the other filters. */
    matching: number;
  }

  let { n = $bindable(), matching }: Props = $props();

  // Both start from `n` only: Setup re-creates this picker when "Reset all" resets the count.
  /** "Other" is picked (its number box is showing). */
  // svelte-ignore state_referenced_locally
  let custom = $state(isCustomCount(n));
  /** What the number box shows while typing. */
  // svelte-ignore state_referenced_locally
  let text = $state(String(n ?? DEFAULT_COUNT));
  let input = $state<HTMLInputElement | null>(null);

  const invalid = $derived.by(() => {
    if (!custom) return false;
    const v = Number(text);
    return text.trim() === '' || !Number.isInteger(v) || v < 1;
  });

  function pick(value: number | null, other = false) {
    custom = other;
    n = value;
    text = String(value ?? DEFAULT_COUNT);
    if (other) {
      // The box appears with "Other"; put the cursor in it once it's there.
      queueMicrotask(() => {
        input?.focus();
        input?.select();
      });
    }
  }

  /** Whole numbers from 1 to MAX_COUNT; anything else is ignored. */
  function onInput(value: string) {
    text = value;
    const v = Number(value);
    if (value.trim() !== '' && Number.isInteger(v) && v > 0) n = Math.min(v, MAX_COUNT);
  }

  /** Leaving the box: show the number the set will really have (at most what matches). */
  function onBlur() {
    const v = n ?? DEFAULT_COUNT;
    n = matching > 0 ? Math.min(v, matching) : v;
    text = String(n);
  }
</script>

<div class="chips">
  <Chip type="radio" name="count" checked={n === null && !custom} onchange={() => pick(null)}>All</Chip>
  {#each COUNT_CHOICES as c (c)}
    <Chip type="radio" name="count" checked={n === c && !custom} onchange={() => pick(c)}>{c}</Chip>
  {/each}
  <Chip type="radio" name="count" checked={custom} onchange={() => pick(n ?? DEFAULT_COUNT, true)}>Other</Chip>
  {#if custom}
    <label>
      <span class="visually-hidden">Number of questions</span>
      <input
        class="num"
        type="number"
        inputmode="numeric"
        min="1"
        max={Math.max(1, Math.min(MAX_COUNT, matching))}
        value={text}
        bind:this={input}
        aria-invalid={invalid}
        aria-describedby="count-help"
        oninput={(e) => onInput(e.currentTarget.value)}
        onblur={() => onBlur()}
      />
    </label>
    <span id="count-help" class="small help" class:warn={invalid || (n ?? 0) > matching}>
      {#if invalid}Type a whole number{:else if (n ?? 0) > matching}Only {matching} match{:else}max {Math.min(MAX_COUNT, matching)}{/if}
    </span>
  {/if}
</div>

<style>
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
  .help {
    color: var(--muted);
  }
  .help.warn {
    color: var(--warn);
    font-weight: 600;
  }
</style>
