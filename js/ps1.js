import * as THREE from 'three';
import { CONFIG } from './config.js';

// RNG determinista (mulberry32)
export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Resolución interna compartida con el shader (jitter)
export const ps1Uniforms = { uRes: { value: new THREE.Vector2(320, 240) } };

// ---------- Texturas procedurales (pixeladas, paleta reducida) ----------
const q = (v) => Math.max(0, Math.min(255, Math.round(v / 8) * 8));

function noiseFill(ctx, s, [r, g, b], vari, rand, block = 1) {
  for (let y = 0; y < s; y += block)
    for (let x = 0; x < s; x += block) {
      const n = (rand() - 0.5) * 2 * vari;
      ctx.fillStyle = `rgb(${q(r + n)},${q(g + n)},${q(b + n * 0.8)})`;
      ctx.fillRect(x, y, block, block);
    }
}

function canvasTex(size, paint, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  paint(ctx, size, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const GEN = {
  rock: () => canvasTex(64, (ctx, s, r) => {
    noiseFill(ctx, s, [92, 84, 78], 34, r, 2);
    ctx.fillStyle = 'rgb(32,28,30)';
    for (let i = 0; i < 9; i++) {
      let x = Math.floor(r() * s), y = Math.floor(r() * s);
      for (let k = 0; k < 10 + r() * 10; k++) { ctx.fillRect(x, y, 1, 1); x += Math.floor(r() * 3) - 1; y += r() < 0.7 ? 1 : 0; }
    }
  }, 11),
  floor: () => canvasTex(64, (ctx, s, r) => {
    noiseFill(ctx, s, [70, 58, 46], 26, r, 2);
    ctx.fillStyle = 'rgb(120,108,96)';
    for (let i = 0; i < 14; i++) ctx.fillRect(Math.floor(r() * s), Math.floor(r() * s), 2, 2);
  }, 12),
  wood: () => canvasTex(32, (ctx, s, r) => {
    for (let x = 0; x < s; x++) {
      const b = 96 + Math.sin(x * 1.3) * 10 + r() * 10;
      for (let y = 0; y < s; y++) {
        const n = (r() - 0.5) * 8;
        ctx.fillStyle = `rgb(${q(b + n)},${q(b * 0.68 + n)},${q(b * 0.4 + n)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = 'rgb(40,24,14)';
    ctx.fillRect(0, 0, s, 1); ctx.fillRect(0, s / 2, s, 1);
    ctx.fillRect(Math.floor(r() * s), Math.floor(r() * s), 2, 2);
  }, 13),
  leather: () => canvasTex(32, (ctx, s, r) => noiseFill(ctx, s, [74, 36, 30], 14, r, 1), 14),
  pages: () => canvasTex(16, (ctx, s) => {
    for (let y = 0; y < s; y++) { ctx.fillStyle = y % 2 ? 'rgb(190,178,150)' : 'rgb(216,206,176)'; ctx.fillRect(0, y, s, 1); }
  }, 15),
};

export function getTexture(name, rx = 1, ry = 1) {
  const tex = GEN[name]();
  tex.repeat.set(rx, ry);
  const url = CONFIG.assets.textures[name];
  if (url) new THREE.ImageLoader().load(url, (img) => { tex.image = img; tex.needsUpdate = true; }, undefined, () => console.warn('Textura no encontrada:', url));
  return tex;
}

// Material PS1: Lambert plano + vertex snapping
export function ps1Material({ map = null, color = 0xffffff, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshLambertMaterial({ map, color, side, flatShading: true });
  if (CONFIG.render.jitter) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRes = ps1Uniforms.uRes;
      shader.vertexShader = 'uniform vec2 uRes;\n' + shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         if (gl_Position.w > 0.0) {
           vec2 ndc = gl_Position.xy / gl_Position.w;
           vec2 grid = uRes * 0.6;
           ndc = (floor((ndc * 0.5 + 0.5) * grid + 0.5) / grid - 0.5) * 2.0;
           gl_Position.xy = ndc * gl_Position.w;
         }`
      );
    };
    m.customProgramCacheKey = () => 'ps1-jitter';
  }
  return m;
}
