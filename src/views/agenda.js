/* ============================================================================
 * views/agenda.js  —  2.2 Agenda Simultánea
 * Columna A: calendario (solo resalta días con 2+ partidos simultáneos).
 * Columna B: los partidos de ese día como cards (grupo·J / equipos / hora).
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;

  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var DOW = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']; // semana inicia lunes
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var MES_AB = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function toDate(s) { var d = new Date(s); return isNaN(d) ? null : d; }
  function orderKey(s) { var d = toDate(s); return d ? d.getTime() : Number.MAX_SAFE_INTEGER; }
  function hourLabel(s) { var d = toDate(s); if (!d || (d.getHours() === 0 && d.getMinutes() === 0)) return ''; return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function firstDowMon(y, m) { return (new Date(y, m, 1).getDay() + 6) % 7; } // 0 = lunes
  function dayKey(y, m, d) { return y + '-' + m + '-' + d; }

  // ---------- Preparación de datos ----------
  // Agrupa por día; guardamos y/m/d + la fecha de referencia + sus partidos.
  function groupByDay(games) {
    var byKey = {};
    U.asArray(games).forEach(function (g) {
      var d = toDate(g.local_date); if (!d) return;
      var key = dayKey(d.getFullYear(), d.getMonth(), d.getDate());
      (byKey[key] = byKey[key] || { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), ref: g.local_date, games: [] }).games.push(g);
    });
    return byKey;
  }
  // Días con 2+ partidos (simultáneos), ordenados cronológicamente.
  function activeDayKeys(byKey) {
    return Object.keys(byKey).filter(function (k) { return byKey[k].games.length >= 2; })
      .sort(function (a, b) { return orderKey(byKey[a].ref) - orderKey(byKey[b].ref); });
  }
  function monthsOf(byKey, activeKeys) {
    var months = [];
    activeKeys.forEach(function (k) {
      var o = byKey[k], id = o.y + '-' + o.m;
      if (!months.some(function (mm) { return mm.id === id; })) months.push({ id: id, y: o.y, m: o.m });
    });
    return months;
  }
  function isActiveDay(byKey, y, m, d) { var o = byKey[dayKey(y, m, d)]; return !!(o && o.games.length >= 2); }

  // ---------- Construcción del calendario ----------
  function calCell(mm, day, byKey, selected, onSelectDay) {
    var key = dayKey(mm.y, mm.m, day);
    var active = isActiveDay(byKey, mm.y, mm.m, day);
    var cls = 'cal-cell' + (active ? (key === selected ? ' selected' : ' active') : ' inactive');
    var cell = el('div', { class: cls, text: String(day) });
    if (active) cell.addEventListener('click', function () { onSelectDay(key); });
    return cell;
  }
  function buildMonth(mm, byKey, selected, onSelectDay) {
    var box = el('div', { class: 'cal-month' }, [el('div', { class: 'cal-title', text: MESES[mm.m] + ' ' + mm.y })]);
    var grid = el('div', { class: 'cal-grid' });
    DOW.forEach(function (w) { grid.appendChild(el('div', { class: 'cal-dow', text: w })); });
    var offset = firstDowMon(mm.y, mm.m), total = daysInMonth(mm.y, mm.m);
    for (var i = 0; i < offset; i++) grid.appendChild(el('div', { class: 'cal-cell empty' }));
    for (var day = 1; day <= total; day++) grid.appendChild(calCell(mm, day, byKey, selected, onSelectDay));
    box.appendChild(grid);
    return box;
  }

  function matchCard(g, nameOf) {
    var main = U.isFinished(g)
      ? (nameOf(g.home_team_id) + '  ' + g.home_score + ' - ' + g.away_score + '  ' + nameOf(g.away_team_id))
      : (nameOf(g.home_team_id) + '  vs  ' + nameOf(g.away_team_id));
    var children = [
      el('p', { class: 'has-text-grey is-size-7 mb-2', text: 'Grupo ' + g.group + ' - J' + g.matchday }),
      el('p', { class: 'title is-6 mb-1', text: main })
    ];
    var hora = hourLabel(g.local_date);
    if (hora) children.push(el('p', { class: 'has-text-grey mt-2', text: hora }));
    return el('div', { class: 'box accent-bar has-text-centered', style: 'height:100%' }, children);
  }

  // ---------- Vista ----------
  async function mount(root) {
    var layout = el('div', { class: 'agenda-grid2' });
    var colA = el('div', { class: 'agenda-cal' });
    var colB = el('div', { class: 'agenda-day' });
    layout.appendChild(colA); layout.appendChild(colB);
    root.appendChild(layout);
    colA.appendChild(WC.ui.skeleton(6));

    var gamesRes = await WC.api.load('/get/games');
    var teamsRes = await WC.api.load('/get/teams');
    if (!gamesRes.ok) {
      colA.innerHTML = '';
      colA.appendChild(WC.ui.errorNotice('No hay datos en caché ni respuesta de red.', function () { root.innerHTML = ''; mount(root); }));
      return;
    }
    if (gamesRes.stale || teamsRes.stale) root.insertBefore(WC.ui.staleBadge(), layout);

    var teamsIndex = U.indexById(U.asArray(teamsRes.ok ? teamsRes.data : []));
    function nameOf(id) { return U.teamName(teamsIndex[id], id); }

    var byKey = groupByDay(gamesRes.data);
    var activeKeys = activeDayKeys(byKey);
    colA.innerHTML = '';
    if (!activeKeys.length) {
      colA.appendChild(el('p', { class: 'has-text-grey', text: 'No hay fechas con partidos simultáneos.' }));
      return;
    }

    var months = monthsOf(byKey, activeKeys);
    var selected = activeKeys[0];

    function onSelectDay(key) { selected = key; renderCalendar(); renderDay(); }
    function renderCalendar() {
      colA.innerHTML = '';
      months.forEach(function (mm) { colA.appendChild(buildMonth(mm, byKey, selected, onSelectDay)); });
    }
    function renderDay() {
      colB.innerHTML = '';
      var o = byKey[selected], d = toDate(o.ref);
      var title = d ? (DIAS[d.getDay()] + ' ' + o.d + ' ' + MES_AB[o.m]) : '';
      colB.appendChild(el('h2', { class: 'title is-5 mb-3', text: title + ' · ' + o.games.length + ' partidos' }));
      var cards = el('div', { class: 'day-cards' });
      o.games.slice().sort(function (a, b) { return orderKey(a.local_date) - orderKey(b.local_date); })
        .forEach(function (g) { cards.appendChild(matchCard(g, nameOf)); });
      colB.appendChild(cards);
    }

    renderCalendar();
    renderDay();
  }

  WC.views = WC.views || {};
  WC.views.agenda = { mount: mount };
})(window.WC = window.WC || {});
