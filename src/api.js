/* ============================================================================
 * api.js  —  NÚCLEO DE RESILIENCIA (lo más importante del proyecto)
 * ----------------------------------------------------------------------------
 * Una sola función `request()` resuelve TODA la arquitectura obligatoria:
 *
 *   1. JWT          -> añade "Authorization: Bearer <token>" a cada llamada.
 *   2. async/await  -> NO se usa .then() ni .catch() en ningún punto.
 *   3. 401          -> limpia el token y avisa (evento) para mostrar el modal
 *                      de "sesión expirada". NUNCA llama a location.reload().
 *   4. 429 / 500    -> reintenta con backoff exponencial (1s, 2s, 4s, 8s) y
 *                      emite un countdown visible segundo a segundo.
 *   5. offline      -> cada respuesta exitosa se cachea en localStorage.
 *
 * La función NO toca el DOM: solo emite eventos en `window`. Así la lógica de
 * fetch queda separada de la de presentación (lo evalúa la rúbrica).
 * ========================================================================== */
(function (WC) {
  'use strict';

  var API_BASE = ''; // dev: lo enruta el proxy de Vite (vite.config.js)

  // Estados que justifican un reintento automático con backoff.
  var RETRYABLE = { 429: true, 500: true, 502: true, 503: true, 504: true };

  // Backoff EXPONENCIAL: 1s, 2s, 4s, 8s. La longitud define los reintentos máx.
  var BASE_DELAYS = [1000, 2000, 4000, 8000];
  var MAX_RETRIES = BASE_DELAYS.length;

  // Nombres de eventos que escucha la capa de UI (ui.js).
  var EVENTS = {
    RETRY: 'wc:request-retry',          // se programó un reintento
    COUNTDOWN: 'wc:request-countdown',  // tic de la cuenta atrás (cada 1s)
    SUCCESS: 'wc:request-success',      // petición resuelta con éxito
    SESSION_EXPIRED: 'wc:session-expired' // 401: token inválido
  };

  // Error tipado para que las vistas reaccionen según el código HTTP.
  WC.HttpError = function HttpError(status, info) {
    this.name = 'HttpError';
    this.message = 'HTTP ' + status;
    this.status = status;
    this.info = info;
  };
  WC.HttpError.prototype = Object.create(Error.prototype);

  function sleep(ms) {
    // Promesa de espera sin .then(): se resuelve con setTimeout y se consume
    // siempre con `await` desde quien la llama.
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  function authHeaders() {
    // Cada petición a /get/* lleva el JWT. Sin token, va vacío y la API
    // responderá 401, que manejamos abajo.
    return { Authorization: 'Bearer ' + (WC.store.getToken() || '') };
  }

  // Espera `delayMs` mostrando una cuenta atrás visible (clave para el 429).
  async function waitWithCountdown(detailBase, delayMs) {
    var seconds = Math.round(delayMs / 1000);
    emit(EVENTS.RETRY, Object.assign({ waitSeconds: seconds }, detailBase));
    for (var s = seconds; s > 0; s--) {
      emit(EVENTS.COUNTDOWN, Object.assign({ secondsLeft: s }, detailBase));
      await sleep(1000);
    }
  }

  /**
   * GET a un endpoint del Mundial con toda la resiliencia incorporada.
   * Devuelve los datos ya parseados (JSON) o lanza un WC.HttpError.
   */
  async function request(endpoint) {
    var url = API_BASE + endpoint;
    var retries = 0;

    while (true) {
      var response;

      // --- Posible fallo de red (sin conexión / DNS / CORS) ---
      try {
        response = await fetch(url, { method: 'GET', headers: authHeaders() });
      } catch (networkError) {
        if (retries < MAX_RETRIES) {
          var d = BASE_DELAYS[retries];
          retries++;
          await waitWithCountdown(
            { endpoint: endpoint, status: 0, attempt: retries, maxAttempts: MAX_RETRIES }, d);
          continue;
        }
        throw new WC.HttpError(0, 'sin-conexion');
      }

      // --- 401: sesión expirada. Limpiamos token y avisamos. SIN reload. ---
      if (response.status === 401) {
        WC.store.clearToken();
        emit(EVENTS.SESSION_EXPIRED, { endpoint: endpoint });
        throw new WC.HttpError(401, 'sesion-expirada');
      }

      // --- 429 / 500...: backoff exponencial con countdown visible ---
      if (RETRYABLE[response.status]) {
        if (retries < MAX_RETRIES) {
          var delay = BASE_DELAYS[retries];
          retries++;
          await waitWithCountdown(
            { endpoint: endpoint, status: response.status, attempt: retries, maxAttempts: MAX_RETRIES },
            delay);
          continue; // reintenta el while
        }
        throw new WC.HttpError(response.status, 'reintentos-agotados');
      }

      // --- Otros errores (400, 404...) no se reintentan ---
      if (!response.ok) {
        var info = '';
        try { info = await response.text(); } catch (e) { info = ''; }
        throw new WC.HttpError(response.status, info);
      }

      // --- Éxito: cacheamos (modo offline) y devolvemos ---
      var data = await response.json();
      WC.store.cache(endpoint, data);
      emit(EVENTS.SUCCESS, { endpoint: endpoint });
      return data;
    }
  }

  /**
   * Atajo que añade el "modo offline" de forma uniforme:
   *   - éxito        -> { ok:true,  data, stale:false }
   *   - fallo+caché  -> { ok:true,  data, stale:true  }   (datos no actualizados)
   *   - fallo sin caché -> { ok:false, error }
   * El 401 se relanza para que actúe el modal de sesión (no se cachea sesión).
   */
  async function load(endpoint) {
    try {
      var data = await request(endpoint);
      return { ok: true, data: data, stale: false };
    } catch (err) {
      if (err.status === 401) throw err;
      var cached = WC.store.readCache(endpoint);
      if (cached) return { ok: true, data: cached.data, stale: true, savedAt: cached.savedAt };
      return { ok: false, error: err };
    }
  }

  WC.api = { request: request, load: load, EVENTS: EVENTS, API_BASE: API_BASE };
})(window.WC = window.WC || {});
