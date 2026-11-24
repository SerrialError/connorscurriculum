<script lang="ts">
  // The practice page: build a set (Setup), answer it (Session), then review it (Results).
  // What each screen does to the address and the browser history is decided in
  // lib/practice/nav.ts; this component opens sets, keeps them saved, and applies those steps.
  import { onMount } from 'svelte';
  import { matchFrqs } from '../../lib/frqs';
  import { activeFilterCount, emptyFilters, filterQuestions, filterTopics } from '../../lib/practice/filters';
  import { EXAM_NOTE, WEAK_NO_HISTORY_NOTE, describeScope, describeSet, examLabel } from '../../lib/practice/labels';
  import { practiceStarts } from '../../lib/practice/links';
  import { type LinkProblem, RESHUFFLED_NOTE, knownFilters, linkNotice, missingNote } from '../../lib/practice/link-check';
  import { type Entry, type Step, land, readEntry, startSet, syncSetup, toResults, toReview, toSetup } from '../../lib/practice/nav';
  import { type SavedSet, answeredIn, readSavedSets, resumable as findResumable, withSaved } from '../../lib/practice/saved';
  import { amendLastResult, recordResult, weakHasNoHistory, weakTopics } from '../../lib/practice/score';
  import { newSeed } from '../../lib/practice/random';
  import { questionsForSet } from '../../lib/practice/select';
  import type { Filters, History, PracticeExam, PracticeQuestion, QuestionMeta } from '../../lib/practice/types';
  import { type SetSpec, filtersToQuery, hasBadSeed, parseFilters, parseSet, setToQuery, setupQuery } from '../../lib/practice/url';
  import { readJson, storageKey, writeJson } from '../../lib/storage';
  import { plural } from '../../lib/text';
  import { Attempt } from './attempt.svelte';
  import { type PracticeCourse, setCourse, withDerived } from './context';
  import PracticeHistory from './PracticeHistory.svelte';
  import Results from './Results.svelte';
  import Session from './Session.svelte';
  import Setup from './Setup.svelte';

  let { courseJson }: { courseJson: string } = $props();
  // The course never changes after the page is built.
  // svelte-ignore state_referenced_locally
  const course = setCourse(withDerived(JSON.parse(courseJson) as PracticeCourse));
  const { tests, everything } = course;

  const historyKey = storageKey(course.subject, 'practice-history');
  const savedKey = storageKey(course.subject, 'practice-session');

  /** Every question, without its text: enough for the setup screen and for picking a set. */
  const all: QuestionMeta[] = course.questions;
  /** Question text, loaded one chapter at a time (questions/<chapter>.json) when a set needs it. */
  const texts = new Map<string, PracticeQuestion>();
  const chapterLoads = new Map<number, Promise<void>>();
  let loadError = $state('');
  /** The address has been read and the right screen is up (until then the setup screen is the built one). */
  let ready = $state(false);
  /** Waiting for question text to open a set. */
  let opening = $state(false);
  let phase = $state<'setup' | 'session' | 'results'>('setup');
  let filters = $state<Filters>(emptyFilters());
  let history = $state<History>({});
  let resumable = $state<SavedSet | null>(null);
  const attempt = new Attempt();
  /** The current set: its URL query, seed, name, and an optional note. */
  let set = $state({ query: '', id: '', label: '', note: '' });
  /** Reviewing a question from the results screen: Back (and "Back to results") return there. */
  let reviewing = $state(false);
  /** Why the practice link this page was opened with didn't open its set (link-check.ts). */
  let notice = $state('');

  const setFilters = $derived(parseFilters(set.query));
  const setIsExam = $derived(!!parseSet(set.query)?.exam);

  /** The blueprint of the practice exam a set's address names, or null for any other set. */
  function examFor(query: string): PracticeExam | null {
    const spec = parseSet(query);
    return (spec?.exam && tests.find((t) => t.id === spec.filters.test)?.exam) || null;
  }
  const setFrqTopics = $derived(filterTopics(setFilters, course.units, course.chapterTopics, tests));
  const weakSpots = $derived(weakTopics(filterQuestions(all, emptyFilters(), tests), history));
  /** `f` checked against what this class has. */
  const checked = (f: Filters) => knownFilters(f, { chapters: course.chapters.map((c) => c.number), tests, units: course.units, questions: all });

  function loadChapter(n: number): Promise<void> {
    let load = chapterLoads.get(n);
    if (!load) {
      // Already on its way if the page opened with a "Start" link (see practice/index.astro).
      const early = (window as { __practiceText?: Record<number, Promise<PracticeQuestion[]>> }).__practiceText?.[n];
      load = (
        early ??
        fetch(`${course.questionsBase}${n}.json`).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<PracticeQuestion[]>;
        })
      )
        .then((qs) => {
          for (const q of qs) texts.set(q.id, q);
        });
      // A failed load can be tried again.
      load.catch(() => chapterLoads.delete(n));
      chapterLoads.set(n, load);
    }
    return load;
  }

  /**
   * The questions with their text, loading their chapters if needed. "Loading questions…" shows
   * only if that takes long enough to notice.
   */
  async function withText(questions: QuestionMeta[]): Promise<PracticeQuestion[] | null> {
    const missing = [...new Set(questions.filter((q) => !texts.has(q.id)).map((q) => q.chapter))];
    loadError = '';
    if (missing.length) {
      const slow = setTimeout(() => (opening = true), 150);
      try {
        await Promise.all(missing.map(loadChapter));
      } catch (err) {
        loadError = `Could not load the questions (${(err as Error).message}). Check your connection and try again.`;
        return null;
      } finally {
        clearTimeout(slow);
        opening = false;
      }
    }
    return questions.flatMap((q) => texts.get(q.id) ?? []);
  }

  const entry = (): Entry => readEntry(window.history.state);

  /** Apply history steps. True when one moved through history: the popstate handler then shows the screen. */
  function navigate(steps: Step[]): boolean {
    for (const s of steps) {
      if (s.op === 'go') window.history.go(s.delta);
      else if (s.op === 'push') window.history.pushState(s.entry, '', location.pathname + s.query);
      else window.history.replaceState(s.entry, '', location.pathname + s.query);
    }
    return steps.some((s) => s.op === 'go');
  }

  // Keep the URL in sync with the setup filters, so reloading or copying the address keeps them.
  $effect(() => {
    if (ready && phase === 'setup') navigate(syncSetup(location.search, filtersToQuery(filters)));
  });

  // During a set the page title ("Practice") is hidden, so the question starts higher on phones.
  $effect(() => {
    document.body.dataset.practice = phase;
  });

  // Save the set after every change.
  $effect(() => {
    if (phase === 'setup' || attempt.questions.length === 0) return;
    const saved: SavedSet = { ...set, ...attempt.answers(), ids: attempt.questions.map((q) => q.id), index: attempt.index, phase };
    writeJson(savedKey, withSaved(savedSets(), saved));
  });

  onMount(() => {
    filters = parseFilters(location.search);
    history = readJson<History>(historyKey, {});
    const onPop = () => void arrive();
    window.addEventListener('popstate', onPop);
    // Opening a set (a "Start" link, a reload mid-set): say so at once instead of showing setup first.
    if (parseSet(location.search) || entry()) opening = true;
    void arrive();
    // The chapters the class is on now are the likeliest sets: load their text as soon as the
    // student points at or taps a button (Start, a quick start), not on every visit.
    const prefetch = (e: Event) => {
      if (!(e.target as HTMLElement).closest?.('button, a')) return;
      course.prefetchChapters.forEach((n) => void loadChapter(n).catch(() => {}));
      for (const ev of ['pointerover', 'focusin', 'touchstart']) document.removeEventListener(ev, prefetch);
    };
    for (const ev of ['pointerover', 'focusin', 'touchstart']) document.addEventListener(ev, prefetch, { passive: true });
    return () => window.removeEventListener('popstate', onPop);
  });

  /**
   * The page landed on a history entry (load, Back, Forward): show the set its address names (a
   * reload, a bookmark, a shared link, or a "Start" link elsewhere on the site), else setup.
   */
  async function arrive() {
    const current = entry();
    const spec = parseSet(location.search);
    const isOpen = !!spec?.seed && spec.seed === set.id && attempt.questions.length > 0;
    // A link with filters the class doesn't have opens the setup screen without them (showSetup says so).
    const fits = !spec || checked(spec.filters).unknown === null;
    const opened = isOpen || (spec ? fits && (await openSet(spec, hasBadSeed(location.search))) : !!current && (await openSaved(current.set)));
    opening = false;
    document.documentElement.classList.remove('practice-opening');
    ready = true;
    // The set couldn't load: the setup screen, with the error above it.
    if (loadError) {
      phase = 'setup';
      return;
    }
    const landed = land(location.search, current, opened ? set : null);
    navigate(landed.steps);
    if (landed.entry) {
      reviewing = !!landed.entry.reviewing;
      phase = landed.entry.phase;
    } else {
      showSetup(!spec || !fits ? null : spec.ids ? { kind: 'gone', filtered: activeFilterCount(spec.filters) > 0 } : { kind: 'empty' });
    }
  }

  const savedSets = () => readSavedSets(readJson<unknown>(savedKey, null), new Set(all.map((q) => q.id)));

  /**
   * Open a set from its address: the saved attempt with that seed, or a new one built from it.
   * `badSeed`: the address's seed was damaged, so a new set's questions aren't the ones shared.
   */
  async function openSet(spec: SetSpec, badSeed: boolean): Promise<boolean> {
    if (spec.seed && (await openSaved(spec.seed, setToQuery(spec)))) return true;
    const full = { ...spec, seed: spec.seed ?? newSeed() };
    const questions = await withText(questionsForSet(all, full, tests, history));
    if (!questions?.length) return false;
    loadSet(full, questions);
    if (badSeed && !spec.ids) set.note = RESHUFFLED_NOTE;
    return true;
  }

  /** The saved set `id` (with address `query`, if given), with its answers. */
  async function openSaved(id: string, query?: string): Promise<boolean> {
    const s = savedSets().find((x) => x.id === id && (query === undefined || x.query === query));
    if (!s) return false;
    const byId = new Map(all.map((q) => [q.id, q]));
    const questions = await withText(s.ids.map((i) => byId.get(i)!));
    if (!questions) return false;
    attempt.load(
      questions,
      s,
      s.index,
      examFor(s.query),
    );
    set = { query: s.query, id: s.id, label: s.label || describeScope(parseFilters(s.query), tests, everything), note: s.note };
    resumable = null;
    return true;
  }

  /** Make `questions` the current set, unanswered. */
  function loadSet(spec: SetSpec & { seed: string }, questions: PracticeQuestion[], label?: string) {
    const pool = filterQuestions(all, spec.filters, tests);
    const query = setToQuery(spec);
    attempt.load(questions, undefined, 0, examFor(query));
    set = {
      query,
      id: spec.seed,
      label:
        label ??
        (spec.exam && spec.filters.test
          ? examLabel(spec.filters.test, tests)
          : spec.ids
            ? `${describeScope(spec.filters, tests, everything)} · ${plural(questions.length, 'chosen question')}`
            : describeSet(spec.filters, tests, questions.length, pool.length, everything)),
      note: setNote(spec, questions.length, pool),
    };
    resumable = null;
    reviewing = false;
  }

  /** The line shown with a new set: questions missing from a shared set, or why "weakest first" is random. */
  function setNote(spec: SetSpec, found: number, pool: QuestionMeta[]): string {
    if (spec.exam) return EXAM_NOTE;
    if (spec.ids) {
      const asked = new Set(spec.ids).size;
      return found < asked ? missingNote(asked, found) : '';
    }
    return spec.filters.mode === 'weak' && weakHasNoHistory(pool, history) ? WEAK_NO_HISTORY_NOTE : '';
  }

  /** Start a new set from filters `f`: exact questions for a retry, or a practice exam of the filters' test. */
  async function begin(f: Filters, { ids = null, label, exam = false }: { ids?: string[] | null; label?: string; exam?: boolean } = {}) {
    const spec = { filters: f, exam, seed: newSeed(), ids };
    const questions = await withText(questionsForSet(all, spec, tests, history));
    if (!questions?.length) return;
    if (phase === 'setup') filters = f;
    notice = '';
    loadSet(spec, questions, label);
    navigate(startSet(phase, entry(), filtersToQuery(f), set));
    phase = 'session';
  }

  async function resume() {
    if (!resumable) return;
    // Like starting it: the setup entry below shows the filters that made this set.
    const q = setupQuery(resumable.query);
    if (!(await openSaved(resumable.id))) return;
    filters = parseFilters(q);
    navigate(startSet('setup', entry(), q, set));
    phase = 'session';
  }

  function discardResume() {
    writeJson(
      savedKey,
      savedSets().filter((s) => s.id !== resumable?.id),
    );
    resumable = null;
  }

  /** The setup screen for the address's filters, saying why if the link (`problem`) didn't open its set. */
  function showSetup(problem: LinkProblem | null = null) {
    const { filters: known, unknown } = checked(parseFilters(location.search));
    filters = known;
    notice = unknown ? linkNotice({ kind: 'unknown', ...unknown }) : problem ? linkNotice(problem) : '';
    reviewing = false;
    phase = 'setup';
    resumable = findResumable(savedSets());
    window.scrollTo({ top: 0 });
  }

  /** "← Filters" / "Change filters": the setup screen with the filters that made this set. */
  function backToSetup() {
    if (!navigate(toSetup(entry(), set))) showSetup();
  }

  function showResults() {
    if (navigate(toResults(entry(), set))) return;
    reviewing = false;
    phase = 'results';
  }

  function review(i: number) {
    navigate(toReview(entry(), set));
    reviewing = true;
    attempt.go(i);
    phase = 'session';
  }

  /** Submit the practice exam: check every answer, keep the scores in practice history, and show the results. */
  function submitExam() {
    let next = history;
    for (const [id, value] of Object.entries(attempt.submit())) next = recordResult(next, id, value);
    history = next;
    writeJson(historyKey, history);
    showResults();
  }

  function score(id: string, value: number, corrected: boolean) {
    history = corrected ? amendLastResult(history, id, value) : recordResult(history, id, value);
    writeJson(historyKey, history);
  }

  /** A topic's set from "Topics to work on", started like a topic's link elsewhere on the site. */
  function topicStart(topic: string) {
    const pool = { topics: [topic] };
    return practiceStarts(pool, filterQuestions(all, { ...emptyFilters(), ...pool }, tests).length).start;
  }

  function clearHistory() {
    history = {};
    writeJson(historyKey, {});
  }
</script>

{#if loadError}
  <p class="notice" role="alert">{loadError}</p>
{/if}
{#if opening}
  <p class="muted loading" aria-live="polite">Loading questions…</p>
{:else if phase === 'setup'}
  {#if notice}
    <p class="notice link-notice" role="status">{notice}</p>
  {/if}
  {#if resumable}
    {@const r = resumable}
    <section class="card resume" aria-label="Unfinished set">
      <p>
        <strong>Unfinished set{r.label ? ':' : '.'}</strong>
        {#if r.label}{r.label}.{/if}
        <span class="muted">{answeredIn(r)} of {r.ids.length} answered.</span>
      </p>
      <div class="actions">
        <button class="button" type="button" onclick={() => resume()}>Resume</button>
        <button class="button secondary" type="button" onclick={() => discardResume()}>Discard</button>
      </div>
    </section>
  {/if}
  <Setup {all} bind:filters weakest={weakSpots.length > 0} onstart={(f, exam) => begin(f, { exam })} />
  {#if Object.keys(history).length > 0}
    <PracticeHistory
      count={Object.keys(history).length}
      {weakSpots}
      {topicStart}
      onstart={(f) => begin(f)}
      onclear={() => clearHistory()}
    />
  {/if}
{:else if phase === 'session'}
  <Session
    {attempt}
    label={set.label}
    note={attempt.submitted ? '' : set.note}
    {reviewing}
    onfilters={() => backToSetup()}
    onresults={() => showResults()}
    onscore={score}
    onsubmit={() => submitExam()}
  />
{:else}
  <Results
    {attempt}
    label={set.label}
    filters={setFilters}
    frqMatches={setFrqTopics.size ? matchFrqs(course.frqs, setFrqTopics) : []}
    onretry={(words) =>
      begin(setFilters, {
        ids: attempt.missed.map((q) => q.id),
        label: `${describeScope(setFilters, tests, everything)} · ${words}`,
      })}
    onreview={review}
    onagain={() => begin(setFilters, { exam: setIsExam })}
    onfilters={() => backToSetup()}
  />
{/if}

<style>
  /* The space the set will take, so nothing below jumps when it appears. */
  .loading {
    min-height: 80vh;
  }
  .resume {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .resume p,
  .resume .actions {
    margin: 0;
  }
</style>
