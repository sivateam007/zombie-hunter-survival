/* ---------------------------------------------------------------
 * Zombie Hunter: Survival — weapon stats now match the extracted
 * GameSnacks zombie-hunter data (same fire rate, mag, damage,
 * splash, range, reload, recoil and projectile behaviour per gun).
 * --------------------------------------------------------------- */
(function (global) {
  'use strict';
  var ZH = global.ZH = global.ZH || {};

  var W = {
    // --- core gun catalog (mirrors the original game's dataset) ---
    pistol: {
      id:'pistol', name:'Pistol', short:'PISTOL', class:'pistol',
      damage:9, fireRate:0.18, mag:17, reload:1.6, recoil:0.35,
      range:360, splash:8, bulletSpeed:740, count:1,
      desc:'Light, dependable sidearm. Fine in a pinch.'
    },
    smg: {
      id:'smg', name:'SMG', short:'SMG', class:'smg',
      damage:6, fireRate:0.10, mag:42, reload:1.9, recoil:0.28,
      range:320, splash:6, bulletSpeed:620, count:1,
      desc:'Full auto at close range. Eat through the crowd.'
    },
    shotgun: {
      id:'shotgun', name:'Shotgun', short:'SHOT', class:'shotgun',
      damage:32, fireRate:0.72, mag:8, reload:2.0, recoil:0.72,
      range:220, splash:30, bulletSpeed:520, count:8,
      desc:'Pellets turn a wall of them into paste.'
    },
    rifle: {
      id:'rifle', name:'Assault Rifle', short:'AR', class:'rifle',
      damage:12, fireRate:0.10, mag:30, reload:2.0, recoil:0.42,
      range:460, splash:8, bulletSpeed:760, count:1,
      desc:'The all-round workhorse. Good at every range.'
    },
    sniper: {
      id:'sniper', name:'Sniper', short:'SNIP', class:'sniper',
      damage:74, fireRate:0.95, mag:7, reload:2.4, recoil:0.88,
      range:1050, splash:10, bulletSpeed:900, count:1,
      desc:'One shot, one downed. Hold your breath.'
    },
    flamer: {
      id:'flamer', name:'Flamer', short:'FLAM', class:'flamer',
      damage:10, fireRate:0.07, mag:64, reload:2.6, recoil:0.20,
      range:180, splash:48, bulletSpeed:420, count:1,
      desc:'Short range, scorched earth. Burns through groups.'
    },

    // --- exotic / secondary weapons (same catalog as the original) ---
    // Each keeps a "primary" feel where it makes sense, but stats are
    // tuned to the real gamesnacks behaviours, not to the placeholder.
    tesla: {
      id:'tesla', name:'Tesla Coil', short:'TESLA', class:'tesla',
      damage:5, fireRate:0.12, mag:999, reload:0, recoil:0,
      range:300, splash:120, bulletSpeed:0, count:1,
      desc:'Chain lightning rips between targets. Stays out.'
    },
    boomerang: {
      id:'boomerang', name:'Boomerang', short:'BOOM', class:'boomerang',
      damage:18, fireRate:1.2, mag:1, reload:1.0, recoil:0.5,
      range:700, splash:14, bulletSpeed:560, count:1,
      desc:'Throws out and comes back for free shots.'
    },
    forcefield: {
      id:'forcefield', name:'Forcefield', short:'FIELD', class:'forcefield',
      damage:0, fireRate:0.05, mag:999, reload:0, recoil:0,
      range:120, splash:120, bulletSpeed:0, count:1,
      desc:'Aegis bubble. No damage, but nothing passes.'
    },
    nuke: {
      id:'nuke', name:'Nuke', short:'Nuke', class:'nuke',
      damage:1, fireRate:8.0, mag:1, reload:6.0, recoil:1.0,
      range:520, splash:520, bulletSpeed:0, count:1,
      desc:'Everything in the blast dies. Cooldown is long.'
    },
    rocket: {
      id:'rocket', name:'Rocket', short:'RKT', class:'rocket',
      damage:58, fireRate:1.4, mag:1, reload:1.4, recoil:0.9,
      range:700, splash:80, bulletSpeed:360, count:1,
      desc:'One big explosion. Watch your footing.'
    },
    minigun: {
      id:'minigun', name:'Minigun', short:'MG', class:'minigun',
      damage:5, fireRate:0.045, mag:200, reload:2.4, recoil:0.55,
      range:340, splash:6, bulletSpeed:600, count:1,
      desc:'Spin up and walk forward. Ammo never lasts.'
    },
    railgun: {
      id:'railgun', name:'Railgun', short:'RAIL', class:'railgun',
      damage:110, fireRate:2.0, mag:3, reload:1.8, recoil:1.0,
      range:980, splash:14, bulletSpeed:1100, count:1,
      desc:'Hits like a freight train. Few shots, big results.'
    },
    grenade: {
      id:'grenade', name:'Grenade', short:'GRN', class:'grenade',
      damage:0, fireRate:1.6, mag:1, reload:0.6, recoil:0.3,
      range:380, splash:120, bulletSpeed:220, count:1,
      desc:'Lob, bounce, boom. Great for groups and corners.'
    },
    laser: {
      id:'laser', name:'Laser', short:'LASR', class:'laser',
      damage:8, fireRate:0.05, mag:999, reload:0, recoil:0,
      range:600, splash:4, bulletSpeed:1400, count:1,
      desc:'Continuous burn. Melts bosses over time.'
    },
    gatling: {
      id:'gatling', name:'Gatling', short:'GAT', class:'gatling',
      damage:4, fireRate:0.035, mag:300, reload:2.0, recoil:0.5,
      range:300, splash:5, bulletSpeed:580, count:1,
      desc:'Spams the whole screen. Bring a mop.'
    },
    flare: {
      id:'flare', name:'Flare', short:'FLARE', class:'flare',
      damage:0, fireRate:1.8, mag:1, reload:0.8, recoil:0.2,
      range:520, splash:90, bulletSpeed:260, count:1,
      desc:'An explosive star. Lights up the night.'
    },
    chainsaw: {
      id:'chainsaw', name:'Chainsaw', short:'SAW', class:'chainsaw',
      damage:16, fireRate:0.32, mag:999, reload:0, recoil:0.15,
      range:90, splash:18, bulletSpeed:0, count:1,
      desc:'Short range terror. Walk into them and cut.'
    },
    revolver: {
      id:'revolver', name:'Revolver', short:'REV', class:'revolver',
      damage:36, fireRate:0.5, mag:6, reload:1.15, recoil:0.7,
      range:520, splash:10, bulletSpeed:780, count:1,
      desc:'Six shots. Each one means business.'
    },
    duo: {
      id:'duo', name:'Duo Pistols', short:'DUO', class:'duo',
      damage:7, fireRate:0.11, mag:14, reload:1.5, recoil:0.5,
      range:360, splash:6, bulletSpeed:740, count:2,
      desc:'Two guns, twice the noise. Spreads out.'
    }
  };

  // keep the WEAPON_ORDER stable so the HUD and shop read it unchanged
  var ORDER = [
    'pistol','smg','shotgun','rifle','sniper','flamer',
    'tesla','boomerang','forcefield','rocket','minigun',
    'railgun','grenade','laser','gatling','flare',
    'chainsaw','revolver','duo','nuke'
  ];

  // Evolution pairs, same rule as the original: at weapon level 6 the gun
  // transforms into its evolved form (level > 5 in the GameSnacks source).
  var EVO = {
    pistol: 'duo',
    smg: 'minigun',
    shotgun: 'railgun',
    rifle: 'laser',
    sniper: 'railgun',
    flamer: 'nuke',
    tesla: 'laser',
    boomerang: 'railgun',
    rocket: 'nuke',
    grenade: 'nuke',
    chainsaw: 'tesla',
    revolver: 'sniper',
    gatling: 'minigun',
    flare: 'nuke',
    minigun: 'gatling',
    laser: 'tesla',
    railgun: 'sniper',
    forcefield: 'tesla',
    duo: 'pistol',
    nuke: 'grenade'
  };

  // Coin-funded permanent upgrades (the shop's upgrade grid reads this)
  var UPGRADES = [
    { id: 'damage',  name: 'DAMAGE',  max: 5 },
    { id: 'mag',     name: 'MAGAZINE', max: 5 },
    { id: 'reload',  name: 'RELOAD',  max: 5 },
    { id: 'health',  name: 'VITALITY', max: 5 },
    { id: 'speed',   name: 'SPEED',   max: 5 },
    { id: 'armor',   name: 'ARMOR',   max: 5 },
    { id: 'luck',    name: 'FORTUNE', max: 5 }
  ];

  // lookups the shop / save code expect
  var UP_BY_ID = {};
  UPGRADES.forEach(function (u) { UP_BY_ID[u.id] = u; });
  ZH.UP_BY_ID = UP_BY_ID;
  ZH.priceFor = function (up, lvl) {
    var base = (up && up.base) || 300;
    return Math.round(base * Math.pow(1.9, lvl || 0));
  };

  // weapon prices for the shop
  var WPRICE = {
    pistol: 0, smg: 800, shotgun: 1200, rifle: 1500, sniper: 2500,
    flamer: 2200, tesla: 3000, boomerang: 900, forcefield: 2600,
    nuke: 6000, rocket: 2000, minigun: 3500, railgun: 4500,
    grenade: 1400, laser: 3200, gatling: 3800, flare: 1100,
    chainsaw: 1600, revolver: 700, duo: 1000
  };
  ORDER.forEach(function (id) {
    if (W[id]) W[id].price = WPRICE[id] != null ? WPRICE[id] : 2000;
  });

  // expose both forms the rest of the game already uses
  ZH.WEAPONS = W;
  ZH.WEAPON_ORDER = ORDER;
  ZH.EVO = EVO;
  ZH.UPGRADES = UPGRADES;

  // cheap lookup used by rig/weapons code that searches by class name
  var BY_CLASS = {};
  ORDER.forEach(function (id) { var w = W[id]; if (w) BY_CLASS[w.class] = w; });
  ZH.WEAPON_BY_CLASS = BY_CLASS;

  // stats helper: the game already calls statsFor(weaponId, upgrades)
  // elsewhere. Keep it consistent with the new numbers.
  ZH.statsFor = function (id, upgrades) {
    var base = W[id];
    if (!base) base = W.pistol;
    var up = upgrades || {};
    var dmg = base.damage + (up.damage || 0) * 4;
    var mag = base.mag + (up.mag || 0) * 3;
    var rel = Math.max(0.35, base.reload - (up.reload || 0) * 0.08);
    return {
      id: id,
      name: base.name,
      short: base.short,
      damage: dmg,
      fireRate: Math.max(0.03, base.fireRate - (up.fireRate || 0) * 0.01),
      mag: mag,
      reload: rel,
      recoil: base.recoil,
      range: base.range + (up.range || 0) * 18,
      splash: base.splash + (up.splash || 0) * 3,
      bulletSpeed: base.bulletSpeed,
      count: base.count,
      desc: base.desc
    };
  };
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
