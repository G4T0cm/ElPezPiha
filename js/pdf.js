import { CONFIG } from './config.js';

const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const PAPER = [226, 214, 184];

let paperTile = null;
function paperPattern(ctx) {
  if (!paperTile) {
    paperTile = document.createElement('canvas'); paperTile.width = paperTile.height = 128;
    const c = paperTile.getContext('2d');
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const n = (Math.random() - 0.5) * 12;
      c.fillStyle = `rgb(${PAPER[0] + n},${PAPER[1] + n},${PAPER[2] + n})`; c.fillRect(x, y, 1, 1);
    }
  }
  return ctx.createPattern(paperTile, 'repeat');
}

export class PdfSource {
  constructor(url) {
    this.url = url; this.doc = null; this.pageCount = 0; this.aspect = 0.72;
    this.demo = false; this.cache = new Map(); this.pending = new Map();
  }
  async load() {
    const lib = window.pdfjsLib;
    if (!lib) throw new Error('pdf.js no se cargó');
    lib.GlobalWorkerOptions.workerSrc = WORKER;
    this.doc = await lib.getDocument({ url: this.url }).promise;
    this.pageCount = this.doc.numPages;
    const v = (await this.doc.getPage(1)).getViewport({ scale: 1 });
    this.aspect = v.width / v.height;
  }
  useDemo() { this.demo = true; this.pageCount = 6; this.aspect = 0.72; }

  // Devuelve el canvas de la página n (con caché LRU). Solo renderiza lo que se pide.
  async renderPage(n, H) {
    if (n < 1 || n > this.pageCount) return null;
    const hit = this.cache.get(n);
    if (hit) { this.cache.delete(n); this.cache.set(n, hit); return hit; }
    if (this.pending.has(n)) return this.pending.get(n);
    const p = this._render(n, H)
      .then((c) => { this.pending.delete(n); this.cache.set(n, c); this._trim(); return c; })
      .catch((e) => { this.pending.delete(n); throw e; });
    this.pending.set(n, p);
    return p;
  }
  _trim() {
    while (this.cache.size > CONFIG.book.cacheSize) {
      const [k, c] = this.cache.entries().next().value;
      this.cache.delete(k); c.width = 1; c.height = 1;
    }
  }
  async _render(n, H) {
    const W = Math.round(H * this.aspect);
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const tint = CONFIG.book.paperTint;
    ctx.fillStyle = tint ? paperPattern(ctx) : '#fff'; ctx.fillRect(0, 0, W, H);

    if (this.demo) {
      ctx.fillStyle = '#2a1d12'; ctx.textAlign = 'center';
      ctx.font = `${H * 0.05}px monospace`; ctx.fillText(`PAGINA ${n}`, W / 2, H * 0.4);
      ctx.font = `${H * 0.025}px monospace`;
      ctx.fillText('Coloca tu PDF en', W / 2, H * 0.5);
      ctx.fillText('assets/book/libro.pdf', W / 2, H * 0.54);
      return canvas;
    }
    const page = await this.doc.getPage(n);
    const v0 = page.getViewport({ scale: 1 });
    const scale = Math.min(W / v0.width, H / v0.height);
    const vp = page.getViewport({ scale });
    await page.render({
      canvasContext: ctx, viewport: vp,
      transform: [1, 0, 0, 1, (W - vp.width) / 2, (H - vp.height) / 2],
      background: tint ? 'rgba(0,0,0,0)' : '#ffffff',
    }).promise;
    return canvas;
  }
}
