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
  function wireBannerToApi() {
    var E = WC.api.EVENTS;
    window.addEventListener(E.RETRY, function (ev) {
      var d = ev.detail; var b = ensureBanner();
      b.className = 'status-banner';
      b.textContent = '⏳ ' + labelFor(d.status) + ' · reintento ' + d.attempt + '/' + d.maxAttempts + ' en ' + d.waitSeconds + 's…';
    });
    window.addEventListener(E.COUNTDOWN, function (ev) {
      var d = ev.detail; var b = ensureBanner();
      b.className = 'status-banner';
      b.textContent = '⏳ ' + labelFor(d.status) + ' · próximo reintento (' + d.attempt + '/' + d.maxAttempts + ') en ' + d.secondsLeft + ' s';
    });
    window.addEventListener(E.SUCCESS, function () { if (banner) banner.className = 'status-banner hidden'; });
  }

  // ---- Overlay de autenticación (login + registro / sesión expirada) ----
  var onAuthSuccess = null;

  function closeAuthOverlay() { var ex = document.getElementById('auth-overlay'); if (ex) ex.remove(); }

  function showAuthOverlay(opts) {
    opts = opts || {};
    closeAuthOverlay();
    var title = opts.expired ? 'Sesión expirada' : 'Iniciar sesión';
    var subtitle = opts.expired
      ? 'Tu token JWT dejó de ser válido (401). Vuelve a autenticarte; la página no se recargó.'
      : 'Regístrate (correo y clave inventados) o inicia sesión para obtener tu token JWT.';

    var nameField = field('Nombre', 'text', 'user');
    nameField.wrap.style.display = 'none';
    var emailField = field('Correo', 'email', 'envelope');
    var passField = field('Contraseña', 'password', 'lock');
    var errorBox = el('p', { class: 'help is-danger', style: 'display:none' });
    var submit = el('button', { class: 'button is-primary is-fullwidth mt-2', type: 'button', text: 'Entrar' });
    var toggle = el('a', { text: '¿No tienes cuenta? Regístrate' });

    var mode = 'login';
    toggle.addEventListener('click', function () {
      mode = (mode === 'login') ? 'register' : 'login';
      nameField.wrap.style.display = (mode === 'register') ? 'block' : 'none';
      submit.textContent = (mode === 'register') ? 'Crear cuenta' : 'Entrar';
      toggle.textContent = (mode === 'register') ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate';
      errorBox.style.display = 'none';
    });

    async function doSubmit() {
      errorBox.style.display = 'none';
      submit.classList.add('is-loading');
      try {
        if (mode === 'register') await WC.auth.register(nameField.input.value.trim(), emailField.input.value.trim(), passField.input.value);
        else await WC.auth.authenticate(emailField.input.value.trim(), passField.input.value);
        closeAuthOverlay();
        if (typeof onAuthSuccess === 'function') onAuthSuccess();
      } catch (err) {
        errorBox.textContent = 'No se pudo autenticar: ' + (err.info || err.message);
        errorBox.style.display = 'block';
      } finally {
        submit.classList.remove('is-loading');
      }
    }
    submit.addEventListener('click', doSubmit);
    passField.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSubmit(); });

    var card = el('div', { class: 'box', style: 'width:100%;max-width:400px' }, [
      el('h2', { class: 'title is-4 mb-1' }, [el('span', { class: 'brand-ball', text: '⚽ ' }), title]),
      el('p', { class: 'subtitle is-6 has-text-grey mb-4', text: subtitle }),
      nameField.wrap, emailField.wrap, passField.wrap, errorBox, submit,
      el('div', { class: 'has-text-centered mt-4' }, [toggle])
    ]);
    var overlay = el('div', {
      id: 'auth-overlay', class: 'modal is-active'
    }, [
      el('div', { class: 'modal-background' }),
      el('div', { class: 'modal-content' }, [card])
    ]);
    document.body.appendChild(overlay);
    emailField.input.focus();
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
    subtabs: subtabs, chip: chip, wireBannerToApi: wireBannerToApi,
    showAuthOverlay: showAuthOverlay, closeAuthOverlay: closeAuthOverlay,
    setAuthSuccessHandler: function (fn) { onAuthSuccess = fn; }
  };
})(window.WC = window.WC || {});
