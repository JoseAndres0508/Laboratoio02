/* ============================================================================
 * views/matriz.js  —  2.5 Matriz de Enfrentamientos  (Bulma + chips de grupo)
 * Técnica requerida: cuadrícula 4x4 por grupo cruzando 3 recursos; diagonal
 * deshabilitada; parcheo de celdas (no reconstruir).
 * Sub-opciones: chips A–L (+ Todos) para elegir qué grupo(s) ver.
 * Resiliencia: dibuja todo "Pendiente" y parchea al recuperar los partidos.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;

  async function mount(root) {
    var chipsRow = el('div', { class: 'chips' });
    root.appendChild(chipsRow);
    var container = el('div', { class: 'columns is-multiline' });
    root.appendChild(container);
    var note = el('div', { class: 'mt-3' });
    root.appendChild(note);

    var groupsRes = await WC.api.load('/get/groups');
    var teamsRes = await WC.api.load('/get/teams');
    if (!groupsRes.ok || !teamsRes.ok) {
      container.appendChild(WC.ui.errorNotice('No se pudieron cargar grupos/equipos.', function () { root.innerHTML = ''; mount(root); }));
      return;
    }
    if (groupsRes.stale || teamsRes.stale) root.insertBefore(WC.ui.staleBadge(), chipsRow);

    var groups = U.asArray(groupsRes.data);
    var teamsIndex = U.indexById(U.asArray(teamsRes.data));
    function label(id) { var t = teamsIndex[id]; return t ? (t.fifa_code || t.name_en || id) : id; }

    var filter = 'ALL';
    function drawChips() {
      chipsRow.innerHTML = '';
      chipsRow.appendChild(WC.ui.chip('Todos', filter === 'ALL', function () { filter = 'ALL'; renderGroups(); }));
      groups.forEach(function (g) {
        chipsRow.appendChild(WC.ui.chip('Grupo ' + g.group, filter === g.group, function () { filter = g.group; renderGroups(); }));
      });
    }

    function renderGroups() {
      drawChips();
      container.innerHTML = '';
      groups.filter(function (g) { return filter === 'ALL' || g.group === filter; })
        .forEach(function (grp) { container.appendChild(buildMatrix(grp, label)); });
      runPatch();
    }

    async function runPatch() {
      var failed = await patchWithGames(container);
      note.innerHTML = '';
      if (failed) {
        var box = el('div', { class: 'notification is-warning is-light' });
        box.appendChild(el('span', { text: 'Resultados no disponibles: las celdas quedan en “Pendiente”. ' }));
        var b = el('button', { class: 'button is-small is-warning ml-2' }, [el('span', { text: 'Reintentar resultados' })]);
        b.addEventListener('click', runPatch);
        box.appendChild(b);
        note.appendChild(box);
      }
    }

    renderGroups();
  }

  async function patchWithGames(container) {
    var gamesRes = await WC.api.load('/get/games');
    if (!gamesRes.ok) return true;
    WC.util.asArray(gamesRes.data).forEach(function (g) {
      if (!g.finished) return;
      patchCell(container, g.home_team_id, g.away_team_id, g.home_score + ' - ' + g.away_score);
      patchCell(container, g.away_team_id, g.home_team_id, g.away_score + ' - ' + g.home_score);
    });
    return false;
  }
  function patchCell(container, rowId, colId, text) {
    var cell = container.querySelector('[data-cell="' + rowId + '_' + colId + '"]');
    if (cell) { cell.textContent = text; cell.classList.add('played'); cell.classList.remove('pending'); }
  }

  function buildMatrix(grp, label) {
    var ids = (grp.teams || []).map(function (t) { return t.team_id; });
    var table = el('table', { class: 'table is-bordered is-narrow matriz-table' });
    var head = el('tr', {}, [el('th', { text: '' })]);
    ids.forEach(function (id) { head.appendChild(el('th', { text: label(id) })); });
    table.appendChild(el('thead', {}, [head]));
    var tb = el('tbody', {});
    ids.forEach(function (rowId) {
      var tr = el('tr', {}, [el('th', { text: label(rowId) })]);
      ids.forEach(function (colId) {
        if (rowId === colId) tr.appendChild(el('td', { class: 'cell diag', text: '—' }));
        else tr.appendChild(el('td', { class: 'cell pending', dataset: { cell: rowId + '_' + colId }, text: 'Pendiente' }));
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    return el('div', { class: 'column is-half' }, [
      el('div', { class: 'box' }, [el('p', { class: 'title is-5 mb-3', text: 'Grupo ' + grp.group }), table])
    ]);
  }

  WC.views = WC.views || {};
  WC.views.matriz = { mount: mount };
})(window.WC = window.WC || {});
