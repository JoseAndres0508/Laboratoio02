/* ============================================================================
 * views/tour.js  —  2.1 Tour Virtual de Sedes
 * ----------------------------------------------------------------------------
 * Técnica de DOM: navegación interna con scrollIntoView({behavior:'smooth'})
 * y estado visual de "sede activa".
 * Endpoints: GET /get/stadiums, GET /get/games.
 *
 * Reto de resiliencia: si /get/games falla, los botones de sedes SIGUEN siendo
 * clicables; cada sección muestra un mensaje local "no se pudieron cargar los
 * partidos de esta sede" sin bloquear la navegación.
 * ========================================================================== */
(function (WC) {
  'use strict';
  var el = WC.ui.el;
  var staleBadge = WC.ui.staleBadge;

  async function mount(root) {
    root.appendChild(el('h1', { class: 'view-title', text: 'Tour Virtual de Sedes' }));

    var layout = el('div', { class: 'tour-layout' });
    var sidebar = el('aside', { class: 'tour-sidebar' });
    var content = el('section', { class: 'tour-content' });
    layout.appendChild(sidebar);
    layout.appendChild(content);
    root.appendChild(layout);

    // 1) Sedes: imprescindibles para dibujar los botones.
    var stadiumsRes = await WC.api.load('/get/stadiums');
    if (!stadiumsRes.ok) {
      sidebar.appendChild(el('div', { class: 'error-box', text: 'No se pudieron cargar las sedes.' }));
      var retryAll = el('button', { class: 'btn', text: 'Reintentar' });
      retryAll.addEventListener('click', function () { root.innerHTML = ''; mount(root); });
      sidebar.appendChild(retryAll);
      return;
    }
    var stadiums = stadiumsRes.data;

    // 2) Partidos: TOLERANTES a fallo. Si fallan, gamesFailed = true.
    var gamesRes = await WC.api.load('/get/games');
    var gamesFailed = !gamesRes.ok;
    var gamesByStadium = {};
    if (!gamesFailed) {
      gamesRes.data.forEach(function (g) {
        (gamesByStadium[g.stadium_id] = gamesByStadium[g.stadium_id] || []).push(g);
      });
    }

    if (stadiumsRes.stale || gamesRes.stale) root.insertBefore(staleBadge(), layout);

    // --- Estado de "sede activa" + control de scroll ---
    var activeId = null;
    var scrolling = false;
    var scrollTimer = null;

    function setActive(id) {
      activeId = id;
      var btns = sidebar.querySelectorAll('.stadium-btn');
      for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.id === id);
      var secs = content.querySelectorAll('.stadium-section');
      for (var j = 0; j < secs.length; j++) secs[j].classList.toggle('active', secs[j].dataset.id === id);
    }

    function goTo(id) {
      // Defensa (clics repetidos durante la animación): si ya estamos yendo a la
      // misma sede, ignoramos el clic. Para otra sede, scrollIntoView re-apunta
      // sin abrir dos animaciones en conflicto.
      if (id === activeId && scrolling) return;
      setActive(id);
      var section = content.querySelector('[data-id="' + id + '"]');
      scrolling = true;
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () { scrolling = false; }, 700);
    }

    // --- Render de sidebar (botones) + secciones (partidos) ---
    stadiums.forEach(function (s) {
      var btn = el('button', { class: 'stadium-btn', dataset: { id: s.id } }, [
        el('strong', { text: s.name_en }),
        el('span', { class: 'muted', text: (s.city_en || '') + ' · ' + (s.country_en || '') })
      ]);
      btn.addEventListener('click', function () { goTo(s.id); });
      sidebar.appendChild(btn);

      var section = el('article', { class: 'stadium-section', dataset: { id: s.id } }, [
        el('h2', { text: s.name_en }),
        el('p', { class: 'muted', text: 'Capacidad: ' + (s.capacity || '—') })
      ]);
      var list = el('div', { class: 'match-list' });

      if (gamesFailed) {
        // Mensaje LOCAL: no bloquea la navegación a otras sedes.
        list.appendChild(el('div', { class: 'error-inline',
          text: 'No se pudieron cargar los partidos de esta sede.' }));
      } else {
        var matches = gamesByStadium[s.id] || [];
        if (matches.length === 0) {
          list.appendChild(el('p', { class: 'muted', text: 'Sin partidos asignados.' }));
        } else {
          matches.forEach(function (g) { list.appendChild(matchRow(g)); });
        }
      }
      section.appendChild(list);
      content.appendChild(section);
    });

    if (stadiums[0]) setActive(stadiums[0].id);
  }

  function matchRow(g) {
    var score = g.finished ? (g.home_score + ' - ' + g.away_score) : 'Por jugar';
    return WC.ui.el('div', { class: 'match-row' }, [
      WC.ui.el('span', { text: 'Grupo ' + g.group + ' · Jornada ' + g.matchday }),
      WC.ui.el('span', { class: 'muted', text: g.local_date + ' · ' + score })
    ]);
  }

  WC.views = WC.views || {};
  WC.views.tour = { mount: mount };
})(window.WC = window.WC || {});
