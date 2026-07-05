/* ============================================================================
 * app.js  —  Arranque + router de pestañas (SPA)
 * El encabezado y las pestañas quedan fijos arriba (.topbar sticky); solo el
 * contenido de la vista se desplaza.
 * ============================================================================ */
(function (WC) {
  'use strict';
  var el = WC.ui.el;

  var TABS = [
    { id: 'tour', label: 'Tour de Sedes', icon: 'location-dot' },
    { id: 'agenda', label: 'Agenda Simultánea', icon: 'calendar-days' },
    { id: 'timeline', label: 'Timeline', icon: 'stream' },
    { id: 'dashboard', label: 'Dashboard Fanático', icon: 'heart' },
    { id: 'matriz', label: 'Matriz por Grupo', icon: 'table-cells' }
  ];

  var viewRoot, tabList, current = null;

  function activate(tab) {
    current = tab;
    [].forEach.call(tabList.children, function (li) { li.classList.toggle('is-active', li._id === tab.id); });
    viewRoot.innerHTML = '';
    WC.views[tab.id].mount(viewRoot);
  }
  function reloadCurrent() { activate(current || TABS[0]); }

  function buildShell() {
    var hero = el('section', { class: 'app-hero' }, [
      el('div', { class: 'container' }, [
        el('h1', { class: 'title is-3 brand-title' }, [
          el('span', { class: 'brand-ball', text: '⚽ ' }), 'Mundial 2026 · Panel Interactivo'
        ]),
        el('p', { class: 'subtitle is-6 has-text-grey', text: 'ISW-521 · Categoría B · Interfaces Interactivas y DOM Avanzado' })
      ])
    ]);

    tabList = el('ul');
    TABS.forEach(function (t) {
      var a = el('a', {}, [
        el('span', { class: 'icon is-small' }, [el('i', { class: 'fas fa-' + t.icon })]),
        el('span', { text: t.label })
      ]);
      var li = el('li', {}, [a]);
      li._id = t.id;
      a.addEventListener('click', function () { activate(t); });
      tabList.appendChild(li);
    });
    var tabs = el('div', { class: 'container' }, [el('div', { class: 'tabs is-boxed main-tabs' }, [tabList])]);

    // Barra superior fija (encabezado + pestañas).
    var topbar = el('div', { class: 'topbar' }, [hero, tabs]);

    viewRoot = el('div', { id: 'view-root' });
    var content = el('div', { class: 'container', style: 'padding-top:18px;padding-bottom:60px' }, [viewRoot]);

    document.body.appendChild(topbar);
    document.body.appendChild(content);
  }

  function start() {
    buildShell();
    WC.ui.wireBannerToApi();
    WC.ui.setAuthSuccessHandler(reloadCurrent);
    window.addEventListener(WC.api.EVENTS.SESSION_EXPIRED, function () {
      WC.ui.showAuthOverlay({ expired: true });
    });
    if (WC.auth.isLoggedIn()) activate(TABS[0]);
    else WC.ui.showAuthOverlay({ expired: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.WC = window.WC || {});