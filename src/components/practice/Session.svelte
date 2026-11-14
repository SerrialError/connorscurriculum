<script lang="ts">
  // Answering a set, one question at a time.
  import { tick } from 'svelte';
  import { isTypingTarget } from '../../lib/keyboard';
  import { DIFFICULTY_LABELS, TYPE_LABELS } from '../../lib/practice/labels';
  import { lessonsFor } from '../../lib/practice/lessons';
  import { frqTotal, isCorrect, scoreStatus } from '../../lib/practice/score';
  import type { FrqQuestion, McqQuestion } from '../../lib/practice/types';
  import type { Attempt } from './attempt.svelte';
  import { getCourse } from './context';
  import FrqParts from './FrqParts.svelte';
  import QuestionDot from './QuestionDot.svelte';

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
  }

  let { attempt, label, note, reviewing, onfilters, onresults, onscore }: Props = $props();
  const { lessons, hrefs, topicTitles, units } = getCourse();

  /** Sets longer than this keep the question grid closed until it's wanted. */
  const LONG_SET = 24;

  let jumpOpen = $state(false);
  let heading = $state<HTMLElement | null>(null);
  let nextButton = $state<HTMLButtonElement | null>(null);
  let verdictEl = $state<HTMLElement | null>(null);
  let actionsEl = $state<HTMLElement | null>(null);
  let qnavEl = $state<HTMLElement | null>(null);

  const total = $derived(attempt.questions.length);
  const isLast = $derived(attempt.index === total - 1);

  // A new question starts at the top of the page, with focus on its heading. On phones the
  // question numbers are one scrolling row: bring the current one into the middle of it.
  $effect(() => {
    void attempt.current?.id;
    void tick().then(() => {
      const dot = qnavEl?.querySelector<HTMLElement>('[aria-current]');
      if (qnavEl && dot) qnavEl.scrollLeft = dot.offsetLeft - (qnavEl.clientWidth - dot.offsetWidth) / 2;
      window.scrollTo({ top: 0 });
      heading?.focus({ preventScroll: true });
    });
  });

  function next() {
    if (isLast) onresults();
    else attempt.go(attempt.index + 1);
  }

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

  /**
   * After Check or Done marking: bring the verdict into view and put focus on Next. On phones Next
   * is in a bar stuck to the bottom of the screen, so the verdict (and as much of the explanation
   * as fits) goes near the top. Elsewhere, scroll as little as possible to show the verdict through
   * Next, or put the verdict at the top if they don't all fit.
   */
  async function showVerdict() {
    await tick();
    nextButton?.focus({ preventScroll: true });
    const v = verdictEl?.getBoundingClientRect();
    const bar = actionsEl?.getBoundingClientRect();
    if (!v || !bar || !actionsEl) return;
    const margin = 12;
    const sticky = getComputedStyle(actionsEl).position === 'sticky';
    const bottom = sticky ? Math.min(bar.top, window.innerHeight) : window.innerHeight;
    if (sticky) {
      if (v.top < margin || v.top > bottom / 2) window.scrollBy({ top: v.top - margin });
    } else if (bar.bottom - v.top + 2 * margin <= bottom) {
      if (bar.bottom + margin > bottom) window.scrollBy({ top: bar.bottom + margin - bottom });
      else if (v.top < margin) window.scrollBy({ top: v.top - margin });
    } else if (v.top < margin || v.top > bottom / 3) {
      window.scrollBy({ top: v.top - margin });
    }
  }

  /**
   * ← → move between questions, but only from the page itself, the question, or a button: a
   * focused wide table or equation scrolls with them, and a radio button moves between choices.
   */
  function arrowsMoveQuestions(el: HTMLElement): boolean {
    if (el === document.body || el.id === 'main') return true;
    if (!el.closest('.session')) return false;
    return el.tagName === 'BUTTON' || el.id === 'q-heading' || el.classList.contains('question');
  }

  /** A–D (or 1–4) pick a choice, Enter checks, ← → move between questions. */
  function onKey(e: KeyboardEvent) {
    const q = attempt.current;
    if (!q || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement;
    if (isTypingTarget(el)) return;
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
    } else if (e.key === 'Enter' && attempt.picks[q.id] && !el.closest('button, a')) {
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
  <section class="session" aria-label="Practice set">
    <div class="session-bar">
      <button class="link-button" type="button" onclick={() => onfilters()}>← Filters</button>
      <span class="small muted">{attempt.answered} of {total} answered</span>
      <button class="button secondary small" type="button" onclick={() => onresults()}>
        {reviewing ? 'Back to results' : attempt.answered === total ? 'See results' : 'End set'}
      </button>
    </div>
    <div class="progress" role="progressbar" aria-label="Answered" aria-valuemin="0" aria-valuemax={total} aria-valuenow={attempt.answered}>
      <span style:width={`${(attempt.answered / total) * 100}%`}></span>
    </div>
    <div class="set-line">
      <p class="set-label small"><strong>{label}</strong>{#if note}<span class="muted">{' · '}{note}</span>{/if}</p>
      {#if total > LONG_SET}
        <button type="button" class="link-button small jump-toggle" aria-expanded={jumpOpen} aria-controls="qnav" onclick={() => (jumpOpen = !jumpOpen)}>
          {jumpOpen ? 'Hide question list' : 'Question list'}
        </button>
      {/if}
    </div>

    {#if total > LONG_SET ? jumpOpen : total > 1}
      <nav class="qnav" id="qnav" aria-label="Questions in this set" bind:this={qnavEl}>
        {#each attempt.questions as s, i (s.id)}
          <QuestionDot n={i + 1} status={scoreStatus(attempt.scores[s.id])} current={i === attempt.index} onclick={() => attempt.go(i)} />
        {/each}
      </nav>
    {/if}

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

        {#if q.type === 'frq' && !attempt.finished[q.id]}
          <p class="frq-hint small">
            <strong>Write your answers on paper first.</strong> Then show the scoring for each part and check every point you earned.
          </p>
        {/if}
        <div class="prompt" data-scroll-x="Question">{@html q.promptHtml}</div>
        {#if q.image}
          <img src={q.image.src} width={q.image.width} height={q.image.height} alt={q.image.alt} decoding="async" />
        {/if}

        {#if q.type === 'mcq'}
          {@const done = !!attempt.checked[q.id]}
          {@const right = done && isCorrect(q, attempt.picks[q.id]!)}
          <fieldset class="choices" disabled={done}>
            <legend class="visually-hidden">Choices</legend>
            {#each q.choices as c (c.id)}
              {@const isAnswer = done && c.id === q.answer}
              {@const isWrongPick = done && attempt.picks[q.id] === c.id && c.id !== q.answer}
              <label class="option-row choice" class:right={isAnswer} class:wrong={isWrongPick}>
                <input type="radio" name={`pick-${q.id}`} value={c.id} bind:group={attempt.picks[q.id]} />
                <span class="letter" aria-hidden="true">{c.id.toUpperCase()}</span>
                <span class="choice-text" data-scroll-x={`Choice ${c.id.toUpperCase()}`}>{@html c.html}</span>
                {#if isAnswer}<span class="mark">✓ Correct answer</span>{/if}
                {#if isWrongPick}<span class="mark">✗ Your answer</span>{/if}
              </label>
            {/each}
          </fieldset>
          {#if done}
            <p class="verdict" class:ok={right} role="status" bind:this={verdictEl}>
              {right ? '✓ Correct' : `✗ Incorrect. The answer is ${q.answer.toUpperCase()}.`}
            </p>
            {@render explained(q)}
          {/if}
        {:else}
          <FrqParts {q} {attempt} onmark={(p, k, earned) => setMark(q, p, k, earned)} />
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
          <button class="button secondary prev" type="button" disabled={attempt.index === 0} onclick={() => attempt.go(attempt.index - 1)}>
            <span aria-hidden="true">←</span><span class="wide-only"> Previous</span>
          </button>
          <span class="spacer"></span>
          {#if q.type === 'mcq' && !attempt.checked[q.id]}
            <button class="button secondary" type="button" onclick={() => next()}>Skip</button>
            <button class="button" type="button" disabled={!attempt.picks[q.id]} onclick={() => check(q)}>Check answer</button>
          {:else if q.type === 'frq' && !attempt.finished[q.id]}
            <button class="button secondary" type="button" onclick={() => next()}>Skip</button>
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
      <p class="small muted kbd-hint">Keyboard: press A–D to choose, Enter to check, ← → to move between questions.</p>
    {/if}
  </section>
{/if}

<style>
  .session-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: space-between;
    margin-bottom: 0.5rem;
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
  .explanation,
  .choice-text {
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
