<script lang="ts">
  // "Your practice history": how much has been answered on this device, the weakest topics with a
  // one-tap set for each, and clearing it all (with a confirmation).
  import type { PracticeStart } from '../../lib/practice/links';
  import type { Filters } from '../../lib/practice/types';
  import { plural } from '../../lib/text';
  import { getCourse } from './context';

  interface Props {
    /** Questions answered on this device. */
    count: number;
    /** [topic id, recent accuracy 0–1], weakest first. */
    weakSpots: [string, number][];
    /** The set to start on a topic, as practice links elsewhere start it. */
    topicStart: (topic: string) => PracticeStart;
    onstart: (f: Filters) => void;
    onclear: () => void;
  }

  let { count, weakSpots, topicStart, onstart, onclear }: Props = $props();
  const { hrefs, topicLabel } = getCourse();
  let confirming = $state(false);
</script>

<section class="card history" aria-labelledby="history-h">
  <h2 id="history-h" class="section-h">Your practice history</h2>
  <p class="small muted">
    {plural(count, 'question')} answered on this device.
    {weakSpots.length > 0 ? 'Topics to work on:' : 'No weak topics so far.'}
  </p>
  {#if weakSpots.length > 0}
    <ul class="plain-list weak">
      {#each weakSpots as [topic, acc] (topic)}
        {@const start = topicStart(topic)}
        <li>
          <a class="w-topic" href={`${hrefs.topics}${topic}/`}>{topicLabel(topic)}</a>
          <span class="small muted">{Math.round(acc * 100)}% recently</span>
          <button type="button" class="link-button small" onclick={() => onstart(start.filters)}>
            {start.label}<span class="visually-hidden"> on {topicLabel(topic)}</span> →
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if confirming}
    <div class="confirm" role="group" aria-label="Clear history">
      <span class="small">Clear your practice history on this device? This can't be undone.</span>
      <button type="button" class="button small danger" onclick={() => onclear()}>Clear history</button>
      <button type="button" class="button secondary small" onclick={() => (confirming = false)}>Cancel</button>
    </div>
  {:else}
    <button type="button" class="link-button small clear" onclick={() => (confirming = true)}>Clear history</button>
  {/if}
</section>

<style>
  .history {
    margin-top: 1rem;
  }
  p {
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
  .clear {
    color: var(--muted);
    font-weight: 500;
  }
  .confirm {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    background: var(--bad-soft);
  }
  .danger {
    background: var(--bad);
    border-color: var(--bad);
    color: var(--surface);
  }
</style>
