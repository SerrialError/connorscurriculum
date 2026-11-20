<script lang="ts">
  // Answering a set, one question at a time. A practice exam being taken shows no checking or
  // scoring: the student picks, moves around, and submits (confirming if any are unanswered).
  import { tick } from 'svelte';
  import { isTypingTarget } from '../../lib/keyboard';
  import { DIFFICULTY_LABELS, TYPE_LABELS, listNumbers } from '../../lib/practice/labels';
  import { lessonsFor } from '../../lib/practice/lessons';
  import { frqTotal, isCorrect } from '../../lib/practice/score';
  import type { FrqQuestion, McqQuestion } from '../../lib/practice/types';
  import { verdictScroll } from '../../lib/practice/verdict-scroll';
  import type { Attempt } from './attempt.svelte';
  import { getCourse } from './context';
  import FrqParts from './FrqParts.svelte';
  import McqChoices from './McqChoices.svelte';
  import SessionHeader from './SessionHeader.svelte';

  interface Props {
    attempt: Attempt;
    /** The set's name, e.g. "Ch. 7 · Hard · 10 random", and an optional note. */
    label: string;
    note: string;
    /** Opened from the results screen: the top button goes back there. */
    reviewing: boolean;
    /** "← Filters" */
    onfilters: () => void;
    onresults: () => void;
    /** An answer was checked (MCQ) or marked done (FRQ), or its marks changed afterwards. */
    onscore: (id: string, score: number, corrected: boolean) => void;
    /** Submit the practice exam being taken (after confirming, if anything is unanswered). */
    onsubmit: () => void;
  }

  let { attempt, label, note, reviewing, onfilters, onresults, onscore, onsubmit }: Props = $props();
  const { lessons, hrefs, topicTitles, units } = getCourse();

  let heading = $state<HTMLElement | null>(null);
  let nextButton = $state<HTMLButtonElement | null>(null);
  let verdictEl = $state<HTMLElement | null>(null);
  let actionsEl = $state<HTMLElement | null>(null);
  let confirmEl = $state<HTMLDialogElement | null>(null);

  const total = $derived(attempt.questions.length);
  const isLast = $derived(attempt.index === total - 1);

  // A new question starts at the top of the page, with focus on its heading.
  $effect(() => {
    void attempt.current?.id;
    void tick().then(() => {
      window.scrollTo({ top: 0 });
      heading?.focus({ preventScroll: true });
    });
  });

  function next() {
    if (!isLast) attempt.go(attempt.index + 1);
    else if (attempt.taking) requestSubmit();
    else onresults();
  }

  /** Submit exam: straight away when every multiple-choice question has an answer, else ask first. */
  function requestSubmit() {
    if (attempt.unpicked.length === 0) onsubmit();
    else confirmEl?.showModal();
  }

  /** From the confirm dialog: to the first unanswered question. */
  function goToUnanswered() {
    confirmEl?.close();
    attempt.go(attempt.questions.indexOf(attempt.unpicked[0]!));
  }

  const unpickedNumbers = $derived(attempt.unpicked.map((q) => attempt.questions.indexOf(q) + 1));

  async function check(q: McqQuestion) {
    if (!attempt.check(q)) return;
    onscore(q.id, isCorrect(q, attempt.picks[q.id]!) ? 1 : 0, false);
    await showVerdict();
  }

  async function finish(q: FrqQuestion) {
    attempt.finish(q);
    onscore(q.id, attempt.earned(q) / frqTotal(q), false);
    await showVerdict();
  }

  function setMark(q: FrqQuestion, part: number, point: number, value: boolean) {
    attempt.setMark(q, part, point, value);
    // Changing a mark after "Done marking" corrects the score already saved for this attempt.
    if (attempt.finished[q.id]) onscore(q.id, attempt.earned(q) / frqTotal(q), true);
  }

  /** After Check or Done marking: focus Next and scroll the verdict into view (see verdictScroll). */
  async function showVerdict() {
    await tick();
    nextButton?.focus({ preventScroll: true });
    if (!verdictEl || !actionsEl) return;
    const bar = actionsEl.getBoundingClientRect();
    const top = verdictScroll({
      verdictTop: verdictEl.getBoundingClientRect().top,
      barTop: bar.top,
      barBottom: bar.bottom,
      viewportHeight: window.innerHeight,
      sticky: getComputedStyle(actionsEl).position === 'sticky',
    });
    if (top) window.scrollBy({ top });
  }

  /** The set's shortcuts work from inside it, or from the page itself (nothing focused), not from the header or nav. */
  const pageOrSession = (el: HTMLElement): boolean => el === document.body || el.id === 'main' || !!el.closest('.session');

  /**
   * ← → move between questions, but only from the page itself, the question, or a button: a
   * focused wide table or equation scrolls with them, and a radio button moves between choices.
   */
  function arrowsMoveQuestions(el: HTMLElement): boolean {
    if (el === document.body || el.id === 'main') return true;
    return el.tagName === 'BUTTON' || el.id === 'q-heading' || el.classList.contains('question');
  }

  /** A–D (or 1–4) pick a choice, Enter checks, ← → move between questions. */
  function onKey(e: KeyboardEvent) {
    const q = attempt.current;
    if (!q || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement;
    if (isTypingTarget(el) || !pageOrSession(el)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (e.shiftKey || !arrowsMoveQuestions(el)) return;
      e.preventDefault();
      attempt.go(attempt.index + (e.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (q.type !== 'mcq' || attempt.checked[q.id]) return;
    const key = e.key.toLowerCase();
    const choice = q.choices.find((c) => c.id === key) ?? (/^[1-9]$/.test(key) ? q.choices[Number(key) - 1] : undefined);
    if (choice) {
      attempt.pick(q, choice.id);
      e.preventDefault();
    } else if (e.key === 'Enter' && !attempt.taking && attempt.picks[q.id] && !el.closest('button, a')) {
      e.preventDefault();
      void check(q);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#snippet explained(q: McqQuestion | FrqQuestion)}
  {@const found = lessonsFor(q, lessons)}
  <div class="explanation" data-scroll-x="Explanation"><p class="explanation-h">Explanation</p>{@html q.explanationHtml}</div>
  {#if found.length > 0}
    <p class="study small">
      <span class="study-label">Study this in the lesson:</span>
      {#each found as l, i (l.href)}{i > 0 ? ' · ' : ' '}<a href={l.href}>{l.title}</a>{/each}
    </p>
  {/if}
{/snippet}

{#if attempt.current}
  {@const q = attempt.current}
  <section class="session" aria-label={attempt.exam ? (attempt.exam.noun === 'quiz' ? 'Practice quiz' : 'Practice exam') : 'Practice set'}>
    <SessionHeader {attempt} {label} {note} {reviewing} {onfilters} onresults={() => (attempt.taking ? requestSubmit() : onresults())} />

    {#key q.id}
      <article class="card question" aria-labelledby="q-heading">
        <header class="q-head">
          <h2 id="q-heading" tabindex="-1" bind:this={heading}>Question {attempt.index + 1} <span class="muted">of {total}</span></h2>
          <p class="q-meta small muted">
            {TYPE_LABELS[q.type]} · Ch. {q.chapter} ·
            {#if units.length > 0}
              {#each q.cedTopics as t, i (t)}{i > 0 ? ', ' : ''}<a href={`${hrefs.topics}${t}/`} title={topicTitles.get(t)}><span class="visually-hidden">AP topic </span>{t}</a>{:else}Not on the AP exam{/each}
              ·
            {/if}
            {DIFFICULTY_LABELS[q.difficulty]}
          </p>
        </header>

        {#if q.type === 'frq' && attempt.taking}
          <p class="frq-hint small">Write your answers on paper. You score them yourself after you submit the {attempt.exam?.noun ?? 'exam'}.</p>
        {:else if q.type === 'frq' && !attempt.finished[q.id]}
          <p class="frq-hint small">Write your answers on paper first.</p>
        {/if}
        <div class="prompt" data-scroll-x="Question">{@html q.promptHtml}</div>
        {#if q.image}
          <img src={q.image.src} width={q.image.width} height={q.image.height} alt={q.image.alt} decoding="async" />
        {/if}

        {#if q.type === 'mcq'}
          {@const done = !!attempt.checked[q.id]}
          {@const right = done && isCorrect(q, attempt.picks[q.id]!)}
          <McqChoices {q} {attempt} />
          {#if done}
            <p class="verdict" class:ok={right} role="status" bind:this={verdictEl}>
              {right ? '✓ Correct' : `✗ ${attempt.picks[q.id] ? 'Incorrect' : 'Not answered'}. The answer is ${q.answer.toUpperCase()}.`}
            </p>
            {@render explained(q)}
          {/if}
        {:else}
          <FrqParts {q} {attempt} scoring={!attempt.taking} onmark={(p, k, earned) => setMark(q, p, k, earned)} />
          {#if attempt.finished[q.id]}
            <p class="verdict ok" role="status" bind:this={verdictEl}>
              You earned {attempt.earned(q)} of {frqTotal(q)} points.
              <span class="small muted">You can still change your marks above.</span>
            </p>
            {@render explained(q)}
          {/if}
        {/if}

        <!-- On phones this is a bar stuck to the bottom of the screen, so Check / Next never needs a scroll. -->
        <div class="q-actions" bind:this={actionsEl}>
          {#if attempt.index > 0}
            <button class="button secondary prev" type="button" onclick={() => attempt.go(attempt.index - 1)}>
              <span aria-hidden="true">←</span><span class="wide-only"> Previous</span>
            </button>
          {/if}
          <span class="spacer"></span>
          {#if attempt.taking}
            <button class="button" type="button" onclick={() => next()}>{isLast ? `Submit ${attempt.exam?.noun ?? 'exam'}` : 'Next question →'}</button>
          {:else if q.type === 'mcq' && !attempt.checked[q.id]}
            <button class="button secondary" type="button" onclick={() => next()}>Skip</button>
            <button class="button" type="button" disabled={!attempt.picks[q.id]} onclick={() => check(q)}>Check answer</button>
          {:else if q.type === 'frq' && !attempt.finished[q.id]}
            <!-- No Skip once any scoring is showing: the answers are in view, so the way on is to mark them. -->
            {#if !attempt.anyShown(q)}
              <button class="button secondary" type="button" onclick={() => next()}>Skip</button>
            {/if}
            <!-- One button, so focus stays put when "Show all scoring" turns into "Done marking". -->
            <button class="button" type="button" onclick={() => (attempt.allShown(q) ? finish(q) : q.parts.forEach((_, p) => attempt.reveal(q, p)))}>
              {#if attempt.allShown(q)}
                Done<span class="wide-only"> marking</span> ({attempt.earned(q)}/{frqTotal(q)})
              {:else}
                {q.parts.length > 1 ? 'Show all scoring' : 'Show scoring'}
              {/if}
            </button>
          {:else}
            <button class="button" type="button" bind:this={nextButton} onclick={() => next()}>
              {isLast ? 'See results →' : 'Next question →'}
            </button>
          {/if}
        </div>
      </article>
    {/key}
    {#if q.type === 'mcq'}
      <p class="small muted kbd-hint">
        Keyboard: press A–{q.choices.at(-1)!.id.toUpperCase()} to choose{attempt.taking ? '' : ', Enter to check'}, ← → to move between questions.
      </p>
    {/if}
  </section>
{/if}

<!-- Submit exam with questions left: say which, and offer the first of them. -->
<dialog class="confirm" bind:this={confirmEl} aria-labelledby="confirm-h">
  <h2 id="confirm-h">Submit with {attempt.unpicked.length} unanswered?</h2>
  <p>
    {#if unpickedNumbers.length <= 8}
      {unpickedNumbers.length === 1 ? 'Question' : 'Questions'} {listNumbers(unpickedNumbers)} {unpickedNumbers.length === 1 ? 'has' : 'have'} no answer
    {:else}
      {unpickedNumbers.length} multiple-choice questions have no answer
    {/if}
    and will score 0. You can't change answers after you submit.
  </p>
  <div class="actions">
    <button class="button secondary" type="button" onclick={() => goToUnanswered()}>Go to question {unpickedNumbers[0]}</button>
    <button class="button" type="button" onclick={() => { confirmEl?.close(); onsubmit(); }}>Submit anyway</button>
  </div>
</dialog>

<style>
  .question {
    min-width: 0;
    padding: 1.1rem 1.25rem;
  }
  .question h2 {
    font-size: 1.05rem;
    margin: 0;
  }
  .question h2:focus {
    outline: none;
  }
  .q-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem 1rem;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 0.6rem;
  }
  .q-meta {
    margin: 0;
  }
  /* Wide math scrolls sideways (ScrollCues makes the box focusable). KaTeX pokes a pixel or two
     below the line, which should not make the box scroll up and down. */
  .prompt,
  .explanation {
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .prompt {
    font-size: 1.05rem;
  }
  .question img {
    display: block;
    margin: 0.75rem 0;
    border-radius: 8px;
    background: #fff;
  }
  .verdict {
    font-weight: 700;
    color: var(--bad);
    margin: 0.5rem 0;
  }
  .verdict.ok {
    color: var(--good);
  }
  .verdict .small {
    display: block;
    font-weight: 400;
  }
  .explanation {
    border-top: 1px solid var(--border);
    margin-top: 0.5rem;
    padding-top: 0.25rem;
  }
  .explanation-h {
    margin: 0.5rem 0 0.25rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .study {
    margin: 0.75rem 0 0;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    background: var(--accent-soft);
  }
  .study a {
    font-weight: 600;
  }
  .study-label {
    color: var(--text-2);
  }
  .frq-hint {
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    border-left: 4px solid var(--tip);
    border-radius: 0 8px 8px 0;
    background: var(--tip-soft);
    color: var(--text);
  }
  .confirm {
    max-width: min(28rem, calc(100vw - 2rem));
    padding: 1.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .confirm::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  .confirm h2 {
    margin: 0 0 0.5rem;
    font-size: 1.15rem;
  }
  .confirm .actions {
    margin: 1rem 0 0;
    justify-content: flex-end;
  }
  .q-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }
  .q-actions .button {
    padding-inline: 0.85rem;
  }
  .spacer {
    flex: 1;
  }
  .kbd-hint {
    margin-top: 0.6rem;
  }
  /* No keyboard hint on touch screens and phones. */
  @media (hover: none), (pointer: coarse), (max-width: 640px) {
    .kbd-hint {
      display: none;
    }
  }
  /* Phones: the actions are one row stuck to the bottom of the screen while the question is in
     view, so the main one (Check, Done marking, Next) is always in reach: ← | Skip | Check answer. */
  @media (max-width: 640px) {
    .question {
      padding: 1rem;
    }
    .q-actions {
      position: sticky;
      bottom: 0;
      z-index: 2;
      flex-wrap: nowrap;
      margin: 1rem -1rem -1rem;
      padding: 0.5rem 1rem;
      background: var(--surface);
      border-radius: 0 0 var(--radius) var(--radius);
      box-shadow: 0 -6px 16px -10px rgb(0 0 0 / 0.25);
    }
    .q-actions .spacer {
      display: none;
    }
    .q-actions .button {
      min-height: 2.75rem;
      padding-inline: 0.7rem;
      white-space: nowrap;
    }
    .q-actions .button:not(.secondary) {
      flex: 1 1 auto;
    }
    .q-actions .prev {
      flex: none;
      min-width: 2.75rem;
      padding-inline: 0.6rem;
    }
  }
</style>
