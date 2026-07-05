# Mundial 2026 · Panel Interactivo — ISW-521 (Categoría B)

Aplicación web (SPA) en JavaScript que consume la API REST pública del Mundial
2026 (`worldcup26.ir`) y presenta cinco interfaces interactivas sobre un mismo
núcleo de resiliencia (autenticación JWT, backoff, modo offline).

Construida con JavaScript puro (sin frameworks de JS) y **Bulma** para los
estilos. La lógica de acceso a datos está separada de la presentación.

---

## ▶️ Cómo ejecutarlo

La app es estática y la API remota no envía cabeceras CORS, por lo que se
acompaña de un pequeño proxy local (`proxy.py`, solo Python estándar) que
reenvía las peticiones agregando dichas cabeceras. Se necesitan dos procesos:

```bash
# Terminal 1 — servir la app
python -m http.server 5500

# Terminal 2 — proxy CORS hacia la API
python proxy.py
```

Luego abrir **http://localhost:5500**.

La primera vez se crea una cuenta desde la propia pantalla de acceso
(botón *Regístrate*): nombre, correo y contraseña. La API devuelve un token JWT
que se guarda en `localStorage` (válido ~84 días); las siguientes veces basta
con iniciar sesión.

---

## 🗂️ Estructura

```
worldcup-app/
├── index.html
├── proxy.py              # puente CORS local hacia la API
├── css/styles.css        # capa propia sobre Bulma (tema + acento dinámico)
└── js/
    ├── store.js          # localStorage: token, caché por endpoint, preferencias
    ├── util.js           # utilidades (normalización de respuestas, índices)
    ├── api.js            # núcleo: fetch + JWT + backoff + countdown + 401 + caché
    ├── auth.js           # registro / inicio de sesión (token JWT)
    ├── ui.js             # presentación común: modal, banner, sub-tabs, chips
    ├── app.js            # arranque + router de pestañas
    └── views/
        ├── tour.js       # Tour de Sedes       — scrollIntoView
        ├── agenda.js     # Agenda Simultánea    — agrupación + layout dividido
        ├── timeline.js   # Timeline Infinito    — IntersectionObserver
        ├── dashboard.js  # Dashboard del Fanático — variables CSS + localStorage
        └── matriz.js     # Matriz por Grupo     — cuadrícula 4x4 + parcheo
```

`api.js` no manipula el DOM: emite eventos (countdown de reintentos, sesión
expirada, éxito) que `ui.js` escucha y pinta. Así la lógica de red queda
separada de la interfaz.

---

## 🧭 Secciones

Cada sección despliega sus propias opciones al entrar:

| Sección | Técnica de DOM | Sub-opciones |
|---|---|---|
| **Tour de Sedes** | `scrollIntoView` + estado de sede activa | Recorrido · Por país |
| **Agenda Simultánea** | agrupación por fecha + columnas | chips de fecha · anterior/siguiente |
| **Timeline Infinito** | `IntersectionObserver` (bloques de 10) | Todos · Jugados · Pendientes |
| **Dashboard del Fanático** | variables CSS por equipo + favorito persistido | Resumen · Partidos · Grupo |
| **Matriz por Grupo** | cuadrícula 4×4 cruzando 3 recursos | chips por grupo (A–L) |

---

## 🛡️ Arquitectura de resiliencia

Todas las secciones comparten el mismo núcleo (`api.js` + `store.js`):

- **JWT.** Cada petición a los endpoints de datos envía `Authorization: Bearer <token>`.
- **`async/await`.** Todas las llamadas se resuelven con async/await (sin `.then`/`.catch`).
- **401.** Si el token deja de ser válido, se limpia y se muestra un modal de
  reautenticación; no se recarga la página.
- **Backoff exponencial.** Ante 429/500 se reintenta con espera creciente
  (1s, 2s, 4s, 8s); en 429 se muestra una cuenta atrás visible.
- **Modo offline.** La última respuesta exitosa de cada endpoint se cachea en
  `localStorage`; si una petición falla y hay copia, se muestra con un aviso de
  datos no actualizados.

---

## 🌐 API

Base: `worldcup26.ir` (a través del proxy local).

| Recurso | Endpoint |
|---|---|
| Autenticación | `POST /auth/register`, `POST /auth/authenticate` |
| Sedes | `GET /get/stadiums` |
| Equipos | `GET /get/teams` |
| Grupos | `GET /get/groups` |
| Partidos | `GET /get/games` |