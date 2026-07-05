/* ============================================================================
 * views/tour.js  —  2.1 Tour Virtual de Sedes
 * Recorrido: dropdown para elegir estadio -> scrollIntoView al elegido
 *            (muestra Nombre + País y los partidos jugados ahí).
 * Por país : botones de país; sin selección = todos los estadios en orden
 *            alfabético; con país = solo los de ese país.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;

  async function mount(root) {
    var sub = WC.ui.subtabs([
      { id: 'recorrido', label: 'Recorrido', icon: 'route' },
      { id: 'pais', label: 'Por país', icon: 'flag' }
    ], function (id) { render(id); });
    root.appendChild(sub.nav);
    var body = el('div', {});
    root.appendChild(body);

    var stadiumsRes = await WC.api.load('/get/stadiums');
    if (!stadiumsRes.ok) {
      body.appendChild(WC.ui.errorNotice('No se pudieron cargar las sedes.', function () { root.innerHTML = ''; mount(root); }));
      return;
    }
    // Estadios ordenados alfabéticamente por nombre.
    var stadiums = U.asArray(stadiumsRes.data).slice()
      .sort(function (a, b) { return (a.name_en || '').localeCompare(b.name_en || ''); });

    var gamesRes = await WC.api.load('/get/games');
    var gamesFailed = !gamesRes.ok;
    var byStadium = {};
    if (!gamesFailed) U.asArray(gamesRes.data).forEach(function (g) {
      (byStadium[g.stadium_id] = byStadium[g.stadium_id] || []).push(g);
    });
    var stale = stadiumsRes.stale || gamesRes.stale;

    function render(mode) {
      body.innerHTML = '';
      if (stale) body.appendChild(WC.ui.staleBadge());
      if (mode === 'pais') renderByCountry(); else renderRecorrido();
    }

    // ---------- RECORRIDO: dropdown + scrollIntoView ----------
    function renderRecorrido() {
      var select = el('select', {});
      stadiums.forEach(function (s) {
        select.appendChild(el('option', { value: s.id, text: (s.name_en || ('Sede ' + s.id)) }));
      });
      body.appendChild(el('div', { class: 'field', style: 'max-width:440px' }, [
        el('label', { class: 'label is-small', text: 'Selecciona un estadio' }),
        el('div', { class: 'select is-fullwidth' }, [select])
      ]));

      var sections = el('div', {});
      body.appendChild(sections);

      var activeId = null, scrolling = false, timer = null;
      function setActive(id) {
        activeId = id;
        [].forEach.call(sections.querySelectorAll('.stadium-section'), function (sec) {
          sec.classList.toggle('is-active', sec.dataset.id === id);
        });
      }
      function goTo(id) {
        setActive(id);
        var sec = sections.querySelector('[data-id="' + id + '"]');
        if (!sec) return;
        scrolling = true;
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });   // técnica requerida (2.1)
        clearTimeout(timer); timer = setTimeout(function () { scrolling = false; }, 700);
      }

      stadiums.forEach(function (s) {
        // Encabezado: SOLO nombre y país.
        var card = el('div', { class: 'box stadium-section', dataset: { id: s.id } }, [
          el('h2', { class: 'title is-5 mb-1', text: (s.name_en || ('Sede ' + s.id)) }),
          el('p', { class: 'subtitle is-6 has-text-grey mb-3', text: (s.country_en || '—') })
        ]);
        // Debajo: los grupos/partidos jugados en ese estadio.
        var list = el('div', {});
        if (gamesFailed) {
          list.appendChild(el('p', { class: 'has-text-danger', text: 'No se pudieron cargar los partidos de esta sede.' }));
        } else {
          var matches = byStadium[s.id] || [];
          if (!matches.length) list.appendChild(el('p', { class: 'has-text-grey', text: 'Sin partidos asignados.' }));
          matches.forEach(function (g) { list.appendChild(matchTag(g)); });
        }
        card.appendChild(list);
        sections.appendChild(card);
      });

      select.addEventListener('change', function () { goTo(select.value); });
      if (stadiums[0]) { select.value = stadiums[0].id; setActive(stadiums[0].id); }
    }

    // ---------- POR PAÍS: botones + tarjetas ----------
    function renderByCountry() {
      var countries = [];
      stadiums.forEach(function (s) { var c = s.country_en || 'Otro'; if (countries.indexOf(c) < 0) countries.push(c); });
      countries.sort();

      var selected = null; // null = Todos
      var btnRow = el('div', { class: 'chips' });
      var grid = el('div', { class: 'columns is-multiline' });
      body.appendChild(btnRow);
      body.appendChild(grid);

      function drawButtons() {
        btnRow.innerHTML = '';
        btnRow.appendChild(WC.ui.chip('Todos', selected === null, function () { selected = null; update(); }));
        countries.forEach(function (c) {
          btnRow.appendChild(WC.ui.chip(c, selected === c, function () { selected = c; update(); }));
        });
      }
      function update() {
        drawButtons();
        grid.innerHTML = '';
        // Sin país => todos (ya vienen en orden alfabético). Con país => filtra.
        var list = stadiums.filter(function (s) { return selected === null || (s.country_en || 'Otro') === selected; });
        list.forEach(function (s) {
          var count = gamesFailed ? '—' : ((byStadium[s.id] || []).length);
          grid.appendChild(el('div', { class: 'column is-one-third' }, [
            el('div', { class: 'box accent-bar' }, [
              el('p', { class: 'title is-6 mb-1', text: (s.name_en || ('Sede ' + s.id)) }),
              el('p', { class: 'has-text-grey', text: (s.city_en || '') + ' · ' + (s.country_en || '') }),
              el('span', { class: 'tag is-primary is-light mt-2', text: count + ' partidos' })
            ])
          ]));
        });
      }
      update();
    }

    render('recorrido');
  }

  function matchTag(g) {
    var score = g.finished ? (g.home_score + ' - ' + g.away_score) : 'Por jugar';
    return WC.ui.el('div', { class: 'is-flex is-justify-content-space-between py-1', style: 'border-bottom:1px solid rgba(255,255,255,.06)' }, [
      WC.ui.el('span', { text: 'Grupo ' + g.group + ' · J' + g.matchday }),
      WC.ui.el('span', { class: 'has-text-grey', text: g.local_date + ' · ' + score })
    ]);
  }

  WC.views = WC.views || {};
  WC.views.tour = { mount: mount };
})(window.WC = window.WC || {});