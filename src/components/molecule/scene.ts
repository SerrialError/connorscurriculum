// The ball-and-stick model for <Molecule>: atoms, bonds, lone-pair lobes, and bond-angle arcs.
import { BufferGeometry, Group, Line, Mesh, Quaternion, type Vector3 } from 'three';
import { type Molecule, atomRadius } from '../../lib/molecules';
import { type Kit, Y, across, label, stick, v } from './three-kit';
import { Viewport } from './viewport';

interface Parts {
  model: Group;
  lonePairs: Group;
  angles: Group;
  radius: number;
}

function buildModel(m: Molecule, kit: Kit): Parts {
  const model = new Group();
  const lonePairs = new Group();
  const angles = new Group();
  const pos = m.atoms.map((a) => v(a.pos));

  m.atoms.forEach((a, i) => {
    const mesh = new Mesh(kit.sphere, kit.atom(a.el));
    mesh.scale.setScalar(atomRadius(a.el));
    mesh.position.copy(pos[i]!);
    model.add(mesh);
  });

  for (const b of m.bonds) {
    const from = pos[b.a]!;
    const to = pos[b.b]!;
    if (b.order === 1) {
      model.add(stick(kit, from, to, 0.075));
      continue;
    }
    const off = across(to.clone().sub(from).normalize()).multiplyScalar(0.11);
    const shifts = b.order === 2 ? [-0.5, 0.5] : [-1, 0, 1];
    for (const s of shifts) {
      const o = off.clone().multiplyScalar(s * (b.order === 2 ? 1 : 1.05));
      model.add(stick(kit, from.clone().add(o), to.clone().add(o), 0.052));
    }
  }

  for (const lp of m.lonePairs) {
    const dir = v(lp.dir).normalize();
    const at = pos[lp.atom]!;
    const lobe = new Mesh(kit.sphere, kit.lobe);
    lobe.scale.set(0.27, 0.5, 0.27);
    lobe.quaternion.copy(new Quaternion().setFromUnitVectors(Y, dir));
    lobe.position.copy(at).addScaledVector(dir, 0.58);
    lobe.renderOrder = 1;
    lonePairs.add(lobe);
    const side = across(dir).multiplyScalar(0.085);
    for (const s of [-1, 1]) {
      const dot = new Mesh(kit.sphere, kit.dot);
      dot.scale.setScalar(0.045);
      dot.position.copy(at).addScaledVector(dir, 0.72).addScaledVector(side, s);
      lonePairs.add(dot);
    }
  }

  for (const a of m.angles) {
    const at = pos[a.at]!;
    const u = pos[a.from]!.clone().sub(at).normalize();
    const w = pos[a.to]!.clone().sub(at).normalize();
    const r = 0.68;
    const points: Vector3[] = [];
    const q = new Quaternion();
    const full = new Quaternion().setFromUnitVectors(u, w);
    // A 180° arc has no unique plane; bend it toward the viewer's "up".
    const axis = u.dot(w) < -0.999 ? across(u) : null;
    for (let i = 0; i <= 32; i++) {
      if (axis) q.setFromAxisAngle(axis, (Math.PI * i) / 32);
      else q.identity().slerp(full, i / 32);
      points.push(u.clone().applyQuaternion(q).multiplyScalar(r).add(at));
    }
    angles.add(new Line(new BufferGeometry().setFromPoints(points), kit.arc));
    const mid = points[16]!.clone().sub(at).normalize();
    const tag = label(a.label, 'mol-angle');
    tag.position.copy(at).addScaledVector(mid, r + 0.22);
    angles.add(tag);
  }

  let radius = 0;
  for (const p of pos) radius = Math.max(radius, p.length());
  for (const lp of m.lonePairs) radius = Math.max(radius, pos[lp.atom]!.length() + 0.9);
  return { model, lonePairs, angles, radius: radius + 0.45 };
}

export interface ViewOptions {
  showLonePairs: boolean;
  showAngles: boolean;
}

export class MoleculeView {
  private view: Viewport;
  private parts: Parts | null = null;
  private options: ViewOptions;

  constructor(container: HTMLElement, molecule: Molecule, options: ViewOptions) {
    this.view = new Viewport(container);
    this.options = { ...options };
    this.setMolecule(molecule);
  }

  setMolecule(m: Molecule) {
    this.parts = buildModel(m, this.view.kit);
    const root = new Group().add(this.parts.model, this.parts.lonePairs, this.parts.angles);
    this.apply();
    this.view.show(root, this.parts.radius);
  }

  set(options: Partial<ViewOptions>) {
    Object.assign(this.options, options);
    this.apply();
    this.view.render();
  }

  resetView() {
    this.view.resetView();
  }

  dispose() {
    this.view.dispose();
  }

  private apply() {
    if (!this.parts) return;
    this.parts.lonePairs.visible = this.options.showLonePairs;
    this.parts.angles.visible = this.options.showAngles;
  }
}
