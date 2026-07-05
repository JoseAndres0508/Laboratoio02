/* ============================================================================
 * views/dashboard.js  —  2.4 Dashboard del Fanático Incondicional
 * ----------------------------------------------------------------------------
 * Técnica de DOM: tematización dinámica con variables CSS (--accent) y
 * persistencia de la preferencia (equipo favorito) en localStorage.
 * Endpoints: GET /get/teams, GET /get/games, GET /get/groups.
 *
 * Reto de resiliencia: el equipo favorito sobrevive a un refresco completo
 * (se relee de localStorage al montar). Si la API no responde, se muestra el
 * último estado cacheado con aviso de "datos no actualizados", nunca vacío.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el;
  var staleBadge = WC.ui.staleBadge;
  var FAV_KEY = 'favTeam';

  // Color de acento determinista por equipo (repinta el tema del dashboard).
  function accentFor(teamId) {
    var hue = (parseInt(teamId, 10) * 47) % 360;
    return 'hsl(' + hue + ', 70%, 52%)';
  }

  async function mount(root) {
    root.appendChild(el('h1', { class: 'view-title', text: 'Dashboard del Fanático Incondicional' }));

    var selectorWrap = el('div', { class: 'dash-selector' });
    var panel = el('div', { class: 'dash-panel' });
    root.appendChild(selectorWrap);
    root.appendChild(panel);

    var teamsRes = await WC.api.load('/get/teams');
    var gamesRes = await WC.api.load('/get/games');
    var groupsRes = await WC.api.load('/get/groups');

    if (!teamsRes.ok) {
      selectorWrap.appendChild(el('div', { class: 'error-box', text: 'No se pudo cargar la lista de equipos.' }));
      var retry = el('button', { class: 'btn', text: 'Reintentar' });
      retry.addEventListener('click', function () { root.innerHTML = ''; mount(root); });
      selectorWrap.appendChild(retry);
      return;
    }

    var stale = teamsRes.stale || gamesRes.stale || groupsRes.stale;
    var teams = teamsRes.data.slice().sort(function (a, b) { return a.name_en.localeCompare(b.name_en); });

    var select = el('select', { class: 'field' });
    select.appendChild(el('option', { value: '', text: '— Elige tu equipo favorito —' }));
    teams.forEach(function (t) { select.appendChild(el('option', { value: t.id, text: t.name_en })); });
    selectorWrap.appendChild(el('label', { class: 'muted', text: 'Equipo favorito: ' }));
    selectorWrap.appendChild(select);

    function renderTeam(teamId) {
      panel.innerHTML = '';
      if (!teamId) { document.documentElement.style.removeProperty('--accent'); return; }

      WC.store.setPref(FAV_KEY, teamId);                                  // persiste
      document.documentElement.style.setProperty('--accent', accentFor(teamId)); // re-tematiza

      var team = teams.find(function (t) { return t.id === teamId; });
      if (stale) panel.appendChild(staleBadge());

      panel.appendChild(el('div', { class: 'dash-head' }, [
        team && team.flag ? el('img', { class: 'dash-flag', src: team.flag, alt: '' }) : el('span'),
        el('h2', { text: team ? team.name_en : 'Equipo ' + teamId }),
        el('span', { class: 'badge', text: 'Grupo ' + (team ? team.groups : '?') })
      ]));

      // Posición en el grupo (pts, gf, ga) cruzando /get/groups.
      var standing = findStanding(groupsRes.ok ? groupsRes.data : [], teamId);
      var stats = el('div', { class: 'dash-stats' });
      if (standing) {
        stats.appendChild(stat('Puntos', standing.pts));
        stats.appendChild(stat('GF', standing.gf));
        stats.appendChild(stat('GC', standing.ga));
      } else {
        stats.appendChild(el('p', { class: 'muted', text: 'Posición de grupo no disponible.' }));
      }
      panel.appendChild(stats);

      // Partidos del equipo desde /get/games.
      panel.appendChild(el('h3', { text: 'Partidos' }));
      var list = el('div', { class: 'match-list' });
      if (!gamesRes.ok) {
        list.appendChild(el('div', { class: 'error-inline', text: 'Partidos no disponibles (datos no actualizados).' }));
      } else {
        var matches = gamesRes.data.filter(function (g) {
          return g.home_team_id === teamId || g.away_team_id === teamId;
        });
        if (matches.length === 0) list.appendChild(el('p', { class: 'muted', text: 'Sin partidos.' }));
        matches.forEach(function (g) { list.appendChild(matchRow(g, teams)); });
      }
      panel.appendChild(list);
    }

    select.addEventListener('change', function () { renderTeam(select.value); });

    // Recuperar el favorito guardado: sobrevive al refresco completo de la página.
    var saved = WC.store.getPref(FAV_KEY);
    if (saved && teams.some(function (t) { return t.id === saved; })) {
      select.value = saved;
      renderTeam(saved);
    }
  }

  function stat(label, value) {
    return WC.ui.el('div', { class: 'stat' }, [
      WC.ui.el('div', { class: 'stat-value', text: String(value) }),
      WC.ui.el('div', { class: 'stat-label muted', text: label })
    ]);
  }

  function findStanding(groups, teamId) {
    for (var i = 0; i < groups.length; i++) {
      var row = (groups[i].teams || []).find(function (t) { return t.team_id === teamId; });
      if (row) return row;
    }
    return null;
  }

  function matchRow(g, teams) {
    function name(id) { var t = teams.find(function (x) { return x.id === id; }); return t ? t.name_en : 'Equipo ' + id; }
    var score = g.finished ? (g.home_score + ' - ' + g.away_score) : 'vs';
    return WC.ui.el('div', { class: 'match-row' }, [
      WC.ui.el('span', { text: name(g.home_team_id) + '  ' + score + '  ' + name(g.away_team_id) }),
      WC.ui.el('span', { class: 'muted', text: g.local_date })
    ]);
  }

  WC.views = WC.views || {};
  WC.views.dashboard = { mount: mount };
})(window.WC = window.WC || {});
