<script lang="ts">
  // One filter chip: a checkbox or radio styled as a pill (.chip in global.css), with an optional
  // count of the questions it would give.
  import type { Snippet } from 'svelte';

  interface Props {
    type?: 'checkbox' | 'radio';
    /** Radio group name. */
    name?: string;
    checked: boolean;
    onchange: (checked: boolean) => void;
    count?: number;
    title?: string;
    children: Snippet;
  }

  let { type = 'checkbox', name, checked, onchange, count, title, children }: Props = $props();
</script>

<label class="chip" {title}>
  <input {type} {name} {checked} onchange={(e) => onchange(e.currentTarget.checked)} />
  <span>{@render children()}</span>
  {#if count !== undefined}<span class="chip-count" class:zero={count === 0}>{count}</span>{/if}
</label>
