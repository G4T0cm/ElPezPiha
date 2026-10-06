import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildWorld, START } from './scene.js';
import { ps1Uniforms } from './ps1.js';
import { Player } from './player.js';
import { Interaction } from './interaction.js';
import { PdfSource } from './pdf.js';
import { BookReader } from './book.js';
import { AudioManager } from './audio.js';

const $ = (id) => document.getElementById(id);
document.querySelectorAll('[data-ui]').forEach((e) => { e.textContent = CONFIG.ui[e.dataset.ui] ?? ''; });

// ---------- Renderer de baja resolución ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.render.fov, 16 / 9, 0.1, 40);
function resize() {
  const aspect = innerWidth / innerHeight, h = CONFIG.render.internalHeight, w = Math.round(h * aspect);
  renderer.setSize(w, h, false);
  camera.aspect = aspect; camera.updateProjectionMatrix();
  ps1Uniforms.uRes.value.set(w, h);
}
window.addEventListener('resize', resize); resize();

// ---------- Mundo, jugador, interacción ----------
const world = buildWorld(scene);
const player = new Player(camera, canvas, world);
player.setPose(START.x, START.z, START.yaw, START.pitch);
const audio = new AudioManager();
const interaction = new Interaction(camera, $('prompt'));
interaction.add({ object: world.bookGroup, offsetY: 0.1, onInteract: () => openBook() });

const pdf = new PdfSource(CONFIG.assets.pdf);
const reader = new BookReader({ root: $('reader'), pdf, audio, coverUrl: CONFIG.assets.cover });

// ---------- Estado ----------
let state = 'title';          // title | explore | opening | reading | closing
let ready = false, saved = null, tween = null;
const crosshair = $('crosshair'), pauseEl = $('pause'), titleEl = $('title');
const dummy = new THREE.PerspectiveCamera();

function startTween(toPos, toQuat, done) {
  tween = { fp: camera.position.clone(), fq: camera.quaternion.clone(), tp: toPos.clone(), tq: toQuat.clone(), t0: performance.now(), dur: CONFIG.transition.duration, done };
}
function stepTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.t0) / tween.dur);
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  camera.position.lerpVectors(tween.fp, tween.tp, e);
  camera.quaternion.slerpQuaternions(tween.fq, tween.tq, e);
  if (k >= 1) { const d = tween.done; tween = null; d && d(); }
}

function openBook() {
  if (state !== 'explore') return;
  state = 'opening';
  audio.sfx('interact');
  interaction.hide(); player.setEnabled(false);
  if (document.pointerLockElement) document.exitPointerLock();
  saved = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
  const bp = world.bookGroup.position;
  dummy.position.set(bp.x, bp.y + 1.0, bp.z + 0.95);
  dummy.lookAt(bp.x, bp.y, bp.z);
  reader.open();
  startTween(dummy.position, dummy.quaternion, () => { state = 'reading'; });
}

async function closeBook() {
  if (state !== 'reading') return;
  state = 'closing';
  player.lock();                      // se pide en el mismo gesto del usuario
  await reader.close();
  startTween(saved.pos, saved.quat, () => {
    state = 'explore';
    player.setEnabled(true); player.applyCamera();
    if (!player.locked) pauseEl.classList.remove('hidden');
  });
}
$('btn-close').addEventListener('click', closeBook);

// ---------- Entradas ----------
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && !e.repeat && state === 'explore' && player.locked) interaction.trigger();
  if (e.code === 'Escape' && state === 'reading') closeBook();
});
player.onLockChange = (locked) => { if (state === 'explore') pauseEl.classList.toggle('hidden', locked); };
player.onLockError = () => { if (state === 'explore') pauseEl.classList.remove('hidden'); };
pauseEl.addEventListener('click', () => player.lock());

titleEl.addEventListener('click', () => {
  if (!ready || state !== 'title') return;
  state = 'explore';
  audio.start(); player.lock();
  titleEl.classList.add('fade');
  setTimeout(() => titleEl.classList.add('hidden'), 2600);
});

// ---------- Carga ----------
function loadImage(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}
Promise.all([
  loadImage(CONFIG.assets.cover).then((img) => world.setCover(img)).catch(() => console.warn('Portada no encontrada:', CONFIG.assets.cover)),
  pdf.load().catch((e) => { console.warn('PDF no disponible, modo demo:', e); pdf.useDemo(); }),
  new Promise((r) => setTimeout(r, 3600)),
]).then(() => {
  reader.build();
  ready = true;
  const s = $('start'); s.textContent = CONFIG.ui.start; s.classList.add('ready');
});

// ---------- Bucle ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const exploring = state === 'explore' && player.locked;
  if (exploring) player.update(dt);
  stepTween(now);
  world.update(now / 1000);
  exploring ? interaction.update() : interaction.hide();
  crosshair.style.opacity = exploring ? 1 : 0;
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
