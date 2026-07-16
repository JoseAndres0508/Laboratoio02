/* ============================================================================
 * colors.js  —  Color reactivo del Dashboard según la bandera del equipo.
 * Extrae el color dominante de la bandera y deriva versiones legibles para
 * el fondo, los acentos y las LETRAS (globales) según el tema claro/oscuro.
 * ========================================================================== */
(function (WC) {
  'use strict';
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h, s, l = (mx + mn) / 2;
    if (mx === mn) { h = s = 0; }
    else {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    var to = function (v) { return ('0' + Math.round((v + m) * 255).toString(16)).slice(-2); };
    return '#' + to(r) + to(g) + to(b);
  }
  function hexToRgb(hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hslOf(hex) { var r = hexToRgb(hex); return rgbToHsl(r[0], r[1], r[2]); }

  // Derivados legibles según el tema
  function textFor(hex, theme) { var c = hslOf(hex); return theme === 'light' ? hslToHex(c[0], clamp(c[1], 35, 70), 30) : hslToHex(c[0], clamp(c[1], 30, 60), 76); }
  function accentFor(hex, theme) { var c = hslOf(hex); return theme === 'light' ? hslToHex(c[0], clamp(c[1], 55, 90), 45) : hslToHex(c[0], clamp(c[1], 55, 90), 62); }
  function tintFor(hex, theme) { var c = hslOf(hex); return theme === 'light' ? hslToHex(c[0], clamp(c[1], 40, 70), 94) : hslToHex(c[0], clamp(c[1], 22, 45), 15); }
  function innerFor(hex, theme) { var c = hslOf(hex); return theme === 'light' ? '#ffffff' : hslToHex(c[0], clamp(c[1], 18, 40), 11); }
  function fallbackHex(id) { var h = (parseInt(id, 10) * 137.508) % 360; return hslToHex(h, 65, 50); }

  // Dibuja la bandera 24x24 en un canvas y devuelve sus píxeles (RGBA).
  function readFlagPixels(img) {
    var c = document.createElement('canvas'); var w = c.width = 24, h = c.height = 24;
    var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  }

  // Agrupa los píxeles en "buckets" de color, saltando transparencias y blancos.
  function accumulateBuckets(data) {
    var buckets = {};
    for (var i = 0; i < data.length; i += 4) {
      var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]; if (a < 128) continue;
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn;
      if (mx > 238 && sat < 18) continue; // salta blancos
      var k = (r >> 5) + '-' + (g >> 5) + '-' + (b >> 5);
      buckets[k] = buckets[k] || { n: 0, r: 0, g: 0, b: 0 };
      buckets[k].n++; buckets[k].r += r; buckets[k].g += g; buckets[k].b += b;
    }
    return buckets;
  }

  // Elige el bucket dominante (más frecuente y saturado) y lo pasa a HEX.
  function dominantColor(buckets) {
    var best = null;
    Object.keys(buckets).forEach(function (k) {
      var o = buckets[k], r = o.r / o.n, g = o.g / o.n, b = o.b / o.n, mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn;
      var score = o.n * (sat + 25);
      if (!best || score > best.score) best = { score: score, r: r, g: g, b: b };
    });
    if (!best) return null;
    return '#' + [best.r, best.g, best.b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('');
  }

  // Color dominante de la bandera (o null si la imagen no se puede leer)
  function extractFlag(url, cb) {
    if (!url) { cb(null); return; }
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try { cb(dominantColor(accumulateBuckets(readFlagPixels(img)))); }
      catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = url;
  }

  WC.colors = { textFor: textFor, accentFor: accentFor, tintFor: tintFor, innerFor: innerFor, fallbackHex: fallbackHex, extractFlag: extractFlag };

  // Aplica el color de las LETRAS a toda la app (según el tema).
  WC.applyFavTextColor = function (dominantHex) {
    var theme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (dominantHex) document.documentElement.style.setProperty('--text', textFor(dominantHex, theme));
    else document.documentElement.style.removeProperty('--text');
  };
})(window.WC = window.WC || {});