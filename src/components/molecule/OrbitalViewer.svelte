<script lang="ts">
  // Step through how orbitals become bonds, in 3D: pick an example, then a stage. The captions,
  // stage names, and box diagram are plain HTML, so they're there before the 3D model loads.
  import { onMount } from 'svelte';
  import { getOrbitalScene } from '../../lib/orbitals';
  import BoxDiagram from './BoxDiagram.svelte';
  import type { OrbitalView } from './orbital-scene';

  interface Props {
    /** Scene ids from src/lib/orbitals.ts; more than one shows a picker. */
    ids: string[];
    /** Show the orbital box diagram for scenes that have one. */
    boxes?: boolean;
  }

  let { ids, boxes = false }: Props = $props();

  const uid = $props.id();
  const scenes = $derived(ids.map(getOrbitalScene));
  let pick = $state(0);
  let step = $state(0);
  let labels = $state(true);
  let stage: HTMLDivElement;
  let view: OrbitalView | undefined;

  const scene = $derived(scenes[pick] ?? scenes[0]!);
  const current = $derived(scene.stages[Math.min(step, scene.stages.length - 1)]!);

  const LEGEND = [
    { cls: 's', text: 's orbital' },
    { cls: 'p', text: 'p orbital' },
    { cls: 'hybrid', text: 'hybrid orbital' },
    { cls: 'partner', text: "partner atom's orbital" },
    { cls: 'sigma', text: 'σ bond' },
    { cls: 'pi', text: 'π electrons' },
    { cls: 'dot', text: 'electron' },
  ];

  let shownScene = '';
  function draw() {
    if (!view) return;
    view.show(current, labels, shownScene === scene.id);
    shownScene = scene.id;
  }

  onMount(() => {
    let cancelled = false;
    void import('./orbital-scene').then(({ OrbitalView }) => {
      if (cancelled) return;
      view = new OrbitalView(stage);
      draw();
    });
    return () => {
      cancelled = true;
      view?.dispose();
    };
  });

  // `view` isn't reactive: read the state first so this reruns when the stage or labels change.
  $effect(() => {
    void current;
    void labels;
    draw();
  });

  function pickScene(i: number) {
    pick = i;
    step = 0;
  }
</script>

<figure class="mol orbitals">
  {#if scenes.length > 1}
    <div class="examples" role="radiogroup" aria-label="Example">
      {#each scenes as s, i (s.id)}
        <label class="chip"><input type="radio" name="{uid}-scene" checked={pick === i} onchange={() => pickScene(i)} /><span>{s.formula}</span></label>
      {/each}
    </div>
  {/if}
  <ol class="steps" aria-label="Steps">
    {#each scene.stages as s, i (s.title)}
      <li>
        <button type="button" class:on={step === i} aria-pressed={step === i} onclick={() => (step = i)}>
          <span class="n">{i + 1}</span>{s.title}
        </button>
      </li>
    {/each}
  </ol>
  <div
    class="mol-stage"
    bind:this={stage}
    tabindex="0"
    role="group"
    aria-roledescription="3D model"
    aria-label={`${scene.formula}, step ${step + 1}: ${current.title}. Use the arrow keys to turn it.`}
  >
    <span class="mol-hint" aria-hidden="true">Drag to turn</span>
  </div>
  <p class="caption" aria-live="polite"><strong>{scene.formula}, step {step + 1}:</strong> {current.caption}</p>
  <div class="mol-bar">
    <button type="button" class="mol-reset back" disabled={step === 0} onclick={() => step--}>← Back</button>
    <button type="button" class="mol-reset" disabled={step === scene.stages.length - 1} onclick={() => step++}>Next →</button>
    <label class="mol-check"><input type="checkbox" bind:checked={labels} /> Labels</label>
    <button type="button" class="mol-reset" onclick={() => view?.resetView()}>Reset view</button>
  </div>
  <figcaption>
    <ul class="legend" aria-label="Colors">
      {#each LEGEND as item (item.cls)}
        <li><span class={`swatch ${item.cls}`}></span>{item.text}</li>
      {/each}
    </ul>
    {#if boxes && scene.boxes}
      <BoxDiagram el={scene.boxes.el} hybrid={scene.boxes.hybrid} current={current.column} />
    {/if}
  </figcaption>
</figure>

<style>
  .examples {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.7rem 0.8rem 0;
  }
  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
    padding: 0.7rem 0.8rem;
    list-style: none;
  }
  .steps button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.75rem 0.3rem 0.35rem;
    border: 1px solid var(--border);
    border-radius: var(--pill);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .steps button.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--link);
    font-weight: 700;
  }
  .steps .n {
    display: inline-grid;
    place-items: center;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 50%;
    background: var(--surface-2);
    font-size: 0.8rem;
    font-weight: 700;
  }
  .steps button.on .n {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .caption {
    min-height: 4.2em;
    margin: 0;
    padding: 0.6rem 0.8rem;
    border-top: 1px solid var(--border);
    font-size: 0.95rem;
  }
  .mol-reset.back {
    margin-left: 0;
  }
  .mol-reset:disabled {
    opacity: 0.45;
    cursor: default;
  }
  figcaption {
    padding: 0.6rem 0.8rem 0.75rem;
    border-top: 1px solid var(--border);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.9rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.8rem;
    color: var(--text-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .swatch {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    border: 1px solid rgb(0 0 0 / 0.2);
  }
  .swatch.s {
    background: #f0a030;
  }
  .swatch.p {
    background: linear-gradient(90deg, #3b82d6 50%, #1f5aa0 50%);
  }
  .swatch.hybrid {
    background: linear-gradient(90deg, #8a5cd6 70%, #5b3a9e 70%);
  }
  .swatch.partner {
    background: #9aa5b1;
  }
  .swatch.sigma {
    height: 0.3rem;
    border-radius: 2px;
    background: #17a589;
  }
  .swatch.pi {
    background: #e0569b;
    opacity: 0.7;
  }
  .swatch.dot {
    width: 0.45rem;
    height: 0.45rem;
    background: #f5c400;
  }
</style>
