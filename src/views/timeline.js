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

  // Convierte texto a fecha (o null).
  function toDate(s) { var d = new Date(s); return isNaN(d) ? null : d; }
  // Fecha corta legible.
  function shortDate(s) { var d = toDate(s); return d ? (DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]) : s; }
  // Hora HH:MM (o vacío).
  function hourLabel(s) { var d = toDate(s); if (!d || (d.getHours() === 0 && d.getMinutes() === 0)) return ''; return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  // Clave numérica para ordenar por fecha.
  function orderKey(s) { var d = toDate(s); return d ? d.getTime() : Number.MAX_SAFE_INTEGER; }

  // ---------- Tarjetas y filas ----------
  function teamRow(name, score, win) {
    return el('div', { class: 'bm-team' + (win ? ' bm-win' : '') }, [
      el('span', { class: 'bm-name', text: name }),
      el('span', { class: 'bm-score', text: (score === '' ? '' : String(score)) })
    ]);
  }
  // Tarjeta de un partido.
  function card(g, nameOf) {
    var dt = shortDate(g.local_date) + (hourLabel(g.local_date) ? (' · ' + hourLabel(g.local_date)) : '');
    var label = g.type === 'group' ? ('Grupo ' + g.group + ' · J' + g.matchday) : (TYPE_LABEL[g.type] || 'Eliminatoria');
    var scoreNode = U.isFinished(g)
      ? el('div', { class: 'tl-score', text: g.home_score + ' - ' + g.away_score })
      : el('div', { class: 'tl-por', text: 'Por jugar' });
    return el('div', { class: 'tl-card2 has-text-centered' }, [
      el('div', { class: 'tl-dt', text: dt }),
      el('div', { class: 'tl-teams', text: nameOf(g.home_team_id) + ' vs ' + nameOf(g.away_team_id) }),
      scoreNode,
      el('div', { class: 'tl-gj', text: label })
    ]);
  }

  // ---------- Scroll infinito (inserción por bloques de 10) ----------
  function makeGridLoader(list, grid, status, sentinel, nameOf) {
    var inserted = 0;
    function insertBlock() {
      list.slice(inserted, inserted + BLOCK).forEach(function (g) { grid.appendChild(card(g, nameOf)); });
      inserted = Math.min(inserted + BLOCK, list.length);
      status.textContent = 'Mostrados ' + inserted + ' de ' + list.length;
    }
    function inView() { return sentinel.getBoundingClientRect().top <= (window.innerHeight + 400); }
    return { insertBlock: insertBlock, inView: inView, done: function () { return inserted >= list.length; } };
  }

  // ---------- Bracket de eliminatorias ----------
  function bracketRounds(allGames) {
    var byType = {};
    allGames.forEach(function (g) { (byType[g.type] = byType[g.type] || []).push(g); });
    return BRACKET.map(function (d) {
      var gs = (byType[d[0]] || []).slice().sort(function (a, b) { return orderKey(a.local_date) - orderKey(b.local_date); });
      return { label: d[1], games: gs };
    }).filter(function (r) { return r.games.length > 0; });
  }
  // Enfrentamiento del bracket con marcador.
  function bracketMatch(g, sideName) {
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
  // Columna (ronda) del bracket.
  function bracketColumn(r, sideName) {
    var col = el('div', { class: 'bracket-col' });
    col.appendChild(el('p', { class: 'bracket-round', text: r.label }));
    r.games.forEach(function (g) { col.appendChild(bracketMatch(g, sideName)); });
    return col;
  }

  // ---------- Vista ----------
  async function mount(root) {
    var body = el('div', {});
    var sub = WC.ui.subtabs([
      { id: 'todos', label: 'Todos', icon: 'table-cells' },
      { id: 'jugados', label: 'Jugados', icon: 'circle-check' },
      { id: 'pendientes', label: 'Eliminatorias', icon: 'sitemap' }
    ], function (id) { render(id); });
    root.appendChild(sub.nav);
    root.appendChild(body);

    var gamesRes = await WC.api.load('/get/games');
    var teamsRes = await WC.api.load('/get/teams');
    if (!gamesRes.ok) {
      body.appendChild(WC.ui.errorNotice('No se pudieron cargar los partidos.', function () { root.innerHTML = ''; mount(root); }));
      return;
    }
    if (gamesRes.stale || teamsRes.stale) root.insertBefore(WC.ui.staleBadge(), body);

    var teamsIndex = U.indexById(U.asArray(teamsRes.ok ? teamsRes.data : []));
    // Nombre del equipo por id.
    function nameOf(id) { var t = teamsIndex[id]; return t ? (t.name_en || t.name_fa || ('Equipo ' + id)) : 'Por definir'; }
    // Nombre de un lado del partido: embebido -> equipo -> etiqueta ("Winner Match 74").
    function sideName(g, side) {
      var nm = g[side + '_team_name_en'];
      if (nm && nm !== 'null') return nm;
      var t = teamsIndex[g[side + '_team_id']];
      if (t) return t.name_en || t.name_fa;
      var label = g[side + '_team_label'];
      return (label && label !== 'null') ? label : 'Por definir';
    }

    var allGames = U.asArray(gamesRes.data).slice().sort(function (a, b) { return orderKey(a.local_date) - orderKey(b.local_date); });
    var observer = null;

    // Renderiza el modo elegido.
    function render(mode) {
      if (observer) { observer.disconnect(); observer = null; }
      body.innerHTML = '';
      if (mode === 'pendientes') renderBracket();
      else renderGrid(mode === 'jugados');
    }

    // Grid de partidos con scroll infinito.
    function renderGrid(onlyFinished) {
      var list = onlyFinished ? allGames.filter(function (g) { return U.isFinished(g); }) : allGames;
      var status = el('p', { class: 'has-text-grey is-size-7 mb-2' });
      var grid = el('div', { class: 'tl-grid' });
      var sentinel = el('div', { class: 'tl-sentinel-v' });
      body.appendChild(status); body.appendChild(grid); body.appendChild(sentinel);
      if (!list.length) { status.textContent = 'No hay partidos en este filtro.'; return; }

      var loader = makeGridLoader(list, grid, status, sentinel, nameOf);
      // Inserta más partidos al hacer scroll.
      function loadMore() {
        var guard = 0;
        while (!loader.done() && loader.inView() && guard < 500) { loader.insertBlock(); guard++; }
        if (loader.done() && observer) { observer.disconnect(); observer = null; }
      }
      loadMore();
      if (!loader.done()) {
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) loadMore(); });
        }, { rootMargin: '400px' });
        observer.observe(sentinel);
      }
    }

    // Dibuja el cuadro de eliminatorias.
    function renderBracket() {
      body.appendChild(el('p', { class: 'has-text-grey is-size-7 mb-3', text: 'Cuadro de eliminatorias — marcador si ya se jugó, o los equipos por definir.' }));
      var rounds = bracketRounds(allGames);
      if (!rounds.length) {
        body.appendChild(el('p', { class: 'has-text-grey', text: 'Aún no hay partidos de eliminatoria disponibles.' }));
        return;
      }
      var wrap = el('div', { class: 'bracket' });
      rounds.forEach(function (r) { wrap.appendChild(bracketColumn(r, sideName)); });
      body.appendChild(wrap);
    }

    render('todos');
  }

  WC.views = WC.views || {};
  WC.views.timeline = { mount: mount };
})(window.WC = window.WC || {});
