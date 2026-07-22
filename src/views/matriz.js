/* ============================================================================
 * views/matriz.js  —  2.5 Matriz de Enfrentamientos
 * Grupos A–L: cuadrícula 4x4 (todos contra todos) con parcheo de resultados.
 * Rondas de eliminatoria (16avos, octavos, cuartos, semis, final): lista de
 * enfrentamientos con marcador. Chips para elegir qué mostrar.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;
  var KO_ORDER = [['r32', 'Dieciseisavos'], ['r16', 'Octavos'], ['qf', 'Cuartos'], ['sf', 'Semifinales'], ['final', 'Final'], ['third', '3.º puesto']];
  function orderKey(s) { var d = new Date(s); return isNaN(d) ? 0 : d.getTime(); }

  // ---------- Construcción de la matriz 4x4 ----------
  function matrixHead(ids, label) {
    var head = el('tr', {}, [el('th', { text: '' })]);
    ids.forEach(function (id) { head.appendChild(el('th', { text: label(id) })); });
    return el('thead', {}, [head]);
  }
  function matrixRow(rowId, ids, label) {
    var tr = el('tr', {}, [el('th', { text: label(rowId) })]);
    ids.forEach(function (colId) {
      if (rowId === colId) tr.appendChild(el('td', { class: 'cell diag', text: '—' }));
      else tr.appendChild(el('td', { class: 'cell pending', dataset: { cell: rowId + '_' + colId }, text: 'Pendiente' }));
    });
    return tr;
  }
  function patchCell(container, rowId, colId, text) {
    var cell = container.querySelector('[data-cell="' + rowId + '_' + colId + '"]');
    if (cell) { cell.textContent = text; cell.classList.add('played'); cell.classList.remove('pending'); }
  }

  // ---------- Vista ----------
  async function mount(root) {
    var chipsRow = el('div', { class: 'chips' });
    var container = el('div', { class: 'columns is-multiline is-centered matriz-cols' });
    var note = el('div', { class: 'mt-3' });
    root.appendChild(chipsRow); root.appendChild(container); root.appendChild(note);

    var groupsRes = await WC.api.load('/get/groups');
    var teamsRes = await WC.api.load('/get/teams');
    var gamesRes = await WC.api.load('/get/games');
    if (!groupsRes.ok || !teamsRes.ok) {
      container.appendChild(WC.ui.errorNotice('No se pudieron cargar grupos/equipos.', function () { root.innerHTML = ''; mount(root); }));
      return;
    }
    if (groupsRes.stale || teamsRes.stale || gamesRes.stale) root.insertBefore(WC.ui.staleBadge(), chipsRow);

    var teamsIndex = U.indexById(U.asArray(teamsRes.data));
    var groups = U.asArray(groupsRes.data);
    var games = U.asArray(gamesRes.ok ? gamesRes.data : []);

    function label(id) { var t = teamsIndex[id]; return t ? (t.fifa_code || t.name_en || id) : id; }
    // Nombre del grupo, tolerante al nombre del campo (o desde los equipos).
    function groupName(grp) {
      var n = grp.group || grp.group_name || grp.name || grp.letter || grp.title;
      if (n) return n;
      var first = (grp.teams || [])[0];
      var t = first && teamsIndex[first.team_id];
      return (t && t.groups) || '?';
    }
    function koName(g, side) {
      var nm = g[side + '_team_name_en']; if (nm && nm !== 'null') return nm;
      var t = teamsIndex[g[side + '_team_id']]; if (t) return t.name_en || t.fifa_code;
      var l = g[side + '_team_label']; return (l && l !== 'null') ? l : 'Por definir';
    }

    // Rondas de eliminatoria presentes en los datos.
    var koByType = {};
    games.forEach(function (g) { if (g.type && g.type !== 'group') (koByType[g.type] = koByType[g.type] || []).push(g); });
    var koRounds = KO_ORDER.filter(function (r) { return koByType[r[0]] && koByType[r[0]].length; });

    var filter = 'ALL';
    function drawChips() {
      chipsRow.innerHTML = '';
      chipsRow.appendChild(WC.ui.chip('Todos', filter === 'ALL', function () { filter = 'ALL'; render(); }));
      groups.forEach(function (grp) { var n = groupName(grp); chipsRow.appendChild(WC.ui.chip('Grupo ' + n, filter === 'G:' + n, function () { filter = 'G:' + n; render(); })); });
      koRounds.forEach(function (r) { chipsRow.appendChild(WC.ui.chip(r[1], filter === 'K:' + r[0], function () { filter = 'K:' + r[0]; render(); })); });
    }

    function render() {
      drawChips();
      container.innerHTML = '';
      groups.forEach(function (grp) { var n = groupName(grp); if (filter === 'ALL' || filter === 'G:' + n) container.appendChild(buildMatrix(grp, n)); });
      koRounds.forEach(function (r) { if (filter === 'ALL' || filter === 'K:' + r[0]) container.appendChild(buildRound(r[1], koByType[r[0]])); });
      patchGroups();
    }

    function buildMatrix(grp, name) {
      var ids = (grp.teams || []).map(function (t) { return t.team_id; });
      var table = el('table', { class: 'table is-bordered is-narrow matriz-table' });
      table.appendChild(matrixHead(ids, label));
      var tb = el('tbody', {});
      ids.forEach(function (rowId) { tb.appendChild(matrixRow(rowId, ids, label)); });
      table.appendChild(tb);
      return el('div', { class: 'column is-half' }, [el('div', { class: 'box' }, [el('p', { class: 'title is-5 mb-3', text: 'Grupo ' + name }), table])]);
    }

    function buildRound(name, gs) {
      var list = el('div', { class: 'ko-grid' });
      gs.slice().sort(function (a, b) { return orderKey(a.local_date) - orderKey(b.local_date); }).forEach(function (g) {
        var mid = U.isFinished(g) ? (g.home_score + ' - ' + g.away_score) : 'vs';
        list.appendChild(el('div', { class: 'ko-row' }, [
          el('span', { class: 'ko-side', text: koName(g, 'home') }),
          el('span', { class: 'ko-mid', text: mid }),
          el('span', { class: 'ko-side ko-away', text: koName(g, 'away') })
        ]));
      });
      return el('div', { class: 'column is-half' }, [el('div', { class: 'box' }, [el('p', { class: 'title is-5 mb-3', text: name }), list])]);
    }

    // Parchea SOLO las celdas ya jugadas (no reconstruye la matriz).
    function patchGroups() {
      note.innerHTML = '';
      if (!gamesRes.ok) { note.appendChild(patchWarning()); return; }
      games.forEach(function (g) {
        if (g.type && g.type !== 'group') return;      // solo partidos de grupo
        if (!U.isFinished(g)) return;
        patchCell(container, g.home_team_id, g.away_team_id, g.home_score + ' - ' + g.away_score);
        patchCell(container, g.away_team_id, g.home_team_id, g.away_score + ' - ' + g.home_score);
      });
    }
    function patchWarning() {
      var box = el('div', { class: 'notification is-warning is-light' });
      box.appendChild(el('span', { text: 'Resultados no disponibles: las celdas quedan en “Pendiente”. ' }));
      var b = el('button', { class: 'button is-small is-warning ml-2', text: 'Reintentar' });
      b.addEventListener('click', function () { root.innerHTML = ''; mount(root); });
      box.appendChild(b);
      return box;
    }

    render();
  }

  WC.views = WC.views || {};
  WC.views.matriz = { mount: mount };
})(window.WC = window.WC || {});
