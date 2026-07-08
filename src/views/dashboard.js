/* ============================================================================
 * views/dashboard.js  —  2.4 Dashboard del Fanático (centrado + reactivo)
 * Tarjeta teñida con el color de la bandera; letras globales del color del
 * equipo. Resumen incluye el estado: quién eliminó a la selección, si sigue
 * viva, si fue campeona o si no pasó de grupos.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util, C = WC.colors;
  var FAV_KEY = 'favTeam', COL_KEY = 'favColor';
  var KO_LABEL = { r32: 'Dieciseisavos', r16: 'Octavos', qf: 'Cuartos', sf: 'Semifinales', third: '3.º puesto', final: 'Final' };
  function orderKey(s) { var d = new Date(s); return isNaN(d) ? 0 : d.getTime(); }

  async function mount(root) {
    var wrap = el('div', { class: 'dash-wrap' });
    root.appendChild(wrap);

    var selectorWrap = el('div', { class: 'field mb-4' });
    wrap.appendChild(selectorWrap);
    var subWrap = el('div', {});
    wrap.appendChild(subWrap);
    var card = el('div', { class: 'dash-card' }, [el('div', { class: 'dash-stripe' })]);
    var inner = el('div', { class: 'dash-inner' });
    card.appendChild(inner);
    wrap.appendChild(card);

    var teamsRes = await WC.api.load('/get/teams');
    var gamesRes = await WC.api.load('/get/games');
    var groupsRes = await WC.api.load('/get/groups');
    if (!teamsRes.ok) {
      wrap.appendChild(WC.ui.errorNotice('No se pudo cargar la lista de equipos.', function () { root.innerHTML = ''; mount(root); }));
      return;
    }
    var stale = teamsRes.stale || gamesRes.stale || groupsRes.stale;
    var teams = U.asArray(teamsRes.data).filter(function (t) { return t && t.name_en; })
      .sort(function (a, b) { return (a.name_en || '').localeCompare(b.name_en || ''); });
    var games = U.asArray(gamesRes.ok ? gamesRes.data : []);
    var groups = U.asArray(groupsRes.ok ? groupsRes.data : []);
    var teamsIndex = U.indexById(teams);
    function nameOf(id) { return U.teamName(teamsIndex[id], id); }

    var select = el('select', {});
    teams.forEach(function (t) { select.appendChild(el('option', { value: t.id, text: t.name_en })); });
    selectorWrap.appendChild(el('label', { class: 'label is-small has-text-centered', text: 'Equipo favorito' }));
    selectorWrap.appendChild(el('div', { class: 'select is-fullwidth' }, [select]));

    var section = 'resumen';
    var sub = WC.ui.subtabs([
      { id: 'resumen', label: 'Resumen', icon: 'circle-info' },
      { id: 'partidos', label: 'Partidos', icon: 'futbol' },
      { id: 'grupo', label: 'Grupo', icon: 'ranking-star' }
    ], function (id) { section = id; renderPanel(); });
    subWrap.appendChild(sub.nav);

    var currentId = null;

    function applyTeamColor(hex) {
      var theme = document.documentElement.getAttribute('data-theme') || 'dark';
      wrap.style.setProperty('--dash-accent', C.accentFor(hex, theme));
      wrap.style.setProperty('--dash-bg', C.tintFor(hex, theme));
      wrap.style.setProperty('--dash-inner', C.innerFor(hex, theme));
      WC.store.setPref(COL_KEY, hex);
      WC.applyFavTextColor(hex);
    }
    function selectTeam(id) {
      currentId = id;
      WC.store.setPref(FAV_KEY, id);
      applyTeamColor(C.fallbackHex(id));
      var team = teamsIndex[id];
      if (team && team.flag) C.extractFlag(team.flag, function (hex) { if (currentId === id) applyTeamColor(hex || C.fallbackHex(id)); });
      renderPanel();
      if (teamStatus(id).cls === 'st-champ') confetti(card, [C.fallbackHex(id), '#FBCB3A', '#ffffff', '#FF6B35', '#0FB5A6']);
    }

    function renderPanel() {
      inner.innerHTML = '';
      if (!currentId) return;
      if (stale) inner.appendChild(WC.ui.staleBadge());
      var team = teamsIndex[currentId];
      inner.appendChild(el('div', { class: 'dash-head' }, [
        team && team.flag ? el('img', { class: 'dash-flag2', src: team.flag, alt: '' }) : el('span'),
        el('div', { class: 'dash-name', text: team ? team.name_en : 'Equipo ' + currentId }),
        el('span', { class: 'dash-tag', text: 'Grupo ' + (team ? (team.groups || '?') : '?') })
      ]));
      if (section === 'resumen') renderResumen();
      else if (section === 'partidos') renderPartidos();
      else renderGrupo();
    }

    function renderResumen() {
      var st = findStanding(groups, currentId);
      if (st) {
        var grid = el('div', { class: 'dash-stats2' });
        [['Puntos', st.pts], ['GF', st.gf], ['GC', st.ga]].forEach(function (p) {
          var v = el('div', { class: 'v', text: '0' });
          grid.appendChild(el('div', { class: 'dash-stat' }, [v, el('div', { class: 'l', text: p[0] })]));
          countUp(v, p[1]);
        });
        inner.appendChild(grid);
      } else {
        inner.appendChild(el('p', { class: 'has-text-grey', text: 'Posición de grupo no disponible.' }));
      }
      var s = teamStatus(currentId);
      inner.appendChild(el('div', { class: 'dash-status ' + s.cls, text: s.text }));
    }

    function renderPartidos() {
      if (!gamesRes.ok) { inner.appendChild(el('p', { class: 'has-text-danger', text: 'Partidos no disponibles.' })); return; }
      var mine = games.filter(function (g) { return g.home_team_id === currentId || g.away_team_id === currentId; });
      if (!mine.length) { inner.appendChild(el('p', { class: 'has-text-grey', text: 'Sin partidos.' })); return; }
      mine.forEach(function (g) {
        var score = U.isFinished(g) ? (g.home_score + ' - ' + g.away_score) : 'vs';
        inner.appendChild(el('div', { class: 'dash-row' }, [
          el('span', { text: nameOf(g.home_team_id) + '  ' + score + '  ' + nameOf(g.away_team_id) }),
          el('span', { class: 'has-text-grey', text: g.local_date })
        ]));
      });
    }

    function renderGrupo() {
      var grp = groups.find(function (gr) { return (gr.teams || []).some(function (x) { return x.team_id === currentId; }); });
      if (!grp) { inner.appendChild(el('p', { class: 'has-text-grey', text: 'Grupo no disponible.' })); return; }
      var table = el('table', { class: 'table is-fullwidth' });
      table.appendChild(el('thead', {}, [el('tr', {}, [el('th', { text: 'Equipo' }), el('th', { text: 'Pts' }), el('th', { text: 'GF' }), el('th', { text: 'GC' })])]));
      var tb = el('tbody', {});
      (grp.teams || []).slice().sort(function (a, b) { return (+b.pts) - (+a.pts); }).forEach(function (row) {
        var me = row.team_id === currentId;
        tb.appendChild(el('tr', me ? { class: 'dash-me' } : {}, [
          el('td', {}, [el('strong', {}, [nameOf(row.team_id)])]),
          el('td', { text: String(row.pts) }), el('td', { text: String(row.gf) }), el('td', { text: String(row.ga) })
        ]));
      });
      table.appendChild(tb);
      inner.appendChild(table);
    }

    // ¿Quién eliminó al equipo? (o sigue vivo / campeón / fuera en grupos)
    function teamStatus(id) {
      var ko = games.filter(function (g) { return g.type && g.type !== 'group' && (g.home_team_id === id || g.away_team_id === id); });
      if (!ko.length) {
        var started = games.some(function (g) { return g.type && g.type !== 'group' && U.isFinished(g); });
        return started ? { cls: 'st-elim', text: 'No superó la fase de grupos' } : { cls: 'st-groups', text: 'En fase de grupos' };
      }
      function lost(g) {
        if (!U.isFinished(g)) return false;
        var home = g.home_team_id === id, mine = Number(home ? g.home_score : g.away_score), opp = Number(home ? g.away_score : g.home_score);
        if (mine < opp) return true;
        if (mine === opp) { var mp = Number(home ? g.home_penalty_score : g.away_penalty_score), op = Number(home ? g.away_penalty_score : g.home_penalty_score); return mp < op; }
        return false;
      }
      var losses = ko.filter(lost).sort(function (a, b) { return orderKey(b.local_date) - orderKey(a.local_date); });
      if (losses.length) {
        var g = losses[0], home = g.home_team_id === id;
        var oppId = home ? g.away_team_id : g.home_team_id;
        var sc = (home ? g.home_score : g.away_score) + '-' + (home ? g.away_score : g.home_score);
        return { cls: 'st-elim', text: 'Eliminado por ' + nameOf(oppId) + ' · ' + (KO_LABEL[g.type] || 'Eliminatoria') + ' (' + sc + ')' };
      }
      var fin = ko.find(function (g) { return g.type === 'final' && U.isFinished(g); });
      if (fin) {
        var h = fin.home_team_id === id, mine = Number(h ? fin.home_score : fin.away_score), opp = Number(h ? fin.away_score : fin.home_score);
        var mp = Number(h ? fin.home_penalty_score : fin.away_penalty_score), op = Number(h ? fin.away_penalty_score : fin.home_penalty_score);
        if (mine > opp || (mine === opp && mp > op)) return { cls: 'st-champ', text: '¡Campeón del Mundial!' };
      }
      return { cls: 'st-alive', text: 'Sigue en competencia' };
    }

    function findStanding(gs, id) {
      for (var i = 0; i < gs.length; i++) { var row = (gs[i].teams || []).find(function (t) { return t.team_id === id; }); if (row) return row; }
      return null;
    }
    function countUp(node, target) {
      target = Number(target) || 0; var dur = 600, t0 = null;
      function step(ts) { if (!t0) t0 = ts; var p = Math.min((ts - t0) / dur, 1); node.textContent = Math.round(target * p); if (p < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    }

    select.addEventListener('change', function () { selectTeam(select.value); });
    var saved = WC.store.getPref(FAV_KEY);
    var initial = (saved && teamsIndex[saved]) ? saved : (teams[0] && teams[0].id);
    if (initial) { select.value = initial; selectTeam(initial); }
  }

  function confetti(host, colors) {
    colors = (colors && colors.length) ? colors : ['#FF6B35','#0FB5A6','#FBCB3A'];
    var layer = WC.ui.el('div', { class: 'confetti-layer' });
    host.appendChild(layer);
    for (var i = 0; i < 52; i++) {
      var p = WC.ui.el('div', { class: 'confetti-piece' });
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.35) + 's';
      p.style.animationDuration = (1.5 + Math.random() * 1.3) + 's';
      p.style.setProperty('--x', ((Math.random() * 2 - 1) * 90) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      layer.appendChild(p);
    }
    setTimeout(function () { layer.remove(); }, 3200);
  }

  WC.views = WC.views || {};
  WC.views.dashboard = { mount: mount };
})(window.WC = window.WC || {});