/* ============================================================================
 * views/timeline.js  —  2.3 Timeline Infinito  (Bulma + filtros)
 * Técnica requerida: IntersectionObserver, bloques de 10, sin duplicar.
 * Sub-opciones: filtros Todos / Jugados / Pendientes (reinician el timeline).
 * Resiliencia: si falla la carga inicial, error + reintento con backoff;
 * al recuperar, arranca desde cero sin duplicar.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;
  var BLOCK = 10;
  function parseDate(s) { var d = new Date(s); return isNaN(d) ? new Date(8640000000000000) : d; }

  async function mount(root) {
    var sub = WC.ui.subtabs([
      { id: 'todos', label: 'Todos', icon: 'list' },
      { id: 'jugados', label: 'Jugados', icon: 'circle-check' },
      { id: 'pendientes', label: 'Pendientes', icon: 'clock' }
    ], function (id) { filter = id; rebuild(); });
    root.appendChild(sub.nav);

    var status = el('p', { class: 'has-text-grey mb-3' });
    var list = el('div', {});
    var sentinel = el('div', { class: 'sentinel' });
    root.appendChild(status); root.appendChild(list); root.appendChild(sentinel);

    var allGames = [];
    var view = [];
    var inserted = 0;
    var observer = null;
    var filter = 'todos';

    function applyFilter() {
      view = allGames.filter(function (g) {
        if (filter === 'jugados') return g.finished;
        if (filter === 'pendientes') return !g.finished;
        return true;
      });
    }
    function reset() {
      if (observer) { observer.disconnect(); observer = null; }
      list.innerHTML = ''; inserted = 0;
    }
    function insertNext() {
      var slice = view.slice(inserted, inserted + BLOCK);
      slice.forEach(function (g) { list.appendChild(card(g)); });
      inserted += slice.length;
      if (inserted >= view.length) { if (observer) observer.disconnect(); status.textContent = 'Mostrando los ' + view.length + ' partidos.'; }
      else status.textContent = 'Mostrados ' + inserted + ' de ' + view.length + '…';
    }
    function startObserver() {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) insertNext(); });
      }, { rootMargin: '150px' });
      observer.observe(sentinel);
    }
    function rebuild() {
      reset(); applyFilter();
      if (!view.length) { status.textContent = 'No hay partidos en este filtro.'; return; }
      insertNext();
      if (inserted < view.length) startObserver();
    }

    async function load() {
      reset(); status.textContent = 'Cargando partidos…';
      try {
        var data = await WC.api.request('/get/games');
        allGames = U.asArray(data).slice().sort(function (a, b) { return parseDate(a.local_date) - parseDate(b.local_date); });
        rebuild();
      } catch (err) {
        if (err.status === 401) return;
        var cached = WC.store.readCache('/get/games');
        if (cached) {
          root.insertBefore(WC.ui.staleBadge(), status);
          allGames = U.asArray(cached.data).slice().sort(function (a, b) { return parseDate(a.local_date) - parseDate(b.local_date); });
          rebuild();
        } else {
          status.textContent = '';
          status.appendChild(WC.ui.errorNotice('No se pudieron cargar los partidos.', function () { status.innerHTML = ''; load(); }));
        }
      }
    }
    await load();
  }

  function card(g) {
    var score = g.finished ? (g.home_score + ' - ' + g.away_score) : 'Por jugar';
    var tagClass = g.finished ? 'is-success' : 'is-warning';
    return WC.ui.el('div', { class: 'box tl-card mb-2 py-3' }, [
      WC.ui.el('div', { class: 'is-flex is-justify-content-space-between is-align-items-center' }, [
        WC.ui.el('div', {}, [
          WC.ui.el('p', { class: 'has-text-grey is-size-7', text: g.local_date }),
          WC.ui.el('p', { class: 'has-text-weight-semibold', text: 'Equipo ' + g.home_team_id + '  vs  Equipo ' + g.away_team_id }),
          WC.ui.el('p', { class: 'is-size-7 has-text-grey', text: 'Grupo ' + g.group + ' · Jornada ' + g.matchday })
        ]),
        WC.ui.el('span', { class: 'tag ' + tagClass + ' is-medium', text: score })
      ])
    ]);
  }

  WC.views = WC.views || {};
  WC.views.timeline = { mount: mount };
})(window.WC = window.WC || {});
