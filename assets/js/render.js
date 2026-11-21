// Loading STL / 3MF files and showing them as clay-grey models.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CLAY = { color: 0xd2d2d0, roughness: 0.45, metalness: 0 };
const cache = new Map();

function clayMaterial() {
  return new THREE.MeshStandardMaterial({ ...CLAY, side: THREE.DoubleSide });
}

/** Load a model file once; resolves to a Group (Y-up, sitting on y = 0, centred in X/Z). */
export function loadModel(url, { upAxis = 'z' } = {}) {
  if (!cache.has(url)) cache.set(url, fetchModel(url, upAxis));
  return cache.get(url).then(g => g.clone(true));
}

async function fetchModel(url, upAxis) {
  const ext = url.split('.').pop().toLowerCase();
  const group = new THREE.Group();
  if (ext === 'stl') {
    const geo = await new STLLoader().loadAsync(url);
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, clayMaterial()));
  } else if (ext === '3mf') {
    const obj = await new ThreeMFLoader().loadAsync(url);
    group.add(obj);
  } else {
    throw new Error(`Unsupported format: ${ext}`);
  }
  // Printer files are Z-up; three.js is Y-up.
  if (upAxis === 'z') group.rotation.x = -Math.PI / 2;
  group.traverse(o => {
    if (o.isMesh) {
      o.material = clayMaterial();
      o.castShadow = true;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    }
  });
  const wrap = new THREE.Group(); wrap.add(group); wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  const c = box.getCenter(new THREE.Vector3());
  group.position.set(-c.x, -box.min.y, -c.z);
  return wrap;
}

/** All meshes inside a loaded model, in file order (used for part toggles). */
export function meshesOf(group) { const list = []; group.traverse(o => { if (o.isMesh) list.push(o); }); return list; }

// ---------- shared scene pieces ----------
// Environment maps belong to one WebGL context, so keep one per renderer.
const envTextures = new WeakMap();
function environment(renderer) {
  if (!envTextures.has(renderer)) envTextures.set(renderer, new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture);
  return envTextures.get(renderer);
}

function buildScene(renderer, model, { shadow = 0.12 } = {}) {
  const scene = new THREE.Scene();
  scene.environment = environment(renderer);
  scene.environmentIntensity = 0.85;
  scene.add(model);
  model.updateMatrixWorld(true);
  const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  const R = sphere.radius;
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-R * 1.2, R * 4, R * 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 12; key.shadow.blurSamples = 20; key.shadow.bias = -0.0005;
  Object.assign(key.shadow.camera, { left: -R * 2.5, right: R * 2.5, top: R * 2.5, bottom: -R * 2.5, near: 0.1, far: R * 10 });
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(R * 14, R * 14), new THREE.ShadowMaterial({ opacity: shadow }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.001; ground.receiveShadow = true;
  scene.add(ground);
  return { scene, sphere };
}

function newRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ ...(canvas ? { canvas } : {}), antialias: true, alpha: true, preserveDrawingBuffer: !canvas });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 0.88;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.VSMShadowMap;
  r.setClearColor(0x000000, 0);
  return r;
}

function placeCamera(cam, sphere, { az = 20, el = 30, fit = 1 } = {}) {
  const vfov = THREE.MathUtils.degToRad(cam.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
  const dist = sphere.radius / Math.sin(Math.min(vfov, hfov) / 2) * fit;
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  cam.position.set(sphere.center.x + dist * Math.cos(e) * Math.sin(a), sphere.center.y + dist * Math.sin(e), sphere.center.z + dist * Math.cos(e) * Math.cos(a));
  cam.lookAt(sphere.center);
}

// ---------- still images for cards ----------
let stillRenderer = null;
/** Render a model to a PNG data URL (transparent background). */
export function renderStill(model, { width, height, ...view }) {
  stillRenderer ??= newRenderer(null);
  stillRenderer.setSize(width, height, false);
  const { scene, sphere } = buildScene(stillRenderer, model);
  const cam = new THREE.PerspectiveCamera(28, width / height, 0.1, sphere.radius * 50);
  placeCamera(cam, sphere, view);
  stillRenderer.render(scene, cam);
  return stillRenderer.domElement.toDataURL('image/png');
}

// ---------- interactive viewer ----------
export function createViewer(container, model, view = {}) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const renderer = newRenderer(canvas);
  const { scene, sphere } = buildScene(renderer, model, { shadow: 0.1 });
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, sphere.radius * 50);
  const controls = new OrbitControls(cam, canvas);
  controls.enableDamping = true; controls.target.copy(sphere.center);
  controls.minDistance = sphere.radius * 1.2; controls.maxDistance = sphere.radius * 8;
  controls.autoRotateSpeed = 2.2;
  const meshes = meshesOf(model);
  const wire = new THREE.MeshBasicMaterial({ color: 0x555555, wireframe: true, transparent: true, opacity: 0.16 });
  const overlays = meshes.map(m => { const o = new THREE.Mesh(m.geometry, wire); o.visible = false; m.add(o); return o; });

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  resize();
  placeCamera(cam, sphere, view);
  new ResizeObserver(resize).observe(container);
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, cam); });

  return {
    meshes,
    setWire(on) { overlays.forEach(o => (o.visible = on)); meshes.forEach(m => m.material.color.set(on ? 0xeeeeee : CLAY.color)); },
    setSpin(on) { controls.autoRotate = on; },
    viewTop() { placeCamera(cam, sphere, { az: 0, el: 89, fit: view.fit }); controls.target.copy(sphere.center); },
    viewHome() { placeCamera(cam, sphere, view); controls.target.copy(sphere.center); },
    showOnly(index) { meshes.forEach((m, i) => (m.visible = index == null || i === index)); },
  };
}
