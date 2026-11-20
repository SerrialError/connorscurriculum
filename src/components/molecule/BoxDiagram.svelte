<script lang="ts">
  // Orbital box diagram for a period-2 atom: ground state → (promotion) → hybridized. Higher
  // energy is higher up: 2p on top, 2s at the bottom, hybrids in between.
  import { type BoxColumnKind, type BoxElement, boxDiagram } from '../../lib/orbitals';

  interface Props {
    el: BoxElement;
    hybrid: 1 | 2 | 3;
    /** The column to highlight, to match the 3D stage showing. */
    current?: BoxColumnKind;
  }

  let { el, hybrid, current }: Props = $props();

  const columns = $derived(boxDiagram(el, hybrid));
  /** Ground state is first, hybridized last, and promotion (when there is one) in between. */
  const kindOf = (i: number): BoxColumnKind => (i === 0 ? 'ground' : i === columns.length - 1 ? 'hybrid' : 'promoted');
  /** Grid row for an energy level: 2p on top, hybrids in the middle, 2s at the bottom. */
  const row = (name: string) => (name === '2p' ? 1 : name === '2s' ? 3 : 2);
  const arrows = (e: number) => (e === 2 ? '↑↓' : e === 1 ? '↑' : '');
  const describe = (e: number) => (e === 2 ? 'two electrons' : e === 1 ? 'one electron' : 'empty');
  /** "2p_y" as plain text ("2py"), for tooltips and screen readers. */
  const plain = (name: string) => name.replace('_', '');
</script>

<figure class="boxes" aria-label={`Orbital box diagram for ${el}`}>
  <div class="cols">
    {#each columns as col, i (col.title)}
      {#if i > 0}<span class="step" aria-hidden="true">→</span>{/if}
      <div class="col" class:on={current === kindOf(i)}>
        <p class="col-title">{col.title}</p>
        <div class="levels">
          {#each col.levels as level (level.name)}
            <div class="level" style:grid-row={row(level.name)}>
              <span class="level-name">{level.name}</span>
              <span class="row">
                {#each level.boxes as box, j (j)}
                  <span class="box" title={`${plain(box.name)}: ${describe(box.electrons)}`}>
                    <span aria-hidden="true">{arrows(box.electrons)}</span>
                    <span class="visually-hidden">{plain(box.name)}, {describe(box.electrons)}</span>
                  </span>
                {/each}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
  <figcaption class="small muted">
    {el}: higher boxes are higher in energy. Each arrow is one electron; a pair has opposite spins. Class only:
    the AP exam doesn't ask for these diagrams.
  </figcaption>
</figure>

<style>
  .boxes {
    margin: 0.75rem 0 0;
  }
  .cols {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 0.5rem;
  }
  .step {
    align-self: center;
    color: var(--muted);
    font-size: 1.2rem;
  }
  .col {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }
  .col.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }
  .col-title {
    margin: 0 0 0.35rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-2);
  }
  .levels {
    display: grid;
    grid-template-rows: repeat(3, 2.2rem);
    gap: 0.15rem;
  }
  .level {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .level-name {
    min-width: 2rem;
    font-size: 0.8rem;
    color: var(--muted);
    text-align: right;
  }
  .row {
    display: inline-flex;
    gap: 0.2rem;
  }
  .box {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 1.9rem;
    border: 1.5px solid var(--text-2);
    border-radius: 3px;
    font-weight: 700;
    letter-spacing: -0.05em;
  }
  figcaption {
    margin-top: 0.35rem;
  }
</style>
