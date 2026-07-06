/* ============================================================================
 * auth.js  —  Autenticación (obtención del token JWT)
 * ----------------------------------------------------------------------------
 * Las rutas /auth/* son públicas (no llevan token todavía). Por eso usan su
 * propio fetch en lugar de WC.api.request (que está pensado para /get/* con
 * JWT + backoff). Aun así, mantenemos async/await y nada de .then()/.catch().
 * ========================================================================== */
(function (WC) {
  'use strict';

  var API_BASE = WC.api.API_BASE;

  async function postJson(path, payload) {
    var res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }

    if (!res.ok) {
      var msg = (data && (data.message || data.error)) || ('Error ' + res.status);
      throw new WC.HttpError(res.status, msg);
    }
    return data;
  }

  // POST /auth/authenticate { email, password } -> { user, token }
  async function authenticate(email, password) {
    var data = await postJson('/auth/authenticate', { email: email, password: password });
    if (!data || !data.token) throw new WC.HttpError(500, 'respuesta-sin-token');
    WC.store.setToken(data.token);
    return data.user;
  }

  // POST /auth/register { name, email, password } -> { user, token }
  async function register(name, email, password) {
    var data = await postJson('/auth/register', { name: name, email: email, password: password });
    if (!data || !data.token) throw new WC.HttpError(500, 'respuesta-sin-token');
    WC.store.setToken(data.token);
    return data.user;
  }

  WC.auth = {
    authenticate: authenticate,
    register: register,
    isLoggedIn: function () { return !!WC.store.getToken(); }
  };
})(window.WC = window.WC || {});
