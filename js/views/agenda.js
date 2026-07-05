/* ============================================================================
 * views/agenda.js  —  2.2 Agenda Simultánea
 * ----------------------------------------------------------------------------
 * Técnica de DOM: agrupación por clave (local_date) y layout dividido en
 * columnas (CSS Grid), una columna por partido simultáneo.
 * Endpoints: GET /get/games, GET /get/teams.
 *
 * Reto de resiliencia: mientras se espera la respuesta se muestran ESQUELETOS
 * de carga en cada columna; nunca una pantalla en blanco.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el;
  var staleBadge = WC.ui.staleBadge;

  function parseDate(s) { var d = new Date(s); return isNaN(d) ? new Date(8640000000000000) : d; }

  async function mount(root) {
    root.appendChild(el('h1', { class: 'view-title', text: 'Agenda Simultánea' }));

    var controls = el('div', { class: 'agenda-controls' });
    var prev = el('button', { class: 'btn', text: '‹ Fecha anterior' });
    var dateLabel = el('span', { class: 'agenda-date', text: 'Cargando…' });
    var next = el('button', { class: 'btn', text: 'Fecha siguiente ›' });
    controls.appendChild(prev); controls.appendChild(dateLabel); controls.appendChild(next);
    root.appendChild(controls);

    var grid = el('div', { class: 'agenda-grid' });
    root.appendChild(grid);

    // Esqueletos ANTES de que llegue la respuesta (nada de pantalla en blanco).
    renderSkeletons(grid, 3);

    var gamesRes = await WC.api.load('/get/games');
    var teamsRes = await WC.api.load('/get/teams');

    if (!gamesRes.ok) {
      grid.innerHTML = '';
      grid.appendChild(el('div', { class: 'error-box', text: 'No hay datos en caché ni respuesta de red.' }));
      var retry = el('button', { class: 'btn', text: 'Reintentar' });
      retry.addEventListener('click', function () { root.innerHTML = ''; mount(root); });
      grid.appendChild(retry);
      return;
    }
    if (gamesRes.stale || teamsRes.stale) root.insertBefore(staleBadge(), controls);

    var teamName = buildTeamIndex(teamsRes.ok ? teamsRes.data : []);

    // Agrupar por local_date y quedarnos con los días de 2+ partidos.
    var byDate = {};
    gamesRes.data.forEach(function (g) { (byDate[g.local_date] = byDate[g.local_date] || []).push(g); });
    var dates = Object.keys(byDate)
      .filter(function (d) { return byDate[d].length >= 2; })
      .sort(function (a, b) { return parseDate(a) - parseDate(b); });

    if (dates.length === 0) {
      grid.innerHTML = '';
      grid.appendChild(el('p', { class: 'muted', text: 'No hay fechas con partidos simultáneos.' }));
      dateLabel.textContent = '—';
      return;
    }

    var idx = 0;
    function render() {
      var date = dates[idx];
      dateLabel.textContent = date + '  (' + (idx + 1) + '/' + dates.length + ')';
      prev.disabled = (idx === 0);
      next.disabled = (idx === dates.length - 1);
      grid.innerHTML = '';
      byDate[date].forEach(function (g) { grid.appendChild(matchColumn(g, teamName)); });
    }
    prev.addEventListener('click', function () { if (idx > 0) { idx--; render(); } });
    next.addEventListener('click', function () { if (idx < dates.length - 1) { idx++; render(); } });
    render();
  }

  function renderSkeletons(grid, n) {
    grid.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var col = el('div', { class: 'agenda-col' });
      col.appendChild(WC.ui.skeleton(4));
      grid.appendChild(col);
    }
  }

  function buildTeamIndex(teams) {
    var map = {};
    teams.forEach(function (t) { map[t.id] = t.name_en; });
    return function (id) { return map[id] || ('Equipo ' + id); };
  }

  function matchColumn(g, teamName) {
    var score = g.finished ? (g.home_score + ' - ' + g.away_score) : 'vs';
    return el('div', { class: 'agenda-col' }, [
      el('div', { class: 'col-group', text: 'Grupo ' + g.group + ' · J' + g.matchday }),
      el('div', { class: 'col-team', text: teamName(g.home_team_id) }),
      el('div', { class: 'col-score', text: score }),
      el('div', { class: 'col-team', text: teamName(g.away_team_id) })
    ]);
  }

  WC.views = WC.views || {};
  WC.views.agenda = { mount: mount };
})(window.WC = window.WC || {});
