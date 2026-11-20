// Draws one stage of an orbital scene (src/lib/orbitals.ts): atoms, orbital lobes with their
// electrons, σ bonds as sticks, and π electron clouds.
import { CapsuleGeometry, Group, LatheGeometry, Mesh, type Object3D, Quaternion, TorusGeometry, Vector2, Vector3 } from 'three';
import type { OrbitalRole, OrbitalShape, OrbitalType, Stage } from '../../lib/orbitals';
import { type Kit, Y, across, label, stick, v } from './three-kit';
import { Viewport } from './viewport';

/** Lobe colors: the big lobe, then the small (opposite-phase) lobe. */
export const ORBITAL_COLORS: Record<OrbitalRole, [string, string]> = {
  s: ['#f0a030', '#f0a030'],
  p: ['#3b82d6', '#1f5aa0'],
  hybrid: ['#8a5cd6', '#5b3a9e'],
  partner: ['#9aa5b1', '#6b7680'],
};
export const SIGMA_COLOR = '#17a589';
export const PI_COLOR = '#e0569b';

/** Electrons: yellow reads on the lobes and on both page themes. */
export const DOT = '#f5c400';

/**
 * The outline of a lobe, as points to spin around the y-axis. The shape is the square of the
 * angular part of the orbital: for spⁿ, (1 + √(3n)·cos θ)², which gives one big lobe and a small
 * one behind it; for p, cos²θ, two equal lobes. Returns the big lobe and the small one.
 */
function lobeOutlines(type: Exclude<OrbitalType, 's'>): [Vector2[], Vector2[]] {
  const b = type === 'p' ? Infinity : Math.sqrt(3 * type);
  const f = (t: number) => (type === 'p' ? Math.cos(t) : 1 + b * Math.cos(t));
  const max = f(0) ** 2;
  const zero = type === 'p' ? Math.PI / 2 : Math.acos(-1 / b);
  const curve = (from: number, to: number) =>
    Array.from({ length: 41 }, (_, i) => {
      const t = from + ((to - from) * i) / 40;
      const r = f(t) ** 2 / max;
      return new Vector2(Math.abs(r * Math.sin(t)), r * Math.cos(t));
    });
  return [curve(0, zero), curve(zero, Math.PI)];
}

const outlines = new Map<OrbitalType, [Vector2[], Vector2[]]>();
function outlinesFor(type: Exclude<OrbitalType, 's'>) {
  let o = outlines.get(type);
  if (!o) outlines.set(type, (o = lobeOutlines(type)));
  return o;
}

function addDots(group: Group, kit: Kit, center: Vector3, side: Vector3, count: number) {
  const offsets = count === 2 ? [-1, 1] : [0];
  for (const s of offsets) {
    const dot = new Mesh(kit.sphere, kit.tint(DOT, 1));
    dot.scale.setScalar(0.045);
    dot.position.copy(center).addScaledVector(side, s * 0.08);
    group.add(dot);
  }
}

function drawOrbital(o: OrbitalShape, kit: Kit, labels: boolean): Object3D {
  const g = new Group();
  const atPos = v(o.at);
  const dir = v(o.dir).normalize();
  const size = o.size ?? 1;
  const faint = o.electrons === 'empty';
  const [front, back] = ORBITAL_COLORS[o.role];
  const opacity = faint ? 0.13 : 0.45;
  if (o.type === 's') {
    const ball = new Mesh(kit.sphere, kit.tint(front, faint ? 0.13 : 0.35));
    ball.scale.setScalar(size);
    ball.position.copy(atPos);
    g.add(ball);
  } else {
    const [big, small] = outlinesFor(o.type);
    const turn = new Quaternion().setFromUnitVectors(Y, dir);
    for (const [shape, color] of [
      [big, front],
      [small, back],
    ] as const) {
      const mesh = new Mesh(new LatheGeometry(shape, 36), kit.tint(color, opacity));
      mesh.scale.setScalar(size);
      mesh.quaternion.copy(turn);
      mesh.position.copy(atPos);
      g.add(mesh);
    }
  }
  if (typeof o.electrons === 'number' && o.electrons > 0) {
    // s orbitals: the dots sit near the nucleus; lobes: out in the big lobe.
    const reach = o.type === 's' ? 0.35 * size : 0.62 * size;
    addDots(g, kit, atPos.clone().addScaledVector(dir, reach), across(dir), o.electrons);
  }
  if (labels && o.label) {
    const tag = label(o.label, 'orb-label');
    tag.position.copy(atPos).addScaledVector(dir, (o.type === 's' ? size : size * 1.02) + 0.18);
    g.add(tag);
  }
  return g;
}

/**
 * π electron density on both sides of each segment. A closed ring of segments (benzene) becomes a
 * smooth doughnut above and below the ring.
 */
function drawCloud(segments: [Vector3, Vector3][], normal: Vector3, kit: Kit): Group {
  const g = new Group();
  const material = kit.tint(PI_COLOR, 0.42);
  const r = 0.2;
  const lift = 0.42;
  const closed = segments.length > 2 && segments[0]![0].distanceTo(segments.at(-1)![1]) < 1e-6;
  if (closed) {
    const center = segments.reduce((c, [p]) => c.add(p), new Vector3()).multiplyScalar(1 / segments.length);
    const radius = segments[0]![0].distanceTo(center);
    const turn = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
    for (const side of [1, -1]) {
      const ring = new Mesh(new TorusGeometry(radius, r * 1.15, 16, 64), material);
      ring.quaternion.copy(turn);
      ring.position.copy(center).addScaledVector(normal, side * lift);
      g.add(ring);
    }
    return g;
  }
  for (const [a, b] of segments) {
    const dir = b.clone().sub(a).normalize();
    for (const side of [1, -1]) {
      const mesh = new Mesh(new CapsuleGeometry(r, a.distanceTo(b), 6, 16), material);
      mesh.quaternion.copy(new Quaternion().setFromUnitVectors(Y, dir));
      mesh.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(normal, side * lift);
      g.add(mesh);
    }
  }
  return g;
}

export function buildStage(stage: Stage, kit: Kit, labels: boolean): { group: Group; radius: number } {
  const group = new Group();
  let radius = 0;
  const reach = (p: Vector3, extra: number) => (radius = Math.max(radius, p.length() + extra));
  for (const s of stage.shapes) {
    if (s.kind === 'atom') {
      const mesh = new Mesh(kit.sphere, kit.atom(s.el));
      mesh.scale.setScalar(s.el === 'H' ? 0.12 : 0.17);
      mesh.position.copy(v(s.at));
      group.add(mesh);
      reach(mesh.position, 0.3);
    } else if (s.kind === 'orbital') {
      group.add(drawOrbital(s, kit, labels));
      reach(v(s.at), (s.size ?? 1) + 0.3);
    } else if (s.kind === 'sigma') {
      const a = v(s.from);
      const b = v(s.to);
      group.add(stick(kit, a, b, 0.05, kit.tint(SIGMA_COLOR, 1)));
      if (labels && s.label) {
        const tag = label(s.label, 'orb-label sigma');
        const side = across(b.clone().sub(a).normalize());
        tag.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(side, 0.22);
        group.add(tag);
      }
    } else if (s.kind === 'cloud') {
      const segs = s.segments.map(([a, b]): [Vector3, Vector3] => [v(a), v(b)]);
      const normal = v(s.normal).normalize();
      group.add(drawCloud(segs, normal, kit));
      if (labels && s.label) {
        const center = segs.reduce((c, [a, b]) => c.add(a).add(b), new Vector3()).multiplyScalar(1 / (2 * segs.length));
        const tag = label(s.label, 'orb-label pi');
        tag.position.copy(center).addScaledVector(normal, 0.95);
        group.add(tag);
      }
    } else {
      const tag = label(s.text, 'orb-label');
      tag.position.copy(v(s.at));
      group.add(tag);
    }
  }
  return { group, radius: radius + 0.2 };
}

/** A viewer for one orbital scene, showing one stage at a time. */
export class OrbitalView {
  private view: Viewport;

  constructor(container: HTMLElement) {
    this.view = new Viewport(container);
  }

  /** Shows a stage. `sameScene`: a step within the scene that's showing, so the camera stays put. */
  show(stage: Stage, labels: boolean, sameScene: boolean) {
    const { group, radius } = buildStage(stage, this.view.kit, labels);
    this.view.show(group, Math.max(radius, 1.5), sameScene);
  }

  resetView() {
    this.view.resetView();
  }

  dispose() {
    this.view.dispose();
  }
}
