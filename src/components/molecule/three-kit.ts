// Shared three.js pieces for the 3D viewers: one Kit of shapes and materials per view, plus small
// helpers for sticks, labels, and freeing GPU memory.
import {
  CylinderGeometry,
  Line,
  LineBasicMaterial,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ELEMENT_COLORS, type Vec } from '../../lib/molecules';

export const Y = new Vector3(0, 1, 0);
export const v = (p: Vec) => new Vector3(...p);

/** Shapes and materials for one view. Each view owns its own, so freeing them can't affect another. */
export class Kit {
  sphere = new SphereGeometry(1, 40, 28);
  cylinder = new CylinderGeometry(1, 1, 1, 20);
  bond = new MeshStandardMaterial({ color: '#a3a9ad', roughness: 0.5 });
  lobe = new MeshStandardMaterial({ color: '#8a74e8', roughness: 0.6, transparent: true, opacity: 0.38, depthWrite: false });
  dot = new MeshStandardMaterial({ color: '#5b3fa6', roughness: 0.5 });
  arc = new LineBasicMaterial({ color: '#2f8fb3' });
  private atoms = new Map<string, MeshStandardMaterial>();
  private tints = new Map<string, MeshStandardMaterial>();

  atom(el: string) {
    let m = this.atoms.get(el);
    if (!m) this.atoms.set(el, (m = new MeshStandardMaterial({ color: ELEMENT_COLORS[el] ?? '#c0c0c0', roughness: 0.42, metalness: 0.05 })));
    return m;
  }

  /** A see-through material for orbital lobes and electron clouds. */
  tint(color: string, opacity = 0.5) {
    const key = `${color}/${opacity}`;
    let m = this.tints.get(key);
    if (!m) this.tints.set(key, (m = new MeshStandardMaterial({ color, roughness: 0.55, transparent: true, opacity, depthWrite: false })));
    return m;
  }
}

/**
 * Frees the GPU copies of everything under `root`. The objects stay usable: a renderer uploads them
 * again when it next draws them. Disposing also drops the old renderer's listeners on them, which
 * would otherwise keep each closed renderer in memory.
 */
export function release(root: Object3D) {
  root.traverse((o) => {
    if (o instanceof Mesh || o instanceof Line) {
      o.geometry.dispose();
      (o.material as Material).dispose();
    }
  });
}

/** Removes the HTML labels under `root` from the page. */
export function removeLabels(root: Object3D) {
  root.traverse((o) => {
    if (o instanceof CSS2DObject) o.element.remove();
  });
}

/** A cylinder from `from` to `to`. */
export function stick(kit: Kit, from: Vector3, to: Vector3, radius: number, material: Material = kit.bond): Mesh {
  const mesh = new Mesh(kit.cylinder, material);
  const dir = to.clone().sub(from);
  mesh.scale.set(radius, dir.length(), radius);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(Y, dir.normalize()));
  return mesh;
}

/** A direction at right angles to `dir`, in the plane of the page where possible. */
export function across(dir: Vector3): Vector3 {
  const ref = Math.abs(dir.z) > 0.9 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
  return dir.clone().cross(ref).normalize();
}

/** An HTML label that follows a point in the scene. */
export function label(text: string, className: string): CSS2DObject {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return new CSS2DObject(el);
}
