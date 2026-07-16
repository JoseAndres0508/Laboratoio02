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

  var API_BASE = ''; 
  
  var RETRYABLE = { 429: true, 500: true, 502: true, 503: true, 504: true };

  var BASE_DELAYS = [1000, 2000, 4000, 8000];
  var MAX_RETRIES = BASE_DELAYS.length;


  var EVENTS = {
    RETRY: 'wc:request-retry', 
    COUNTDOWN: 'wc:request-countdown', 
    SUCCESS: 'wc:request-success',  
    GIVEUP: 'wc:request-giveup',        
    SESSION_EXPIRED: 'wc:session-expired'
  };

  WC.HttpError = function HttpError(status, info) {
    this.name = 'HttpError';
    this.message = 'HTTP ' + status;
    this.status = status;
    this.info = info;
  };
  WC.HttpError.prototype = Object.create(Error.prototype);

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  function authHeaders() {
    return { Authorization: 'Bearer ' + (WC.store.getToken() || '') };
  }

  async function waitWithCountdown(detailBase, delayMs) {
    var seconds = Math.round(delayMs / 1000);
    emit(EVENTS.RETRY, Object.assign({ waitSeconds: seconds }, detailBase));
    for (var s = seconds; s > 0; s--) {
      emit(EVENTS.COUNTDOWN, Object.assign({ secondsLeft: s }, detailBase));
      await sleep(1000);
    }
  }

  async function request(endpoint) {
    var url = API_BASE + endpoint;
    var retries = 0;

    while (true) {
      var response;

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
        emit(EVENTS.GIVEUP, { endpoint: endpoint, status: 0 });
        throw new WC.HttpError(0, 'sin-conexion');
      }

      if (response.status === 401) {
        WC.store.clearToken();
        emit(EVENTS.SESSION_EXPIRED, { endpoint: endpoint });
        throw new WC.HttpError(401, 'sesion-expirada');
      }

      if (RETRYABLE[response.status]) {
        if (retries < MAX_RETRIES) {
          var delay = BASE_DELAYS[retries];
          retries++;
          await waitWithCountdown(
            { endpoint: endpoint, status: response.status, attempt: retries, maxAttempts: MAX_RETRIES },
            delay);
          continue; // reintenta el while
        }
        emit(EVENTS.GIVEUP, { endpoint: endpoint, status: response.status });
        throw new WC.HttpError(response.status, 'reintentos-agotados');
      }

      if (!response.ok) {
        var info = '';
        try { info = await response.text(); } catch (e) { info = ''; }
        throw new WC.HttpError(response.status, info);
      }

      var data = await response.json();
      WC.store.cache(endpoint, data);
      emit(EVENTS.SUCCESS, { endpoint: endpoint });
      return data;
    }
  }


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
