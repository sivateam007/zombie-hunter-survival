/*
 * Meow Zombie Hunter — character rig
 * ------------------------------------------------------------
 * Every human character in the game is drawn from a small bone rig.
 * Limbs are solved with two-bone inverse kinematics every frame, so the
 * hunter's feet stay planted while walking and both hands stay welded to
 * the weapon while aiming, reloading or kicking from recoil.
 *
 * Nothing here is a bitmap: no sprite sheets, no licences, no downloads.
 */
window.ZH = window.ZH || {};
(function (ZH) {
  'use strict';

  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }

  /* ------------------------------- colour ------------------------------- */
  var _mixCache = {};
  function hexToRgb(hex) {
    var v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  /** Blend a colour toward white (flash) or black (shadow). */
  function shade(hex, amount) {
    if (!amount) return hex;
    var key = hex + '|' + amount.toFixed(2);
    if (_mixCache[key]) return _mixCache[key];
    var c = hexToRgb(hex);
    var t = amount > 0 ? 255 : 0;
    var a = Math.abs(amount);
    var out = 'rgb(' + Math.round(lerp(c[0], t, a)) + ',' +
      Math.round(lerp(c[1], t, a)) + ',' +
      Math.round(lerp(c[2], t, a)) + ')';
    _mixCache[key] = out;
    return out;
  }

  /* ------------------------------ palettes ------------------------------ */
  var HUNTER = {
    skin: '#c08b64', skinShade: '#95643f',
    coat: '#33402f', coatLit: '#4d5f42', coatDark: '#1e2620',
    vest: '#6b5233', vestLit: '#8a6b45',
    pants: '#39414a', pantsLit: '#4d5762', boots: '#1d2124',
    accent: '#c0472f', accentDark: '#8d2f1f',
    hair: '#241d18', metal: '#a4aeb8', metalDark: '#525c66',
    pack: '#4a3b28', strap: '#2a241d', glove: '#232a26'
  };

  /* player-selectable survivor palettes, layered over HUNTER */
  var CHARACTER_PALETTES = {
    meow:    { coat: '#3a3348', coatLit: '#524a68', coatDark: '#211d2c', vest: '#5c4a63', accent: '#ff8fd0', accentDark: '#b0577f' },
    ninja:   { coat: '#22262e', coatLit: '#333a45', coatDark: '#11141a', vest: '#2b3038', accent: '#7dffd4', accentDark: '#3d9c82' },
    titan:   { coat: '#3b3430', coatLit: '#554b44', coatDark: '#221e1b', vest: '#4d423a', accent: '#ffb347', accentDark: '#a86f22' },
    reaper:  { coat: '#2a2430', coatLit: '#3d3448', coatDark: '#151219', vest: '#3a3040', accent: '#ff4d4d', accentDark: '#a32b2b' },
    scout:   { coat: '#2f3d36', coatLit: '#425a4c', coatDark: '#1a2620', vest: '#3c5044', accent: '#ffe066', accentDark: '#a88c2c' },
    banker:  { coat: '#3a3226', coatLit: '#524634', coatDark: '#211c14', vest: '#4c3f2c', accent: '#ffd166', accentDark: '#a8842c' },
    vampire: { coat: '#2b1f28', coatLit: '#402c3b', coatDark: '#150f14', vest: '#3a2836', accent: '#c04dff', accentDark: '#71299c' },
    brawler: { coat: '#332722', coatLit: '#4a382f', coatDark: '#1c1410', vest: '#453127', accent: '#ff8a4a', accentDark: '#a3552b' },
    catlord: { coat: '#30283f', coatLit: '#463a5c', coatDark: '#1a1523', vest: '#3d3350', accent: '#ffd6f2', accentDark: '#a87a9c' },
    neoncat: { coat: '#2a2f45', coatLit: '#3b4364', coatDark: '#141625', vest: '#333b55', accent: '#5cf2ff', accentDark: '#2a8fa3' },
    ronin:   { coat: '#2b2b30', coatLit: '#3f3f47', coatDark: '#151518', vest: '#37373f', accent: '#e8e8e8', accentDark: '#8f8f8f' },
    frost:   { coat: '#283a44', coatLit: '#3a5563', coatDark: '#132128', vest: '#2f4653', accent: '#a8e8ff', accentDark: '#4e8aa3' },
    ember:   { coat: '#3d2a22', coatLit: '#5a3d30', coatDark: '#221610', vest: '#4a3328', accent: '#ff7a3d', accentDark: '#a34a22' },
    tech:    { coat: '#2b333a', coatLit: '#3d4a55', coatDark: '#141a1e', vest: '#33414a', accent: '#7dffd4', accentDark: '#3d9c82' },
    warlock: { coat: '#2c2136', coatLit: '#413050', coatDark: '#150f1a', vest: '#382a45', accent: '#9b5cff', accentDark: '#5c2fa3' },
    queen:   { coat: '#3a2d33', coatLit: '#54424a', coatDark: '#1e161a', vest: '#47343c', accent: '#ff5c9e', accentDark: '#a32b5e' },
    ghostcat:{ coat: '#2a3038', coatLit: '#3d4653', coatDark: '#14181d', vest: '#343d47', accent: '#d8f6ff', accentDark: '#7fa8b8' },
    ranger:  { coat: '#3d4a2a', coatLit: '#5c6d3e', coatDark: '#242d18', vest: '#6b5a36', accent: '#d7a13a', accentDark: '#8f6a1e' },
    medic:   { coat: '#2b4548', coatLit: '#406064', coatDark: '#172829', vest: '#3d5c5c', accent: '#58d6c0', accentDark: '#2f8c7c' },
    scrapper:{ coat: '#4a3a2c', coatLit: '#66513d', coatDark: '#2a2118', vest: '#6a5138', accent: '#c78cff', accentDark: '#7a4fa3' },
    berserk: { coat: '#4a2626', coatLit: '#673838', coatDark: '#2a1414', vest: '#654030', accent: '#ff6b4a', accentDark: '#a63b26' },
    ghost:   { coat: '#2c3446', coatLit: '#414d63', coatDark: '#171d27', vest: '#48546b', accent: '#8fd6ff', accentDark: '#4b7e9e' }
  };

  function paletteFor(id) {
    var over = CHARACTER_PALETTES[id];
    if (!over) return HUNTER;
    var out = {};
    for (var k in HUNTER) if (Object.prototype.hasOwnProperty.call(HUNTER, k)) out[k] = HUNTER[k];
    for (var j in over) if (Object.prototype.hasOwnProperty.call(over, j)) out[j] = over[j];
    return out;
  }

  var ZOMBIE_BASE = {
    skin: '#87975f', skinShade: '#5f6c42', skinLit: '#a4b47a',
    coat: '#4b4038', coatLit: '#5f5147', coatDark: '#332c27',
    pants: '#3a3a33', pantsLit: '#4b4b42', boots: '#241f1c',
    blood: '#6d1a14', bloodLit: '#a52a1f',
    eye: '#e9ff72', tooth: '#e6e0cd', bone: '#cfc7ae',
    metal: '#8b9298', metalDark: '#4c5257'
  };

  var ZOMBIES = {
    walker:  { s: 1.00, bulk: 1.00, hunch: 0.42, pal: ZOMBIE_BASE },
    runner:  { s: 0.94, bulk: 0.88, hunch: 0.70, pal: ZOMBIE_BASE },
    brute:   { s: 1.34, bulk: 1.42, hunch: 0.34, pal: ZOMBIE_BASE },
    spitter: { s: 1.04, bulk: 1.12, hunch: 0.50, pal: ZOMBIE_BASE },
    crawler: { s: 0.86, bulk: 0.92, hunch: 1.00, pal: ZOMBIE_BASE },
    boss:    { s: 1.75, bulk: 1.55, hunch: 0.30, pal: ZOMBIE_BASE },
    butcher: { s: 1.80, bulk: 1.70, hunch: 0.28, pal: ZOMBIE_BASE },
    matron:  { s: 1.68, bulk: 1.40, hunch: 0.46, pal: ZOMBIE_BASE },
    warden:  { s: 1.95, bulk: 1.62, hunch: 0.26, pal: ZOMBIE_BASE }
  };

  /* --------------------------- drawing helpers --------------------------- */
  function capsule(ctx, ax, ay, bx, by, w, color, outline) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(0.8, w * 0.22);
      ctx.globalAlpha *= 0.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.globalAlpha /= 0.5;
    }
  }

  /** two-bone IK: returns the elbow/knee position and the clamped end point */
  function ik(ax, ay, tx, ty, l1, l2, bend) {
    var dx = tx - ax, dy = ty - ay;
    var dist = Math.hypot(dx, dy) || 0.0001;
    var min = Math.abs(l1 - l2) + 0.5, max = l1 + l2 - 0.5;
    var d = clamp(dist, min, max);
    var ux = dx / dist, uy = dy / dist;
    var ex = ax + ux * d, ey = ay + uy * d;
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    var h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return {
      jx: ax + ux * a - uy * h * bend,
      jy: ay + uy * a + ux * h * bend,
      ex: ex, ey: ey, dist: dist, over: dist > max
    };
  }

  function circle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  /* ----------------------------- weapon art ----------------------------- */
  /* one entry per gun in the 20-weapon catalogue + evolutions;
     unknown ids fall back to the rifle silhouette. */
  var GUNS = {
    gun:        { len: 17, grip: 7, h: 3.6, rail: 0.6, scope: 0, stock: 0, mag: 3 },
    uzi:        { len: 20, grip: 8, h: 4.0, rail: 0.8, scope: 0, stock: 3, mag: 6 },
    crossbow:   { len: 26, grip: 7, h: 4.2, rail: 0.4, scope: 3, stock: 2, mag: 0 },
    shotgun:    { len: 26, grip: 8, h: 4.4, rail: 0.6, scope: 0, stock: 6, mag: 0 },
    drill:      { len: 24, grip: 8, h: 4.6, rail: 0.7, scope: 2, stock: 4, mag: 4 },
    lasergun:   { len: 30, grip: 8, h: 4.2, rail: 0.9, scope: 6, stock: 5, mag: 4 },
    bazooka:    { len: 32, grip: 9, h: 6.4, rail: 0.4, scope: 4, stock: 2, mag: 0 },
    rocketlauncher: { len: 35, grip: 10, h: 7.6, rail: 0.5, scope: 5, stock: 3, mag: 0 },
    grenadelauncher: { len: 29, grip: 9, h: 6.6, rail: 0.4, scope: 2, stock: 3, mag: 0 },
    nuke:       { len: 36, grip: 9, h: 7.4, rail: 0.4, scope: 5, stock: 2, mag: 0 },
    doomsday:   { len: 40, grip: 10, h: 8.4, rail: 0.5, scope: 6, stock: 4, mag: 0 },
    siegebreaker: { len: 34, grip: 10, h: 7.4, rail: 0.4, scope: 3, stock: 4, mag: 0 },
    launcher:   { len: 30, grip: 9, h: 6.8, rail: 0.4, scope: 3, stock: 2, mag: 2 },
    airstrike:  { len: 34, grip: 9, h: 7.0, rail: 0.4, scope: 4, stock: 2, mag: 2 },
    flamer:     { len: 22, grip: 8, h: 5.2, rail: 0.4, scope: 0, stock: 3, mag: 0 },
    plasmagun:  { len: 26, grip: 8, h: 5.6, rail: 0.5, scope: 0, stock: 3, mag: 0 },
    molotov:    { len: 14, grip: 7, h: 4.4, rail: 0.3, scope: 0, stock: 0, mag: 0 },
    canister:   { len: 18, grip: 8, h: 5.2, rail: 0.3, scope: 0, stock: 0, mag: 0 },
    tesla:      { len: 25, grip: 8, h: 4.6, rail: 0.9, scope: 4, stock: 4, mag: 3 },
    thunderorb: { len: 28, grip: 8, h: 5.0, rail: 0.9, scope: 5, stock: 4, mag: 3 },
    spikedball: { len: 13, grip: 7, h: 3.6, rail: 0.4, scope: 0, stock: 0, mag: 0 },
    biliard:    { len: 13, grip: 7, h: 3.6, rail: 0.4, scope: 0, stock: 0, mag: 0 },
    forcefield: { len: 12, grip: 7, h: 3.2, rail: 0.3, scope: 0, stock: 0, mag: 0 },
    domain:     { len: 12, grip: 7, h: 3.2, rail: 0.3, scope: 0, stock: 0, mag: 0 },
    boomerang:  { len: 12, grip: 6, h: 3.0, rail: 0.2, scope: 0, stock: 0, mag: 0 },
    neckbreaker:{ len: 12, grip: 6, h: 3.0, rail: 0.2, scope: 0, stock: 0, mag: 0 },
    smg:        { len: 21, grip: 8, h: 4.0, rail: 0.8, scope: 1, stock: 2, mag: 7 },
    minigun:    { len: 28, grip: 9, h: 6.2, rail: 1.0, scope: 0, stock: 4, mag: 9 },
    sniper:     { len: 34, grip: 8, h: 4.0, rail: 1.1, scope: 7, stock: 8, mag: 4 },
    railgun:    { len: 38, grip: 8, h: 4.4, rail: 1.2, scope: 8, stock: 8, mag: 3 },
    grenade:    { len: 13, grip: 7, h: 4.6, rail: 0.3, scope: 0, stock: 0, mag: 0 },
    clusterbomb:{ len: 16, grip: 7, h: 5.0, rail: 0.3, scope: 1, stock: 0, mag: 0 },
    rifle:      { len: 29, grip: 8, h: 4.0, rail: 1.0, scope: 5, stock: 7, mag: 6 }
  };

  /* melee / throwing weapons are drawn as blades, not guns */
  var BLADES = { axe: 1, battleaxe: 1, sword: 1, scimitars: 1, circular: 1, ripper: 1, katana: 1, nodachi: 1 };

  /** Hand-space weapon: +x is the barrel, origin is the grip. */
  function drawWeapon(ctx, id, pal, s, flash, reloadDip) {
    var g = GUNS[id] || GUNS.rifle;
    var met = pal.metal || '#a4aeb8';
    var dark = pal.metalDark || '#525c66';
    ctx.save();
    ctx.translate(0, reloadDip || 0);
    if (BLADES[id]) {
      /* handle + blade, swung in the aim direction */
      roundRect(ctx, -3, -1.8, 12, 3.6, 1.2);
      ctx.fillStyle = '#3b2a1c'; ctx.fill();
      ctx.beginPath();
      if (id === 'axe' || id === 'battleaxe') {
        ctx.moveTo(9, -2);
        ctx.lineTo(9 + 9, -11);
        ctx.lineTo(9 + 13, -2);
        ctx.lineTo(9 + 12, 9);
        ctx.lineTo(9 + 4, 3);
        ctx.closePath();
        ctx.fillStyle = '#c9d6df';
      } else if (id === 'circular' || id === 'ripper') {
        ctx.arc(15, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#b9c6cf';
      } else {
        ctx.moveTo(8, -2.2);
        ctx.lineTo(30, -1.4);
        ctx.lineTo(34, 0);
        ctx.lineTo(30, 1.4);
        ctx.lineTo(8, 2.2);
        ctx.closePath();
        ctx.fillStyle = '#d7e2ea';
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,26,30,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
      return;
    }
    if (id === 'flamer' || id === 'plasmagun') {
      roundRect(ctx, -2, -g.h / 2, g.len * 0.62, g.h, 1.6);
      ctx.fillStyle = shade(dark, -0.25); ctx.fill();
      roundRect(ctx, g.len * 0.5, -2.1, g.len * 0.5, 4.2, 1.4);
      ctx.fillStyle = '#7d3a24'; ctx.fill();
      circle(ctx, g.len * 0.96, 0, 2.6, '#41251a');
    } else {
      /* receiver + barrel */
      roundRect(ctx, 0, -g.h / 2, g.len * 0.66, g.h, 1.2);
      ctx.fillStyle = met; ctx.fill();
      ctx.fillStyle = shade(met, 0.22);
      roundRect(ctx, 1, -g.h / 2 + 0.5, g.len * 0.62, g.h * 0.32, 0.8); ctx.fill();
      roundRect(ctx, g.len * 0.6, -g.h * 0.26, g.len * 0.4, g.h * 0.52, 0.9);
      ctx.fillStyle = dark; ctx.fill();
      /* stock */
      if (g.stock) {
        ctx.save();
        ctx.translate(-g.stock, 0);
        roundRect(ctx, 0, -g.h * 0.34, g.stock, g.h * 0.7, 1);
        ctx.fillStyle = shade(dark, -0.18); ctx.fill();
        ctx.restore();
      }
      /* magazine */
      if (g.mag) {
        ctx.save();
        ctx.translate(g.len * 0.32, g.h * 0.4);
        ctx.rotate(-0.18);
        roundRect(ctx, 0, 0, 3.2, g.mag, 0.9);
        ctx.fillStyle = shade(dark, -0.3); ctx.fill();
        ctx.restore();
      }
      /* optic */
      if (g.scope) {
        roundRect(ctx, g.len * 0.22, -g.h * 0.5 - g.scope * 0.55, g.scope, g.scope * 0.55, 1);
        ctx.fillStyle = shade(dark, -0.12); ctx.fill();
      }
      /* grip */
      ctx.save();
      ctx.translate(0.5, g.h * 0.36);
      ctx.rotate(-0.34);
      roundRect(ctx, 0, 0, 3.4, g.grip, 1);
      ctx.fillStyle = '#2a2c2b'; ctx.fill();
      ctx.restore();
      /* pump on the shotty */
      if (id === 'shotgun') {
        roundRect(ctx, g.len * 0.5, g.h * 0.1, 6, g.h * 0.9, 1.4);
        ctx.fillStyle = '#5a3a26'; ctx.fill();
      }
    }
    /* muzzle flash */
    if (flash > 0.02) {
      var fx = g.len + 1;
      var rr = (5 + 9 * flash) * s;
      var grd = ctx.createRadialGradient(fx, 0, 0, fx, 0, rr);
      grd.addColorStop(0, 'rgba(255,247,214,' + (0.95 * flash) + ')');
      grd.addColorStop(0.45, 'rgba(255,178,64,' + (0.6 * flash) + ')');
      grd.addColorStop(1, 'rgba(255,96,20,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(fx, 0, rr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,241,196,' + (0.9 * flash) + ')';
      ctx.beginPath();
      ctx.moveTo(fx, -1.6 * s);
      ctx.lineTo(fx + (10 + 8 * flash) * s, 0);
      ctx.lineTo(fx, 1.6 * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------------------- hunter heads ---------------------------- */
  function hunterHead(ctx, pal, p, opts) {
    var hx = 0, hy = -49;
    /* neck */
    capsule(ctx, 0, -45, -0.6, -48, 5.2 * p.bulk, pal.skinShade);
    /* face */
    circle(ctx, hx, hy, 6.4 * p.bulk, pal.skin);
    ctx.fillStyle = pal.skinShade;
    ctx.beginPath();
    ctx.arc(hx, hy, 6.4 * p.bulk, 0.15, Math.PI - 0.15);
    ctx.fill();
    /* hair / beanie */
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.arc(hx, hy - 0.6, 6.5 * p.bulk, Math.PI * 1.02, Math.PI * 2.02);
    ctx.lineTo(hx - 6.5 * p.bulk, hy - 1.2);
    ctx.closePath();
    ctx.fill();
    /* goggles pushed up */
    ctx.strokeStyle = pal.metalDark;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx - 5.6 * p.bulk, hy + 0.2);
    ctx.lineTo(hx + 5.4 * p.bulk, hy + 0.2);
    ctx.stroke();
    circle(ctx, hx + 2.6 * p.bulk, hy + 0.2, 1.9, 'rgba(120,190,200,0.9)');
    circle(ctx, hx - 2.6 * p.bulk, hy + 0.2, 1.7, 'rgba(120,190,200,0.75)');
    /* eye + brow (front-facing 3/4) */
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath();
    ctx.ellipse(hx + 3.2 * p.bulk, hy + 4.4, 1.1, 1.5, 0, 0, TAU);
    ctx.fill();
    /* scarf tail flutters with speed */
    var flutter = Math.sin(p.t * 8) * p.moving * 2.4;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2.5, -44);
    ctx.quadraticCurveTo(-6 - p.moving * 1.6, -43 + flutter * 0.6, -9 - p.moving * 2.4, -40 + flutter);
    ctx.stroke();
    ctx.strokeStyle = pal.accentDark;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  /* ---------------------------- zombie heads ---------------------------- */
  function zombieHead(ctx, pal, p, opts) {
    var bulk = p.bulk;
    var hy = -47 + p.hunch * 5;
    var hx = p.hunch * 4;
    /* neck */
    capsule(ctx, 0, -44, hx * 0.5, hy + 4, 5.2 * bulk, pal.skinShade);
    /* skull */
    circle(ctx, hx, hy, 6.1 * bulk, pal.skin);
    /* back-of-head shading */
    ctx.fillStyle = pal.skinShade;
    ctx.beginPath();
    ctx.arc(hx, hy, 6 * bulk, Math.PI * 0.34, Math.PI * 1.16);
    ctx.fill();
    /* sunken cheek */
    ctx.fillStyle = 'rgba(70,80,48,0.45)';
    ctx.beginPath();
    ctx.ellipse(hx + 2.2 * bulk, hy + 3.6, 3.2, 2.2, 0.2, 0, TAU);
    ctx.fill();
    /* dark socket with a single burning eye */
    ctx.fillStyle = 'rgba(20,26,14,0.92)';
    ctx.beginPath();
    ctx.ellipse(hx + 2.7 * bulk, hy + 0.1, 2.5, 2.1, 0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.eye;
    ctx.beginPath();
    ctx.arc(hx + 3.05 * bulk, hy + 0.1, 0.95 * bulk, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(240,255,150,0.16)';
    ctx.beginPath();
    ctx.arc(hx + 3 * bulk, hy + 0.1, 3.1 * bulk, 0, TAU);
    ctx.fill();
    /* brow ridge */
    ctx.strokeStyle = 'rgba(36,44,24,0.85)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(hx + 0.6 * bulk, hy - 2.7);
    ctx.lineTo(hx + 5.3 * bulk, hy - 1.6);
    ctx.stroke();
    /* hanging jaw */
    ctx.save();
    ctx.translate(hx + 1.3, hy + 4.1);
    ctx.rotate(0.34 + Math.sin(p.t * 5.5) * 0.06);
    ctx.fillStyle = pal.skinShade;
    roundRect(ctx, 0, 0, 4.9 * bulk, 3.1, 1.1);
    ctx.fill();
    ctx.fillStyle = pal.tooth || '#e6e0cd';
    for (var t = 0; t < 3; t++) ctx.fillRect(0.6 + t * 1.4, 0, 0.8, 0.9);
    ctx.restore();
    /* temple wound */
    ctx.fillStyle = 'rgba(109,26,20,0.9)';
    ctx.beginPath();
    ctx.ellipse(hx - 3.1 * bulk, hy - 2.1, 2.1, 1.1, 0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = pal.blood;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hx - 2.5, hy - 1.1);
    ctx.lineTo(hx - 3.3, hy + 4.4);
    ctx.stroke();
    /* ragged hair */
    ctx.strokeStyle = 'rgba(32,30,22,0.7)';
    ctx.lineWidth = 1.2;
    for (var k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(hx - 4.2 + k * 2.3, hy - 5.1);
      ctx.lineTo(hx - 5.2 + k * 2.4, hy - 7.3);
      ctx.stroke();
    }
  }

  /* ------------------------------- torso -------------------------------- */
  function drawTorso(ctx, pal, body, kind) {
    var bulk = body.bulk || 1;
    var w = 15 * bulk, h = 18 * bulk;
    var top = -44, bot = -26;
    /* jacket shell */
    ctx.save();
    ctx.translate((body.hunch || 0) * -2, 0);
    roundRect(ctx, -w / 2, top, w, h, 5.4 * bulk);
    var g = ctx.createLinearGradient(-w / 2, top, w / 2, bot);
    g.addColorStop(0, pal.coatLit || pal.coat);
    g.addColorStop(0.55, pal.coat);
    g.addColorStop(1, pal.coatDark || pal.coat);
    ctx.fillStyle = g;
    ctx.fill();
    if (kind === 'hunter') {
      /* tactical vest */
      ctx.save();
      ctx.beginPath();
      ctx.rect(-w / 2 + 1, top + 2, w - 2, h - 6);
      ctx.clip();
      roundRect(ctx, -w / 2 + 2.2, top + 3.4, w - 4.4, 11 * bulk, 2.4);
      ctx.fillStyle = pal.vest;
      ctx.fill();
      /* vest webbing */
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 3, top + 5.4 + i * 3.1);
        ctx.lineTo(w / 2 - 3, top + 5.4 + i * 3.1);
        ctx.stroke();
      }
      ctx.restore();
      /* chest strap */
      ctx.strokeStyle = pal.strap;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 2, top + 1);
      ctx.lineTo(w / 2 - 3, top + 12);
      ctx.stroke();
      /* belt */
      roundRect(ctx, -w / 2 + 0.6, bot - 3.4, w - 1.2, 3.2, 1.2);
      ctx.fillStyle = pal.strap;
      ctx.fill();
      circle(ctx, 0, bot - 1.8, 1.5, pal.metal);
    } else {
      /* torn shirt: ragged hem + ribs */
      ctx.fillStyle = pal.coatDark;
      ctx.beginPath();
      ctx.moveTo(-w / 2, bot - 4);
      ctx.lineTo(-w / 2 + 3, bot + 3);
      ctx.lineTo(-w / 2 + 6.5, bot - 2);
      ctx.lineTo(w / 2 - 5, bot + 2.5);
      ctx.lineTo(w / 2, bot - 4);
      ctx.lineTo(w / 2, bot - 6);
      ctx.lineTo(-w / 2, bot - 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,210,190,0.55)';
      ctx.lineWidth = 1;
      for (var r = 0; r < 3; r++) {
        ctx.beginPath();
        ctx.moveTo(-3.6, top + 8 + r * 2.6);
        ctx.quadraticCurveTo(0, top + 9 + r * 2.6, 3.4, top + 8 + r * 2.6);
        ctx.stroke();
      }
      /* blood soak on the shirt */
      ctx.fillStyle = 'rgba(109,26,20,0.34)';
      ctx.beginPath();
      ctx.ellipse(-2.6, top + 11.5, 3.4, 4.2, 0.3, 0, TAU);
      ctx.fill();
      /* spitters carry a swollen, acid-lit gut */
      if (body.variant === 'spitter') {
        var belly = ctx.createRadialGradient(1, bot - 5, 1, 1, bot - 5, 8 * bulk);
        belly.addColorStop(0, 'rgba(170,205,70,0.9)');
        belly.addColorStop(1, 'rgba(90,120,40,0.15)');
        ctx.fillStyle = belly;
        ctx.beginPath();
        ctx.ellipse(1, bot - 5, 7 * bulk, 6 * bulk, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,220,60,0.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(2, bot + 1);
        ctx.lineTo(3.6, bot + 6);
        ctx.stroke();
      }
    }
    ctx.restore();
    if (kind === 'hunter' && body.backpack !== false) {
      ctx.save();
      roundRect(ctx, -w / 2 - 3.4, top + 2, 3.6, 11, 1.8);
      ctx.fillStyle = pal.pack;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 3, top + 7);
      ctx.lineTo(-w / 2 + 0.2, top + 7);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ----------------------------- main entry ----------------------------- */
  /**
   * Draw a character.
   * opts = { x, y, s, facing, aim, pose, kind, variant, weapon, alpha,
   *          flash, tint, dead, hpFrac, rags }
   */
  function draw(ctx, o) {
    o = o || {};
    var kind = o.kind || 'hunter';
    var variant = o.variant || (kind === 'hunter' ? 'hunter' : 'walker');
    var zdef = ZOMBIES[variant] || ZOMBIES.walker;
    var pal = o.palette || (kind === 'hunter' ? HUNTER : zdef.pal);
    var flash = o.flash || 0;
    var p = o.pose || {};
    var s = (o.s || 1) * (kind === 'hunter' ? 1 : zdef.s);
    var facing = o.facing == null ? 1 : (o.facing < 0 ? -1 : 1);
    var aim = o.aim == null ? 0 : o.aim;
    var t = p.t || 0;
    var moving = clamp(p.moving || 0, 0, 1);
    var phase = p.walkPhase || 0;
    var recoil = clamp(p.recoil || 0, 0, 1);
    var reload = clamp(p.reload || 0, 0, 1);
    var hurt = clamp(p.hurt || 0, 0, 1);
    var crouch = clamp(p.crouch || 0, 0, 1);
    var dead = clamp(o.dead || 0, 0, 1);
    var bulk = (kind === 'hunter' ? 1 : zdef.bulk) * (p.bulkMul || 1);
    var hunch = kind === 'hunter' ? 0 : zdef.hunch;
    var crawl = variant === 'crawler' || p.crawl ? 1 : 0;

    /* local-space aim: mirror when the body is flipped */
    var localAim = facing > 0 ? aim : Math.PI - aim;
    var wobble = kind === 'hunter' ? 0 : Math.sin(t * 3.1 + (o.seed || 0)) * 0.05;

    var alpha = o.alpha == null ? 1 : o.alpha;
    ctx.save();
    ctx.globalAlpha = alpha;

    /* ground shadow */
    if (o.shadow !== false) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.34;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + 1, 12 * s * bulk, 4.2 * s * bulk, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.translate(o.x, o.y);
    if (dead > 0) {
      ctx.translate(0, -2 * dead);
      ctx.rotate(dead * 1.32 * facing);
    }
    ctx.scale(facing * s, s);
    if (crawl) {
      /* crawlers drag themselves along the ground, chest first */
      ctx.translate(0, 7);
      ctx.rotate(0.58);
    }

    /* limb colours (flashed toward white when hit) */
    var skin = shade(pal.skin, flash * 0.85);
    var skinShade = shade(pal.skinShade, flash * 0.7);
    var coat = shade(pal.coat, flash * 0.7);
    var coatLit = shade(pal.coatLit || pal.coat, flash * 0.7);
    var coatDark = shade(pal.coatDark || pal.coat, flash * 0.7);
    var pants = shade(pal.pants, flash * 0.7);
    var pantsLit = shade(pal.pantsLit || pal.pants, flash * 0.7);
    var boots = shade(pal.boots, flash * 0.6);
    var meta = { metal: pal.metal, metalDark: pal.metalDark };
    if (kind === 'hunter') {
      meta.metal = shade(pal.metal, flash * 0.8);
      meta.metalDark = shade(pal.metalDark, flash * 0.6);
    }

    var breathe = Math.sin(t * 2.1) * 0.55;
    var bob = -Math.abs(Math.sin(phase)) * 2.1 * moving + breathe * (1 - moving) - crouch * 4;
    var hipY = -26 + bob;
    var hipX = 4.8 * bulk;
    var shoulderY = -40 + bob + hunch * 2.4;
    var chestY = -42 + bob;
    var lean = (hunch * 5 + moving * 1.4 + crouch * 2.4);
    var stride = (9 + 3 * moving) * (kind === 'hunter' ? 1 : 0.85);

    /* ---- legs (IK to planted feet) ---- */
    var legLen = 14 * (0.94 + bulk * 0.06);
    function leg(side, ph) {
      var swing = Math.sin(ph) * stride * moving;
      var lift = Math.max(0, Math.sin(ph)) * (6.5 * moving + 0.5);
      var fx = crawl ? hipX * side - 5 : hipX * side + swing + lean * 0.35;
      var fy = crawl ? -1 : -lift + (crouch * 2.4);
      var kneeBend = side > 0 ? 1 : -1;
      var r = ik(hipX * side, hipY, fx, fy, legLen, legLen, kneeBend * (kind === 'hunter' ? 1 : 0.85));
      var th = side > 0 ? pants : shade(pants, -0.14);
      capsule(ctx, hipX * side, hipY, r.jx, r.jy, 6.1 * bulk, th);
      capsule(ctx, r.jx, r.jy, r.ex, r.ey, 4.4 * bulk, side > 0 ? pantsLit : pants);
      /* boot */
      ctx.save();
      ctx.translate(r.ex, r.ey);
      ctx.rotate(0.06 * Math.sin(ph) * moving);
      roundRect(ctx, -2.6 * bulk, -1.4, 6.2 * bulk, 3.4 * bulk, 1.4);
      ctx.fillStyle = boots;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();
      /* knee pad: gear, not a stick figure */
      ctx.fillStyle = pal.pad || '#232a2e';
      ctx.beginPath(); ctx.arc(r.jx, r.jy, 2.5 * bulk, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(r.jx, r.jy, 2.5 * bulk, 0, TAU); ctx.stroke();
      return { x: r.ex, y: r.ey, thigh: th };
    }

    var backLeg = leg(-1, phase + Math.PI);
    var frontLeg = leg(1, phase);

    /* ---- back arm ---- */
    var shoulderX = 5.4 * bulk;
    var armLen = 12.4 * (0.9 + bulk * 0.1);
    var gunHand, offHand;

    if (kind === 'hunter') {
      /* main hand follows the aim direction, with recoil pushback */
      var reach = 12.4 - recoil * 2.4;
      var aimX = Math.cos(localAim) * reach;
      var aimY = Math.sin(localAim) * reach;
      var shX = shoulderX - 1, shY = shoulderY + 2;
      var main = ik(shX, shY, shX + aimX, shY + aimY, armLen, armLen, 1);
      /* support hand rides the foregrip (pistols: close to main hand) */
      var isLong = (o.weapon === 'rifle' || o.weapon === 'smg' || o.weapon === 'shotgun' ||
        o.weapon === 'sniper' || o.weapon === 'flamer' || o.weapon === 'minigun' ||
        o.weapon === 'railgun' || o.weapon === 'katana' || o.weapon === 'nodachi');
      var gripDist = isLong ? 12 : 5;
      var supX = shX + Math.cos(localAim) * (reach + gripDist - reload * 8);
      var supY = shY + Math.sin(localAim) * (reach + gripDist - reload * 8);
      if (reload > 0.02) {
        /* hand dives to the magwell and back */
        var dip = Math.sin(clamp(reload, 0, 1) * Math.PI);
        supX = lerp(supX, -2 + Math.cos(localAim) * 3, dip);
        supY = lerp(supY, -24 + Math.sin(localAim) * 3, dip);
      }
      var sup = ik(-shoulderX + 2, shY + 1, supX, supY, armLen, armLen, -1);
      gunHand = { x: main.ex, y: main.ey, angle: localAim };
      offHand = { x: sup.ex, y: sup.ey, angle: localAim };

      /* back arm (drawn first) */
      capsule(ctx, -shoulderX + 1, shY + 1, sup.jx, sup.jy, 4.9 * bulk, shade(coat, -0.12), 'rgba(0,0,0,0.45)');
      capsule(ctx, sup.jx, sup.jy, sup.ex, sup.ey, 4.0 * bulk, coatLit, 'rgba(0,0,0,0.35)');
      circle(ctx, sup.ex, sup.ey, 2.5 * bulk, pal.glove || '#232a26');

      /* drawTorso after back arm */
      drawTorso(ctx, { coat: coat, coatLit: coatLit, coatDark: coatDark, vest: pal.vest,
        strap: pal.strap, pack: pal.pack, metal: pal.metal },
        { bulk: bulk, hunch: hunch }, kind);

      /* --- kit: belt, pouches, chest rig and shoulder pad --- */
      ctx.save();
      ctx.fillStyle = shade(coatDark, -0.16);
      roundRect(ctx, -7 * bulk, -26, 14 * bulk, 3.2, 1.4); ctx.fill();
      ctx.fillStyle = pal.accent;
      roundRect(ctx, -1.5, -26.2, 3, 3.6, 1); ctx.fill();
      ctx.fillStyle = shade(pal.vest || coat, -0.14);
      roundRect(ctx, -8.6 * bulk, -25, 3.4, 5, 1.2); ctx.fill();
      roundRect(ctx, 5.2 * bulk, -25, 3.4, 5, 1.2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.38)';
      ctx.lineWidth = 2.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-5, -42.5); ctx.lineTo(4.6 * bulk, -30); ctx.stroke();
      ctx.fillStyle = shade(coatLit, -0.05);
      ctx.beginPath();
      ctx.ellipse(5.6 * bulk, -42.6, 4.4 * bulk, 3.1 * bulk, -0.25, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.42)'; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      /* front arm holds the gun */
      capsule(ctx, shoulderX, shY, main.jx, main.jy, 5.4 * bulk, coat, 'rgba(0,0,0,0.5)');
      capsule(ctx, main.jx, main.jy, main.ex, main.ey, 4.2 * bulk, coatLit, 'rgba(0,0,0,0.35)');
      circle(ctx, main.ex, main.ey, 2.6 * bulk, pal.glove || '#232a26');

      /* head */
      hunterHead(ctx, { skin: skin, skinShade: skinShade, hair: pal.hair, accent: pal.accent,
        accentDark: pal.accentDark, metalDark: pal.metalDark }, {
        t: t, bulk: bulk, moving: moving, hunch: hunch
      });

      /* weapon in hand space */
      ctx.save();
      ctx.translate(gunHand.x, gunHand.y);
      ctx.rotate(localAim);
      var gscale = 0.84;
      ctx.scale(gscale, gscale * (facing > 0 ? 1 : 1));
      drawWeapon(ctx, o.weapon || 'gun', meta, 1, o.muzzle || 0,
        reload > 0 ? Math.sin(reload * Math.PI) * 4 : 0);
      ctx.restore();
    } else {
      /* ---- zombie arms reach forward ---- */
      var reachZ = (dead > 0 ? 12 : 15);
      var armA = localAim * 0.25 + wobble;
      var zx = Math.cos(armA) * reachZ, zy = Math.sin(armA) * reachZ - 4;
      var zsh = shoulderY + 2 + hunch * 3;
      var z1 = ik(-shoulderX, zsh, -shoulderX + zx * 0.9, zsh + zy, armLen, armLen, -1);
      var z2 = ik(shoulderX, zsh, shoulderX + zx, zsh + zy + 1.5, armLen, armLen, 1);
      var zskin = skin, zskS = skinShade;
      capsule(ctx, -shoulderX, zsh, z1.jx, z1.jy, 4.6 * bulk, coatDark);
      capsule(ctx, z1.jx, z1.jy, z1.ex, z1.ey, 3.8 * bulk, zskS);
      circle(ctx, z1.ex, z1.ey, 2.4 * bulk, zskin);

      drawTorso(ctx, { coat: coat, coatLit: coatLit, coatDark: coatDark },
        { bulk: bulk, hunch: hunch, variant: variant }, kind);

      capsule(ctx, shoulderX, zsh, z2.jx, z2.jy, 4.8 * bulk, coat);
      capsule(ctx, z2.jx, z2.jy, z2.ex, z2.ey, 4.0 * bulk, zskin);
      circle(ctx, z2.ex, z2.ey, 2.5 * bulk, zskin);
      /* clawed fingers */
      ctx.strokeStyle = zskS;
      ctx.lineWidth = 1.1;
      for (var f = -1; f <= 1; f++) {
        ctx.beginPath();
        ctx.moveTo(z2.ex, z2.ey);
        ctx.lineTo(z2.ex + 3.2, z2.ey + f * 1.8);
        ctx.stroke();
      }

      zombieHead(ctx, { skin: zskin, skinShade: zskS, bone: pal.bone, blood: pal.blood,
        tooth: pal.tooth, eye: pal.eye }, { t: t, bulk: bulk, hunch: hunch, moving: moving });

      /* brute/boss bone spurs growing out of the back */
      if (o.variant === 'boss' || o.variant === 'butcher' || o.variant === 'warden') {
        var bone = pal.bone || '#cfc7ae';
        for (var k = 0; k < 3; k++) {
          var bx = -6.5 + k * 3.1;
          var by = -37 + bob - k * 1.4;
          ctx.fillStyle = bone;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - 2.6, by + 1.4);
          ctx.lineTo(bx - 3.4, by - 6.2);
          ctx.closePath();
          ctx.fill();
        }
        /* exposed shoulder blade */
        ctx.fillStyle = 'rgba(207,199,174,0.75)';
        ctx.beginPath();
        ctx.arc(-shoulderX - 1, shoulderY + 4, 2.6 * bulk, 0, TAU);
        ctx.fill();
      }
    }

    /* red hurt rim */
    if (hurt > 0.01) {
      ctx.globalAlpha = alpha * hurt * 0.5;
      ctx.strokeStyle = '#ff3b23';
      ctx.lineWidth = 2;
      roundRect(ctx, -9 * bulk, -50, 18 * bulk, 50, 8);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    ctx.restore();
  }

  /** Small icon of a hunter head for menus / avatars. */
  function portrait(ctx, x, y, scale, variant) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    hunterHead(ctx, HUNTER, { t: 0, bulk: 1, moving: 0 }, { variant: variant });
    ctx.restore();
  }

  ZH.Rig = {
    draw: draw,
    portrait: portrait,
    HUNTER: HUNTER,
    CHARACTERS: CHARACTER_PALETTES,
    paletteFor: paletteFor,
    ZOMBIES: ZOMBIES,
    GUNS: GUNS,
    shade: shade,
    lerp: lerp,
    clamp: clamp
  };
  /* node test hook */
  if (typeof module !== 'undefined' && module.exports) module.exports = ZH.Rig;
})(typeof window !== 'undefined' ? window.ZH || (window.ZH = {}) : {});
