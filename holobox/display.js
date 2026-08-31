/* HoloBox — Display renderer.
 *
 * Renders the loaded 3D model and composites it into the layout your physical
 * box needs:
 *   pyramid  — four views arranged around the centre, each tipped so its top
 *              faces the middle. A 4-sided acrylic pyramid sitting on the screen
 *              reflects them into one model that floats in the air, viewable from
 *              every side. With faceRotate on, each face shows a different angle.
 *   sheet    — one mirrored view for a single 45° reflector.
 *
 * State arrives live over SSE from the phone/laptop controller.
 */
import * as THREE from 'three';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { OBJLoader } from './lib/OBJLoader.js';
import { STLLoader } from './lib/STLLoader.js';

const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');

// --- offscreen WebGL renderer (one face at a time) ---
const RES = 720;
const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
gl.setSize(RES, RES);
gl.setClearColor(0x000000, 0);
const glCanvas = gl.domElement;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 1.1, 4.2);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 3, 2); scene.add(key);
const rim = new THREE.DirectionalLight(0x16f2ff, 0.8); rim.position.set(-2, 1, -2); scene.add(rim);

let model = null;
let state = {
  rotX: 0, rotY: 0, autoSpin: true, spinSpeed: 0.5, scale: 1,
  color: '#16f2ff', material: 'normal', wireframe: false,
  mode: 'pyramid', faceRotate: true, gap: 0.18, bg: '#000000',
  faceOffsetDeg: 0, mirror: false, model: null, name: 'default',
};
let spin = 0;

// ---------- model management ----------
function clearModel() {
  if (model) { scene.remove(model); model.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  }); model = null; }
}

function fit(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxd = Math.max(size.x, size.y, size.z) || 1;
  obj.position.sub(center);
  const s = 2.0 / maxd;
  const wrap = new THREE.Group();
  wrap.scale.setScalar(s);
  wrap.add(obj);
  return wrap;
}

function applyMaterial(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.orig = o.userData.orig || o.material;
    const col = new THREE.Color(state.color);
    if (state.material === 'normal') o.material = new THREE.MeshNormalMaterial({ wireframe: state.wireframe });
    else if (state.material === 'glow') o.material = new THREE.MeshBasicMaterial({ color: col, wireframe: state.wireframe, transparent: true, opacity: 0.95 });
    else if (state.material === 'wire') o.material = new THREE.MeshBasicMaterial({ color: col, wireframe: true });
    else { o.material = new THREE.MeshStandardMaterial({ color: col, metalness: 0.3, roughness: 0.4, wireframe: state.wireframe, emissive: col.clone().multiplyScalar(0.15) }); }
  });
}

function setProcedural(name) {
  clearModel();
  let geo;
  if (name === 'torusknot') geo = new THREE.TorusKnotGeometry(0.7, 0.25, 160, 24);
  else if (name === 'sphere') geo = new THREE.IcosahedronGeometry(1, 4);
  else if (name === 'torus') geo = new THREE.TorusGeometry(0.8, 0.3, 24, 64);
  else geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const mesh = new THREE.Mesh(geo, new THREE.MeshNormalMaterial());
  model = fit(mesh); applyMaterial(model); scene.add(model);
  state.name = name;
}

function loadURL(url, name) {
  const ext = (name || url).split('.').pop().toLowerCase();
  const done = (obj) => { clearModel(); model = fit(obj); applyMaterial(model); scene.add(model); state.name = name; };
  const fail = (e) => { console.warn('load failed', e); setProcedural('cube'); };
  if (ext === 'glb' || ext === 'gltf') new GLTFLoader().load(url, (g) => done(g.scene), undefined, fail);
  else if (ext === 'obj') new OBJLoader().load(url, done, undefined, fail);
  else if (ext === 'stl') new STLLoader().load(url, (g) => done(new THREE.Mesh(g)), undefined, fail);
  else setProcedural(name || 'cube');
}

// ---------- composition ----------
function resize() { stage.width = innerWidth; stage.height = innerHeight; }
addEventListener('resize', resize); resize();

function drawFace(angleDeg, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleDeg * Math.PI / 180);
  if (state.mirror) ctx.scale(-1, 1);
  ctx.drawImage(glCanvas, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function renderFace(faceIndex) {
  if (!model) return;
  const extra = state.faceRotate ? faceIndex * Math.PI / 2 : 0;
  model.rotation.set(state.rotX, spin + state.rotY + extra, 0);
  model.scale.setScalar(model.userData._fitScale || 1); // keep fit
  gl.render(scene, camera);
}

function frame() {
  if (state.autoSpin) spin += state.spinSpeed * 0.02;
  ctx.fillStyle = state.bg || '#000';
  ctx.fillRect(0, 0, stage.width, stage.height);

  const W = stage.width, H = stage.height, cx = W / 2, cy = H / 2;
  const S = Math.min(W, H);
  const off = state.faceOffsetDeg || 0;

  if (state.mode === 'sheet') {
    renderFace(0);
    // single reflector: one big mirrored image, low on screen
    const sz = S * 0.8;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, -1); // vertical flip = reflection
    ctx.rotate(off * Math.PI / 180);
    ctx.drawImage(glCanvas, -sz / 2, -sz / 2, sz, sz); ctx.restore();
  } else {
    const sz = S * (0.5 - state.gap * 0.5);
    const r = S * (0.24 + state.gap * 0.2);
    // bottom, left, top, right — tops toward centre
    const faces = [
      { a: 0 + off,   x: cx,     y: cy + r },
      { a: 90 + off,  x: cx - r, y: cy },
      { a: 180 + off, x: cx,     y: cy - r },
      { a: 270 + off, x: cx + r, y: cy },
    ];
    faces.forEach((f, i) => { renderFace(i); drawFace(f.a, f.x, f.y, sz); });
  }
  requestAnimationFrame(frame);
}

// ---------- live state over SSE ----------
function connect() {
  const es = new EventSource('/events');
  es.onmessage = (e) => {
    const s = JSON.parse(e.data);
    const modelChanged = s.model !== state.model || s.name !== state.name;
    Object.assign(state, s);
    if (modelChanged) {
      if (s.model) loadURL(s.model, s.name);
      else setProcedural(s.name || 'cube');
    } else if (model) { applyMaterial(model); }
  };
  es.onerror = () => { /* auto-reconnects */ };
}

setProcedural('torusknot');
connect();
frame();
