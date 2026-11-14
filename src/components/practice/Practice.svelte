<script lang="ts">
  // The practice page: build a set (Setup), answer it (Session), then review it (Results).
  // What each screen does to the address and the browser history is decided in
  // lib/practice/nav.ts; this component opens sets, keeps them saved, and applies those steps.
  import { onMount } from 'svelte';
  import { matchFrqs } from '../../lib/frqs';
  import { emptyFilters, filterQuestions, filterTopics, sessionSize } from '../../lib/practice/filters';
  import { WEAK_NO_HISTORY_NOTE, describeScope, describeSet } from '../../lib/practice/labels';
  import { type LinkProblem, RESHUFFLED_NOTE, knownFilters, linkNotice, missingNote } from '../../lib/practice/link-check';
  import { type Entry, type Step, land, readEntry, startSet, syncSetup, toResults, toReview, toSetup } from '../../lib/practice/nav';
  import { type SavedSet, answeredIn, readSavedSets, resumable as findResumable, withSaved } from '../../lib/practice/saved';
  import { amendLastResult, recordResult, weakHasNoHistory, weakTopics } from '../../lib/practice/score';
  import { newSeed, questionsForSet } from '../../lib/practice/select';
  import type { Filters, History, PracticeQuestion } from '../../lib/practice/types';
  import { type SetSpec, filtersToQuery, hasBadSeed, parseFilters, parseSet, setToQuery, setupQuery, topicQuery } from '../../lib/practice/url';
  import { readJson, storageKey, writeJson } from '../../lib/storage';
  import { plural } from '../../lib/text';
  import { Attempt } from './attempt.svelte';
  import { type PracticeCourse, setCourse, withDerived } from './context';
  import PracticeHistory from './PracticeHistory.svelte';
  import Results from './Results.svelte';
  import Session from './Session.svelte';
  import Setup from './Setup.svelte';

  let { course: input }: { course: PracticeCourse } = $props();
  // The course never changes after the page is built.
  // svelte-ignore state_referenced_locally
  const course = setCourse(withDerived(input));
  const { tests, everything } = course;

  const historyKey = storageKey(course.subject, 'practice-history');
  const savedKey = storageKey(course.subject, 'practice-session');

  let all = $state<PracticeQuestion[] | null>(null);
  let loadError = $state('');
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
  const setFrqTopics = $derived(filterTopics(setFilters, course.units, course.chapterTopics, tests));
  const weakSpots = $derived(all ? weakTopics(filterQuestions(all, emptyFilters(), tests), history) : []);
  /** How many questions a set with filters `f` would have. */
  const sizeOf = (f: Filters) => sessionSize(filterQuestions(all!, f, tests).length, f);
  /** `f` checked against what this class has. */
  const checked = (f: Filters) => knownFilters(f, { chapters: course.chapters.map((c) => c.number), tests, units: course.units, questions: all! });

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
    if (all && phase === 'setup') navigate(syncSetup(location.search, filtersToQuery(filters)));
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
    const onPop = () => arrive();
    window.addEventListener('popstate', onPop);
    void load();
    return () => window.removeEventListener('popstate', onPop);
  });

  async function load() {
    try {
      const res = await fetch(course.questionsUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      all = (await res.json()) as PracticeQuestion[];
    } catch (err) {
      loadError = `Could not load questions (${(err as Error).message}).`;
      return;
    }
    arrive();
  }

  /**
   * The page landed on a history entry (load, Back, Forward): show the set its address names (a
   * reload, a bookmark, a shared link, or a "Start" link elsewhere on the site), else setup.
   */
  function arrive() {
    const current = entry();
    const spec = parseSet(location.search);
    const isOpen = !!spec?.seed && spec.seed === set.id && attempt.questions.length > 0;
    // A link with filters the class doesn't have opens the setup screen without them (showSetup says so).
    const fits = !spec || checked(spec.filters).unknown.length === 0;
    const opened = isOpen || (spec ? fits && openSet(spec, hasBadSeed(location.search)) : !!current && openSaved(current.set));
    const landed = land(location.search, current, opened ? set : null);
    navigate(landed.steps);
    if (landed.entry) {
      reviewing = !!landed.entry.reviewing;
      phase = landed.entry.phase;
    } else {
      showSetup(spec && fits ? { kind: spec.ids ? 'gone' : 'empty' } : null);
    }
  }

  const savedSets = () => (all ? readSavedSets(readJson<unknown>(savedKey, null), new Set(all.map((q) => q.id))) : []);

  /**
   * Open a set from its address: the saved attempt with that seed, or a new one built from it.
   * `badSeed`: the address's seed was damaged, so a new set's questions aren't the ones shared.
   */
  function openSet(spec: SetSpec, badSeed: boolean): boolean {
    if (spec.seed && openSaved(spec.seed, setToQuery(spec))) return true;
    const full = { ...spec, seed: spec.seed ?? newSeed() };
    const questions = questionsForSet(all!, full, tests, history);
    if (questions.length === 0) return false;
    loadSet(full, questions);
    if (badSeed && !spec.ids) set.note = RESHUFFLED_NOTE;
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
      note: setNote(spec, questions.length, pool),
    };
    resumable = null;
    reviewing = false;
  }

  /** The line shown with a new set: questions missing from a shared set, or why "weakest first" is random. */
  function setNote(spec: SetSpec, found: number, pool: PracticeQuestion[]): string {
    if (spec.ids) {
      const asked = new Set(spec.ids).size;
      return found < asked ? missingNote(asked, found) : '';
    }
    return spec.filters.mode === 'weak' && weakHasNoHistory(pool, history) ? WEAK_NO_HISTORY_NOTE : '';
  }

  /** Start a new set from filters `f` (and, for a retry, exact questions). */
  function begin(f: Filters, ids: string[] | null = null, label?: string) {
    const spec = { filters: f, seed: newSeed(), ids };
    const questions = questionsForSet(all!, spec, tests, history);
    if (questions.length === 0) return;
    if (phase === 'setup') filters = f;
    notice = '';
    loadSet(spec, questions, label);
    navigate(startSet(phase, entry(), filtersToQuery(f), set));
    phase = 'session';
  }

  function resume() {
    if (!resumable) return;
    // Like starting it: the setup entry below shows the filters that made this set.
    const q = setupQuery(resumable.query);
    filters = parseFilters(q);
    openSaved(resumable.id);
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
    notice = unknown.length ? linkNotice({ kind: 'unknown', values: unknown }) : problem ? linkNotice(problem) : '';
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
  <Setup {all} bind:filters weakest={weakSpots.length > 0} onstart={(f) => begin(f)} />
  {#if Object.keys(history).length > 0}
    <PracticeHistory
      count={Object.keys(history).length}
      {weakSpots}
      size={(topic) => sizeOf(parseFilters(topicQuery(topic)))}
      onstart={(topic) => begin(parseFilters(topicQuery(topic)))}
      onclear={() => clearHistory()}
    />
  {/if}
{:else if phase === 'session'}
  <Session
    {attempt}
    label={set.label}
    note={set.note}
    {reviewing}
    onfilters={() => backToSetup()}
    onresults={() => showResults()}
    onscore={score}
  />
{:else}
  <Results
    {attempt}
    label={set.label}
    filters={setFilters}
    frqMatches={setFrqTopics.size ? matchFrqs(course.frqs, setFrqTopics) : []}
    onretry={(words) =>
      begin(
        setFilters,
        attempt.missed.map((q) => q.id),
        `${describeScope(setFilters, tests, everything)} · ${words}`,
      )}
    onreview={review}
    onagain={() => begin(setFilters)}
    onfilters={() => backToSetup()}
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
