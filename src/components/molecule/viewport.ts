// The part every 3D viewer shares: a camera you turn by dragging or with the arrow keys, and a
// WebGL renderer that only exists while the container is on screen. Browsers allow about 16
// WebGL contexts at once and a lesson can hold more viewers than that.
import { AmbientLight, DirectionalLight, type Object3D, PerspectiveCamera, Scene, Spherical, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Kit, release, removeLabels } from './three-kit';

/** The default view: a little above and to the right, so depth is visible. */
const START = { polar: (64 * Math.PI) / 180, azimuth: (20 * Math.PI) / 180 };
const FOV = 32;

export class Viewport {
  readonly kit = new Kit();
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 4 / 3, 0.1, 100);
  private content: Object3D | null = null;
  private radius = 1;
  private renderer: WebGLRenderer | null = null;
  private labels: CSS2DRenderer | null = null;
  private controls: OrbitControls | null = null;
  private visible = new IntersectionObserver((entries) => this.onVisible(entries.at(-1)!.isIntersecting), { rootMargin: '200px' });
  private resize = new ResizeObserver(() => this.fit());

  constructor(private container: HTMLElement) {
    this.scene.add(new AmbientLight('#ffffff', 1.1));
    const key = new DirectionalLight('#ffffff', 2.2);
    key.position.set(2, 3, 4);
    // The light moves with the camera, so the model is always lit from the front.
    this.camera.add(key);
    this.scene.add(this.camera);
    this.visible.observe(container);
    this.resize.observe(container);
    container.addEventListener('keydown', this.onKey);
  }

  /**
   * Shows `content`, sized to fit a sphere of `radius` around the origin, in place of what was
   * there. `keepView` keeps the current camera angle (stepping through stages of one model).
   */
  show(content: Object3D, radius: number, keepView = false) {
    if (this.content) {
      this.scene.remove(this.content);
      removeLabels(this.content);
      // Shapes made for this content go; the kit's shared shapes and materials stay for the next.
      release(this.content, this.kit);
    }
    this.content = content;
    this.scene.add(content);
    const sameSize = Math.abs(radius - this.radius) < 1e-6;
    this.radius = radius;
    if (keepView && sameSize) this.render();
    else if (keepView) this.fitDistance();
    else this.resetView();
  }

  resetView() {
    this.camera.position.setFromSpherical(new Spherical(this.distance(), START.polar, START.azimuth));
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
    // The controls' change event re-renders; without controls (off screen) there's nothing to draw.
    this.controls?.update();
  }

  render() {
    if (!this.renderer || !this.labels) return;
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  dispose() {
    this.visible.disconnect();
    this.resize.disconnect();
    this.container.removeEventListener('keydown', this.onKey);
    this.stop();
    if (this.content) removeLabels(this.content);
  }

  private distance() {
    return this.radius / Math.sin(((FOV / 2) * Math.PI) / 180);
  }

  private fitDistance() {
    this.camera.position.setLength(this.distance());
    this.controls?.update();
    this.render();
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
    release(this.scene);
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
}
