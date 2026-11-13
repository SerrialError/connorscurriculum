<script lang="ts">
  // The practice page: build a set (Setup), answer it (Session), then review it (Results).
  //
  // The address always says what's on screen (see "A set in the URL" in lib/practice.ts):
  // - setup: the filters, e.g. ?chapter=7&difficulty=3, whichever way the page was opened.
  // - a set or its results: the filters plus start=1 and a seed (or the exact question ids), so a
  //   reload, a bookmark, or a shared link reopens the same set.
  //
  // History: starting a set from setup first writes that set's filters into the setup entry, then
  // adds an entry for the set, so Back and "← Filters" always return to the filters that made the
  // current set. A set opened from a link (?start=1) replaces the link's entry instead, so Back
  // returns to the page the link was on, and "← Filters" swaps the set for its filters.
  import { onMount } from 'svelte';
  import type { FrqLink } from '../../lib/frqs';
  import { matchFrqs } from '../../lib/frqs';
  import {
    type Filters,
    type History,
    type PracticeLesson,
    type PracticeQuestion,
    type PracticeTest,
    type SetSpec,
    ALL_QUESTIONS,
    WEAK_NO_HISTORY_NOTE,
    amendLastResult,
    chapterRange,
    describeScope,
    describeSet,
    emptyFilters,
    filterQuestions,
    filterTopics,
    filtersToQuery,
    newSeed,
    parseFilters,
    parseSet,
    questionsForSet,
    recordResult,
    sessionSize,
    setToQuery,
    setupQuery,
    topicQuery,
    wantsStart,
    weakHasNoHistory,
    weakTopics,
  } from '../../lib/practice';
  import { type SavedSet, answeredIn, readSavedSets, resumable as findResumable, withSaved } from '../../lib/practice-saved';
  import { readJson, storageKey, writeJson } from '../../lib/storage';
  import { plural } from '../../lib/text';
  import { Attempt } from './attempt.svelte';
  import PracticeHistory from './PracticeHistory.svelte';
  import Results from './Results.svelte';
  import Session from './Session.svelte';
  import Setup, { type Chapter, type Preset } from './Setup.svelte';

  interface Props {
    subject: string;
    questionsUrl: string;
    chapters: (Chapter & { finished: boolean })[];
    units: { id: string; title: string; topics: { id: string; title: string }[] }[];
    tests: PracticeTest[];
    /** Released AP FRQs with per-part topic tags. */
    frqs: FrqLink[];
    /** chapter number -> CED topics it teaches */
    chapterTopics: Record<string, string[]>;
    /** Topics learned this year or last year, for FRQ readiness. */
    learnedTopics: string[];
    frqsHref: string;
    /** Base URL of topic pages; the topic id and "/" are appended. */
    topicsHref: string;
    /** Base URL of chapter pages; the chapter number and "/" are appended. */
    chaptersHref: string;
    /** Science practice id ("5") -> name ("Mathematical Routines") */
    practiceNames: Record<string, string>;
    /** Ready-made sets shown above the filters (the latest class test, etc.). */
    presets: Preset[];
    /** Lessons to point to from explanations and results. */
    lessons: PracticeLesson[];
  }

  let { subject, questionsUrl, chapters, units, tests, frqs, chapterTopics, learnedTopics, frqsHref, topicsHref, chaptersHref, practiceNames, presets, lessons }: Props =
    $props();

  const historyKey = storageKey(subject, 'practice-history');
  const savedKey = storageKey(subject, 'practice-session');

  type Phase = 'setup' | 'session' | 'results';

  /**
   * A history entry's state. Setup entries have none. A set's entries remember their phase and
   * how many entries above the setup entry they are (1 for the set or its results, 2 when
   * reviewing a question from the results; 0 when there is no setup entry below, for a set
   * opened from a link), so "← Filters" can go back to the setup entry instead of adding one.
   */
  type NavState = { phase: 'session' | 'results'; depth: number; reviewing?: boolean; set: string } | null;
  const navState = (): NavState => {
    const st = window.history.state as NavState;
    return st && (st.phase === 'session' || st.phase === 'results') ? st : null;
  };

  let all = $state<PracticeQuestion[] | null>(null);
  let loadError = $state('');
  let phase = $state<Phase>('setup');
  let filters = $state<Filters>(emptyFilters());
  let history = $state<History>({});
  let resumable = $state<SavedSet | null>(null);
  const attempt = new Attempt();
  /** The current set: its URL query, seed, name, and an optional note. */
  let set = $state({ query: '', id: '', label: '', note: '' });
  /** Reviewing a question from the results screen: Back (and "Back to results") return there. */
  let reviewing = $state(false);

  const topicTitles = $derived(new Map(units.flatMap((u) => u.topics.map((t) => [t.id, t.title] as const))));
  const learned = $derived(new Set(learnedTopics));
  // With no chapter picked, practice draws from the chapters the class has reached; questions for
  // later chapters (samples) come in only when their chapter is picked.
  const taughtChapters = $derived(chapters.filter((c) => c.hasQuestions && (c.finished || c.current)).map((c) => c.number));
  const laterChapters = $derived(chapters.filter((c) => c.hasQuestions && !c.finished && !c.current).map((c) => c.number));
  /** The default pool's name: "Ch. 6–7" when later chapters are left out, else "All questions". */
  const everything = $derived(laterChapters.length && taughtChapters.length ? chapterRange(taughtChapters) : ALL_QUESTIONS);
  const setFilters = $derived(parseFilters(set.query));
  const setFrqTopics = $derived(filterTopics(setFilters, units, chapterTopics, tests));
  const weakSpots = $derived(all ? weakTopics(filterQuestions(all, emptyFilters(), tests), history) : []);
  /** How many questions a set with filters `f` would have. */
  const sizeOf = (f: Filters) => sessionSize(filterQuestions(all!, f, tests).length, f);
  const topicLabel = (key: string) =>
    key.startsWith('chapter-') ? `Ch. ${key.slice(8)} material not on the AP exam` : `${key} ${topicTitles.get(key) ?? ''}`;

  // Keep the URL in sync with the setup filters, so reloading or copying the address keeps them.
  $effect(() => {
    if (!all || phase !== 'setup') return;
    const q = filtersToQuery(filters);
    if (location.search !== q) replaceEntry(q, null);
  });

  // During a set the page title ("Practice") is hidden, so the question starts higher on phones.
  $effect(() => {
    document.body.dataset.practice = phase;
  });

  // Save the set after every change.
  $effect(() => {
    if (phase === 'setup' || attempt.questions.length === 0) return;
    const saved: SavedSet = {
      ...set,
      ...attempt.answers(),
      ids: attempt.questions.map((q) => q.id),
      index: attempt.index,
      phase,
    };
    writeJson(savedKey, withSaved(savedSets(), saved));
  });

  onMount(() => {
    filters = parseFilters(location.search);
    history = readJson<History>(historyKey, {});
    const onPop = (e: PopStateEvent) => {
      if (showSetFromUrl((e.state as NavState) ?? null)) return;
      showSetup(parseFilters(location.search));
    };
    window.addEventListener('popstate', onPop);
    void load();
    return () => window.removeEventListener('popstate', onPop);
  });

  async function load() {
    try {
      const res = await fetch(questionsUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      all = (await res.json()) as PracticeQuestion[];
    } catch (err) {
      loadError = `Could not load questions (${(err as Error).message}).`;
      return;
    }
    // A set's address (reload, Forward, a bookmark, a shared link, or a "Start" link elsewhere on
    // the site) opens the set; anything else is the setup screen.
    if (showSetFromUrl(navState())) return;
    if (navState() || wantsStart(location.search)) replaceEntry(setupQuery(location.search), null);
    resumable = findResumable(savedSets());
  }

  const savedSets = () => (all ? readSavedSets(readJson<unknown>(savedKey, null), new Set(all.map((q) => q.id))) : []);

  function replaceEntry(query: string, state: NavState) {
    window.history.replaceState(state, '', location.pathname + query);
  }

  function pushEntry(query: string, state: NavState) {
    window.history.pushState(state, '', location.pathname + query);
  }

  /**
   * Show the set the address names, in the phase its history entry remembers. False when the
   * address is the setup screen, or names a set with no questions.
   */
  function showSetFromUrl(st: NavState): boolean {
    const spec = parseSet(location.search);
    const isOpen = !!spec?.seed && spec.seed === set.id && attempt.questions.length > 0;
    if (!isOpen && !(spec ? openSet(spec) : !!st && openSaved(st.set))) return false;
    // Make sure the entry names this set (a link with no seed has just been given one).
    if (!st || st.set !== set.id || location.search !== set.query) {
      st = { phase: st?.phase ?? 'session', depth: st?.depth ?? 0, reviewing: st?.reviewing, set: set.id };
      replaceEntry(set.query, st);
    }
    reviewing = !!st.reviewing;
    phase = st.phase;
    return true;
  }

  /** Open a set from its address: the saved attempt with that seed, or a new one built from it. */
  function openSet(spec: SetSpec): boolean {
    if (spec.seed && openSaved(spec.seed, setToQuery(spec))) return true;
    const full = { ...spec, seed: spec.seed ?? newSeed() };
    const questions = questionsForSet(all!, full, tests, history);
    if (questions.length === 0) return false;
    loadSet(full, questions);
    return true;
  }

  /** The saved set `id` (with address `query`, if given), with its answers. */
  function openSaved(id: string, query?: string): boolean {
    const s = savedSets().find((x) => x.id === id && (query === undefined || x.query === query));
    if (!s) return false;
    const byId = new Map(all!.map((q) => [q.id, q]));
    attempt.load(
      s.ids.map((i) => byId.get(i)!),
      s,
      s.index,
    );
    set = { query: s.query, id: s.id, label: s.label || describeScope(parseFilters(s.query), tests, everything), note: s.note };
    resumable = null;
    return true;
  }

  /** Make `questions` the current set, unanswered. */
  function loadSet(spec: SetSpec & { seed: string }, questions: PracticeQuestion[], label?: string) {
    const pool = filterQuestions(all!, spec.filters, tests);
    attempt.load(questions);
    set = {
      query: setToQuery(spec),
      id: spec.seed,
      label:
        label ??
        (spec.ids
          ? `${describeScope(spec.filters, tests, everything)} · ${plural(questions.length, 'chosen question')}`
          : describeSet(spec.filters, tests, questions.length, pool.length, everything)),
      note: !spec.ids && spec.filters.mode === 'weak' && weakHasNoHistory(pool, history) ? WEAK_NO_HISTORY_NOTE : '',
    };
    resumable = null;
    reviewing = false;
  }

  /**
   * Start a new set from filters `f` (and, for a retry, exact questions). From the setup screen
   * the setup entry first takes those filters, so Back and "← Filters" return to them.
   */
  function begin(f: Filters, ids: string[] | null = null, label?: string) {
    const spec = { filters: f, seed: newSeed(), ids };
    const questions = questionsForSet(all!, spec, tests, history);
    if (questions.length === 0) return;
    const base = navState()?.depth ?? 0;
    if (phase === 'setup') {
      filters = f;
      replaceEntry(filtersToQuery(f), null);
    }
    loadSet(spec, questions, label);
    // Back from a set returns to the filters, or from a set started on the results screen
    // (retry, new set) to those results.
    pushEntry(set.query, { phase: 'session', depth: phase === 'setup' ? 1 : base > 0 ? base + 1 : 0, set: set.id });
    phase = 'session';
  }

  function resume() {
    if (!resumable) return;
    // Like starting it: the setup entry below shows the filters that made this set.
    filters = parseFilters(resumable.query);
    replaceEntry(setupQuery(resumable.query), null);
    openSaved(resumable.id);
    pushEntry(set.query, { phase: 'session', depth: 1, set: set.id });
    phase = 'session';
  }

  function discardResume() {
    writeJson(
      savedKey,
      savedSets().filter((s) => s.id !== resumable?.id),
    );
    resumable = null;
  }

  function showSetup(f: Filters) {
    filters = f;
    reviewing = false;
    phase = 'setup';
    resumable = findResumable(savedSets());
    window.scrollTo({ top: 0 });
  }

  /** "← Filters" / "Change filters": the setup screen with the filters that made this set. */
  function backToSetup() {
    // Go back to the setup entry the set was started from, so Forward returns to the set.
    const depth = navState()?.depth ?? 0;
    if (depth > 0) return window.history.go(-depth);
    const q = setupQuery(set.query);
    replaceEntry(q, null);
    showSetup(parseFilters(q));
  }

  function showResults() {
    // Reviewing from the results added a history entry; going back to the results removes it.
    if (reviewing && navState()?.reviewing) return window.history.back();
    replaceEntry(set.query, { phase: 'results', depth: navState()?.depth ?? 0, set: set.id });
    phase = 'results';
  }

  function review(i: number) {
    // A history entry, so Back returns to the results rather than to the filters.
    if (!reviewing) {
      const base = navState()?.depth ?? 0;
      pushEntry(set.query, { phase: 'session', depth: base ? base + 1 : 0, reviewing: true, set: set.id });
    }
    reviewing = true;
    attempt.go(i);
    phase = 'session';
  }

  function score(id: string, value: number, corrected: boolean) {
    history = corrected ? amendLastResult(history, id, value) : recordResult(history, id, value);
    writeJson(historyKey, history);
  }

  function clearHistory() {
    history = {};
    writeJson(historyKey, {});
  }
</script>

{#if loadError}
  <p class="notice">{loadError}</p>
{:else if !all}
  <p class="muted" aria-live="polite">Loading questions…</p>
{:else if phase === 'setup'}
  {#if resumable}
    {@const r = resumable}
    <section class="card resume" aria-label="Unfinished set">
      <p>
        <strong>Unfinished set{r.label ? ':' : '.'}</strong>
        {#if r.label}{r.label}.{/if}
        <span class="muted">{answeredIn(r)} of {r.ids.length} answered.</span>
      </p>
      <div class="actions">
        <button class="button" type="button" onclick={resume}>Resume</button>
        <button class="button secondary" type="button" onclick={discardResume}>Discard</button>
      </div>
    </section>
  {/if}
  <Setup
    {all}
    bind:filters
    {tests}
    {chapters}
    {laterChapters}
    {units}
    {presets}
    weakest={weakSpots.length > 0}
    {everything}
    {chapterTopics}
    {frqs}
    {learned}
    {frqsHref}
    {chaptersHref}
    {practiceNames}
    onstart={(f) => begin(f)}
  />
  {#if Object.keys(history).length > 0}
    <PracticeHistory
      count={Object.keys(history).length}
      {weakSpots}
      {topicsHref}
      {topicLabel}
      size={(topic) => sizeOf(parseFilters(topicQuery(topic)))}
      onstart={(topic) => begin(parseFilters(topicQuery(topic)))}
      onclear={clearHistory}
    />
  {/if}
{:else if phase === 'session'}
  <Session
    {attempt}
    label={set.label}
    note={set.note}
    {reviewing}
    {lessons}
    {topicsHref}
    {topicTitles}
    onfilters={backToSetup}
    onresults={showResults}
    onscore={score}
  />
{:else}
  <Results
    {attempt}
    label={set.label}
    {lessons}
    {topicsHref}
    {chaptersHref}
    {topicLabel}
    frqMatches={setFrqTopics.size ? matchFrqs(frqs, setFrqTopics) : []}
    {learned}
    {frqsHref}
    {practiceNames}
    onretry={(words) =>
      begin(
        setFilters,
        attempt.missed.map((q) => q.id),
        `${describeScope(setFilters, tests, everything)} · ${words}`,
      )}
    onreview={review}
    onnewset={() => begin(setFilters)}
    onfilters={backToSetup}
  />
{/if}

<style>
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
