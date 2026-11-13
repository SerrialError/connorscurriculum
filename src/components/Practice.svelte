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
    type PracticeQuestion,
    type PracticeTest,
    DEFAULT_COUNT,
    MAX_COUNT,
    activeFilterCount,
    countWith,
    defaultCount,
    emptyFilters,
    filterQuestions,
    filterTopics,
    filtersToQuery,
    frqEarned,
    frqTotal,
    isCorrect,
    parseFilters,
    recordResult,
    selectQuestions,
    sessionSize,
    summarize,
    topicAccuracy,
    topicBreakdown,
  } from '../lib/practice';
  import { type FrqLink, frqName, frqPractices, frqTotal as pastFrqPoints, matchFrqs, readyPoints } from '../lib/frqs';
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
    chapters: { number: number; title: string; hasQuestions: boolean; current: boolean }[];
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
  }: Props = $props();

  const historyKey = storageKey(subject, 'practice-history');
  const savedKey = storageKey(subject, 'practice-session');
  const difficultyLabels: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
  const modeLabels: Record<Mode, string> = { all: 'In order', random: 'Shuffled', weak: 'Weakest topics first' };
  const countChoices = [5, 10, 20];

  type Phase = 'setup' | 'session' | 'results';

  /** An in-progress or finished set, saved so a reload or the Back button doesn't lose it. */
  interface Saved {
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
  let index = $state(0);
  let history = $state<History>({});
  let copied = $state(false);
  let resumable = $state<Saved | null>(null);
  let customCount = $state(false);

  // Per-question answer state, keyed by question id.
  let picks = $state<Record<string, string>>({});
  let checked = $state<Record<string, boolean>>({});
  let revealed = $state<Record<string, boolean[]>>({});
  let marks = $state<Record<string, boolean[][]>>({});
  let finished = $state<Record<string, boolean>>({});

  let questionHeading = $state<HTMLElement | null>(null);
  let nextButton = $state<HTMLButtonElement | null>(null);
  let resultsHeading = $state<HTMLElement | null>(null);

  const matching = $derived(all ? filterQuestions(all, filters, tests) : []);
  const setSize = $derived(sessionSize(matching.length, filters));
  const activeCount = $derived(activeFilterCount(filters));
  const topicTitles = $derived(new Map(units.flatMap((u) => u.topics.map((t) => [t.id, t.title] as const))));
  const usedTopics = $derived(new Set(all?.flatMap((q) => q.cedTopics) ?? []));
  const usedUnits = $derived(new Set(all?.flatMap((q) => q.units) ?? []));
  const learned = $derived(new Set(learnedTopics));
  const frqTopics = $derived(filterTopics(filters, units, chapterTopics, tests));
  const frqMatches = $derived(frqTopics.size ? matchFrqs(frqs, frqTopics) : []);
  const sessionFilters = $derived(parseFilters(sessionQuery));
  const sessionFrqTopics = $derived(filterTopics(sessionFilters, units, chapterTopics, tests));
  const sessionFrqMatches = $derived(sessionFrqTopics.size ? matchFrqs(frqs, sessionFrqTopics) : []);
  const emptyCurrent = $derived(chapters.filter((c) => c.current && !c.hasQuestions));
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
  const current = $derived(session[index]);

  /** Topics with history, weakest first, for the "Your weak spots" list. */
  const weakSpots = $derived.by(() => {
    if (!all) return [];
    return [...topicAccuracy(all, history)]
      .filter(([k, acc]) => !k.startsWith('chapter-') && acc < 0.75)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 4);
  });
  const historyCount = $derived(Object.keys(history).length);

  // Keep the URL in sync with the setup filters, so reloading or copying the address keeps them.
  $effect(() => {
    if (!all || phase !== 'setup') return;
    const q = filtersToQuery(filters);
    if (location.search !== q) history_replace(q, null);
  });

  // Save the session after every change.
  $effect(() => {
    if (phase === 'setup' || session.length === 0) return;
    const saved: Saved = {
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
    writeJson(savedKey, saved);
  });

  onMount(() => {
    filters = parseFilters(location.search);
    customCount = filters.n !== null && !countChoices.includes(filters.n);
    history = readJson<History>(historyKey, {});
    const onPop = (e: PopStateEvent) => {
      const p = (e.state as { phase?: Phase } | null)?.phase;
      if ((p === 'session' || p === 'results') && session.length) phase = p;
      else {
        phase = 'setup';
        filters = parseFilters(location.search);
        offerResume();
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
      offerResume();
    } catch (err) {
      loadError = `Could not load questions (${(err as Error).message}).`;
    }
  }

  function offerResume() {
    const saved = readJson<Saved | null>(savedKey, null);
    if (!saved || !all || !Array.isArray(saved.ids)) return void (resumable = null);
    const byId = new Map(all.map((q) => [q.id, q]));
    const done = saved.ids.filter((id) => saved.checked?.[id] || saved.finished?.[id]).length;
    // Only offer sets that are still unfinished and whose questions all still exist.
    resumable = saved.phase === 'session' && done < saved.ids.length && saved.ids.every((id) => byId.has(id)) ? saved : null;
  }

  function history_replace(query: string, state: { phase: Phase } | null) {
    window.history.replaceState(state, '', location.pathname + query);
  }

  function resetAnswers() {
    picks = {};
    checked = {};
    revealed = {};
    marks = {};
    finished = {};
  }

  async function begin(questions: PracticeQuestion[], query: string) {
    session = questions;
    sessionQuery = query;
    index = 0;
    resetAnswers();
    resumable = null;
    // A history entry per set, so the browser's Back button returns to the filters.
    if (phase === 'setup') window.history.pushState({ phase: 'session' }, '', location.pathname + query);
    else history_replace(query, { phase: 'session' });
    phase = 'session';
    await showQuestion();
  }

  function start() {
    if (!all || matching.length === 0) return;
    void begin(selectQuestions(matching, filters, history), filtersToQuery(filters));
  }

  function newSetSameFilters() {
    if (!all) return;
    const f = sessionFilters;
    void begin(selectQuestions(filterQuestions(all, f, tests), f, history), sessionQuery);
  }

  function retryMissed() {
    void begin([...missed], sessionQuery);
  }

  async function resume() {
    if (!resumable || !all) return;
    const byId = new Map(all.map((q) => [q.id, q]));
    const s = resumable;
    session = s.ids.map((id) => byId.get(id)!);
    sessionQuery = s.query;
    picks = s.picks ?? {};
    checked = s.checked ?? {};
    revealed = s.revealed ?? {};
    marks = s.marks ?? {};
    finished = s.finished ?? {};
    index = Math.min(Math.max(0, s.index), session.length - 1);
    resumable = null;
    window.history.pushState({ phase: 'session' }, '', location.pathname + s.query);
    phase = 'session';
    await showQuestion();
  }

  function discardResume() {
    writeJson(savedKey, null);
    resumable = null;
  }

  function backToSetup() {
    filters = parseFilters(sessionQuery);
    customCount = filters.n !== null && !countChoices.includes(filters.n);
    history_replace(sessionQuery, null);
    phase = 'setup';
    offerResume();
    void tick().then(() => window.scrollTo({ top: 0 }));
  }

  async function showQuestion() {
    await tick();
    const top = questionHeading?.closest('.session')?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight / 2) window.scrollTo({ top: window.scrollY + top - 12 });
    questionHeading?.focus({ preventScroll: true });
  }

  function go(i: number) {
    index = Math.max(0, Math.min(session.length - 1, i));
    void showQuestion();
  }

  async function showResults() {
    phase = 'results';
    history_replace(sessionQuery, { phase: 'results' });
    await tick();
    window.scrollTo({ top: 0 });
    resultsHeading?.focus({ preventScroll: true });
  }

  function reviewQuestion(i: number) {
    phase = 'session';
    history_replace(sessionQuery, { phase: 'session' });
    go(i);
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
    await tick();
    nextButton?.focus();
  }

  function reveal(q: FrqQuestion, part: number) {
    revealed[q.id] ??= q.parts.map(() => false);
    revealed[q.id]![part] = true;
    marks[q.id] ??= q.parts.map((p) => p.scoringHtml.map(() => false));
  }

  async function finish(q: FrqQuestion) {
    finished[q.id] = true;
    save(q.id, frqEarned(q, marks[q.id] ?? []) / frqTotal(q));
    await tick();
    nextButton?.focus();
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
      return;
    }
    if (e.key === 'ArrowRight' && !el.closest('input')) go(index + 1);
    if (e.key === 'ArrowLeft' && !el.closest('input')) go(index - 1);
  }

  function setMode(mode: Mode) {
    // Switching between "in order" and a smaller set picks a sensible count, unless one was chosen.
    if (filters.n === defaultCount(filters.mode)) filters.n = defaultCount(mode);
    filters.mode = mode;
  }

  function setCount(n: number | null) {
    customCount = false;
    filters.n = n;
  }

  function applyPreset(query: string) {
    filters = parseFilters(query);
    customCount = filters.n !== null && !countChoices.includes(filters.n);
  }

  function practiceTopic(id: string) {
    filters = { ...emptyFilters(), topics: [id], mode: 'random', n: DEFAULT_COUNT };
    customCount = false;
    void tick().then(() => document.querySelector('.start-bar')?.scrollIntoView({ block: 'nearest' }));
  }

  function clearHistory() {
    if (!confirm('Clear your saved practice history on this device? Weakest-first ordering starts over.')) return;
    history = {};
    writeJson(historyKey, {});
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
    key.startsWith('chapter-') ? `Ch. ${key.slice(8)} (class only)` : `${key} ${topicTitles.get(key) ?? ''}`;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const excerpt = (html: string) => {
    const text = html.replace(/<annotation[\s\S]*?<\/annotation>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 110 ? `${text.slice(0, 108).trimEnd()}…` : text;
  };
  const statusOf = (q: PracticeQuestion) =>
    scores[q.id] === undefined ? 'todo' : scores[q.id] === 1 ? 'right' : scores[q.id] === 0 ? 'wrong' : 'part';
  const statusText = { todo: 'not answered', right: 'correct', wrong: 'incorrect', part: 'partial credit' } as const;

  /** Human-readable list of active filters, each with a function that removes it. */
  const chips = $derived.by(() => {
    const out: { label: string; remove: () => void }[] = [];
    for (const n of filters.chapters) out.push({ label: `Ch. ${n}`, remove: () => (filters.chapters = filters.chapters.filter((x) => x !== n)) });
    if (filters.test) {
      const t = tests.find((x) => x.id === filters.test);
      out.push({ label: t?.title ?? filters.test, remove: () => (filters.test = null) });
    }
    for (const u of filters.units) out.push({ label: `Unit ${u}`, remove: () => (filters.units = filters.units.filter((x) => x !== u)) });
    for (const t of filters.topics) out.push({ label: `Topic ${t}`, remove: () => (filters.topics = filters.topics.filter((x) => x !== t)) });
    for (const d of filters.difficulty)
      out.push({ label: difficultyLabels[d]!, remove: () => (filters.difficulty = filters.difficulty.filter((x) => x !== d)) });
    if (filters.type) out.push({ label: filters.type === 'mcq' ? 'Multiple choice' : 'Free response', remove: () => (filters.type = null) });
    return out;
  });
</script>

<svelte:window onkeydown={onKey} />

{#snippet pastFrqs(matches: ReturnType<typeof matchFrqs>)}
  {#if matches.length > 0}
    <details class="card past-frqs">
      <summary>
        <span class="summary-title">Past AP FRQs on these topics</span>
        <span class="muted small">{plural(matches.length, 'released question')}</span>
      </summary>
      <p class="small muted">
        Real exam questions from AP Central. Do the listed parts, then grade yourself with the scoring guidelines.
        <a href={frqsHref}>All past FRQs</a>
      </p>
      <ul class="plain-list">
        {#each matches as m (m.frq.year * 10 + m.frq.number)}
          {@const ready = readyPoints(m.frq, (t) => learned.has(t))}
          <li>
            <div>
              <a href={m.frq.questionUrl} target="_blank" rel="noopener"><strong>{frqName(m.frq)}</strong></a>
              {m.frq.title}
              <span class="badge" class:good={ready === pastFrqPoints(m.frq)}>
                {ready === pastFrqPoints(m.frq) ? '✓ Ready' : `${ready}/${pastFrqPoints(m.frq)} pts ready`}
              </span>
            </div>
            <div class="small practices">
              {frqPractices({ parts: m.parts }).map((id) => practiceNames[id] ?? id).join(' · ')}
              {#if !m.frq.officialSkills}<span class="muted">(our labels)</span>{/if}
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

{#snippet count(n: number)}
  <span class="count" class:zero={n === 0}>{n}</span>
{/snippet}

{#if loadError}
  <p class="notice">{loadError}</p>
{:else if !all}
  <p class="muted" aria-live="polite">Loading questions…</p>
{:else if phase === 'setup'}
  <!-- ───────────── Setup ───────────── -->
  <div class="setup">
    {#if resumable}
      {@const done = resumable.ids.filter((id) => resumable!.checked?.[id] || resumable!.finished?.[id]).length}
      <section class="card resume" aria-label="Unfinished set">
        <p><strong>You have an unfinished set.</strong> <span class="muted">{done} of {resumable.ids.length} answered.</span></p>
        <div class="row">
          <button class="button" type="button" onclick={resume}>Resume</button>
          <button class="button secondary" type="button" onclick={discardResume}>Discard</button>
        </div>
      </section>
    {/if}

    <p class="lead">Choose what to practice, then press <strong>Start</strong>. Nothing starts until you do.</p>

    {#if presets.length > 0 || historyCount > 0}
      <section class="presets" aria-labelledby="presets-h">
        <h2 id="presets-h" class="section-h">Quick picks</h2>
        <div class="preset-row">
          {#each presets as p (p.query)}
            <button
              type="button"
              class="preset"
              aria-pressed={filtersToQuery(filters) === p.query}
              onclick={() => applyPreset(p.query)}
            >
              <span class="preset-label">{p.label}</span>
              {#if p.note}<span class="small muted">{p.note}</span>{/if}
            </button>
          {/each}
          {#if historyCount > 0}
            <button
              type="button"
              class="preset"
              aria-pressed={filtersToQuery(filters) === '?mode=weak'}
              onclick={() => applyPreset('?mode=weak')}
            >
              <span class="preset-label">Weakest topics</span>
              <span class="small muted">10 questions, based on your answers</span>
            </button>
          {/if}
        </div>
      </section>
    {/if}

    <form class="card filters" onsubmit={(e) => { e.preventDefault(); start(); }} aria-labelledby="filters-h">
      <div class="filters-head">
        <h2 id="filters-h" class="section-h">Filters</h2>
        {#if activeCount > 0 || filters.mode !== 'all' || filters.n !== null}
          <button class="link-button" type="button" onclick={() => { filters = emptyFilters(); customCount = false; }}>Reset all</button>
        {/if}
      </div>
      <p class="small muted hint">Pick as many as you like. Options in the same group are combined with “or”, and different groups with “and”.</p>

      <fieldset>
        <legend>Chapter</legend>
        <div class="chips">
          {#each chapters.filter((c) => c.hasQuestions || filters.chapters.includes(c.number)) as c (c.number)}
            <label class="chip" title={c.title}>
              <input
                type="checkbox"
                checked={filters.chapters.includes(c.number)}
                onchange={() => (filters.chapters = toggle(filters.chapters, c.number))}
              />
              <span>Ch. {c.number} <span class="chip-sub">{c.title}</span></span>
              {@render count(countWith(all, filters, tests, { chapters: [c.number] }))}
            </label>
          {/each}
        </div>
        {#if emptyCurrent.length > 0}
          <p class="small muted">
            {#each emptyCurrent as c, i (c.number)}{i > 0 ? ' and ' : ''}<a href={`${chaptersHref}${c.number}/`}>Ch. {c.number}</a>{/each}
            (what the class is on now) {emptyCurrent.length === 1 ? 'has' : 'have'} no practice questions yet. The chapter
            {emptyCurrent.length === 1 ? 'page lists' : 'pages list'} past AP FRQs on {emptyCurrent.length === 1 ? 'its' : 'their'} topics.
          </p>
        {/if}
      </fieldset>

      {#if tests.length > 0}
        <fieldset>
          <legend>Class test</legend>
          <div class="chips">
            <label class="chip">
              <input type="radio" name="test" checked={filters.test === null} onchange={() => (filters.test = null)} />
              <span>Any</span>
            </label>
            {#each tests as t (t.id)}
              <label class="chip">
                <input type="radio" name="test" checked={filters.test === t.id} onchange={() => (filters.test = t.id)} />
                <span>{t.title}</span>
                {@render count(countWith(all, filters, tests, { test: t.id }))}
              </label>
            {/each}
          </div>
        </fieldset>
      {/if}

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
      </fieldset>

      <div class="two-col">
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
          <legend>Question type</legend>
          <div class="chips">
            {#each [[null, 'Any'], ['mcq', 'Multiple choice'], ['frq', 'Free response']] as const as [value, label] (label)}
              <label class="chip">
                <input type="radio" name="type" checked={filters.type === value} onchange={() => (filters.type = value)} />
                <span>{label}</span>
                {#if value}{@render count(countWith(all, filters, tests, { type: value }))}{/if}
              </label>
            {/each}
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
          {#if filters.mode === 'weak'}
            <p class="small muted">
              {historyCount > 0
                ? 'Topics you have missed most come first, then topics you haven’t tried.'
                : 'You haven’t answered anything yet on this device, so this works like Shuffled for now.'}
            </p>
          {/if}
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
              <input type="radio" name="count" checked={customCount} onchange={() => { customCount = true; filters.n ??= DEFAULT_COUNT; }} />
              <span>Other</span>
            </label>
            {#if customCount}
              <label class="num-label">
                <span class="visually-hidden">Number of questions</span>
                <input
                  class="num"
                  type="number"
                  min="1"
                  max={MAX_COUNT}
                  value={filters.n ?? DEFAULT_COUNT}
                  oninput={(e) => {
                    const v = Number(e.currentTarget.value);
                    if (Number.isInteger(v) && v > 0) filters.n = Math.min(v, MAX_COUNT);
                  }}
                />
              </label>
            {/if}
          </div>
        </fieldset>
      </div>

      <div class="start-bar" aria-live="polite">
        <div class="start-info">
          {#if matching.length === 0}
            <strong>No questions match.</strong>
            <span class="small muted">Remove a filter to see more.</span>
          {:else}
            <strong>{plural(setSize, 'question')}</strong>
            <span class="small muted">
              {#if setSize < matching.length}from {matching.length} matching{:else if activeCount === 0}all questions{:else}match{/if}
              · {modeLabels[filters.mode].toLowerCase()}
            </span>
          {/if}
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
        </div>
        <div class="row">
          <button class="button secondary small" type="button" onclick={() => copyLink(filtersToQuery(filters))}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button class="button start" type="submit" disabled={matching.length === 0}>Start practice →</button>
        </div>
      </div>
    </form>

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
                <a href={`${topicsHref}${key}/`}>{topicLabel(key)}</a>
                <span class="small muted">{pct(acc)} recently</span>
                <button type="button" class="link-button small" onclick={() => practiceTopic(key)}>Set up practice</button>
              </li>
            {/each}
          </ul>
        {/if}
        <button type="button" class="link-button small muted-link" onclick={clearHistory}>Clear history</button>
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
      <button class="button secondary small" type="button" onclick={showResults}>
        {answered === session.length ? 'See results' : 'Finish'}
      </button>
    </div>
    <div class="progress" role="progressbar" aria-label="Answered" aria-valuemin="0" aria-valuemax={session.length} aria-valuenow={answered}>
      <span style:width={`${(answered / session.length) * 100}%`}></span>
    </div>

    {#snippet qnav()}
      <nav class="qnav" aria-label="Questions in this set">
        {#each session as s, i (s.id)}
          {@const st = statusOf(s)}
          <button
            type="button"
            class={`qdot ${st}`}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`Question ${i + 1}, ${statusText[st]}`}
            onclick={() => go(i)}
          >{i + 1}</button>
        {/each}
      </nav>
    {/snippet}
    {#if session.length > 24}
      <!-- Long sets: keep the question grid out of the way until it's wanted. -->
      <details class="qnav-toggle">
        <summary class="small">Jump to a question</summary>
        {@render qnav()}
      </details>
    {:else if session.length > 1}
      {@render qnav()}
    {/if}

    {#key q.id}
      <article class="card question" aria-labelledby="q-heading">
        <header class="q-head">
          <h2 id="q-heading" tabindex="-1" bind:this={questionHeading}>Question {index + 1} <span class="muted">of {session.length}</span></h2>
          <div class="badges">
            <span class="badge">{q.type === 'mcq' ? 'Multiple choice' : 'Free response'}</span>
            <span class="badge">Ch. {q.chapter}</span>
            {#each q.cedTopics as t (t)}
              <a class="badge topic" href={`${topicsHref}${t}/`} title={topicTitles.get(t)} target="_blank" rel="noopener">{t}</a>
            {:else}
              <span class="badge not-ap">Class only</span>
            {/each}
            <span class="badge">{difficultyLabels[q.difficulty]}</span>
          </div>
        </header>

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
            <p class="verdict" class:ok={isCorrect(q, picks[q.id]!)} role="status">
              {isCorrect(q, picks[q.id]!) ? '✓ Correct' : `✗ Not quite. The answer is ${q.answer.toUpperCase()}.`}
            </p>
            <div class="explanation"><p class="explanation-h">Explanation</p>{@html q.explanationHtml}</div>
          {/if}
        {:else}
          {#each q.parts as part, p (part.label)}
            <section class="part">
              <h3>({part.label}) <span class="small muted">{plural(part.points, 'pt')}</span></h3>
              <div class="prompt">{@html part.promptHtml}</div>
              {#if revealed[q.id]?.[p]}
                <fieldset class="scoring" disabled={!!finished[q.id]}>
                  <legend class="small">Scoring: check each point you earned</legend>
                  {#each part.scoringHtml as s, k (k)}
                    <label class="opt">
                      <input type="checkbox" bind:checked={marks[q.id]![p]![k]} />
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
            <p class="verdict ok" role="status">You earned {frqEarned(q, marks[q.id] ?? [])} of {frqTotal(q)} points.</p>
            <div class="explanation"><p class="explanation-h">Explanation</p>{@html q.explanationHtml}</div>
          {:else if !q.parts.every((_, p) => revealed[q.id]?.[p])}
            <p class="small muted frq-hint">
              Write your answers on paper first. Then show the scoring and check each point you earned.
              {#if q.parts.length > 1}
                <button class="link-button small" type="button" onclick={() => q.parts.forEach((_, p) => reveal(q, p))}>Show all scoring</button>
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
            <button class="button" type="button" disabled={!q.parts.every((_, p) => revealed[q.id]?.[p])} onclick={() => finish(q)}>
              Done marking ({frqEarned(q, marks[q.id] ?? [])}/{frqTotal(q)})
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
          <button class="button" type="button" onclick={retryMissed}>Retry the {plural(missed.length, 'question')} I missed</button>
        {/if}
        {#if skipped.length > 0}
          <button class="button" class:secondary={missed.length > 0} type="button" onclick={() => reviewQuestion(session.indexOf(skipped[0]!))}>
            Answer the {plural(skipped.length, 'skipped question')}
          </button>
        {/if}
        <button class="button" class:secondary={missed.length > 0 || skipped.length > 0} type="button" onclick={newSetSameFilters}>New set, same filters</button>
        <button class="button secondary" type="button" onclick={backToSetup}>Change filters</button>
      </div>
    </div>

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
            <span class={`qdot static ${st}`} aria-hidden="true">{i + 1}</span>
            <span class="r-text">
              <span class="visually-hidden">Question {i + 1}, {statusText[st]}:</span>
              {excerpt(s.promptHtml)}
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
  .lead {
    margin: 0 0 1rem;
    color: var(--text-2);
  }
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

  /* Quick picks */
  .presets {
    margin-bottom: 1rem;
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
  .filters-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }
  .hint {
    margin: 0 0 0.75rem;
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
  .chip:has(input:checked) .count {
    background: rgb(255 255 255 / 0.25);
    color: inherit;
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
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    align-items: center;
    justify-content: space-between;
    margin: 0 -1.1rem;
    padding: 0.75rem 1.1rem;
    border-top: 1px solid var(--border);
    background: var(--surface);
    border-radius: 0 0 var(--radius) var(--radius);
    box-shadow: 0 -6px 16px -10px rgb(0 0 0 / 0.25);
  }
  .start-info {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    align-items: baseline;
    min-width: 0;
    flex: 1 1 14rem;
  }
  .active-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    flex-basis: 100%;
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
    min-width: 10rem;
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
  .weak li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    align-items: baseline;
    padding: 0.35rem 0;
    border-top: 1px solid var(--border);
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
    display: inline-grid;
    place-items: center;
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
  .qdot.part {
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
    gap: 0.5rem 1rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
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
  .part {
    margin: 0.75rem 0 1rem;
  }
  .part h3 {
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
  .opt {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.2rem 0;
    cursor: pointer;
  }
  .q-actions .button {
    padding-inline: 0.85rem;
  }
  .qnav-toggle {
    margin-bottom: 0.75rem;
  }
  .qnav-toggle summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--link);
    margin-bottom: 0.5rem;
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
    .breakdown li {
      grid-template-columns: minmax(0, 1fr) 3.5rem 4.2rem;
      gap: 0.5rem;
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
  @media (hover: none) {
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
