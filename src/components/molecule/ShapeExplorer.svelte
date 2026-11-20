<script lang="ts">
  // Pick a number of electron domains and lone pairs to see the shape, its names, angles, and
  // hybridization, on a real molecule with that shape.
  import { onMount } from 'svelte';
  import { MOLECULES, SHAPES } from '../../lib/molecules';
  import MoleculeViewer from './MoleculeViewer.svelte';
  import { type ShapePick, onPick, takePick } from './pick';

  // Unique radio-group names, in case a page ever has two explorers.
  const uid = $props.id();
  let domains = $state(4);
  let lonePairs = $state(1);

  const domainCounts = [...new Set(SHAPES.map((s) => s.domains))];
  const lonePairCounts = $derived(SHAPES.filter((s) => s.domains === domains).map((s) => s.lonePairs));
  const shape = $derived(SHAPES.find((s) => s.domains === domains && s.lonePairs === lonePairs) ?? SHAPES.find((s) => s.domains === domains)!);

  /** A "Turn in 3D" link on a shape card picked this shape. */
  function show(p: ShapePick) {
    domains = p.domains;
    lonePairs = p.lonePairs;
  }

  onMount(() => {
    const waiting = takePick();
    if (waiting) show(waiting);
    return onPick(show);
  });

  function pickDomains(n: number) {
    domains = n;
    if (!lonePairCounts.includes(lonePairs)) lonePairs = 0;
  }
</script>

<section class="explorer" aria-label="VSEPR shape explorer">
  <div class="pickers">
    <fieldset>
      <legend>Electron domains on the central atom</legend>
      <div class="chips">
        {#each domainCounts as n (n)}
          <label class="chip"><input type="radio" name="{uid}-domains" checked={domains === n} onchange={() => pickDomains(n)} /><span>{n}</span></label>
        {/each}
      </div>
    </fieldset>
    <fieldset>
      <legend>How many are lone pairs</legend>
      <div class="chips">
        {#each lonePairCounts as n (n)}
          <label class="chip"><input type="radio" name="{uid}-lone-pairs" checked={shape.lonePairs === n} onchange={() => (lonePairs = n)} /><span>{n}</span></label>
        {/each}
      </div>
    </fieldset>
  </div>

  <table class="facts">
    <tbody>
      <tr><th scope="row">Bonding domains</th><td>{shape.domains - shape.lonePairs}</td></tr>
      <tr><th scope="row">Bond angles</th><td>{shape.idealAngles}</td></tr>
      <tr><th scope="row">Hybridization</th><td>{shape.hybridization}</td></tr>
      <tr><th scope="row">Example</th><td>{MOLECULES[shape.example]!.formula}</td></tr>
    </tbody>
  </table>

  <MoleculeViewer id={shape.example} showFormula={false} />
</section>

<style>
  .explorer {
    margin: 1.25rem 0;
    padding: 0.9rem 1rem 0.1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
  }
  .pickers {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 2rem;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 0.35rem;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip span {
    min-width: 1ch;
    text-align: center;
  }
  .facts {
    margin: 0.9rem 0 0;
    font-size: 0.9rem;
  }
  .facts th {
    font-weight: 400;
    color: var(--muted);
    text-align: left;
    padding-right: 1rem;
  }
  .facts td {
    font-weight: 600;
  }
  .explorer :global(.mol) {
    margin-top: 0.75rem;
  }
</style>
