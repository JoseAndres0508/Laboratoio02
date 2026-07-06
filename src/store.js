/* ============================================================================
 * store.js  —  Capa de persistencia (localStorage)
 * ----------------------------------------------------------------------------
 * Aquí vive TODO lo que toca localStorage:
 *   - el token JWT
 *   - la caché de la última respuesta exitosa de cada endpoint (modo offline)
 *   - las preferencias del usuario (p. ej. el equipo favorito del Dashboard)
 *
 * Mantener esto separado hace que el resto del código no dependa directamente
 * de localStorage: si mañana cambiáramos a IndexedDB, solo se toca este archivo.
 * ========================================================================== */
(function (WC) {
  'use strict';

  var TOKEN_KEY = 'wc_token';
  var CACHE_PREFIX = 'wc_cache:';
  var PREF_PREFIX = 'wc_pref:';

  WC.store = {
    // ---- Token JWT ----
    getToken: function () { return localStorage.getItem(TOKEN_KEY); },
    setToken: function (t) { localStorage.setItem(TOKEN_KEY, t); },
    clearToken: function () { localStorage.removeItem(TOKEN_KEY); },

    // ---- Caché por endpoint (modo offline) ----
    // Guardamos { data, savedAt } para poder mostrar "cuándo" se cacheó.
    cache: function (endpoint, data) {
      try {
        localStorage.setItem(CACHE_PREFIX + endpoint,
          JSON.stringify({ data: data, savedAt: Date.now() }));
      } catch (e) {
        // Si el almacenamiento está lleno simplemente no cacheamos; no rompemos.
      }
    },
    readCache: function (endpoint) {
      var raw = localStorage.getItem(CACHE_PREFIX + endpoint);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    },

    // ---- Preferencias persistentes ----
    setPref: function (key, value) { localStorage.setItem(PREF_PREFIX + key, value); },
    getPref: function (key) { return localStorage.getItem(PREF_PREFIX + key); }
  };
})(window.WC = window.WC || {});
