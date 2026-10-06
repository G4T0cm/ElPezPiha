import { CONFIG } from './config.js';
import { caveRadius, floorHeight } from './scene.js';

export class Player {
  constructor(camera, canvas, world) {
    this.camera = camera; this.canvas = canvas; this.world = world;
    this.x = 0; this.z = 0; this.y = CONFIG.player.eyeHeight;
    this.yaw = 0; this.pitch = 0; this.bobT = 0;
    this.keys = new Set(); this.enabled = true; this.locked = false;
    this.onLockChange = () => {}; this.onLockError = () => {};
    camera.rotation.order = 'YXZ';

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
      this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => this.onLockError());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.yaw -= e.movementX * CONFIG.player.sensitivity;
      this.pitch -= e.movementY * CONFIG.player.sensitivity;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
    });
    window.addEventListener('keydown', (e) => { if (this.enabled) this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  lock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => this.onLockError());
    } catch (e) { this.onLockError(); }
  }
  setEnabled(v) { this.enabled = v; if (!v) this.keys.clear(); }
  setPose(x, z, yaw, pitch) {
    this.x = x; this.z = z; this.yaw = yaw; this.pitch = pitch;
    this.y = floorHeight(x, z) + CONFIG.player.eyeHeight;
    this.applyCamera();
  }
  applyCamera() {
    this.camera.position.set(this.x, this.y, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
  resolve(x, z) {
    const P = CONFIG.player;
    for (let it = 0; it < 2; it++) {
      const lim = caveRadius(Math.atan2(z, x)) - P.wallMargin, d = Math.hypot(x, z);
      if (d > lim) { x *= lim / d; z *= lim / d; }
      for (const o of this.world.obstacles) {
        const dx = x - o.x, dz = z - o.z, min = o.r + P.radius, dd = dx * dx + dz * dz;
        if (dd < min * min) { const dist = Math.sqrt(dd) || 1e-4; x = o.x + (dx / dist) * min; z = o.z + (dz / dist) * min; }
      }
    }
    return [x, z];
  }
  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    let fz = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    let fx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const len = Math.hypot(fx, fz);
    const moving = len > 0;
    if (moving) {
      fx /= len; fz /= len;
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw), v = CONFIG.player.speed * dt;
      [this.x, this.z] = this.resolve(this.x + (-s * fz + c * fx) * v, this.z + (-c * fz - s * fx) * v);
      this.bobT += dt * 8;
    }
    const target = floorHeight(this.x, this.z) + CONFIG.player.eyeHeight + (CONFIG.player.bob && moving ? Math.sin(this.bobT) * 0.035 : 0);
    this.y += (target - this.y) * Math.min(1, dt * 12);
    this.applyCamera();
  }
}
