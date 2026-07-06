/* ============================================================================
 * views/dashboard.js  —  2.4 Dashboard del Fanático  (Bulma + sub-opciones)
 * Técnica requerida: variables CSS por equipo (--accent) + favorito en
 * localStorage que sobrevive al refresco.
 * Sub-opciones: Resumen / Partidos / Grupo.
 * FIX: el orden de equipos ya no truena con equipos "TBD" sin nombre.
 * Resiliencia: si la API no responde, usa caché con aviso "no actualizado".
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;
  var FAV_KEY = 'favTeam';

  function accentFor(id) { var hue = (parseInt(id, 10) * 47) % 360; return 'hsl(' + hue + ',70%,55%)'; }

  async function mount(root) {
    var selectorWrap = el('div', { class: 'field mb-4', style: 'max-width:420px' });
    root.appendChild(selectorWrap);
    var subWrap = el('div', {});
    root.appendChild(subWrap);
    var panel = el('div', {});
    root.appendChild(panel);

    var teamsRes = await WC.api.load('/get/teams');
    var gamesRes = await WC.api.load('/get/games');
    var groupsRes = await WC.api.load('/get/groups');

    if (!teamsRes.ok) {
      selectorWrap.appendChild(WC.ui.errorNotice('No se pudo cargar la lista de equipos.', function () { root.innerHTML = ''; mount(root); }));
      return;
    }
    var stale = teamsRes.stale || gamesRes.stale || groupsRes.stale;

    // FIX del crash: solo equipos CON nombre, y orden tolerante a undefined.
    var teams = U.asArray(teamsRes.data)
      .filter(function (t) { return t && t.name_en; })
      .sort(function (a, b) { return (a.name_en || '').localeCompare(b.name_en || ''); });

    var games = U.asArray(gamesRes.ok ? gamesRes.data : []);
    var groups = U.asArray(groupsRes.ok ? groupsRes.data : []);

    // Selector de equipo favorito.
    var select = el('select', {});
    teams.forEach(function (t) { select.appendChild(el('option', { value: t.id, text: t.name_en })); });
    selectorWrap.appendChild(el('label', { class: 'label is-small', text: '❤ Equipo favorito (se guarda para la próxima vez)' }));
    selectorWrap.appendChild(el('div', { class: 'select is-fullwidth' }, [select]));

    var section = 'resumen';
    var sub = WC.ui.subtabs([
      { id: 'resumen', label: 'Resumen', icon: 'circle-info' },
      { id: 'partidos', label: 'Partidos', icon: 'futbol' },
      { id: 'grupo', label: 'Grupo', icon: 'ranking-star' }
    ], function (id) { section = id; renderPanel(); });
    subWrap.appendChild(sub.nav);

    var currentId = null;

    function selectTeam(id) {
      currentId = id;
      WC.store.setPref(FAV_KEY, id);                                   // persiste
      document.documentElement.style.setProperty('--accent', accentFor(id)); // re-tematiza
      renderPanel();
    }

    function renderPanel() {
      panel.innerHTML = '';
      if (!currentId) return;
      if (stale) panel.appendChild(WC.ui.staleBadge());
      var team = teams.find(function (t) { return t.id === currentId; });

      // Cabecera común
      panel.appendChild(el('div', { class: 'box accent-bar' }, [
        el('div', { class: 'is-flex is-align-items-center', style: 'gap:14px' }, [
          team && team.flag ? el('img', { class: 'dash-flag', src: team.flag, alt: '' }) : el('span'),
          el('div', {}, [
            el('h2', { class: 'title is-4 mb-1', text: team ? team.name_en : 'Equipo ' + currentId }),
            el('span', { class: 'tag is-primary', text: 'Grupo ' + (team ? (team.groups || '?') : '?') })
          ])
        ])
      ]));

      if (section === 'resumen') renderResumen(team);
      else if (section === 'partidos') renderPartidos();
      else renderGrupo(team);
    }

    function renderResumen(team) {
      var st = findStanding(groups, currentId);
      var cols = el('div', { class: 'columns' });
      var items = st
        ? [['Puntos', st.pts], ['Goles a favor', st.gf], ['Goles en contra', st.ga]]
        : [];
      if (!items.length) { panel.appendChild(el('p', { class: 'has-text-grey', text: 'Posición de grupo no disponible.' })); return; }
      items.forEach(function (pair) {
        cols.appendChild(el('div', { class: 'column' }, [
          el('div', { class: 'box stat-box' }, [
            el('p', { class: 'stat-value', text: String(pair[1]) }),
            el('p', { class: 'has-text-grey', text: pair[0] })
          ])
        ]));
      });
      panel.appendChild(cols);
    }

    function renderPartidos() {
      if (!gamesRes.ok) { panel.appendChild(el('p', { class: 'has-text-danger', text: 'Partidos no disponibles.' })); return; }
      var mine = games.filter(function (g) { return g.home_team_id === currentId || g.away_team_id === currentId; });
      if (!mine.length) { panel.appendChild(el('p', { class: 'has-text-grey', text: 'Sin partidos.' })); return; }
      mine.forEach(function (g) {
        var score = WC.util.isFinished(g) ? (g.home_score + ' - ' + g.away_score) : 'vs';
        panel.appendChild(el('div', { class: 'box py-3 is-flex is-justify-content-space-between' }, [
          el('span', { text: nameOf(g.home_team_id) + '  ' + score + '  ' + nameOf(g.away_team_id) }),
          el('span', { class: 'has-text-grey', text: g.local_date })
        ]));
      });
    }

    function renderGrupo(team) {
      var grp = groups.find(function (gr) { return (gr.teams || []).some(function (x) { return x.team_id === currentId; }); });
      if (!grp) { panel.appendChild(el('p', { class: 'has-text-grey', text: 'Grupo no disponible.' })); return; }
      var table = el('table', { class: 'table is-fullwidth is-striped' });
      table.appendChild(el('thead', {}, [el('tr', {}, [
        el('th', { text: 'Equipo' }), el('th', { text: 'Pts' }), el('th', { text: 'GF' }), el('th', { text: 'GC' })
      ])]));
      var tb = el('tbody', {});
      (grp.teams || []).slice().sort(function (a, b) { return (+b.pts) - (+a.pts); }).forEach(function (row) {
        var isMe = row.team_id === currentId;
        tb.appendChild(el('tr', isMe ? { style: 'background:var(--accent-soft)' } : {}, [
          el('td', {}, [el('strong', isMe ? { class: 'accent-text' } : {}, [nameOf(row.team_id)])]),
          el('td', { text: String(row.pts) }), el('td', { text: String(row.gf) }), el('td', { text: String(row.ga) })
        ]));
      });
      table.appendChild(tb);
      panel.appendChild(el('div', { class: 'box', text: '' }));
      panel.lastChild.appendChild(el('p', { class: 'title is-6 mb-2', text: 'Grupo ' + grp.group }));
      panel.lastChild.appendChild(table);
    }

    var teamsIndex = U.indexById(teams);
    function nameOf(id) { return U.teamName(teamsIndex[id], id); }
    function findStanding(gs, id) {
      for (var i = 0; i < gs.length; i++) {
        var row = (gs[i].teams || []).find(function (t) { return t.team_id === id; });
        if (row) return row;
      }
      return null;
    }

    select.addEventListener('change', function () { selectTeam(select.value); });

    // Auto-selección: favorito guardado, o el primer equipo -> nunca queda vacío.
    var saved = WC.store.getPref(FAV_KEY);
    var initial = (saved && teams.some(function (t) { return t.id === saved; })) ? saved : (teams[0] && teams[0].id);
    if (initial) { select.value = initial; selectTeam(initial); }
  }

  WC.views = WC.views || {};
  WC.views.dashboard = { mount: mount };
})(window.WC = window.WC || {});
