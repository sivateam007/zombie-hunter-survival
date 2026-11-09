/* ---------------------------------------------------------------
 * Meow Zombie Hunter — arena art
 *
 * A large open-world city built from a grid of city blocks and
 * streets. The base surface + decorations are pre-baked into screen
 * tiles the size of `CHUNK`, so only the tiles on screen exist in
 * memory and never the full map.
 */
window.ZH = window.ZH || {};
(function (ZH) {
  'use strict';
  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* colour helper (mirror of rig.js shade so arena props can shade hex) */
  var _shadeCache = {};
  function hexToRgb(hex) {
    var v = parseInt(String(hex).slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function shade(hex, amount) {
    if (!amount) return hex;
    var key = hex + '|' + amount.toFixed(2);
    if (_shadeCache[key]) return _shadeCache[key];
    var c = hexToRgb(hex);
    var t = amount > 0 ? 255 : 0;
    var a = Math.abs(amount);
    var out = 'rgb(' + Math.round(lerp(c[0], t, a)) + ',' +
      Math.round(lerp(c[1], t, a)) + ',' +
      Math.round(lerp(c[2], t, a)) + ')';
    _shadeCache[key] = out;
    return out;
  }

  /* deterministic RNG (same seed -> same world every run) */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function rr(rnd, a, b) { return a + rnd() * (b - a); }
  function hash(seed, a, b) {
    var h = (seed ^ ((a | 0) * 374761393) ^ ((b | 0) * 668265263)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  var THEMES = {
    street:  { name: 'Ashfall Streets',     base: '#2b2c2e', fog: 'rgba(38,44,50,0.55)', ambient: 'ash',   lamp: '#ffd9a0' },
    factory: { name: 'Rust Meat Plant',     base: '#33302b', fog: 'rgba(56,42,28,0.5)',  ambient: 'dust',  lamp: '#ffc978' },
    hospital:{ name: 'Mercy Hospital',      base: '#33393a', fog: 'rgba(40,60,58,0.5)',  ambient: 'dust',  lamp: '#cfefff' },
    downtown:{ name: 'Neon Downtown',       base: '#242830', fog: 'rgba(28,38,54,0.55)', ambient: 'dust',  lamp: '#bfe3ff' },
    docks:   { name: 'Harbour Docks',       base: '#2a2e30', fog: 'rgba(30,44,50,0.55)', ambient: 'ash',   lamp: '#ffd9a0' },
    suburb:  { name: 'Palm Grove',          base: '#2f3a30', fog: 'rgba(34,48,40,0.45)', ambient: 'dust',  lamp: '#ffe0a8' },
    airport: { name: 'Greyfield Airstrip',  base: '#2c2f33', fog: 'rgba(36,42,50,0.5)',  ambient: 'dust',  lamp: '#d7ecff' },
    rooftop: { name: 'Rooftop Last Stand',  base: '#22262e', fog: 'rgba(24,32,48,0.62)', ambient: 'rain',  lamp: '#9ec8ff' },
    mall:    { name: 'Galleria Plaza',      base: '#343038', fog: 'rgba(44,38,52,0.52)', ambient: 'dust',  lamp: '#ffd0f0' },
    subway:  { name: 'Metro Interchange',   base: '#2c3036', fog: 'rgba(34,40,48,0.58)', ambient: 'ash',   lamp: '#c8fff0' },
    warehouse:{name: 'Freight Yards',       base: '#312f2a', fog: 'rgba(48,42,34,0.52)', ambient: 'dust',  lamp: '#ffd080' },
    park:    { name: 'Overgrown Park',      base: '#283428', fog: 'rgba(30,42,34,0.48)', ambient: 'ash',   lamp: '#e8ffb0' },
    canal:   { name: 'Canal Quarter',       base: '#263034', fog: 'rgba(30,46,52,0.55)', ambient: 'rain',  lamp: '#b8e8ff' },
    arcade:  { name: 'Neon Arcade',         base: '#302a3a', fog: 'rgba(48,32,58,0.52)', ambient: 'dust',  lamp: '#ff9ad5' },
    foundry: { name: 'Iron Foundry',        base: '#362b22', fog: 'rgba(62,38,22,0.55)', ambient: 'ash',   lamp: '#ffb070' },
    cathedral:{name: 'Old Cathedral',       base: '#2e2b36', fog: 'rgba(42,38,56,0.55)', ambient: 'dust',  lamp: '#dcd0ff' },
    skyline: { name: 'Skyline Heights',     base: '#232838', fog: 'rgba(26,34,52,0.58)', ambient: 'rain',  lamp: '#9ec8ff' },
    greenhouse:{name:'Glass Gardens',       base: '#293528', fog: 'rgba(32,48,36,0.5)',  ambient: 'dust',  lamp: '#c8ffb0' },
    boneyard:{ name: 'The Boneyard',        base: '#2f2c27', fog: 'rgba(48,42,32,0.55)', ambient: 'ash',   lamp: '#ffe9c0' },
    overpass:{ name: 'Skyway Bridges',      base: '#232f38', fog: 'rgba(28,44,56,0.55)', ambient: 'rain',  lamp: '#b8e8ff' },
    snowfield:{name: 'Frozen Fields',       base: '#31383c', fog: 'rgba(58,70,80,0.45)', ambient: 'ash',   lamp: '#e6f4ff' },
    quarry:  { name: 'Old Quarry',          base: '#33322f', fog: 'rgba(52,48,42,0.55)', ambient: 'dust',  lamp: '#ffd9a0' },
    junkyard:{ name: 'Rust Junkyard',       base: '#312b26', fog: 'rgba(54,40,30,0.55)', ambient: 'ash',   lamp: '#ffc978' },
    boardwalk:{name: 'Sunset Boardwalk',    base: '#2d3038', fog: 'rgba(48,40,50,0.5)',  ambient: 'dust',  lamp: '#ffb0a0' },
    observatory:{name:'Hill Observatory',   base: '#282c3a', fog: 'rgba(34,40,60,0.58)', ambient: 'rain',  lamp: '#cfd8ff' }
  };

  /* Districts that can border one another. A mall may flow into downtown or
     a metro station, never into a street with parked cars, so walking out of
     a district changes the scenery without breaking it. */
  var NEIGHBORS = {
    street: ['downtown', 'suburb', 'docks', 'boneyard', 'quarry'],
    factory: ['warehouse', 'docks', 'street', 'foundry', 'junkyard'],
    hospital: ['downtown', 'subway', 'mall', 'cathedral'],
    downtown: ['street', 'mall', 'subway', 'rooftop', 'skyline', 'arcade'],
    docks: ['warehouse', 'canal', 'street', 'boneyard', 'boardwalk'],
    suburb: ['park', 'street', 'canal', 'greenhouse', 'snowfield'],
    airport: ['warehouse', 'downtown', 'street', 'snowfield'],
    rooftop: ['downtown', 'hospital', 'skyline', 'observatory'],
    mall: ['downtown', 'subway', 'hospital', 'arcade'],
    subway: ['downtown', 'mall', 'hospital', 'cathedral'],
    warehouse: ['factory', 'docks', 'airport', 'foundry', 'junkyard'],
    park: ['suburb', 'canal', 'greenhouse'],
    canal: ['docks', 'park', 'suburb', 'greenhouse', 'overpass'],
    arcade: ['mall', 'downtown', 'subway'],
    foundry: ['factory', 'warehouse', 'docks'],
    cathedral: ['hospital', 'subway', 'downtown'],
    skyline: ['downtown', 'rooftop', 'mall'],
    greenhouse: ['park', 'suburb', 'canal'],
    boneyard: ['docks', 'warehouse', 'street', 'junkyard'],
    overpass: ['canal', 'docks', 'skyline'],
    snowfield: ['suburb', 'airport', 'quarry'],
    quarry: ['street', 'snowfield', 'junkyard'],
    junkyard: ['factory', 'warehouse', 'quarry', 'boneyard'],
    boardwalk: ['docks', 'canal', 'mall'],
    observatory: ['rooftop', 'skyline', 'cathedral']
  };

  /* world dimensions + tile constants */
  var OPEN = 1e9;            /* the city never ends: chunks generate on demand */
  var CHUNK = 512;           /* render tile */
  var CELL = 1024;           /* block pitch */
  var CELL_HALF = CELL / 2;
  var ROAD_HALF = 96;       /* street width / 2 */
  var DISTRICT = 4;         /* chunks per district (2048 px) */

  /* ------- base surfaces (world-aligned, no global stripe) ---------- */
  function streetBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#3b3f45'; ctx.fillRect(ox, oy, w, h);
    for (var i = 0; i < 42; i++) {
      var x = ox + rr(rnd, 0, w), y = oy + rr(rnd, 0, h);
      var rw = rr(rnd, 60, 300), rh = rr(rnd, 40, 170);
      ctx.fillStyle = 'rgba(' + Math.round(rr(rnd, 34, 66)) + ',' +
        Math.round(rr(rnd, 34, 64)) + ',' + Math.round(rr(rnd, 36, 68)) + ',' + rr(rnd, 0.04, 0.1) + ')';
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rh, rr(rnd, 0, TAU), 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(14,15,17,0.55)';
    for (var c = 0; c < 36; c++) {
      var cx = ox + rr(rnd, 0, w), cy = oy + rr(rnd, 0, h);
      ctx.lineWidth = rr(rnd, 0.7, 2.1); ctx.beginPath(); ctx.moveTo(cx, cy);
      var a = rr(rnd, 0, TAU);
      for (var k = 0; k < 5; k++) { a += rr(rnd, -0.7, 0.7); cx += Math.cos(a) * rr(rnd, 10, 44); cy += Math.sin(a) * rr(rnd, 10, 44); ctx.lineTo(cx, cy); }
      ctx.stroke();
    }
    for (var m = 0; m < 4; m++) {
      var mx = ox + rr(rnd, 200, w - 200), my = oy + rr(rnd, 200, h - 200);
      ctx.fillStyle = '#1e1f21'; ctx.beginPath(); ctx.arc(mx, my, 22, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,120,124,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 17, 0, TAU); ctx.stroke();
    }
  }

  function concreteBase(ctx, w, h, ox, oy, rnd) {
    var tile = 128;
    ctx.fillStyle = '#3a3730'; ctx.fillRect(ox, oy, w, h);
    for (var y = (oy / tile | 0) * tile; y < oy + h; y += tile) {
      for (var x = (ox / tile | 0) * tile; x < ox + w; x += tile) {
        var v = rr(rnd, -14, 12);
        ctx.fillStyle = 'rgb(' + (58 + v) + ',' + (54 + v) + ',' + (46 + v) + ')';
        ctx.fillRect(x, y, tile - 2, tile - 2);
      }
    }
    ctx.strokeStyle = 'rgba(20,18,15,0.55)'; ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, w, h);
    for (var gx = (ox / tile | 0) * tile; gx < ox + w; gx += tile) {
      ctx.beginPath(); ctx.moveTo(gx, oy); ctx.lineTo(gx, oy + h); ctx.stroke();
    }
    for (var gy = (oy / tile | 0) * tile; gy < oy + h; gy += tile) {
      ctx.beginPath(); ctx.moveTo(ox, gy); ctx.lineTo(ox + w, gy); ctx.stroke();
    }
    for (var i = 0; i < 30; i++) {
      var sx = ox + rr(rnd, 0, w), sy = oy + rr(rnd, 0, h), srx = rr(rnd, 14, 62);
      ctx.fillStyle = rnd() > 0.55 ? 'rgba(18,16,14,0.2)' : 'rgba(94,50,26,0.14)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, srx, srx * rr(rnd, 0.4, 0.9), rr(rnd, 0, TAU), 0, TAU); ctx.fill();
    }
    for (var d = 0; d < 5; d++) {
      var dx = ox + rr(rnd, 120, w - 120), dy = oy + rr(rnd, 120, h - 120);
      ctx.fillStyle = '#1a1917'; ctx.fillRect(dx, dy, 46, 30);
      ctx.strokeStyle = 'rgba(150,150,150,0.28)'; ctx.lineWidth = 1.5;
      for (var b = 0; b < 4; b++) {
        ctx.beginPath(); ctx.moveTo(dx + 6, dy + 6 + b * 6); ctx.lineTo(dx + 40, dy + 6 + b * 6); ctx.stroke();
      }
    }
  }

  function hospitalBase(ctx, w, h, ox, oy, rnd) {
    var tile = 96;
    ctx.fillStyle = '#40484a'; ctx.fillRect(ox, oy, w, h);
    for (var y = (oy / tile | 0) * tile; y < oy + h; y += tile) {
      for (var x = (ox / tile | 0) * tile; x < ox + w; x += tile) {
        var v = rr(rnd, -10, 12);
        ctx.fillStyle = 'rgb(' + (72 + v) + ',' + (84 + v) + ',' + (86 + v) + ')';
        ctx.fillRect(x + 1, y + 1, tile - 3, tile - 3);
        ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x + 6, y + 6, tile - 14, 4);
      }
    }
    ctx.strokeStyle = 'rgba(18,22,22,0.35)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(ox, oy, w, h);
    for (var gx = (ox / tile | 0) * tile; gx < ox + w; gx += tile) {
      ctx.beginPath(); ctx.moveTo(gx, oy); ctx.lineTo(gx, oy + h); ctx.stroke();
    }
    for (var gy = (oy / tile | 0) * tile; gy < oy + h; gy += tile) {
      ctx.beginPath(); ctx.moveTo(ox, gy); ctx.lineTo(ox + w, gy); ctx.stroke();
    }
    for (var i = 0; i < 22; i++) {
      var sx = ox + rr(rnd, 0, w), sy = oy + rr(rnd, 0, h), ang = rr(rnd, 0, TAU), len = rr(rnd, 40, 260);
      var grd = ctx.createLinearGradient(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      grd.addColorStop(0, 'rgba(96,20,16,0.5)'); grd.addColorStop(1, 'rgba(96,20,16,0)');
      ctx.strokeStyle = grd; ctx.lineWidth = rr(rnd, 6, 24);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len); ctx.stroke();
    }
    for (var p = 0; p < 34; p++) {
      ctx.save();
      ctx.translate(ox + rr(rnd, 0, w), oy + rr(rnd, 0, h)); ctx.rotate(rr(rnd, 0, TAU));
      ctx.fillStyle = 'rgba(215,214,200,' + rr(rnd, 0.1, 0.3) + ')'; ctx.fillRect(-5, -7, 10, 14);
      ctx.restore();
    }
  }

  function roofBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#23262b'; ctx.fillRect(ox, oy, w, h);
    for (var i = 0; i < 2600; i++) {
      var v = rr(rnd, 26, 62);
      ctx.fillStyle = 'rgba(' + Math.round(v) + ',' + Math.round(v + 2) + ',' + Math.round(v + 6) + ',' + rr(rnd, 0.2, 0.7) + ')';
      ctx.fillRect(ox + rr(rnd, 0, w), oy + rr(rnd, 0, h), rr(rnd, 1, 3), rr(rnd, 1, 3));
    }
    ctx.strokeStyle = 'rgba(12,14,17,0.6)';
    for (var s = 0; s < 12; s++) {
      ctx.lineWidth = rr(rnd, 2, 6); ctx.beginPath();
      var x = ox + rr(rnd, 0, w), y = oy + rr(rnd, 0, h); ctx.moveTo(x, y);
      for (var k = 0; k < 6; k++) { x += rr(rnd, -220, 220); y += rr(rnd, -80, 140); ctx.lineTo(x, y); }
      ctx.stroke();
    }
    for (var p = 0; p < 7; p++) {
      var px = ox + rr(rnd, 100, w - 100), py = oy + rr(rnd, 100, h - 100), pr = rr(rnd, 40, 110);
      ctx.fillStyle = 'rgba(30,44,66,0.55)'; ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * rr(rnd, 0.45, 0.8), rr(rnd, 0, TAU), 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(140,190,235,0.16)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px, py - 4, pr * 0.7, pr * 0.3, 0.3, 0, TAU); ctx.stroke();
    }
  }

  function downtownBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#242830'; ctx.fillRect(ox, oy, w, h);
    var tile = 128;
    for (var y = (oy / tile | 0) * tile; y < oy + h; y += tile) {
      for (var x = (ox / tile | 0) * tile; x < ox + w; x += tile) {
        var v = rr(rnd, -8, 10);
        ctx.fillStyle = 'rgb(' + (42 + v) + ',' + (48 + v) + ',' + (56 + v) + ')';
        ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        ctx.fillStyle = 'rgba(150,200,255,0.035)';
        ctx.fillRect(x + 10, y + 10, tile - 20, 5);
      }
    }
    ctx.strokeStyle = 'rgba(10,14,18,0.45)'; ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, w, h);
    /* glass-tower reflections sliding across the plaza */
    for (var i = 0; i < 24; i++) {
      var rx = ox + rr(rnd, 0, w), ry = oy + rr(rnd, 0, h), len = rr(rnd, 50, 180);
      var g = ctx.createLinearGradient(rx, ry, rx + len, ry + len * 0.35);
      g.addColorStop(0, 'rgba(120,190,255,0.10)');
      g.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = rr(rnd, 6, 16);
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + len, ry + len * 0.35); ctx.stroke();
    }
    /* neon shop signs, the district's signature */
    for (var n = 0; n < 7; n++) {
      var nx = ox + rr(rnd, 40, w - 40), ny = oy + rr(rnd, 40, h - 40);
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,110,180,0.16)' : 'rgba(120,220,255,0.16)';
      ctx.fillRect(nx, ny, rr(rnd, 26, 70), 12);
    }
  }

  function docksBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#2a2e30'; ctx.fillRect(ox, oy, w, h);
    for (var i = 0; i < 900; i++) {
      var v = rr(rnd, 30, 58);
      ctx.fillStyle = 'rgba(' + Math.round(v) + ',' + Math.round(v + 2) + ',' + Math.round(v + 2) + ',' + rr(rnd, 0.2, 0.6) + ')';
      ctx.fillRect(ox + rr(rnd, 0, w), oy + rr(rnd, 0, h), rr(rnd, 1, 3), rr(rnd, 1, 3));
    }
    /* standing water and oil, the harbour never drains */
    for (var p = 0; p < 12; p++) {
      var px = ox + rr(rnd, 0, w), py = oy + rr(rnd, 0, h), pr = rr(rnd, 40, 120);
      ctx.fillStyle = 'rgba(30,60,74,0.35)';
      ctx.beginPath(); ctx.ellipse(px, py, pr, pr * rr(rnd, 0.3, 0.7), rr(rnd, 0, TAU), 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(150,210,235,0.14)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px, py + 4, pr * 0.6, pr * 0.22, 0.2, 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(210,200,120,0.22)'; ctx.lineWidth = 5;
    for (var y2 = (oy / 220 | 0) * 220; y2 < oy + h; y2 += 220) {
      ctx.setLineDash([40, 34]);
      ctx.beginPath(); ctx.moveTo(ox, y2); ctx.lineTo(ox + w, y2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function suburbBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#2f3a30'; ctx.fillRect(ox, oy, w, h);
    var tile = 96;
    for (var y = (oy / tile | 0) * tile; y < oy + h; y += tile) {
      for (var x = (ox / tile | 0) * tile; x < ox + w; x += tile) {
        var v = rr(rnd, -10, 12);
        ctx.fillStyle = 'rgb(' + (48 + v) + ',' + (62 + v) + ',' + (46 + v) + ')';
        ctx.fillRect(x + 1, y + 1, tile - 3, tile - 3);
      }
    }
    /* driveways and their kerbs */
    for (var d = 0; d < 8; d++) {
      var dx = ox + rr(rnd, 20, w - 150), dy = oy + rr(rnd, 20, h - 100);
      ctx.fillStyle = 'rgba(96,94,88,0.45)';
      ctx.fillRect(dx, dy, 90, 52);
      ctx.strokeStyle = 'rgba(30,30,28,0.4)'; ctx.lineWidth = 2;
      ctx.strokeRect(dx, dy, 90, 52);
    }
    for (var g2 = 0; g2 < 22; g2++) {
      ctx.fillStyle = 'rgba(40,80,44,0.4)';
      ctx.beginPath();
      ctx.ellipse(ox + rr(rnd, 0, w), oy + rr(rnd, 0, h), rr(rnd, 8, 26), rr(rnd, 5, 14), rr(rnd, 0, TAU), 0, TAU);
      ctx.fill();
    }
  }

  function airportBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#2c2f33'; ctx.fillRect(ox, oy, w, h);
    var tile = 160;
    for (var y = (oy / tile | 0) * tile; y < oy + h; y += tile) {
      for (var x = (ox / tile | 0) * tile; x < ox + w; x += tile) {
        var v = rr(rnd, -6, 8);
        ctx.fillStyle = 'rgb(' + (52 + v) + ',' + (55 + v) + ',' + (60 + v) + ')';
        ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        ctx.strokeStyle = 'rgba(24,26,30,0.5)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
      }
    }
    ctx.strokeStyle = 'rgba(235,238,240,0.32)'; ctx.lineWidth = 4;
    for (var c = (ox / 300 | 0) * 300; c < ox + w; c += 300) {
      ctx.setLineDash([46, 40]);
      ctx.beginPath(); ctx.moveTo(c, oy); ctx.lineTo(c, oy + h); ctx.stroke();
      ctx.setLineDash([]);
    }
    for (var i = 0; i < 12; i++) {
      ctx.fillStyle = 'rgba(200,190,90,0.22)';
      ctx.fillRect(ox + rr(rnd, 0, w), oy + rr(rnd, 0, h), rr(rnd, 10, 26), 4);
    }
  }

  function mallBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#343038'; ctx.fillRect(ox, oy, w, h);
    var tile = 96;
    for (var y = (oy / tile | 0) * tile; y < oy + h; y += tile) {
      for (var x = (ox / tile | 0) * tile; x < ox + w; x += tile) {
        var alt = (((x / tile | 0) + (y / tile | 0)) & 1);
        var v = rr(rnd, -8, 10);
        var r = (alt ? 62 : 54) + v, g = (alt ? 56 : 52) + v, b = (alt ? 72 : 64) + v;
        ctx.fillStyle = 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
        ctx.fillRect(x, y, tile - 1, tile - 1);
      }
    }
    ctx.strokeStyle = 'rgba(18,16,22,0.35)'; ctx.lineWidth = 1;
    for (var gx = (ox / tile | 0) * tile; gx < ox + w; gx += tile) { ctx.beginPath(); ctx.moveTo(gx, oy); ctx.lineTo(gx, oy + h); ctx.stroke(); }
    for (var gy = (oy / tile | 0) * tile; gy < oy + h; gy += tile) { ctx.beginPath(); ctx.moveTo(ox, gy); ctx.lineTo(ox + w, gy); ctx.stroke(); }
    for (var n = 0; n < 10; n++) {
      var nx = ox + rr(rnd, 20, w - 80), ny = oy + rr(rnd, 20, h - 30);
      var cols = ['rgba(255,120,200,0.18)', 'rgba(120,220,255,0.16)', 'rgba(255,220,120,0.14)'];
      ctx.fillStyle = cols[(rnd() * 3) | 0];
      ctx.fillRect(nx, ny, rr(rnd, 30, 90), 10);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(nx, ny, rr(rnd, 30, 90), 2);
    }
    for (var p = 0; p < 6; p++) {
      var px = ox + rr(rnd, 60, w - 60), py = oy + rr(rnd, 60, h - 60);
      var g2 = ctx.createRadialGradient(px, py, 4, px, py, 70);
      g2.addColorStop(0, 'rgba(255,210,240,0.12)'); g2.addColorStop(1, 'rgba(255,210,240,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(px, py, 70, 0, TAU); ctx.fill();
    }
  }

  function subwayBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#2c3036'; ctx.fillRect(ox, oy, w, h);
    var tile = 128;
    for (var y = (oy / tile | 0) * tile; y < oy + h; y += tile) {
      for (var x = (ox / tile | 0) * tile; x < ox + w; x += tile) {
        var v = rr(rnd, -7, 9);
        ctx.fillStyle = 'rgb(' + Math.round(48 + v) + ',' + Math.round(54 + v) + ',' + Math.round(60 + v) + ')';
        ctx.fillRect(x, y, tile - 2, tile - 2);
      }
    }
    ctx.strokeStyle = 'rgba(200,255,240,0.10)'; ctx.lineWidth = 6;
    var bandY = oy + ((-oy % 320) + 320) % 320;
    for (; bandY < oy + h; bandY += 320) {
      ctx.beginPath(); ctx.moveTo(ox, bandY); ctx.lineTo(ox + w, bandY); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(240,220,120,0.22)'; ctx.lineWidth = 3;
    ctx.setLineDash([18, 22]);
    for (var by = oy + ((-oy % 160) + 160) % 160; by < oy + h; by += 160) {
      ctx.beginPath(); ctx.moveTo(ox, by + 18); ctx.lineTo(ox + w, by + 18); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (var i = 0; i < 14; i++) {
      ctx.fillStyle = 'rgba(18,22,26,0.35)';
      ctx.fillRect(ox + rr(rnd, 0, w), oy + rr(rnd, 0, h), rr(rnd, 24, 60), rr(rnd, 6, 14));
    }
  }

  function warehouseBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#312f2a'; ctx.fillRect(ox, oy, w, h);
    var tile = 140;
    for (var y = (oy / tile | 0) * tile; y < oy + h; y += tile) {
      for (var x = (ox / tile | 0) * tile; x < ox + w; x += tile) {
        var v = rr(rnd, -10, 10);
        ctx.fillStyle = 'rgb(' + Math.round(54 + v) + ',' + Math.round(50 + v) + ',' + Math.round(44 + v) + ')';
        ctx.fillRect(x, y, tile - 2, tile - 2);
        ctx.strokeStyle = 'rgba(20,18,14,0.45)'; ctx.strokeRect(x, y, tile - 2, tile - 2);
      }
    }
    ctx.strokeStyle = 'rgba(255,190,90,0.18)'; ctx.lineWidth = 4;
    for (var ly = oy + ((-oy % 240) + 240) % 240; ly < oy + h; ly += 240) {
      ctx.setLineDash([50, 30]); ctx.beginPath(); ctx.moveTo(ox, ly); ctx.lineTo(ox + w, ly); ctx.stroke(); ctx.setLineDash([]);
    }
    for (var s = 0; s < 18; s++) {
      ctx.fillStyle = 'rgba(90,70,40,0.16)';
      ctx.beginPath(); ctx.ellipse(ox + rr(rnd, 0, w), oy + rr(rnd, 0, h), rr(rnd, 12, 40), rr(rnd, 8, 22), rr(rnd, 0, TAU), 0, TAU); ctx.fill();
    }
  }

  function parkBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#283428'; ctx.fillRect(ox, oy, w, h);
    for (var i = 0; i < 50; i++) {
      var px = ox + rr(rnd, 0, w), py = oy + rr(rnd, 0, h);
      var v = rr(rnd, -12, 16);
      ctx.fillStyle = 'rgba(' + Math.round(38 + v) + ',' + Math.round(68 + v) + ',' + Math.round(40 + v) + ',' + rr(rnd, 0.18, 0.38) + ')';
      ctx.beginPath(); ctx.ellipse(px, py, rr(rnd, 40, 140), rr(rnd, 30, 90), rr(rnd, 0, TAU), 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(110,95,70,0.28)'; ctx.lineWidth = 14;
    ctx.beginPath();
    var sx = ox + rr(rnd, 0, w), sy = oy;
    ctx.moveTo(sx, sy);
    for (var k = 0; k < 5; k++) { sx += rr(rnd, -80, 80); sy += h / 5; ctx.quadraticCurveTo(sx + rr(rnd, -40, 40), sy - h / 10, sx, sy); }
    ctx.stroke();
    for (var f = 0; f < 26; f++) {
      ctx.fillStyle = ['rgba(180,200,120,0.22)', 'rgba(140,90,120,0.16)', 'rgba(200,180,90,0.14)'][(rnd() * 3) | 0];
      ctx.beginPath(); ctx.arc(ox + rr(rnd, 0, w), oy + rr(rnd, 0, h), rr(rnd, 3, 7), 0, TAU); ctx.fill();
    }
    for (var p = 0; p < 4; p++) {
      var wx = ox + rr(rnd, 80, w - 80), wy = oy + rr(rnd, 80, h - 80);
      ctx.fillStyle = 'rgba(40,80,100,0.22)';
      ctx.beginPath(); ctx.ellipse(wx, wy, rr(rnd, 28, 55), rr(rnd, 16, 30), rr(rnd, 0, TAU), 0, TAU); ctx.fill();
    }
  }

  /* A bridge district: dark water below, long decks crossing it, railings
     and lamp posts. drawBridge() is the same painter the canal uses. */
  function overpassBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#1d2a33'; ctx.fillRect(ox, oy, w, h);
    for (var r = 0; r < 26; r++) {
      var wy = oy + rr(rnd, 0, h);
      ctx.strokeStyle = 'rgba(110,180,210,' + rr(rnd, 0.05, 0.14).toFixed(2) + ')';
      ctx.lineWidth = rr(rnd, 1, 2.4);
      ctx.beginPath(); ctx.moveTo(ox, wy); ctx.lineTo(ox + w, wy + rr(rnd, -8, 8)); ctx.stroke();
    }
    ctx.fillStyle = '#34383c';
    ctx.fillRect(ox, oy, w, 150);
    ctx.fillRect(ox, oy + h - 150, w, 150);
    ctx.fillStyle = 'rgba(220,220,215,0.35)';
    for (var d = 0; d < 8; d++) {
      ctx.fillRect(ox + d * 64 + 20, oy + 72, 34, 5);
      ctx.fillRect(ox + d * 64 + 20, oy + h - 78, 34, 5);
    }
    for (var b = 0; b < 3; b++) {
      drawBridge(ctx, ox + (b + 0.5) * (w / 3) - 34, oy + 40, 68, h - 80);
    }
    for (var l = 0; l < 4; l++) {
      var lx = ox + (l + 0.5) * (w / 4);
      ctx.fillStyle = '#1f2225'; ctx.fillRect(lx, oy + 138, 5, 26);
      ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(lx + 2, oy + 138, 3.4, 0, TAU); ctx.fill();
      ctx.fillRect(lx, oy + h - 164, 5, 26);
      ctx.beginPath(); ctx.arc(lx + 2, oy + h - 164, 3.4, 0, TAU); ctx.fill();
    }
  }

  function canalBase(ctx, w, h, ox, oy, rnd) {
    ctx.fillStyle = '#263034'; ctx.fillRect(ox, oy, w, h);
    var tile = 120;
    for (var y = (oy / tile | 0) * tile; y < oy + h; y += tile) {
      for (var x = (ox / tile | 0) * tile; x < ox + w; x += tile) {
        var v = rr(rnd, -8, 10);
        ctx.fillStyle = 'rgb(' + Math.round(44 + v) + ',' + Math.round(54 + v) + ',' + Math.round(58 + v) + ')';
        ctx.fillRect(x, y, tile - 2, tile - 2);
      }
    }
    var cy = oy + h * 0.5 + rr(rnd, -60, 60);
    ctx.fillStyle = 'rgba(30,70,90,0.45)';
    ctx.fillRect(ox, cy - 46, w, 92);
    ctx.strokeStyle = 'rgba(120,190,220,0.16)'; ctx.lineWidth = 2;
    for (var r = 0; r < 4; r++) {
      ctx.beginPath(); ctx.moveTo(ox, cy - 30 + r * 18); ctx.lineTo(ox + w, cy - 24 + r * 18 + rr(rnd, -4, 4)); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(90,82,70,0.55)';
    ctx.fillRect(ox, cy - 50, w, 6); ctx.fillRect(ox, cy + 44, w, 6);
    ctx.strokeStyle = 'rgba(200,200,180,0.12)'; ctx.lineWidth = 2;
    ctx.setLineDash([14, 14]); ctx.beginPath(); ctx.moveTo(ox, cy - 70); ctx.lineTo(ox + w, cy - 70); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, cy + 70); ctx.lineTo(ox + w, cy + 70); ctx.stroke(); ctx.setLineDash([]);
    /* several footbridges cross the canal in every chunk: walkable-looking
       landmarks that break up the long water band */
    for (var b = 0; b < 3; b++) {
      var bx = ox + 92 + b * 146 + rr(rnd, -16, 16);
      drawBridge(ctx, bx, cy, 62, 214);
    }
  }

  /* ------- props (drawn in chunk local space; caller translates first) */
  function drawCar(ctx, x, y, rot, color, rnd) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    var w = 92, h = 46;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath();
    ctx.ellipse(0, 6, w * 0.55, h * 0.55, 0, 0, TAU); ctx.fill();
    var grd = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grd.addColorStop(0, color); grd.addColorStop(0.55, shade(color, -0.25)); grd.addColorStop(1, shade(color, -0.5));
    ctx.fillStyle = grd;
    var r = 12;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + r, -h / 2); ctx.lineTo(w / 2 - r, -h / 2);
    ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    ctx.lineTo(w / 2, h / 2 - r); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    ctx.lineTo(-w / 2 + r, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    ctx.lineTo(-w / 2, -h / 2 + r); ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(28,40,48,0.92)'; ctx.fillRect(-16, -h / 2 + 6, 26, h - 12);
    ctx.fillStyle = 'rgba(22,32,38,0.85)'; ctx.fillRect(16, -h / 2 + 8, 16, h - 16);
    ctx.strokeStyle = 'rgba(180,200,210,0.2)'; ctx.lineWidth = 1.2;
    ctx.strokeRect(-16, -h / 2 + 6, 26, h - 12);
    ctx.fillStyle = 'rgba(110,58,28,0.4)';
    for (var i = 0; i < 12; i++) { ctx.beginPath();
      ctx.arc(rr(rnd, -w / 2 + 6, w / 2 - 6), rr(rnd, -h / 2 + 4, h / 2 - 4), rr(rnd, 2, 7), 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#141518'; ctx.fillRect(-w / 2 + 4, -h / 2 - 3, 20, 6);
    ctx.fillRect(-w / 2 + 4, h / 2 - 3, 20, 6); ctx.fillRect(w / 2 - 24, -h / 2 - 3, 20, 6);
    ctx.fillRect(w / 2 - 24, h / 2 - 3, 20, 6);
    ctx.restore();
  }

  /* A footbridge / overpass deck. `w` is the walkway width, `h` the span. */
  function drawBridge(ctx, x, y, w, h) {
    ctx.save(); ctx.translate(x, y);
    /* support shadow in the water */
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(-w / 2 + 7, -h / 2 + 10, w, h);
    /* stone / steel deck */
    var g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#5a5c58'); g.addColorStop(0.45, '#8a877c'); g.addColorStop(1, '#4c4f4c');
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(20,22,22,0.7)'; ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
    /* planks */
    ctx.strokeStyle = 'rgba(40,36,30,0.42)'; ctx.lineWidth = 1.5;
    for (var py = -h / 2 + 10; py < h / 2; py += 14) {
      ctx.beginPath(); ctx.moveTo(-w / 2 + 5, py); ctx.lineTo(w / 2 - 5, py); ctx.stroke();
    }
    /* rails */
    ctx.strokeStyle = '#2f3536'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-w / 2 + 4, -h / 2); ctx.lineTo(-w / 2 + 4, h / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 - 4, -h / 2); ctx.lineTo(w / 2 - 4, h / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(190,198,192,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w / 2 + 4, -h / 2); ctx.lineTo(-w / 2 + 4, h / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 - 4, -h / 2); ctx.lineTo(w / 2 - 4, h / 2); ctx.stroke();
    /* rail posts */
    ctx.fillStyle = '#272c2d';
    for (var ry = -h / 2 + 8; ry < h / 2; ry += 34) {
      ctx.fillRect(-w / 2 + 1, ry, 7, 6);
      ctx.fillRect(w / 2 - 8, ry, 7, 6);
    }
    /* end caps */
    ctx.fillStyle = '#3b3f3e';
    ctx.fillRect(-w / 2, -h / 2, w, 5);
    ctx.fillRect(-w / 2, h / 2 - 5, w, 5);
    ctx.restore();
  }

  function drawCrate(ctx, x, y, size, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-size / 2 + 3, -size / 2 + 4, size, size);
    var g = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
    g.addColorStop(0, '#7a5c34'); g.addColorStop(0.5, '#5d4526'); g.addColorStop(1, '#3f2f1b');
    ctx.fillStyle = g; ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = 'rgba(28,20,12,0.75)'; ctx.lineWidth = 2;
    ctx.strokeRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4);
    ctx.beginPath(); ctx.moveTo(-size / 2 + 2, -size / 2 + 2); ctx.lineTo(size / 2 - 2, size / 2 - 2);
    ctx.moveTo(size / 2 - 2, -size / 2 + 2); ctx.lineTo(-size / 2 + 2, size / 2 - 2); ctx.stroke();
    ctx.restore();
  }

  function drawBarrel(ctx, x, y, color) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath();
    ctx.ellipse(2, 4, 17, 17, 0, 0, TAU); ctx.fill();
    var g = ctx.createRadialGradient(-5, -5, 2, 0, 0, 18);
    g.addColorStop(0, shade(color, 0.18)); g.addColorStop(1, shade(color, -0.45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,20,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(160,60,30,0.25)'; ctx.beginPath(); ctx.arc(4, 6, 8, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawAcUnit(ctx, x, y, w, h, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
    var g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#7c8288'); g.addColorStop(1, '#454b50'); ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(20,24,28,0.7)'; ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
    ctx.strokeStyle = 'rgba(18,22,26,0.8)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * 0.32, 0, TAU); ctx.stroke();
    for (var i = 0; i < 4; i++) {
      var a = i / 4 * TAU + 0.4;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * Math.min(w, h) * 0.3, Math.sin(a) * Math.min(w, h) * 0.3); ctx.stroke();
    }
    ctx.restore();
  }

  function drawGurney(ctx, x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-30, -18, 64, 40);
    ctx.fillStyle = '#9aa5a8'; ctx.fillRect(-32, -20, 64, 40);
    ctx.fillStyle = '#c9d3d4'; ctx.fillRect(-28, -16, 56, 32);
    ctx.fillStyle = '#8b9094'; ctx.fillRect(-40, -22, 8, 44); ctx.fillRect(32, -22, 8, 44);
    ctx.fillStyle = 'rgba(120,20,16,0.5)'; ctx.beginPath();
    ctx.ellipse(6, 2, 20, 11, 0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawTree(ctx, x, y, scale, rnd) {
    var s = scale || 1;
    ctx.fillStyle = 'rgba(40,30,18,0.85)'; ctx.fillRect(x - 2 * s, y - 14 * s, 4 * s, 18 * s);
    ctx.fillStyle = shade('#3c6a3a', 0.0);
    ctx.beginPath(); ctx.arc(x, y - 30 * s, 24 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 14 * s, y - 22 * s, 17 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 15 * s, y - 24 * s, 17 * s, 0, TAU); ctx.fill();
  }

  function drawBench(ctx, x, y, rot, rnd) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = shade('#5a4a3a', 0.0);
    ctx.fillRect(-26, -9, 52, 4); ctx.fillRect(-22, -13, 4, 8); ctx.fillRect(18, -13, 4, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-26, -9 + 2, 52, 2);
    ctx.restore();
  }

  function drawPlanter(ctx, x, y, rot, rnd) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-16, -14, 32, 10);
    var g = ctx.createLinearGradient(-16, -14, 16, -4);
    g.addColorStop(0, '#8a6a44'); g.addColorStop(1, '#5d4426');
    ctx.fillStyle = g; ctx.fillRect(-16, -14, 32, 10);
    ctx.fillStyle = 'rgba(20,20,20,0.35)'; ctx.fillRect(-16, -4, 32, 4);
    ctx.fillStyle = shade('#3c6a3a', 0.0);
    for (var i = 0; i < 6; i++) { ctx.beginPath();
      ctx.arc(rr(rnd, -14, 14), rr(rnd, -14, -4), rr(rnd, 5, 8), 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawBarricade(ctx, x, y, rot, rnd) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-30, -7, 60, 14);
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-28, -5, 56, 8);
    for (var i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)'; ctx.fillRect(-28 + i * 8, -5, 3, 8);
    }
    ctx.fillStyle = 'rgba(190,60,30,0.55)'; ctx.fillRect(-30, -11, 60, 5);
    ctx.restore();
  }

  /* ------- per-chunk baking, lazy + capped ---------------------------- */
  function streetRoads(ctx, ox, oy, cw, ch, cx, cy) {
    var mask = 'rgba(30,32,34,0.9)';
    for (var i = (ox / CELL | 0) - 1; i * CELL <= ox + cw; i++) {
      var rx = i * CELL;
      var x0 = Math.max(ox, rx - ROAD_HALF), x1 = Math.min(ox + cw, rx + ROAD_HALF);
      if (x1 > x0) { ctx.fillStyle = mask; ctx.fillRect(x0, oy, x1 - x0, ch); }
    }
    for (var j = (oy / CELL | 0) - 1; j * CELL <= oy + ch; j++) {
      var ry = j * CELL;
      var y0 = Math.max(oy, ry - ROAD_HALF), y1 = Math.min(oy + ch, ry + ROAD_HALF);
      if (y1 > y0) { ctx.fillStyle = mask; ctx.fillRect(ox, y0, cw, y1 - y0); }
    }
    for (var i = (ox / CELL | 0) - 1; i * CELL <= ox + cw; i++) {
      var rx = i * CELL;
      if (rx >= ox && rx <= ox + cw) {
        ctx.fillStyle = 'rgba(160,152,116,0.32)';
        ctx.fillRect(rx - 2, oy, 4, ch);
        ctx.strokeStyle = 'rgba(220,206,140,0.5)'; ctx.lineWidth = 6;
        ctx.setLineDash([56, 48]); ctx.beginPath();
        ctx.moveTo(rx, oy); ctx.lineTo(rx, oy + ch); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(220,206,140,0.18)';
        ctx.fillRect(rx - 14, oy, 24, ch);
      }
    }
    for (var j = (oy / CELL | 0) - 1; j * CELL <= oy + ch; j++) {
      var ry = j * CELL;
      if (ry >= oy && ry <= oy + ch) {
        ctx.fillStyle = 'rgba(160,152,116,0.32)'; ctx.fillRect(ox, ry - 2, cw, 4);
        ctx.strokeStyle = 'rgba(220,206,140,0.5)'; ctx.lineWidth = 6;
        ctx.setLineDash([56, 48]); ctx.beginPath();
        ctx.moveTo(ox, ry); ctx.lineTo(ox + cw, ry); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    for (var j = (oy / CELL | 0) - 1; j * CELL <= oy + ch; j++) {
      var ry = j * CELL;
      for (var i = (ox / CELL | 0) - 1; i * CELL <= ox + cw; i++) {
        var rx = i * CELL;
        if (rx + ROAD_HALF < ox || rx - ROAD_HALF > ox + cw) continue;
        if (ry + ROAD_HALF < oy || ry - ROAD_HALF > oy + ch) continue;
        var yx0 = Math.max(ox, rx - 70), yx1 = Math.min(ox + cw, rx + 70);
        var yy0 = Math.max(oy, ry - 120), yy1 = Math.min(oy + ch, ry + 120);
        if (yx1 <= yx0 || yy1 <= yy0) continue;
        ctx.fillStyle = 'rgba(207,201,174,0.5)';
        for (var s = yx0; s < yx1; s += 16) ctx.fillRect(s, yy0, 13, yy1 - yy0);
        ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(rx - 3, ry + 7, 6, 20);
        /* warm pool of light under the street lamp */
        var glow = ctx.createRadialGradient(rx, ry + 10, 2, rx, ry + 10, 96);
        glow.addColorStop(0, 'rgba(255,214,150,0.30)');
        glow.addColorStop(0.45, 'rgba(255,190,110,0.12)');
        glow.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(rx, ry + 10, 96, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,236,196,1)'; ctx.beginPath();
        ctx.arc(rx, ry + 10, 3.6, 0, TAU); ctx.fill();
      }
    }
  }

  function blockDecor(ctx, ox, oy, cx, cy, bi, bj, kind, rnd, worldKey) {
    var bx0 = bi * CELL + ROAD_HALF, by0 = bj * CELL + ROAD_HALF;
    var bx1 = (bi + 1) * CELL - ROAD_HALF, by1 = (bj + 1) * CELL - ROAD_HALF;
    if (bx0 <= ox) bx0 = ox; if (by0 <= oy) by0 = oy;
    if (bx1 >= ox + CHUNK) bx1 = ox + CHUNK; if (by1 >= oy + CHUNK) by1 = oy + CHUNK;
    if (bx1 <= bx0 || by1 <= by0) return;
    var bw = bx1 - bx0, bh = by1 - by0;
    ctx.fillStyle = 'rgba(120,115,100,0.42)'; ctx.fillRect(bx0, by0, bw, bh);
    ctx.fillStyle = 'rgba(70,70,72,0.18)'; ctx.fillRect(bx0 + 6, by0 + 6, bw - 12, bh - 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(bx0, by0, bw, bh); ctx.strokeRect(bx0 + 6, by0 + 6, bw - 12, bh - 12);
    var cx0 = bx0 + bw / 2, cy0 = by0 + bh / 2;
    var hx = cx0 + (rr(rnd, -bw * 0.22, bw * 0.22)), hy = cy0 + (rr(rnd, -bh * 0.22, bh * 0.22));
    var hw = bw * (0.30 + rr(rnd, 0, 0.18)), hh = bh * (0.26 + rr(rnd, 0, 0.18));
    ctx.save(); ctx.translate(hx, hy);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-hw / 2, -hh / 2 + 6, hw, hh + 10);
    var grd = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2);
    grd.addColorStop(0, '#5a5f63'); grd.addColorStop(0.5, '#55575c'); grd.addColorStop(1, '#3c4145');
    ctx.fillStyle = grd; ctx.fillRect(-hw / 2, -hh / 2, hw, hh);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(-hw / 2 + 2, -hh / 2 + 2, hw - 4, hh - 4);
    ctx.fillStyle = 'rgba(150,160,165,0.25)';
    var wxStep = hw / 5, wyStep = hh / 6;
    for (var wy = -hh / 2 + 8; wy < hh / 2; wy += wyStep) {
      for (var wx = -hw / 2 + 6; wx < hw / 2; wx += wxStep) {
        ctx.fillRect(wx, wy, 7, 9);
      }
    }
    ctx.fillStyle = 'rgba(20,20,20,0.7)'; ctx.fillRect(-hw / 2, hh / 2 - 6, hw, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-hw / 2, hh / 2 - 6, 4, 6);
    ctx.fillRect(hw / 2 - 4, hh / 2 - 6, 4, 6);
    ctx.restore();

    if (kind === 1) {
      drawTree(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), 1.2 + rr(rnd, 0, 0.3), rnd);
      drawBench(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), rr(rnd, 0, TAU), rnd);
      drawPlanter(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), rr(rnd, 0, TAU), rnd);
    } else if (kind === 2) {
      var parked = 3 + (rr(rnd) < 0.4 ? 2 : 0);
      for (var p = 0; p < parked; p++) {
        var pcx = bx0 + 40 + rr(rnd, 20, bw - 80), pcy = by0 + 40 + rr(rnd, 20, bh - 80);
        drawCar(ctx, pcx, pcy, (bi + p + bj) * TAU / parked + rr(rnd, -0.4, 0.4), '#6a4a3c', rnd);
      }
      drawBarrel(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), '#7a4a2c', rnd);
      drawCrate(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), rr(rnd, 30, 40), rr(rnd, 0, 1), rnd);
    } else if (kind === 3) {
      for (var p = 0; p < 4; p++) {
        drawBarrel(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), '#5b6a72', rnd);
        drawCrate(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), rr(rnd, 30, 44), rr(rnd, 0, 1), rnd);
      }
      drawBench(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), rr(rnd, 0, TAU), rnd);
    } else if (kind === 4) {
      drawBarricade(ctx, bx0 + rr(rnd, 80, bw - 80), by0 + rr(rnd, 60, bh - 60), rr(rnd, 0, TAU), rnd);
      drawBarrel(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), '#5b6a72', rnd);
      drawCrate(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), rr(rnd, 32, 44), rr(rnd, 0, 0.4), rnd);
    } else {
      drawCrate(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), rr(rnd, 40, 56), rr(rnd, 0, 0.5), rnd);
      drawBarrel(ctx, bx0 + rr(rnd, 60, bw - 60), by0 + rr(rnd, 60, bh - 60), '#4d6a34', rnd);
      drawAcUnit(ctx, bx0 + rr(rnd, 80, bw - 80), by0 + rr(rnd, 60, bh - 60), 90, 60, rr(rnd, -0.3, 0.3), rnd);
    }
  }

  function drawHydrant(ctx, x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(2, 5, 9, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a5402c'; ctx.fillRect(-5, -10, 10, 15);
    ctx.fillStyle = '#c25a3c'; ctx.fillRect(-7, -6, 14, 4);
    ctx.fillStyle = '#7d2f20'; ctx.beginPath(); ctx.arc(0, -11, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawDumpster(ctx, x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-24, -12, 52, 30);
    var g = ctx.createLinearGradient(0, -16, 0, 14);
    g.addColorStop(0, '#3f5a4a'); g.addColorStop(1, '#22332a');
    ctx.fillStyle = g; ctx.fillRect(-26, -14, 52, 30);
    ctx.fillStyle = 'rgba(180,200,190,0.16)'; ctx.fillRect(-26, -14, 52, 5);
    ctx.strokeStyle = 'rgba(12,18,14,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(-26, -14, 52, 30);
    ctx.restore();
  }

  function drawPalm(ctx, x, y, scale) {
    var s = scale || 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = '#4a3a26'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -22, 2, -46); ctx.stroke();
    ctx.fillStyle = '#2f5a3a';
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI / 2 + (i - 3) * 0.6;
      ctx.beginPath(); ctx.ellipse(2 + Math.cos(a) * 15, -46 + Math.sin(a) * 9, 16, 5, a, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawContainer(ctx, x, y, rot, rnd) {
    var cols = ['#8a4030', '#3f5a72', '#6a5a2e', '#4a6a4a'];
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-31, -14, 70, 34);
    ctx.fillStyle = cols[(rnd() * 4) | 0] || cols[0];
    ctx.fillRect(-34, -16, 68, 32);
    ctx.strokeStyle = 'rgba(14,18,20,0.7)'; ctx.lineWidth = 2;
    ctx.strokeRect(-34, -16, 68, 32);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1.5;
    for (var i = -28; i < 34; i += 8) {
      ctx.beginPath(); ctx.moveTo(i, -16); ctx.lineTo(i, 16); ctx.stroke();
    }
    ctx.restore();
  }

  var _PROP_DRAW = [
    function (ctx, x, y, rnd) { drawBarrel(ctx, x, y, '#5b6a72', rnd); },
    function (ctx, x, y, rnd) { drawCrate(ctx, x, y, rr(rnd, 30, 40), rr(rnd, 0, 1), rnd); },
    function (ctx, x, y, rnd) { drawPlanter(ctx, x, y, rr(rnd, 0, TAU), rnd); },
    function (ctx, x, y, rnd) { drawBench(ctx, x, y, rr(rnd, 0, TAU), rnd); },
    function (ctx, x, y, rnd) {
      var carCols = ['#4c5d63', '#6a4a3c', '#3f4b32', '#5a5a63', '#6d3f3a'];
      drawCar(ctx, x, y, rr(rnd, 0, TAU), carCols[(rr(rnd) * 5) | 0], rnd);
    },
    function (ctx, x, y, rnd) { drawBarricade(ctx, x, y, rr(rnd, 0, TAU), rnd); },
    function (ctx, x, y, rnd) { drawHydrant(ctx, x, y); },
    function (ctx, x, y, rnd) { drawDumpster(ctx, x, y, rr(rnd, 0, TAU)); },
    function (ctx, x, y, rnd) { drawPalm(ctx, x, y, 0.8 + rr(rnd, 0, 0.5)); },
    function (ctx, x, y, rnd) { drawContainer(ctx, x, y, rr(rnd, 0, TAU), rnd); }
  ];
  var PROP_DRAW_COUNT = _PROP_DRAW.length;

  /* ---- world object ------------------------------------------------ */
  function build(theme, seed) {
    var rnd = rng(seed || 1);
    var cfg = THEMES[theme] || THEMES.street;
    var world = {
      w: OPEN, h: OPEN,
      theme: theme, _fn: theme,
      cfg: cfg, _seed: seed || 1,
      ambient: cfg.ambient, fog: cfg.fog, lamp: cfg.lamp,
      props: [],
      _chunks: {}, _keys: [], _cap: 56
    };

    /* Infinite city: every district is 4x4 chunks and mostly keeps the stage
       theme. The spawn district always does, and any variation comes from a
       short list of compatible neighbours: a mall never grows a street with
       parked cars, and a park never turns into a warehouse. */
    world.themeAt = function (cx, cy) {
      var dx = Math.floor(cx / DISTRICT), dy = Math.floor(cy / DISTRICT);
      if (dx === 0 && dy === 0) return this._fn;
      var h = Math.abs(hash(this._seed * 7919 + 13, dx, dy));
      if (h % 100 < 55) return this._fn;
      var near = NEIGHBORS[this._fn] || [this._fn];
      /* `>>>` matters: `h >> 8` goes negative above 2^31 and indexes the
         neighbour list out of bounds, which used to bake a null theme (and a
         district banner with no name) on roughly half the map. */
      return near[(h >>> 8) % near.length];
    };

    world.districtName = function (cx, cy) {
      var t = this.themeAt(cx, cy);
      return (THEMES[t] || THEMES.street).name;
    };

    world.draw = function (ctx, vx0, vy0, vx1, vy1) {
      /* inclusive range: the chunk holding vx1/vy1 must be painted too,
         otherwise the right/bottom edge of the view stays black.
         No clamping: this city has no edge. */
      var x0 = Math.floor(vx0 / CHUNK);
      var x1 = Math.floor(vx1 / CHUNK);
      var y0 = Math.floor(vy0 / CHUNK);
      var y1 = Math.floor(vy1 / CHUNK);
      for (var cy = y0; cy <= y1; cy++) {
        for (var cx = x0; cx <= x1; cx++) {
          this.drawTile(ctx, cx, cy);
        }
      }
    };

    world.drawTile = function (ctx, cx, cy) {
      var key = cx + ':' + cy;
      var c = this._chunks[key];
      if (!c) {
        c = bake(this, cx, cy);
      }
      ctx.drawImage(c, cx * CHUNK, cy * CHUNK);
    };

    return world;
  }

  function _evict(world) {
    if (world._keys.length > world._cap) {
      var evict = world._keys.shift();
      delete world._chunks[evict];
    }
  }

  function drawBlockProps(ctx, ox, oy, world, bi, bj, i, j, rnd) {
    var bx0 = bi * CELL + ROAD_HALF, by0 = bj * CELL + ROAD_HALF;
    var bx1 = (bi + 1) * CELL - ROAD_HALF, by1 = (bj + 1) * CELL - ROAD_HALF;
    if (bx1 <= ox || by1 <= oy || bx0 >= ox + CHUNK || by0 >= oy + CHUNK) return;
    var bx0c = Math.max(ox, bx0), by0c = Math.max(oy, by0);
    var bx1c = Math.min(ox + CHUNK, bx1), by1c = Math.min(oy + CHUNK, by1);
    if (bx1c <= bx0c || by1c <= by0c) return;
    var bw = bx1c - bx0c, bh = by1c - by0c;
    var kind = hash(world._seed, bi * 7 + bj * 13 + i * 19 + j * 23) % 5;
    var cellRnd = rng(hash(world._seed, bi * 7 + bj * 13));
    /* sidewalk: pale concrete slab with a kerb line, so blocks read against
       the darker asphalt instead of blending into it */
    var pave = ctx.createLinearGradient(bx0c, by0c, bx0c + bw, by0c + bh);
    pave.addColorStop(0, '#6c6a63');
    pave.addColorStop(0.5, '#5d5b55');
    pave.addColorStop(1, '#4b4a45');
    ctx.fillStyle = pave; ctx.fillRect(bx0c, by0c, bw, bh);
    ctx.strokeStyle = 'rgba(24,25,26,0.5)'; ctx.lineWidth = 2;
    if (bw > 10) ctx.strokeRect(bx0c + 1, by0c + 1, bw - 2, bh - 2);
    /* kerb strip */
    ctx.fillStyle = 'rgba(196,192,178,0.35)';
    ctx.fillRect(bx0c, by0c, bw, 5);
    ctx.fillRect(bx0c, by0c, 5, bh);
    /* paving joints */
    ctx.strokeStyle = 'rgba(28,28,28,0.18)'; ctx.lineWidth = 1;
    for (var pj = by0c + 34; pj < by1c; pj += 48) {
      ctx.beginPath(); ctx.moveTo(bx0c, pj); ctx.lineTo(bx1c, pj); ctx.stroke();
    }
    for (var pi2 = bx0c + 34; pi2 < bx1c; pi2 += 48) {
      ctx.beginPath(); ctx.moveTo(pi2, by0c); ctx.lineTo(pi2, by1c); ctx.stroke();
    }
    var cx0 = bx0c + bw / 2, cy0 = by0c + bh / 2;
    var hx = cx0 + (cellRnd() * (bw - 160)) - (bx0c + bw / 2) + cx0;
    var hy = cy0 + (cellRnd() * (bh - 160)) - (by0c + bh / 2) + cy0;
    var hw = Math.min(bw * 0.36, 172), hh = Math.min(bh * 0.32, 128);
    ctx.save(); ctx.translate(hx, hy);
    /* cast shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-hw / 2 + 6, -hh / 2 + 10, hw, hh);
    /* facade: a few palettes so the city is not one flat grey */
    var FACADES = [
      ['#9b9081', '#7d7365', '#514b43'],   /* concrete */
      ['#a08065', '#7d6049', '#4a3729'],   /* brick */
      ['#7d8b96', '#5f6d78', '#3d4750'],   /* glass tower */
      ['#948f74', '#736f59', '#47442f'],   /* sand */
      ['#8b7d8f', '#6b5f70', '#413744']    /* faded paint */
    ];
    var facade = FACADES[hash(world._seed, bi * 53 + bj * 29) % FACADES.length];
    var grd = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2);
    grd.addColorStop(0, facade[0]); grd.addColorStop(0.45, facade[1]); grd.addColorStop(1, facade[2]);
    ctx.fillStyle = grd; ctx.fillRect(-hw / 2, -hh / 2, hw, hh);
    ctx.strokeStyle = 'rgba(18,18,18,0.6)'; ctx.lineWidth = 2.5;
    ctx.strokeRect(-hw / 2 + 1, -hh / 2 + 1, hw - 2, hh - 2);
    /* rooftop lip */
    ctx.fillStyle = 'rgba(214,206,188,0.5)';
    ctx.fillRect(-hw / 2, -hh / 2, hw, 5);
    /* windows: a few are lit, most are dark glass */
    if (bw > 60 && bh > 60) {
      var cols = Math.max(2, Math.floor(hw / 22));
      var rows = Math.max(2, Math.floor(hh / 26));
      var wW = Math.min(12, hw / cols - 6), wH = Math.min(10, hh / rows - 8);
      for (var wr = 0; wr < rows; wr++) {
        for (var wc = 0; wc < cols; wc++) {
          var wx = -hw / 2 + 10 + wc * ((hw - 20) / cols);
          var wy = -hh / 2 + 12 + wr * ((hh - 20) / rows);
          var lit = hash(world._seed, bi * 31 + bj * 17 + wr * 7 + wc * 13) % 7 === 0;
          ctx.fillStyle = lit ? 'rgba(255,206,120,0.92)' : 'rgba(28,34,40,0.75)';
          ctx.fillRect(wx, wy, wW, wH);
          if (lit) {
            ctx.fillStyle = 'rgba(255,196,90,0.16)';
            ctx.fillRect(wx - 3, wy - 3, wW + 6, wH + 6);
          }
        }
      }
    }
    /* doorway */
    ctx.fillStyle = 'rgba(22,24,26,0.9)';
    ctx.fillRect(-7, hh / 2 - 20, 14, 20);
    ctx.fillStyle = 'rgba(120,120,120,0.3)';
    ctx.fillRect(-8, hh / 2 - 21, 16, 2);
    /* ground-level grime */
    ctx.fillStyle = 'rgba(12,12,12,0.28)';
    ctx.fillRect(-hw / 2, hh / 2 - 8, hw, 8);
    ctx.restore();

    /* a few blocks grow trees along the kerb */
    if (kind === 1 || kind === 4) {
      var trees = 1 + (hash(world._seed, bi * 11 + bj * 41) % 3);
      for (var tr = 0; tr < trees; tr++) {
        var tx = bx0c + 50 + cellRnd() * Math.max(10, bw - 100);
        var ty = by0c + 50 + cellRnd() * Math.max(10, bh - 100);
        if (tx + 24 > bx1c || ty + 24 > by1c) continue;
        drawTree(ctx, tx, ty, 0.9 + cellRnd() * 0.4, rng(hash(world._seed, tr * 17 + bi)));
      }
    }

    var propCount = (kind < 2 ? 3 : 4) + (kind === 2 ? 2 : 0);
    for (var p = 0; p < propCount; p++) {
      var px = bx0c + 40 + cellRnd() * (bw - 80);
      var py = by0c + 40 + cellRnd() * (bh - 80);
      if (px + 40 > bx1c || py + 40 > by1c) continue;
      _PROP_DRAW[(hash(world._seed, bi * 19 + bj * 23 + p * 11) % PROP_DRAW_COUNT)](
        ctx, px, py, rng(hash(world._seed, bi * 19 + bj * 23 + p * 11 + 3)));
    }
    /* extra roadside clutter: barricades and wrecks around the block edge */
    for (var rb = 0; rb < 2; rb++) {
      var rbx = bx0c + 26 + cellRnd() * Math.max(10, bw - 70);
      var rby = by0c + 22 + cellRnd() * Math.max(10, bh - 50);
      if (rbx + 30 > bx1c || rby + 8 > by1c) continue;
      drawBarricade(ctx, rbx, rby, cellRnd() * TAU, rng(hash(world._seed, bi * 31 + bj * 37 + rb)));
    }
    if (kind === 2) {
      for (var p = 0; p < 4; p++) {
        var pcx = bx0c + 40 + cellRnd() * (bw - 100);
        var pcy = by0c + 40 + cellRnd() * (bh - 100);
        if (pcx + 60 > bx1c || pcy + 50 > by1c) continue;
        var carCols = ['#4c5d63', '#6a4a3c', '#3f4b32', '#5a5a63', '#6d3f3a'];
        drawCar(ctx, pcx, pcy, cellRnd() * TAU, carCols[(cellRnd() * 5) | 0], rng(hash(world._seed, bi * 19 + bj * 23 + p * 11 + 7)));
      }
    }
  }

  function bake(world, cx, cy) {
    var key = cx + ':' + cy;
    if (world._chunks[key]) return world._chunks[key];
    var canvas = document.createElement('canvas');
    canvas.width = CHUNK; canvas.height = CHUNK;
    var ctx = canvas.getContext('2d');
    var ox = cx * CHUNK, oy = cy * CHUNK;
    /* every painter below works in WORLD coordinates, so shift the chunk
       canvas into place — without this everything past chunk 0 is clipped
       and bakes out completely black. */
    ctx.translate(-ox, -oy);
    var rnd = rng(hash(world._seed, cx, cy));
    var fn = world.themeAt ? world.themeAt(cx, cy) : world._fn;
    var BASE = {
      street: streetBase, factory: concreteBase, hospital: hospitalBase, rooftop: roofBase,
      downtown: downtownBase, docks: docksBase, suburb: suburbBase, airport: airportBase,
      mall: mallBase, subway: subwayBase, warehouse: warehouseBase, park: parkBase, canal: canalBase,
      /* six new districts reuse the proven surface painters, so they keep the
         same density and props while reading as different places */
      arcade: mallBase, foundry: concreteBase, cathedral: hospitalBase,
      skyline: downtownBase, greenhouse: parkBase, boneyard: streetBase,
      overpass: overpassBase, snowfield: airportBase, quarry: concreteBase,
      junkyard: warehouseBase, boardwalk: docksBase, observatory: hospitalBase
    };
    (BASE[fn] || roofBase)(ctx, CHUNK, CHUNK, ox, oy, rnd);

    if (fn === 'street') {
      streetRoads(ctx, ox, oy, CHUNK, CHUNK, cx, cy);
      var pcx0 = Math.floor(ox / CELL), pcx1 = Math.floor((ox + CHUNK) / CELL) + 1;
      var pcy0 = Math.floor(oy / CELL), pcy1 = Math.floor((oy + CHUNK) / CELL) + 1;
      for (var j = pcy0; j < pcy1; j++) {
        for (var i = pcx0; i < pcx1; i++) {
          drawBlockProps(ctx, ox, oy, world, i, j, i, j, rnd);
        }
      }
    } else {
      var pcx0 = Math.floor(ox / CELL), pcx1 = Math.floor((ox + CHUNK) / CELL) + 1;
      var pcy0 = Math.floor(oy / CELL), pcy1 = Math.floor((oy + CHUNK) / CELL) + 1;
      for (var j = pcy0; j < pcy1; j++) {
        for (var i = pcx0; i < pcx1; i++) {
          var bx0 = i * CELL + ROAD_HALF * 0, by0 = j * CELL + ROAD_HALF * 0;
          var bx1 = (i + 1) * CELL, by1 = (j + 1) * CELL;
          var kinds = fn === 'factory' ? [0, 1, 0, 2] :
                      fn === 'hospital' ? [1, 0, 3, 0] :
                      fn === 'docks' ? [0, 0, 3, 0] :
                      fn === 'suburb' ? [1, 1, 3, 1] :
                      fn === 'downtown' ? [0, 2, 0, 1] :
                      fn === 'mall' ? [2, 3, 2, 3] :
                      fn === 'subway' ? [2, 0, 2, 1] :
                      fn === 'warehouse' ? [0, 1, 0, 0] :
                      fn === 'park' ? [1, 3, 1, 3] :
                      fn === 'canal' ? [0, 3, 2, 0] :
                      [2, 3, 0, 1];
          var cellRnd = rng(hash(world._seed, i * 7 + j * 13));
          if (fn === 'factory') {
            ctx.fillStyle = 'rgba(20,20,22,0.22)'; ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
            ctx.fillStyle = 'rgba(94,92,88,0.12)'; ctx.fillRect(bx0 + 2, by0 + 2, (bx1 - bx0) - 4, (by1 - by0) - 4);
            for (var s = 0; s < 3; s++) {
              var sbx = bx0 + cellRnd() * (bx1 - bx0 - 40), sby = by0 + cellRnd() * (by1 - by0 - 40);
              var sw = 80 + cellRnd() * 60, sh = 40 + cellRnd() * 40;
              ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(sbx, sby, sw, sh);
              var sg = ctx.createLinearGradient(sbx, sby, sbx, sby + sh);
              sg.addColorStop(0, '#6b6a62'); sg.addColorStop(1, '#3a3a35');
              ctx.fillStyle = sg; ctx.fillRect(sbx, sby, sw, sh);
              ctx.strokeStyle = 'rgba(22,20,16,0.75)'; ctx.lineWidth = 2;
              ctx.strokeRect(sbx + 2, sby + 2, sw - 4, sh - 4);
              ctx.fillStyle = 'rgba(190,60,30,0.5)'; ctx.fillRect(sbx + 8, sby + 8, 10, 6);
            }
            for (var p = 0; p < 5; p++) {
              var px = bx0 + 20 + cellRnd() * (bx1 - bx0 - 60), py = by0 + 20 + cellRnd() * (by1 - by0 - 60);
              _PROP_DRAW[(hash(world._seed, i * 19 + j * 23 + p * 11) % PROP_DRAW_COUNT)](ctx, px, py, rng(hash(world._seed, i * 19 + j * 23 + p * 11 + 3)));
            }
          } else if (fn === 'hospital') {
            for (var s = 0; s < 2; s++) {
              var sbx = bx0 + 20 + cellRnd() * (bx1 - bx0 - 80), sby = by0 + cellRnd() * (by1 - by0 - 80);
              var sw = 60 + cellRnd() * 50, sh = 46;
              ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(sbx, sby, sw, sh);
              var sg = ctx.createLinearGradient(sbx, sby, sbx, sby + sh);
              sg.addColorStop(0, '#7d8a8b'); sg.addColorStop(1, '#4d5658');
              ctx.fillStyle = sg; ctx.fillRect(sbx, sby, sw, sh);
              ctx.fillStyle = 'rgba(200,235,235,0.16)'; ctx.fillRect(sbx + 6, sby + 6, sw - 12, 6);
            }
            for (var p = 0; p < 5; p++) {
              var px = bx0 + 20 + cellRnd() * (bx1 - bx0 - 60), py = by0 + 20 + cellRnd() * (by1 - by0 - 60);
              _PROP_DRAW[(hash(world._seed, i * 19 + j * 23 + p * 11) % PROP_DRAW_COUNT)](ctx, px, py, rng(hash(world._seed, i * 19 + j * 23 + p * 11 + 3)));
            }
          } else if (fn === 'mall') {
            for (var s = 0; s < 2; s++) {
              var sbx = bx0 + 24 + cellRnd() * Math.max(1, bx1 - bx0 - 140), sby = by0 + 24 + cellRnd() * Math.max(1, by1 - by0 - 110);
              var sw = 90 + cellRnd() * 80, sh = 56 + cellRnd() * 34;
              ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sbx + 5, sby + 8, sw, sh);
              var sg = ctx.createLinearGradient(sbx, sby, sbx, sby + sh);
              sg.addColorStop(0, '#6a6078'); sg.addColorStop(1, '#3a3444');
              ctx.fillStyle = sg; ctx.fillRect(sbx, sby, sw, sh);
              ctx.strokeStyle = 'rgba(255,200,240,0.22)'; ctx.lineWidth = 2; ctx.strokeRect(sbx + 2, sby + 2, sw - 4, sh - 4);
              var nc = ['rgba(255,120,200,0.55)', 'rgba(120,220,255,0.5)', 'rgba(255,220,120,0.45)'][(hash(world._seed, i * 7 + s) % 3)];
              ctx.fillStyle = nc; ctx.fillRect(sbx + 8, sby + 8, Math.min(sw - 16, 50), 8);
              for (var w = 0; w < 4; w++) { ctx.fillStyle = w % 2 ? 'rgba(255,230,180,0.35)' : 'rgba(30,40,60,0.5)'; ctx.fillRect(sbx + 10 + w * 18, sby + 22, 12, 10); }
            }
            for (var p = 0; p < 6; p++) {
              var px = bx0 + 20 + cellRnd() * (bx1 - bx0 - 60), py = by0 + 20 + cellRnd() * (by1 - by0 - 60);
              _PROP_DRAW[(hash(world._seed, i * 19 + j * 23 + p * 11) % PROP_DRAW_COUNT)](ctx, px, py, rng(hash(world._seed, i * 19 + j * 23 + p * 11 + 3)));
            }
          } else if (fn === 'subway') {
            ctx.fillStyle = 'rgba(18,22,28,0.18)'; ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
            for (var s = 0; s < 2; s++) {
              var sbx = bx0 + 30 + cellRnd() * Math.max(1, bx1 - bx0 - 120), sby = by0 + 30 + cellRnd() * Math.max(1, by1 - by0 - 100);
              var sw = 70 + cellRnd() * 60, sh = 42 + cellRnd() * 26;
              ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(sbx, sby, sw, sh);
              var sg = ctx.createLinearGradient(sbx, sby, sbx, sby + sh);
              sg.addColorStop(0, '#5a6672'); sg.addColorStop(1, '#343c46');
              ctx.fillStyle = sg; ctx.fillRect(sbx, sby, sw, sh);
              ctx.fillStyle = 'rgba(200,255,240,0.18)'; ctx.fillRect(sbx + 6, sby + sh - 10, sw - 12, 4);
              ctx.strokeStyle = 'rgba(200,255,240,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(sbx + 2, sby + 2, sw - 4, sh - 4);
            }
            for (var p = 0; p < 5; p++) {
              var px = bx0 + 20 + cellRnd() * (bx1 - bx0 - 60), py = by0 + 20 + cellRnd() * (by1 - by0 - 60);
              _PROP_DRAW[(hash(world._seed, i * 19 + j * 23 + p * 11) % PROP_DRAW_COUNT)](ctx, px, py, rng(hash(world._seed, i * 19 + j * 23 + p * 11 + 3)));
            }
          } else if (fn === 'warehouse') {
            for (var s = 0; s < 3; s++) {
              var sbx = bx0 + cellRnd() * Math.max(1, bx1 - bx0 - 120), sby = by0 + cellRnd() * Math.max(1, by1 - by0 - 90);
              var sw = 100 + cellRnd() * 80, sh = 44 + cellRnd() * 36;
              ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(sbx + 4, sby + 6, sw, sh);
              var sg = ctx.createLinearGradient(sbx, sby, sbx, sby + sh);
              sg.addColorStop(0, '#7a7264'); sg.addColorStop(1, '#403b34');
              ctx.fillStyle = sg; ctx.fillRect(sbx, sby, sw, sh);
              ctx.strokeStyle = 'rgba(24,20,16,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(sbx + 2, sby + 2, sw - 4, sh - 4);
              ctx.fillStyle = 'rgba(255,190,90,0.22)'; ctx.fillRect(sbx + sw / 2 - 12, sby + sh - 20, 24, 18);
            }
            for (var p = 0; p < 5; p++) {
              var px = bx0 + 20 + cellRnd() * (bx1 - bx0 - 60), py = by0 + 20 + cellRnd() * (by1 - by0 - 60);
              if (p === 0) drawContainer(ctx, px, py, cellRnd() * TAU, rng(hash(world._seed, i * 19 + j * 23 + 3)));
              else _PROP_DRAW[(hash(world._seed, i * 19 + j * 23 + p * 11) % PROP_DRAW_COUNT)](ctx, px, py, rng(hash(world._seed, i * 19 + j * 23 + p * 11 + 3)));
            }
          } else if (fn === 'park') {
            for (var t = 0; t < 3; t++) {
              var tx = bx0 + 40 + cellRnd() * Math.max(10, bx1 - bx0 - 80), ty = by0 + 50 + cellRnd() * Math.max(10, by1 - by0 - 90);
              drawTree(ctx, tx, ty, 0.9 + cellRnd() * 0.5, rng(hash(world._seed, i * 31 + j * 17 + t * 7)));
            }
            for (var s = 0; s < 1; s++) {
              var sbx = bx0 + 40 + cellRnd() * Math.max(1, bx1 - bx0 - 160), sby = by0 + 40 + cellRnd() * Math.max(1, by1 - by0 - 120);
              var sw = 60 + cellRnd() * 50, sh = 34 + cellRnd() * 24;
              ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(sbx, sby, sw, sh);
              var sg = ctx.createLinearGradient(sbx, sby, sbx, sby + sh);
              sg.addColorStop(0, '#8a7a60'); sg.addColorStop(1, '#5a4e3e');
              ctx.fillStyle = sg; ctx.fillRect(sbx, sby, sw, sh);
            }
            for (var p = 0; p < 4; p++) {
              var px = bx0 + 30 + cellRnd() * (bx1 - bx0 - 60), py = by0 + 30 + cellRnd() * (by1 - by0 - 60);
              drawBench(ctx, px, py, cellRnd() * TAU, rng(hash(world._seed, i * 19 + j * 23 + p * 11 + 3)));
            }
          } else if (fn === 'canal') {
            for (var s = 0; s < 2; s++) {
              var sbx = bx0 + 30 + cellRnd() * Math.max(1, bx1 - bx0 - 130), sby = by0 + 20 + cellRnd() * Math.max(1, by1 - by0 - 100);
              var sw = 80 + cellRnd() * 60, sh = 42 + cellRnd() * 30;
              ctx.fillStyle = 'rgba(0,0,0,0.36)'; ctx.fillRect(sbx, sby, sw, sh);
              var sg = ctx.createLinearGradient(sbx, sby, sbx, sby + sh);
              sg.addColorStop(0, '#889098'); sg.addColorStop(1, '#4a535a');
              ctx.fillStyle = sg; ctx.fillRect(sbx, sby, sw, sh);
              ctx.fillStyle = 'rgba(120,190,220,0.12)'; ctx.fillRect(sbx + 6, sby + 8, sw - 12, 6);
              ctx.strokeStyle = 'rgba(20,26,30,0.65)'; ctx.lineWidth = 2; ctx.strokeRect(sbx + 2, sby + 2, sw - 4, sh - 4);
            }
            for (var p = 0; p < 5; p++) {
              var px = bx0 + 20 + cellRnd() * (bx1 - bx0 - 60), py = by0 + 20 + cellRnd() * (by1 - by0 - 60);
              _PROP_DRAW[(hash(world._seed, i * 19 + j * 23 + p * 11) % PROP_DRAW_COUNT)](ctx, px, py, rng(hash(world._seed, i * 19 + j * 23 + p * 11 + 3)));
            }
          } else {
            for (var s = 0; s < 3; s++) {
              var sbx = bx0 + cellRnd() * (bx1 - bx0 - 80), sby = by0 + cellRnd() * (by1 - by0 - 80);
              var sw = 80 + cellRnd() * 50, sh = 40 + cellRnd() * 40;
              if (sw > 0 && sh > 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(sbx, sby, sw, sh);
                var sg = ctx.createLinearGradient(sbx, sby, sbx, sby + sh);
                sg.addColorStop(0, '#7c8288'); sg.addColorStop(1, '#454b50');
                ctx.fillStyle = sg; ctx.fillRect(sbx, sby, sw, sh);
                ctx.strokeStyle = 'rgba(20,24,28,0.7)'; ctx.lineWidth = 2;
                ctx.strokeRect(sbx + 2, sby + 2, sw - 4, sh - 4);
                ctx.strokeStyle = 'rgba(18,22,26,0.8)'; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.arc(sbx + sw / 2, sby + sh / 2, Math.min(sw, sh) * 0.3, 0, TAU); ctx.stroke();
              }
            }
            for (var p = 0; p < 5; p++) {
              var px = bx0 + 20 + cellRnd() * (bx1 - bx0 - 60), py = by0 + 20 + cellRnd() * (by1 - by0 - 60);
              _PROP_DRAW[(hash(world._seed, i * 19 + j * 23 + p * 11) % PROP_DRAW_COUNT)](ctx, px, py, rng(hash(world._seed, i * 19 + j * 23 + p * 11 + 3)));
            }
          }
        }
      }
    }

    world._chunks[key] = canvas;
    world._keys.push(key);
    _evict(world);
    return canvas;
  }

  var cache = {};

  function get(theme, seed) {
    var key = theme + ':' + (seed || 1);
    if (!cache[key]) cache[key] = build(theme, seed || 1);
    return cache[key];
  }

  ZH.Arena = {
    get: get,
    build: build,
    THEMES: THEMES,
    drawCar: drawCar,
    drawBridge: drawBridge
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ZH.Arena;
})(typeof window !== 'undefined' ? window.ZH || (window.ZH = {}) : {});

