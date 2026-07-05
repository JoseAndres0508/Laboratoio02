/* ============================================================================
 * util.js  —  Utilidades pequeñas compartidas
 * ----------------------------------------------------------------------------
 * asArray(): la API a veces devuelve el arreglo directo y a veces envuelto en
 * un objeto (p. ej. { data: [...] }). Esta función siempre devuelve el arreglo,
 * sin importar el nombre de la propiedad que lo contenga. Así las vistas nunca
 * truenan con "forEach is not a function".
 * ========================================================================== */
(function (WC) {
  'use strict';

  WC.util = {
    asArray: function (data) {
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') {
        // Devuelve la primera propiedad cuyo valor sea un arreglo
        // (cubre { data:[...] }, { results:[...] }, { games:[...] }, etc.).
        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++) {
          if (Array.isArray(data[keys[i]])) return data[keys[i]];
        }
      }
      return [];
    },

    teamName: function (team, fallbackId) {
      if (!team) return 'Equipo ' + fallbackId;
      return team.name_en || team.name_fa || ('Equipo ' + (team.id || fallbackId));
    },

    indexById: function (list) {
      var map = {};
      (list || []).forEach(function (item) { map[item.id] = item; });
      return map;
    }
  };
})(window.WC = window.WC || {});
