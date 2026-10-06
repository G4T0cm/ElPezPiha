// ============================================================
//  CONFIGURACIÓN CENTRAL — casi todo lo que querrás cambiar está aquí
// ============================================================
export const CONFIG = {
  // ---------- ARCHIVOS ----------
  assets: {
    cover: 'assets/book/portada.png',   // tu portada
    pdf: 'assets/book/libro.pdf',       // tu libro
    // Texturas propias opcionales (PNG pequeños, p. ej. 64x64). null = procedural.
    textures: { rock: null, floor: null, wood: null, leather: null, pages: null },
    // Modelos .glb opcionales (low-poly). null = mesa procedural.
    models: { table: null },
  },

  // ---------- AUDIO ---------- (src vacío o archivo inexistente = se ignora)
  audio: {
    master: 1,
    ambience: { src: 'assets/audio/cave.mp3', volume: 0.5 },
    wind:     { src: 'assets/audio/wind.mp3',          volume: 0.3 },
    drips:    { srcs: ['assets/audio/drip1.mp3', 'assets/audio/drip2.mp3'], volume: 0.4, minDelay: 2.5, maxDelay: 8 },
    interact: { src: 'assets/audio/interact.mp3',      volume: 0.7 },
    page:     { src: 'assets/audio/page.mp3',          volume: 0.6 },
  },

  // ---------- ESTILO PS1 ----------
  render: {
    internalHeight: 240,    // resolución interna vertical (240 = PS1). Sube a 360 para algo más nítido
    jitter: true,           // vertex snapping ("temblor" de vértices)
    fov: 72,
    fogColor: 0x07050a,
    fogNear: 3,
    fogFar: 22,
  },
  lights: {
    ambientColor: 0x6a6088, ambientIntensity: 1.5,
    torchColor: 0xff9040,   torchIntensity: 26,
    candleColor: 0xffb060,  candleIntensity: 4,
  },

  // ---------- MUNDO ----------
  world: { tableTopY: 1.0 },

  // ---------- JUGADOR ----------
  player: { speed: 3.2, eyeHeight: 1.65, radius: 0.35, wallMargin: 0.9, sensitivity: 0.0022, bob: true },
  interaction: { distance: 2.8, facing: 0.75 },   // facing: 1 = exactamente de frente

  // ---------- LIBRO ----------
  book: {
    pageRenderHeight: 1200, // píxeles de alto con que se rasteriza cada página del PDF
    cacheSize: 14,          // páginas del PDF mantenidas en memoria
    paperTint: true,        // true = el PDF se pinta sobre papel envejecido; false = blanco puro
  },
  transition: { duration: 900 },   // ms de la cámara al abrir/cerrar el libro

  // ---------- TEXTOS DE LA INTERFAZ ----------
  ui: {
    title: 'LA CUEVA',
    subtitle: 'Del Pez Piha...',
    loading: 'CARGANDO...',
    start: '[ CLICK PARA ENTRAR ]',
    controls: 'WASD MOVER   RATON MIRAR   ESC PAUSA',
    prompt: '[E] INTERACTUAR',
    pause: 'PAUSA - CLICK PARA CONTINUAR',
    close: '[ESC] CERRAR',
    pages: '[<] [>] PAGINA',
    goto: 'IR A',
    cover: 'PORTADA',
    coverMissing: 'FALTA assets/book/portada.png',
  },
};
