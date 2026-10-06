# La Cueva — exposición interactiva estilo PlayStation 1

Cueva 3D low-poly en primera persona (Three.js) con un libro interactivo que lee **tu PDF** como un libro físico (PDF.js + hojas 3D con animación de pasar página). Sin backend: HTML + CSS + JS.

## 1. Tus archivos

| Qué | Dónde |
|---|---|
| Portada | `assets/book/portada.png` |
| Libro | `assets/book/libro.pdf` |

Si usas otros nombres o rutas, cámbialos en `js/config.js` → `assets.cover` y `assets.pdf`.
Consejo: la portada se estira al formato de las páginas del PDF; si ambas tienen proporciones parecidas (p. ej. 2:3) se verá perfecta.
Sin estos archivos la experiencia arranca igualmente con una portada y páginas de ejemplo.

## 2. Ejecutar en local

Los módulos JS no funcionan abriendo `index.html` con doble clic (`file://`). Usa un servidor local:

```bash
cd cueva-ps1
python3 -m http.server 8000
```
Abre http://localhost:8000 (en Windows: `python -m http.server 8000`; o `npx serve`).
Hace falta internet: Three.js, PDF.js y la fuente se cargan desde CDN.

## 3. Subir a GitHub Pages

1. Crea un repositorio y sube **todo el contenido** de la carpeta (con tu PDF y portada dentro de `assets/book/`).
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)` → Save.
4. Tras un minuto estará en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.

## 4. Controles

- **Click** en la pantalla de título para entrar · **WASD** moverse · **Ratón** mirar · **ESC** liberar ratón (pausa)
- Cerca de la mesa, mirando el libro: **E** interactuar
- Dentro del libro: **← / →** o **click** en mitad izquierda/derecha para pasar página · caja **IR A** + Enter para saltar a una página · **ESC** cerrar
  (al cerrar, el libro recuerda la página en la que lo dejaste)

## 5. Qué cambiar y dónde

| Quiero cambiar… | Dónde |
|---|---|
| Textos de la interfaz, título, subtítulo | `js/config.js` → `ui` |
| Resolución retro (más/menos pixelada), niebla, FOV, jitter | `js/config.js` → `render` |
| Intensidad/color de luces | `js/config.js` → `lights` |
| Velocidad, sensibilidad, altura de ojos | `js/config.js` → `player` |
| Calidad de las páginas del PDF, memoria usada, papel envejecido | `js/config.js` → `book` |
| Texturas (rocas, suelo, madera…) | Pon un PNG pequeño (p. ej. 64×64) en `assets/textures/` y escribe su ruta en `config.assets.textures` |
| Mesa | `config.assets.models.table = 'assets/models/mesa.glb'` (modelo low-poly; ajusta `world.tableTopY` a la altura de su tablero) |
| Forma de la cueva | `js/scene.js` → `caveRadius()` y `PROFILE` (las colisiones se actualizan solas) |
| Rocas, antorchas, cajas, vela | `js/scene.js` (cada bloque está comentado) |
| Aspecto del lector (marcos, colores, tamaño) | `style.css` (sección "Lector del libro") |

## 6. Sonido

Pon tus archivos en `assets/audio/` con estos nombres (o cambia las rutas en `config.audio`):

`cave_ambience.mp3` (bucle) · `wind.mp3` (bucle) · `drip1.mp3`, `drip2.mp3` (gotas aleatorias) · `interact.mp3` · `page.mp3`

Los que no existan se ignoran (la consola del navegador mostrará un 404, es normal).

## 7. Estructura

```
index.html  style.css
js/
  main.js         estado, transiciones cámara↔libro, bucle
  config.js       TODA la configuración
  scene.js        cueva, mesa, libro 3D, luces
  ps1.js          texturas procedurales + material con vertex jitter
  player.js       primera persona, pointer lock, colisiones
  interaction.js  detección "pulsa E"
  book.js         lector de libro (hojas CSS 3D)
  pdf.js          PDF.js → canvas con caché LRU (solo renderiza páginas cercanas)
  audio.js        sonidos
assets/  book/  audio/  textures/  models/
```

## Notas

- Maquetación: la página 1 del PDF queda a la derecha de la primera apertura (la izquierda es la contracara de la tapa). Después se emparejan 2-3, 4-5…
- Si el PDF tiene fondos blancos opacos, no se notará el tono de papel; pon `book.paperTint: false` para blanco puro.
- Si ESC no permite recapturar el ratón al cerrar el libro (restricción del navegador), aparece "CLICK PARA CONTINUAR".
