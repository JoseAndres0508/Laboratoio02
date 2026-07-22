/* ============================================================================
 * ui.js  —  Capa de presentación compartida (estilizada con Bulma)
 * ----------------------------------------------------------------------------
 * Sigue el mismo principio: api.js emite eventos, ui.js los pinta. api.js
 * nunca toca el DOM. Aquí viven helpers de DOM, el banner de countdown, el
 * modal de login/sesión, los sub-tabs y los "chips".
 * ========================================================================== */
(function (WC) {
  'use strict';

  // ---- Helper para construir DOM ----
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'class') node.className = props[k];
        else if (k === 'text') node.textContent = props[k];
        else if (k === 'html') node.innerHTML = props[k];
        else if (k === 'dataset') Object.assign(node.dataset, props[k]);
        else node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function icon(name) { return el('span', { class: 'icon' }, [el('i', { class: 'fas fa-' + name })]); }

  function staleBadge() {
    return el('div', { class: 'stale-badge' }, [
      el('span', { class: 'icon is-small' }, [el('i', { class: 'fas fa-triangle-exclamation' })]),
      el('span', { text: 'Datos no actualizados (offline)' })
    ]);
  }

  function skeleton(lines) {
    var wrap = el('div', {});
    for (var i = 0; i < (lines || 3); i++) wrap.appendChild(el('div', { class: 'skel skel-line' }));
    return wrap;
  }

  function errorNotice(msg, onRetry) {
    var box = el('div', { class: 'notification is-danger is-light' });
    box.appendChild(el('p', {}, [msg]));
    if (onRetry) {
      var btn = el('button', { class: 'button is-small is-danger mt-2' }, [icon('rotate-right'), el('span', { text: 'Reintentar' })]);
      btn.addEventListener('click', onRetry);
      box.appendChild(btn);
    }
    return box;
  }

  // ---- Sub-tabs (las "opciones" que se despliegan dentro de cada sección) ----
  function subtabs(items, onSelect, activeId) {
    var lis = [];
    var ul = el('ul');
    items.forEach(function (it) {
      var a = el('a', {}, [it.icon ? icon(it.icon) : null, el('span', { text: it.label })]);
      var li = el('li', {}, [a]);
      li._id = it.id;
      a.addEventListener('click', function () { setActive(it.id); onSelect(it.id); });
      lis.push(li); ul.appendChild(li);
    });
    var nav = el('div', { class: 'tabs is-toggle is-small subtabs' }, [ul]);
    function setActive(id) { lis.forEach(function (li) { li.classList.toggle('is-active', li._id === id); }); }
    setActive(activeId || items[0].id);
    return { nav: nav, setActive: setActive };
  }

  // ---- Chip clicable ----
  function chip(label, active, onClick) {
    var t = el('button', { class: 'button is-small ' + (active ? 'is-primary' : 'is-dark'), text: label });
    t.addEventListener('click', onClick);
    return t;
  }

  // ---- Indicador de conexión (punto verde/rojo) ----
  function updateConnDot(dot) {
    var online = navigator.onLine;
    dot.classList.toggle('is-online', online);
    dot.classList.toggle('is-offline', !online);
    dot.setAttribute('title', online ? 'En línea' : 'Sin conexión');
    dot.setAttribute('aria-label', online ? 'En línea' : 'Sin conexión');
  }

  function connectionDot() {
    var dot = el('span', { class: 'conn-dot' });
    updateConnDot(dot);
    window.addEventListener('online', function () { updateConnDot(dot); });
    window.addEventListener('offline', function () { updateConnDot(dot); });
    return dot;
  }

  // ---- Banner de estado (reintentos / countdown 429-500) ----
  var banner = null;
  function ensureBanner() {
    if (banner) return banner;
    banner = el('div', { class: 'status-banner hidden' });
    document.body.appendChild(banner);
    return banner;
  }
  function labelFor(status) {
    if (status === 429) return 'Límite de peticiones (429)';
    if (status === 0) return 'Sin conexión';
    return 'Error del servidor (' + status + ')';
  }
  function bannerHide() { if (banner) banner.className = 'status-banner hidden'; }
  function bannerRetry(ev) {
    var d = ev.detail; var b = ensureBanner();
    b.className = 'status-banner';
    b.textContent = '⏳ ' + labelFor(d.status) + ' · reintento ' + d.attempt + '/' + d.maxAttempts + ' en ' + d.waitSeconds + 's…';
  }
  function bannerCountdown(ev) {
    var d = ev.detail; var b = ensureBanner();
    b.className = 'status-banner';
    b.textContent = '⏳ ' + labelFor(d.status) + ' · próximo reintento (' + d.attempt + '/' + d.maxAttempts + ') en ' + d.secondsLeft + ' s';
  }
  // Se agotaron los reintentos: pasamos el banner a estado de error (para que
  // NO se quede congelado el countdown) y lo ocultamos tras unos segundos.
  function bannerGiveup(ev) {
    var d = ev.detail; var b = ensureBanner();
    b.className = 'status-banner is-error';
    b.textContent = '⚠️ ' + labelFor(d.status) + ' · no se pudo completar tras varios reintentos';
    clearTimeout(b._hideTimer);
    b._hideTimer = setTimeout(bannerHide, 5000);
  }
  function wireBannerToApi() {
    var E = WC.api.EVENTS;
    window.addEventListener(E.RETRY, bannerRetry);
    window.addEventListener(E.COUNTDOWN, bannerCountdown);
    window.addEventListener(E.SUCCESS, bannerHide);
    window.addEventListener(E.GIVEUP, bannerGiveup);
  }

  // ---- Overlay de autenticación (login + registro / sesión expirada) ----
  var onAuthSuccess = null;

  function closeAuthOverlay() { var ex = document.getElementById('auth-overlay'); if (ex) ex.remove(); }

  function authTexts(opts) {
    return {
      title: opts.expired ? 'Sesión expirada' : 'Iniciar sesión',
      subtitle: opts.expired
        ? 'Tu token JWT dejó de ser válido (401). Vuelve a autenticarte; la página no se recargó.'
        : 'Regístrate (correo y clave inventados) o inicia sesión para obtener tu token JWT.'
    };
  }

  // Construye los campos del formulario y guarda su estado (modo login/registro).
  function buildAuthForm() {
    var nameField = field('Nombre', 'text', 'user');
    nameField.wrap.style.display = 'none';
    var f = {
      nameField: nameField,
      emailField: field('Correo', 'email', 'envelope'),
      passField: field('Contraseña', 'password', 'lock'),
      errorBox: el('p', { class: 'help is-danger', style: 'display:none' }),
      submit: el('button', { class: 'button is-primary is-fullwidth mt-2', type: 'button', text: 'Entrar' }),
      toggle: el('a', { text: '¿No tienes cuenta? Regístrate' }),
      mode: 'login'
    };
    return f;
  }

  // Refleja el modo actual (login/registro) en las etiquetas y campos.
  function applyAuthMode(f) {
    var reg = f.mode === 'register';
    f.nameField.wrap.style.display = reg ? 'block' : 'none';
    f.submit.textContent = reg ? 'Crear cuenta' : 'Entrar';
    f.toggle.textContent = reg ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate';
    f.errorBox.style.display = 'none';
  }

  async function submitAuth(f) {
    f.errorBox.style.display = 'none';
    f.submit.classList.add('is-loading');
    try {
      if (f.mode === 'register') await WC.auth.register(f.nameField.input.value.trim(), f.emailField.input.value.trim(), f.passField.input.value);
      else await WC.auth.authenticate(f.emailField.input.value.trim(), f.passField.input.value);
      closeAuthOverlay();
      if (typeof onAuthSuccess === 'function') onAuthSuccess();
    } catch (err) {
      f.errorBox.textContent = 'No se pudo autenticar: ' + (err.info || err.message);
      f.errorBox.style.display = 'block';
    } finally {
      f.submit.classList.remove('is-loading');
    }
  }

  function wireAuthForm(f) {
    f.toggle.addEventListener('click', function () { f.mode = (f.mode === 'login') ? 'register' : 'login'; applyAuthMode(f); });
    f.submit.addEventListener('click', function () { submitAuth(f); });
    f.passField.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitAuth(f); });
  }

  function buildAuthCard(t, f) {
    return el('div', { class: 'box', style: 'width:100%;max-width:400px' }, [
      el('h2', { class: 'title is-4 mb-1' }, [el('span', { class: 'brand-ball', text: '⚽ ' }), t.title]),
      el('p', { class: 'subtitle is-6 has-text-grey mb-4', text: t.subtitle }),
      f.nameField.wrap, f.emailField.wrap, f.passField.wrap, f.errorBox, f.submit,
      el('div', { class: 'has-text-centered mt-4' }, [f.toggle])
    ]);
  }

  function showAuthOverlay(opts) {
    opts = opts || {};
    closeAuthOverlay();
    var f = buildAuthForm();
    wireAuthForm(f);
    var overlay = el('div', { id: 'auth-overlay', class: 'modal is-active' }, [
      el('div', { class: 'modal-background' }),
      el('div', { class: 'modal-content' }, [buildAuthCard(authTexts(opts), f)])
    ]);
    document.body.appendChild(overlay);
    f.emailField.input.focus();
  }

  function field(label, type, iconName) {
    var input = el('input', { class: 'input', type: type, placeholder: label });
    var control = el('div', { class: 'control has-icons-left' }, [
      input,
      el('span', { class: 'icon is-small is-left' }, [el('i', { class: 'fas fa-' + iconName })])
    ]);
    var wrap = el('div', { class: 'field' }, [
      el('label', { class: 'label is-small', text: label }), control
    ]);
    return { wrap: wrap, input: input };
  }

  WC.ui = {
    el: el, icon: icon, staleBadge: staleBadge, skeleton: skeleton, errorNotice: errorNotice,
    subtabs: subtabs, chip: chip, wireBannerToApi: wireBannerToApi, connectionDot: connectionDot,
    showAuthOverlay: showAuthOverlay, closeAuthOverlay: closeAuthOverlay,
    setAuthSuccessHandler: function (fn) { onAuthSuccess = fn; }
  };
})(window.WC = window.WC || {});
