/*
 * Zombie Hunter: Survival — enemy roster + simulation
 *
 * The enemy roster is this project's own table, tuned for the same genre
 * feel (walkers, runners, brutes, ranged, minibosses). Every number below is
 * our own balance value; no art, code or data is taken from another game:
 *
 *   scale | speed px/ms | hp | range | dmg | attackDelay ms | coin bonus
 *
 * speeds are stored here in px/s (the engine clocks seconds), so .13
 * px/ms becomes 130 px/s. Ranged types (cop, tower2, assault1/2,
 * miniboss_soldier, miniboss_tower) spawn shots, exactly as in source.
 *
 * Weapons follow the 18-weapon catalogue in weapons.js; every behaviour
 * below mirrors the original prototype code (orbit axes, fan crossbow,
 * continuous flamethrower, target-seeking Gun, melee Sword, Drill burst,
 * Bazooka rocket, returning Boomerang, bullet-eating Circular, Tesla
 * chain, bouncing SpikedBall, Forcefield aura, Launcher salvo, Molotov).
 */
(function (global) {
  'use strict';
  var ZH = global.ZH = global.ZH || {};
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ------------------- combat tuning (original to this build) -------------------
     Health and damage have to grow together. When only health grew, a gun that
     dropped a zombie in one shot at minute one spent ten seconds chewing the
     same zombie later — hits registered, the bar barely moved, and on screen it
     read as "the gun stopped shooting the zombies". These helpers keep the two
     curves tied together so time-to-kill stays flat, and guarantee every
     registered hit removes a visible slice of the target's own bar. */
  ZH.COMBAT = ZH.COMBAT || {
    hpCurve: 0.8,        /* exponent on the stage level multiplier: softened    */
    hpRecycleGain: 0.1,  /* extra health per recycled wave cycle              */
    hpRecycleCap: 1.5,   /* ... capped here, so deep runs never wall up        */
    minHitFrac: 0.08,    /* a normal enemy always loses >=8% of its bar a hit */
    bossHitFrac: 0.012   /* bosses stay tanky: only a token floor applies     */
  };

  /** soft, bounded health multiplier for a spawn (stage growth + recycling) */
  ZH.healthMultiplier = function (levelMultiplier, waveCycle) {
    var raw = Math.max(1, levelMultiplier || 1);
    var c = ZH.COMBAT;
    var soft = 1 + Math.pow(raw - 1, c.hpCurve);
    var recycle = Math.min(c.hpRecycleGain * (waveCycle || 0), c.hpRecycleCap - 1);
    return soft * (1 + recycle);
  };

  /** the identical curve applied to weapon damage: time-to-kill stays put */
  ZH.damageMultiplier = function (levelMultiplier, waveCycle) {
    return ZH.healthMultiplier(levelMultiplier, waveCycle);
  };

  /* ------------------- protection windows (force field) -------------------
     One timer — player.shieldT — is the single source of truth for every
     window: it gates damage, feeds the HUD countdown, paints the hunter ring
     and drives the body blink. player.invuln is only a legacy mirror. */
  ZH.SHIELD = ZH.SHIELD || {
    max: 3,          /* longest window; also the HUD bar width               */
    hit: 3.0,        /* after a bite or an enemy round                       */
    revive: 3.0,     /* after spending scrap to get back up                  */
    levelup: 1.2,    /* while the level-up cards are on screen               */
    dash: 0.35,      /* during a combat roll                                 */
    dashExit: 0.12   /* the instant after the roll ends                      */
  };

  /** arm (or extend) the one protection timer */
  ZH.openShield = function (p, seconds) {
    if (!p) return 0;
    var t = seconds == null ? ZH.SHIELD.hit : seconds;
    if (!isFinite(t) || t <= 0) return p.shieldT || 0;
    p.shieldT = Math.max(p.shieldT || 0, t);
    p.shieldMax = Math.max(p.shieldMax || 0, t);
    p.invuln = p.shieldT;
    return p.shieldT;
  };

  /** is the hunter protected right now? (one check, one field) */
  ZH.shielded = function (p) { return !!(p && (p.shieldT || 0) > 0); };

  /** one clock, one timeline: remaining time, bar fraction and the
      "about to break" flag the HUD paints from */
  ZH.shieldTimeline = function (t, max) {
    var span = (max && max > 0) ? max : ZH.SHIELD.max;
    var remaining = Math.max(0, isFinite(t) ? t : 0);
    var frac = Math.max(0, Math.min(1, remaining / span));
    return {
      active: remaining > 0.001,
      remaining: remaining,
      max: span,
      frac: frac,
      expiring: remaining > 0.001 && remaining <= 0.9
    };
  };

  /* ------------------------- horde density: MEDIUM -------------------------
     One shared budget for the field, not one per wave: overlapping wave
     ladders check the same live count, so the screen cannot turn into a wall.
     Lives here (not in game.js) so the data layer and the tests read the same
     numbers the run does. */
  ZH.HORDE = ZH.HORDE || {
    density: 'medium',
    /* the feed is pulsed: bodies arrive in a surge, then the street goes
       quiet while the hunter clears them. Continuous feeding pinned the
       field at the cap and read as a swarm. */
    interval: { LOW: 1.25, MID: 0.8, HI: 0.5 },   /* seconds between spawns */
    surge: { spawn: 3.5, rest: 4.2 },             /* a 7.7 s breath cycle */
    nearCap: 6,                                   /* live bodies near the hunter */
    hardCap: 22,                                  /* absolute bodies on the field */
    targetAverage: 4,                             /* the medium target, NOT the cap */
    swarmCeiling: 6                              /* a run must never exceed this */
  };

  /** is the horde currently feeding or resting? (one clock for the whole run) */
  ZH.hordeWindow = function (clock) {
    var s = ZH.HORDE.surge, span = s.spawn + s.rest;
    var t = Math.max(0, clock || 0) % span;
    return { spawning: t < s.spawn, phase: t < s.spawn ? 'surge' : 'lull', t: t, span: span };
  };

  /** advance the protection clock by dt (kept separate so it is testable) */
  ZH.tickShield = function (p, dt) {
    if (!p) return 0;
    if (p.shieldT) p.shieldT = Math.max(0, p.shieldT - dt);
    p.invuln = p.shieldT || 0;
    return p.shieldT || 0;
  };

  /* ------------------------------ enemies ------------------------------ */
  /* name = display name, variant = character rig, speed = px/s, cd = seconds */
  var ENEMY_TYPES = {
    zombieA:  { name: 'Zombie',        hp: 10,   speed: 130, dmg: 4,  range: 40,  cd: 1.0,  scale: .85, coins: 100,  variant: 'walker' },
    zombieB:  { name: 'Zombie',        hp: 11,   speed: 120, dmg: 4,  range: 40,  cd: 1.0,  scale: .85, coins: 100,  variant: 'walker' },
    zombieC:  { name: 'Zombie',        hp: 12,   speed: 110, dmg: 4,  range: 40,  cd: 1.0,  scale: .85, coins: 100,  variant: 'crawler' },
    zombieD:  { name: 'Zombie',        hp: 13,   speed: 100, dmg: 4,  range: 40,  cd: 1.0,  scale: .85, coins: 100,  variant: 'crawler' },

    slime1:   { name: 'Slime',         hp: 10,   speed: 150, dmg: 3,  range: 10,  cd: 1.0,  scale: .85, coins: 100,  variant: 'crawler' },
    slime2:   { name: 'Big Slime',     hp: 100,  speed: 100, dmg: 5,  range: 10,  cd: 1.0,  scale: .85, coins: 300,  variant: 'crawler' },
    bat:      { name: 'Bat',           hp: 10,   speed: 500, dmg: 3,  range: 40,  cd: 1.0,  scale: .85, coins: 100,  variant: 'crawler' },
    toxic1:   { name: 'Toxic',         hp: 10,   speed: 200, dmg: 5,  range: 10,  cd: 1.0,  scale: 1.0, coins: 300,  variant: 'spitter' },
    toxic2:   { name: 'Toxic Brute',   hp: 150,  speed: 250, dmg: 7,  range: 10,  cd: 1.0,  scale: 1.0, coins: 1000, variant: 'spitter' },
    manager:  { name: 'Manager',       hp: 15,   speed: 100, dmg: 3,  range: 50,  cd: 1.0,  scale: .85, coins: 300,  variant: 'walker' },
    cop:      { name: 'Cop',           hp: 25,   speed: 100, dmg: 5,  range: 50,  cd: 1.0,  scale: .85, coins: 300,  variant: 'walker', ranged: true, shotSpeed: 520 },
    reptile:  { name: 'Reptile',       hp: 50,   speed: 250, dmg: 6,  range: 40,  cd: 1.0,  scale: .85, coins: 300,  variant: 'runner' },
    slug:     { name: 'Slug',          hp: 500,  speed: 50,  dmg: 20, range: 10,  cd: 1.0,  scale: .85, coins: 3000, variant: 'brute' },
    builder:  { name: 'Builder',       hp: 300,  speed: 100, dmg: 10, range: 40,  cd: 1.0,  scale: .85, coins: 1000, variant: 'brute' },
    spider1:  { name: 'Spider',        hp: 200,  speed: 150, dmg: 20, range: 40,  cd: 1.0,  scale: .85, coins: 1000, variant: 'crawler' },
    spider2:  { name: 'Spider Queen',  hp: 400,  speed: 200, dmg: 30, range: 40,  cd: 1.0,  scale: .85, coins: 3000, variant: 'crawler' },
    tower1:   { name: 'Turret',        hp: 200,  speed: 0,   dmg: 5,  range: 125, cd: 0.35, scale: .9,  coins: 300,  variant: 'brute', static: true, ranged: true, shotSpeed: 480 },
    tower2:   { name: 'Heavy Turret',  hp: 700,  speed: 0,   dmg: 5,  range: 125, cd: 3.0,  scale: .9,  coins: 3000, variant: 'brute', static: true, ranged: true, shotSpeed: 520 },
    assault1: { name: 'Assault',       hp: 400,  speed: 150, dmg: 7,  range: 50,  cd: 1.0,  scale: .85, coins: 3000, variant: 'runner', ranged: true, shotSpeed: 540 },
    assault2: { name: 'Assault Elite', hp: 400,  speed: 150, dmg: 7,  range: 50,  cd: 1.0,  scale: .85, coins: 3000, variant: 'runner', ranged: true, shotSpeed: 540, spreadShots: 3 },

    miniboss_builder: { name: 'MINIBOSS: BUILDER', hp: 4000, speed: 150, dmg: 20, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'butcher', miniboss: true },
    miniboss_fighter: { name: 'MINIBOSS: FIGHTER', hp: 5500, speed: 200, dmg: 25, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'butcher', miniboss: true },
    miniboss_spider:  { name: 'MINIBOSS: SPIDER',  hp: 5000, speed: 300, dmg: 40, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'crawler', miniboss: true },
    miniboss_reptile: { name: 'MINIBOSS: REPTILE', hp: 3500, speed: 300, dmg: 30, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'runner', miniboss: true },
    miniboss_toxic1:  { name: 'MINIBOSS: TOXIC',   hp: 3000, speed: 200, dmg: 30, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'spitter', miniboss: true },
    miniboss_toxic2:  { name: 'MINIBOSS: TOXIC II', hp: 3500, speed: 250, dmg: 35, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'spitter', miniboss: true },
    miniboss_soldier: { name: 'MINIBOSS: SOLDIER', hp: 4500, speed: 100, dmg: 7,  range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'walker', miniboss: true, ranged: true, shotSpeed: 560 },
    miniboss_tower:   { name: 'MINIBOSS: TOWER',   hp: 6000, speed: 0,   dmg: 5,  range: 125, cd: 0.45, scale: .9, coins: 10000, variant: 'brute', miniboss: true, static: true, ranged: true, shotSpeed: 520 }
  };

  /* ------------------------------- bosses ------------------------------- */
  var BOSS_TYPES = {
    boss_soldier: { name: 'BOSS: SOLDIER', hp: 8000,  speed: 110, dmg: 18, range: 46, cd: 0.9, scale: 1.7, coins: 20000, variant: 'boss' },
    boss_tower:   { name: 'BOSS: TOWER',   hp: 9000,  speed: 0,   dmg: 12, range: 150, cd: 0.8, scale: 1.7, coins: 20000, variant: 'warden', static: true, ranged: true, shotSpeed: 520 },
    boss_dragon:  { name: 'BOSS: DRAGON',  hp: 12000, speed: 130, dmg: 24, range: 52, cd: 0.9, scale: 1.8, coins: 25000, variant: 'butcher' },
    boss_reptile: { name: 'BOSS: REPTILE', hp: 10000, speed: 170, dmg: 22, range: 50, cd: 0.9, scale: 1.7, coins: 22000, variant: 'matron' },
    boss_mutant:  { name: 'BOSS: MUTANT',  hp: 14000, speed: 100, dmg: 28, range: 54, cd: 0.9, scale: 1.9, coins: 28000, variant: 'butcher' },
    boss_spider:  { name: 'BOSS: SPIDER',  hp: 11000, speed: 180, dmg: 26, range: 50, cd: 0.9, scale: 1.7, coins: 24000, variant: 'crawler' },
    boss_fighter: { name: 'BOSS: FIGHTER', hp: 9000,  speed: 150, dmg: 20, range: 48, cd: 0.9, scale: 1.7, coins: 20000, variant: 'boss' }
  };

  ZH.ENEMY_TYPES = ENEMY_TYPES;
  ZH.BOSS_TYPES = BOSS_TYPES;
  ZH.enemyName = function (type) {
    var d = ENEMY_TYPES[type] || BOSS_TYPES[type];
    return d ? d.name : type;
  };

  /* ------------------------------ survivors ------------------------------ */
  function createSurvivor(opts) {
    opts = opts || {};
    var s = {
      x: opts.x || 0, y: opts.y || 0,
      vx: 0, vy: 0, r: 12,
      hp: 100, maxHp: 100,
      speed: 300,   // original: 0.3 px/ms = 300 px/s
      moveX: 0, moveY: 0,
      aimDir: -Math.PI / 2,
      facing: 1,
      walkPhase: 0,
      weapons: {},
      supplies: {},
      attribs: {},
      attack: 10,
      level: 1,
      exp: 0,
      expToNext: 1000,
      kills: 0,
      dead: false,
      deadT: 0,
      /* one protection clock for every force-field window (see ZH.SHIELD) */
      shieldT: 3, shieldMax: 3,
      invuln: 3,                    /* legacy mirror of shieldT only */
      dashT: 0, dashCd: 0, dashMax: 2.2, dashVX: 0, dashVY: 0,
      regenT: 0
    };
    var wid = opts.weapon;
    if (!wid || !ZH.WEAPONS || !ZH.WEAPONS[wid]) wid = 'gun';
    s.weapon = wid;
    s.primaryWeapon = wid;
    var base = ZH.WEAPONS[wid];
    s.weapons[wid] = { level: 1, class: wid, timer: 0, mag: base.mag, reloading: 0 };
    return s;
  }

  function createEnemy(type, x, y, levelMultiplier, diff, waveCycle) {
    var def = ENEMY_TYPES[type] || ENEMY_TYPES.zombieA;
    /* bounded curve: stage growth softened, recycled-wave bonus capped */
    var mult = ZH.healthMultiplier(levelMultiplier || 1, waveCycle || 0);
    var dh = (diff && diff.hp) || 1;
    var hp = def.hp * mult * dh;
    var e = {
      x: x, y: y, r: 13 * (def.scale || 1),
      hp: hp, maxHp: hp,
      speed: def.speed * ((diff && diff.speed) || 1),
      dmg: def.dmg * ((diff && diff.dmg) || 1),
      range: def.range,
      cd: def.cd,
      cdT: Math.random() * def.cd,
      type: type,
      name: def.name,
      variant: def.variant || 'walker',
      coins: Math.round((def.coins || 100) / 100),
      scale: (def.scale || .85) * 1.4,
      facing: 1,
      walkPhase: Math.random() * TAU,
      hurtFlash: 0,
      dead: false,
      removeT: 0.5,
      ranged: !!def.ranged,
      spreadShots: def.spreadShots || 1,
      shotSpeed: def.shotSpeed || 520,
      stationary: !!def.static,
      miniboss: !!def.miniboss,
      seed: Math.random() * 100
    };
    if (def.miniboss) {
      e.boss = true;                     // uses the boss HP bar in render()
      e.scale = 1.5;
      e.r = 26;
    }
    return e;
  }

  function createBoss(type, x, y, diff, levelMultiplier) {
    var def = BOSS_TYPES[type] || BOSS_TYPES.boss_soldier;
    var bh = (diff && diff.hp) || 1;
    /* bosses follow the same health curve, so they stay the tankiest thing on
       the field instead of turning into paper at a high stage */
    bh *= ZH.healthMultiplier(levelMultiplier || 1, 0);
    return {
      x: x, y: y, r: 30,
      hp: def.hp * bh, maxHp: def.hp * bh,
      speed: def.speed * ((diff && diff.speed) || 1),
      dmg: def.dmg * ((diff && diff.dmg) || 1),
      range: def.range,
      cd: def.cd, cdT: Math.random() * def.cd,
      type: type,
      name: def.name,
      variant: def.variant,
      coins: Math.round((def.coins || 20000) / 100),
      scale: def.scale,
      facing: 1,
      walkPhase: 0,
      hurtFlash: 0,
      dead: false,
      removeT: 1.0,
      boss: true,
      ranged: !!def.ranged,
      shotSpeed: def.shotSpeed || 520,
      spreadShots: def.spreadShots || 3,
      stationary: !!def.static,
      seed: Math.random() * 100
    };
  }

  /* ------------------------------- helpers ------------------------------- */
  function attribsOf(p) {
    return p.attribs || {};
  }

  function damageEnemy(world, z, dmg) {
    if (z.dead) return;
    /* every registered hit must visibly bite: a small floor relative to the
       target's own bar keeps the base gun useful against late-wave health.
       Bosses and minibosses keep a token floor so they stay tanky on purpose. */
    var frac = (z.boss || z.miniboss) ? ZH.COMBAT.bossHitFrac : ZH.COMBAT.minHitFrac;
    var floor = (z.maxHp || 0) * frac;
    if (!isFinite(dmg) || dmg < floor) dmg = floor;
    /* diagnostics hook: the harness reads the damage that actually lands */
    if (ZH.onDamage) ZH.onDamage(world, z, dmg);
    z.hp -= dmg;
    z.hurtFlash = 0.2;
    if (z.hp <= 0) {
      z.dead = true;
      if (world.player) world.player.kills = (world.player.kills || 0) + 1;
      world.score = (world.score || 0) + 10;
      // exp gems are the main drop; big enemies always leave scrap too
      world.pickups.push({ type: 'exp', x: z.x, y: z.y, life: 12, value: z.boss ? 40 : 10 });
      /* a dark pool under the body: the street remembers the fight */
      if (world.decals && world.decals.length < 140) {
        world.decals.push({
          x: z.x + rand(-4, 4), y: z.y + rand(-2, 6),
          r: rand(7, 14) * (z.boss ? 2.2 : 1),
          rot: rand(0, TAU), alpha: 0.42
        });
      }
      if (z.coins || z.boss) {
        world.pickups.push({ type: 'coin', x: z.x + rand(-8, 8), y: z.y + rand(-8, 8), life: 12, value: z.coins || 5 });
      }
      /* a spent shield cell: grabbing it re-arms the same protection window,
         so the timeline can be topped up mid-fight */
      if (z.boss || Math.random() < 0.06) {
        world.pickups.push({ type: 'shield', x: z.x + rand(-10, 10), y: z.y - 6, life: 20, value: ZH.SHIELD.hit });
      }
      /* supplies drop into the world as real items, so the catalogue (kevlar,
         sneakers, supplements, axe upgrades…) shows up on the ground and not
         only on cards. Bosses always drop one, everyone else rarely. */
      if (ZH.SUPPLY_IDS && (z.boss || Math.random() < 0.025)) {
        var pool = [];
        for (var si = 0; si < ZH.SUPPLY_IDS.length; si++) {
          var sid = ZH.SUPPLY_IDS[si];
          if (!ZH.SUPPLIES[sid].consumable) pool.push(sid);
        }
        if (pool.length) {
          world.pickups.push({
            type: 'item', item: 'supply',
            itemId: pool[(Math.random() * pool.length) | 0],
            x: z.x + rand(-6, 6), y: z.y - 8, life: 30, value: 1
          });
        }
      }
      if (world.shake != null) world.shake = Math.max(world.shake, z.boss ? 9 : 2);
    }
  }

  /* damage every live enemy inside a circle */
  function splashDamage(world, x, y, radius, dmg, opts) {
    opts = opts || {};
    var list = world.zombies;
    for (var i = 0; i < list.length; i++) {
      var z = list[i];
      if (z.dead) continue;
      if (Math.hypot(z.x - x, z.y - y) <= radius + z.r) damageEnemy(world, z, dmg);
    }
    world.particles.push({
      x: x, y: y, vx: 0, vy: 0, life: 0.35, max: 0.35,
      size: radius * 0.6, color: opts.color || 'rgba(255,140,60,0.5)'
    });
  }

  /* the closest live enemy, optionally inside a radius */
  function nearestEnemy(world, p, range) {
    var best = null, bestD = range ? range * range : Infinity;
    for (var i = 0; i < world.zombies.length; i++) {
      var z = world.zombies[i];
      if (z.dead) continue;
      var d2 = (z.x - p.x) * (z.x - p.x) + (z.y - p.y) * (z.y - p.y);
      if (d2 < bestD) { bestD = d2; best = z; }
    }
    return best;
  }

  /* Target lock with hysteresis. Always picking the single closest body
     re-aimed the gun at a fresh zombie almost every shot in a crowd, so the
     damage was spread across six of them and nothing died while the player
     watched the gun fire into the horde. Once engaged, a zombie stays the
     target until it dies, leaves range, or another is 1.5x closer. */
  function acquireTarget(world, p, range) {
    if (!world || !world.zombies) return null;
    var list = world.zombies;
    var keep = p._lock, keepD = Infinity;
    if (keep && !keep.dead && list.indexOf(keep) !== -1) {
      keepD = Math.hypot(keep.x - p.x, keep.y - p.y);
      if (range && keepD > range) { keep = null; p._lock = null; }
    } else if (keep) {
      keep = null;
      p._lock = null;
    }
    var best = null, bestD = range ? range * range : Infinity;
    for (var i = 0; i < list.length; i++) {
      var z = list[i];
      if (z.dead || z === keep) continue;
      var d2 = (z.x - p.x) * (z.x - p.x) + (z.y - p.y) * (z.y - p.y);
      if (d2 < bestD) { bestD = d2; best = z; }
    }
    if (keep) {
      if (!best) return keep;
      if (keepD * keepD <= bestD * 2.25) return keep;
    }
    p._lock = best;
    return best;
  }

  function aimAt(world, p, range) {
    var z = nearestEnemy(world, p, range);
    if (z) return Math.atan2(z.y - p.y, z.x - p.x);
    return p.aimDir || 0;
  }

  /* Every weapon that throws something at the horde acquires the closest
     body in range before it fires. Only the Gun used to re-aim; the fan,
     stream, lobbed bombs and melee kept swinging along the last walk vector,
     so in a crowded district (or when backing away) the hunter visibly fired
     away from the zombies. This locks the arm, the muzzle and the shot to
     the same target in every district. */
  var AUTO_AIM = {
    target: 1, burst: 1, rocket: 1, chain: 1, boomerang: 1, bounce: 1,
    fan: 1, stream: 1, salvo: 1, firebomb: 1, melee: 1
  };

  function aimAtNearest(world, p, range, fallback) {
    var z = acquireTarget(world, p, range);
    if (!z) return fallback == null ? (p.aimDir || 0) : fallback;
    var ang = Math.atan2(z.y - p.y, z.x - p.x);
    p.aimDir = ang;
    if (Math.abs(z.x - p.x) > 6) p.facing = z.x >= p.x ? 1 : -1;
    return ang;
  }

  /* how far the hunter can actually see, in world pixels */
  function viewRange(world) {
    if (!world || !world.W || !world.H) return 0;
    var zoom = (world.camera && world.camera.zoom) || 1;
    return Math.hypot(world.W, world.H) / (2 * zoom);
  }

  /* The Gun family must answer the zombies the player can see, not only the
     ones inside its authored 460px circle. Acquisition is the larger of the
     weapon range and the visible radius (capped so a 4K window cannot turn
     the sidearm into a sniper). */
  function targetRange(def, world, range) {
    if (!def || def.behaviour !== 'target') return range;
    var seen = viewRange(world);
    /* cover the whole visible screen: a zombie the player can see is a zombie
       the sidearm may answer, even on an ultrawide monitor */
    return Math.max(range, Math.min(2200, seen + 100));
  }

  function pushShot(world, o) {
    o.px = o.x; o.py = o.y;
    /* the direction this round actually left in — the muzzle flash, the brass
       and the tracer all read it back so they can never disagree */
    if (o.vx || o.vy) world._shotAng = Math.atan2(o.vy || 0, o.vx || 0);
    o.r = o.r || 4;
    o.life = o.life || 1.6;
    o.hits = o.hits || null;
    if (world._wid && !o.wid) o.wid = world._wid;
    /* what the renderer should draw for this shot */
    if (!o.kind) {
      o.kind = o.flame ? 'flame' : o.rocket ? 'rocket' : o.firebomb ? 'bomb' :
        o.chainTarget ? 'chain' : o.returnTrip ? 'boomerang' :
        o.bounce ? 'ball' : o.orbit ? 'blade' : (o.pierce ? 'bolt' : 'bullet');
    }
    world.bullets.push(o);
    return o;
  }

  /* ------------------------------ weapons ------------------------------ */
  /**
   * Fire one weapon. `id` is already the effective (possibly evolved) id.
   * Returns the seconds until it may fire again.
   */
  function fireWeaponCore(id, level, p, world, def) {
    def = def || (ZH.WEAPONS && ZH.WEAPONS[id]) || (ZH.WEAPONS && ZH.WEAPONS.gun);
    if (!def) return 1;
    var a = attribsOf(p);
    var atk = p.attack || 10;
    var mul = ZH.weaponLevelMul ? ZH.weaponLevelMul(level) : 1;
    /* damage rides the same curve as enemy health (stage growth + recycled
       waves), so a fresh zombie takes the same handful of hits at minute one
       and at the end of a long run */
    var scale = ZH.damageMultiplier(
      (world && world.stage && world.stage.multiplier) || 1,
      (world && world.waveCycle) || 0);
    var dmg = def.dmg * atk * mul * (1 + (a.attack_bonus || 0)) * scale;
    var speed = (def.speed || 600) * (1 + (a.shot_speed_bonus || 0));
    var range = (def.range || 400) * (1 + (a.shot_range_bonus || 0));
    var cd = def.cooldown * (1 - Math.min(0.7, a.cooldown_bonus || 0));
    var aim = p.aimDir || 0;
    var i, ang;
    var acquire = targetRange(def, world, range);
    if (world) world._shotFired = true;

    /* acquire before switching so every ranged case fires at a body, not at
       the direction the thumbstick happened to be pointing */
    if (AUTO_AIM[def.behaviour]) aim = aimAtNearest(world, p, acquire, aim);

    switch (def.behaviour) {
      /* spinning axes / saw blades around the hunter */
      case 'orbit':
      case 'saw': {
        // original count: Axe counts 2 (evolved only). Circular/Saw counts rise with level.
        // Circular: 2=>3, 3=>4, 4=>5, 5=>6, >5=>7 ; Ripper (evolved): 7 blades.
        var count;
        if (def.sawCountByLevel && def.sawCountByLevel.length) {
          var li = Math.min(level, def.sawCountByLevel.length - 1);
          count = def.sawCountByLevel[li] || 2;
          if (level > 5) count = def.sawCountByLevelEvolved || count;
        } else {
          count = def.battleaxeCount || (def.id === 'battleaxe' ? 2 : 1);
        }
        for (i = 0; i < count; i++) {
          pushShot(world, {
            x: p.x, y: p.y, vx: 0, vy: 0, dmg: dmg,
            life: Math.max(1.2, cd + 0.3), r: def.radius * 0.22,
            orbit: true, saw: def.behaviour === 'saw',
            orbitAngle: (i / count) * TAU,
            orbitSpeed: def.orbitSpeed, orbitRadius: def.radius,
            hit: def.hit || 34,
            tick: 0, tickEvery: 0.3, splash: 0, enemy: false
          });
        }
        return cd;
      }

      /* Crossbow: a fan of bolts along the walk direction */
      case 'fan': {
        var n = def.count || 2;
        for (i = 0; i < n; i++) {
          ang = aim + (i - (n - 1) / 2) * (def.spread || 0.12);
          pushShot(world, {
            x: p.x + Math.cos(ang) * 18, y: p.y + Math.sin(ang) * 18,
            vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
            dmg: dmg, life: Math.max(0.4, range / speed), r: 4,
            pierce: def.pierce || 0, splash: 0, enemy: false,
            hits: {}
          });
        }
        return cd;
      }

      /* Flamethrower: a continuous stream, 40px ahead of the hunter */
      case 'stream': {
        ang = aim;
        var ox = p.x + Math.cos(ang) * 40, oy = p.y + Math.sin(ang) * 40;
        pushShot(world, {
          x: ox, y: oy,
          vx: Math.cos(ang) * speed + (p.moveX || 0) * 60,
          vy: Math.sin(ang) * speed + (p.moveY || 0) * 60,
          dmg: dmg, life: Math.max(0.25, range / speed), r: 12,
          splash: def.splash || 40, enemy: false, flame: true
        });
        return Math.max(0.05, def.tick || 0.1);
      }

      /* Gun / Uzi: auto-target the nearest enemy in range

         Original update() cadence (ms, converted to seconds here):
           level > 5 : shoot one shot every 0.160s for the whole trigger window
           else       : burst of (level+1) shots, each 0.150s apart, then the
                        weapon cooldown gate (this.cooldown with cooldown_bonus).

         game.js autoFire already gates the trigger period; we return one shot
         per call and let game.js re-fire on its own cooldown. That reproduces
         the original burst-then-cooldown rhythm for Gun, and the continuous
         0.160s shot cadence for Uzi.
      */
      case 'target': {
        /* Original Gun update() (the source counts in ms, this engine in s):
             level > 5 : one round every 160ms for as long as the trigger is
                         held  (the Uzi)
             otherwise : burst of (level+1) rounds 150ms apart, then the full
                         weapon cooldown gate before the next burst.
           game.js stores this function's return value in st.timer, so
           returning the shot gap plays the burst out and returning cd ends it. */
        var GAP = 0.150, UZI_GAP = 0.160;
        var tgt = acquireTarget(world, p, acquire);
        /* the original Gun checks the distance and does not fire at all when
           no body is in range. Firing into empty street made it look broken
           (and burned the magazine) whenever the horde was still approaching. */
        if (!tgt) {
          world._shotFired = false;
          return 0.12;
        }
        ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
        p.aimDir = ang;
        p.facing = Math.cos(ang) >= 0 ? 1 : -1;

        if (level > 5) {
          pushShot(world, {
            x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20,
            vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
            dmg: dmg,            life: Math.max(0.4, acquire / speed), r: 4,
            splash: 0, enemy: false, target: tgt
          });
          return UZI_GAP;
        }

        var gw = p.weapons && p.weapons[id];
        if (!gw) {
          pushShot(world, {
            x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20,
            vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
            dmg: dmg,            life: Math.max(0.4, acquire / speed), r: 4,
            splash: 0, enemy: false, target: tgt
          });
          return cd;
        }
        if (!gw.gunBurst || gw.gunBurst <= 0) {
          gw.gunBurst = level + 1;   // rounds in this burst
          gw.gunRestore = cd;        // the gate that follows the burst
        }
        pushShot(world, {
          x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20,
          vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
          dmg: dmg, life: Math.max(0.4, acquire / speed), r: 4,
          splash: 0, enemy: false, target: tgt
        });
        gw.gunBurst--;
        if (gw.gunBurst > 0) return GAP;
        var restore = gw.gunRestore || cd;
        gw.gunBurst = 0;
        return restore;
      }

      /* Sword / Scimitars: melee arc in (or around) the facing direction */
      case 'melee': {
        var arc = def.arc || Math.PI;
        var reach = (def.reach || 78) * (1 + (a.shot_range_bonus || 0));
        for (i = 0; i < world.zombies.length; i++) {
          var z = world.zombies[i];
          if (z.dead) continue;
          var dd = Math.hypot(z.x - p.x, z.y - p.y);
          if (dd > reach + z.r) continue;
          if (arc < TAU - 0.01) {
            var rel = Math.atan2(z.y - p.y, z.x - p.x) - aim;
            while (rel > Math.PI) rel -= TAU;
            while (rel < -Math.PI) rel += TAU;
            if (Math.abs(rel) > arc / 2) continue;
          }
          damageEnemy(world, z, dmg);
        }
        world.particles.push({
          x: p.x + Math.cos(aim) * reach * 0.5,
          y: p.y + Math.sin(aim) * reach * 0.5,
          vx: 0, vy: 0, life: 0.18, max: 0.18,
          size: reach * 0.5, color: 'rgba(220,240,255,0.32)'
        });
        return cd;
      }

      /* Drill / Lasergun: a tight burst at the nearest enemy */
      case 'burst': {
        var bt = nearestEnemy(world, p, range);
        ang = bt ? Math.atan2(bt.y - p.y, bt.x - p.x) : aim;
        if (bt) { p.aimDir = ang; p.facing = Math.cos(ang) >= 0 ? 1 : -1; }
        var cnt = def.count || 5;
        for (i = 0; i < cnt; i++) {
          var ba = ang + rand(-(def.spread || 0.05), (def.spread || 0.05));
          pushShot(world, {
            x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20,
            vx: Math.cos(ba) * speed, vy: Math.sin(ba) * speed,
            dmg: dmg, life: Math.max(0.3, range / speed), r: 3,
            splash: 0, enemy: false, delay: i * 0.06
          });
        }
        return cd;
      }

      /* Bazooka / Nuke: one rocket at the nearest enemy */
      case 'rocket': {
        var rt = nearestEnemy(world, p, range);
        ang = rt ? Math.atan2(rt.y - p.y, rt.x - p.x) : aim;
        if (rt) { p.aimDir = ang; p.facing = Math.cos(ang) >= 0 ? 1 : -1; }
        pushShot(world, {
          x: p.x + Math.cos(ang) * 22, y: p.y + Math.sin(ang) * 22,
          vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
          dmg: dmg, life: Math.max(0.6, range / speed), r: 7,
          splash: def.blast || 100, enemy: false, rocket: true
        });
        return cd;
      }

      /* Boomerang / Neckbreaker: one blade toward the nearest enemy (base) or
         two blades offset by PI riding the player (evolved neckbreaker).

         Original: base launches a single blade thrown at the nearest enemy with
           e.elastic=true and e.elasticSpeed=this.getSpeed(). The regenerated
           math below replaces that elastic homing with a travel-then-home path
           that lands back on the hunter and does a second hit.

         Original evolved launch spawns two blades anchored to Player with
           anchorAngle in 0 and PI, anchorRadius 10, anchorTotal getAnchorTotal(),
           rotationSpeed = getRotSpeed() (~0.1 rad/s base, 0.13 evolved).
         We model that by spawning anchored lock-on blades only when count>1.
      */
      case 'boomerang': {
        var bn = def.count || 1;
        for (i = 0; i < bn; i++) {
          var bAng, bAnchor = null;
          if (bn > 1) {
            // evolved neckbreaker: two blades offset by PI, locked to player
            bAng = (i * Math.PI);
            bAnchor = p;
          } else {
            // base boomerang: throw toward nearest enemy
            var bTgt = nearestEnemy(world, p, range);
            bAng = bTgt ? Math.atan2(bTgt.y - p.y, bTgt.x - p.x) : aim;
            if (bTgt) { p.aimDir = bAng; p.facing = Math.cos(bAng) >= 0 ? 1 : -1; }
          }
          pushShot(world, {
            x: p.x, y: p.y,
            vx: Math.cos(bAng) * speed, vy: Math.sin(bAng) * speed,
            dmg: dmg, life: 3.0, r: 6, splash: 0, enemy: false,
            returnTrip: true, travel: 0, hits: {},
            anchor: bAnchor,
            anchorSpeed: bAnchor ? Math.min(620, speed) : 0,
            anchorAngle: (i * Math.PI),
            anchorRadius: bAnchor ? 10 : 0,
            anchorTotal: bAnchor ? 4 * Math.PI : 0
          });
        }
        return cd;
      }

      /* Tesla / Thunderorb: chain lightning on a random enemy in range */
      case 'chain': {
        var pool = [];
        for (i = 0; i < world.zombies.length; i++) {
          var tz = world.zombies[i];
          if (tz.dead) continue;
          if (Math.hypot(tz.x - p.x, tz.y - p.y) <= range) pool.push(tz);
        }
        if (!pool.length) return cd;
        var pick = pool[(Math.random() * pool.length) | 0];
        p.aimDir = Math.atan2(pick.y - p.y, pick.x - p.x);
        p.facing = Math.cos(p.aimDir) >= 0 ? 1 : -1;
        pushShot(world, {
          x: p.x, y: p.y, vx: 0, vy: 0, dmg: dmg,
          life: 0.45, r: 4, splash: def.blast || 90, enemy: false,
          chainTarget: pick, chainSpeed: speed
        });
        return cd;
      }

      /* Spiked Ball / Biliard: fired at the nearest enemy, bounces */
      case 'bounce': {
        var bc = def.count || 1;
        var baseAng = aim;
        for (i = 0; i < bc; i++) {
          var sa = bc > 1 ? (i / bc) * TAU : baseAng;
          if (bc === 1) {
            var st = nearestEnemy(world, p, range);
            if (st) { sa = Math.atan2(st.y - p.y, st.x - p.x); p.aimDir = sa; p.facing = Math.cos(sa) >= 0 ? 1 : -1; }
          }
          pushShot(world, {
            x: p.x, y: p.y,
            vx: Math.cos(sa) * speed, vy: Math.sin(sa) * speed,
            dmg: dmg, life: 3.2, r: 6, splash: 0, enemy: false,
            bounce: def.bounce || 3, hits: {}
          });
        }
        return cd;
      }

      /* Forcefield / Domain: instant aura damage, eats enemy shots */
      case 'aura': {
        var radius = (def.radius || 120) * (1 + (a.shot_range_bonus || 0));
        for (i = 0; i < world.zombies.length; i++) {
          var az = world.zombies[i];
          if (az.dead) continue;
          if (Math.hypot(az.x - p.x, az.y - p.y) <= radius + az.r) damageEnemy(world, az, dmg);
        }
        for (var eb = world.enemyBullets.length - 1; eb >= 0; eb--) {
          var ebl = world.enemyBullets[eb];
          if (Math.hypot(ebl.x - p.x, ebl.y - p.y) <= radius) world.enemyBullets.splice(eb, 1);
        }
        world.particles.push({
          x: p.x, y: p.y, vx: 0, vy: 0, life: 0.2, max: 0.2,
          size: radius, color: 'rgba(120,200,255,0.16)'
        });
        return cd;
      }

      /* Launcher / Airstrike: rockets at points orbiting the hunter */
      case 'salvo': {
        var sc = def.count || 2;
        for (i = 0; i < sc; i++) {
          var oa = (i / sc) * TAU + (world.t || 0) * 0.7;
          var tx = p.x + Math.cos(oa) * Math.min(range, 420);
          var ty = p.y + Math.sin(oa) * Math.min(range, 420);
          var sa2 = Math.atan2(ty - p.y, tx - p.x);
          pushShot(world, {
            x: p.x, y: p.y,
            vx: Math.cos(sa2) * speed, vy: Math.sin(sa2) * speed,
            dmg: dmg, life: Math.max(0.5, Math.min(range, 420) / speed), r: 7,
            splash: def.blast || 90, enemy: false, rocket: true
          });
        }
        return cd;
      }

      /* Molotov / Canister: fire bombs lobbed at points around the hunter */
      case 'firebomb': {
        var fc = def.count || 3;
        for (i = 0; i < fc; i++) {
          var fa = aim + (i - (fc - 1) / 2) * (def.spread || 0.9);
          pushShot(world, {
            x: p.x, y: p.y,
            vx: Math.cos(fa) * speed, vy: Math.sin(fa) * speed,
            dmg: 0, life: 0.55, r: 8, splash: def.blast || 70,
            enemy: false, firebomb: true, fireDmg: dmg
          });
        }
        return cd;
      }
    }

    // anything unhandled: plain shot along the aim direction
    pushShot(world, {
      x: p.x, y: p.y,
      vx: Math.cos(aim) * speed, vy: Math.sin(aim) * speed,
      dmg: dmg, life: 1.6, r: 4, splash: 0, enemy: false
    });
    return cd;
  }

  /* behaviours that throw something out of the barrel */
  var MUZZLE = { target: 1, fan: 1, burst: 1, rocket: 1, stream: 1 };

  /* one shot voice per weapon family. The original plays gun2 / shotgun /
     whoosh per weapon; before this the hunter fired in total silence and only
     the muzzle flash said anything. */
  var SHOT_SOUND = {
    target: 'pistol', fan: 'rifle', burst: 'rifle',
    rocket: 'slam', stream: 'flamer'
  };

  /* Fire one weapon and dress the shot: muzzle flash, warm light and a
     brass casing kicked sideways, so every shot reads on screen. */
  function fireWeapon(id, level, p, world) {
    var def = (ZH.WEAPONS && ZH.WEAPONS[id]) || (ZH.WEAPONS && ZH.WEAPONS.gun);
    if (!def) return 1;
    world._wid = id;
    world._shotAng = null;
    world._shotFired = true;
    var cd = fireWeaponCore(id, level, p, world, def);

    if (MUZZLE[def.behaviour] && world._shotFired !== false) {
      /* fire from the barrel that is actually pointing at the target, not from
         wherever the hunter last walked */
      var aim = world._shotAng == null ? (p.aimDir || 0) : world._shotAng;
      var mx = p.x + Math.cos(aim) * 26, my = p.y + Math.sin(aim) * 26 - 4;
      world.particles.push({
        x: mx, y: my, vx: 0, vy: 0, life: 0.08, max: 0.08,
        size: def.behaviour === 'rocket' ? 13 : def.behaviour === 'stream' ? 5 : 8,
        color: 'rgba(255,232,170,0.92)'
      });
      world.particles.push({
        x: mx, y: my, vx: 0, vy: 0, life: 0.16, max: 0.16,
        size: def.behaviour === 'rocket' ? 26 : 17,
        color: 'rgba(255,168,60,0.3)'
      });
      if (ZH.Audio) ZH.Audio.play(id === 'uzi' ? 'smg' : (SHOT_SOUND[def.behaviour] || 'pistol'));
      if (def.ammo !== false && def.behaviour !== 'stream' && Math.random() < 0.85) {
        var ca = aim + Math.PI / 2 + rand(-0.35, 0.35);
        world.particles.push({
          x: mx, y: my,
          vx: Math.cos(ca) * rand(70, 150), vy: Math.sin(ca) * rand(70, 150) - 40,
          grav: 620, life: 0.45, max: 0.45, size: 1.9, color: '#d9b25c'
        });
      }
    }
    return cd;
  }

  /* ------------------------------ simulation ------------------------------ */
  function updateSurvivor(p, dt, world) {
    if (p.dead) { p.deadT += dt; return; }

    var mx = p.moveX, my = p.moveY;
    var len = Math.hypot(mx, my);
    var a = attribsOf(p);
    var speed = p.speed * (1 + (a.speed_bonus || 0));
    if (len > 0.01) {
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      p.walkPhase += dt * 8;
    }
    /* open world: no walls — the city keeps generating in every direction */

    /* one clock: the force field drains, the legacy mirror follows it */
    ZH.tickShield(p, dt);

    /* Auto-aim. The Gun/Uzi fire at the closest threat, so the hunter has to
       face it too — otherwise the arm and muzzle keep the walk direction
       while the rounds go the other way, which reads as "the gun is not
       shooting properly". Only target-behaviour weapons lock the arm; the
       crossbow fan and the flamethrower still follow the stick. */
    var primId = p.primaryWeapon;
    var primSt = primId && p.weapons ? p.weapons[primId] : null;
    if (primSt && world.zombies && world.zombies.length) {
      var effId = ZH.effectiveWeapon ? ZH.effectiveWeapon(primId, primSt, p.supplies) : primId;
      var pdef = ZH.WEAPONS && ZH.WEAPONS[effId];
      if (pdef && AUTO_AIM[pdef.behaviour]) {        var prange = (pdef.range || 400) * (1 + (a.shot_range_bonus || 0));
        prange = targetRange(pdef, world, prange);

        var lock = acquireTarget(world, p, prange);
        if (lock) {
          p.aimDir = Math.atan2(lock.y - p.y, lock.x - p.x);
          if (Math.abs(lock.x - p.x) > 6) p.facing = lock.x >= p.x ? 1 : -1;
        }
      }
    }

    // Energy Drink: regen_bonus% of max HP every 5 s (original regen_time)
    if (a.regen_bonus > 0 && !p.dead) {
      p.regenT = (p.regenT || 0) + dt;
      if (p.regenT >= 5) {
        p.regenT -= 5;
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * a.regen_bonus);
      }
    }
  }

  function enemyShoot(world, z, dist) {
    var p = world.player;
    var base = Math.atan2(p.y - z.y, p.x - z.x);
    var shots = z.spreadShots || 1;
    for (var i = 0; i < shots; i++) {
      var ang = base + (i - (shots - 1) / 2) * 0.35;
      world.enemyBullets.push({
        x: z.x, y: z.y,
        vx: Math.cos(ang) * (z.shotSpeed || 520),
        vy: Math.sin(ang) * (z.shotSpeed || 520),
        dmg: z.dmg, life: 2.2, r: 5, enemy: true
      });
    }
    if (ZH.Audio) ZH.Audio.play(z.type === 'cop' ? 'pistol' : 'spit');
  }

  function updateEnemies(list, dt, world) {
    var p = world.player;
    for (var i = list.length - 1; i >= 0; i--) {
      var z = list[i];
      if (z.dead) { z.removeT -= dt; continue; }
      if (z.spawnT > 0) { z.spawnT -= dt; continue; }

      z.hurtFlash = Math.max(0, z.hurtFlash - dt * 5);
      z.walkPhase += dt * 4;

      var dx = p.x - z.x;
      var dy = p.y - z.y;
      var dist = Math.hypot(dx, dy) || 1;
      var stopAt = z.ranged ? (z.range || 50) * 0.85 : (z.range || 30) * 0.7;

      /* leash: a hunter who outruns the horde would otherwise leave the whole
         wave behind on the far side of the city. Far stragglers re-enter at
         the edge of the fight instead of jogging across 6 km of map. */
      if (!z.boss && dist > 950 && Math.random() < 0.06) {
        var la = rand(0, TAU), lr = rand(520, 760);
        z.x = p.x + Math.cos(la) * lr;
        z.y = p.y + Math.sin(la) * lr;
        continue;
      }

      if (!z.stationary && dist > stopAt) {
        z.x += (dx / dist) * z.speed * dt;
        z.y += (dy / dist) * z.speed * dt;
        z.facing = dx >= 0 ? 1 : -1;
      } else if (dist > 1) {
        z.facing = dx >= 0 ? 1 : -1;
      }

      z.cdT -= dt;
      if (z.cdT <= 0 && dist <= (z.range || 30) * 1.6) {
        z.cdT = z.cd;
        if (z.ranged) {
          enemyShoot(world, z, dist);
        } else if (dist < (z.range || 30)) {
          if (!ZH.shielded(p)) {
            var a = attribsOf(p);
            var armor = Math.min(0.8, (a.defense || 0) / 100);
            p.hp -= z.dmg * (1 - armor);
            ZH.openShield(p, ZH.SHIELD.hit);   /* force field: one window */
            if (p.hp <= 0) { p.hp = 0; p.dead = true; }
            world.shake = Math.max(world.shake || 0, 5);
            if (ZH.Anim && ZH.Anim.hurt) ZH.Anim.hurt();
          }
        }
      }

      if (world.arena) {
        /* open world: nothing to clamp to */
      }
    }
  }

  function updateProjectiles(list, dt, world) {
    var p = world.player;
    for (var i = list.length - 1; i >= 0; i--) {
      var b = list[i];

      /* ---- delay: Drill bursts stagger their shots ---- */
      if (b.delay > 0) { b.delay -= dt; continue; }

      b.life -= dt;
      if (b.life <= 0) { list.splice(i, 1); continue; }

      /* ---- orbits: axe / circular saw ---- */
      if (b.orbit) {
        b.orbitAngle += (b.orbitSpeed || 2) * dt;
        b.x = p.x + Math.cos(b.orbitAngle) * b.orbitRadius;
        b.y = p.y + Math.sin(b.orbitAngle) * b.orbitRadius;
        b.tick = (b.tick || 0) + dt;
        if (b.tick >= (b.tickEvery || 0.3)) {
          b.tick = 0;
          for (var s = 0; s < world.zombies.length; s++) {
            var zs = world.zombies[s];
            if (zs.dead) continue;
            if (Math.hypot(zs.x - b.x, zs.y - b.y) < zs.r + (b.hit || 34)) damageEnemy(world, zs, b.dmg);
          }
        }
        if (b.saw) {
          for (var sb = world.enemyBullets.length - 1; sb >= 0; sb--) {
            var es = world.enemyBullets[sb];
            if (Math.hypot(es.x - b.x, es.y - b.y) < 40) world.enemyBullets.splice(sb, 1);
          }
        }
        continue;
      }

      /* ---- chain lightning ---- */
      if (b.chainTarget) {
        var ct = b.chainTarget;
        var cd2 = Math.hypot(ct.x - b.x, ct.y - b.y) || 1;
        b.x += ((ct.x - b.x) / cd2) * (b.chainSpeed || 600) * dt;
        b.y += ((ct.y - b.y) / cd2) * (b.chainSpeed || 600) * dt;
        if (cd2 < ct.r + 14 || b.life <= 0) {
          splashDamage(world, b.x, b.y, b.splash || 90, b.dmg, { color: 'rgba(150,220,255,0.5)' });
          list.splice(i, 1);
        }
        continue;
      }

      /* ---- moving shots ---- */
      b.px = b.x; b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      /* Aim assist: a locked round curves toward its target instead of
         sailing past a strafing zombie. The turn rate is capped at 6.5 rad/s
         and only applies while the round is still closing, so it reads as a
         marksman leading the body, not a laser. Missed rounds were 29% of all
         shots in a moving horde, which is what made the gun look wrong. */
      if (!b.enemy && b.target && !b.target.dead) {
        var closing = (b.target.x - b.x) * b.vx + (b.target.y - b.y) * b.vy;
        if (closing > 0) {
          var wantA = Math.atan2(b.target.y - b.y, b.target.x - b.x);
          var curA = Math.atan2(b.vy, b.vx);
          var diffA = wantA - curA;
          while (diffA > Math.PI) diffA -= TAU;
          while (diffA < -Math.PI) diffA += TAU;
          var turnA = 6.5 * dt;
          var nextA = Math.abs(diffA) <= turnA ? wantA : curA + (diffA > 0 ? turnA : -turnA);
          var bulletSp = Math.hypot(b.vx, b.vy) || 1;
          b.vx = Math.cos(nextA) * bulletSp;
          b.vy = Math.sin(nextA) * bulletSp;
        }
      } else if (!b.enemy && b.target) {
        b.target = null;
      }

      /* firebomb: explodes on contact or when it lands */
      if (b.firebomb) {
        var landed = b.life <= 0.05;
        if (!landed) {
          for (var fb = 0; fb < world.zombies.length; fb++) {
            var zfb = world.zombies[fb];
            if (zfb.dead) continue;
            if (Math.hypot(zfb.x - b.x, zfb.y - b.y) < zfb.r + 18) { landed = true; break; }
          }
        }
        if (landed) {
          splashDamage(world, b.x, b.y, b.splash, b.fireDmg || 10, { color: 'rgba(255,120,40,0.5)' });
          list.splice(i, 1);
        }
        continue;
      }

      /* boomerang: flies out, then homes back to the hunter */
      if (b.returnTrip) {
        b.travel = (b.travel || 0) + dt;
        if (b.travel > 0.45) {
          var bh = Math.hypot(p.x - b.x, p.y - b.y) || 1;
          var sp = Math.hypot(b.vx, b.vy) || 500;
          b.vx += ((p.x - b.x) / bh) * sp * dt * 4;
          b.vy += ((p.y - b.y) / bh) * sp * dt * 4;
          var vm = Math.hypot(b.vx, b.vy) || 1;
          b.vx = (b.vx / vm) * sp;
          b.vy = (b.vy / vm) * sp;
        }
      }

      /* --- hits something? --- */
      if (!b.enemy) {
        var hit = null;
        for (var j = 0; j < world.zombies.length; j++) {
          var z = world.zombies[j];
          if (z.dead) continue;
          if (b.hits && b.hits[z.seed]) continue;
          // swept test so fast bullets cannot tunnel through
          var segX = b.px, segY = b.py;
          var segDX = b.x - segX, segDY = b.y - segY;
          var segLen2 = segDX * segDX + segDY * segDY;
          var tp = 0;
          if (segLen2 > 0) {
            tp = ((z.x - segX) * segDX + (z.y - segY) * segDY) / segLen2;
            tp = tp < 0 ? 0 : tp > 1 ? 1 : tp;
          }
          var cx = segX + segDX * tp, cy = segY + segDY * tp;
          if (Math.hypot(cx - z.x, cy - z.y) < z.r + b.r) { hit = z; break; }
        }
        if (hit) {
          if (b.hits) b.hits[hit.seed] = 1;
          damageEnemy(world, hit, b.dmg);
          /* impact sparks — a round that connects has to read on screen */
          for (var sk = 0; sk < 3; sk++) {
            var ska = rand(0, TAU), skv = rand(45, 150);
            world.particles.push({
              x: b.x, y: b.y,
              vx: Math.cos(ska) * skv, vy: Math.sin(ska) * skv,
              life: 0.18, max: 0.18, size: 1.9, color: 'rgba(255,238,190,0.92)'
            });
          }
          if (b.splash > 1) splashDamage(world, hit.x, hit.y, b.splash, b.dmg * 0.5, { color: 'rgba(255,170,80,0.45)' });

          if (b.pierce > 0) { b.pierce--; continue; }
          if (b.bounce > 0) {
            b.bounce--;
            // bounce toward another live enemy, else straight back
            var nt = null, nd = Infinity;
            for (var k = 0; k < world.zombies.length; k++) {
              var zk = world.zombies[k];
              if (zk.dead || (b.hits && b.hits[zk.seed])) continue;
              var dk = Math.hypot(zk.x - b.x, zk.y - b.y);
              if (dk < nd) { nd = dk; nt = zk; }
            }
            var speedB = Math.hypot(b.vx, b.vy) || 500;
            if (nt) {
              var na = Math.atan2(nt.y - b.y, nt.x - b.x);
              b.vx = Math.cos(na) * speedB; b.vy = Math.sin(na) * speedB;
            } else {
              b.vx *= -1; b.vy *= -1;
            }
            b.life = Math.max(b.life, 0.8);
            continue;
          }
          list.splice(i, 1);
          continue;
        }
      } else {
        /* enemy shot: hurt the hunter */
        if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r) {
          if (!ZH.shielded(p)) {
            var ar = Math.min(0.8, (attribsOf(p).defense || 0) / 100);
            p.hp -= b.dmg * (1 - ar);
            ZH.openShield(p, ZH.SHIELD.hit);   /* force field: one window */
            if (p.hp <= 0) { p.hp = 0; p.dead = true; }
            world.shake = Math.max(world.shake || 0, 5);
            if (ZH.Anim && ZH.Anim.hurt) ZH.Anim.hurt();
          }
          list.splice(i, 1);
          continue;
        }
      }

      if (b.x < -200 || b.y < -200 || b.x > (world.arena ? world.arena.w + 200 : 99999) ||
          b.y > (world.arena ? world.arena.h + 200 : 99999)) {
        list.splice(i, 1);
      }
    }
  }

  function updatePickups(list, dt, world) {
    var p = world.player;
    var a = attribsOf(p);
    var pickupRange = 150 * (1 + (a.pickup_range_bonus || 0));
    for (var i = list.length - 1; i >= 0; i--) {
      var pk = list[i];
      pk.life -= dt;
      if (pk.life <= 0) { list.splice(i, 1); continue; }
      var d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < pickupRange) {
        pk.x += (p.x - pk.x) / (d || 1) * 260 * dt;
        pk.y += (p.y - pk.y) / (d || 1) * 260 * dt;
      }
      if (d < 22) {
        if (pk.type === 'exp') {
          var gain = pk.value || 10;
          gain = Math.floor(gain + gain * (a.exp_bonus || 0) / 100);
          p.exp += gain;
        } else if (pk.type === 'coin') {
          var cash = (pk.value || 1);
          cash = cash + cash * (a.cash_bonus || 0) / 100;
          world.coins = (world.coins || 0) + Math.round(cash);
        } else if (pk.type === 'treasure') {
          // the original drops a treasure chest that opens the skill slots
          world.coins = (world.coins || 0) + 500;
          if (world.ui && world.ui.showLevelUp) world.ui.showLevelUp();
        } else if (pk.type === 'shield') {
          ZH.openShield(p, pk.value || ZH.SHIELD.hit);
        } else if (pk.type === 'medikit') {
          p.hp = Math.min(p.maxHp, p.hp + (pk.value || 50));
        } else if (pk.type === 'item') {
          if (pk.item === 'supply' && ZH.SUPPLIES[pk.itemId]) {
            if (!p.supplies) p.supplies = {};
            var cur = p.supplies[pk.itemId] || 0;
            var max = ZH.SUPPLIES[pk.itemId].maxLevel || 5;
            p.supplies[pk.itemId] = Math.min(max, cur + 1);
            if (world.recomputeAttribs) world.recomputeAttribs();
            if (world.ui && world.ui.toastItem) world.ui.toastItem(pk.itemId, p.supplies[pk.itemId]);
          }
        }
        list.splice(i, 1);
      }
    }
  }

  /** display glyph + colour for a ground item (used by the renderer) */
  ZH.itemLook = function (id) {
    var LOOK = {
      kevlar: ['K', '#7fb2ff'], ammobooster: ['A', '#ffc46b'], handbook: ['H', '#d8b45c'],
      scope: ['S', '#9fe6ff'], propane: ['P', '#ff9a5c'], magnet: ['M', '#ff7fb0'],
      chronometer: ['C', '#c9a6ff'], actiongloves: ['G', '#ffd166'], energydrink: ['E', '#7dffb0'],
      sneakers: ['N', '#8fe36b'], detector: ['D', '#ffe066'], supplements: ['X', '#ff6b6b'],
      medikit: ['+', '#ff7b7b'], coins: ['$', '#ffd166']
    };
    return LOOK[id] || ['?', '#cccccc'];
  };

  ZH.createSurvivor = createSurvivor;
  ZH.createEnemy = createEnemy;
  ZH.createBoss = createBoss;
  ZH.updateSurvivor = updateSurvivor;
  ZH.updateEnemies = updateEnemies;
  ZH.updateProjectiles = updateProjectiles;
  ZH.updatePickups = updatePickups;
  ZH.fireWeapon = fireWeapon;
  ZH.targetRange = targetRange;
  ZH.viewRange = viewRange;
  ZH.nearestEnemy = nearestEnemy;
  ZH.acquireTarget = acquireTarget;
  /* every damage path (bullets, melee, splash, burn ticks, auras) funnels
     through damageEnemy; exposing it lets the harness measure applied damage
     instead of guessing from health deltas between frames */
  ZH.damageEnemy = damageEnemy;
  ZH.attribsOf = attribsOf;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
