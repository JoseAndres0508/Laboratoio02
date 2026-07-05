/* ============================================================================
 * views/tour.js  —  2.1 Tour Virtual de Sedes  (Bulma + sub-opciones)
 * Técnica requerida: scrollIntoView + estado de "sede activa".
 * Sub-opciones: "Recorrido" (scroll) y "Por país" (agrupado).
 * Resiliencia: si /get/games falla, los botones siguen clicables y cada
 * sección muestra su aviso local sin bloquear la navegación.
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
    var stadiums = U.asArray(stadiumsRes.data);

    var gamesRes = await WC.api.load('/get/games');
    var gamesFailed = !gamesRes.ok;
    var byStadium = {};
    if (!gamesFailed) {
      U.asArray(gamesRes.data).forEach(function (g) {
        (byStadium[g.stadium_id] = byStadium[g.stadium_id] || []).push(g);
      });
    }
    var stale = stadiumsRes.stale || gamesRes.stale;

    function render(mode) {
      body.innerHTML = '';
      if (stale) body.appendChild(WC.ui.staleBadge());
      if (mode === 'pais') renderByCountry(); else renderTour();
    }

    // --- Recorrido con scrollIntoView ---
    function renderTour() {
      var activeId = null, scrolling = false, timer = null;
      var columns = el('div', { class: 'columns' });
      var side = el('aside', { class: 'column is-one-third tour-sidebar' });
      var content = el('section', { class: 'column' });
      columns.appendChild(side); columns.appendChild(content);
      body.appendChild(columns);

      function setActive(id) {
        activeId = id;
        [].forEach.call(side.querySelectorAll('.stadium-btn'), function (b) { b.classList.toggle('is-active', b.dataset.id === id); });
        [].forEach.call(content.querySelectorAll('.stadium-section'), function (s) { s.classList.toggle('is-active', s.dataset.id === id); });
      }
      function goTo(id) {
        if (id === activeId && scrolling) return; // ignora clics repetidos durante la animación
        setActive(id);
        var sec = content.querySelector('[data-id="' + id + '"]');
        scrolling = true;
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        clearTimeout(timer); timer = setTimeout(function () { scrolling = false; }, 700);
      }

      stadiums.forEach(function (s) {
        var btn = el('button', { class: 'button is-dark stadium-btn is-justify-content-flex-start', dataset: { id: s.id } }, [
          el('span', {}, [
            el('strong', { text: s.name_en || ('Sede ' + s.id) }),
            el('br'),
            el('small', { class: 'has-text-grey', text: (s.city_en || '') + ' · ' + (s.country_en || '') })
          ])
        ]);
        btn.style.height = 'auto';
        btn.addEventListener('click', function () { goTo(s.id); });
        side.appendChild(btn);

        var card = el('div', { class: 'box stadium-section', dataset: { id: s.id } }, [
          el('h2', { class: 'title is-5 mb-1', text: s.name_en || ('Sede ' + s.id) }),
          el('p', { class: 'subtitle is-6 has-text-grey', text: (s.city_en || '') + ' · ' + (s.country_en || '') + ' · Cap. ' + (s.capacity || '—') })
        ]);
        var list = el('div', {});
        if (gamesFailed) {
          list.appendChild(el('p', { class: 'has-text-danger', text: 'No se pudieron cargar los partidos de esta sede.' }));
        } else {
          var matches = byStadium[s.id] || [];
          if (!matches.length) list.appendChild(el('p', { class: 'has-text-grey', text: 'Sin partidos asignados.' }));
          matches.forEach(function (g) { list.appendChild(matchTag(g)); });
        }
        card.appendChild(list);
        content.appendChild(card);
      });
      if (stadiums[0]) setActive(stadiums[0].id);
    }

    // --- Por país ---
    function renderByCountry() {
      var byCountry = {};
      stadiums.forEach(function (s) { (byCountry[s.country_en || 'Otro'] = byCountry[s.country_en || 'Otro'] || []).push(s); });
      Object.keys(byCountry).sort().forEach(function (country) {
        body.appendChild(el('h2', { class: 'title is-5 mt-4', text: country }));
        var cols = el('div', { class: 'columns is-multiline' });
        byCountry[country].forEach(function (s) {
          var count = gamesFailed ? '—' : ((byStadium[s.id] || []).length);
          cols.appendChild(el('div', { class: 'column is-one-third' }, [
            el('div', { class: 'box accent-bar' }, [
              el('p', { class: 'title is-6 mb-1', text: s.name_en || ('Sede ' + s.id) }),
              el('p', { class: 'has-text-grey', text: (s.city_en || '') }),
              el('span', { class: 'tag is-primary is-light mt-2', text: count + ' partidos' })
            ])
          ]));
        });
        body.appendChild(cols);
      });
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
