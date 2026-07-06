/* ============================================================================
 * views/timeline.js  —  2.3 Timeline
 *   Todos      : carrusel de TODOS los partidos (scroll infinito de a 10).
 *   Jugados    : carrusel, solo partidos finalizados (con marcador).
 *   Pendientes : bracket de eliminatorias (de octavos a la final); muestra el
 *                equipo cuando se conoce y "Por definir" en el resto.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;
  var BLOCK = 10;

  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function toDate(s) { var d = new Date(s); return isNaN(d) ? null : d; }
  function shortDate(s) { var d = toDate(s); return d ? (DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]) : s; }
  function hourLabel(s) { var d = toDate(s); if (!d || (d.getHours() === 0 && d.getMinutes() === 0)) return ''; return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function orderKey(s) { var d = toDate(s); return d ? d.getTime() : Number.MAX_SAFE_INTEGER; }

  async function mount(root) {
    var sub = WC.ui.subtabs([
      { id: 'todos', label: 'Todos', icon: 'list' },
      { id: 'jugados', label: 'Jugados', icon: 'circle-check' },
      { id: 'pendientes', label: 'Pendientes', icon: 'sitemap' }
    ], function (id) { render(id); });
    root.appendChild(sub.nav);
    var body = el('div', {});
    root.appendChild(body);

    var gamesRes = await WC.api.load('/get/games');
    var teamsRes = await WC.api.load('/get/teams');
    if (!gamesRes.ok) {
      body.appendChild(WC.ui.errorNotice('No se pudieron cargar los partidos.', function () { root.innerHTML = ''; mount(root); }));
      return;
    }
    if (gamesRes.stale || teamsRes.stale) root.insertBefore(WC.ui.staleBadge(), body);

    var teamsIndex = U.indexById(U.asArray(teamsRes.ok ? teamsRes.data : []));
    function nameOf(id) { var t = teamsIndex[id]; return t ? (t.name_en || t.name_fa || ('Equipo ' + id)) : 'Por definir'; }

    var allGames = U.asArray(gamesRes.data).slice().sort(function (a, b) { return orderKey(a.local_date) - orderKey(b.local_date); });

    var observer = null;
    function render(mode) {
      if (observer) { observer.disconnect(); observer = null; }
      body.innerHTML = '';
      if (mode === 'pendientes') renderBracket();
      else renderCarousel(mode === 'jugados');
    }

    // ---------- CARRUSEL (Todos / Jugados) ----------
    function renderCarousel(onlyFinished) {
      var list = onlyFinished ? allGames.filter(function (g) { return g.finished; }) : allGames;

      var status = el('p', { class: 'has-text-grey is-size-7 mb-2' });
      var track = el('div', { class: 'tl-carousel' });
      var sentinel = el('div', { class: 'tl-sentinel' });
      track.appendChild(sentinel);

      var controls = el('div', { class: 'is-flex is-justify-content-space-between is-align-items-center mb-2' }, [
        status,
        el('div', {}, [
          arrow('angle-left', function () { track.scrollBy({ left: -370, behavior: 'smooth' }); }),
          arrow('angle-right', function () { track.scrollBy({ left: 370, behavior: 'smooth' }); })
        ])
      ]);
      body.appendChild(controls);
      body.appendChild(track);

      if (!list.length) { status.textContent = 'No hay partidos en este filtro.'; return; }

      var inserted = 0;
      function insertNext() {
        var slice = list.slice(inserted, inserted + BLOCK);
        slice.forEach(function (g) { track.insertBefore(card(g, nameOf), sentinel); });
        inserted += slice.length;
        status.textContent = 'Mostrados ' + inserted + ' de ' + list.length;
        if (inserted >= list.length && observer) observer.disconnect();
      }
      insertNext();
      if (inserted < list.length) {
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) insertNext(); });
        }, { root: track, rootMargin: '0px 200px' });
        observer.observe(sentinel);
      }
    }

    // ---------- BRACKET (Pendientes) ----------
    function renderBracket() {
      body.appendChild(el('p', { class: 'has-text-grey is-size-7 mb-3', text: 'Eliminatorias — el equipo aparece cuando se conoce; el resto queda “Por definir”.' }));

      // Partidos de eliminatoria = los que no pertenecen a un grupo.
      var knockout = allGames.filter(function (g) { return !g.group || String(g.group).trim() === ''; });
      var byType = {};
      knockout.forEach(function (g) { (byType[g.type || '?'] = byType[g.type || '?'] || []).push(g); });
      var rounds = Object.keys(byType).map(function (t) { return { games: byType[t] }; })
        .filter(function (r) { return r.games.length <= 8; })          // de octavos en adelante
        .sort(function (a, b) { return b.games.length - a.games.length; });

      if (!rounds.length) rounds = placeholderRounds();                // respaldo si no vienen en los datos

      var wrap = el('div', { class: 'bracket' });
      rounds.forEach(function (r) {
        var col = el('div', { class: 'bracket-col' });
        col.appendChild(el('p', { class: 'bracket-round', text: roundName(r.games.length) }));
        r.games.forEach(function (g) {
          col.appendChild(el('div', { class: 'bracket-match' }, [
            el('div', { class: 'bm-team', text: nameOf(g.home_team_id) }),
            el('div', { class: 'bm-team', text: nameOf(g.away_team_id) })
          ]));
        });
        wrap.appendChild(col);
      });
      body.appendChild(wrap);
    }

    render('todos');
  }

  function arrow(dir, onClick) {
    var b = WC.ui.el('button', { class: 'button is-dark ml-1', 'aria-label': dir }, [WC.ui.icon(dir)]);
    b.addEventListener('click', onClick);
    return b;
  }

  function card(g, nameOf) {
    var dt = shortDate(g.local_date) + (hourLabel(g.local_date) ? (' · ' + hourLabel(g.local_date)) : '');
    var label = g.group ? ('Grupo ' + g.group + ' · J' + g.matchday) : 'Eliminatoria';
    var scoreNode = g.finished
      ? WC.ui.el('div', { class: 'tl-score', text: g.home_score + ' - ' + g.away_score })
      : WC.ui.el('div', { class: 'tl-por', text: 'Por jugar' });
    return WC.ui.el('div', { class: 'tl-card2 has-text-centered' }, [
      WC.ui.el('div', { class: 'tl-dt', text: dt }),
      WC.ui.el('div', { class: 'tl-teams', text: nameOf(g.home_team_id) + ' vs ' + nameOf(g.away_team_id) }),
      scoreNode,
      WC.ui.el('div', { class: 'tl-gj', text: label })
    ]);
  }

  function roundName(n) {
    return ({ 8: 'Octavos', 4: 'Cuartos', 2: 'Semifinales', 1: 'Final' })[n] || ('Ronda (' + n + ')');
  }
  function placeholderRounds() {
    function fakes(n) { var a = []; for (var i = 0; i < n; i++) a.push({ home_team_id: null, away_team_id: null }); return a; }
    return [{ games: fakes(8) }, { games: fakes(4) }, { games: fakes(2) }, { games: fakes(1) }];
  }

  WC.views = WC.views || {};
  WC.views.timeline = { mount: mount };
})(window.WC = window.WC || {});