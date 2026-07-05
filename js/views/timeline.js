/* ============================================================================
 * views/timeline.js  —  2.3 Timeline Infinito
 * ----------------------------------------------------------------------------
 * Técnica de DOM: IntersectionObserver sobre un centinela para insertar los
 * partidos de 10 en 10 a medida que el usuario hace scroll (sin paginar la
 * petición HTTP: se piden los 104 en UNA sola llamada).
 * Endpoint: GET /get/games.
 *
 * Reto de resiliencia: si la petición inicial falla, el observer NO queda
 * esperando: se muestra un error con botón de reintento (que dispara el
 * backoff). Al recuperar datos, la inserción arranca desde cero SIN duplicar.
 *
 * Defensa (token expira con el observer activo): los 104 partidos ya están en
 * memoria; el observer solo INSERTA DOM, no hace fetch. Por tanto un 401 no
 * afecta al scroll infinito; el 401 solo importa al pedir datos.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el;
  var BLOCK = 10;

  function parseDate(s) { var d = new Date(s); return isNaN(d) ? new Date(8640000000000000) : d; }

  async function mount(root) {
    root.appendChild(el('h1', { class: 'view-title', text: 'Timeline Infinito' }));

    var status = el('div', { class: 'timeline-status' });
    var list = el('div', { class: 'timeline-list' });
    var sentinel = el('div', { class: 'sentinel' });
    root.appendChild(status); root.appendChild(list); root.appendChild(sentinel);

    var games = [];
    var inserted = 0;
    var observer = null;

    function reset() {
      // Clave anti-duplicados: desconectamos el observer y vaciamos la lista
      // antes de (re)empezar. Así un reintento nunca duplica partidos.
      if (observer) { observer.disconnect(); observer = null; }
      list.innerHTML = '';
      inserted = 0;
    }

    function insertNextBlock() {
      var slice = games.slice(inserted, inserted + BLOCK);
      slice.forEach(function (g) { list.appendChild(card(g)); });
      inserted += slice.length;
      if (inserted >= games.length) {
        if (observer) observer.disconnect(); // ya no hay más: liberamos el observer
        status.textContent = 'Mostrando los ' + games.length + ' partidos.';
      } else {
        status.textContent = 'Mostrados ' + inserted + ' de ' + games.length + '…';
      }
    }

    function startObserver() {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) insertNextBlock(); });
      }, { rootMargin: '150px' });
      observer.observe(sentinel);
    }

    function begin() {
      insertNextBlock();                       // primer bloque inmediato
      if (inserted < games.length) startObserver();
    }

    async function load() {
      reset();
      status.textContent = 'Cargando partidos…';
      try {
        var data = await WC.api.request('/get/games'); // backoff automático dentro
        games = data.slice().sort(function (a, b) { return parseDate(a.local_date) - parseDate(b.local_date); });
        begin();
      } catch (err) {
        if (err.status === 401) return; // el modal de sesión se encarga
        var cached = WC.store.readCache('/get/games');
        if (cached) {
          status.innerHTML = '';
          status.appendChild(WC.ui.staleBadge());
          games = cached.data.slice().sort(function (a, b) { return parseDate(a.local_date) - parseDate(b.local_date); });
          begin();
        } else {
          showError();
        }
      }
    }

    function showError() {
      status.innerHTML = '';
      var box = el('div', { class: 'error-box' }, [
        el('span', { text: 'No se pudieron cargar los partidos. ' })
      ]);
      var retry = el('button', { class: 'btn', text: 'Reintentar' });
      retry.addEventListener('click', function () { load(); }); // dispara backoff
      box.appendChild(retry);
      status.appendChild(box);
    }

    await load();
  }

  function card(g) {
    var score = g.finished ? (g.home_score + ' - ' + g.away_score) : 'Por jugar';
    return WC.ui.el('div', { class: 'tl-card' }, [
      WC.ui.el('div', { class: 'tl-date', text: g.local_date }),
      WC.ui.el('div', { class: 'tl-main', text: 'Equipo ' + g.home_team_id + '  vs  Equipo ' + g.away_team_id }),
      WC.ui.el('div', { class: 'tl-meta muted', text: 'Grupo ' + g.group + ' · Jornada ' + g.matchday + ' · ' + score })
    ]);
  }

  WC.views = WC.views || {};
  WC.views.timeline = { mount: mount };
})(window.WC = window.WC || {});
