/* ============================================================================
 * views/matriz.js  —  2.5 Matriz de Enfrentamientos por Grupo
 * ----------------------------------------------------------------------------
 * Técnica de DOM: cuadrícula interactiva 4x4 por grupo cruzando TRES recursos.
 * Endpoints: GET /get/groups, GET /get/teams, GET /get/games.
 *
 * Reto de resiliencia: si /get/games falla, la matriz se dibuja COMPLETA con
 * todas las celdas en "Pendiente" (no se oculta). Al recuperar la conexión,
 * solo se PARCHEAN las celdas afectadas; la matriz no se reconstruye.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el;
  var staleBadge = WC.ui.staleBadge;

  async function mount(root) {
    root.appendChild(el('h1', { class: 'view-title', text: 'Matriz de Enfrentamientos por Grupo' }));

    var container = el('div', { class: 'matriz-container' });
    root.appendChild(container);

    var groupsRes = await WC.api.load('/get/groups');
    var teamsRes = await WC.api.load('/get/teams');

    if (!groupsRes.ok || !teamsRes.ok) {
      container.appendChild(el('div', { class: 'error-box', text: 'No se pudieron cargar grupos/equipos.' }));
      var retry = el('button', { class: 'btn', text: 'Reintentar' });
      retry.addEventListener('click', function () { root.innerHTML = ''; mount(root); });
      container.appendChild(retry);
      return;
    }
    if (groupsRes.stale || teamsRes.stale) root.insertBefore(staleBadge(), container);

    function teamLabel(id) {
      var t = teamsRes.data.find(function (x) { return x.id === id; });
      return t ? (t.fifa_code || t.name_en) : id;
    }

    // 1) Dibujar TODAS las matrices con celdas "Pendiente" (aunque games falle).
    groupsRes.data.forEach(function (grp) {
      container.appendChild(buildMatrix(grp, teamLabel));
    });

    // 2) Pedir partidos y PARCHAR solo las celdas afectadas (no reconstruir).
    var note = el('div', { class: 'matriz-note' });
    root.appendChild(note);

    async function runPatch() {
      var failed = await patchWithGames(container);
      note.innerHTML = '';
      if (failed) {
        note.appendChild(el('span', { class: 'muted',
          text: 'Resultados no disponibles: todas las celdas quedan en “Pendiente”. ' }));
        var rbtn = el('button', { class: 'btn btn-sm', text: 'Reintentar resultados' });
        rbtn.addEventListener('click', runPatch); // re-parchea sin rehacer la matriz
        note.appendChild(rbtn);
      }
    }
    await runPatch();
  }

  // Devuelve true si los partidos no se pudieron cargar.
  async function patchWithGames(container) {
    var gamesRes = await WC.api.load('/get/games');
    if (!gamesRes.ok) return true;
    gamesRes.data.forEach(function (g) {
      if (!g.finished) return;
      patchCell(container, g.home_team_id, g.away_team_id, g.home_score + ' - ' + g.away_score);
      patchCell(container, g.away_team_id, g.home_team_id, g.away_score + ' - ' + g.home_score);
    });
    return false;
  }

  function patchCell(container, rowId, colId, text) {
    var cell = container.querySelector('[data-cell="' + rowId + '_' + colId + '"]');
    if (cell) {
      cell.textContent = text;
      cell.classList.add('played');
      cell.classList.remove('pending');
    }
  }

  function buildMatrix(grp, teamLabel) {
    var ids = (grp.teams || []).map(function (t) { return t.team_id; });
    var wrap = el('div', { class: 'matriz-group' }, [el('h2', { text: 'Grupo ' + grp.group })]);
    var table = el('table', { class: 'matriz-table' });

    var head = el('tr', {}, [el('th', { text: '' })]);
    ids.forEach(function (id) { head.appendChild(el('th', { text: teamLabel(id) })); });
    table.appendChild(head);

    ids.forEach(function (rowId) {
      var tr = el('tr', {}, [el('th', { class: 'row-head', text: teamLabel(rowId) })]);
      ids.forEach(function (colId) {
        if (rowId === colId) {
          // Diagonal: equipo contra sí mismo -> visualmente deshabilitada.
          tr.appendChild(el('td', { class: 'cell diag', text: '—' }));
        } else {
          tr.appendChild(el('td', {
            class: 'cell pending',
            dataset: { cell: rowId + '_' + colId },
            text: 'Pendiente'
          }));
        }
      });
      table.appendChild(tr);
    });

    wrap.appendChild(table);
    return wrap;
  }

  WC.views = WC.views || {};
  WC.views.matriz = { mount: mount };
})(window.WC = window.WC || {});
