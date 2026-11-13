<script lang="ts">
  // Released AP FRQs on the topics of the current filters (setup) or set (results).
  import { type FrqLink, frqCountLabel, frqName, frqPractices, frqTotal, matchFrqs, readinessLabel, readyPoints } from '../../lib/frqs';
  import { plural } from '../../lib/text';

  interface Props {
    matches: ReturnType<typeof matchFrqs>;
    /** Topics learned this year or last year, for readiness. */
    learned: ReadonlySet<string>;
    frqsHref: string;
    /** Science practice id ("5") -> name ("Mathematical Routines") */
    practiceNames: Record<string, string>;
  }

  let { matches, learned, frqsHref, practiceNames }: Props = $props();
  const key = (f: FrqLink) => f.year * 10 + f.number;
</script>

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
      {#each matches as m (key(m.frq))}
        {@const ready = readinessLabel(readyPoints(m.frq, (t) => learned.has(t)), frqTotal(m.frq))}
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

<style>
  .past-frqs {
    margin: 1rem 0 0;
  }
  summary {
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
  li {
    padding: 0.45rem 0;
    border-top: 1px solid var(--border);
  }
</style>
