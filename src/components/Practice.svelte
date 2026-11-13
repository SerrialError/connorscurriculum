<script lang="ts">
  // Practice in three steps: build a set (filters, nothing starts until "Start"), answer it one
  // question at a time, then review the results. The URL always holds the current filters, so a
  // copied link or a link from elsewhere on the site opens the setup screen with those filters
  // ready to start.
  import { onMount, tick } from 'svelte';
  import {
    type Filters,
    type FrqQuestion,
    type History,
    type McqQuestion,
    type Mode,
    type PracticeLesson,
    type PracticeQuestion,
    type PracticeTest,
    CLASS_ONLY_UNIT,
    DEFAULT_COUNT,
    MAX_COUNT,
    activeFilterCount,
    amendLastResult,
    chapterRange,
    countWith,
    describeScope,
    describeSet,
    emptyFilters,
    filterQuestions,
    filterTopics,
    filtersToQuery,
    frqEarned,
    frqTotal,
    isCorrect,
    lessonsFor,
    lessonsForMissed,
    parseFilters,
    recordResult,
    retryWords,
    selectQuestions,
    sessionSize,
    summarize,
    topicAccuracy,
    topicBreakdown,
    wantsStart,
    weakHasNoHistory,
  } from '../lib/practice';
  import { type FrqLink, frqCountLabel, frqName, frqPractices, frqTotal as pastFrqPoints, matchFrqs, readinessLabel, readyPoints } from '../lib/frqs';
  import { readJson, storageKey, writeJson } from '../lib/storage';

  interface Preset {
    label: string;
    /** Filters as a practice query string, e.g. "?test=ch6-7-test". */
    query: string;
    note?: string;
  }

  interface Props {
    subject: string;
    questionsUrl: string;
    chapters: { number: number; title: string; hasQuestions: boolean; current: boolean; finished: boolean }[];
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
    /** Ready-made filter sets shown above the filters (class tests, etc.). */
    presets: Preset[];
    /** Lessons to point to from explanations and results ("Study this"). */
    lessons: PracticeLesson[];
  }

  let {
    subject,
    questionsUrl,
    chapters,
    units,
    tests,
    frqs,
    chapterTopics,
    learnedTopics,
    frqsHref,
    topicsHref,
    chaptersHref,
    practiceNames,
    presets,
    lessons,
  }: Props = $props();

  const historyKey = storageKey(subject, 'practice-history');
  const savedKey = storageKey(subject, 'practice-session');
  const difficultyLabels: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
  const modeLabels: Record<Mode, string> = { all: 'In order', random: 'Shuffled', weak: 'Weakest topics first' };
  const typeLabels = { mcq: 'Multiple choice', frq: 'Free response' } as const;
  const countChoices = [5, 10, 20];

  type Phase = 'setup' | 'session' | 'results';

  /** An in-progress or finished set, saved so a reload or the Back button doesn't lose it. */
  interface Saved {
    /** Identifies the set in history entries (sets saved before ids existed have none). */
    id?: string;
    /** "Chapters 6–7 Test · 10 random" */
    label?: string;
    /** e.g. why "weakest topics" is random for now. */
    note?: string;
    query: string;
    ids: string[];
    index: number;
    phase: Exclude<Phase, 'setup'>;
    picks: Record<string, string>;
    checked: Record<string, boolean>;
    revealed: Record<string, boolean[]>;
    marks: Record<string, boolean[][]>;
    finished: Record<string, boolean>;
  }

  let all = $state<PracticeQuestion[] | null>(null);
  let loadError = $state('');
  let filters = $state<Filters>(emptyFilters());
  let phase = $state<Phase>('setup');
  let session = $state<PracticeQuestion[]>([]);
  /** Filters the current session was built from (the setup filters may change afterwards). */
  let sessionQuery = $state('');
  /** The current set's id, name ("Chapters 6–7 Test · 10 random"), and an optional note. */
  let setId = $state('');
  let setLabel = $state('');
  let setNote = $state('');
  let index = $state(0);
  let history = $state<History>({});
  let copied = $state(false);
  let resumable = $state<Saved | null>(null);
  let customCount = $state(false);
  /** "More options" (unit/topic, class test, type, order) is open. */
  let moreOpen = $state(false);
  /** The student picked an order themselves; until then, choosing a count shuffles (see setCount). */
  let orderChosen = $state(false);
  /** Long sets: the question grid is open ("Jump to a question"). */
  let jumpOpen = $state(false);
  /** What the number box shows while typing (filters.n only takes valid numbers). */
  let countText = $state('');
  /** Reviewing a question from the results screen: Back (and "Back to results") return there. */
  let reviewing = $state(false);
  /** "Clear history" was pressed once; the inline confirmation is showing. */
  let confirmClear = $state(false);
  /**
   * The page was opened with filters in the address (a link to a filtered set): those filters go
   * first, and Quick start moves below them.
   */
  let arrivedWithFilters = $state(false);

  // Per-question answer state, keyed by question id.
  let picks = $state<Record<string, string>>({});
  let checked = $state<Record<string, boolean>>({});
  let revealed = $state<Record<string, boolean[]>>({});
  let marks = $state<Record<string, boolean[][]>>({});
  let finished = $state<Record<string, boolean>>({});

  let questionHeading = $state<HTMLElement | null>(null);
  let nextButton = $state<HTMLButtonElement | null>(null);
  let verdictEl = $state<HTMLElement | null>(null);
  let resultsHeading = $state<HTMLElement | null>(null);

  const matching = $derived(all ? filterQuestions(all, filters, tests) : []);
  const setSize = $derived(sessionSize(matching.length, filters));
  const activeCount = $derived(activeFilterCount(filters));
  const topicTitles = $derived(new Map(units.flatMap((u) => u.topics.map((t) => [t.id, t.title] as const))));
  /** Questions the chapter filter allows (all class chapters when none is picked): topic and unit lists come from these. */
  const inChapters = $derived(all ? filterQuestions(all, { ...emptyFilters(), chapters: filters.chapters }, tests) : []);
  const usedTopics = $derived(new Set(inChapters.flatMap((q) => q.cedTopics)));
  const usedUnits = $derived(new Set(inChapters.flatMap((q) => q.units)));
  const learned = $derived(new Set(learnedTopics));
  const frqTopics = $derived(filterTopics(filters, units, chapterTopics, tests));
  const frqMatches = $derived(frqTopics.size ? matchFrqs(frqs, frqTopics) : []);
  const sessionFilters = $derived(parseFilters(sessionQuery));
  const sessionFrqTopics = $derived(filterTopics(sessionFilters, units, chapterTopics, tests));
  const sessionFrqMatches = $derived(sessionFrqTopics.size ? matchFrqs(frqs, sessionFrqTopics) : []);
  const emptyCurrent = $derived(chapters.filter((c) => c.current && !c.hasQuestions));
  // With no chapter picked, practice draws from the chapters the class has reached; questions
  // for later chapters (samples) come in only when their chapter is picked.
  const taughtChapters = $derived(chapters.filter((c) => c.hasQuestions && (c.finished || c.current)).map((c) => c.number));
  const laterChapters = $derived(chapters.filter((c) => c.hasQuestions && !c.finished && !c.current).map((c) => c.number));
  /** The default pool's name: "Ch. 6–7" when later chapters are left out, else "All questions". */
  const everything = $derived(laterChapters.length && taughtChapters.length ? chapterRange(taughtChapters) : 'All questions');
  const hasClassOnly = $derived(inChapters.some((q) => q.cedTopics.length === 0));
  /**
   * Chapter chips: the chapters taught so far (and any other picked chapter). Chapters the class
   * hasn't reached that have sample questions go under "More options", as "Later chapters".
   */
  const mainChapters = $derived(
    chapters.filter((c) => (c.hasQuestions || filters.chapters.includes(c.number)) && !laterChapters.includes(c.number)),
  );
  const laterChapterList = $derived(chapters.filter((c) => laterChapters.includes(c.number)));
  /** Settings inside "More options" that differ from the defaults. */
  const moreCount = $derived(
    (filters.test ? 1 : 0) +
      filters.units.length +
      filters.topics.length +
      (filters.type ? 1 : 0) +
      filters.chapters.filter((n) => laterChapters.includes(n)).length,
  );
  const visibleUnits = $derived(
    units.filter((u) => usedUnits.has(u.id) || filters.units.includes(u.id) || u.topics.some((t) => filters.topics.includes(t.id))),
  );

  /** 0–1 score per answered question in this session. */
  const scores = $derived.by(() => {
    const out: Record<string, number> = {};
    for (const q of session) {
      if (q.type === 'mcq' && checked[q.id]) out[q.id] = isCorrect(q, picks[q.id]!) ? 1 : 0;
      if (q.type === 'frq' && finished[q.id]) out[q.id] = frqEarned(q, marks[q.id] ?? []) / frqTotal(q);
    }
    return out;
  });
  const summary = $derived(
    summarize(
      session.flatMap((q) => {
        if (scores[q.id] === undefined) return [];
        return q.type === 'mcq'
          ? [{ type: 'mcq' as const, correct: scores[q.id] === 1 }]
          : [{ type: 'frq' as const, earned: frqEarned(q, marks[q.id] ?? []), possible: frqTotal(q) }];
      }),
    ),
  );
  const answered = $derived(Object.keys(scores).length);
  const missed = $derived(session.filter((q) => scores[q.id] !== undefined && scores[q.id]! < 1));
  const skipped = $derived(session.filter((q) => scores[q.id] === undefined));
  const breakdown = $derived(topicBreakdown(session, scores));
  const study = $derived(lessonsForMissed(missed, lessons));
  const current = $derived(session[index]);

  /**
   * Topics with history, weakest first, for the "Topics to work on" list. Only class chapters, like
   * the "Weakest topics" quick start, which appears only when this list has something in it.
   */
  const weakSpots = $derived.by(() => {
    if (!all) return [];
    return [...topicAccuracy(filterQuestions(all, emptyFilters(), tests), history)]
      .filter(([k, acc]) => !k.startsWith('chapter-') && acc < 0.75)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 4);
  });
  const historyCount = $derived(Object.keys(history).length);
  const hasQuickStart = $derived(presets.length > 0 || weakSpots.length > 0);

  // Keep the URL in sync with the setup filters, so reloading or copying the address keeps them.
  $effect(() => {
    if (!all || phase !== 'setup') return;
    const q = filtersToQuery(filters);
    if (location.search !== q) history_replace(q, null);
  });

  // During a set the page title ("Practice") is hidden, so the question starts higher on phones.
  $effect(() => {
    document.body.dataset.practice = phase;
  });

  // Save the session after every change.
  $effect(() => {
    if (phase === 'setup' || session.length === 0) return;
    const saved: Saved = {
      id: setId,
      label: setLabel,
      note: setNote,
      query: sessionQuery,
      ids: session.map((q) => q.id),
      index,
      phase,
      picks: $state.snapshot(picks),
      checked: $state.snapshot(checked),
      revealed: $state.snapshot(revealed),
      marks: $state.snapshot(marks),
      finished: $state.snapshot(finished),
    };
    // The latest few sets, newest first, so Back from a retry can return to the earlier results.
    writeJson(savedKey, [saved, ...readSets().filter((s) => s.id !== setId)].slice(0, MAX_SAVED));
  });

  /**
   * What a history entry holds. Setup entries have no state. A set's entries remember their phase
   * and how many entries above the setup entry they are (1 for the set or its results, 2 when
   * reviewing a question from the results), so reload and Forward return to the set, and
   * "← Filters" can go back to the setup entry instead of adding one.
   */
  type NavState = { phase: 'session' | 'results'; depth: number; reviewing?: boolean; set?: string } | null;
  const navState = (): NavState => {
    const st = window.history.state as NavState;
    return st && (st.phase === 'session' || st.phase === 'results') ? st : null;
  };

  onMount(() => {
    const initial = parseFilters(location.search);
    arrivedWithFilters = activeFilterCount(initial) > 0 || initial.n !== null || initial.mode !== 'all';
    setFilters(initial);
    history = readJson<History>(historyKey, {});
    const onPop = (e: PopStateEvent) => {
      let st = (e.state as NavState) ?? null;
      // Forward into a set after a reload, or Back from a retry to the earlier set: that set is
      // in storage, not in memory.
      const other = !!st && (session.length === 0 || (!!st.set && st.set !== setId));
      if (st && other && !restoreSet(st)) st = null;
      if (st?.phase === 'results') {
        if (phase !== 'results' || other) void showResults(false);
        reviewing = false;
      } else if (st?.phase === 'session') {
        reviewing = !!st.reviewing;
        phase = 'session';
        void showQuestion();
      } else {
        reviewing = false;
        phase = 'setup';
        setFilters(parseFilters(location.search));
        offerResume();
        void tick().then(() => window.scrollTo({ top: 0 }));
      }
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
      // Reloading during a set (or its results) comes back to the same place.
      const st = navState();
      if (st && restoreSet(st)) {
        if (st.phase === 'results') {
          await showResults(false);
        } else {
          reviewing = !!st.reviewing;
          phase = 'session';
          await showQuestion();
        }
        return;
      }
      if (st) history_replace(location.search, null);
      offerResume();
      // Links like "Random 10" on a test page are a complete set: start it right away. The setup
      // screen (with those filters) stays one Back press away.
      // The set replaces the setup entry, so Back returns to the page the link was on; "← Filters"
      // still opens the setup screen.
      if (wantsStart(location.search)) start(true);
    } catch (err) {
      loadError = `Could not load questions (${(err as Error).message}).`;
    }
  }

  const MAX_SAVED = 5;

  /** Saved sets, newest first, leaving out any whose questions no longer all exist. */
  function readSets(): Saved[] {
    const raw = readJson<Saved | Saved[] | null>(savedKey, null);
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (!all) return [];
    const ids = new Set(all.map((q) => q.id));
    return list.filter((s) => s && Array.isArray(s.ids) && s.ids.length > 0 && s.ids.every((id) => ids.has(id)));
  }

  const answeredIn = (s: Saved) => s.ids.filter((id) => s.checked?.[id] || s.finished?.[id]).length;

  function offerResume() {
    const s = readSets()[0];
    // Only sets that were started (something answered) and not finished. A set left with nothing
    // answered isn't worth a banner.
    resumable = s && s.phase === 'session' && answeredIn(s) > 0 && answeredIn(s) < s.ids.length ? s : null;
  }

  /** Load the set a history entry belongs to (by id, or for older entries by URL). */
  function restoreSet(st: NonNullable<NavState>): boolean {
    const sets = readSets();
    const s = st.set ? sets.find((x) => x.id === st.set) : sets[0]?.query === location.search ? sets[0] : undefined;
    if (!s) return false;
    applySaved(s);
    return true;
  }

  function applySaved(s: Saved) {
    const byId = new Map(all!.map((q) => [q.id, q]));
    session = s.ids.map((id) => byId.get(id)!);
    sessionQuery = s.query;
    setId = s.id ?? 'saved';
    setLabel = s.label ?? describeScope(parseFilters(s.query), tests, everything);
    setNote = s.note ?? '';
    picks = s.picks ?? {};
    checked = s.checked ?? {};
    revealed = s.revealed ?? {};
    marks = s.marks ?? {};
    finished = s.finished ?? {};
    index = Math.min(Math.max(0, s.index), session.length - 1);
    resumable = null;
  }

  function history_replace(query: string, state: NavState) {
    window.history.replaceState(state, '', location.pathname + query);
  }

  function resetAnswers() {
    picks = {};
    checked = {};
    revealed = {};
    marks = {};
    finished = {};
  }

  /** Replace the setup filters, opening "More options" when any of them are set. */
  function setFilters(f: Filters) {
    filters = f;
    customCount = f.n !== null && !countChoices.includes(f.n);
    countText = String(f.n ?? DEFAULT_COUNT);
    orderChosen = f.mode !== 'all';
    if (moreCount > 0) moreOpen = true;
  }

  /**
   * Start a set. `replace`: the set takes over the current (setup) history entry instead of
   * adding one, for links that start a set right away (?start=1).
   */
  async function begin(questions: PracticeQuestion[], query: string, label: string, note = '', replace = false) {
    const base = navState()?.depth ?? 0;
    session = questions;
    sessionQuery = query;
    setId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setLabel = label;
    setNote = note;
    index = 0;
    resetAnswers();
    resumable = null;
    reviewing = false;
    // A history entry per set: Back from a set returns to the filters, or from a set started on
    // the results screen (retry, new set) to those results. "← Filters" goes back `depth` entries;
    // at depth 0 there is no setup entry below (the set came from a link), so it replaces the set's.
    const st = (depth: number): NavState => ({ phase: 'session', depth, set: setId });
    if (phase === 'setup' && replace) history_replace(query, st(0));
    else if (phase === 'setup') window.history.pushState(st(1), '', location.pathname + query);
    else if (phase === 'results') window.history.pushState(st(base > 0 ? base + 1 : 0), '', location.pathname + query);
    else history_replace(query, st(base));
    jumpOpen = false;
    phase = 'session';
    await showQuestion();
  }

  /** Pick questions for filters `f` from `pool` (the questions they match) and start the set. */
  function startWith(f: Filters, pool: PracticeQuestion[], replace = false) {
    if (pool.length === 0) return;
    const picked = selectQuestions(pool, f, history);
    const note = f.mode === 'weak' && weakHasNoHistory(pool, history) ? 'No practice history on these yet, so the order is random.' : '';
    void begin(picked, filtersToQuery(f), describeSet(f, tests, picked.length, pool.length, everything), note, replace);
  }

  function start(replace = false) {
    if (!all) return;
    startWith($state.snapshot(filters), matching, replace);
  }

  /** Quick start: begin a ready-made set without touching the filters on the setup screen. */
  function startPreset(query: string) {
    if (!all) return;
    const f = parseFilters(query);
    startWith(f, filterQuestions(all, f, tests));
  }

  function newSetSameFilters() {
    if (!all) return;
    startWith(sessionFilters, filterQuestions(all, sessionFilters, tests));
  }

  const retry = $derived(retryWords(missed.map((q) => scores[q.id]!)));

  function retryMissed() {
    void begin([...missed], sessionQuery, `${describeScope(sessionFilters, tests, everything)} · ${retry.set}`);
  }

  /** Enter on a filter chip toggles it, like Space. It never starts the set. */
  function onFilterKey(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    e.preventDefault();
    if (t.type === 'checkbox' || t.type === 'radio') t.click();
  }

  async function resume() {
    if (!resumable || !all) return;
    const s = resumable;
    applySaved(s);
    window.history.pushState({ phase: 'session', depth: 1, set: setId } satisfies NavState, '', location.pathname + s.query);
    phase = 'session';
    await showQuestion();
  }

  function discardResume() {
    const id = resumable?.id;
    writeJson(savedKey, readSets().filter((s) => s.id !== id));
    resumable = null;
  }

  function backToSetup() {
    // Go back to the setup entry the set was started from, so Forward returns to the set.
    const depth = navState()?.depth ?? 0;
    if (depth > 0) return window.history.go(-depth);
    setFilters(parseFilters(sessionQuery));
    reviewing = false;
    history_replace(sessionQuery, null);
    phase = 'setup';
    offerResume();
    void tick().then(() => window.scrollTo({ top: 0 }));
  }

  async function showQuestion() {
    await tick();
    // The set sits just under the page title, so the top of the page shows the header, the
    // progress bar, and the start of the question.
    window.scrollTo({ top: 0 });
    questionHeading?.focus({ preventScroll: true });
  }

  function go(i: number) {
    index = Math.max(0, Math.min(session.length - 1, i));
    void showQuestion();
  }

  async function showResults(updateHistory = true) {
    phase = 'results';
    if (updateHistory) {
      // Reviewing from the results added a history entry; going back to the results removes it.
      if (reviewing && navState()?.reviewing) window.history.back();
      else history_replace(sessionQuery, { phase: 'results', depth: navState()?.depth ?? 0, set: setId });
    }
    reviewing = false;
    await tick();
    window.scrollTo({ top: 0 });
    resultsHeading?.focus({ preventScroll: true });
  }

  function reviewQuestion(i: number) {
    phase = 'session';
    // A history entry, so Back returns to the results rather than to the filters.
    if (!reviewing) {
      const base = navState()?.depth ?? 0;
      window.history.pushState(
        { phase: 'session', depth: base ? base + 1 : 0, reviewing: true, set: setId } satisfies NavState,
        '',
        location.pathname + sessionQuery,
      );
    }
    reviewing = true;
    go(i);
  }

  /** No "are you sure": unanswered questions can still be answered from the results. */
  function endSet() {
    void showResults();
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function save(id: string, score: number) {
    history = recordResult(history, id, score);
    writeJson(historyKey, history);
  }

  async function check(q: McqQuestion) {
    if (!picks[q.id] || checked[q.id]) return;
    checked[q.id] = true;
    save(q.id, isCorrect(q, picks[q.id]!) ? 1 : 0);
    await showVerdict();
  }

  /**
   * After Check or Done marking: keep the right/wrong verdict in view and put focus on Next.
   * If the verdict, explanation, and Next don't all fit on screen (small phones), the verdict goes
   * to the top of the screen rather than scrolling down to Next.
   */
  async function showVerdict() {
    await tick();
    nextButton?.focus({ preventScroll: true });
    const v = verdictEl?.getBoundingClientRect();
    const n = nextButton?.getBoundingClientRect();
    if (!v || !n) return;
    const margin = 12;
    if (n.bottom - v.top + 2 * margin <= window.innerHeight) {
      // Everything fits: scroll as little as possible to show it all.
      if (n.bottom + margin > window.innerHeight) window.scrollBy({ top: n.bottom + margin - window.innerHeight });
      else if (v.top < margin) window.scrollBy({ top: v.top - margin });
    } else if (v.top < margin || v.top > window.innerHeight / 3) {
      window.scrollBy({ top: v.top - margin });
    }
  }

  function reveal(q: FrqQuestion, part: number) {
    revealed[q.id] ??= q.parts.map(() => false);
    revealed[q.id]![part] = true;
    marks[q.id] ??= q.parts.map((p) => p.scoringHtml.map(() => false));
  }

  function setMark(q: FrqQuestion, part: number, point: number, value: boolean) {
    marks[q.id] ??= q.parts.map((p) => p.scoringHtml.map(() => false));
    marks[q.id]![part]![point] = value;
    // Changing a mark after "Done marking" corrects the score already saved for this attempt.
    if (finished[q.id]) {
      history = amendLastResult(history, q.id, frqEarned(q, marks[q.id]!) / frqTotal(q));
      writeJson(historyKey, history);
    }
  }

  async function finish(q: FrqQuestion) {
    finished[q.id] = true;
    save(q.id, frqEarned(q, marks[q.id] ?? []) / frqTotal(q));
    await showVerdict();
  }

  function next() {
    if (index < session.length - 1) go(index + 1);
    else void showResults();
  }

  function onKey(e: KeyboardEvent) {
    if (phase !== 'session' || !current || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement;
    if (el.closest('input[type="text"], input[type="number"], textarea, select, [contenteditable]')) return;
    const q = current;
    // ← → move between questions, even before answering (they don't change the picked choice).
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (e.shiftKey) return;
      e.preventDefault();
      go(index + (e.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (q.type === 'mcq' && !checked[q.id]) {
      const key = e.key.toLowerCase();
      const byLetter = q.choices.find((c) => c.id === key);
      const byNumber = /^[1-9]$/.test(key) ? q.choices[Number(key) - 1] : undefined;
      const choice = byLetter ?? byNumber;
      if (choice) {
        picks[q.id] = choice.id;
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter' && picks[q.id] && !el.closest('button, a')) {
        e.preventDefault();
        void check(q);
      }
    }
  }

  function setMode(mode: Mode) {
    orderChosen = true;
    filters.mode = mode;
  }

  /**
   * Choosing a number of questions shuffles, so "10 questions" isn't the same first 10 every
   * time, unless the student picked an order. "All" goes back to in order.
   */
  function setCount(n: number | null, custom = false) {
    customCount = custom;
    filters.n = n;
    if (n !== null) countText = String(n);
    if (!orderChosen) filters.mode = n === null ? 'all' : 'random';
  }

  /** Up to DEFAULT_COUNT shuffled questions on one topic (or class-only chapter), from the weak-spots list. */
  const topicQuery = (key: string) =>
    key.startsWith('chapter-')
      ? `?chapter=${key.slice(8)}&unit=${CLASS_ONLY_UNIT}&mode=random&n=${DEFAULT_COUNT}`
      : `?topic=${key}&mode=random&n=${DEFAULT_COUNT}`;
  const presetSize = (query: string) => {
    if (!all) return 0;
    const f = parseFilters(query);
    return sessionSize(filterQuestions(all, f, tests).length, f);
  };

  function resetFilters() {
    filters = emptyFilters();
    customCount = false;
    orderChosen = false;
  }

  /** The "Other" number box: whole numbers from 1 to MAX_COUNT; anything else is ignored. */
  function onCountInput(text: string) {
    countText = text;
    const v = Number(text);
    if (text.trim() !== '' && Number.isInteger(v) && v > 0) filters.n = Math.min(v, MAX_COUNT);
  }

  /** Leaving the box: show the number the set will really have (at most what matches). */
  function onCountBlur() {
    const n = filters.n ?? DEFAULT_COUNT;
    const shown = matching.length > 0 ? Math.min(n, matching.length) : n;
    filters.n = shown;
    countText = String(shown);
  }
  const countInvalid = $derived.by(() => {
    if (!customCount) return false;
    const v = Number(countText);
    return countText.trim() === '' || !Number.isInteger(v) || v < 1;
  });

  /** One-at-a-time checkbox group: checking an option replaces the other; unchecking clears it. */
  function pickOne<T>(value: T, checked: boolean): T | null {
    return checked ? value : null;
  }

  function clearHistory() {
    history = {};
    writeJson(historyKey, {});
    confirmClear = false;
  }

  async function copyLink(query: string) {
    const link = location.origin + location.pathname + query;
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      prompt('Copy this link:', link);
    }
  }

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const topicLabel = (key: string) =>
    key.startsWith('chapter-') ? `Ch. ${key.slice(8)} material not on the AP exam` : `${key} ${topicTitles.get(key) ?? ''}`;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  /** The prompt's plain text (math written out at build time); CSS clamps it to two lines. */
  const excerpt = (text: string) => (text.length > 240 ? `${text.slice(0, 238).trimEnd()}…` : text);
  const statusOf = (q: PracticeQuestion) =>
    scores[q.id] === undefined ? 'todo' : scores[q.id] === 1 ? 'right' : scores[q.id] === 0 ? 'wrong' : 'partial';
  const statusText = { todo: 'not answered', right: 'correct', wrong: 'incorrect', partial: 'partial credit' } as const;
  /** Shown with the colour, so right and wrong don't depend on telling red from green. */
  const statusMark = { todo: '', right: '✓', wrong: '✗', partial: '½' } as const;
  const allShown = (q: FrqQuestion) => q.parts.every((_, p) => revealed[q.id]?.[p]);
  const shownCount = (q: FrqQuestion) => q.parts.filter((_, p) => revealed[q.id]?.[p]).length;

  /** Human-readable list of active filters, each with a function that removes it. */
  const chips = $derived.by(() => {
    const out: { label: string; remove: () => void }[] = [];
    for (const n of filters.chapters) out.push({ label: `Ch. ${n}`, remove: () => (filters.chapters = filters.chapters.filter((x) => x !== n)) });
    if (filters.test) {
      const t = tests.find((x) => x.id === filters.test);
      out.push({ label: t?.title ?? filters.test, remove: () => (filters.test = null) });
    }
    for (const u of filters.units)
      out.push({ label: u === CLASS_ONLY_UNIT ? 'Not on the AP exam' : `Unit ${u}`, remove: () => (filters.units = filters.units.filter((x) => x !== u)) });
    for (const t of filters.topics) out.push({ label: `Topic ${t}`, remove: () => (filters.topics = filters.topics.filter((x) => x !== t)) });
    for (const d of filters.difficulty)
      out.push({ label: difficultyLabels[d]!, remove: () => (filters.difficulty = filters.difficulty.filter((x) => x !== d)) });
    if (filters.type) out.push({ label: typeLabels[filters.type], remove: () => (filters.type = null) });
    return out;
  });
</script>

<svelte:window onkeydown={onKey} />

{#snippet pastFrqs(matches: ReturnType<typeof matchFrqs>)}
  {#if matches.length > 0}
    <details class="card past-frqs">
      <summary>
        <span class="summary-title">Past AP FRQs on these topics</span>
        <span class="muted small">{frqCountLabel(matches)}</span>
      </summary>
      <p class="small muted">
        Real exam questions from AP Central. Do the listed parts, then grade yourself with the scoring guidelines.
        <a href={frqsHref}>All past FRQs</a>
      </p>
      <ul class="plain-list">
        {#each matches as m (m.frq.year * 10 + m.frq.number)}
          {@const ready = readinessLabel(readyPoints(m.frq, (t) => learned.has(t)), pastFrqPoints(m.frq))}
          <li>
            <div>
              <a href={m.frq.questionUrl} target="_blank" rel="noopener"><strong>{frqName(m.frq)}</strong></a>
              {m.frq.title}
              <span class="badge" class:good={ready.full} title={ready.title}>{ready.text}</span>
            </div>
            <div class="small practices">
              {frqPractices({ parts: m.parts }).map((id) => practiceNames[id] ?? id).join(' · ')}
              {#if !m.frq.officialSkills}<span class="muted" title="College Board hasn’t published science-practice labels for this exam; these are ours.">(our practice labels)</span>{/if}
            </div>
            <div class="small muted">
              Part{m.parts.length > 1 ? 's' : ''} {m.parts.map((p) => p.label).join(', ')} ({plural(m.points, 'pt')})
              · <a href={m.frq.scoringUrl} target="_blank" rel="noopener">Scoring guidelines</a>
              {#if m.frq.samplesUrl}· <a href={m.frq.samplesUrl} target="_blank" rel="noopener">Sample responses</a>{/if}
            </div>
          </li>
        {/each}
      </ul>
    </details>
  {/if}
{/snippet}

{#snippet studyThis(q: PracticeQuestion)}
  {@const found = lessonsFor(q, lessons)}
  {#if found.length > 0}
    <p class="study small">
      <span class="study-label">Study this in the lesson:</span>
      {#each found as l, i (l.href)}{i > 0 ? ' · ' : ' '}<a href={l.href}>{l.title}</a>{/each}
    </p>
  {/if}
{/snippet}

{#snippet count(n: number)}
  <span class="count" class:zero={n === 0}>{n}</span>
{/snippet}

{#snippet chapterChip(c: Props['chapters'][number])}
  <label class="chip" title={c.title}>
    <input
      type="checkbox"
      checked={filters.chapters.includes(c.number)}
      onchange={() => (filters.chapters = toggle(filters.chapters, c.number))}
    />
    <span>Ch. {c.number} <span class="chip-sub">{c.title}</span></span>
    {@render count(countWith(all!, filters, tests, { chapters: [c.number] }))}
  </label>
{/snippet}

{#if loadError}
  <p class="notice">{loadError}</p>
{:else if !all}
  <p class="muted" aria-live="polite">Loading questions…</p>
{:else if phase === 'setup'}
  <!-- ───────────── Setup ───────────── -->
  <div class="setup">
    {#if resumable}
      <section class="card resume" aria-label="Unfinished set">
        <p>
          <strong>Unfinished set{resumable.label ? ':' : '.'}</strong>
          {#if resumable.label}{resumable.label}.{/if}
          <span class="muted">{answeredIn(resumable)} of {resumable.ids.length} answered.</span>
        </p>
        <div class="row">
          <button class="button" type="button" onclick={resume}>Resume</button>
          <button class="button secondary" type="button" onclick={discardResume}>Discard</button>
        </div>
      </section>
    {/if}

    {#snippet quickStart()}
      <section class="presets" aria-labelledby="presets-h">
        <div class="presets-head">
          <h2 id="presets-h" class="section-h">Quick start</h2>
          <span class="small muted">One tap starts the set.</span>
        </div>
        <div class="preset-row">
          {#each presets as p (p.query)}
            <button type="button" class="preset" onclick={() => startPreset(p.query)}>
              <span class="preset-label">{p.label} <span aria-hidden="true">→</span></span>
              {#if p.note}<span class="small muted">{p.note}</span>{/if}
            </button>
          {/each}
          {#if weakSpots.length > 0}
            <button type="button" class="preset" onclick={() => startPreset(`?mode=weak&n=${DEFAULT_COUNT}`)}>
              <span class="preset-label">Weakest topics <span aria-hidden="true">→</span></span>
              <span class="small muted">{plural(presetSize(`?mode=weak&n=${DEFAULT_COUNT}`), 'question')} on what you've missed most</span>
            </button>
          {/if}
        </div>
      </section>
    {/snippet}
    {#if hasQuickStart && !arrivedWithFilters}
      {@render quickStart()}
    {/if}

    <!-- Only the Start practice button starts a set: Enter on a chip toggles it (onFilterKey). -->
    <form class="card filters" onsubmit={(e) => e.preventDefault()} onkeydown={onFilterKey} aria-labelledby="filters-h">
      <div class="filters-head">
        <h2 id="filters-h" class="section-h">{hasQuickStart && !arrivedWithFilters ? 'Or choose your own' : 'Choose questions'}</h2>
        <!-- Always laid out (hidden when there's nothing to reset), so picking a filter doesn't move the chips. -->
        <button
          class="link-button reset"
          class:invisible={activeCount === 0 && filters.mode === 'all' && filters.n === null}
          type="button"
          onclick={resetFilters}>Reset all</button>
      </div>

      <fieldset>
        <legend>Chapter</legend>
        <div class="chips">
          {#each mainChapters as c (c.number)}
            {@render chapterChip(c)}
          {/each}
        </div>
        {#if emptyCurrent.length > 0}
          <p class="small muted chapter-note">
            No questions yet for
            {#each emptyCurrent as c, i (c.number)}{i > 0 ? ' or ' : ''}<a href={`${chaptersHref}${c.number}/`}>Ch.&nbsp;{c.number}</a>{/each}
            (in class now).
          </p>
        {/if}
      </fieldset>

      <div class="three-col">
        <fieldset>
          <legend>Difficulty</legend>
          <div class="chips">
            {#each [1, 2, 3] as d (d)}
              <label class="chip">
                <input type="checkbox" checked={filters.difficulty.includes(d)} onchange={() => (filters.difficulty = toggle(filters.difficulty, d))} />
                <span>{difficultyLabels[d]}</span>
                {@render count(countWith(all, filters, tests, { difficulty: [d] }))}
              </label>
            {/each}
          </div>
        </fieldset>

        <fieldset>
          <legend>How many</legend>
          <div class="chips">
            <label class="chip">
              <input type="radio" name="count" checked={filters.n === null && !customCount} onchange={() => setCount(null)} />
              <span>All</span>
            </label>
            {#each countChoices as c (c)}
              <label class="chip">
                <input type="radio" name="count" checked={filters.n === c && !customCount} onchange={() => setCount(c)} />
                <span>{c}</span>
              </label>
            {/each}
            <label class="chip">
              <input type="radio" name="count" checked={customCount} onchange={() => setCount(filters.n ?? DEFAULT_COUNT, true)} />
              <span>Other</span>
            </label>
            {#if customCount}
              <label class="num-label">
                <span class="visually-hidden">Number of questions</span>
                <input
                  class="num"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  max={Math.max(1, Math.min(MAX_COUNT, matching.length))}
                  value={countText}
                  aria-invalid={countInvalid}
                  aria-describedby="count-help"
                  oninput={(e) => onCountInput(e.currentTarget.value)}
                  onblur={onCountBlur}
                />
              </label>
              <span id="count-help" class="small count-help" class:warn={countInvalid || (filters.n ?? 0) > matching.length}>
                {#if countInvalid}Type a whole number{:else if (filters.n ?? 0) > matching.length}Only {matching.length} match{:else}max {Math.min(MAX_COUNT, matching.length)}{/if}
              </span>
            {/if}
          </div>
        </fieldset>

        <fieldset>
          <legend>Order</legend>
          <div class="chips">
            {#each ['all', 'random', 'weak'] as const as m (m)}
              <label class="chip">
                <input type="radio" name="mode" checked={filters.mode === m} onchange={() => setMode(m)} />
                <span>{modeLabels[m]}</span>
              </label>
            {/each}
          </div>
          {#if filters.mode === 'weak' && historyCount === 0}
            <p class="small muted order-note">No answers on this device yet, so this is shuffled for now.</p>
          {/if}
        </fieldset>
      </div>

      <details class="more" bind:open={moreOpen}>
        <summary>
          <span class="more-title">More options</span>
          {#if moreCount > 0 && !moreOpen}
            <span class="badge topic">{moreCount} set</span>
          {:else if !moreOpen}
            <span class="small muted">AP unit or topic{tests.length > 0 ? ', class test' : ''}, question type{laterChapterList.length > 0 ? ', later chapters' : ''}</span>
          {/if}
        </summary>

        <fieldset>
          <legend>AP unit or topic</legend>
          {#each visibleUnits as u (u.id)}
            {@const picked = u.topics.filter((t) => filters.topics.includes(t.id)).length}
            <details class="unit" open={picked > 0}>
              <summary>
                <span>
                  Unit {u.id}: {u.title}
                  {#if filters.units.includes(u.id)}<span class="badge topic">whole unit</span>{:else if picked}<span class="badge topic">{picked} selected</span>{/if}
                </span>
                {@render count(countWith(all, filters, tests, { units: [u.id], topics: [] }))}
              </summary>
              <div class="chips">
                <label class="chip">
                  <input type="checkbox" checked={filters.units.includes(u.id)} onchange={() => (filters.units = toggle(filters.units, u.id))} />
                  <span>Whole unit</span>
                  {@render count(countWith(all, filters, tests, { units: [u.id], topics: [] }))}
                </label>
                {#each u.topics.filter((t) => usedTopics.has(t.id) || filters.topics.includes(t.id)) as t (t.id)}
                  <label class="chip">
                    <input type="checkbox" checked={filters.topics.includes(t.id)} onchange={() => (filters.topics = toggle(filters.topics, t.id))} />
                    <span>{t.id} <span class="chip-sub">{t.title}</span></span>
                    {@render count(countWith(all, filters, tests, { units: [], topics: [t.id] }))}
                  </label>
                {/each}
              </div>
            </details>
          {:else}
            <p class="small muted">No tagged questions yet.</p>
          {/each}
          {#if hasClassOnly || filters.units.includes(CLASS_ONLY_UNIT)}
            <div class="chips class-only">
              <label class="chip">
                <input
                  type="checkbox"
                  checked={filters.units.includes(CLASS_ONLY_UNIT)}
                  onchange={() => (filters.units = toggle(filters.units, CLASS_ONLY_UNIT))}
                />
                <span>Not on the AP exam <span class="chip-sub">class tests only</span></span>
                {@render count(countWith(all, filters, tests, { units: [CLASS_ONLY_UNIT], topics: [] }))}
              </label>
            </div>
          {/if}
        </fieldset>

        <div class="two-col">
          {#if tests.length > 0}
            <fieldset>
              <legend>Class test</legend>
              <div class="chips">
                {#each tests as t (t.id)}
                  <label class="chip">
                    <input type="checkbox" checked={filters.test === t.id} onchange={(e) => (filters.test = pickOne(t.id, e.currentTarget.checked))} />
                    <span>{t.title}</span>
                    {@render count(countWith(all, filters, tests, { test: t.id }))}
                  </label>
                {/each}
              </div>
            </fieldset>
          {/if}

          <fieldset>
            <legend>Question type</legend>
            <div class="chips">
              {#each ['mcq', 'frq'] as const as value (value)}
                <label class="chip">
                  <input type="checkbox" checked={filters.type === value} onchange={(e) => (filters.type = pickOne(value, e.currentTarget.checked))} />
                  <span>{typeLabels[value]}</span>
                  {@render count(countWith(all, filters, tests, { type: value }))}
                </label>
              {/each}
            </div>
          </fieldset>

          {#if laterChapterList.length > 0}
            <!-- Sample questions for chapters the class hasn't reached: never in a set unless picked here. -->
            <fieldset>
              <legend>Later chapters <span class="legend-sub">samples, not taught yet</span></legend>
              <div class="chips">
                {#each laterChapterList as c (c.number)}
                  {@render chapterChip(c)}
                {/each}
              </div>
            </fieldset>
          {/if}
        </div>
        <p class="copy-row">
          <button class="link-button small" type="button" onclick={() => copyLink(filtersToQuery(filters))}>
            {copied ? 'Link copied' : 'Copy a link to these filters'}
          </button>
        </p>
      </details>

      <!-- Sticky, so Start is always in reach. On phones it is one short row: the count and Start. -->
      <div class="start-bar">
        <div class="start-info" aria-live="polite">
          {#if matching.length === 0}
            <strong>No questions match.</strong>
            <span class="small muted sub">Remove a filter.</span>
          {:else}
            <strong>{plural(setSize, 'question')}</strong>
            <span class="small muted sub">
              {#if setSize < matching.length}from {matching.length} matching{:else if activeCount === 0}{everything === 'All questions' ? 'all questions' : `all of ${everything}`}{:else}all that match{/if}
              <span class="mode">· {modeLabels[filters.mode].toLowerCase()}</span>
            </span>
          {/if}
        </div>
        {#if chips.length > 0}
          <ul class="plain-list active-chips" aria-label="Active filters">
            {#each chips as c (c.label)}
              <li>
                <button type="button" class="active-chip" onclick={c.remove} aria-label={`Remove filter: ${c.label}`}>
                  {c.label} <span aria-hidden="true">×</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <button class="button start" type="button" disabled={matching.length === 0} onclick={() => start()}>
          Start<span class="start-long"> practice</span> →
        </button>
      </div>
    </form>

    {#if hasQuickStart && arrivedWithFilters}
      <div class="presets-after">{@render quickStart()}</div>
    {/if}

    {@render pastFrqs(frqMatches)}

    {#if historyCount > 0}
      <section class="card history" aria-labelledby="history-h">
        <h2 id="history-h" class="section-h">Your practice history</h2>
        <p class="small muted">
          {plural(historyCount, 'question')} answered on this device.
          {#if weakSpots.length > 0}Topics to work on:{:else}No weak topics so far. Nice.{/if}
        </p>
        {#if weakSpots.length > 0}
          <ul class="plain-list weak">
            {#each weakSpots as [key, acc] (key)}
              <li>
                <a class="w-topic" href={`${topicsHref}${key}/`}>{topicLabel(key)}</a>
                <span class="small muted w-pct">{pct(acc)} recently</span>
                <button type="button" class="link-button small" onclick={() => startPreset(topicQuery(key))}>
                  Start {plural(presetSize(topicQuery(key)), 'question')}<span class="visually-hidden"> on {topicLabel(key)}</span> →
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        {#if confirmClear}
          <div class="confirm row" role="group" aria-label="Clear history">
            <span class="small">Clear your practice history on this device? This can't be undone.</span>
            <button type="button" class="button small danger" onclick={clearHistory}>Clear history</button>
            <button type="button" class="button secondary small" onclick={() => (confirmClear = false)}>Cancel</button>
          </div>
        {:else}
          <button type="button" class="link-button small muted-link" onclick={() => (confirmClear = true)}>Clear history</button>
        {/if}
      </section>
    {/if}
  </div>
{:else if phase === 'session' && current}
  <!-- ───────────── Session ───────────── -->
  {@const q = current}
  <section class="session" aria-label="Practice set">
    <div class="session-bar">
      <button class="link-button" type="button" onclick={backToSetup}>← Filters</button>
      <span class="small muted progress-text">{answered} of {session.length} answered</span>
      {#if reviewing}
        <button class="button secondary small" type="button" onclick={() => showResults()}>Back to results</button>
      {:else if answered === session.length}
        <button class="button secondary small" type="button" onclick={() => showResults()}>See results</button>
      {:else}
        <button class="button secondary small" type="button" onclick={endSet}>End set</button>
      {/if}
    </div>
    <div class="progress" role="progressbar" aria-label="Answered" aria-valuemin="0" aria-valuemax={session.length} aria-valuenow={answered}>
      <span style:width={`${(answered / session.length) * 100}%`}></span>
    </div>
    {#if setLabel || session.length > 24}
      <div class="set-line">
        {#if setLabel}
          <p class="set-label small"><strong>{setLabel}</strong>{#if setNote}<span class="muted">{' · '}{setNote}</span>{/if}</p>
        {/if}
        {#if session.length > 24}
          <!-- Long sets: keep the question grid out of the way until it's wanted. -->
          <button type="button" class="link-button small jump-toggle" aria-expanded={jumpOpen} aria-controls="qnav" onclick={() => (jumpOpen = !jumpOpen)}>
            {jumpOpen ? 'Hide question list' : 'Question list'}
          </button>
        {/if}
      </div>
    {/if}

    {#snippet qnav()}
      <nav class="qnav" id="qnav" aria-label="Questions in this set">
        {#each session as s, i (s.id)}
          {@const st = statusOf(s)}
          <button
            type="button"
            class={`qdot ${st}`}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`Question ${i + 1}, ${statusText[st]}`}
            onclick={() => go(i)}
          >{#if statusMark[st]}<span class="qmark" aria-hidden="true">{statusMark[st]}</span>{/if}{i + 1}</button>
        {/each}
      </nav>
    {/snippet}
    {#if session.length > 24 ? jumpOpen : session.length > 1}
      {@render qnav()}
    {/if}

    {#key q.id}
      <article class="card question" aria-labelledby="q-heading">
        <header class="q-head">
          <h2 id="q-heading" tabindex="-1" bind:this={questionHeading}>Question {index + 1} <span class="muted">of {session.length}</span></h2>
          <!-- One quiet line, so the prompt and choices start high on small phones. -->
          <p class="q-meta small muted">
            {q.type === 'mcq' ? 'Multiple choice' : 'Free response'} · Ch. {q.chapter} ·
            {#each q.cedTopics as t, i (t)}{i > 0 ? ', ' : ''}<a href={`${topicsHref}${t}/`} title={topicTitles.get(t)}><span class="visually-hidden">AP topic </span>{t}</a>{:else}Not on the AP exam{/each}
            · {difficultyLabels[q.difficulty]}
          </p>
        </header>

        {#if q.type === 'frq' && !finished[q.id]}
          <p class="frq-hint small">
            <strong>Write your answers on paper first.</strong> Then show the scoring for each part and check every point you earned.
          </p>
        {/if}
        <div class="prompt">{@html q.promptHtml}</div>
        {#if q.image}
          <img src={q.image.src} width={q.image.width} height={q.image.height} alt={q.image.alt} decoding="async" />
        {/if}

        {#if q.type === 'mcq'}
          {@const done = !!checked[q.id]}
          <fieldset class="choices" disabled={done}>
            <legend class="visually-hidden">Choices</legend>
            {#each q.choices as c (c.id)}
              {@const isAnswer = done && c.id === q.answer}
              {@const isWrongPick = done && picks[q.id] === c.id && c.id !== q.answer}
              <label class="choice" class:right={isAnswer} class:wrong={isWrongPick}>
                <input type="radio" name={`pick-${q.id}`} value={c.id} bind:group={picks[q.id]} />
                <span class="letter" aria-hidden="true">{c.id.toUpperCase()}</span>
                <span class="choice-text">{@html c.html}</span>
                {#if isAnswer}<span class="mark">✓ Correct answer</span>{/if}
                {#if isWrongPick}<span class="mark">✗ Your answer</span>{/if}
              </label>
            {/each}
          </fieldset>
          {#if done}
            <p class="verdict" class:ok={isCorrect(q, picks[q.id]!)} role="status" bind:this={verdictEl}>
              {isCorrect(q, picks[q.id]!) ? '✓ Correct' : `✗ Not quite. The answer is ${q.answer.toUpperCase()}.`}
            </p>
            <div class="explanation"><p class="explanation-h">Explanation</p>{@html q.explanationHtml}</div>
            {@render studyThis(q)}
          {/if}
        {:else}
          {#each q.parts as part, p (part.label)}
            <section class="frq-part">
              <h3>({part.label}) <span class="small muted">{plural(part.points, 'pt')}</span></h3>
              <div class="prompt">{@html part.promptHtml}</div>
              {#if revealed[q.id]?.[p]}
                <fieldset class="scoring">
                  <legend class="small">Scoring: check each point you earned</legend>
                  {#each part.scoringHtml as s, k (k)}
                    <label class="opt">
                      <input type="checkbox" checked={!!marks[q.id]?.[p]?.[k]} onchange={(e) => setMark(q, p, k, e.currentTarget.checked)} />
                      <span>{@html s}</span>
                    </label>
                  {/each}
                </fieldset>
              {:else}
                <button class="button secondary small" type="button" onclick={() => reveal(q, p)}>Show scoring for ({part.label})</button>
              {/if}
            </section>
          {/each}
          {#if finished[q.id]}
            <p class="verdict ok" role="status" bind:this={verdictEl}>
              You earned {frqEarned(q, marks[q.id] ?? [])} of {frqTotal(q)} points.
              <span class="small muted">Misclicked? You can still change your marks above.</span>
            </p>
            <div class="explanation"><p class="explanation-h">Explanation</p>{@html q.explanationHtml}</div>
            {@render studyThis(q)}
          {:else}
            <p class="small muted marking" aria-live="polite">
              {#if allShown(q)}
                Check every point you earned, then press <strong>Done marking</strong>.
              {:else}
                Scoring shown for {shownCount(q)} of {plural(q.parts.length, 'part')}. Show it for every part, then check the points you earned.
              {/if}
            </p>
          {/if}
        {/if}

        <div class="q-actions">
          <button class="button secondary" type="button" disabled={index === 0} onclick={() => go(index - 1)}>← Previous</button>
          <span class="spacer"></span>
          {#if q.type === 'mcq' && !checked[q.id]}
            <button class="button secondary" type="button" onclick={next}>Skip</button>
            <button class="button" type="button" disabled={!picks[q.id]} onclick={() => check(q)}>Check answer</button>
          {:else if q.type === 'frq' && !finished[q.id]}
            <button class="button secondary" type="button" onclick={next}>Skip</button>
            <!-- One button, so focus stays put when it turns from "Show all scoring" into "Done marking". -->
            <button class="button" type="button" onclick={() => (allShown(q) ? finish(q) : q.parts.forEach((_, p) => reveal(q, p)))}>
              {allShown(q) ? `Done marking (${frqEarned(q, marks[q.id] ?? [])}/${frqTotal(q)})` : q.parts.length > 1 ? 'Show all scoring' : 'Show scoring'}
            </button>
          {:else}
            <button class="button" type="button" bind:this={nextButton} onclick={next}>
              {index < session.length - 1 ? 'Next question →' : 'See results →'}
            </button>
          {/if}
        </div>
      </article>
    {/key}
    {#if q.type === 'mcq'}
      <p class="small muted kbd-hint">Keyboard: press A–D to choose, Enter to check, ← → to move between questions.</p>
    {/if}
  </section>
{:else}
  <!-- ───────────── Results ───────────── -->
  <section class="results" aria-labelledby="results-h">
    <div class="card score">
      <h2 id="results-h" tabindex="-1" bind:this={resultsHeading}>Results</h2>
      {#if setLabel}<p class="small muted set-label">{setLabel}</p>{/if}
      <div class="score-row">
        {#if summary.mcqAnswered}
          <div class="stat">
            <span class="big">{summary.mcqCorrect}/{summary.mcqAnswered}</span>
            <span class="small muted">multiple choice correct ({pct(summary.mcqCorrect / summary.mcqAnswered)})</span>
          </div>
        {/if}
        {#if summary.frqDone}
          <div class="stat">
            <span class="big">{summary.frqEarned}/{summary.frqPossible}</span>
            <span class="small muted">free-response points</span>
          </div>
        {/if}
        {#if answered === 0}
          <p class="muted">You didn’t answer any questions in this set.</p>
        {/if}
      </div>
      {#if skipped.length > 0 && answered > 0}
        <p class="small muted">{plural(skipped.length, 'question')} skipped.</p>
      {/if}
      <div class="actions">
        {#if missed.length > 0}
          <button class="button" type="button" onclick={retryMissed}>{retry.button}</button>
        {/if}
        {#if skipped.length > 0}
          <button class="button" class:secondary={missed.length > 0} type="button" onclick={() => reviewQuestion(session.indexOf(skipped[0]!))}>
            Answer the {skipped.length} skipped
          </button>
        {/if}
        <button class="button" class:secondary={missed.length > 0 || skipped.length > 0} type="button" onclick={newSetSameFilters}>New set, same filters</button>
        <button class="button secondary" type="button" onclick={backToSetup}>Change filters</button>
      </div>
    </div>

    {#if study.lessons.length > 0 || study.chapters.length > 0}
      <section class="card study-card" aria-labelledby="study-h">
        <h3 id="study-h" class="section-h">Read up on what you missed</h3>
        <ul class="plain-list study-list">
          {#each study.lessons as s (s.lesson.href)}
            <li>
              <a href={s.lesson.href}>{s.lesson.title}</a>
              <span class="small muted">Ch. {s.lesson.chapter} · {plural(s.missed, 'missed question')}</span>
            </li>
          {/each}
          {#each study.chapters as n (n)}
            <li>
              <a href={`${chaptersHref}${n}/#lessons`}>Chapter {n} lessons and notes</a>
              <span class="small muted">for the other questions you missed</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if breakdown.length > 0}
      <section class="card">
        <h3 class="section-h">By topic</h3>
        <ul class="plain-list breakdown">
          {#each breakdown as t (t.key)}
            {@const frac = t.score / t.count}
            <li>
              <span class="b-label">
                {#if t.key.startsWith('chapter-')}{topicLabel(t.key)}{:else}<a href={`${topicsHref}${t.key}/`}>{topicLabel(t.key)}</a>{/if}
              </span>
              <span class="bar" aria-hidden="true"><span class:low={frac < 0.5} class:high={frac >= 0.8} style:width={pct(frac)}></span></span>
              <span class="small b-num">{pct(frac)} <span class="muted">({t.count})</span></span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="card">
      <h3 class="section-h">Questions</h3>
      <ol class="plain-list review">
        {#each session as s, i (s.id)}
          {@const st = statusOf(s)}
          <li>
            <span class={`qdot static ${st}`} aria-hidden="true">{#if statusMark[st]}<span class="qmark">{statusMark[st]}</span>{/if}{i + 1}</span>
            <span class="r-text">
              <span class="visually-hidden">Question {i + 1}, {statusText[st]}:</span>
              {excerpt(s.promptText)}
            </span>
            <button type="button" class="link-button small" onclick={() => reviewQuestion(i)}>
              {st === 'todo' ? 'Answer' : 'Review'}<span class="visually-hidden"> question {i + 1}</span>
            </button>
          </li>
        {/each}
      </ol>
    </section>

    {@render pastFrqs(sessionFrqMatches)}
  </section>
{/if}

<style>
  .section-h {
    font-size: 1rem;
    margin: 0 0 0.5rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
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
  .resume p {
    margin: 0;
  }

  /* Quick start */
  .presets-after {
    margin-top: 1.25rem;
  }
  .presets {
    margin-bottom: 1.25rem;
  }
  .presets-head,
  .filters-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.1rem 0.75rem;
    margin-bottom: 0.5rem;
  }
  .presets-head .section-h,
  .filters-head .section-h {
    margin: 0;
  }
  .filters-head {
    justify-content: space-between;
  }
  .reset.invisible {
    visibility: hidden;
  }
  .set-label {
    margin: 0;
    color: var(--text-2);
  }
  /* The set's name and "Jump to a question" share one line under the progress bar. */
  .set-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.1rem 1rem;
    margin: -0.35rem 0 0.6rem;
  }
  .jump-toggle {
    margin-left: auto;
  }
  .score .set-label {
    margin: -0.35rem 0 0.6rem;
  }
  .marking {
    margin: 0.5rem 0 0;
  }
  .chapter-note {
    margin: 0.5rem 0 0;
  }
  .confirm {
    margin-top: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    background: var(--bad-soft);
  }
  .button.danger {
    background: var(--bad);
    border-color: var(--bad);
    color: var(--surface);
  }
  .preset-row {
    display: grid;
    gap: 0.6rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
  }
  .preset {
    display: grid;
    gap: 0.1rem;
    text-align: left;
    font: inherit;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.65rem 0.85rem;
    cursor: pointer;
    box-shadow: var(--shadow);
  }
  .preset:hover {
    border-color: var(--accent);
  }
  .preset[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .preset-label {
    font-weight: 700;
    color: var(--link);
  }

  /* Filters */
  .filters {
    padding: 1rem 1.1rem 0;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0 0 1.1rem;
    min-width: 0;
  }
  legend {
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.45rem;
    padding: 0;
  }
  .three-col {
    display: grid;
    gap: 0 1.5rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  }
  .order-note {
    margin: 0.4rem 0 0;
  }
  .count-help {
    color: var(--muted);
  }
  .count-help.warn {
    color: var(--warn);
    font-weight: 600;
  }
  .num[aria-invalid='true'] {
    border-color: var(--warn);
  }
  .two-col {
    display: grid;
    gap: 0 1.5rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.25rem;
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 1.15rem;
    background: var(--surface);
    color: var(--text);
    font-size: 0.92rem;
    line-height: 1.35;
    cursor: pointer;
    user-select: none;
    max-width: 100%;
  }
  .chip input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
  .chip:hover {
    border-color: var(--accent);
  }
  .chip:has(input:checked) {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .chip:has(input:checked)::before {
    content: '✓';
    font-weight: 700;
  }
  .chip:has(input[type='radio']:checked)::before {
    content: none;
  }
  .chip:has(input:focus-visible) {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .chip-sub {
    color: var(--muted);
  }
  .chip:has(input:checked) .chip-sub {
    color: inherit;
    opacity: 0.85;
  }
  .count {
    font-size: 0.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-2);
  }
  .count.zero {
    opacity: 0.6;
  }
  /* Options that would match nothing stay usable but recede. */
  .chip:has(.count.zero):not(:has(input:checked)) {
    border-style: dashed;
    color: var(--muted);
  }
  .chip:has(input:checked) .count {
    background: var(--accent-ink);
    color: var(--accent);
  }
  .more {
    border-top: 1px solid var(--border);
    margin: 0 -1.1rem;
    padding: 0 1.1rem;
  }
  .more > summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    align-items: baseline;
    padding: 0.8rem 0;
  }
  .more > summary::-webkit-details-marker {
    display: none;
  }
  .more > summary::before {
    content: '▸';
    color: var(--muted);
    transition: transform 0.15s;
  }
  .more[open] > summary::before {
    transform: rotate(90deg);
  }
  .more-title {
    font-weight: 700;
    color: var(--link);
  }
  .more[open] > summary {
    margin-bottom: 0.25rem;
  }
  .class-only {
    margin-top: 0.4rem;
  }
  .unit {
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 0.4rem;
    background: var(--bg);
  }
  .unit > summary {
    list-style: none;
    cursor: pointer;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.25rem 0.5rem;
    align-items: baseline;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
  }
  .unit > summary::-webkit-details-marker {
    display: none;
  }
  .unit > summary::before {
    content: '▸';
    color: var(--muted);
    transition: transform 0.15s;
  }
  .unit[open] > summary::before {
    transform: rotate(90deg);
  }
  .unit .chips {
    padding: 0 0.75rem 0.65rem;
  }
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

  /* Sticky start bar: always in reach while choosing filters. */
  .start-bar {
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'info start' 'chips start';
    gap: 0.4rem 1rem;
    align-items: center;
    margin: 0 -1.1rem;
    padding: 0.75rem 1.1rem;
    border-top: 1px solid var(--border);
    background: var(--surface);
    border-radius: 0 0 var(--radius) var(--radius);
    box-shadow: 0 -6px 16px -10px rgb(0 0 0 / 0.25);
  }
  .start-bar:not(:has(.active-chips)) {
    grid-template-areas: 'info start';
  }
  .start-info {
    grid-area: info;
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.5rem;
    align-items: baseline;
    min-width: 0;
  }
  .active-chips {
    grid-area: chips;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .active-chip {
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    border: 1px solid transparent;
    background: var(--accent-soft);
    color: var(--link);
    cursor: pointer;
  }
  .active-chip:hover {
    border-color: var(--accent);
  }
  .start {
    grid-area: start;
    min-width: 10rem;
  }
  /* Phones: one short row (count on the left, Start on the right); the picked chips are in the form above. */
  @media (max-width: 520px) {
    .start-bar {
      grid-template-areas: 'info start';
      padding: 0.45rem 1.1rem;
      column-gap: 0.75rem;
    }
    .start-info {
      display: grid;
      line-height: 1.25;
    }
    .start-info .sub {
      font-size: 0.8rem;
    }
    .start-info .sub .mode {
      display: none;
    }
    .active-chips {
      display: none;
    }
    .start {
      min-width: 0;
      min-height: 2.75rem;
      padding-inline: 1.1rem;
    }
    .start-long {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
  .copy-row {
    margin: 0 0 1rem;
  }
  .legend-sub {
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
  }
  .link-button {
    font: inherit;
    background: none;
    border: 0;
    padding: 0.25rem 0;
    color: var(--link);
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }
  .link-button.small {
    font-size: 0.875rem;
  }
  .muted-link {
    color: var(--muted);
    font-weight: 500;
  }
  .button.small {
    min-height: 2.25rem;
    padding: 0.25rem 0.8rem;
    font-size: 0.9rem;
  }

  .history {
    margin-top: 1rem;
  }
  .history p {
    margin: 0 0 0.4rem;
  }
  /* Topic, score, and start link in fixed columns, so the links line up row to row. */
  .weak li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 7rem auto;
    gap: 0.25rem 0.75rem;
    align-items: baseline;
    padding: 0.35rem 0;
    border-top: 1px solid var(--border);
  }
  .weak .link-button {
    justify-self: end;
  }
  @media (max-width: 520px) {
    .weak li {
      grid-template-columns: auto 1fr;
    }
    .w-topic {
      grid-column: 1 / -1;
    }
  }

  /* Session */
  .session-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .progress {
    height: 6px;
    border-radius: 999px;
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
  .qnav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 1rem;
  }
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
  .qdot.static {
    cursor: default;
    flex: none;
  }
  .qdot.right {
    background: var(--good-soft);
    border-color: var(--good);
    color: var(--good);
  }
  .qdot.wrong {
    background: var(--bad-soft);
    border-color: var(--bad);
    color: var(--bad);
  }
  .qdot.partial {
    background: var(--warn-soft);
    border-color: var(--warn);
    color: var(--warn);
  }
  .qdot[aria-current='step'] {
    outline: 2px solid var(--text);
    outline-offset: 1px;
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
  @media (max-width: 480px) {
    .question {
      padding: 0.9rem 1rem;
    }
  }
  .prompt,
  .explanation,
  .choice-text {
    min-width: 0;
    overflow-x: auto;
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
  .choices {
    display: grid;
    gap: 0.5rem;
    margin: 1rem 0;
  }
  .choice {
    position: relative;
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
    padding: 0.65rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    flex-wrap: wrap;
    background: var(--surface);
  }
  .choice:hover {
    border-color: var(--accent);
  }
  .choices:disabled .choice {
    cursor: default;
  }
  .choices:disabled .choice:not(.right, .wrong) {
    opacity: 0.7;
  }
  .choice:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .choice:has(input:focus-visible) {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
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
  .choice-text {
    flex: 1;
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
  .explanation-h {
    margin: 0.5rem 0 0.25rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .explanation {
    border-top: 1px solid var(--border);
    margin-top: 0.5rem;
    padding-top: 0.25rem;
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
  .study-list li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.1rem 0.6rem;
    padding: 0.35rem 0;
  }
  .study-list a {
    font-weight: 600;
  }
  .frq-part {
    margin: 0.75rem 0 1rem;
  }
  .frq-part h3 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
  }
  .scoring {
    background: var(--surface-2);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    margin-top: 0.5rem;
  }
  .scoring legend {
    float: left;
    width: 100%;
    margin-bottom: 0.2rem;
    text-transform: none;
    letter-spacing: 0;
    color: var(--text-2);
    font-size: 0.875rem;
  }
  .frq-hint {
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    border-left: 4px solid var(--tip);
    border-radius: 0 8px 8px 0;
    background: var(--tip-soft);
    color: var(--text);
  }
  .verdict .small {
    display: block;
    font-weight: 400;
  }
  .opt {
    /* The legend floats (so it sits inside the grey box); each row starts below it. */
    clear: both;
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.2rem 0;
    cursor: pointer;
  }
  .q-actions .button {
    padding-inline: 0.85rem;
  }
  @media (max-width: 480px) {
    /* The main action (Check, Done marking, Next) goes first and full width on phones. */
    .q-actions .button:not(.secondary) {
      order: -1;
      flex: 1 1 100%;
    }
    .q-actions .spacer {
      display: none;
    }
    .q-actions .button.secondary {
      flex: 1;
    }
    .question {
      padding: 1rem;
    }
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

  /* Results */
  .results {
    display: grid;
    gap: 1rem;
  }
  .score h2 {
    margin: 0 0 0.5rem;
    font-size: 1.3rem;
  }
  .score h2:focus {
    outline: none;
  }
  .score-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 2rem;
  }
  .stat {
    display: grid;
  }
  .big {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .score .actions {
    margin-bottom: 0;
  }
  .breakdown li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(4rem, 8rem) 4.5rem;
    gap: 0.75rem;
    align-items: center;
    padding: 0.35rem 0;
    border-top: 1px solid var(--border);
  }
  .bar {
    height: 8px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--warn);
  }
  .bar span.low {
    background: var(--bad);
  }
  .bar span.high {
    background: var(--good);
  }
  .b-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  /* Phones: the topic name gets the whole line; its bar and score go underneath. */
  @media (max-width: 520px) {
    .breakdown li {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'label label' 'bar num';
      gap: 0.2rem 0.75rem;
    }
    .b-label {
      grid-area: label;
    }
    .bar {
      grid-area: bar;
    }
    .b-num {
      grid-area: num;
    }
  }
  .review li {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.4rem 0;
    border-top: 1px solid var(--border);
  }
  .r-text {
    flex: 1;
    min-width: 0;
    font-size: 0.92rem;
    color: var(--text-2);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .past-frqs {
    margin: 1rem 0;
  }
  .results .past-frqs {
    margin: 0;
  }
  .past-frqs summary {
    cursor: pointer;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
  }
  .summary-title {
    font-weight: 700;
    color: var(--link);
  }
  .practices {
    color: var(--text-2);
    font-weight: 600;
  }
  .past-frqs li {
    padding: 0.45rem 0;
    border-top: 1px solid var(--border);
  }
</style>
