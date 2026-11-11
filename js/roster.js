/*
 * Meow Zombie Hunter — practice board roster
 *
 * A survival board with one line on it reads as a broken game, so the board
 * ships with a roster of cat callsigns and deterministic records. The same
 * module feeds the browser's offline fallback and the Node server's seed, so
 * both boards agree without a database.
 *
 * Loaded by a script tag in the browser (window.ZH.ROSTER) and required by
 * server/index.js, hence the tiny UMD wrapper.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.ZH = root.ZH || {};
    root.ZH.ROSTER = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var NAMES = [
    'WHISKERS', 'MITTENS', 'GINGER', 'TOFU', 'MOCHI',
    'NOODLE', 'BISCUIT', 'PICKLE', 'TABBY', 'SALEM',
    'LUNA', 'SOBA', 'PANCAKE', 'WAFFLES', 'BEANS',
    'PEBBLES', 'CINDER', 'SMOKEY', 'TIGER', 'PUMPKIN',
    'PEPPER', 'CLOVER', 'HAZEL', 'JUNIPER', 'MARMALADE',
    'NOUGAT', 'OREO', 'PUDDING', 'RAMEN', 'SUSHI',
    'TEMPURA', 'UDON', 'VELVET', 'WILLOW', 'ZUZU',
    'BOBA', 'CHAI', 'COCOA', 'DONUT', 'ECLAIR',
    'FIG', 'GRAVY', 'HONEY', 'ICING', 'JELLY',
    'KIWI', 'LEMON', 'MANGO', 'NECTARINE', 'OLIVE',
    'PEACH', 'QUINCE', 'RAISIN', 'SYRUP', 'TANGERINE',
    'UMBRA', 'VANILLA', 'WALNUT', 'YAM', 'ZEST'
  ];

  /* FNV-1a: small, fast and stable across browsers and Node versions */
  function hash(str) {
    var h = 2166136261;
    var s = String(str);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul ? Math.imul(h, 16777619) : (h * 16777619);
    }
    return h >>> 0;
  }

  /* One record per callsign, derived from the name so a reload never shuffles
     the board. Campaign rows stay under 20 (one cleared stage per wave); the
     endless ladder climbs higher, with a real gap between neighbours. */
  function ghosts(mode) {
    var campaign = mode === 'campaign';
    var span = campaign ? 17 : 34;
    var rows = NAMES.map(function (name) {
      var h = hash(name + (campaign ? ':campaign' : ':endless'));
      var wave = 2 + (h % span);
      var kills = wave * (24 + (h % 31));
      var score = kills * 10 + wave * 500 + (h % 900);
      return {
        name: name,
        mode: campaign ? 'campaign' : 'endless',
        wave: wave,
        kills: kills,
        score: score,
        ts: 0,
        ghost: true
      };
    });
    rows.sort(function (a, b) {
      if (b.wave !== a.wave) return b.wave - a.wave;
      if (b.score !== a.score) return b.score - a.score;
      return (b.kills || 0) - (a.kills || 0);
    });
    return rows;
  }

  return { NAMES: NAMES, ghosts: ghosts, hash: hash };
});
