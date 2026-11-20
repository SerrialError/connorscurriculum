// The three.js side of the molecule viewer: builds a ball-and-stick model and renders it into a
// container. A WebGL context only exists while the container is on screen, because browsers allow
// about 16 at once and a lesson can hold more models than that.
import {
  AmbientLight,
  BufferGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SphereGeometry,
  Spherical,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ELEMENT_COLORS, type Molecule, type Vec, atomRadius } from '../../lib/molecules';

const Y = new Vector3(0, 1, 0);
const v = (p: Vec) => new Vector3(...p);

/** The default view: a little above and to the right, so depth is visible. */
const START = { polar: (72 * Math.PI) / 180, azimuth: (20 * Math.PI) / 180 };
const FOV = 32;

const sphere = new SphereGeometry(1, 40, 28);
const cylinder = new CylinderGeometry(1, 1, 1, 20);
const bondMaterial = new MeshStandardMaterial({ color: '#a3a9ad', roughness: 0.5 });
const lobeMaterial = new MeshStandardMaterial({
  color: '#8a74e8',
  roughness: 0.6,
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
});
const dotMaterial = new MeshStandardMaterial({ color: '#5b3fa6', roughness: 0.5 });
const atomMaterials = new Map<string, MeshStandardMaterial>();
function atomMaterial(el: string) {
  let m = atomMaterials.get(el);
  if (!m) atomMaterials.set(el, (m = new MeshStandardMaterial({ color: ELEMENT_COLORS[el] ?? '#c0c0c0', roughness: 0.42, metalness: 0.05 })));
  return m;
}

function stick(from: Vector3, to: Vector3, radius: number): Mesh {
  const mesh = new Mesh(cylinder, bondMaterial);
  const dir = to.clone().sub(from);
  mesh.scale.set(radius, dir.length(), radius);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(Y, dir.normalize()));
  return mesh;
}

/** A direction at right angles to `dir`, in the plane of the page where possible. */
function across(dir: Vector3): Vector3 {
  const ref = Math.abs(dir.z) > 0.9 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
  return dir.clone().cross(ref).normalize();
}

function label(text: string, className: string): CSS2DObject {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return new CSS2DObject(el);
}

export interface Parts {
  model: Group;
  lonePairs: Group;
  angles: Group;
  radius: number;
}

export function buildModel(m: Molecule): Parts {
  const model = new Group();
  const lonePairs = new Group();
  const angles = new Group();
  const pos = m.atoms.map((a) => v(a.pos));

  m.atoms.forEach((a, i) => {
    const mesh = new Mesh(sphere, atomMaterial(a.el));
    mesh.scale.setScalar(atomRadius(a.el));
    mesh.position.copy(pos[i]!);
    model.add(mesh);
  });

  for (const b of m.bonds) {
    const from = pos[b.a]!;
    const to = pos[b.b]!;
    if (b.order === 1) {
      model.add(stick(from, to, 0.075));
      continue;
    }
    const off = across(to.clone().sub(from).normalize()).multiplyScalar(0.11);
    const shifts = b.order === 2 ? [-0.5, 0.5] : [-1, 0, 1];
    for (const s of shifts) {
      const o = off.clone().multiplyScalar(s * (b.order === 2 ? 1 : 1.05));
      model.add(stick(from.clone().add(o), to.clone().add(o), 0.052));
    }
  }

  for (const lp of m.lonePairs) {
    const dir = v(lp.dir).normalize();
    const at = pos[lp.atom]!;
    const lobe = new Mesh(sphere, lobeMaterial);
    lobe.scale.set(0.27, 0.5, 0.27);
    lobe.quaternion.copy(new Quaternion().setFromUnitVectors(Y, dir));
    lobe.position.copy(at).addScaledVector(dir, 0.58);
    lobe.renderOrder = 1;
    lonePairs.add(lobe);
    const side = across(dir).multiplyScalar(0.085);
    for (const s of [-1, 1]) {
      const dot = new Mesh(sphere, dotMaterial);
      dot.scale.setScalar(0.045);
      dot.position.copy(at).addScaledVector(dir, 0.72).addScaledVector(side, s);
      lonePairs.add(dot);
    }
  }

  const arcMaterial = new LineBasicMaterial({ color: '#2f8fb3' });
  for (const a of m.angles) {
    const at = pos[a.at]!;
    const u = pos[a.from]!.clone().sub(at).normalize();
    const w = pos[a.to]!.clone().sub(at).normalize();
    const r = 0.68;
    const points: Vector3[] = [];
    const q = new Quaternion();
    const full = new Quaternion().setFromUnitVectors(u, w);
    // A 180° arc has no unique plane; bend it toward the viewer's "up".
    const straight = u.dot(w) < -0.999;
    const axis = straight ? across(u) : null;
    for (let i = 0; i <= 32; i++) {
      if (axis) q.setFromAxisAngle(axis, (Math.PI * i) / 32);
      else q.identity().slerp(full, i / 32);
      points.push(u.clone().applyQuaternion(q).multiplyScalar(r).add(at));
    }
    angles.add(new Line(new BufferGeometry().setFromPoints(points), arcMaterial));
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
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 4 / 3, 0.1, 100);
  private parts: Parts | null = null;
  private renderer: WebGLRenderer | null = null;
  private labels: CSS2DRenderer | null = null;
  private controls: OrbitControls | null = null;
  private visible = new IntersectionObserver((entries) => this.onVisible(entries.at(-1)!.isIntersecting), { rootMargin: '200px' });
  private resize = new ResizeObserver(() => this.fit());
  private options: ViewOptions;

  constructor(
    private container: HTMLElement,
    molecule: Molecule,
    options: ViewOptions,
  ) {
    this.options = { ...options };
    this.scene.add(new AmbientLight('#ffffff', 1.1));
    const key = new DirectionalLight('#ffffff', 2.2);
    key.position.set(2, 3, 4);
    // The light moves with the camera, so the model is always lit from the front.
    this.camera.add(key);
    this.scene.add(this.camera);
    this.setMolecule(molecule);
    this.visible.observe(container);
    this.resize.observe(container);
    container.addEventListener('keydown', this.onKey);
  }

  setMolecule(m: Molecule) {
    if (this.parts) this.scene.remove(this.parts.model, this.parts.lonePairs, this.parts.angles);
    this.disposeLabels(this.parts?.angles);
    this.parts = buildModel(m);
    this.scene.add(this.parts.model, this.parts.lonePairs, this.parts.angles);
    this.apply();
    this.resetView();
  }

  set(options: Partial<ViewOptions>) {
    Object.assign(this.options, options);
    this.apply();
    this.render();
  }

  resetView() {
    if (!this.parts) return;
    const dist = this.parts.radius / Math.sin(((FOV / 2) * Math.PI) / 180);
    this.camera.position.setFromSpherical(new Spherical(dist, START.polar, START.azimuth));
    this.camera.lookAt(0, 0, 0);
    this.controls?.update();
    this.render();
  }

  /** Turn the view by the given angles (radians), as the arrow keys do. */
  rotate(dAzimuth: number, dPolar: number) {
    const s = new Spherical().setFromVector3(this.camera.position);
    s.theta += dAzimuth;
    s.phi = Math.min(Math.PI - 0.05, Math.max(0.05, s.phi + dPolar));
    this.camera.position.setFromSpherical(s);
    this.camera.lookAt(0, 0, 0);
    this.controls?.update();
    this.render();
  }

  dispose() {
    this.visible.disconnect();
    this.resize.disconnect();
    this.container.removeEventListener('keydown', this.onKey);
    this.stop();
    this.disposeLabels(this.parts?.angles);
  }

  private apply() {
    if (!this.parts) return;
    this.parts.lonePairs.visible = this.options.showLonePairs;
    this.parts.angles.visible = this.options.showAngles;
  }

  private disposeLabels(group?: Object3D) {
    group?.traverse((o) => {
      if (o instanceof CSS2DObject) o.element.remove();
    });
  }

  private onKey = (e: KeyboardEvent) => {
    const step = Math.PI / 18;
    const turns: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const turn = turns[e.key];
    if (!turn) return;
    e.preventDefault();
    this.rotate(...turn);
  };

  private onVisible(onScreen: boolean) {
    if (onScreen && !this.renderer) this.start();
    else if (!onScreen && this.renderer) this.stop();
  }

  private start() {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = 'mol-canvas';
    this.container.append(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.className = 'mol-labels';
    this.container.append(labels.domElement);
    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.rotateSpeed = 0.8;
    // Let a vertical swipe on a phone scroll the page; a sideways drag still turns the model.
    renderer.domElement.style.touchAction = 'pan-y';
    controls.addEventListener('change', () => this.render());
    this.renderer = renderer;
    this.labels = labels;
    this.controls = controls;
    this.fit();
  }

  private stop() {
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
    this.labels?.domElement.remove();
    this.renderer = null;
    this.labels = null;
    this.controls = null;
  }

  private fit() {
    if (!this.renderer || !this.labels) return;
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    // Keep the whole model in view in a narrow box too.
    this.camera.zoom = Math.min(1, w / h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.render();
  }

  private render() {
    if (!this.renderer || !this.labels) return;
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
}
