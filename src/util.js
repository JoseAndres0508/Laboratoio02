/* ============================================================================
 * util.js  —  Utilidades pequeñas compartidas
 * ========================================================================== */
(function (WC) {
  'use strict';

  WC.util = {
    // Normaliza la respuesta a un arreglo.
    asArray: function (data) {
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') {
        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++) if (Array.isArray(data[keys[i]])) return data[keys[i]];
      }
      return [];
    },

    // La API manda finished como texto "TRUE"/"FALSE" (o a veces booleano).
    isFinished: function (g) {
      var f = g && g.finished;
      return f === true || String(f).toUpperCase() === 'TRUE';
    },

    // Devuelve el nombre legible del equipo.
    teamName: function (team, fallbackId) {
      if (!team) return 'Equipo ' + fallbackId;
      return team.name_en || team.name_fa || ('Equipo ' + (team.id || fallbackId));
    },

    // Indexa una lista por su id.
    indexById: function (list) {
      var map = {};
      (list || []).forEach(function (item) { map[item.id] = item; });
      return map;
    }
  };
})(window.WC = window.WC || {});
