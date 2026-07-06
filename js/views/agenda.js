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

    // Agrupar por día; nos quedamos con los de 2+ (simultáneos).
    var byKey = {};
    U.asArray(gamesRes.data).forEach(function (g) {
      var d = toDate(g.local_date); if (!d) return;
      var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      (byKey[key] = byKey[key] || { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), ref: g.local_date, games: [] }).games.push(g);
    });
    var activeKeys = Object.keys(byKey).filter(function (k) { return byKey[k].games.length >= 2; })
      .sort(function (a, b) { return orderKey(byKey[a].ref) - orderKey(byKey[b].ref); });

    colA.innerHTML = '';
    if (!activeKeys.length) {
      colA.appendChild(el('p', { class: 'has-text-grey', text: 'No hay fechas con partidos simultáneos.' }));
      return;
    }

    // Meses que contienen días activos.
    var months = [];
    activeKeys.forEach(function (k) {
      var o = byKey[k], id = o.y + '-' + o.m;
      if (!months.some(function (mm) { return mm.id === id; })) months.push({ id: id, y: o.y, m: o.m });
    });

    var selected = activeKeys[0];

    function isActive(y, m, d) { return byKey[y + '-' + m + '-' + d] && byKey[y + '-' + m + '-' + d].games.length >= 2; }

    function renderCalendar() {
      colA.innerHTML = '';
      months.forEach(function (mm) {
        var box = el('div', { class: 'cal-month' }, [el('div', { class: 'cal-title', text: MESES[mm.m] + ' ' + mm.y })]);
        var grid = el('div', { class: 'cal-grid' });
        DOW.forEach(function (w) { grid.appendChild(el('div', { class: 'cal-dow', text: w })); });
        var offset = firstDowMon(mm.y, mm.m), total = daysInMonth(mm.y, mm.m);
        for (var i = 0; i < offset; i++) grid.appendChild(el('div', { class: 'cal-cell empty' }));
        for (var day = 1; day <= total; day++) {
          var key = mm.y + '-' + mm.m + '-' + day;
          var cls = 'cal-cell';
          if (isActive(mm.y, mm.m, day)) { cls += (key === selected) ? ' selected' : ' active'; }
          else cls += ' inactive';
          var cell = el('div', { class: cls, text: String(day) });
          if (isActive(mm.y, mm.m, day)) {
            (function (k) { cell.addEventListener('click', function () { selected = k; renderCalendar(); renderDay(); }); })(key);
          }
          grid.appendChild(cell);
        }
        box.appendChild(grid);
        colA.appendChild(box);
      });
    }

    function renderDay() {
      colB.innerHTML = '';
      var o = byKey[selected];
      var d = toDate(o.ref);
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

  function matchCard(g, nameOf) {
    var main = g.finished
      ? (nameOf(g.home_team_id) + '  ' + g.home_score + ' - ' + g.away_score + '  ' + nameOf(g.away_team_id))
      : (nameOf(g.home_team_id) + '  vs  ' + nameOf(g.away_team_id));
    var hora = hourLabel(g.local_date);
    var children = [
      el('p', { class: 'has-text-grey is-size-7 mb-2', text: 'Grupo ' + g.group + ' - J' + g.matchday }),
      el('p', { class: 'title is-6 mb-1', text: main })
    ];
    if (hora) children.push(el('p', { class: 'has-text-grey mt-2', text: hora }));
    return el('div', { class: 'box accent-bar has-text-centered', style: 'height:100%' }, children);
  }

  WC.views = WC.views || {};
  WC.views.agenda = { mount: mount };
})(window.WC = window.WC || {});