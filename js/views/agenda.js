/* ============================================================================
 * views/agenda.js  —  2.2 Agenda Simultánea
 * Fecha en formato corto (p. ej. "Jueves 11 jun", sin año). Si hay varios
 * partidos el mismo día, cada card muestra la hora debajo de los equipos.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;

  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function toDate(s) { var d = new Date(s); return isNaN(d) ? null : d; }
  function ordenKey(s) { var d = toDate(s); return d ? d.getTime() : Number.MAX_SAFE_INTEGER; }

  // "Jueves 11 jun"
  function dayLabel(s) {
    var d = toDate(s); if (!d) return s;
    return DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()];
  }
  // Chip corto: "11 jun"
  function chipLabel(s) {
    var d = toDate(s); if (!d) return s;
    return d.getDate() + ' ' + MESES[d.getMonth()];
  }
  // "20:00" (vacío si el dato no trae hora, para no inventar 00:00)
  function hourLabel(s) {
    var d = toDate(s); if (!d) return '';
    if (d.getHours() === 0 && d.getMinutes() === 0) return '';
    var h = ('0' + d.getHours()).slice(-2), m = ('0' + d.getMinutes()).slice(-2);
    return h + ':' + m;
  }

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

    // Agrupar por DÍA (ignora la hora, para juntar los del mismo día).
    var byDay = {};
    U.asArray(gamesRes.data).forEach(function (g) {
      var d = toDate(g.local_date);
      var key = d ? (d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()) : g.local_date;
      (byDay[key] = byDay[key] || { ref: g.local_date, games: [] }).games.push(g);
    });
    var days = Object.keys(byDay)
      .filter(function (k) { return byDay[k].games.length >= 2; })
      .sort(function (a, b) { return ordenKey(byDay[a].ref) - ordenKey(byDay[b].ref); });

    if (!days.length) {
      chipsRow.remove();
      grid.innerHTML = '';
      grid.appendChild(el('p', { class: 'has-text-grey', text: 'No hay fechas con partidos simultáneos.' }));
      dateLabel.textContent = '—';
      return;
    }

    var idx = 0;
    days.forEach(function (k, i) {
      chipsRow.appendChild(WC.ui.chip(chipLabel(byDay[k].ref), false, function () { idx = i; render(); }));
    });

    function render() {
      var day = byDay[days[idx]];
      dateLabel.textContent = dayLabel(day.ref) + '  (' + (idx + 1) + '/' + days.length + ')';
      prev.disabled = (idx === 0); next.disabled = (idx === days.length - 1);
      [].forEach.call(chipsRow.children, function (c, i) {
        c.className = 'button is-small ' + (i === idx ? 'is-primary' : 'is-dark');
      });
      grid.innerHTML = '';
      // Orden por hora dentro del día.
      day.games.slice().sort(function (a, b) { return ordenKey(a.local_date) - ordenKey(b.local_date); })
        .forEach(function (g) { grid.appendChild(matchColumn(g, nameOf)); });
    }
    prev.addEventListener('click', function () { if (idx > 0) { idx--; render(); } });
    next.addEventListener('click', function () { if (idx < days.length - 1) { idx++; render(); } });
    render();
  }

  function renderSkeletons(grid, n) {
    grid.innerHTML = '';
    for (var i = 0; i < n; i++) {
      grid.appendChild(el('div', { class: 'column is-one-third' }, [el('div', { class: 'box' }, [el('div', { class: 'skel skel-card' })])]));
    }
  }

  function matchColumn(g, nameOf) {
    var main = g.finished
      ? (nameOf(g.home_team_id) + '  ' + g.home_score + ' - ' + g.away_score + '  ' + nameOf(g.away_team_id))
      : (nameOf(g.home_team_id) + '  vs  ' + nameOf(g.away_team_id));
    var hora = hourLabel(g.local_date);

    var children = [
      el('p', { class: 'has-text-grey is-size-7 mb-2', text: 'Grupo ' + g.group + ' - J' + g.matchday }),
      el('p', { class: 'title is-6 mb-1', text: main })
    ];
    if (hora) children.push(el('p', { class: 'has-text-grey mt-2', text: hora }));

    return el('div', { class: 'column is-one-third' }, [
      el('div', { class: 'box accent-bar has-text-centered', style: 'height:100%' }, children)
    ]);
  }

  WC.views = WC.views || {};
  WC.views.agenda = { mount: mount };
})(window.WC = window.WC || {});