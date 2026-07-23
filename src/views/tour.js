/* ============================================================================
 * views/tour.js  —  2.1 Tour Virtual de Sedes
 * Recorrido: dropdown -> scrollIntoView DENTRO de un section con scroll propio
 *            (la página no se mueve). Muestra Nombre + País y sus partidos.
 * Por país : botones; sin selección = todos alfabético; con país = filtrado.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el, U = WC.util;

  // ---------- Helpers de construcción (reutilizables, pequeños) ----------
  function matchTag(g) {
    var score = U.isFinished(g) ? (g.home_score + ' - ' + g.away_score) : 'Por jugar';
    return el('div', { class: 'is-flex is-justify-content-space-between py-1', style: 'border-bottom:1px solid rgba(255,255,255,.06)' }, [
      el('span', { text: 'Grupo ' + g.group + ' · J' + g.matchday }),
      el('span', { class: 'has-text-grey', text: g.local_date + ' · ' + score })
    ]);
  }

  // Nombre de la sede.
  function stadiumTitle(s) { return s.name_en || ('Sede ' + s.id); }

  // Lista de partidos de una sede (o el mensaje local si /get/games falló).
  function stadiumMatchList(s, gamesFailed, byStadium) {
    var list = el('div', {});
    if (gamesFailed) {
      list.appendChild(el('p', { class: 'has-text-danger', text: 'No se pudieron cargar los partidos de esta sede.' }));
      return list;
    }
    var matches = byStadium[s.id] || [];
    if (!matches.length) list.appendChild(el('p', { class: 'has-text-grey', text: 'Sin partidos asignados.' }));
    matches.forEach(function (g) { list.appendChild(matchTag(g)); });
    return list;
  }

  // Tarjeta de una sede con sus partidos.
  function stadiumCard(s, gamesFailed, byStadium) {
    var card = el('div', { class: 'box stadium-section', dataset: { id: s.id } }, [
      el('h2', { class: 'title is-5 mb-1', text: stadiumTitle(s) }),
      el('p', { class: 'subtitle is-6 has-text-grey mb-3', text: (s.country_en || '—') })
    ]);
    card.appendChild(stadiumMatchList(s, gamesFailed, byStadium));
    return card;
  }

  // Selector desplegable de estadios.
  function stadiumSelectField(stadiums) {
    var select = el('select', {});
    stadiums.forEach(function (s) { select.appendChild(el('option', { value: s.id, text: stadiumTitle(s) })); });
    var field = el('div', { class: 'field', style: 'max-width:440px' }, [
      el('label', { class: 'label is-small', text: 'Selecciona un estadio' }),
      el('div', { class: 'select is-fullwidth' }, [select])
    ]);
    return { field: field, input: select };
  }

  // Navegación dentro del contenedor con scroll propio (la página no se mueve).
  function makeTourNav(sections) {
    function setActive(id) {
      [].forEach.call(sections.querySelectorAll('.stadium-section'), function (sec) {
        sec.classList.toggle('is-active', sec.dataset.id === id);
      });
    }
    function goTo(id) {
      setActive(id);
      var sec = sections.querySelector('[data-id="' + id + '"]');
      if (sec) sections.scrollTo({ top: Math.max(0, sec.offsetTop - 6), behavior: 'smooth' });
    }
    return { setActive: setActive, goTo: goTo };
  }

  // Lista de países con sedes.
  function countryList(stadiums) {
    var countries = [];
    stadiums.forEach(function (s) { var c = s.country_en || 'Otro'; if (countries.indexOf(c) < 0) countries.push(c); });
    return countries.sort();
  }

  // Dibuja los chips de países.
  function drawCountryChips(row, countries, selected, onSelect) {
    row.innerHTML = '';
    row.appendChild(WC.ui.chip('Todos', selected === null, function () { onSelect(null); }));
    countries.forEach(function (c) { row.appendChild(WC.ui.chip(c, selected === c, function () { onSelect(c); })); });
  }

  // Tarjeta de sede en la vista por país.
  function stadiumCountryCard(s, gamesFailed, byStadium) {
    var count = gamesFailed ? '—' : ((byStadium[s.id] || []).length);
    return el('div', { class: 'column is-one-third' }, [
      el('div', { class: 'box accent-bar' }, [
        el('p', { class: 'title is-6 mb-1', text: stadiumTitle(s) }),
        el('p', { class: 'has-text-grey', text: (s.city_en || '') + ' · ' + (s.country_en || '') }),
        el('span', { class: 'tag is-primary is-light mt-2', text: count + ' partidos' })
      ])
    ]);
  }

  // Agrupa los partidos por sede (stadium_id).
  function groupByStadium(gamesRes) {
    var byStadium = {};
    if (gamesRes.ok) U.asArray(gamesRes.data).forEach(function (g) {
      (byStadium[g.stadium_id] = byStadium[g.stadium_id] || []).push(g);
    });
    return byStadium;
  }

  // ---------- Vista ----------
  async function mount(root) {
    var body = el('div', {});
    var sub = WC.ui.subtabs([
      { id: 'recorrido', label: 'Recorrido', icon: 'route' },
      { id: 'pais', label: 'Por país', icon: 'flag' }
    ], function (id) { render(id); });
    root.appendChild(sub.nav);
    root.appendChild(body);

    var stadiumsRes = await WC.api.load('/get/stadiums');
    if (!stadiumsRes.ok) {
      body.appendChild(WC.ui.errorNotice('No se pudieron cargar las sedes.', function () { root.innerHTML = ''; mount(root); }));
      return;
    }
    var stadiums = U.asArray(stadiumsRes.data).slice()
      .sort(function (a, b) { return (a.name_en || '').localeCompare(b.name_en || ''); });

    var gamesRes = await WC.api.load('/get/games');
    var gamesFailed = !gamesRes.ok;
    var byStadium = groupByStadium(gamesRes);
    var stale = stadiumsRes.stale || gamesRes.stale;

    // Renderiza el modo elegido (recorrido o país).
    function render(mode) {
      body.innerHTML = '';
      if (stale) body.appendChild(WC.ui.staleBadge());
      if (mode === 'pais') renderByCountry(); else renderRecorrido();
    }

    // Vista de recorrido con scroll propio.
    function renderRecorrido() {
      var select = stadiumSelectField(stadiums);
      var sections = el('section', { class: 'tour-scroll' });
      body.appendChild(select.field);
      body.appendChild(sections);
      stadiums.forEach(function (s) { sections.appendChild(stadiumCard(s, gamesFailed, byStadium)); });
      var nav = makeTourNav(sections);
      select.input.addEventListener('change', function () { nav.goTo(select.input.value); });
      if (stadiums[0]) { select.input.value = stadiums[0].id; nav.setActive(stadiums[0].id); }
    }

    // Vista de sedes filtradas por país.
    function renderByCountry() {
      var countries = countryList(stadiums), selected = null;
      var btnRow = el('div', { class: 'chips' });
      var grid = el('div', { class: 'columns is-multiline' });
      body.appendChild(btnRow); body.appendChild(grid);
      function update() {
        drawCountryChips(btnRow, countries, selected, function (c) { selected = c; update(); });
        grid.innerHTML = '';
        stadiums.filter(function (s) { return selected === null || (s.country_en || 'Otro') === selected; })
          .forEach(function (s) { grid.appendChild(stadiumCountryCard(s, gamesFailed, byStadium)); });
      }
      update();
    }

    render('recorrido');
  }

  WC.views = WC.views || {};
  WC.views.tour = { mount: mount };
})(window.WC = window.WC || {});
