# Mundial 2026 · Panel Interactivo — ISW-521 (Vite)

App web (SPA) que consume la API del Mundial 2026, construida con **Vite**.
JavaScript modular + Bulma. Cinco vistas sobre un núcleo de resiliencia
(JWT, backoff, modo offline).

## Requisitos
- Node.js 18+ (incluye npm).

## Uso
```bash
npm install      # una sola vez
npm run dev      # servidor de desarrollo -> http://localhost:5173
```
El proxy del CORS está configurado en `vite.config.js` (reenvía `/get` y
`/auth` a la API), así que **no hace falta ningún proxy aparte**.

La primera vez, crea una cuenta desde la pantalla de acceso (Regístrate).

## Build
```bash
npm run build    # genera dist/
npm run preview  # sirve el build para probarlo
```

## Estructura
```
index.html            # entrada de Vite
vite.config.js        # proxy del CORS + base
src/
  main.js             # importa estilos y módulos en orden
  styles.css
  store.js util.js api.js auth.js ui.js app.js
  views/ tour agenda timeline dashboard matriz
deploy/cloudflare-worker.js   # proxy para producción (GitHub Pages)
```

## Producción (opcional)
El `dev`/`preview` usan el proxy de Vite. Para publicar el build estático
(p. ej. GitHub Pages), la API sigue sin CORS, así que se usa el Worker de
`deploy/` y se apunta `API_BASE` (en `src/api.js`) a su URL.
