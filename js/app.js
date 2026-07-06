/* ============================================================================
 * app.js  —  Arranque + router de pestañas (SPA) + botón de tema claro/oscuro
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

  var viewRoot, tabList, themeBtn, current = null;

  function activate(tab) {
    current = tab;
    [].forEach.call(tabList.children, function (li) { li.classList.toggle('is-active', li._id === tab.id); });
    viewRoot.innerHTML = '';
    WC.views[tab.id].mount(viewRoot);
  }
  function reloadCurrent() { activate(current || TABS[0]); }

  // ---- Tema claro/oscuro ----
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }
  function refreshThemeBtn() {
    if (!themeBtn) return;
    var dark = currentTheme() === 'dark';
    themeBtn.innerHTML = '';
    themeBtn.appendChild(el('span', { class: 'icon' }, [el('i', { class: 'fas fa-' + (dark ? 'sun' : 'moon') })]));
    themeBtn.setAttribute('title', dark ? 'Cambiar a claro' : 'Cambiar a oscuro');
  }
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); WC.store.setPref('theme', t); refreshThemeBtn(); }
  function toggleTheme() { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'); }

  function buildShell() {
    themeBtn = el('button', { class: 'button is-dark is-small theme-toggle', 'aria-label': 'Cambiar tema' });
    themeBtn.addEventListener('click', toggleTheme);

    var hero = el('section', { class: 'app-hero' }, [
      el('div', { class: 'container hero-inner' }, [
        themeBtn,
        el('div', { class: 'has-text-centered' }, [
          el('h1', { class: 'title is-3 brand-title', text: 'MUNDIAL 2026 · Panel Interactivo' }),
          el('p', { class: 'subtitle is-6 has-text-grey', text: 'ISW-521 · Categoría B · Interfaces Interactivas y DOM Avanzado' })
        ])
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
    var tabs = el('div', { class: 'container' }, [el('div', { class: 'tabs is-boxed is-centered main-tabs' }, [tabList])]);

    var topbar = el('div', { class: 'topbar' }, [hero, tabs]);
    viewRoot = el('div', { id: 'view-root' });
    var content = el('div', { class: 'container', style: 'padding-top:18px;padding-bottom:60px' }, [viewRoot]);

    document.body.appendChild(topbar);
    document.body.appendChild(content);
    refreshThemeBtn();
  }

  function start() {
    var saved = WC.store.getPref('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);

    buildShell();
    WC.ui.wireBannerToApi();
    WC.ui.setAuthSuccessHandler(reloadCurrent);
    window.addEventListener(WC.api.EVENTS.SESSION_EXPIRED, function () { WC.ui.showAuthOverlay({ expired: true }); });

    if (WC.auth.isLoggedIn()) activate(TABS[0]);
    else WC.ui.showAuthOverlay({ expired: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.WC = window.WC || {});