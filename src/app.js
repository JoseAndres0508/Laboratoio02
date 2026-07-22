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
    { id: 'dashboard', label: 'Dashboard Fanático', icon: 'gauge-high' },
    { id: 'matriz', label: 'Matriz por Grupo', icon: 'table-cells' }
  ];

  var viewRoot, tabList, themeBtn, logoutBtn, current = null;

  async function activate(tab) {
    current = tab;
    [].forEach.call(tabList.children, function (li) { li.classList.toggle('is-active', li._id === tab.id); });
    viewRoot.innerHTML = '';

    try {
      await WC.views[tab.id].mount(viewRoot);
    } catch (err) {
      if (!err || err.status !== 401) {
        viewRoot.innerHTML = '';
        viewRoot.appendChild(WC.ui.errorNotice('Ocurrió un error al cargar esta sección.', function () { activate(tab); }));
      }
    }
  }
  function reactivateCurrent() { activate(current || TABS[0]); }


  function doLogout() {
    WC.auth.logout();
    if (viewRoot) viewRoot.innerHTML = '';
    refreshAuthUI();
    WC.ui.showAuthOverlay({ expired: false });
  }

  function refreshAuthUI() {
    if (logoutBtn) logoutBtn.style.display = WC.auth.isLoggedIn() ? '' : 'none';
  }


  var FONT_MIN = 80, FONT_MAX = 150, FONT_STEP = 10, FONT_DEFAULT = 100;
  function currentFontScale() {
    var v = parseInt(WC.store.getPref('fontScale'), 10);
    return isNaN(v) ? FONT_DEFAULT : Math.min(FONT_MAX, Math.max(FONT_MIN, v));
  }
  function applyFontScale(pct) {
    pct = Math.min(FONT_MAX, Math.max(FONT_MIN, pct));
    document.documentElement.style.fontSize = pct + '%';
    WC.store.setPref('fontScale', pct);
    return pct;
  }
  function changeFont(delta) { applyFontScale(currentFontScale() + delta); }
  function resetFont() { applyFontScale(FONT_DEFAULT); }

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
  function toggleTheme() {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    if (WC.applyFavTextColor) WC.applyFavTextColor(WC.store.getPref('favColor'));
    if (current && current.id === 'dashboard') activate(current);
  }

  // Controles de accesibilidad: reducir / restablecer / aumentar tamaño de letra.
  function buildFontControls() {
    var smaller = el('button', { class: 'button is-dark is-small font-btn', 'aria-label': 'Reducir tamaño de letra', title: 'Reducir tamaño de letra' }, [el('span', { text: 'A' })]);
    var reset = el('button', { class: 'button is-dark is-small font-btn font-btn-reset', 'aria-label': 'Restablecer tamaño de letra', title: 'Restablecer tamaño de letra' }, [el('span', { text: 'A' })]);
    var bigger = el('button', { class: 'button is-dark is-small font-btn font-btn-lg', 'aria-label': 'Aumentar tamaño de letra', title: 'Aumentar tamaño de letra' }, [el('span', { text: 'A' })]);
    smaller.addEventListener('click', function () { changeFont(-FONT_STEP); });
    reset.addEventListener('click', resetFont);
    bigger.addEventListener('click', function () { changeFont(FONT_STEP); });
    return el('div', { class: 'font-controls', role: 'group', 'aria-label': 'Tamaño de letra' }, [smaller, reset, bigger]);
  }

  function buildThemeButton() {
    themeBtn = el('button', { class: 'button is-dark is-small', 'aria-label': 'Cambiar tema' });
    themeBtn.addEventListener('click', toggleTheme);
    return themeBtn;
  }

  // Botón de cerrar sesión (se oculta cuando no hay sesión activa).
  function buildLogoutButton() {
    logoutBtn = el('button', { class: 'button is-dark is-small', 'aria-label': 'Cerrar sesión', title: 'Cerrar sesión' }, [
      el('span', { class: 'icon' }, [el('i', { class: 'fas fa-arrow-right-from-bracket' })]),
      el('span', { text: 'Salir' })
    ]);
    logoutBtn.addEventListener('click', doLogout);
    return logoutBtn;
  }

  function buildHero() {
    var controls = el('div', { class: 'hero-controls' }, [
      buildFontControls(), buildThemeButton(), buildLogoutButton(), WC.ui.connectionDot()
    ]);
    return el('section', { class: 'app-hero' }, [
      el('div', { class: 'container hero-inner' }, [
        controls,
        el('div', { class: 'has-text-centered' }, [
          el('h1', { class: 'title is-3 brand-title', text: 'MUNDIAL 2026 · Panel Interactivo' }),
          el('p', { class: 'subtitle is-6 has-text-grey', text: 'ISW-521 · Categoría B · Interfaces Interactivas y DOM Avanzado' })
        ])
      ])
    ]);
  }

  function buildTabItem(t) {
    var a = el('a', {}, [
      el('span', { class: 'icon is-small' }, [el('i', { class: 'fas fa-' + t.icon })]),
      el('span', { text: t.label })
    ]);
    var li = el('li', {}, [a]);
    li._id = t.id;
    a.addEventListener('click', function () { activate(t); });
    return li;
  }

  function buildTabs() {
    tabList = el('ul');
    TABS.forEach(function (t) { tabList.appendChild(buildTabItem(t)); });
    return el('div', { class: 'container' }, [el('div', { class: 'tabs is-boxed is-centered main-tabs' }, [tabList])]);
  }

  function buildFooter() {
    return el('footer', { class: 'app-footer' }, [
      el('div', { class: 'app-footer-stripe' }),
      el('div', { class: 'container app-footer-text', text: 'Mundial 2026 · Panel Interactivo — ISW-521 · Datos: worldcup26.ir' })
    ]);
  }

  function buildShell() {
    var topbar = el('div', { class: 'topbar' }, [buildHero(), buildTabs()]);
    viewRoot = el('div', { id: 'view-root' });
    var content = el('div', { class: 'container', style: 'padding-top:18px;padding-bottom:60px' }, [viewRoot]);
    document.body.appendChild(topbar);
    document.body.appendChild(content);
    document.body.appendChild(buildFooter());
    refreshThemeBtn();
    refreshAuthUI();
  }

  function start() {
    var saved = WC.store.getPref('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    applyFontScale(currentFontScale());

    buildShell();
    if (WC.applyFavTextColor) WC.applyFavTextColor(WC.store.getPref('favColor'));
    WC.ui.wireBannerToApi();
    WC.ui.setAuthSuccessHandler(function () { refreshAuthUI(); reactivateCurrent(); });
    window.addEventListener(WC.api.EVENTS.SESSION_EXPIRED, function () { refreshAuthUI(); WC.ui.showAuthOverlay({ expired: true }); });

    if (WC.auth.isLoggedIn()) activate(TABS[0]);
    else WC.ui.showAuthOverlay({ expired: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.WC = window.WC || {});