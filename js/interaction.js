import * as THREE from 'three';
import { CONFIG } from './config.js';

// Registra objetos interactuables: { object, offsetY, onInteract }
export class Interaction {
  constructor(camera, promptEl) {
    this.camera = camera; this.el = promptEl; this.items = []; this.active = null;
    this._p = new THREE.Vector3(); this._d = new THREE.Vector3(); this._f = new THREE.Vector3();
  }
  add(item) { this.items.push(item); }
  update() {
    this.camera.getWorldDirection(this._f);
    let best = null, bd = -1;
    for (const it of this.items) {
      it.object.getWorldPosition(this._p);
      this._p.y += it.offsetY || 0;
      this._d.subVectors(this._p, this.camera.position);
      if (Math.hypot(this._d.x, this._d.z) > CONFIG.interaction.distance) continue;
      const dot = this._d.normalize().dot(this._f);
      if (dot >= CONFIG.interaction.facing && dot > bd) { best = it; bd = dot; }
    }
    this._set(best);
  }
  _set(it) {
    if (it === this.active) return;
    this.active = it;
    this.el.classList.toggle('show', !!it);
  }
  hide() { this._set(null); }
  trigger() { if (this.active) this.active.onInteract(this.active); }
}
