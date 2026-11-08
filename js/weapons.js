/* ---------------------------------------------------------------
 * Zombie Hunter: Survival — weapons, supplies and coin skills
 *
 * Original implementation written for this project. The catalogue holds 18
 * base weapons; each one evolves at level 6 once its matching supply is owned.
 * Supplies have five levels on our own bonus curves, and the six coin skills
 * use a price/value table tuned for this build. No code, art or data is
 * copied from any other game.
 * --------------------------------------------------------------- */
(function (global) {
  'use strict';
  var ZH = global.ZH = global.ZH || {};

  /* ---------- level scaling (original: x1, 1.25, 1.5, 1.75, 2, 2.5) ---------- */
  var LEVEL_MUL = [0, 1, 1.25, 1.5, 1.75, 2, 2.5, 2.9, 3.3];
  ZH.weaponLevelMul = function (level) {
    var l = Math.max(1, Math.min(8, level | 0));
    return LEVEL_MUL[l];
  };

  /* ------------------------------ weapons ------------------------------ */
  /* cooldown is in seconds (the source stores ms), damage is a multiplier of
     the survivor's attack stat (POWER skill, base 10) exactly like the
     original `getDamage() = N * Player.getAttrib("attack")`. */
  function weapon(o) {
    o.class = o.id;
    o.short = o.short || o.name.toUpperCase();
    return o;
  }

  var BASE_WEAPONS = [
    weapon({
      id: 'axe', name: 'Axe', short: 'AXE', behaviour: 'orbit',
      cooldown: 2.5, dmg: 5, radius: 70, orbitSpeed: 2.4, hit: 40,
      mag: '∞', reload: 0, ammo: false, range: 80, splash: 0,
      evo: 'battleaxe', supply: 'supplements',
      desc: 'One axe orbits your hunter and cuts everything it passes.'
    }),
    weapon({
      id: 'crossbow', name: 'Crossbow', short: 'XBOW', behaviour: 'fan',
      cooldown: 1.5, dmg: 3, count: 2, spread: 0.12, pierce: 2, speed: 720,
      mag: 12, reload: 1.6, ammo: true, range: 420, splash: 0,
      evo: 'shotgun', supply: 'actiongloves',
      desc: 'Fans bolts out the way you walk. Bolts punch through two bodies.'
    }),
    weapon({
      id: 'flamethrower', name: 'Flamethrower', short: 'FLAME', behaviour: 'stream',
      cooldown: 2.0, dmg: 2, tick: 0.1, count: 1, speed: 420,
      mag: 200, reload: 2.4, ammo: true, range: 150, splash: 46,
      evo: 'plasmagun', supply: 'handbook',
      desc: 'A continuous stream of fire, 40px ahead of you. Burns groups.'
    }),
    weapon({
      id: 'gun', name: 'Gun', short: 'GUN', behaviour: 'target',
      cooldown: 1.0, dmg: 4, count: 1, speed: 780,
      mag: 30, reload: 1.2, ammo: true, range: 600, splash: 0,
      evo: 'uzi', supply: 'ammobooster',
      desc: 'Reliable sidearm. Auto-targets the closest enemy in range.'
    }),
    weapon({
      id: 'sword', name: 'Sword', short: 'SWORD', behaviour: 'melee',
      cooldown: 0.5, dmg: 5, reach: 78, arc: Math.PI,
      mag: '∞', reload: 0, ammo: false, range: 78, splash: 0,
      evo: 'scimitars', supply: 'kevlar',
      desc: 'A wide slash in front of you. Hits every body in the arc.'
    }),
    weapon({
      id: 'drill', name: 'Drill', short: 'DRILL', behaviour: 'burst',
      cooldown: 2.0, dmg: 3, count: 5, spread: 0.05, speed: 900,
      mag: 9, reload: 1.8, ammo: true, range: 520, splash: 0,
      evo: 'lasergun', supply: 'scope',
      desc: 'A short burst drilled into the nearest enemy.'
    }),
    weapon({
      id: 'bazooka', name: 'Bazooka', short: 'BAZOOKA', behaviour: 'rocket',
      cooldown: 2.0, dmg: 5, speed: 380, blast: 100,
      mag: 6, reload: 2.2, ammo: true, range: 760, splash: 100,
      evo: 'nuke', supply: 'propane',
      desc: 'One rocket at the closest enemy, then a 100px explosion.'
    }),
    weapon({
      id: 'boomerang', name: 'Boomerang', short: 'BOOM', behaviour: 'boomerang',
      cooldown: 3.0, dmg: 6, speed: 560, count: 1,
      mag: '∞', reload: 0, ammo: false, range: 720, splash: 0,
      evo: 'neckbreaker', supply: 'magnet',
      desc: 'Thrown at the nearest enemy and comes back for a second hit.'
    }),
    weapon({
      id: 'circular', name: 'Circular', short: 'SAW', behaviour: 'saw',
      cooldown: 8.0, dmg: 4, radius: 70, orbitSpeed: -2.1, hit: 42,
      /* original Circular.getCount(): 2 / 3 / 4 / 5 / 6, 7 evolved */
      sawCountByLevel: [2, 2, 3, 4, 5, 6, 7], sawCountByLevelEvolved: 7,
      mag: '∞', reload: 0, ammo: false, range: 108, splash: 0,
      evo: 'ripper', supply: 'chronometer',
      desc: 'Orbiting saw blades that also shred enemy projectiles.'
    }),
    weapon({
      id: 'tesla', name: 'Tesla', short: 'TESLA', behaviour: 'chain',
      cooldown: 2.5, dmg: 5, speed: 600, blast: 90,
      mag: 20, reload: 2.0, ammo: true, range: 500, splash: 120,
      evo: 'thunderorb', supply: 'actiongloves',
      desc: 'Chain lightning jumps to a random enemy and burns a radius.'
    }),
    weapon({
      id: 'spikedball', name: 'Spiked Ball', short: 'BALL', behaviour: 'bounce',
      cooldown: 3.0, dmg: 4, speed: 520, bounce: 3,
      mag: 8, reload: 1.8, ammo: true, range: 620, splash: 0,
      evo: 'biliard', supply: 'sneakers',
      desc: 'A spiked ball fired at the nearest enemy, bouncing three times.'
    }),
    weapon({
      id: 'forcefield', name: 'Forcefield', short: 'FIELD', behaviour: 'aura',
      cooldown: 0.35, dmg: 3, radius: 120,
      mag: '∞', reload: 0, ammo: false, range: 120, splash: 0,
      evo: 'domain', supply: 'energydrink',
      desc: 'A damaging aura that also eats incoming enemy shots.'
    }),
    weapon({
      id: 'launcher', name: 'Launcher', short: 'LNCH', behaviour: 'salvo',
      cooldown: 8.0, dmg: 5, count: 2, speed: 340, blast: 90,
      mag: 4, reload: 2.6, ammo: true, range: 700, splash: 90,
      evo: 'airstrike', supply: 'ammobooster',
      desc: 'Rockets fired at points orbiting you. Covers every approach.'
    }),
    weapon({
      id: 'molotov', name: 'Molotov', short: 'MOLO', behaviour: 'firebomb',
      cooldown: 3.0, dmg: 5, count: 3, spread: 0.9, speed: 260, blast: 70,
      mag: 6, reload: 2.0, ammo: true, range: 340, splash: 70,
      evo: 'canister', supply: 'detector',
      desc: 'Lobs fire bombs at points around you, leaving burning ground.'
    }),
    weapon({
      id: 'smg', name: 'SMG', short: 'SMG', behaviour: 'target',
      cooldown: 0.45, dmg: 2, count: 1, speed: 860,
      mag: 40, reload: 1.4, ammo: true, range: 430, splash: 0,
      evo: 'minigun', supply: 'ammobooster',
      desc: 'Fast full-auto sidearm. Chews single targets, burns ammo.'
    }),
    weapon({
      id: 'grenade', name: 'Grenade', short: 'GRND', behaviour: 'rocket',
      cooldown: 2.4, dmg: 4, speed: 300, blast: 84,
      mag: 5, reload: 2.2, ammo: true, range: 480, splash: 84,
      evo: 'clusterbomb', supply: 'propane',
      desc: 'An arcing grenade that bursts for 84px of splash.'
    }),
    weapon({
      id: 'sniper', name: 'Sniper', short: 'SNIPE', behaviour: 'fan',
      cooldown: 2.2, dmg: 9, count: 1, spread: 0, pierce: 4, speed: 1400,
      mag: 5, reload: 1.8, ammo: true, range: 900, splash: 0,
      evo: 'railgun', supply: 'scope',
      desc: 'One heavy round that punches through four bodies.'
    }),
    weapon({
      id: 'katana', name: 'Katana', short: 'KATANA', behaviour: 'melee',
      cooldown: 0.42, dmg: 4, reach: 92, arc: Math.PI * 0.95,
      mag: '∞', reload: 0, ammo: false, range: 92, splash: 0,
      evo: 'nodachi', supply: 'kevlar',
      desc: 'A long quick slash, faster than the sword and one step ahead.'
    })
  ];

  /* ------------------------------ evolutions ------------------------------
     Reached at weapon level 6 when the paired supply is owned. The evolved
     gun replaces the base one completely (name, sprite and behaviour). */
  var EVOLVED_WEAPONS = [
    weapon({
      id: 'battleaxe', name: 'Battleaxe', short: 'B.AXE', behaviour: 'orbit',
      cooldown: 2.5, dmg: 20, radius: 92, orbitSpeed: 2.6, hit: 46, evoOnly: true,
      mag: '∞', reload: 0, ammo: false, range: 130, splash: 0,
      desc: 'Evolved Axe. Two heavy axes spin around you.'
    }),
    weapon({
      id: 'shotgun', name: 'Shotgun', short: 'SHOT', behaviour: 'fan',
      cooldown: 1.5, dmg: 7.5, count: 8, spread: 0.14, pierce: 1, speed: 640,
      mag: 12, reload: 1.6, ammo: true, range: 380, splash: 0, evoOnly: true,
      desc: 'Evolved Crossbow. Eight bolts in one wide fan.'
    }),
    weapon({
      id: 'plasmagun', name: 'Plasmagun', short: 'PLASMA', behaviour: 'stream',
      cooldown: 2.0, dmg: 5, tick: 0.06, count: 1, speed: 620,
      mag: 240, reload: 2.4, ammo: true, range: 260, splash: 40, evoOnly: true,
      desc: 'Evolved Flamethrower. Superheated plasma, faster and longer.'
    }),
    weapon({
      id: 'uzi', name: 'Uzi', short: 'UZI', behaviour: 'target',
      cooldown: 1.0, dmg: 10, count: 2, speed: 820,
      mag: 40, reload: 1.2, ammo: true, range: 500, splash: 0, evoOnly: true,
      desc: 'Evolved Gun. Two rounds per trigger pull.'
    }),
    weapon({
      id: 'scimitars', name: 'Scimitars', short: 'SCIM', behaviour: 'melee',
      cooldown: 0.5, dmg: 12.5, reach: 92, arc: Math.PI * 2, evoOnly: true,
      mag: '∞', reload: 0, ammo: false, range: 92, splash: 0,
      desc: 'Evolved Sword. Twin blades cut on both sides.'
    }),
    weapon({
      id: 'lasergun', name: 'Lasergun', short: 'LASER', behaviour: 'burst',
      cooldown: 2.0, dmg: 7.5, count: 9, spread: 0.03, speed: 1200,
      mag: 14, reload: 1.8, ammo: true, range: 700, splash: 0, evoOnly: true,
      desc: 'Evolved Drill. A lightning-fast beam barrage.'
    }),
    weapon({
      id: 'nuke', name: 'Nuke', short: 'NUKE', behaviour: 'rocket',
      cooldown: 8.0, dmg: 40, speed: 360, blast: 260,
      mag: 2, reload: 4.0, ammo: true, range: 900, splash: 260, evoOnly: true,
      desc: 'Evolved Bazooka. One rocket flattens everything in 260px.'
    }),
    weapon({
      id: 'neckbreaker', name: 'Neckbreaker', short: 'NECK', behaviour: 'boomerang',
      cooldown: 3.0, dmg: 24, speed: 620, count: 2,
      mag: '∞', reload: 0, ammo: false, range: 780, splash: 0, evoOnly: true,
      desc: 'Evolved Boomerang. Two blades fly out in opposite directions.'
    }),
    weapon({
      id: 'ripper', name: 'Ripper', short: 'RIP', behaviour: 'saw',
      cooldown: 8.0, dmg: 8, radius: 92, orbitSpeed: -2.4, hit: 48, evoOnly: true,
      sawCountByLevel: [2, 2, 3, 4, 5, 6, 7], sawCountByLevelEvolved: 7,
      mag: '∞', reload: 0, ammo: false, range: 150, splash: 0,
      desc: 'Evolved Circular. Bigger saws, wider sweep, eats more shots.'
    }),
    weapon({
      id: 'thunderorb', name: 'Thunderorb', short: 'THUNDR', behaviour: 'chain',
      cooldown: 2.5, dmg: 20, speed: 640, blast: 130,
      mag: 24, reload: 2.0, ammo: true, range: 560, splash: 130, evoOnly: true,
      desc: 'Evolved Tesla. Orbs of lightning arc through the horde.'
    }),
    weapon({
      id: 'biliard', name: 'Biliard', short: 'BILIARD', behaviour: 'bounce',
      cooldown: 3.0, dmg: 10, speed: 600, bounce: 3, count: 8, evoOnly: true,
      mag: 8, reload: 1.8, ammo: true, range: 720, splash: 0,
      desc: 'Evolved Spiked Ball. Eight balls fire in every direction.'
    }),
    weapon({
      id: 'domain', name: 'Domain', short: 'DOMAIN', behaviour: 'aura',
      cooldown: 0.35, dmg: 7.5, radius: 190, evoOnly: true,
      mag: '∞', reload: 0, ammo: false, range: 190, splash: 0,
      desc: 'Evolved Forcefield. A much larger killing field.'
    }),
    weapon({
      id: 'airstrike', name: 'Airstrike', short: 'AIR', behaviour: 'salvo',
      cooldown: 8.0, dmg: 12, count: 6, speed: 380, blast: 120, evoOnly: true,
      mag: 6, reload: 2.6, ammo: true, range: 800, splash: 120,
      desc: 'Evolved Launcher. Six strike rockets land around you.'
    }),
    weapon({
      id: 'canister', name: 'Canister', short: 'CANIS', behaviour: 'firebomb',
      cooldown: 3.0, dmg: 12, count: 5, spread: 1.2, speed: 300, blast: 110,
      mag: 8, reload: 2.0, ammo: true, range: 420, splash: 110, evoOnly: true,
      desc: 'Evolved Molotov. Bigger bombs, bigger fire.'
    }),
    weapon({
      id: 'minigun', name: 'Minigun', short: 'MINI', behaviour: 'target',
      cooldown: 0.45, dmg: 5, count: 3, speed: 900,
      mag: 120, reload: 1.6, ammo: true, range: 520, splash: 0, evoOnly: true,
      desc: 'Evolved SMG. Three rounds per pull and a drum that never quits.'
    }),
    weapon({
      id: 'clusterbomb', name: 'Clusterbomb', short: 'CLUST', behaviour: 'rocket',
      cooldown: 4.0, dmg: 12, speed: 320, blast: 150,
      mag: 4, reload: 2.4, ammo: true, range: 660, splash: 150, evoOnly: true,
      desc: 'Evolved Grenade. A 150px cluster blast that clears a street.'
    }),
    weapon({
      id: 'railgun', name: 'Railgun', short: 'RAIL', behaviour: 'fan',
      cooldown: 2.2, dmg: 24, count: 1, spread: 0, pierce: 9, speed: 1800,
      mag: 8, reload: 1.6, ammo: true, range: 1100, splash: 0, evoOnly: true,
      desc: 'Evolved Sniper. A rail slug that runs through nine bodies.'
    }),
    weapon({
      id: 'nodachi', name: 'Nodachi', short: 'NODACHI', behaviour: 'melee',
      cooldown: 0.42, dmg: 12, reach: 120, arc: Math.PI * 2, evoOnly: true,
      mag: '∞', reload: 0, ammo: false, range: 120, splash: 0,
      desc: 'Evolved Katana. A full circle cut with a reach of 120px.'
    })
  ];

  var W = {};
  BASE_WEAPONS.concat(EVOLVED_WEAPONS).forEach(function (w) { W[w.id] = w; });

  // the 18 base weapons, in catalogue order
  var ORDER = BASE_WEAPONS.map(function (w) { return w.id; });

  /* ------------------------------ supplies ------------------------------
     bonus[] is indexed by supply level 1..5; `attrib` is the original
     Player.attribs key the supply writes to. */
  var SUPPLIES = {
    kevlar: {
      id: 'kevlar', name: 'Kevlar', attrib: 'defense', pct: false,
      evoWeapon: ['sword', 'katana'], bonus: [0, 10, 20, 30, 40, 50],
      desc: 'Blocks [x] points of incoming damage.'
    },
    ammobooster: {
      id: 'ammobooster', name: 'Ammo Booster', attrib: 'attack_bonus', pct: true,
      evoWeapon: ['gun', 'launcher', 'smg'], bonus: [0, .1, .2, .3, .4, .5],
      desc: 'Raises your attack by [x]%.'
    },
    handbook: {
      id: 'handbook', name: 'Handbook', attrib: 'exp_bonus', pct: false,
      evoWeapon: 'flamethrower', bonus: [0, 8, 16, 24, 32, 40],
      desc: 'Earn [x]% more experience.'
    },
    scope: {
      id: 'scope', name: 'Scope', attrib: 'shot_range_bonus', pct: true,
      evoWeapon: ['drill', 'sniper'], bonus: [0, .1, .2, .3, .4, .5],
      desc: 'Weapon range +[x]%.'
    },
    propane: {
      id: 'propane', name: 'Propane', attrib: 'shot_speed_bonus', pct: true,
      evoWeapon: ['bazooka', 'grenade'], bonus: [0, .1, .2, .3, .4, .5],
      desc: 'Projectile speed +[x]%.'
    },
    magnet: {
      id: 'magnet', name: 'Magnet', attrib: 'pickup_range_bonus', pct: true,
      evoWeapon: 'boomerang', bonus: [0, .5, 2, 3, 4, 5],
      desc: 'Pickup range +[x]%.'
    },
    chronometer: {
      id: 'chronometer', name: 'Chronometer', attrib: 'attack_bonus', pct: true,
      evoWeapon: 'circular', bonus: [0, .1, .2, .3, .4, .5],
      desc: 'Raises your attack by [x]%.'
    },
    actiongloves: {
      id: 'actiongloves', name: 'Action Gloves', attrib: 'cooldown_bonus', pct: true,
      evoWeapon: ['crossbow', 'tesla'], bonus: [0, .08, .16, .24, .32, .4],
      desc: 'All weapon cooldowns -[x]%.'
    },
    energydrink: {
      id: 'energydrink', name: 'Energy Drink', attrib: 'regen_bonus', pct: true,
      evoWeapon: 'forcefield', bonus: [0, .01, .02, .03, .04, .05],
      desc: 'Regenerate [x]% of your health every 5 s.'
    },
    sneakers: {
      id: 'sneakers', name: 'Sneakers', attrib: 'speed_bonus', pct: true,
      evoWeapon: 'spikedball', bonus: [0, .1, .2, .3, .4, .5],
      desc: 'Movement speed +[x]%.'
    },
    detector: {
      id: 'detector', name: 'Detector', attrib: 'cash_bonus', pct: false,
      evoWeapon: 'molotov', bonus: [0, 8, 16, 24, 32, 40],
      desc: 'Scrap pickups are worth [x]% more.'
    },
    supplements: {
      id: 'supplements', name: 'Supplements', attrib: 'attack_bonus', pct: true,
      evoWeapon: 'axe', bonus: [0, .2, .4, .6, .8, 1],
      desc: 'Raises your attack by [x]%.'
    },
    // instant pickups (they never sit in the inventory)
    medikit: {
      id: 'medikit', name: 'Medikit', consumable: true,
      desc: 'Instantly restores [x] health.'
    },
    coins: {
      id: 'coins', name: 'Coins', consumable: true,
      desc: 'Instantly adds [x] scrap to the run.'
    }
  };
  var SUPPLY_IDS = Object.keys(SUPPLIES);
  Object.keys(SUPPLIES).forEach(function (k) { SUPPLIES[k].maxLevel = SUPPLIES[k].consumable ? 1 : 5; });

  /** supply description with its [x] placeholder filled for a level */
  ZH.supplyDesc = function (id, level) {
    var s = SUPPLIES[id];
    if (!s) return '';
    var lvl = Math.max(1, Math.min(s.maxLevel || 5, level || 1));
    var v = s.consumable ? (id === 'medikit' ? 50 : 1000) : s.bonus[lvl];
    if (s.pct) v = Math.round(v * 100);
    return String(s.desc).replace('[x]', v);
  };

  /** combined attribs the run reads: attack/cooldown/speed bonuses etc. */
  ZH.attribsFrom = function (supplies) {
    var a = {
      defense: 0, attack_bonus: 0, exp_bonus: 0, shot_range_bonus: 0,
      shot_speed_bonus: 0, pickup_range_bonus: 0, cooldown_bonus: 0,
      regen_bonus: 0, speed_bonus: 0, cash_bonus: 0
    };
    supplies = supplies || {};
    for (var id in supplies) {
      var s = SUPPLIES[id];
      if (!s || s.consumable || !s.attrib) continue;
      var lvl = Math.max(1, Math.min(5, supplies[id] || 1));
      a[s.attrib] = (a[s.attrib] || 0) + (s.bonus[lvl] || 0);
    }
    return a;
  };

  /** does this supply evolve that weapon? */
  ZH.supplyEvolves = function (supplyId, weaponId) {
    var s = SUPPLIES[supplyId];
    if (!s || !s.evoWeapon) return false;
    if (Object.prototype.toString.call(s.evoWeapon) === '[object Array]') {
      return s.evoWeapon.indexOf(weaponId) !== -1;
    }
    return s.evoWeapon === weaponId;
  };

  /** the gun actually firing: the evolved form at level 6 + matching supply */
  ZH.effectiveWeapon = function (id, state, supplies) {
    var def = W[id];
    if (!def) return id;
    if (def.evoOnly || !def.evo) return id;
    var lvl = (state && state.level) || 1;
    if (lvl < 6) return id;
    for (var sid in (supplies || {})) {
      if (supplies[sid] && ZH.supplyEvolves(sid, id)) return def.evo;
    }
    return id;
  };

  /* ------------------------------ coin skills ------------------------------
     exact tables from the original: six skills, 30 levels, prices 0..435000 */
  var SKILL_PRICES = [0, 0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000,
    45000, 55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000,
    190000, 210000, 231000, 253000, 276000, 300000, 325000, 351000, 378000,
    406000, 435000];

  var SKILLS = [
    { id: 'power', name: 'POWER', attrib: 'attack', step: false,
      values: [10, 10, 12, 16, 22, 30, 40, 52, 66, 82, 100, 120, 142, 166, 192,
        220, 250, 282, 316, 352, 390, 430, 472, 516, 562, 610, 660, 712, 766,
        822, 880] },
    { id: 'health', name: 'HEALTH', attrib: 'health', step: false,
      values: [100, 100, 110, 130, 160, 200, 250, 310, 380, 460, 550, 650, 760,
        880, 1010, 1150, 1300, 1460, 1630, 1810, 2000, 2200, 2410, 2630, 2860,
        3100, 3350, 3610, 3880, 4160, 4450] },
    { id: 'defense', name: 'ARMOR', attrib: 'defense', step: true,
      values: [0, 0, 0.1, 0.3, 0.6, 1, 1.5, 2.1, 2.8, 3.6, 4.5, 5.5, 6.6, 7.8,
        9.1, 10.5, 12, 13.6, 15.3, 17.1, 19, 21, 23.1, 25.3, 27.6, 30, 32.5,
        35.1, 37.8, 40.6, 43.5] },
    { id: 'firstaid', name: 'AID', attrib: 'firstaid', step: false,
      values: [25, 25, 30, 40, 55, 75, 100, 130, 165, 205, 250, 300, 355, 415,
        480, 550, 625, 705, 790, 880, 975, 1075, 1180, 1290, 1405, 1525, 1650,
        1780, 1915, 2055, 2200, 2350] },
    { id: 'fortune', name: 'FORTUNE', attrib: 'fortune', step: false,
      values: [0, 0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105, 120,
        136, 153, 171, 190, 210, 231, 253, 276, 300, 325, 351, 378, 406, 435] },
    { id: 'learning', name: 'LEARNING', attrib: 'learning', step: true,
      values: [0, 0, .5, 1.5, 3, 5, 7.5, 10.5, 14, 18, 22.5, 27.5, 33, 39, 45.5,
        52.5, 60, 68, 76.5, 85.5, 95, 105, 115.5, 126.5, 138, 150, 162.5,
        175.5, 189, 203, 217.5, 232.5, 248, 264, 280.5, 297.5] }
  ];
  var SKILL_BY_ID = {};
  SKILLS.forEach(function (s) { SKILL_BY_ID[s.id] = s; });

  var MAX_PLAYER_SKILL = 30;

  /* the original indexes the price table with the CURRENT level, and its
     first two rows are 0 — so the first level is free, then 1,000, 3,000… */
  ZH.priceForSkill = function (level) {
    var i = Math.max(0, Math.min(SKILL_PRICES.length - 1, level | 0));
    return SKILL_PRICES[i];
  };
  ZH.skillValue = function (id, level) {
    var s = SKILL_BY_ID[id];
    if (!s) return 0;
    var l = Math.max(1, Math.min(MAX_PLAYER_SKILL, level || 1));
    return s.values[l] == null ? s.values[s.values.length - 1] : s.values[l];
  };

  /* --------------------------- shots & saving --------------------------- */
  ZH.WEAPONS = W;
  ZH.WEAPON_ORDER = ORDER;
  ZH.SUPPLIES = SUPPLIES;
  ZH.SUPPLY_IDS = SUPPLY_IDS;
  ZH.SKILLS = SKILLS;
  ZH.SKILL_BY_ID = SKILL_BY_ID;
  ZH.MAX_PLAYER_SKILL = MAX_PLAYER_SKILL;

  var BY_CLASS = {};
  Object.keys(W).forEach(function (id) { BY_CLASS[W[id].class] = W[id]; });
  ZH.WEAPON_BY_CLASS = BY_CLASS;

  /** display stats for a weapon at a level (HUD / loadout chips) */
  ZH.statsFor = function (id, level, attack) {
    var base = W[id] || W.gun;
    var atk = attack || 10;
    var mul = ZH.weaponLevelMul(level || 1);
    return {
      id: base.id,
      name: base.name,
      short: base.short,
      behaviour: base.behaviour,
      damage: Math.round(base.dmg * atk * mul),
      dmg: base.dmg,
      cooldown: base.cooldown,
      fireRate: base.cooldown,
      mag: base.mag,
      reload: base.reload,
      ammo: base.ammo !== false,
      range: base.range,
      splash: base.splash || base.blast || 0,
      evo: base.evo || null,
      supply: base.supply || null,
      desc: base.desc
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
