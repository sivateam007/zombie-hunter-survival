/*
 * Meow Zombie Hunter — enemy roster + simulation
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
 * Weapons follow the 20-weapon catalogue in weapons.js; every behaviour
 * below mirrors the original prototype code (orbit axes, fan crossbow,
 * continuous flamethrower, target-seeking Gun, melee Sword, Drill burst,
 * Bazooka rocket, returning Boomerang, bullet-eating Circular, Tesla
 * chain, bouncing SpikedBall, Forcefield aura, Launcher salvo, Molotov,
 * rocket launches, Doomsday blast and Siegebreaker shell).
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

  /* ----------------------------- ring reload -----------------------------
     The missing rounds orbit the hunter while the magazine refills. Tapping
     reload while a round crosses the loading notch seats it perfectly; enough
     perfect seats arm a short HOT MAG damage window. The ring owns only the
     presentation and timing — the game owns the magazine. */
  ZH.RELOAD_RING = {
    speed: 4.2,          /* radians per second                         */
    window: 0.5,         /* half-width of the loading notch, radians   */
    maxPips: 6,          /* readable at a glance on a phone            */
    minTime: 0.55,       /* a reload never becomes instant             */
    hotFrac: 0.6,        /* share of perfect seats that arms HOT MAG   */
    hotTime: 5,          /* seconds of boosted damage                  */
    hotMul: 1.2          /* +20% damage while HOT MAG runs             */
  };

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /** start a ring for `count` missing rounds; returns the ring state */
  ZH.startReloadRing = function (p, opts) {
    if (!p) return null;
    opts = opts || {};
    var count = Math.max(1, Math.min(ZH.RELOAD_RING.maxPips, Math.floor(opts.count || 1)));
    var step = (Math.PI * 2) / count;
    var pips = [];
    for (var i = 0; i < count; i++) pips.push({ a: wrapAngle(-Math.PI / 2 + 0.35 + i * step) });
    p.reloadRing = {
      active: true,
      name: opts.name || '',
      pips: pips,
      total: count,
      seated: 0,
      perfect: 0,
      elapsed: 0,
      time: Math.max(ZH.RELOAD_RING.minTime, opts.time || 1),
      speed: ZH.RELOAD_RING.speed,
      window: ZH.RELOAD_RING.window
    };
    return p.reloadRing;
  };

  /** advance the orbit; returns 'timeout' when the window closes */
  ZH.tickReloadRing = function (p, dt) {
    var r = p && p.reloadRing;
    if (!r || !r.active) return null;
    var d = Math.max(0, dt || 0);
    r.elapsed += d;
    for (var i = 0; i < r.pips.length; i++) {
      r.pips[i].a = wrapAngle(r.pips[i].a + r.speed * d);
    }
    if (r.elapsed >= r.time) return 'timeout';
    return null;
  };

  /** seat the round nearest the loading notch; false when the tap is early */
  ZH.seatReloadRing = function (p) {
    var r = p && p.reloadRing;
    if (!r || !r.active || !r.pips.length) return null;
    var notch = -Math.PI / 2;
    var best = -1, bestD = Infinity;
    for (var i = 0; i < r.pips.length; i++) {
      var d = Math.abs(wrapAngle(r.pips[i].a - notch));
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0 || bestD > r.window) return { ok: false };
    r.pips.splice(best, 1);
    r.seated++;
    r.perfect++;
    return { ok: true, perfect: r.perfect, seated: r.seated, done: r.pips.length === 0 };
  };

  /** close the ring and report the reward; the game fills the magazine */
  ZH.finishReloadRing = function (p) {
    var r = p && p.reloadRing;
    if (!r) return null;
    var res = {
      perfect: r.perfect,
      total: r.total,
      hot: r.perfect >= Math.ceil(r.total * ZH.RELOAD_RING.hotFrac)
    };
    r.active = false;
    p.reloadRing = null;
    return res;
  };

  /* ----------------------------- jetpack -----------------------------
     A tactical short-burst jet, not a slow balloon: ignition costs a chunk of
     fuel and kicks the hunter forward for a moment, the tank gives ~4 s of
     flight, and a grounded hunter refills in ~3 s. Running dry locks the
     jets until the button is released, so the pack cannot stutter on fumes. */
  ZH.JETPACK = ZH.JETPACK || {
    max: 100,
    drain: 22,        /* ~4.5 s of continuous flight from a full tank  */
    regen: 36,        /* ~2.8 s to refill on the ground                */
    min: 18,          /* cannot ignite below this                      */
    cost: 8,          /* ignition burns a little extra                 */
    speed: 1.85,      /* hover speed multiplier                        */
    burstSpeed: 2.35, /* the take-off kick, for `burst` seconds        */
    burst: 0.35,
    lift: 24,
    thrustForward: 0.6 /* forward nudge while thrusting with no input  */
  };

  /** one hold-to-fly fuel clock */
  ZH.tickJetpack = function (p, dt, held) {
    if (!p) return 0;
    var j = ZH.JETPACK;
    if (p.jetFuel == null) p.jetFuel = j.max;
    if (p.jetBurst == null) p.jetBurst = 0;
    /* dry tank: the pack is locked until the button comes up, then it may
       ignite again as soon as it has the minimum charge */
    if (!held) p.jetLock = false;
    if (!p.jetActive) {
      if (held && !p.dead && !p.jetLock && p.jetFuel >= j.min) {
        p.jetActive = true;
        p.jetFuel = Math.max(0, p.jetFuel - (j.cost || 0));
        p.jetBurst = j.burst || 0;
        if (ZH.Audio) ZH.Audio.play('dash');
      }
    } else if (!held || p.dead || p.jetFuel <= 0) {
      p.jetActive = false;
    }
    if (p.jetActive) {
      p.jetFuel = Math.max(0, p.jetFuel - j.drain * dt);
      if (p.jetBurst > 0) p.jetBurst = Math.max(0, p.jetBurst - dt);
      if (p.jetFuel <= 0) { p.jetActive = false; p.jetLock = true; }
    } else {
      p.jetBurst = 0;
      /* a held (but locked) pack does not recharge: the hunter has to let go
         and land before the tank refills, which is what makes fuel a resource */
      if (!held) p.jetFuel = Math.min(j.max, p.jetFuel + j.regen * dt);
    }
    if (p.jetActive) p.jetLift = Math.min(j.lift || 18, (p.jetLift || 0) + 110 * dt);
    else p.jetLift = Math.max(0, (p.jetLift || 0) - 110 * dt);
    return p.jetFuel;
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
    swarmCeiling: 6,                             /* the opening minutes stay quiet */
    /* ------------------------- the ramp -------------------------
       A run opens at the medium budget and grows from there: the field cap,
       the absolute ceiling, the feed interval and the per-wave cap all drift
       with the clock, so minute 15 has to be fought differently from minute
       one. Without this the horde stayed identical for 20 minutes and late
       waves felt like the opening ones with tougher skins. */
    ramp: [
      /* the first two minutes hold the medium field the game was tuned for */
      { at: 0,    near: 6,  hard: 22, feed: 1.00, wave: 1.00 },
      { at: 120,  near: 6,  hard: 22, feed: 1.00, wave: 1.00 },
      { at: 240,  near: 10, hard: 34, feed: 0.85, wave: 1.20 },
      { at: 420,  near: 14, hard: 46, feed: 0.76, wave: 1.40 },
      { at: 600,  near: 18, hard: 58, feed: 0.68, wave: 1.60 },
      { at: 900,  near: 23, hard: 74, feed: 0.60, wave: 1.75 },
      { at: 1200, near: 27, hard: 88, feed: 0.54, wave: 1.90 }
    ]
  };

  /** is the horde currently feeding or resting? (one clock for the whole run) */
  ZH.hordeWindow = function (clock) {
    var s = ZH.HORDE.surge, span = s.spawn + s.rest;
    var t = Math.max(0, clock || 0) % span;
    return { spawning: t < s.spawn, phase: t < s.spawn ? 'surge' : 'lull', t: t, span: span };
  };

  /** the horde budget at a given second of the run: near cap, absolute cap,
      feed-interval multiplier and per-wave cap multiplier, linearly blended
      between the ramp stops (and clamped at both ends) */
  ZH.hordeBudget = function (seconds) {
    var ramp = (ZH.HORDE && ZH.HORDE.ramp) || [];
    var t = Math.max(0, isFinite(seconds) ? seconds : 0);
    if (!ramp.length) {
      return { near: ZH.HORDE.nearCap, hard: ZH.HORDE.hardCap, feed: 1, wave: 1 };
    }
    function copy(s) { return { near: s.near, hard: s.hard, feed: s.feed, wave: s.wave }; }
    if (t <= ramp[0].at) return copy(ramp[0]);
    for (var i = 1; i < ramp.length; i++) {
      var a = ramp[i - 1], b = ramp[i];
      if (t > b.at) continue;
      var k = (t - a.at) / Math.max(1, b.at - a.at);
      return {
        near: a.near + (b.near - a.near) * k,
        hard: a.hard + (b.hard - a.hard) * k,
        feed: a.feed + (b.feed - a.feed) * k,
        wave: a.wave + (b.wave - a.wave) * k
      };
    }
    return copy(ramp[ramp.length - 1]);
  };

  /* ------------------- waves, stages and the idle siege -------------------
     A stage is 20 waves of 60 seconds — exactly the authored
     TIME_LEVEL_COMPLETED window — so "survive wave 20" and "survive 20
     minutes" are the same moment. The HUD counts 1..20 instead of running
     past the stage length, and the next stage deploys automatically. */
  ZH.WAVE_SECONDS = 60;
  ZH.WAVES_PER_STAGE = 20;

  ZH.waveNumber = function (elapsed, endless) {
    var n = Math.floor(Math.max(0, elapsed || 0) / ZH.WAVE_SECONDS) + 1;
    if (endless) return n;
    return Math.max(1, Math.min(ZH.WAVES_PER_STAGE, n));
  };

  /* Standing still is a choice with a price: the street notices. Once the
     hunter has held position for `grace` seconds the siege feeds extra bodies
     from close range on a cadence that tightens with the run clock, up to a
     bounded overspill above the normal field cap. */
  ZH.SIEGE = {
    grace: 0.8,
    extraCap: 34,
    cadence: [
      { at: 0,    s: 1.1 },
      { at: 120,  s: 0.9 },
      { at: 300,  s: 0.7 },
      { at: 600,  s: 0.52 },
      { at: 900,  s: 0.4 },
      { at: 1200, s: 0.3 }
    ]
  };

  ZH.siegeCadence = function (seconds) {
    var c = (ZH.SIEGE && ZH.SIEGE.cadence) || [];
    var t = Math.max(0, isFinite(seconds) ? seconds : 0);
    if (!c.length) return 1.5;
    if (t <= c[0].at) return c[0].s;
    for (var i = 1; i < c.length; i++) {
      var a = c[i - 1], b = c[i];
      if (t > b.at) continue;
      var k = (t - a.at) / Math.max(1, b.at - a.at);
      return a.s + (b.s - a.s) * k;
    }
    return c[c.length - 1].s;
  };

  /** how many bodies one siege tick drops: 2 at the opening, 4 late */
  ZH.siegeBurst = function (seconds) {
    return 2 + Math.min(2, Math.floor(Math.max(0, seconds || 0) / 450));
  };

  /** siege bodies get tougher with the run clock, on top of stage scaling */
  ZH.siegePower = function (seconds) {
    var t = Math.max(0, Math.min(1200, seconds || 0));
    return 1 + (t / 1200) * 0.85;
  };

  /** scrap for clearing a wave; the difficulty reward multiplies it */
  ZH.waveClearReward = function (wave, difficultyReward) {
    var w = Math.max(1, Math.floor(wave || 1));
    return Math.round((20 + w * 8) * (difficultyReward || 1));
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
    bat:      { name: 'Bat',           hp: 10,   speed: 500, dmg: 3,  range: 40,  cd: 1.0,  scale: .85, coins: 100,  variant: 'crawler', mass: 2 },
    toxic1:   { name: 'Toxic',         hp: 10,   speed: 200, dmg: 5,  range: 10,  cd: 1.0,  scale: 1.0, coins: 300,  variant: 'spitter', mass: 2 },
    toxic2:   { name: 'Toxic Brute',   hp: 150,  speed: 250, dmg: 7,  range: 10,  cd: 1.0,  scale: 1.0, coins: 1000, variant: 'spitter', mass: 2 },
    manager:  { name: 'Manager',       hp: 15,   speed: 100, dmg: 3,  range: 50,  cd: 1.0,  scale: .85, coins: 300,  variant: 'walker' },
    cop:      { name: 'Cop',           hp: 25,   speed: 100, dmg: 5,  range: 50,  cd: 1.0,  scale: .85, coins: 300,  variant: 'walker', ranged: true, shotSpeed: 520 },
    reptile:  { name: 'Reptile',       hp: 50,   speed: 250, dmg: 6,  range: 40,  cd: 1.0,  scale: .85, coins: 300,  variant: 'runner', mass: 1 },
    slug:     { name: 'Slug',          hp: 500,  speed: 50,  dmg: 20, range: 10,  cd: 1.0,  scale: .85, coins: 3000, variant: 'brute' },
    builder:  { name: 'Builder',       hp: 300,  speed: 100, dmg: 10, range: 40,  cd: 1.0,  scale: .85, coins: 1000, variant: 'brute' },
    spider1:  { name: 'Spider',        hp: 200,  speed: 150, dmg: 20, range: 40,  cd: 1.0,  scale: .85, coins: 1000, variant: 'crawler' },
    spider2:  { name: 'Spider Queen',  hp: 400,  speed: 200, dmg: 30, range: 40,  cd: 1.0,  scale: .85, coins: 3000, variant: 'crawler' },
    tower1:   { name: 'Turret',        hp: 200,  speed: 0,   dmg: 5,  range: 125, cd: 0.35, scale: .9,  coins: 300,  variant: 'brute', static: true, ranged: true, shotSpeed: 480 },
    tower2:   { name: 'Heavy Turret',  hp: 700,  speed: 0,   dmg: 5,  range: 125, cd: 3.0,  scale: .9,  coins: 3000, variant: 'brute', static: true, ranged: true, shotSpeed: 520 },
    assault1: { name: 'Assault',       hp: 400,  speed: 150, dmg: 7,  range: 50,  cd: 1.0,  scale: .85, coins: 3000, variant: 'runner', ranged: true, shotSpeed: 540 },
    assault2: { name: 'Assault Elite', hp: 400,  speed: 150, dmg: 7,  range: 50,  cd: 1.0,  scale: .85, coins: 3000, variant: 'runner', ranged: true, shotSpeed: 540, spreadShots: 3 },

    miniboss_builder: { name: 'MINIBOSS: BUILDER', hp: 4000, speed: 150, dmg: 20, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'butcher', miniboss: true, mass: 5 },
    miniboss_fighter: { name: 'MINIBOSS: FIGHTER', hp: 5500, speed: 200, dmg: 25, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'butcher', miniboss: true, mass: 5 },
    miniboss_spider:  { name: 'MINIBOSS: SPIDER',  hp: 5000, speed: 300, dmg: 40, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'crawler', miniboss: true, mass: 5 },
    miniboss_reptile: { name: 'MINIBOSS: REPTILE', hp: 3500, speed: 300, dmg: 30, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'runner', miniboss: true, mass: 5 },
    miniboss_toxic1:  { name: 'MINIBOSS: TOXIC',   hp: 3000, speed: 200, dmg: 30, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'spitter', miniboss: true, mass: 5 },
    miniboss_toxic2:  { name: 'MINIBOSS: TOXIC II', hp: 3500, speed: 250, dmg: 35, range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'spitter', miniboss: true, mass: 5 },
    miniboss_soldier: { name: 'MINIBOSS: SOLDIER', hp: 4500, speed: 100, dmg: 7,  range: 60, cd: 1.0, scale: .85, coins: 10000, variant: 'walker', miniboss: true, mass: 5, ranged: true, shotSpeed: 560,
      pattern: { kind: 'ring', count: 8, cd: 2.4, range: 700, dmg: 6 } },
    miniboss_tower:   { name: 'MINIBOSS: TOWER',   hp: 6000, speed: 0,   dmg: 5,  range: 125, cd: 0.45, scale: .9, coins: 10000, variant: 'brute', miniboss: true, mass: 5, static: true, ranged: true, shotSpeed: 520,
      pattern: { kind: 'ring', count: 8, cd: 1.8, range: 900, dmg: 5 } }
  };

  /* ------------------------------- bosses ------------------------------- */
  var BOSS_TYPES = {
    /* Each boss now runs the original's behaviour-list shape: a cycle of
       movement / attack steps rather than one repeating volley. The old
       signature `pattern` stays as the first readable attack and is also a
       step, so rings, fans, streams and summons remain in play. */
    boss_soldier: { name: 'BOSS: SOLDIER', hp: 8000,  speed: 110, dmg: 18, range: 46, cd: 0.9, scale: 1.7, coins: 20000, variant: 'boss', mass: 5,
      pattern: { kind: 'fan', count: 5, spread: 0.32, cd: 1.8, range: 700, dmg: 9 },
      behaviour: [
        { kind: 'fan', count: 5, spread: 0.32, duration: 1.8, range: 700, dmg: 9, volleys: 2, volleyGap: 0.5 },
        { kind: 'roam', duration: 1.0, speed: 0.2 },
        { kind: 'fan', count: 5, spread: 0.32, duration: 1.8, range: 700, dmg: 9, volleys: 2, volleyGap: 0.5 },
        { kind: 'mortar', count: 1, duration: 2.0, range: 900, dmg: 30, radius: 80, flight: 1.05 },
        { kind: 'roam', duration: 1.0, speed: 0.2 },
        { kind: 'fan', count: 5, spread: 0.32, duration: 1.8, range: 700, dmg: 9, volleys: 2, volleyGap: 0.5 }
      ] },
    boss_tower:   { name: 'BOSS: TOWER',   hp: 9000,  speed: 0,   dmg: 12, range: 150, cd: 0.8, scale: 1.7, coins: 20000, variant: 'warden', static: true, ranged: true, shotSpeed: 520, mass: 5,
      pattern: { kind: 'ring', count: 12, cd: 1.8, range: 900, dmg: 9 },
      behaviour: [
        { kind: 'ring', count: 12, duration: 1.8, range: 900, dmg: 9 },
        { kind: 'fan', count: 4, spread: 0.45, duration: 1.5, range: 900, dmg: 8 },
        { kind: 'ring', count: 12, duration: 1.8, range: 900, dmg: 9 },
        { kind: 'fan', count: 4, spread: 0.45, duration: 1.5, range: 900, dmg: 8 }
      ] },
    boss_dragon:  { name: 'BOSS: DRAGON',  hp: 12000, speed: 130, dmg: 24, range: 52, cd: 0.9, scale: 1.8, coins: 25000, variant: 'butcher', mass: 5,
      pattern: { kind: 'stream', count: 10, gap: 0.12, cd: 2.8, range: 800, dmg: 10 },
      behaviour: [
        { kind: 'stream', count: 10, gap: 0.12, duration: 3.0, range: 800, dmg: 10 },
        { kind: 'fan', count: 5, spread: 0.32, duration: 1.7, range: 750, dmg: 9 },
        { kind: 'stream', count: 10, gap: 0.12, duration: 3.0, range: 800, dmg: 10 }
      ] },
    boss_reptile: { name: 'BOSS: REPTILE', hp: 10000, speed: 170, dmg: 22, range: 50, cd: 0.9, scale: 1.7, coins: 22000, variant: 'matron', mass: 5,
      pattern: { kind: 'summon', type: 'reptile', count: 3, cd: 4.5, range: 900 },
      behaviour: [
        { kind: 'charge', windup: 0.7, dash: 0.5, speed: 700, duration: 2.8, range: 1200 },
        { kind: 'charge', windup: 0.7, dash: 0.5, speed: 700, duration: 2.8, range: 1200 },
        { kind: 'charge', windup: 0.7, dash: 0.5, speed: 700, duration: 2.8, range: 1200 },
        { kind: 'summon', type: 'reptile', count: 4, duration: 2.2, range: 900 }
      ] },
    boss_mutant:  { name: 'BOSS: MUTANT',  hp: 14000, speed: 100, dmg: 28, range: 54, cd: 0.9, scale: 1.9, coins: 28000, variant: 'butcher', mass: 5,
      pattern: { kind: 'summon', type: 'slime2', count: 3, cd: 4.5, range: 900 },
      behaviour: [
        { kind: 'charge', windup: 0.5, dash: 0.5, speed: 720, duration: 2.4, range: 1200 },
        { kind: 'teleport', windup: 0.35, dist: 260, duration: 1.4 },
        { kind: 'summon', type: 'slime2', count: 4, duration: 2.3, range: 900 },
        { kind: 'charge', windup: 0.5, dash: 0.5, speed: 720, duration: 2.4, range: 1200 }
      ] },
    boss_spider:  { name: 'BOSS: SPIDER',  hp: 11000, speed: 180, dmg: 26, range: 50, cd: 0.9, scale: 1.7, coins: 24000, variant: 'crawler', mass: 5,
      pattern: { kind: 'summon', type: 'spider1', count: 3, cd: 4.0, range: 900 },
      behaviour: [
        { kind: 'mortar', count: 1, duration: 2.2, range: 900, dmg: 20, radius: 190, flight: 1.1 },
        { kind: 'roam', duration: 1.0, speed: 0.2 },
        { kind: 'mortar', count: 1, duration: 2.2, range: 900, dmg: 20, radius: 190, flight: 1.1 },
        { kind: 'summon', type: 'spider1', count: 3, duration: 2.0, range: 900 },
        { kind: 'roam', duration: 1.0, speed: 0.2 },
        { kind: 'mortar', count: 3, spread: 0.4, duration: 2.0, range: 800, dmg: 0, radius: 80, flight: 0.9, acid: true }
      ] },
    boss_fighter: { name: 'BOSS: FIGHTER', hp: 9000,  speed: 150, dmg: 20, range: 48, cd: 0.9, scale: 1.7, coins: 20000, variant: 'boss', mass: 5,
      pattern: { kind: 'fan', count: 3, spread: 0.45, cd: 1.6, range: 700, dmg: 8 },
      behaviour: [
        { kind: 'charge', windup: 0.7, dash: 0.45, speed: 760, duration: 2.5, range: 1100 },
        { kind: 'fan', count: 3, spread: 0.45, duration: 1.6, range: 700, dmg: 8 },
        { kind: 'charge', windup: 0.7, dash: 0.45, speed: 760, duration: 2.5, range: 1100 }
      ] }
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
      jetFuel: 100, jetMax: 100, jetActive: false, jetLift: 0,
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
      mass: def.mass || 0,
      pattern: def.pattern || null,
      ringPhase: 0,
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
      mass: def.mass || 5,
      pattern: def.pattern || null,
      behaviour: def.behaviour ? def.behaviour.slice() : (def.pattern ? [def.pattern] : []),
      step: 0, stepT: 0, stepStarted: false, act: null,
      ringPhase: 0,
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
    /* survivor power: crits, executes and berserk scale the hit here */
    if (ZH.Powers) dmg = ZH.Powers.modifyDamage(world, z, dmg);
    /* 9 = DEAL_X_DMG: contracts count the damage that actually lands */
    if (ZH.Missions) ZH.Missions.update(9, dmg);
    /* diagnostics hook: the harness reads the damage that actually lands */
    if (ZH.onDamage) ZH.onDamage(world, z, dmg);
    z.hp -= dmg;
    z.hurtFlash = 0.2;
    /* impact impulse: a body that takes a hit moves with it, so shots read as
       force and not just as a number popping over a sprite. Bosses shrug it
       off; a knockback is capped so nothing is thrown across the street. */
    var hp = world.player;
    if (hp && !z.boss && !z.stationary) {
      var kAng = Math.atan2(z.y - hp.y, z.x - hp.x);
      var kB = Math.min(160, 34 + dmg * 1.4);
      z.kx = (z.kx || 0) + Math.cos(kAng) * kB;
      z.ky = (z.ky || 0) + Math.sin(kAng) * kB;
      var kM = Math.hypot(z.kx, z.ky);
      if (kM > 240) { z.kx = z.kx / kM * 240; z.ky = z.ky / kM * 240; }
    }
    /* a fresh splash under the body now and then: the street keeps a record of
       the fight between the bigger death pools */
    if (world.decals && world.decals.length < 180 && Math.random() < 0.16) {
      world.decals.push({
        x: z.x + rand(-6, 6), y: z.y + rand(-2, 8),
        r: rand(2.4, 5.2), rot: rand(0, TAU), alpha: 0.3
      });
    }
    /* survivor power: burn, chain arcs and splash land after the hit */
    if (ZH.Powers) ZH.Powers.onHit(world, z, dmg);
    /* life discharge: a share of every hit flows back into the hunter, with
       a pink siphon burst once enough has accumulated to be worth showing */
    var sip = world.player;
    if (sip && !sip.dead && sip.hp != null && sip.maxHp) {
      /* only a lifesteal power returns health; there is no passive trickle */
      var frac = sip.lifesteal || 0;
      var gain = Math.min((ZH.LIFESTEAL && ZH.LIFESTEAL.max) || 2.5, dmg * frac);
      if (gain > 0.02 && sip.hp < sip.maxHp) {
        sip.hp = Math.min(sip.maxHp, sip.hp + gain);
        world._siphon = (world._siphon || 0) + gain;
        if (world._siphon >= 1.5 && world.floaters && world.floaters.length < 70) {
          world.floaters.push({
            text: '+' + Math.round(world._siphon), x: sip.x + rand(-5, 5),
            y: sip.y - 44, vy: -40, life: 0.7, max: 0.7, size: 13,
            color: '#ff9ad5'
          });
          if (world.particles && world.particles.length < 240) {
            for (var lf = 0; lf < 3; lf++) {
              world.particles.push({
                x: sip.x + rand(-8, 8), y: sip.y + rand(-20, 4),
                vx: rand(-40, 40), vy: rand(-70, -20), life: 0.4, max: 0.4,
                size: rand(1.4, 2.6), color: 'rgba(255,150,205,0.9)'
              });
            }
          }
          world._siphon = 0;
        }
      }
    }
    /* damage number: the hit proves itself in the world, not only on the bar */
    if (world.floaters && world.floaters.length < 70) {
      world.floaters.push({
        text: String(Math.max(1, Math.round(dmg))),
        x: z.x + rand(-6, 6), y: z.y - (z.boss ? 62 : 34),
        vy: -46, life: 0.62, max: 0.62,
        size: z.boss ? 20 : 14,
        color: z.boss || z.miniboss ? '#ffd166' : '#ffe9a8'
      });
    }
    /* impact sparks: on pale hospital tile, blue canal stone and rainy
       rooftops a tracer alone can vanish. A short bright burst at the body
       proves the round connected in every district. */
    if (world.particles && world.particles.length < 240) {
      for (var sp = 0; sp < 2; sp++) {
        world.particles.push({
          x: z.x + rand(-5, 5), y: z.y + rand(-9, 3),
          vx: rand(-80, 80), vy: rand(-120, -25),
          life: 0.16, max: 0.16, size: rand(1.6, 3),
          color: 'rgba(255,240,190,0.95)'
        });
      }
    }
    if (z.hp <= 0) {
      z.dead = true;
      if (world.player) world.player.kills = (world.player.kills || 0) + 1;
      /* contracts: kills, bosses, minibosses and opened crates */
      if (ZH.Missions) {
        if (z.type === 'box' || z.type === 'treasure') {
          ZH.Missions.update(12, 1);              /* OPEN_X_CRATES */
        } else {
          ZH.Missions.update(2, 1);               /* KILL_ENEMIES */
          if (z.boss) ZH.Missions.update(4, 1);   /* KILL_BOSSES */
          else if (z.miniboss) ZH.Missions.update(3, 1);
        }
      }
      world.score = (world.score || 0) + 10;
      if (ZH.Powers) ZH.Powers.onKill(world, z);
      /* deadshot: toxic and slime deaths leave a lingering acid pool */
      var ACID = {
        toxic1: [5, 2], toxic2: [7, 2], slime1: [3, 1], slime2: [5, 1],
        miniboss_toxic1: [7, 3], miniboss_toxic2: [7, 3]
      };
      if (ACID[z.type]) {
        world.hazards = world.hazards || [];
        if (world.hazards.length < 40) {
          world.hazards.push({
            x: z.x, y: z.y, r: 42,
            dmg: ACID[z.type][0], life: ACID[z.type][1], tick: 0
          });
        }
      }
      /* deadshot: the manager's briefcase is a destroyable projectile, not
         another acid pool. It travels at .28 px/ms and hits for 10. */
      if (z.type === 'manager' && world.player) {
        world.briefcases = world.briefcases || [];
        var ba = Math.atan2(world.player.y - z.y, world.player.x - z.x) + rand(-0.22, 0.22);
        if (world.briefcases.length < 12) {
          world.briefcases.push({
            x: z.x, y: z.y, vx: Math.cos(ba) * 280, vy: Math.sin(ba) * 280,
            hp: 20, maxHp: 20, r: 14, dmg: 10,
            rot: rand(0, TAU), rotSpeed: 0.6, life: 8, flash: 0
          });
        }
      }
      /* deadspawn: slime2 breaks into two slime1, slug into two slime2 */
      var SPLIT = { slime2: 'slime1', slug: 'slime2' };
      if (SPLIT[z.type] && world.zombies && world.zombies.length < 160) {
        for (var spn = 0; spn < 2; spn++) {
          var child = createEnemy(SPLIT[z.type],
            z.x + rand(-14, 14), z.y + rand(-10, 10),
            (world.stage && world.stage.multiplier) || 1,
            world.diff, world.waveCycle || 0);
          if (child) { child.spawnT = 0.25; world.zombies.push(child); }
        }
      }
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
      /* blood spray on death: a corpse should not simply pop out of view */
      if (world.particles && world.particles.length < 220) {
        var bursts = z.boss ? 14 : 6;
        for (var bp = 0; bp < bursts; bp++) {
          world.particles.push({
            x: z.x + rand(-5, 5), y: z.y + rand(-10, 2),
            vx: rand(-140, 140), vy: rand(-180, -20), grav: 260,
            life: rand(0.24, 0.48), max: 0.48, size: rand(1.6, 3.4),
            color: 'rgba(150,26,20,0.85)'
          });
        }
      }
      if (z.coins || z.boss) {
        world.pickups.push({ type: 'coin', x: z.x + rand(-8, 8), y: z.y + rand(-8, 8), life: 12, value: z.coins || 5 });
      }
      /* miniboss deaddrops, exactly the original's per-type table: a bomb from
         the soldiers/towers, a medkit from the toxic ones, a magnet from the
         builder, a chest or a coin pile from the rest */
      var DEADDROP = {
        miniboss_builder: 'magnet', miniboss_fighter: 'coin',
        miniboss_spider: 'treasure', miniboss_reptile: 'treasure',
        miniboss_soldier: 'bomb', miniboss_tower: 'coin',
        miniboss_toxic1: 'medikit', miniboss_toxic2: 'coin'
      };
      /* exact original payouts: tower 1,500 · toxic2 500 · fighter 1,000;
         chests carry their card count (reptile 1, spider 3) */
      var DROP_DATA = {
        miniboss_tower: 1500, miniboss_toxic2: 500, miniboss_fighter: 1000,
        miniboss_spider: 3, miniboss_reptile: 1
      };
      if (z.miniboss && DEADDROP[z.type]) {
        var drop = DEADDROP[z.type];
        var dropPk = { type: drop, x: z.x, y: z.y - 8, life: 45 };
        if (drop === 'coin') dropPk.value = DROP_DATA[z.type] || 1000;
        if (drop === 'treasure') dropPk.value = DROP_DATA[z.type] || 1;
        if (drop === 'medikit') dropPk.value = 60;
        world.pickups.push(dropPk);
      }
      /* the ordinary horde rarely leaves a bomb or a medkit as well */
      if (!z.boss && !z.miniboss) {
        var rollDrop = Math.random();
        if (rollDrop < 0.004) {
          world.pickups.push({ type: 'bomb', x: z.x, y: z.y - 6, life: 40 });
        } else if (rollDrop < 0.014) {
          world.pickups.push({ type: 'medikit', x: z.x, y: z.y - 6, life: 40, value: 45 });
        } else if (rollDrop < 0.022) {
          world.pickups.push({ type: 'food', x: z.x, y: z.y - 6, life: 40, value: 100 });
        }
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
    /* expanding shockwave ring: the blast needs an edge, not only a blob */
    world.particles.push({
      x: x, y: y, vx: 0, vy: 0, life: 0.3, max: 0.3,
      size: radius, ring: true, color: opts.color || 'rgba(255,170,90,0.8)'
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
  function acquireTarget(world, p, range, key) {
    if (!world || !world.zombies) return null;
    var list = world.zombies;
    var store = null, keep;
    if (key != null) {
      store = p._locks || (p._locks = {});
      keep = store[key];
    } else {
      keep = p._lock;
    }
    var keepD = Infinity;
    if (keep && !keep.dead && list.indexOf(keep) !== -1) {
      keepD = Math.hypot(keep.x - p.x, keep.y - p.y);
      if (range && keepD > range) keep = null;
    } else if (keep) {
      keep = null;
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
    if (store) store[key] = best; else p._lock = best;
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

  function aimAtNearest(world, p, range, fallback, key) {
    var z = acquireTarget(world, p, range, key);
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
    /* no practical cap: on a 5K/8K ultrawide a zombie can stand 3000+ px
       from the hunter and still be visible. Capping acquisition left those
       bodies on screen but unshootable, which read as the gun ignoring them. */
    return Math.max(range, Math.min(6000, seen + 100));
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
    var hot = (world && world.player && world.player.hotT > 0) ? ZH.RELOAD_RING.hotMul : 1;
    var dmg = def.dmg * atk * mul * (1 + (a.attack_bonus || 0)) * scale * hot;
    var speed = (def.speed || 600) * (1 + (a.shot_speed_bonus || 0));
    var range = (def.range || 400) * (1 + (a.shot_range_bonus || 0));
    var cd = def.cooldown * (1 - Math.min(0.7, a.cooldown_bonus || 0));
    var aim = p.aimDir || 0;
    var i, ang;
    var acquire = targetRange(def, world, range);
    if (world) world._shotFired = true;

    /* acquire before switching so every ranged case fires at a body, not at
       the direction the thumbstick happened to be pointing */
    if (AUTO_AIM[def.behaviour]) aim = aimAtNearest(world, p, acquire, aim, id);

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
        var tgt = acquireTarget(world, p, acquire, id);
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
      /* the muzzle throws light on the street for a frame or two: additive,
         not another opaque dot */
      world.particles.push({
        x: mx, y: my, vx: 0, vy: 0, life: 0.1, max: 0.1,
        size: def.behaviour === 'rocket' ? 64 : def.behaviour === 'stream' ? 22 : 36,
        blend: 'lighter', color: 'rgba(255,206,132,0.30)'
      });
      /* and the hunter is pushed back by it */
      p.recoil = Math.max(p.recoil || 0, def.behaviour === 'rocket' ? 0.18 : 0.1);
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
    /* recoil kick from the last shot, purely cosmetic: the rig leans back */
    if (p.recoil) p.recoil = Math.max(0, p.recoil - dt * 1.4);
    /* HOT MAG is a short reward window, never a permanent buff */
    if (p.hotT > 0) p.hotT = Math.max(0, p.hotT - dt);

    var mx = p.moveX, my = p.moveY;
    var len = Math.hypot(mx, my);
    var a = attribsOf(p);
    var jet = ZH.JETPACK || {};
    var speed = p.speed * (1 + (a.speed_bonus || 0)) *
      (p.jetActive ? ((p.jetBurst > 0 ? jet.burstSpeed : jet.speed) || 1.6) : 1);
    if (len > 0.01) {
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      p.walkPhase += dt * 8;
    } else if (p.jetActive) {
      /* Mini Militia style: holding thrust with no stick input still gives a
         forward nudge in the aim direction, so the pack is never dead air */
      var fwd = (jet.thrustForward || 0.55) * (p.jetBurst > 0 ? 1.4 : 1);
      p.x += Math.cos(p.aimDir || 0) * p.speed * fwd * dt;
      p.y += Math.sin(p.aimDir || 0) * p.speed * fwd * dt;
      p.walkPhase += dt * 6;
    }
    /* a live boss zone is a sealed arena: the hunter stays inside the rect */
    if (world.bossZoneActive && world.bossZoneRect) {
      var br = world.bossZoneRect;
      if (p.x < br.x0) p.x = br.x0;
      if (p.x > br.x1) p.x = br.x1;
      if (p.y < br.y0) p.y = br.y0;
      if (p.y > br.y1) p.y = br.y1;
    }

    /* open world: no walls — the city keeps generating in every direction */

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

        var lock = acquireTarget(world, p, prange, primId);
        if (lock) {
          p.aimDir = Math.atan2(lock.y - p.y, lock.x - p.x);
          if (Math.abs(lock.x - p.x) > 6) p.facing = lock.x >= p.x ? 1 : -1;
        }
      }
    }

    /* health never regenerates on its own: only packs and gifts heal */
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

  /* Soft body separation: the horde used to stack into a single black dot
     when a wave converged. A cheap pairwise push spreads the bodies into a
     ring around the hunter (the original's `mass` idea, without collisions). */
  function separateHorde(list) {
    if (list.length > 140) return;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.dead || a.boss) continue;
      for (var j = i + 1; j < list.length; j++) {
        var b = list[j];
        if (b.dead || b.boss) continue;
        var dx = b.x - a.x, dy = b.y - a.y;
        var min = (a.r || 12) + (b.r || 12);
        var d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        if (d2 < 0.0001) {
          /* perfectly stacked bodies have no direction to separate along:
             split them on a golden-angle fan so a spawn pile unfolds */
          var sep = min * 0.35;
          var sa = (i * 2.399963) + (j * 1.618034);
          if (!a.stationary) { a.x -= Math.cos(sa) * sep; a.y -= Math.sin(sa) * sep; }
          if (!b.stationary) { b.x += Math.cos(sa) * sep; b.y += Math.sin(sa) * sep; }
          continue;
        }
        var d = Math.sqrt(d2);
        var push = (min - d) * 0.5;
        var ux = dx / d, uy = dy / d;
        if (!a.stationary) { a.x -= ux * push; a.y -= uy * push; }
        if (!b.stationary) { b.x += ux * push; b.y += uy * push; }
      }
    }
  }

  /* A scripted boss volley: rings, fans, a dragon's timed stream, or a summon.
     These are the original's behaviour-list attacks reduced to one readable
     pattern per boss, on a clock the player can learn and dodge. */
  function bossPattern(world, z, pattern) {
    var p = world.player;
    var base = Math.atan2(p.y - z.y, p.x - z.x);
    var dmg = pattern.dmg || Math.max(5, Math.round((z.dmg || 10) * 0.6));
    var speed = pattern.speed || z.shotSpeed || 480;
    var pushShot = function (ang) {
      world.enemyBullets.push({
        x: z.x, y: z.y,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        dmg: dmg, life: 2.6, r: 6, enemy: true, boss: true
      });
    };
    if (pattern.kind === 'ring') {
      var count = pattern.count || 8;
      z.ringPhase = (z.ringPhase || 0) + 0.26;
      for (var i = 0; i < count; i++) pushShot(z.ringPhase + (i * Math.PI * 2) / count);
    } else if (pattern.kind === 'fan') {
      var n = pattern.count || 3;
      var spread = pattern.spread || 0.35;
      for (var j = 0; j < n; j++) pushShot(base + (j - (n - 1) / 2) * spread);
      var volleys = pattern.volleys || 1;
      var gap = pattern.volleyGap || 0.5;
      if (volleys > 1) {
        z.fanQueue = z.fanQueue || [];
        for (var v = 1; v < volleys; v++) {
          z.fanQueue.push({ t: v * gap, n: n, spread: spread, dmg: dmg, speed: speed });
        }
      }
    } else if (pattern.kind === 'stream') {
      z.stream = { left: pattern.count || 10, t: 0, gap: pattern.gap || 0.12, dmg: dmg, speed: speed };
    } else if (pattern.kind === 'summon') {
      var adds = pattern.count || 3;
      var mult = (world.stage && world.stage.multiplier) || 1;
      for (var k = 0; k < adds; k++) {
        var ang = rand(0, TAU), rr = 150 + rand(0, 80);
        var e = createEnemy(pattern.type, z.x + Math.cos(ang) * rr, z.y + Math.sin(ang) * rr,
          mult, world.diff, world.waveCycle || 0);
        if (e) { e.spawnT = 0.3; world.zombies.push(e); }
      }
      if (ZH.Anim && ZH.Anim.banner) ZH.Anim.banner('SUMMON', 'Adds incoming');
    }
    if (ZH.Audio) ZH.Audio.play('spit');
  }

  function tickBossStream(world, z, dt) {
    if (!z.stream) return;
    z.stream.t -= dt;
    if (z.stream.t > 0) return;
    var p = world.player;
    var sa = Math.atan2(p.y - z.y, p.x - z.x) + rand(-0.05, 0.05);
    world.enemyBullets.push({
      x: z.x, y: z.y,
      vx: Math.cos(sa) * z.stream.speed, vy: Math.sin(sa) * z.stream.speed,
      dmg: z.stream.dmg, life: 2.4, r: 6, enemy: true, boss: true
    });
    z.stream.left--;
    z.stream.t = z.stream.gap;
    if (z.stream.left <= 0) z.stream = null;
  }

  /* bosses stay inside the warning fence even during a dash or a teleport */
  function clampInZone(world, z) {
    var br = world.bossZoneRect;
    if (!br || !z) return;
    var r = z.r || 0;
    if (z.x < br.x0 + r) z.x = br.x0 + r;
    if (z.x > br.x1 - r) z.x = br.x1 - r;
    if (z.y < br.y0 + r) z.y = br.y0 + r;
    if (z.y > br.y1 - r) z.y = br.y1 - r;
  }

  function clampHunter(world) {
    var p = world.player, br = world.bossZoneRect;
    if (!p || !world.bossZoneActive || !br) return;
    if (p.x < br.x0) p.x = br.x0;
    if (p.x > br.x1) p.x = br.x1;
    if (p.y < br.y0) p.y = br.y0;
    if (p.y > br.y1) p.y = br.y1;
  }

  /* Collision mass: the original's 1/2/5 bodies push the hunter out of the
     way. It is a positional shove, not a bite; the mass decides how hard. */
  function shoveHunter(world, z) {
    var p = world.player;
    if (!p || p.dead || !z.mass) return;
    var dx = p.x - z.x, dy = p.y - z.y;
    var d = Math.hypot(dx, dy) || 1;
    var need = (z.r || 13) + (p.r || 12);
    if (d >= need) return;
    var push = (need - d + 1.2) * (0.45 + z.mass * 0.18);
    p.x += (dx / d) * push;
    p.y += (dy / d) * push;
    clampHunter(world);
    world.shoveCount = (world.shoveCount || 0) + 1;
  }

  function hurtHunter(world, raw, shake) {
    var p = world.player;
    if (!p || p.dead) return 0;
    var ar = Math.min(0.8, (attribsOf(p).defense || 0) / 100);
    ar = Math.min(0.9, ar + (p.armor || 0));
    var dmg = raw * (1 - ar);
    if (ZH.Powers) dmg = ZH.Powers.onBite(world, null, dmg);
    if (dmg <= 0) return 0;
    p.hp -= dmg;
    if (ZH.Missions) ZH.Missions.update(10, dmg);   /* RECEIVE_X_DMG */
    if (p.hp <= 0) { p.hp = 0; p.dead = true; }
    world.shake = Math.max(world.shake || 0, shake || 5);
    world.hurtT = 0.3;
    if (ZH.Anim && ZH.Anim.hurt) ZH.Anim.hurt();
    return dmg;
  }

  /* ---- lobbed egg / grenade mortar: a real arc with a landing marker ---- */
  function spawnMortar(world, z, step) {
    var p = world.player;
    if (!p) return;
    world.mortars = world.mortars || [];
    var count = step.count || 1;
    var spread = step.spread || 0;
    for (var i = 0; i < count; i++) {
      if (world.mortars.length >= 24) break;
      world.mortars.push({
        x: z.x, y: z.y,
        tx: p.x + rand(-spread, spread), ty: p.y + rand(-spread, spread),
        t: 0, flight: step.flight || 1.1,
        radius: step.radius || 140, dmg: step.dmg || 24,
        arc: step.arc || 120,
        acid: !!step.acid
      });
    }
    if (ZH.Audio) ZH.Audio.play('spit');
  }

  function updateMortars(world, dt) {
    var list = world.mortars;
    if (!list || !list.length) return;
    var p = world.player;
    for (var i = list.length - 1; i >= 0; i--) {
      var m = list[i];
      m.t += dt;
      if (m.t < m.flight) continue;
      /* it lands on the marked spot, then bursts */
      if (m.acid) {
        /* poison fragment: no direct damage, leaves an acid pool */
        world.hazards = world.hazards || [];
        if (world.hazards.length < 40) {
          world.hazards.push({ x: m.tx, y: m.ty, r: m.radius || 80,
            dmg: 10, life: 1.2, tick: 0 });
        }
      } else if (p && !p.dead && Math.hypot(p.x - m.tx, p.y - m.ty) <= m.radius + p.r) {
        hurtHunter(world, m.dmg, 7);
      }
      world.mortarBooms = (world.mortarBooms || 0) + 1;
      world.shake = Math.max(world.shake || 0, 7);
      if (world.particles) {
        for (var k = 0; k < 10; k++) {
          var a = rand(0, TAU), sp = rand(80, 260);
          world.particles.push({
            x: m.tx + rand(-8, 8), y: m.ty + rand(-6, 6),
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: rand(0.2, 0.4), max: 0.4, size: rand(1.6, 3.4),
            color: k % 2 ? 'rgba(255,154,70,0.9)' : 'rgba(190,255,120,0.85)'
          });
        }
        world.particles.push({
          x: m.tx, y: m.ty, vx: 0, vy: 0, ring: true,
          life: 0.32, max: 0.32, size: m.radius,
          color: 'rgba(255,180,90,0.9)'
        });
      }
      list.splice(i, 1);
    }
  }

  /* ---- acid hazards tick: lingering pools and poison fragments ---- */
  function updateHazards(world, dt) {
    var list = world.hazards;
    if (!list || !list.length) return;
    var p = world.player;
    for (var i = list.length - 1; i >= 0; i--) {
      var h = list[i];
      h.life -= dt;
      if (h.life <= 0) { list.splice(i, 1); continue; }
      h.tick = (h.tick || 0) - dt;
      if (h.tick > 0) continue;
      h.tick = 0.5;
      if (p && !p.dead && Math.hypot(p.x - h.x, p.y - h.y) <= (h.r || 40) + (p.r || 12)) {
        hurtHunter(world, h.dmg || 5, 0);
      }
    }
  }

  /* ---- manager's briefcase: rotating, shootable, 10 damage on contact ---- */
  function updateBriefcases(world, dt) {
    var list = world.briefcases;
    if (!list || !list.length) return;
    var p = world.player;
    for (var i = list.length - 1; i >= 0; i--) {
      var b = list[i];
      b.life -= dt;
      b.flash = Math.max(0, (b.flash || 0) - dt);
      if (b.life <= 0) { list.splice(i, 1); continue; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += (b.rotSpeed || 0.6) * dt;
      if (p && !p.dead && Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r) {
        hurtHunter(world, b.dmg || 10, 5);
        world.briefcaseHits = (world.briefcaseHits || 0) + 1;
        if (world.particles) {
          for (var k = 0; k < 5; k++) {
            var a = rand(0, TAU), sp = rand(60, 180);
            world.particles.push({
              x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              life: 0.24, max: 0.24, size: 2, color: 'rgba(255,230,170,0.9)'
            });
          }
        }
        list.splice(i, 1);
      }
    }
  }

  function startBossStep(world, z, step) {
    var p = world.player;
    if (!step || !p) return;
    z.moveMode = null;
    if (step.kind === 'roam' || step.kind === 'retreat') {
      z.moveMode = step.kind;
      z.roamAngle = rand(0, TAU);
      z.roamT = 0;
      z.act = null;
    } else if (step.kind === 'charge') {
      z.act = {
        kind: 'charge', phase: 'windup', t: 0,
        windup: step.windup || 0.7, dash: step.dash || 0.5,
        speed: step.speed || 700,
        ang: Math.atan2(p.y - z.y, p.x - z.x)
      };
      z.facing = Math.cos(z.act.ang) >= 0 ? 1 : -1;
    } else if (step.kind === 'teleport') {
      z.act = { kind: 'teleport', phase: 'windup', t: 0, windup: step.windup || 0.35, dist: step.dist || 260 };
    } else if (step.kind === 'mortar') {
      z.act = null;
      spawnMortar(world, z, step);
      if (step.acid) { /* acid mortars already flagged on the step */ }
    } else if (step.kind === 'ring' || step.kind === 'fan' ||
               step.kind === 'stream' || step.kind === 'summon') {
      z.act = null;
      bossPattern(world, z, step);
    } else {
      z.act = null;
    }
  }

  function updateBossAct(world, z, dt) {
    var act = z.act;
    if (!act) return;
    act.t += dt;
    if (act.kind === 'charge') {
      if (act.phase === 'windup') {
        z.facing = Math.cos(act.ang) >= 0 ? 1 : -1;
        if (act.t >= act.windup) {
          act.phase = 'dash'; act.t = 0;
          world.chargeDashes = (world.chargeDashes || 0) + 1;
        }
        return;
      }
      if (act.phase === 'dash') {
        z.x += Math.cos(act.ang) * act.speed * dt;
        z.y += Math.sin(act.ang) * act.speed * dt;
        clampInZone(world, z);
        if (act.t >= act.dash) { act.phase = 'recover'; act.t = 0; }
      }
    } else if (act.kind === 'teleport') {
      if (act.phase === 'windup') {
        if (act.t >= act.windup) {
          var p = world.player;
          var ang = rand(0, TAU);
          z.x = p.x + Math.cos(ang) * (act.dist || 260);
          z.y = p.y + Math.sin(ang) * (act.dist || 260);
          clampInZone(world, z);
          act.phase = 'appear'; act.t = 0;
          world.teleports = (world.teleports || 0) + 1;
          if (world.particles) {
            for (var k = 0; k < 8; k++) {
              var pa = rand(0, TAU), pr = rand(20, 70);
              world.particles.push({
                x: z.x + Math.cos(pa) * pr, y: z.y + Math.sin(pa) * pr,
                vx: 0, vy: 0, life: 0.3, max: 0.3, size: rand(1.5, 3),
                color: 'rgba(200,150,255,0.85)'
              });
            }
          }
        }
        return;
      }
      if (act.phase === 'appear' && act.t >= 0.25) z.act = null;
    }
  }

  function updateBossBehaviour(world, z, dt, dist) {
    var p = world.player;
    var steps = z.behaviour;
    if (!p || !steps || !steps.length) return;
    var step = steps[z.step % steps.length];
    if (!z.stepStarted) {
      z.stepT = 0;
      startBossStep(world, z, step);
      z.stepStarted = true;
    }
    z.stepT += dt;
    if (z.stream) tickBossStream(world, z, dt);
    if (z.fanQueue && z.fanQueue.length) {
      for (var fq = z.fanQueue.length - 1; fq >= 0; fq--) {
        z.fanQueue[fq].t -= dt;
        if (z.fanQueue[fq].t > 0) continue;
        var q = z.fanQueue.splice(fq, 1)[0];
        var qbase = Math.atan2(world.player.y - z.y, world.player.x - z.x);
        var qspeed = q.speed || z.shotSpeed || 480;
        for (var qi = 0; qi < q.n; qi++) {
          var qang = qbase + (qi - (q.n - 1) / 2) * q.spread;
          world.enemyBullets.push({
            x: z.x, y: z.y,
            vx: Math.cos(qang) * qspeed, vy: Math.sin(qang) * qspeed,
            dmg: q.dmg, life: 2.6, r: 6, enemy: true, boss: true
          });
        }
        if (ZH.Audio) ZH.Audio.play('spit');
      }
    }
    if (z.act) updateBossAct(world, z, dt);

    var busy = z.act &&
      ((z.act.kind === 'charge' && z.act.phase !== 'recover') || z.act.kind === 'teleport');
    if (!busy && !z.stationary) {
      if (z.moveMode === 'roam') {
        z.roamT = (z.roamT || 0) + dt;
        if (z.roamT > 0.9) { z.roamAngle = rand(0, TAU); z.roamT = 0; }
        var ra = z.roamAngle || 0;
        var rspd = (z.speed || 100) * (typeof step.speed === 'number' ? step.speed : 0.5);
        z.x += Math.cos(ra) * rspd * dt;
        z.y += Math.sin(ra) * rspd * dt;
        z.facing = Math.cos(ra) >= 0 ? 1 : -1;
      } else if (z.moveMode === 'retreat') {
        var rdx = z.x - p.x, rdy = z.y - p.y;
        var rd = Math.hypot(rdx, rdy) || 1;
        z.x += (rdx / rd) * z.speed * dt;
        z.y += (rdy / rd) * z.speed * dt;
        z.facing = rdx >= 0 ? 1 : -1;
      } else {
        var dx = p.x - z.x, dy = p.y - z.y;
        var d = Math.hypot(dx, dy) || 1;
        if (d > (z.range || 50) * 0.9) {
          z.x += (dx / d) * z.speed * dt;
          z.y += (dy / d) * z.speed * dt;
        }
        z.facing = dx >= 0 ? 1 : -1;
      }
    }

    if (z.stepT >= (step.duration || 1.5)) {
      z.step = (z.step + 1) % steps.length;
      z.stepT = 0;
      z.stepStarted = false;
      z.act = null;
      z.fanQueue = null;
      z.moveMode = null;
    }
    clampInZone(world, z);
  }

  /** the boss zone clears every normal body, exactly like the original */
  ZH.clearNonBosses = function (list) {
    var removed = 0;
    if (!list) return 0;
    for (var i = list.length - 1; i >= 0; i--) {
      if (!list[i] || list[i].boss) continue;
      list.splice(i, 1);
      removed++;
    }
    return removed;
  };

  function updateEnemies(list, dt, world) {
    var p = world.player;
    separateHorde(list);
    for (var i = list.length - 1; i >= 0; i--) {
      var z = list[i];
      if (z.dead) { z.removeT -= dt; continue; }
      if (z.spawnT > 0) { z.spawnT -= dt; continue; }

      z.hurtFlash = Math.max(0, z.hurtFlash - dt * 5);
      z.walkPhase += dt * 4;

      /* knockback: the impulse from the last hit decays fast, so a burst of
         rounds staggers a walker without launching it down the street */
      if (z.kx || z.ky) {
        z.x += z.kx * dt;
        z.y += z.ky * dt;
        var kd = Math.pow(0.0009, dt);
        z.kx *= kd; z.ky *= kd;
        if (Math.abs(z.kx) < 1 && Math.abs(z.ky) < 1) { z.kx = 0; z.ky = 0; }
      }

      var dx = p.x - z.x;
      var dy = p.y - z.y;
      var dist = Math.hypot(dx, dy) || 1;
      var stopAt = z.ranged ? (z.range || 50) * 0.85 : (z.range || 30) * 0.7;

      /* scripted bosses run a multi-step list: chase, charge with a windup,
         teleport, and their old signature volleys as attack steps */
      if (z.behaviour && z.behaviour.length) {
        updateBossBehaviour(world, z, dt, dist);
        shoveHunter(world, z);
        continue;
      }

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

      /* heavy bodies shoulder the hunter aside instead of only walking into
         them: mass 1 / 2 / 5, exactly the original's collision weights */
      if (z.mass) shoveHunter(world, z);

      /* the dragon's stream keeps firing between its pattern volleys */
      tickBossStream(world, z, dt);
      z.cdT -= dt;
      if (z.pattern) {
        if (z.cdT <= 0 && dist <= (z.pattern.range || 800)) {
          z.cdT = z.pattern.cd;
          bossPattern(world, z, z.pattern);
        }
      } else if (z.cdT <= 0 && dist <= (z.range || 30) * 1.6) {
        z.cdT = z.cd;
        if (z.ranged) {
          enemyShoot(world, z, dist);
        } else if (dist < (z.range || 30)) {
          if (!p.jetActive) {
            var a = attribsOf(p);
            var armor = Math.min(0.8, (a.defense || 0) / 100);
            var bite = z.dmg * (1 - armor);
            /* survivor power: dodge cancels the bite, thorns bites back */
            if (ZH.Powers) bite = ZH.Powers.onBite(world, z, bite);
            if (bite > 0) {
              p.hp -= bite;
              if (ZH.Missions) ZH.Missions.update(10, bite);   /* RECEIVE_X_DMG */

              if (p.hp <= 0) { p.hp = 0; p.dead = true; }
              world.shake = Math.max(world.shake || 0, 5);
              world.hurtT = 0.3;
              if (ZH.Anim && ZH.Anim.hurt) ZH.Anim.hurt();
            }
          }
        }
      }

      if (z.boss) clampInZone(world, z);

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

      /* the manager's briefcase is a real target: shoot it down before it
         reaches the hunter (10 damage, 20 hp, exactly the destroyable
         deadshot projectile in the original) */
      if (!b.enemy && world.briefcases && world.briefcases.length) {
        var bcHit = null;
        for (var bc = 0; bc < world.briefcases.length; bc++) {
          var brief = world.briefcases[bc];
          if (Math.hypot(b.x - brief.x, b.y - brief.y) < brief.r + (b.r || 5)) {
            bcHit = brief;
            break;
          }
        }
        if (bcHit) {
          bcHit.hp -= b.dmg;
          bcHit.flash = 0.15;
          if (world.particles) {
            for (var bs = 0; bs < 3; bs++) {
              world.particles.push({
                x: b.x, y: b.y, vx: rand(-90, 90), vy: rand(-90, 20),
                life: 0.2, max: 0.2, size: 2, color: 'rgba(255,226,150,0.9)'
              });
            }
          }
          if (bcHit.hp <= 0) {
            world.briefcaseBreaks = (world.briefcaseBreaks || 0) + 1;
            if (world.floaters && world.floaters.length < 70) {
              world.floaters.push({
                text: 'BRIEFCASE DOWN', x: bcHit.x, y: bcHit.y - 24,
                vy: -42, life: 0.8, max: 0.8, size: 14, color: '#ffd166'
              });
            }
            world.briefcases.splice(world.briefcases.indexOf(bcHit), 1);
          }
          list.splice(i, 1);
          continue;
        }
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
          var ar = Math.min(0.8, (attribsOf(p).defense || 0) / 100);
    ar = Math.min(0.9, ar + (p.armor || 0));
          var shot = b.dmg * (1 - ar);
          if (ZH.Powers) shot = ZH.Powers.onBite(world, null, shot);
          if (shot > 0) {
            p.hp -= shot;
            if (ZH.Missions) ZH.Missions.update(10, shot);   /* RECEIVE_X_DMG */

            if (p.hp <= 0) { p.hp = 0; p.dead = true; }
            world.shake = Math.max(world.shake || 0, 5);
            world.hurtT = 0.3;
            if (ZH.Anim && ZH.Anim.hurt) ZH.Anim.hurt();
          }
          list.splice(i, 1);
          continue;
        }
      }

      /* The city is endless in every direction, negative coordinates
         included. The old `b.x < -200 || b.y < -200` cull deleted every
         round fired in the top-left quadrant before it could reach a zombie,
         so the gun worked at spawn and appeared dead after walking up/left.
         Moving rounds already expire on their own life clock, so no position
         cull is needed for this open world. */
    }
  }

  function updatePickups(list, dt, world) {
    var p = world.player;
    var a = attribsOf(p);
    var pickupRange = 150 * (1 + (a.pickup_range_bonus || 0)) * (1 + (p.magnet || 0));
    for (var i = list.length - 1; i >= 0; i--) {
      var pk = list[i];
      pk.life -= dt;
      if (pk.life <= 0) { list.splice(i, 1); continue; }
      var d = Math.hypot(pk.x - p.x, pk.y - p.y);
      /* the original's magnet pulls gems only: only exp drops are vacuumed,
         by proximity (pickup range) or by an explicit magnet pickup */
      var isGem = (pk.type === 'exp');
      var pullSpeed = pk.pulling ? 900 : 260;
      if ((isGem && d < pickupRange) || pk.pulling) {
        pk.x += (p.x - pk.x) / (d || 1) * pullSpeed * dt;
        pk.y += (p.y - pk.y) / (d || 1) * pullSpeed * dt;
      }
      if (d < 22) {
        if (pk.type === 'exp') {
          var gain = pk.value || 10;
          gain = Math.floor(gain + gain * (a.exp_bonus || 0) / 100);
          p.exp += gain;
          /* 8 = COLLECT_X_EXPS */
          if (ZH.Missions) ZH.Missions.update(8, gain);
        } else if (pk.type === 'coin') {
          var cash = (pk.value || 1);
          cash = cash + cash * (a.cash_bonus || 0) / 100;
          cash = Math.round(cash);
          world.coins = (world.coins || 0) + cash;
          /* 7 = EARN_X_GOLD */
          if (ZH.Missions) ZH.Missions.update(7, cash);
        } else if (pk.type === 'treasure') {
          // the original drops a treasure chest that opens 1/3/5 skill cards
          world.coins = (world.coins || 0) + 500;
          if (ZH.Missions) { ZH.Missions.update(7, 500); ZH.Missions.update(12, 1); }
          if (world.ui && world.ui.showLevelUp) world.ui.showLevelUp(pk.value || 3, 'chest');
        } else if (pk.type === 'medikit') {
          var healed = Math.min(p.maxHp, p.hp + (pk.value || 50)) - p.hp;
          p.hp += healed;
          /* 11 = HEAL_X_PTS: only the HP that actually fit counts */
          if (ZH.Missions && healed > 0) ZH.Missions.update(11, healed);
        } else if (pk.type === 'food') {
          /* the original's BONUS_FOOD: a flat +100 HP */
          var foodHeal = Math.min(p.maxHp, p.hp + (pk.value || 100)) - p.hp;
          p.hp += foodHeal;
          if (ZH.Missions && foodHeal > 0) ZH.Missions.update(11, foodHeal);
          if (world.floaters && world.floaters.length < 70) {
            world.floaters.push({
              text: '+' + (pk.value || 100), x: p.x, y: p.y - 46, vy: -44,
              life: 0.8, max: 0.8, size: 15, color: '#9be15d'
            });
          }
        } else if (pk.type === 'bomb') {
          /* screen clear (the original's BONUS_BOMB): every normal body on
             the field dies, bosses only take a bite of their bar */
          world.bombFlash = 0.42;
          world.shake = Math.max(world.shake || 0, 13);
          /* the original's BOMB_BONUS: 10 x attack inside a 900 px radius */
          var bombDmg = 10 * ((world.player && world.player.attack) || 10);
          var cleared = 0;
          for (var bz = world.zombies.length - 1; bz >= 0; bz--) {
            var ze = world.zombies[bz];
            if (ze.dead) continue;
            if (Math.hypot(ze.x - pk.x, ze.y - pk.y) > 900) continue;
            damageEnemy(world, ze, bombDmg);
            cleared++;
          }
          if (world.particles && world.particles.length < 240) {
            for (var bp2 = 0; bp2 < 26; bp2++) {
              var ba2 = rand(0, TAU), bv2 = rand(120, 460);
              world.particles.push({
                x: pk.x, y: pk.y, vx: Math.cos(ba2) * bv2, vy: Math.sin(ba2) * bv2,
                life: rand(0.25, 0.55), max: 0.55, size: rand(2, 4.4),
                blend: 'lighter', color: 'rgba(255,206,120,0.9)'
              });
            }
          }
          if (ZH.Anim && ZH.Anim.toast) ZH.Anim.toast('BOMB · ' + cleared + ' CLEARED', 'good');
          if (ZH.Audio) ZH.Audio.play('slam');
        } else if (pk.type === 'magnet') {
          /* vacuum gems only, like the original's magnet */
          for (var mi = 0; mi < world.pickups.length; mi++) {
            var mp = world.pickups[mi];
            if (mp === pk) continue;
            if (mp.type !== 'exp') continue;
            mp.pulling = 1;
          }
          if (ZH.Anim && ZH.Anim.toast) ZH.Anim.toast('MAGNET', 'good');
          if (ZH.Audio) ZH.Audio.play('magnet');
        } else if (pk.type === 'gift') {
          /* a wrapped box pays out one random reward */
          var roll = Math.random();
          var label = '', colour = '#ffd166';
          if (roll < 0.38) {
            var cashG = 250 + Math.floor(Math.random() * 550);
            world.coins = (world.coins || 0) + cashG;
            label = '+' + cashG + ' SCRAP';
          } else if (roll < 0.58) {
            p.hp = Math.min(p.maxHp, p.hp + 35);
            label = '+35 HP'; colour = '#9be15d';
          } else if (roll < 0.78) {
            p.magnet = (p.magnet || 0) + 0.5;
            label = 'MAGNET +50%'; colour = '#ff9ad5';
          } else {
            world.coins = (world.coins || 0) + 1000;
            label = 'JACKPOT +1000'; colour = '#ffe066';
          }
          if (world.floaters && world.floaters.length < 70) {
            world.floaters.push({
              text: label, x: pk.x, y: pk.y - 22, vy: -42,
              life: 1, max: 1, size: 15, color: colour
            });
          }
          if (world.particles && world.particles.length < 240) {
            var giftCols = ['rgba(255,214,120,0.95)', 'rgba(155,225,93,0.9)', 'rgba(255,143,208,0.9)'];
            for (var gp = 0; gp < 12; gp++) {
              world.particles.push({
                x: pk.x, y: pk.y, vx: rand(-150, 150), vy: rand(-200, -20),
                grav: 240, life: rand(0.3, 0.6), max: 0.6, size: rand(1.6, 3.2),
                color: giftCols[gp % 3]
              });
            }
          }
          if (ZH.Audio) ZH.Audio.play('buy');
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
  ZH.updateMortars = updateMortars;
  ZH.updateHazards = updateHazards;
  ZH.updateBriefcases = updateBriefcases;
  ZH.spawnMortar = spawnMortar;
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
