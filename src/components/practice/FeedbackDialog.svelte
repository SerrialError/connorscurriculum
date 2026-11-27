<script lang="ts">
  // The "Report a problem" form: anonymous feedback on one practice question, filed as a GitHub
  // issue by the site's Worker (lib/practice/feedback.ts). QuestionFeedback loads it on first use.
  import { onMount } from 'svelte';
  import { FEEDBACK_KINDS, type FeedbackForm, MAX_COMMENT, feedbackProblem, sendFeedback } from '../../lib/practice/feedback';

  interface Props {
    questionId: string;
    /** "Question 3", for the heading. */
    number: number;
    /** The student's pick on a multiple-choice question, sent along with the report. */
    picked?: string;
    onsent: () => void;
    /** The dialog was closed (Cancel, Close, or Esc). */
    onclose: () => void;
  }

  let { questionId, number, picked, onsent, onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let kind = $state<FeedbackForm['kind']>('');
  let comment = $state('');
  let website = $state('');
  let status = $state<'editing' | 'sending' | 'sent'>('editing');
  let error = $state('');

  onMount(() => dialog?.showModal());

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const form: FeedbackForm = { questionId, kind, comment, picked, website };
    const problem = feedbackProblem(form);
    if (problem) {
      error = problem;
      return;
    }
    status = 'sending';
    error = '';
    const result = await sendFeedback(form, location.href);
    if (result.ok) {
      status = 'sent';
      onsent();
    } else {
      status = 'editing';
      error = result.error;
    }
  }
</script>

<dialog class="feedback" bind:this={dialog} {onclose} aria-labelledby={`fb-h-${questionId}`}>
  {#if status === 'sent'}
    <h2 id={`fb-h-${questionId}`}>Thanks, it’s sent</h2>
    <p>Your report on question {number} will be read and the question fixed if something’s wrong.</p>
    <div class="actions">
      <button class="button" type="button" onclick={() => dialog?.close()}>Close</button>
    </div>
  {:else}
    <h2 id={`fb-h-${questionId}`}>Report a problem with question {number}</h2>
    <p class="small muted">
      Anonymous: nothing identifies you. Reports are posted publicly as issues on the site’s GitHub page,
      so leave your name out.
    </p>
    <form onsubmit={submit} novalidate>
      <fieldset>
        <legend>What’s wrong?</legend>
        {#each FEEDBACK_KINDS as k (k.id)}
          <label class="option-row">
            <input type="radio" name={`fb-kind-${questionId}`} value={k.id} bind:group={kind} />
            {k.label}
          </label>
        {/each}
      </fieldset>
      <label class="comment">
        <span>Details {kind === 'other' ? '' : '(optional)'}</span>
        <textarea
          bind:value={comment}
          rows="4"
          maxlength={MAX_COMMENT}
          placeholder={kind === 'wrong-answer' ? 'Which answer do you think is right, and why?' : 'What should change?'}
        ></textarea>
      </label>
      <!-- Hidden from people; bots that fill in every field get turned away. -->
      <label class="trap" aria-hidden="true">Website <input type="text" bind:value={website} tabindex="-1" autocomplete="off" /></label>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="actions">
        <button class="button secondary" type="button" onclick={() => dialog?.close()}>Cancel</button>
        <button class="button" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </form>
  {/if}
</dialog>

<style>
  .feedback {
    width: min(30rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: 1.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .feedback::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  h2 {
    font-size: 1.1rem;
    margin: 0 0 0.5rem;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0.75rem 0;
    display: grid;
    gap: 0.4rem;
    min-width: 0;
  }
  legend {
    font-weight: 600;
    padding: 0;
    margin-bottom: 0.4rem;
  }
  .comment {
    display: grid;
    gap: 0.3rem;
    font-weight: 600;
  }
  textarea {
    font: inherit;
    font-weight: 400;
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    resize: vertical;
  }
  textarea:focus {
    outline: 3px solid var(--accent);
    outline-offset: 1px;
    border-color: var(--accent);
  }
  .trap {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  .error {
    color: var(--bad);
    font-weight: 600;
    margin: 0.75rem 0 0;
  }
  .actions {
    justify-content: flex-end;
    margin-bottom: 0;
  }
</style>
