<script lang="ts">
  import { onMount } from 'svelte';
  import { readJson, storageKey, writeJson } from '../lib/storage';

  type Status = 'none' | 'partial' | 'covered';

  interface TopicRow {
    id: string;
    title: string;
    href: string;
    lessons: number;
    questions: number;
    chapters: { number: number; href: string }[];
    status: Status;
  }

  interface Props {
    subject: string;
    units: { id: string; title: string; examWeight?: string; topics: TopicRow[] }[];
  }

  let { subject, units }: Props = $props();

  const key = storageKey(subject, 'known-topics');
  const statusLabel: Record<Status, string> = { none: '○ None', partial: '◐ Partial', covered: '● Covered' };

  let known = $state<Record<string, boolean>>({});
  let gapsOnly = $state(false);
  let saved = $state(true);

  const total = $derived(units.reduce((n, u) => n + u.topics.length, 0));
  const knownCount = $derived(units.reduce((n, u) => n + u.topics.filter((t) => known[t.id]).length, 0));
  const gapCount = $derived(units.reduce((n, u) => n + u.topics.filter((t) => t.status === 'none').length, 0));

  onMount(() => {
    known = readJson<Record<string, boolean>>(key, {});
  });

  function toggle(id: string, value: boolean) {
    known[id] = value;
    saved = writeJson(
      key,
      Object.fromEntries(Object.entries(known).filter(([, v]) => v)),
    );
  }
</script>

<div class="card overview">
  <p>
    <strong>I know {knownCount} of {total} topics</strong>
    <span class="muted small">({total ? Math.round((knownCount / total) * 100) : 0}%)</span>
  </p>
  <progress max={total} value={knownCount} aria-label="Topics marked as known"></progress>
  <label class="opt">
    <input type="checkbox" bind:checked={gapsOnly} />
    Only show topics with no content ({gapCount})
  </label>
  {#if !saved}
    <p class="small notice">Your browser is blocking storage, so checkmarks won't be saved.</p>
  {/if}
</div>

{#each units as unit (unit.id)}
  {@const unitKnown = unit.topics.filter((t) => known[t.id]).length}
  {@const rows = gapsOnly ? unit.topics.filter((t) => t.status === 'none') : unit.topics}
  {#if rows.length > 0}
    <section class="unit">
      <h2>
        Unit {unit.id}: {unit.title}
        {#if unit.examWeight}<span class="badge">{unit.examWeight}</span>{/if}
        <span class="progress small muted">{unitKnown}/{unit.topics.length} known</span>
      </h2>
      <ul class="plain-list rows">
        {#each rows as t (t.id)}
          <li class="row">
            <label class="know" title="I know this">
              <input type="checkbox" checked={!!known[t.id]} onchange={(e) => toggle(t.id, e.currentTarget.checked)} />
              <span class="visually-hidden">I know {t.id} {t.title}</span>
            </label>
            <div class="info">
              <a href={t.href}><span class="num">{t.id}</span> {t.title}</a>
              <div class="small muted meta">
                {t.lessons} lesson{t.lessons === 1 ? '' : 's'} · {t.questions} question{t.questions === 1 ? '' : 's'}
                {#if t.chapters.length}
                  · Ch.
                  {#each t.chapters as c, i (c.number)}{i > 0 ? ', ' : ' '}<a href={c.href}>{c.number}</a>{/each}
                {/if}
              </div>
            </div>
            <span class="badge status {t.status}">{statusLabel[t.status]}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/each}

<style>
  .overview p {
    margin: 0 0 0.4rem;
  }
  progress {
    width: 100%;
    height: 0.6rem;
    accent-color: var(--accent);
  }
  .opt {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.5rem;
    cursor: pointer;
  }
  .unit h2 {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    font-size: 1.15rem;
  }
  .progress {
    margin-left: auto;
    font-weight: 400;
  }
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: start;
    padding: 0.55rem 0;
    border-bottom: 1px solid var(--border);
  }
  .know {
    padding-top: 0.15rem;
    cursor: pointer;
  }
  .know input {
    width: 1.15rem;
    height: 1.15rem;
    accent-color: var(--good);
  }
  .info {
    min-width: 0;
  }
  .num {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .meta {
    margin-top: 0.1rem;
  }
  .status.covered {
    background: var(--good-soft);
    color: var(--good);
    border-color: transparent;
  }
  .status.partial {
    background: var(--warn-soft);
    color: var(--warn);
    border-color: transparent;
  }
</style>
