/* ============================================================================
 * app.js  —  Arranque y router de pestañas (SPA de una sola página)
 * ----------------------------------------------------------------------------
 * - Dibuja el header y la barra de pestañas (las 5 vistas).
 * - Monta la vista activa dentro de <main id="view-root">.
 * - Conecta el evento de "sesión expirada" (401): muestra el modal y, al
 *   reautenticar, RECARGA solo la vista actual (no la página -> sin reload()).
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el;

  var TABS = [
    { id: 'tour', label: 'Tour de Sedes' },
    { id: 'agenda', label: 'Agenda Simultánea' },
    { id: 'timeline', label: 'Timeline Infinito' },
    { id: 'dashboard', label: 'Dashboard del Fanático' },
    { id: 'matriz', label: 'Matriz por Grupo' }
  ];

  var viewRoot, navRoot, current = null;

  function activate(tab) {
    current = tab;
    var btns = navRoot.children;
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.id === tab.id);
    viewRoot.innerHTML = '';
    WC.views[tab.id].mount(viewRoot);
  }

  function reloadCurrent() {
    if (current) activate(current);
    else activate(TABS[0]);
  }

  function buildShell() {
    var header = el('header', { class: 'app-header' }, [
      el('div', { class: 'brand', text: '⚽ Mundial 2026 · Panel Interactivo' }),
      el('div', { class: 'brand-sub muted', text: 'ISW-521 · Categoría B' })
    ]);

    navRoot = el('nav', { class: 'tabs' });
    TABS.forEach(function (t) {
      var btn = el('button', { class: 'tab', dataset: { id: t.id }, text: t.label });
      btn.addEventListener('click', function () { activate(t); });
      navRoot.appendChild(btn);
    });

    viewRoot = el('main', { class: 'view', id: 'view-root' });

    document.body.appendChild(header);
    document.body.appendChild(navRoot);
    document.body.appendChild(viewRoot);
  }

  function start() {
    buildShell();
    WC.ui.wireBannerToApi();

    // Tras autenticarse (primer login o reautenticación) recargamos la vista.
    WC.ui.setAuthSuccessHandler(reloadCurrent);

    // 401 en cualquier vista -> modal de sesión expirada, SIN recargar la página.
    window.addEventListener(WC.api.EVENTS.SESSION_EXPIRED, function () {
      WC.ui.showAuthOverlay({ expired: true });
    });

    if (WC.auth.isLoggedIn()) {
      activate(TABS[0]);
    } else {
      WC.ui.showAuthOverlay({ expired: false });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window.WC = window.WC || {});
