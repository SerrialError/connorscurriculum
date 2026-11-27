<script lang="ts">
  // "Report a problem with this question", under each practice question. The form itself
  // (FeedbackDialog) is loaded on the first click, so the practice page doesn't carry it.
  import type { Component } from 'svelte';

  interface Props {
    questionId: string;
    number: number;
    picked?: string;
  }

  let { questionId, number, picked }: Props = $props();

  type DialogProps = Props & { onsent: () => void; onclose: () => void };
  let Dialog = $state<Component<DialogProps> | null>(null);
  let open = $state(false);
  let sent = $state(false);

  async function show() {
    Dialog ??= (await import('./FeedbackDialog.svelte')).default;
    open = true;
  }
</script>

<button class="link-button small report" type="button" aria-haspopup="dialog" onclick={show}>
  {sent ? '✓ Feedback sent · Send more' : 'Report a problem with this question'}
</button>
{#if open && Dialog}
  <Dialog {questionId} {number} {picked} onsent={() => (sent = true)} onclose={() => (open = false)} />
{/if}

<style>
  .report {
    color: var(--muted);
    font-weight: 500;
  }
  .report:hover {
    color: var(--link);
  }
</style>
