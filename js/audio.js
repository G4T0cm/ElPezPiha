import { CONFIG } from './config.js';

// Si un archivo no existe, simplemente no suena. Sustituye los de assets/audio/.
export class AudioManager {
  constructor() { this.on = false; this.loops = []; this.dripTimer = null; }
  _vol(v) { return Math.min(1, v * CONFIG.audio.master); }
  start() {
    if (this.on) return; this.on = true;
    for (const key of ['ambience', 'wind']) {
      const c = CONFIG.audio[key]; if (!c || !c.src) continue;
      const a = new Audio(c.src); a.loop = true; a.volume = this._vol(c.volume);
      a.play().catch(() => {}); this.loops.push(a);
    }
    this._scheduleDrip();
  }
  _scheduleDrip() {
    const d = CONFIG.audio.drips; if (!d || !d.srcs || !d.srcs.length) return;
    const delay = (d.minDelay + Math.random() * (d.maxDelay - d.minDelay)) * 1000;
    this.dripTimer = setTimeout(() => {
      const a = new Audio(d.srcs[Math.floor(Math.random() * d.srcs.length)]);
      a.volume = this._vol(d.volume * (0.5 + Math.random() * 0.5));
      a.play().catch(() => {});
      this._scheduleDrip();
    }, delay);
  }
  sfx(name) {
    const c = CONFIG.audio[name]; if (!c || !c.src) return;
    const a = new Audio(c.src); a.volume = this._vol(c.volume); a.play().catch(() => {});
  }
}
