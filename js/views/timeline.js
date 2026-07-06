/* ============================================================================
 * views/timeline.js  —  2.3 Timeline
 *   Todos      : grid de cards; scroll infinito real (IntersectionObserver, 10).
 *   Jugados    : mismo grid, solo partidos finalizados.
 *   Pendientes : bracket de eliminatorias (octavos -> final) detectado por
 *                el campo `type`, con marcador si ya se jugó.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;
  var BLOCK = 10;

  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var TYPE_LABEL = { r32: 'Dieciseisavos', r16: 'Octavos', qf: 'Cuartos', sf: 'Semifinales', third: '3.º puesto', final: 'Final' };
  // Rondas que se muestran en el bracket (octavos en adelante), en orden.
  var BRACKET = [['r16', 'Octavos'], ['qf', 'Cuartos'], ['sf', 'Semifinales'], ['final', 'Final'], ['third', '3.º puesto']];

  function toDate(s) { var d = new Date(s); return isNaN(d) ? null : d; }
  function shortDate(s) { var d = toDate(s); return d ? (DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]) : s; }
  function hourLabel(s) { var d = toDate(s); if (!d || (d.getHours() === 0 && d.getMinutes() === 0)) return ''; return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function orderKey(s) { var d = toDate(s); return d ? d.getTime() : Number.MAX_SAFE_INTEGER; }

  async function mount(root) {
    var sub = WC.ui.subtabs([
      { id: 'todos', label: 'Todos', icon: 'table-cells' },
      { id: 'jugados', label: 'Jugados', icon: 'circle-check' },
      { id: 'pendientes', label: 'Eliminatorias', icon: 'sitemap' }
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
    // Nombre de un lado del partido: primero el embebido, luego el equipo, luego la etiqueta ("Winner Match 74").
    function sideName(g, side) {
      var nm = g[side + '_team_name_en'];
      if (nm && nm !== 'null') return nm;
      var t = teamsIndex[g[side + '_team_id']];
      if (t) return t.name_en || t.name_fa;
      var label = g[side + '_team_label'];
      if (label && label !== 'null') return label;
      return 'Por definir';
    }

    var allGames = U.asArray(gamesRes.data).slice().sort(function (a, b) { return orderKey(a.local_date) - orderKey(b.local_date); });

    var observer = null;
    function render(mode) {
      if (observer) { observer.disconnect(); observer = null; }
      body.innerHTML = '';
      if (mode === 'pendientes') renderBracket();
      else renderGrid(mode === 'jugados');
    }

    // ---------- GRID + scroll infinito ----------
    function renderGrid(onlyFinished) {
      var list = onlyFinished ? allGames.filter(function (g) { return U.isFinished(g); }) : allGames;
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
      function sentinelInView() { return sentinel.getBoundingClientRect().top <= (window.innerHeight + 400); }
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

    // ---------- BRACKET ----------
    function renderBracket() {
      body.appendChild(el('p', { class: 'has-text-grey is-size-7 mb-3', text: 'Cuadro de eliminatorias — marcador si ya se jugó, o los equipos por definir.' }));

      var byType = {};
      allGames.forEach(function (g) { (byType[g.type] = byType[g.type] || []).push(g); });

      var rounds = BRACKET.map(function (d) {
        var gs = (byType[d[0]] || []).slice().sort(function (a, b) { return orderKey(a.local_date) - orderKey(b.local_date); });
        return { label: d[1], games: gs };
      }).filter(function (r) { return r.games.length > 0; });

      if (!rounds.length) {
        body.appendChild(el('p', { class: 'has-text-grey', text: 'Aún no hay partidos de eliminatoria disponibles.' }));
        return;
      }

      var wrap = el('div', { class: 'bracket' });
      rounds.forEach(function (r) {
        var col = el('div', { class: 'bracket-col' });
        col.appendChild(el('p', { class: 'bracket-round', text: r.label }));
        r.games.forEach(function (g) { col.appendChild(bracketMatch(g)); });
        wrap.appendChild(col);
      });
      body.appendChild(wrap);
    }

    function bracketMatch(g) {
      var fin = U.isFinished(g);
      var hs = Number(g.home_score), as = Number(g.away_score);
      var hp = Number(g.home_penalty_score), ap = Number(g.away_penalty_score);
      var hw = fin && (hs > as || (hs === as && hp > ap));
      var aw = fin && (as > hs || (hs === as && ap > hp));
      return el('div', { class: 'bracket-match' }, [
        teamRow(sideName(g, 'home'), fin ? g.home_score : '', hw),
        teamRow(sideName(g, 'away'), fin ? g.away_score : '', aw)
      ]);
    }

    render('todos');
  }

  function teamRow(name, score, win) {
    return WC.ui.el('div', { class: 'bm-team' + (win ? ' bm-win' : '') }, [
      WC.ui.el('span', { class: 'bm-name', text: name }),
      WC.ui.el('span', { class: 'bm-score', text: (score === '' ? '' : String(score)) })
    ]);
  }

  function card(g, nameOf) {
    var dt = shortDate(g.local_date) + (hourLabel(g.local_date) ? (' · ' + hourLabel(g.local_date)) : '');
    var label = g.type === 'group' ? ('Grupo ' + g.group + ' · J' + g.matchday) : (TYPE_LABEL[g.type] || 'Eliminatoria');
    var scoreNode = WC.util.isFinished(g)
      ? WC.ui.el('div', { class: 'tl-score', text: g.home_score + ' - ' + g.away_score })
      : WC.ui.el('div', { class: 'tl-por', text: 'Por jugar' });
    return WC.ui.el('div', { class: 'tl-card2 has-text-centered' }, [
      WC.ui.el('div', { class: 'tl-dt', text: dt }),
      WC.ui.el('div', { class: 'tl-teams', text: nameOf(g.home_team_id) + ' vs ' + nameOf(g.away_team_id) }),
      scoreNode,
      WC.ui.el('div', { class: 'tl-gj', text: label })
    ]);
  }

  WC.views = WC.views || {};
  WC.views.timeline = { mount: mount };
})(window.WC = window.WC || {});