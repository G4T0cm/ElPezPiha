import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { getTexture, ps1Material, rng } from './ps1.js';

export const TABLE_POS = new THREE.Vector3(0, 0, -5.5);
export const START = { x: 1, z: 7, yaw: 0, pitch: -0.05 };

// Radio de la cueva según el ángulo (se usa para la malla Y para las colisiones)
export function caveRadius(t) {
  return 10.5 + 1.8 * Math.sin(2 * t + 0.5) + 1.1 * Math.sin(3 * t + 2) + 0.6 * Math.sin(5 * t);
}
// Perfil vertical: [altura, escala del radio]
const PROFILE = [[-0.6, 1], [0, 1], [2.2, 1], [3.2, 0.92], [4.5, 0.76], [5.7, 0.5], [6.6, 0.22], [7.2, 0]];
function ceilingY(rn) {
  for (let i = 1; i < PROFILE.length; i++) {
    const [y0, s0] = PROFILE[i - 1], [y1, s1] = PROFILE[i];
    if (rn <= s0 && rn >= s1) return y0 + (y1 - y0) * ((s0 - rn) / (s0 - s1 || 1));
  }
  return 7.2;
}
// Suelo irregular (plano alrededor de la mesa)
export function floorHeight(x, z) {
  const d = Math.hypot(x - TABLE_POS.x, z - TABLE_POS.z);
  const m = Math.min(1, Math.max(0, (d - 2.2) / 1.8));
  return m * (0.22 * Math.sin(x * 0.9 + 1) * Math.cos(z * 0.8) + 0.12 * Math.sin(x * 2.1 + z * 1.7));
}
const hash = (x) => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export function buildWorld(scene) {
  const rand = rng(1999);
  const L = CONFIG.lights;
  const topY = CONFIG.world.tableTopY;
  const world = { obstacles: [], flickers: [], bookGroup: new THREE.Group() };

  scene.fog = new THREE.Fog(CONFIG.render.fogColor, CONFIG.render.fogNear, CONFIG.render.fogFar);
  scene.background = new THREE.Color(CONFIG.render.fogColor);
  scene.add(new THREE.AmbientLight(L.ambientColor, L.ambientIntensity));

  const rockMat = ps1Material({ map: getTexture('rock', 1, 1) });
  const woodMat = ps1Material({ map: getTexture('wood', 1, 1) });

  // ---------- Fuego (antorchas / vela) ----------
  function addFire(x, y, z, color, intensity, distance, size) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(size, size * 3, 4), new THREE.MeshBasicMaterial({ color: 0xffa83a }));
    flame.position.set(x, y, z);
    scene.add(flame);
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y + 0.15, z);
    scene.add(light);
    world.flickers.push({ light, flame, base: intensity, seed: rand() * 100 });
  }

  // ---------- Cueva: carcasa ----------
  (function buildShell() {
    const SEG = 48;
    const noise = PROFILE.map((_, ri) => Array.from({ length: SEG }, () => (ri <= 1 ? 0 : ri === 2 ? rand() * 0.8 : rand() * 1.3 - 0.5)));
    const pos = [], uv = [], idx = [];
    PROFILE.forEach(([y, s], ri) => {
      for (let j = 0; j <= SEG; j++) {
        const jj = j % SEG, th = (jj / SEG) * Math.PI * 2;
        const r = s === 0 ? 0 : caveRadius(th) * s + noise[ri][jj] * s;
        pos.push(Math.cos(th) * r, y, Math.sin(th) * r);
        uv.push((j / SEG) * 8, ri * 0.9);
      }
    });
    for (let ri = 0; ri < PROFILE.length - 1; ri++)
      for (let j = 0; j < SEG; j++) {
        const a = ri * (SEG + 1) + j, b = a + 1, c = a + SEG + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, ps1Material({ map: getTexture('rock', 1, 1), side: THREE.DoubleSide })));
  })();

  // ---------- Suelo ----------
  (function buildFloor() {
    const g = new THREE.PlaneGeometry(34, 34, 34, 34);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, floorHeight(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, ps1Material({ map: getTexture('floor', 9, 9) })));
  })();

  // ---------- Antorchas (postes con fuego) ----------
  [[-2.6, -4.8], [2.6, -4.8], [3.2, 2.0], [-4.5, 3.5]].forEach(([x, z]) => {
    const y = floorHeight(x, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 1.5, 5), woodMat);
    post.position.set(x, y + 0.75, z);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 0.18, 6), rockMat);
    bowl.position.set(x, y + 1.55, z);
    scene.add(post, bowl);
    addFire(x, y + 1.8, z, L.torchColor, L.torchIntensity, 24, 0.16);
    world.obstacles.push({ x, z, r: 0.3 });
  });

  // ---------- Decoración con colisión ----------
  function freeSpot(minRn, maxRn, clear) {
    for (let k = 0; k < 80; k++) {
      const th = rand() * Math.PI * 2, rn = minRn + rand() * (maxRn - minRn), R = caveRadius(th);
      const x = Math.cos(th) * R * rn, z = Math.sin(th) * R * rn;
      if (Math.hypot(x - TABLE_POS.x, z - TABLE_POS.z) < 3.6) continue;
      if (Math.hypot(x - START.x, z - START.z) < 2.5) continue;
      if (distToSegment(x, z, START.x, START.z, TABLE_POS.x, TABLE_POS.z) < 1.8) continue;
      if (world.obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + clear)) continue;
      return { x, z };
    }
    return null;
  }

  // Cajas
  [[-2.5, 6.3, 0.8, 0.4], [-3.4, 5.4, 0.6, 1.1]].forEach(([x, z, s, ry]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), woodMat);
    m.position.set(x, floorHeight(x, z) + s / 2 - 0.05, z);
    m.rotation.y = ry;
    scene.add(m);
    world.obstacles.push({ x, z, r: s * 0.75 });
  });

  // Rocas
  for (let i = 0; i < 14; i++) {
    const sp = freeSpot(0.35, 0.95, 0.8); if (!sp) continue;
    const r = 0.3 + rand() * 0.6;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
    m.scale.set(1, 0.6 + rand() * 0.4, 1);
    m.rotation.y = rand() * 6.28;
    m.position.set(sp.x, floorHeight(sp.x, sp.z) + r * 0.25, sp.z);
    scene.add(m);
    world.obstacles.push({ x: sp.x, z: sp.z, r: r * 0.9 });
  }
  // Estalagmitas
  for (let i = 0; i < 8; i++) {
    const sp = freeSpot(0.45, 0.9, 0.8); if (!sp) continue;
    const r = 0.3 + rand() * 0.4, h = 1.2 + rand() * 1.4;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), rockMat);
    m.position.set(sp.x, floorHeight(sp.x, sp.z) + h / 2 - 0.1, sp.z);
    scene.add(m);
    world.obstacles.push({ x: sp.x, z: sp.z, r: r * 0.8 });
  }
  // Estalactitas (sin colisión)
  for (let i = 0; i < 16; i++) {
    const th = rand() * 6.283, rn = 0.15 + rand() * 0.6, R = caveRadius(th);
    const h = 1.6 + rand() * 1.6, r = 0.25 + rand() * 0.45;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), rockMat);
    m.rotation.x = Math.PI;
    m.position.set(Math.cos(th) * R * rn, ceilingY(rn) - h / 2 + 1.2, Math.sin(th) * R * rn);
    scene.add(m);
  }
  // Charcos
  [[3, -1], [-4, 2]].forEach(([x, z]) => {
    const g = new THREE.CircleGeometry(0.7, 8); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x182430 }));
    m.position.set(x, floorHeight(x, z) + 0.15, z);
    scene.add(m);
  });

  // ---------- Mesa / altar ----------
  const tableMesh = new THREE.Group();
  tableMesh.position.copy(TABLE_POS);
  scene.add(tableMesh);
  (function proceduralTable() {
    const add = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat); m.position.set(x, y, z); tableMesh.add(m); };
    add(1.8, 0.1, 1.0, 0, topY - 0.05, 0);
    add(1.6, 0.05, 0.8, 0, 0.3, 0);
    [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]].forEach(([x, z]) => add(0.12, topY - 0.1, 0.12, x, (topY - 0.1) / 2, z));
    const sg = new THREE.CircleGeometry(1, 8); sg.rotateX(-Math.PI / 2);
    const sh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
    sh.scale.set(1.5, 1, 1); sh.position.y = 0.02; tableMesh.add(sh);
  })();
  [-0.55, 0, 0.55].forEach((dx) => world.obstacles.push({ x: TABLE_POS.x + dx, z: TABLE_POS.z, r: 0.55 }));

  if (CONFIG.assets.models.table) {
    new GLTFLoader().load(CONFIG.assets.models.table, (gltf) => {
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const map = o.material.map;
        if (map) map.magFilter = map.minFilter = THREE.NearestFilter;
        o.material = ps1Material({ map, color: o.material.color });
      });
      tableMesh.clear();
      tableMesh.add(gltf.scene);
    }, undefined, () => console.warn('Modelo de mesa no encontrado, se usa la mesa procedural.'));
  }

  // ---------- Vela ----------
  const cx = TABLE_POS.x - 0.7, cz = TABLE_POS.z + 0.15;
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 5), ps1Material({ color: 0xd8caa0 }));
  candle.position.set(cx, topY + 0.11, cz);
  scene.add(candle);
  addFire(cx, topY + 0.28, cz, L.candleColor, L.candleIntensity, 7, 0.035);

  // ---------- Libro 3D ----------
  world.bookGroup.position.set(TABLE_POS.x + 0.1, topY, TABLE_POS.z);
  world.bookGroup.rotation.y = 0.12;
  scene.add(world.bookGroup);

  world.setCover = function (img) {
    let aspect = 0.7, c = document.createElement('canvas');
    if (img) {
      aspect = img.naturalWidth / img.naturalHeight;
      c.height = Math.min(128, img.naturalHeight); c.width = Math.round(c.height * aspect);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    } else {
      c.width = 96; c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#3a1d17'; x.fillRect(0, 0, 96, 128);
      x.strokeStyle = '#b8964a'; x.lineWidth = 3; x.strokeRect(6, 6, 84, 116);
      x.fillStyle = '#b8964a'; x.font = '14px monospace'; x.textAlign = 'center'; x.fillText('LIBRO', 48, 68);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;

    const g = world.bookGroup; g.clear();
    const d = 0.62, w = Math.min(1.0, d * aspect), t = 0.13;
    const leather = ps1Material({ map: getTexture('leather') });
    const pages = ps1Material({ map: getTexture('pages') });
    const coverMat = ps1Material({ map: tex });
    const box = (bw, bh, bd, mats, y, x = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mats); m.position.set(x, y, 0); g.add(m); };
    box(w, 0.025, d, leather, 0.0125);
    box(w - 0.03, t - 0.05, d - 0.03, pages, t / 2, 0.012);
    box(0.03, t, d, leather, t / 2, -w / 2 + 0.015);
    box(w, 0.025, d, [leather, leather, coverMat, leather, leather, leather], t - 0.0125);
  };
  world.setCover(null);

  // ---------- Animación ----------
  world.update = function (t) {
    const step = Math.floor(t * 12);
    for (const f of world.flickers) {
      const n = hash(step + f.seed), n2 = hash(step * 1.7 + f.seed);
      f.light.intensity = f.base * (0.8 + 0.3 * n);
      f.flame.scale.set(1, 0.8 + 0.5 * n2, 1);
    }
  };
  return world;
}
