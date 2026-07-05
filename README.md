# Mundial 2026 · Panel Interactivo — ISW-521 (Categoría B)

Aplicación JavaScript que implementa **los 5 subproyectos** del catálogo dentro de
una sola página (SPA), compartiendo un mismo **núcleo de resiliencia**.

> ⚠️ **Importante sobre la entrega.** El documento del proyecto habla del
> "subproyecto **elegido**" (en singular) y la modalidad es *Individual*.
> Esta app incluye los 5 por si tu profesor pidió presentar todos. **Confirma con
> él** si basta con uno: si es así, puedes entregar solo esa vista + el núcleo.

---

## ▶️ Cómo ejecutarlo

La forma recomendada es servirlo con un servidor local (cualquiera sirve):

```bash
# Opción 1: Python
python -m http.server 5500
# luego abre http://localhost:5500

# Opción 2: VS Code -> extensión "Live Server" -> clic derecho en index.html -> "Open with Live Server"

# Opción 3: Node
npx serve .
```

1. Al abrir, aparece la pantalla de login. Si no tienes cuenta, pulsa
   **"Regístrate"** y crea una con nombre, correo y contraseña.
2. El token JWT se guarda en `localStorage` y dura ~84 días.
3. Navega entre las 5 pestañas.

API real usada: `https://worldcup26.ir` (endpoints `/get/stadiums`, `/get/games`,
`/get/teams`, `/get/groups`; auth en `/auth/register` y `/auth/authenticate`).

---

## 🗂️ Estructura

```
worldcup-app/
├── index.html
├── css/styles.css
└── js/
    ├── store.js      # localStorage: token, caché offline, preferencias
    ├── api.js        # NÚCLEO: fetch + JWT + backoff + countdown + 401 + caché
    ├── auth.js       # login / registro (obtención del token)
    ├── ui.js         # presentación común: banner, modal de sesión, badges
    ├── app.js        # arranque + router de pestañas
    └── views/
        ├── tour.js       # 2.1 Tour de Sedes      (scrollIntoView)
        ├── agenda.js     # 2.2 Agenda Simultánea   (layout dividido + skeletons)
        ├── timeline.js   # 2.3 Timeline Infinito   (IntersectionObserver)
        ├── dashboard.js  # 2.4 Dashboard Fanático  (variables CSS + localStorage)
        └── matriz.js     # 2.5 Matriz por Grupo    (cuadrícula 4x4, parcheo)
```

La **lógica de fetch (`api.js`) está separada de la presentación**: `api.js`
nunca toca el DOM, solo emite eventos (`wc:request-countdown`, `wc:session-expired`…)
que `ui.js` escucha. Eso es lo que pide la rúbrica (separación fetch ↔ vista).

---

## 🛡️ Dónde está cada requisito obligatorio (sección 1.5)

| Requisito | Archivo / función |
|---|---|
| **JWT en cada llamada** | `api.js → authHeaders()` añade `Authorization: Bearer <token>` |
| **async/await exclusivo** | Todo el código; cero `.then()/.catch()` |
| **401 sin recargar** | `api.js` limpia token + emite `SESSION_EXPIRED`; `ui.js` abre el modal; `app.js` recarga solo la vista |
| **Backoff 500/429 + countdown** | `api.js → request()` y `waitWithCountdown()` (1s,2s,4s,8s) |
| **Modo offline (localStorage)** | `api.js → load()` devuelve `{stale:true}`; `ui.staleBadge()` lo muestra |

Prohibiciones (1.6): no hay `alert()`, ni `.then()/.catch()`, ni `location.reload()`.

---

## 🎤 Guía para la DEFENSA (respóndelo con tus palabras)

Estas son las preguntas del documento (sección 3.1) con la respuesta que da
**tu** código. Estúdialas para poder explicarlas, no para memorizarlas.

**¿Qué pasa si la API devuelve 500 al pedir `/get/games`?**
`request()` detecta que 500 es reintentable y entra al `while` con backoff:
espera 1s, 2s, 4s, 8s (emitiendo el countdown). Si tras 4 reintentos sigue
fallando, lanza `HttpError(500)`; la vista cae a la caché de `localStorage`
(badge "Datos no actualizados") o muestra su estado de error con reintento.

**¿Por qué async/await y no .then/.catch en los eventos de scroll/clic?**
El backoff necesita *pausar* entre reintentos. Con `await sleep(ms)` el flujo se
lee secuencialmente (espera → reintenta) dentro de un `while`. Con `.then` habría
que encadenar promesas recursivas, mucho menos legible. Además el proyecto lo
prohíbe explícitamente.

**¿Qué ocurre si el token expira mientras el IntersectionObserver sigue activo?**
(Timeline) Los 104 partidos ya están en memoria; el observer **solo inserta DOM**,
no hace fetch. Por eso un 401 no rompe el scroll infinito. El 401 solo se dispara
al *pedir* datos, y ahí se limpia el token y se abre el modal de sesión.

**¿Por qué no `window.location.reload()` para un error de sesión?**
Recargar borra todo el estado de la interfaz (vista activa, scroll, favorito en
memoria) y crea un parpadeo. En su lugar se muestra un modal: el usuario se
reautentica y se recarga **solo la vista actual**, conservando el resto.

**¿Qué pasa con clics repetidos antes de terminar la animación de scroll?**
(Tour) Hay una bandera `scrolling`. Si haces clic en la *misma* sede mientras se
anima, se ignora. Si haces clic en *otra*, `scrollIntoView` simplemente reapunta;
no se abren dos animaciones en conflicto.

### Pruebas en DevTools (sección 3.2)
Para forzar errores en vivo: en la pestaña **Network** activa "Offline" (verás el
modo caché/skeletons), o usa "throttling". Para un 401, borra `wc_token` de
`Application → Local Storage` y dispara una petición → aparece el modal de sesión.
En **Console/Network** podrás mostrar el código de estado, los reintentos del
backoff y los tiempos de espera entre cada uno.
