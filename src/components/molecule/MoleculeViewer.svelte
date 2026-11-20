<script lang="ts">
  // A ball-and-stick model you can turn: drag (or use the arrow keys) to rotate. The caption
  // and controls are plain HTML, so the geometry names are there before the 3D model loads.
  import { onMount } from 'svelte';
  import { ELEMENT_COLORS, getMolecule } from '../../lib/molecules';
  import type { MoleculeView } from './scene';

  interface Props {
    id: string;
    /** Show the formula in the caption (the shape explorer has its own heading). */
    showFormula?: boolean;
  }

  let { id, showFormula = true }: Props = $props();

  const NAMES: Record<string, string> = {
    H: 'hydrogen', Be: 'beryllium', B: 'boron', C: 'carbon', N: 'nitrogen', O: 'oxygen', F: 'fluorine', Si: 'silicon',
    P: 'phosphorus', S: 'sulfur', Cl: 'chlorine', Se: 'selenium', Br: 'bromine', I: 'iodine', Xe: 'xenon',
  };

  let mode = $state<'domains' | 'atoms'>('domains');
  let showAngles = $state(true);
  let stage: HTMLDivElement;
  let view: MoleculeView | undefined;

  const molecule = $derived(getMolecule(id));
  const hasLonePairs = $derived(molecule.lonePairs.length > 0);
  const elements = $derived([...new Set(molecule.atoms.map((a) => a.el))]);
  const description = $derived(
    `3D model of ${molecule.formula}: ${molecule.domainGeometry} electron-domain geometry, ${molecule.molecularGeometry} molecular geometry. Use the arrow keys to turn it.`,
  );

  onMount(() => {
    let cancelled = false;
    // three.js is only downloaded once a model is on the page.
    void import('./scene').then(({ MoleculeView }) => {
      if (cancelled) return;
      view = new MoleculeView(stage, molecule, { showLonePairs: mode === 'domains', showAngles });
    });
    return () => {
      cancelled = true;
      view?.dispose();
    };
  });

  // `view` isn't reactive, so read the state first: these then rerun when the molecule or a
  // control changes. The view is created with the values current at that time.
  $effect(() => {
    const m = molecule;
    view?.setMolecule(m);
  });
  $effect(() => {
    const options = { showLonePairs: mode === 'domains', showAngles };
    view?.set(options);
  });
</script>

<figure class="mol">
  <div class="mol-stage" bind:this={stage} tabindex="0" role="group" aria-roledescription="3D model" aria-label={description}>
    <span class="mol-hint" aria-hidden="true">Drag to turn</span>
  </div>
  <div class="mol-bar">
    {#if hasLonePairs}
      <div class="mol-seg" role="radiogroup" aria-label="What to show">
        <label class:on={mode === 'domains'}>
          <input type="radio" bind:group={mode} value="domains" /> Electron domains
        </label>
        <label class:on={mode === 'atoms'}>
          <input type="radio" bind:group={mode} value="atoms" /> Atoms only
        </label>
      </div>
    {/if}
    <label class="mol-check"><input type="checkbox" bind:checked={showAngles} /> Bond angles</label>
    <button type="button" class="mol-reset" onclick={() => view?.resetView()}>Reset view</button>
  </div>
  <figcaption>
    {#if showFormula}<p class="mol-formula">{molecule.formula}</p>{/if}
    <dl class="mol-names">
      <div class:on={hasLonePairs && mode === 'domains'}>
        <dt>Electron-domain geometry</dt>
        <dd>{molecule.domainGeometry}</dd>
      </div>
      <div class:on={hasLonePairs && mode === 'atoms'}>
        <dt>Molecular geometry</dt>
        <dd>{molecule.molecularGeometry}</dd>
      </div>
    </dl>
    {#if !hasLonePairs && molecule.atoms.length > 2}
      <p class="mol-note">No lone pairs on the central atom, so both geometries are the same.</p>
    {:else if hasLonePairs}
      <p class="mol-note">The purple lobes are lone pairs. They count as electron domains but aren't part of the molecular geometry.</p>
    {/if}
    {#if molecule.note}<p class="mol-note">{molecule.note}</p>{/if}
    <ul class="mol-key" aria-label="Atom colors">
      {#each elements as el (el)}
        <li><span class="swatch" style:background={ELEMENT_COLORS[el]}></span>{NAMES[el] ?? el}</li>
      {/each}
    </ul>
  </figcaption>
</figure>

<style>
  .mol {
    margin: 1.25rem 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
  }
  .mol-stage {
    position: relative;
    height: clamp(15rem, 62vw, 21rem);
    background: radial-gradient(circle at 50% 45%, var(--surface) 0%, var(--surface-2) 100%);
    cursor: grab;
    outline-offset: -3px;
  }
  .mol-stage:active {
    cursor: grabbing;
  }
  .mol-stage :global(.mol-canvas) {
    display: block;
  }
  .mol-stage :global(.mol-labels) {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .mol-stage :global(.mol-angle) {
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
    background: color-mix(in srgb, var(--surface) 85%, transparent);
    color: var(--link);
    font-size: 0.8rem;
    font-weight: 700;
    white-space: nowrap;
  }
  .mol-hint {
    position: absolute;
    right: 0.6rem;
    bottom: 0.45rem;
    z-index: 1;
    font-size: 0.75rem;
    color: var(--muted);
    pointer-events: none;
  }
  .mol-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
    padding: 0.55rem 0.8rem;
    border-top: 1px solid var(--border);
    font-size: 0.875rem;
  }
  .mol-seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--pill);
    overflow: hidden;
  }
  .mol-seg label {
    padding: 0.25rem 0.75rem;
    cursor: pointer;
    color: var(--text-2);
  }
  .mol-seg label.on {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }
  .mol-seg label:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .mol-seg input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .mol-check {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
  }
  .mol-reset {
    margin-left: auto;
    padding: 0.25rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--pill);
    background: transparent;
    color: var(--link);
    font: inherit;
    cursor: pointer;
  }
  .mol-reset:hover {
    background: var(--surface-2);
  }
  figcaption {
    padding: 0.6rem 0.8rem 0.75rem;
    border-top: 1px solid var(--border);
    font-size: 0.9rem;
  }
  figcaption p {
    margin: 0 0 0.4rem;
  }
  .mol-formula {
    font-weight: 700;
    font-size: 1rem;
  }
  .mol-names {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.4rem;
    margin: 0 0 0.5rem;
  }
  .mol-names div {
    padding: 0.3rem 0.55rem;
    border-left: 3px solid var(--border);
  }
  .mol-names div.on {
    border-left-color: var(--accent);
    background: var(--accent-soft);
  }
  .mol-names dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .mol-names dd {
    margin: 0;
    font-weight: 600;
  }
  .mol-note {
    color: var(--text-2);
  }
  .mol-key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.9rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.8rem;
    color: var(--text-2);
  }
  .mol-key li {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .swatch {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    border: 1px solid rgb(0 0 0 / 0.25);
  }
</style>
