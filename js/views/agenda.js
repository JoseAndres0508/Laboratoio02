/* ============================================================================
 * views/agenda.js  —  2.2 Agenda Simultánea  (Bulma + chips de fecha)
 * Técnica requerida: agrupar por local_date + layout dividido en columnas.
 * Sub-opciones: chips de todas las fechas simultáneas (además de prev/next).
 * Resiliencia: esqueletos mientras carga; nunca pantalla en blanco.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;
  function parseDate(s) { var d = new Date(s); return isNaN(d) ? new Date(8640000000000000) : d; }

  async function mount(root) {
    var controls = el('div', { class: 'is-flex is-align-items-center mb-3', style: 'gap:12px' });
    var prev = el('button', { class: 'button is-dark' }, [WC.ui.icon('angle-left'), el('span', { text: 'Anterior' })]);
    var dateLabel = el('span', { class: 'title is-5 mb-0', text: 'Cargando…' });
    var next = el('button', { class: 'button is-dark' }, [el('span', { text: 'Siguiente' }), WC.ui.icon('angle-right')]);
    controls.appendChild(prev); controls.appendChild(dateLabel); controls.appendChild(next);
    root.appendChild(controls);
    var chipsRow = el('div', { class: 'chips' });
    root.appendChild(chipsRow);
    var grid = el('div', { class: 'columns is-multiline' });
    root.appendChild(grid);

    // Esqueletos antes de la respuesta.
    renderSkeletons(grid, 3);

    var gamesRes = await WC.api.load('/get/games');
    var teamsRes = await WC.api.load('/get/teams');
    if (!gamesRes.ok) {
      grid.innerHTML = '';
      grid.appendChild(WC.ui.errorNotice('No hay datos en caché ni respuesta de red.', function () { root.innerHTML = ''; mount(root); }));
      return;
    }
    if (gamesRes.stale || teamsRes.stale) root.insertBefore(WC.ui.staleBadge(), controls);

    var teamsIndex = U.indexById(U.asArray(teamsRes.ok ? teamsRes.data : []));
    function nameOf(id) { return U.teamName(teamsIndex[id], id); }

    var byDate = {};
    U.asArray(gamesRes.data).forEach(function (g) { (byDate[g.local_date] = byDate[g.local_date] || []).push(g); });
    var dates = Object.keys(byDate).filter(function (d) { return byDate[d].length >= 2; })
      .sort(function (a, b) { return parseDate(a) - parseDate(b); });

    if (!dates.length) {
      chipsRow.remove();
      grid.innerHTML = '';
      grid.appendChild(el('p', { class: 'has-text-grey', text: 'No hay fechas con partidos simultáneos.' }));
      dateLabel.textContent = '—';
      return;
    }

    var idx = 0;
    // Chips: cada fecha simultánea como opción rápida.
    dates.forEach(function (d, i) {
      chipsRow.appendChild(WC.ui.chip(d.replace(', 2026', ''), false, function () { idx = i; render(); }));
    });

    function render() {
      var date = dates[idx];
      dateLabel.textContent = date + '  (' + (idx + 1) + '/' + dates.length + ')';
      prev.disabled = (idx === 0); next.disabled = (idx === dates.length - 1);
      [].forEach.call(chipsRow.children, function (c, i) {
        c.className = 'button is-small ' + (i === idx ? 'is-primary' : 'is-dark');
      });
      grid.innerHTML = '';
      byDate[date].forEach(function (g) { grid.appendChild(matchColumn(g, nameOf)); });
    }
    prev.addEventListener('click', function () { if (idx > 0) { idx--; render(); } });
    next.addEventListener('click', function () { if (idx < dates.length - 1) { idx++; render(); } });
    render();
  }

  function renderSkeletons(grid, n) {
    grid.innerHTML = '';
    for (var i = 0; i < n; i++) {
      grid.appendChild(el('div', { class: 'column is-one-third' }, [el('div', { class: 'box' }, [el('div', { class: 'skel skel-card' })])]));
    }
  }

  function matchColumn(g, nameOf) {
    var score = g.finished ? (g.home_score + ' - ' + g.away_score) : 'vs';
    return el('div', { class: 'column is-one-third' }, [
      el('div', { class: 'box accent-bar has-text-centered' }, [
        el('p', { class: 'has-text-grey mb-2', text: 'Grupo ' + g.group + ' · J' + g.matchday }),
        el('p', { class: 'title is-6 mb-1', text: nameOf(g.home_team_id) }),
        el('p', { class: 'title is-3 accent-text my-2', text: score }),
        el('p', { class: 'title is-6', text: nameOf(g.away_team_id) })
      ])
    ]);
  }

  WC.views = WC.views || {};
  WC.views.agenda = { mount: mount };
})(window.WC = window.WC || {});
