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
  var tabsWrapEl, tabsBurgerEl;

  // Cambia de pestaña y monta la vista.
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
  // Re-activa la pestaña actual.
  function reactivateCurrent() { activate(current || TABS[0]); }


  // Cierra sesión y muestra el login.
  function doLogout() {
    WC.auth.logout();
    if (viewRoot) viewRoot.innerHTML = '';
    refreshAuthUI();
    WC.ui.showAuthOverlay({ expired: false });
  }

  // Muestra u oculta el botón Salir según la sesión.
  function refreshAuthUI() {
    if (logoutBtn) logoutBtn.style.display = WC.auth.isLoggedIn() ? '' : 'none';
  }


  var FONT_MIN = 80, FONT_MAX = 150, FONT_STEP = 10, FONT_DEFAULT = 100;
  // Lee la escala de fuente guardada.
  function currentFontScale() {
    var v = parseInt(WC.store.getPref('fontScale'), 10);
    return isNaN(v) ? FONT_DEFAULT : Math.min(FONT_MAX, Math.max(FONT_MIN, v));
  }
  // Aplica y guarda la escala de fuente.
  function applyFontScale(pct) {
    pct = Math.min(FONT_MAX, Math.max(FONT_MIN, pct));
    document.documentElement.style.fontSize = pct + '%';
    WC.store.setPref('fontScale', pct);
    return pct;
  }
  // Cambia la escala de fuente.
  function changeFont(delta) { applyFontScale(currentFontScale() + delta); }
  // Restablece la escala de fuente.
  function resetFont() { applyFontScale(FONT_DEFAULT); }

  // ---- Tema claro/oscuro ----
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }
  // Actualiza el ícono del botón de tema.
  function refreshThemeBtn() {
    if (!themeBtn) return;
    var dark = currentTheme() === 'dark';
    themeBtn.innerHTML = '';
    themeBtn.appendChild(el('span', { class: 'icon' }, [el('i', { class: 'fas fa-' + (dark ? 'sun' : 'moon') })]));
    themeBtn.setAttribute('title', dark ? 'Cambiar a claro' : 'Cambiar a oscuro');
  }
  // Aplica y guarda el tema claro/oscuro.
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); WC.store.setPref('theme', t); refreshThemeBtn(); }
  // Alterna entre tema claro y oscuro.
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

  // Crea el botón de tema.
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

  // Construye la cabecera (título + Salir + conexión).
  function buildHero() {
    // Solo Salir + estado de conexión quedan fijos junto al título; el resto
    // de opciones (letra/tema) se mueven al botón flotante de accesibilidad.
    var controls = el('div', { class: 'hero-controls' }, [buildLogoutButton(), WC.ui.connectionDot()]);
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

  // ---- Botón flotante de accesibilidad (tamaño de letra + tema) ----
  function toggleA11yPanel(fab, panel) {
    panel.classList.toggle('is-hidden');
    var open = !panel.classList.contains('is-hidden');
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // Cierra el panel de accesibilidad al hacer clic fuera.
  function closeA11yPanelOnOutsideClick(e, fab, panel) {
    if (panel.classList.contains('is-hidden')) return;
    if (panel.contains(e.target) || fab.contains(e.target)) return;
    toggleA11yPanel(fab, panel);
  }

  // Crea el botón flotante de accesibilidad y su panel.
  function buildAccessibilityFab() {
    var panel = el('div', { class: 'a11y-panel is-hidden' }, [
      el('span', { class: 'a11y-panel-label', text: 'Tamaño de letra' }),
      buildFontControls(),
      el('span', { class: 'a11y-panel-label', text: 'Tema' }),
      buildThemeButton()
    ]);
    var fab = el('button', {
      class: 'a11y-fab', 'aria-label': 'Opciones de accesibilidad', title: 'Accesibilidad', 'aria-expanded': 'false'
    }, [el('span', { class: 'icon' }, [el('i', { class: 'fas fa-universal-access' })])]);
    fab.addEventListener('click', function () { toggleA11yPanel(fab, panel); });
    document.addEventListener('click', function (e) { closeA11yPanelOnOutsideClick(e, fab, panel); });
    return el('div', { class: 'a11y-fab-wrap' }, [panel, fab]);
  }

  // Crea una pestaña del menú.
  function buildTabItem(t) {
    var a = el('a', {}, [
      el('span', { class: 'icon is-small' }, [el('i', { class: 'fas fa-' + t.icon })]),
      el('span', { text: t.label })
    ]);
    var li = el('li', {}, [a]);
    li._id = t.id;
    a.addEventListener('click', function () { activate(t); closeTabsMenu(); });
    return li;
  }

  // ---- Menú hamburguesa de secciones (pantallas pequeñas) ----
  function toggleTabsMenu() {
    var open = tabsWrapEl.classList.toggle('is-open');
    tabsBurgerEl.classList.toggle('is-active', open);
    tabsBurgerEl.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // Cierra el menú hamburguesa.
  function closeTabsMenu() {
    if (!tabsWrapEl || !tabsWrapEl.classList.contains('is-open')) return;
    tabsWrapEl.classList.remove('is-open');
    tabsBurgerEl.classList.remove('is-active');
    tabsBurgerEl.setAttribute('aria-expanded', 'false');
  }

  // Crea el botón hamburguesa.
  function buildTabsBurger() {
    var b = el('button', {
      class: 'tabs-burger', 'aria-label': 'Abrir menú de secciones', 'aria-expanded': 'false'
    }, [el('span'), el('span'), el('span')]);
    b.addEventListener('click', toggleTabsMenu);
    return b;
  }

  // Construye la barra de pestañas con hamburguesa.
  function buildTabs() {
    tabList = el('ul');
    TABS.forEach(function (t) { tabList.appendChild(buildTabItem(t)); });
    tabsBurgerEl = buildTabsBurger();
    tabsWrapEl = el('div', { class: 'tabs is-boxed is-centered main-tabs' }, [tabList]);
    return el('div', { class: 'container tabs-bar' }, [tabsBurgerEl, tabsWrapEl]);
  }

  // Construye el pie de página.
  function buildFooter() {
    return el('footer', { class: 'app-footer' }, [
      el('div', { class: 'app-footer-stripe' }),
      el('div', { class: 'container app-footer-text', text: 'Mundial 2026 · Panel Interactivo — ISW-521 · Datos: worldcup26.ir' })
    ]);
  }

  // Arma la estructura general de la página.
  function buildShell() {
    var topbar = el('div', { class: 'topbar' }, [buildHero(), buildTabs()]);
    viewRoot = el('div', { id: 'view-root' });
    var content = el('div', { class: 'container', style: 'padding-top:18px;padding-bottom:60px' }, [viewRoot]);
    document.body.appendChild(topbar);
    document.body.appendChild(content);
    document.body.appendChild(buildFooter());
    document.body.appendChild(buildAccessibilityFab());
    refreshThemeBtn();
    refreshAuthUI();
  }

  // Arranca la app.
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