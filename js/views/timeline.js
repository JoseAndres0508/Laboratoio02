/* ============================================================================
 * views/timeline.js  —  2.3 Timeline
 *   Todos      : grid de cards; scroll infinito real (IntersectionObserver, 10).
 *   Jugados    : mismo grid, solo partidos finalizados.
 *   Pendientes : bracket de eliminatorias de OCTAVOS a la final (con marcador
 *                si ya se jugó, o "Por definir" si no).
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
      { id: 'todos', label: 'Todos', icon: 'table-cells' },
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
      else renderGrid(mode === 'jugados');
    }

    // ---------- GRID + scroll infinito (Todos / Jugados) ----------
    function renderGrid(onlyFinished) {
      var list = onlyFinished ? allGames.filter(function (g) { return g.finished; }) : allGames;
      var status = el('p', { class: 'has-text-grey is-size-7 mb-2' });
      var grid = el('div', { class: 'tl-grid' });
      var sentinel = el('div', { class: 'tl-sentinel-v' });
      body.appendChild(status); body.appendChild(grid); body.appendChild(sentinel);

      if (!list.length) { status.textContent = 'No hay partidos en este filtro.'; return; }

      var inserted = 0;
      function insertBlock() {
        list.slice(inserted, inserted + BLOCK).forEach(function (g) { grid.appendChild(card(g, nameOf)); });
        inserted = Math.min(inserted + BLOCK, list.length);
        status.textContent = 'Mostrados ' + inserted + ' de ' + list.length;
      }
      function sentinelInView() {
        var r = sentinel.getBoundingClientRect();
        return r.top <= (window.innerHeight + 400);
      }
      // Sigue cargando mientras el punto de carga esté a la vista (arregla el
      // atasco cuando un solo bloque no llena la pantalla).
      function loadMore() {
        var guard = 0;
        while (inserted < list.length && sentinelInView() && guard < 500) { insertBlock(); guard++; }
        if (inserted >= list.length && observer) { observer.disconnect(); observer = null; }
      }

      loadMore();
      if (inserted < list.length) {
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) loadMore(); });
        }, { rootMargin: '400px' });
        observer.observe(sentinel);
      }
    }

    // ---------- BRACKET (Pendientes) ----------
    function renderBracket() {
      body.appendChild(el('p', { class: 'has-text-grey is-size-7 mb-3', text: 'Cuadro de eliminatorias (octavos a la final) — marcador si ya se jugó, o “Por definir”.' }));

      var knockout = allGames.filter(function (g) { return !g.group || String(g.group).trim() === ''; });
      var byType = {};
      knockout.forEach(function (g) { (byType[g.type || '?'] = byType[g.type || '?'] || []).push(g); });

      var rounds = Object.keys(byType).map(function (t) {
        var gs = byType[t].slice().sort(function (a, b) { return orderKey(a.local_date) - orderKey(b.local_date); });
        return { games: gs, minDate: orderKey(gs[0] ? gs[0].local_date : '') };
      }).filter(function (r) { return r.games.length <= 8; });        // de octavos en adelante (sin dieciseisavos)

      if (!rounds.length) rounds = placeholderRounds();

      rounds.sort(function (a, b) {
        if (b.games.length !== a.games.length) return b.games.length - a.games.length;
        return a.minDate - b.minDate;
      });

      var totalOnes = rounds.filter(function (r) { return r.games.length === 1; }).length;
      var seenOne = 0;
      rounds.forEach(function (r) {
        if (r.games.length === 1) { seenOne++; r.label = (totalOnes === 2 && seenOne === 1) ? '3er puesto' : 'Final'; }
        else r.label = roundName(r.games.length);
      });

      var wrap = el('div', { class: 'bracket' });
      rounds.forEach(function (r) {
        var col = el('div', { class: 'bracket-col' });
        col.appendChild(el('p', { class: 'bracket-round', text: r.label }));
        r.games.forEach(function (g) { col.appendChild(bracketMatch(g, nameOf)); });
        wrap.appendChild(col);
      });
      body.appendChild(wrap);
    }

    render('todos');
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

  function bracketMatch(g, nameOf) {
    var hw = g.finished && Number(g.home_score) > Number(g.away_score);
    var aw = g.finished && Number(g.away_score) > Number(g.home_score);
    return WC.ui.el('div', { class: 'bracket-match' }, [
      teamRow(nameOf(g.home_team_id), g.finished ? g.home_score : '', hw),
      teamRow(nameOf(g.away_team_id), g.finished ? g.away_score : '', aw)
    ]);
  }
  function teamRow(name, score, win) {
    return WC.ui.el('div', { class: 'bm-team' + (win ? ' bm-win' : '') }, [
      WC.ui.el('span', { class: 'bm-name', text: name }),
      WC.ui.el('span', { class: 'bm-score', text: (score === '' ? '' : String(score)) })
    ]);
  }

  function roundName(n) {
    return ({ 8: 'Octavos', 4: 'Cuartos', 2: 'Semifinales', 1: 'Final' })[n] || ('Ronda (' + n + ')');
  }
  function placeholderRounds() {
    function fakes(n) { var a = []; for (var i = 0; i < n; i++) a.push({ home_team_id: null, away_team_id: null }); return a; }
    return [{ games: fakes(8), minDate: 1 }, { games: fakes(4), minDate: 2 }, { games: fakes(2), minDate: 3 }, { games: fakes(1), minDate: 4 }];
  }

  WC.views = WC.views || {};
  WC.views.timeline = { mount: mount };
})(window.WC = window.WC || {});