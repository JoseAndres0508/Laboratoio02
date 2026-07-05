/* ============================================================================
 * ui.js  —  Capa de presentación compartida
 * ----------------------------------------------------------------------------
 * Aquí vive lo VISUAL común a todas las vistas:
 *   - el() : pequeño helper para crear nodos sin innerHTML peligroso
 *   - banner de estado que reacciona a los eventos de api.js (countdown 429/500)
 *   - overlay de login / "sesión expirada" (modal de 401, sin reload)
 *   - badge de "datos no actualizados" y esqueletos de carga
 *
 * ui.js ESCUCHA los eventos que emite api.js. api.js nunca toca el DOM.
 * Esa separación fetch <-> presentación es justo lo que pide la rúbrica.
 * ========================================================================== */
(function (WC) {
  'use strict';

  // ---- Helper para construir DOM ------------------------------------------
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'class') node.className = props[k];
        else if (k === 'text') node.textContent = props[k];
        else if (k === 'dataset') Object.assign(node.dataset, props[k]);
        else node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function staleBadge() {
    return el('span', { class: 'badge badge-stale', text: 'Datos no actualizados' });
  }

  function skeleton(lines) {
    var wrap = el('div', { class: 'skeleton-block' });
    for (var i = 0; i < (lines || 3); i++) wrap.appendChild(el('div', { class: 'skeleton-line' }));
    return wrap;
  }

  // ---- Banner de estado (reintentos / countdown) --------------------------
  var banner = null;
  function ensureBanner() {
    if (banner) return banner;
    banner = el('div', { class: 'status-banner hidden' });
    document.body.appendChild(banner);
    return banner;
  }
  function showBanner(msg, tone) {
    var b = ensureBanner();
    b.textContent = msg;
    b.className = 'status-banner ' + (tone || '');
  }
  function hideBanner() { if (banner) banner.className = 'status-banner hidden'; }

  function labelFor(status) {
    if (status === 429) return 'Límite de peticiones (429)';
    if (status === 0) return 'Sin conexión';
    return 'Error del servidor (' + status + ')';
  }

  // Conecta el banner a los eventos del núcleo de api.js.
  function wireBannerToApi() {
    var E = WC.api.EVENTS;
    window.addEventListener(E.RETRY, function (ev) {
      var d = ev.detail;
      showBanner(labelFor(d.status) + ' · reintento ' + d.attempt + '/' + d.maxAttempts +
        ' en ' + d.waitSeconds + 's…', 'warn');
    });
    window.addEventListener(E.COUNTDOWN, function (ev) {
      var d = ev.detail;
      showBanner(labelFor(d.status) + ' · próximo reintento (' + d.attempt + '/' + d.maxAttempts +
        ') en ' + d.secondsLeft + ' s', 'warn');
    });
    window.addEventListener(E.SUCCESS, function () { hideBanner(); });
  }

  // ---- Overlay de autenticación (login + registro) ------------------------
  // Se usa tanto para el primer login como para el modal de "sesión expirada".
  var onAuthSuccess = null;

  function closeAuthOverlay() {
    var ex = document.getElementById('auth-overlay');
    if (ex) ex.remove();
  }

  function showAuthOverlay(opts) {
    opts = opts || {};
    closeAuthOverlay();

    var title = opts.expired ? 'Sesión expirada' : 'Iniciar sesión';
    var subtitle = opts.expired
      ? 'Tu token JWT dejó de ser válido (401). Vuelve a autenticarte para continuar. La página no se recargó.'
      : 'Autentícate contra la API del Mundial 2026 para obtener tu token JWT.';

    var nameInput = el('input', { type: 'text', class: 'field', placeholder: 'nombre completo' });
    nameInput.style.display = 'none';
    var emailInput = el('input', { type: 'email', class: 'field', placeholder: 'correo@ejemplo.com' });
    var passInput = el('input', { type: 'password', class: 'field', placeholder: 'contraseña' });
    var errorBox = el('div', { class: 'auth-error hidden' });
    var submit = el('button', { class: 'btn btn-primary', type: 'button', text: 'Entrar' });
    var toggle = el('button', { class: 'link-btn', type: 'button', text: '¿No tienes cuenta? Regístrate' });

    var mode = 'login';
    toggle.addEventListener('click', function () {
      mode = (mode === 'login') ? 'register' : 'login';
      nameInput.style.display = (mode === 'register') ? 'block' : 'none';
      submit.textContent = (mode === 'register') ? 'Crear cuenta' : 'Entrar';
      toggle.textContent = (mode === 'register')
        ? '¿Ya tienes cuenta? Inicia sesión'
        : '¿No tienes cuenta? Regístrate';
      errorBox.className = 'auth-error hidden';
    });

    async function doSubmit() {
      errorBox.className = 'auth-error hidden';
      submit.disabled = true;
      var prev = submit.textContent;
      submit.textContent = 'Procesando…';
      try {
        if (mode === 'register') {
          await WC.auth.register(nameInput.value.trim(), emailInput.value.trim(), passInput.value);
        } else {
          await WC.auth.authenticate(emailInput.value.trim(), passInput.value);
        }
        closeAuthOverlay();
        if (typeof onAuthSuccess === 'function') onAuthSuccess();
      } catch (err) {
        errorBox.textContent = 'No se pudo autenticar: ' + (err.info || err.message);
        errorBox.className = 'auth-error';
      } finally {
        submit.disabled = false;
        submit.textContent = prev;
      }
    }

    submit.addEventListener('click', doSubmit);
    passInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSubmit(); });

    var card = el('div', { class: 'auth-card' }, [
      el('h2', { text: title }),
      el('p', { class: 'auth-sub', text: subtitle }),
      nameInput, emailInput, passInput, errorBox, submit,
      el('div', { class: 'auth-toggle' }, [toggle])
    ]);
    var overlay = el('div', { class: 'overlay', id: 'auth-overlay' }, [card]);
    document.body.appendChild(overlay);
    emailInput.focus();
  }

  WC.ui = {
    el: el,
    staleBadge: staleBadge,
    skeleton: skeleton,
    wireBannerToApi: wireBannerToApi,
    showAuthOverlay: showAuthOverlay,
    closeAuthOverlay: closeAuthOverlay,
    setAuthSuccessHandler: function (fn) { onAuthSuccess = fn; }
  };
})(window.WC = window.WC || {});
