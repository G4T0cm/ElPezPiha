import { CONFIG } from './config.js';

const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };

/*
 * Lector de libro físico con hojas CSS 3D.
 * Hoja 0 = tapa (portada fuera / interior dentro).
 * Hoja i>=1: anverso = página 2i-1 del PDF, reverso = página 2i.
 * f = número de hojas pasadas (0 = libro cerrado).
 */
export class BookReader {
  constructor({ root, pdf, audio, coverUrl }) {
    this.root = root; this.pdf = pdf; this.audio = audio; this.coverUrl = coverUrl;
    this.book = root.querySelector('#book');
    this.hud = root.querySelector('#hud-page');
    this.input = root.querySelector('#goto');
    this.leaves = []; this.f = 0; this.savedF = 0; this.T = 0; this.isOpen = false;
    this._bind();
  }

  build() {
    const N = this.pdf.pageCount, L = Math.ceil(N / 2);
    this.T = L + 1;
    this.book.replaceChildren();
    this.baseR = el('div', 'base base-r', this.book);
    this.baseL = el('div', 'base base-l', this.book);
    this.leaves = [];
    for (let i = 0; i < this.T; i++) {
      const leaf = el('div', 'leaf', this.book);
      leaf.style.zIndex = this.T - i;
      const front = el('div', 'face front', leaf);
      const back = el('div', 'face back', leaf);
      if (i === 0) {
        leaf.classList.add('cover'); front.classList.add('cover-front'); back.classList.add('cover-inside');
        const img = new Image(); img.alt = ''; img.src = this.coverUrl;
        img.onerror = () => { img.remove(); front.classList.add('cover-missing'); front.textContent = CONFIG.ui.coverMissing; };
        front.appendChild(img);
      } else {
        front.dataset.page = 2 * i - 1; back.dataset.page = 2 * i;
      }
      this.leaves.push({ el: leaf, front, back, flipped: false, zt: 0 });
    }
    this.layout(); this._hud();
  }

  layout() {
    const a = this.pdf.aspect || 0.72;
    const ph = Math.floor(Math.min(innerHeight * 0.82, (innerWidth * 0.92) / 2 / a));
    this.root.style.setProperty('--ph', ph + 'px');
    this.root.style.setProperty('--pw', Math.floor(ph * a) + 'px');
  }

  open() {
    this.isOpen = true;
    this.root.classList.remove('hidden');
    void this.root.offsetWidth;
    this.root.classList.add('visible');
    this.layout(); this._ensure();
    clearTimeout(this.openTimer);
    this.openTimer = setTimeout(() => {
      if (!this.isOpen) return;
      this.audio && this.audio.sfx('page');
      this.setF(Math.max(1, this.savedF), { stagger: 60 });
    }, 650);
  }

  close() {
    return new Promise((res) => {
      this.isOpen = false; this.savedF = this.f;
      clearTimeout(this.openTimer);
      let wait = 150;
      if (this.f > 0) { this.audio && this.audio.sfx('page'); wait = 1000; this.setF(0, { stagger: 40 }); }
      setTimeout(() => {
        this.root.classList.remove('visible');
        setTimeout(() => { this.root.classList.add('hidden'); res(); }, 500);
      }, wait);
    });
  }

  next() { if (this.isOpen && this.f < this.T) { this.audio && this.audio.sfx('page'); this.setF(this.f + 1); } }
  prev() { if (this.isOpen && this.f > 0) { this.audio && this.audio.sfx('page'); this.setF(this.f - 1); } }
  goTo(p) {
    const N = this.pdf.pageCount;
    p = Math.max(0, Math.min(N, p | 0));
    const f = p <= 1 ? 1 : (p % 2 ? (p + 1) / 2 : p / 2 + 1);
    this.audio && this.audio.sfx('page');
    this.setF(f, { stagger: 70 });
  }

  setF(nf, { stagger = 0 } = {}) {
    nf = Math.max(0, Math.min(this.T, nf));
    const fwd = nf > this.f;
    const changed = [];
    this.leaves.forEach((lf, i) => { if (lf.flipped !== i < nf) changed.push(i); });
    if (!fwd) changed.reverse();
    const step = changed.length > 1 ? Math.min(stagger, 600 / changed.length) : 0;
    changed.forEach((i, k) => {
      const lf = this.leaves[i], flip = i < nf;
      lf.flipped = flip;
      lf.el.style.transitionDelay = k * step + 'ms';
      lf.el.style.zIndex = 1000 + (fwd ? this.T - i : i);
      lf.el.classList.toggle('flipped', flip);
      clearTimeout(lf.zt);
      lf.zt = setTimeout(() => { lf.el.style.zIndex = flip ? i + 1 : this.T - i; lf.el.style.transitionDelay = '0ms'; }, k * step + 950);
    });
    this.f = nf;
    this.book.classList.toggle('closed', nf === 0);
    this.baseL.classList.toggle('on', nf >= 1);
    this._hud(); this._ensure();
  }

  // Renderiza solo las páginas cercanas a la vista actual
  _ensure() {
    if (!this.leaves.length) return;
    for (const i of [this.f, this.f - 1, this.f + 1, this.f - 2, this.f + 2]) {
      if (i < 1 || i >= this.T) continue;
      this._loadFace(this.leaves[i].front); this._loadFace(this.leaves[i].back);
    }
  }
  async _loadFace(face) {
    const n = +face.dataset.page;
    if (!n || n > this.pdf.pageCount) return;
    try {
      const c = await this.pdf.renderPage(n, CONFIG.book.pageRenderHeight);
      if (c && face.canvasRef !== c) { face.replaceChildren(c); face.canvasRef = c; }
    } catch (e) { console.warn('Error renderizando página', n, e); }
  }

  _hud() {
    const N = this.pdf.pageCount;
    if (this.f === 0) { this.hud.textContent = CONFIG.ui.cover; return; }
    const pages = [2 * (this.f - 1), 2 * this.f - 1].filter((p) => p >= 1 && p <= N);
    this.hud.textContent = (pages.join('-') || '-') + ' / ' + N;
  }

  _bind() {
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.target === this.input) {
        if (e.code === 'Enter') { const v = parseInt(this.input.value, 10); if (!isNaN(v)) this.goTo(v); this.input.value = ''; this.input.blur(); }
        return;
      }
      if (e.code === 'ArrowRight' || e.code === 'PageDown') this.next();
      else if (e.code === 'ArrowLeft' || e.code === 'PageUp') this.prev();
    });
    this.root.addEventListener('click', (e) => {
      if (!this.isOpen || e.target.closest('#reader-hud')) return;
      e.clientX < innerWidth / 2 ? this.prev() : this.next();
    });
  }
}
