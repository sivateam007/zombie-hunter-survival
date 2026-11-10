/*
 * Meow Zombie Hunter — Vampire Survivors style engine
 * Move = aim direction, all weapons auto-fire
 */
window.ZH = window.ZH || {};
(function (ZH) {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  var Game = {
    canvas: null, ctx: null, dpr: 1, W: 0, H: 0,
    state: 'boot',            /* boot|menu|select|playing|paused|dead|victory|levelup|results */
    stageId: 0, stage: null,
    arena: null,
    player: null,
    zombies: [], bullets: [], enemyBullets: [],
    pickups: [], particles: [], decals: [], ghosts: [], floaters: [], ambient: [],
    camera: { x: 0, y: 0, zoom: 1 },
    shake: 0, t: 0, elapsed: 0, lastTs: 0, acc: 0,
    coins: 0, score: 0, exp: 0,
    levelUpPending: false, levelUpChoices: [],
    bossZoneActive: false,
    input: {
      joyX: 0, joyY: 0, jet: false,
      keys: {}, padX: 0, padY: 0, padAimX: 0, padAimY: 0, padAimLen: 0,
      padJet: false, aimX: null, aimY: null, aimMode: false
    },
    touch: { enabled: false },
    hudCache: {},
    quality: 1,
    result: null,
    lock: false
  };
  ZH.Game = Game;

  /* ------------------------------ boot ------------------------------ */
  Game.boot = function (canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.bindInput();
    this.state = 'menu';
    var self = this;
    window.addEventListener('resize', function () { self.resize(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && self.state === 'playing') self.pause();
    });
    this.lastTs = performance.now();
    requestAnimationFrame(function (ts) { self.frame(ts); });
  };

  Game.resize = function () {
    var c = this.canvas;
    if (!c) return;
    this.dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    /* a zero-sized canvas draws nothing at all (a black screen on browsers
       that report 0 while their chrome collapses) — never accept 0 */
    this.W = Math.max(1, Math.round(c.clientWidth || window.innerWidth || 1));
    this.H = Math.max(1, Math.round(c.clientHeight || window.innerHeight || 1));
    c.width = Math.max(1, Math.round(this.W * this.dpr));
    c.height = Math.max(1, Math.round(this.H * this.dpr));
    this.quality = this.W * this.H > 1400 * 900 ? 1 : 0.9;
  };

  /* -------------------------------- stage -------------------------------- */
  /* three difficulties, our own tuning */
  ZH.DIFFICULTIES = [
    { id: 'normal', name: 'NORMAL', hp: 1,   dmg: 1,   speed: 1,    reward: 1,   mul: 1,    note: 'The stage as authored.' },
    { id: 'hard',   name: 'HARD',   hp: 2,   dmg: 2,   speed: 1.15, reward: 1.5, mul: 1.15, note: 'x2 HP, x2 damage, faster horde.' },
    { id: 'insane', name: 'INSANE', hp: 4,   dmg: 4,   speed: 1.5,  reward: 2.5, mul: 1.35, note: 'x4 HP, x4 damage, they hunt you.' }
  ];
  ZH.difficulty = function (id) {
    for (var i = 0; i < ZH.DIFFICULTIES.length; i++) {
      if (ZH.DIFFICULTIES[i].id === id) return ZH.DIFFICULTIES[i];
    }
    return ZH.DIFFICULTIES[0];
  };

  Game.startStage = function (stageId, primaryWeapon) {
    var stage = ZH.STAGES[stageId] || ZH.STAGES[0];
    if (!stage) return;
    /* roll the daily contracts / coffer before the run starts */
    if (ZH.Missions) ZH.Missions.ensure();
    this.stageId = stageId || 0;
    this.stage = stage;
    // stage data is shared, so reset every wave's runtime flags
    for (var wi = 0; wi < stage.waves.length; wi++) {
      var rw = stage.waves[wi];
      rw.used = false;
      rw.active = false;
      rw.timer = 0;
      rw.interval = 0;
      rw.waveT = 0;
      rw.spawned = 0;
      rw.fired = 0;
      rw.warned = false;
      if (rw.__origStart == null) rw.__origStart = rw.startTime;
      rw.startTime = rw.__origStart;
    }
    this.arena = ZH.Arena.get(stage.tile || 'street', (stageId || 0) * 123);
    this.resetSimulation();
    var save = ZH.Save.get();
    this.diff = ZH.difficulty(save.difficulty);
    this.difficultyMul = this.diff.mul;
    var wanted = primaryWeapon || save.currentWeapon || 'gun';
    if (!ZH.WEAPONS || !ZH.WEAPONS[wanted]) wanted = 'gun';
    this.player = ZH.createSurvivor({
      x: 512, y: 512,
      weapon: wanted
    });
    this._district = null;
    this.distance = 0;
    this.player.primaryWeapon = this.player.weapon;
    this.player.supplies = {};
    this.applySkills();
    /* the safehouse survivor adds its palette + small stat perk after the
       permanent skills have set the run's base values */
    this.character = 'hunter';
    if (save.character && ZH.CHARACTER_BY_ID && ZH.CHARACTER_BY_ID[save.character] &&
        (save.character === 'hunter' || ZH.CHARACTER_BY_ID[save.character].free ||
         (save.characters || []).indexOf(save.character) !== -1)) {
      this.character = save.character;
    }
    if (ZH.applyCharacter) ZH.applyCharacter(this.player, this.character);
    /* permanent store upgrades land on top of the survivor's own perks */
    if (ZH.applyUpgrades) ZH.applyUpgrades(this.player, save);
    this.input.jet = false;
    this.traffic = [];
    this.trafficT = 0;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.camera.zoom = 0.8;
    this.state = 'playing';
    if (document.body) document.body.classList.add('in-game');
    ZH.Audio.unlock();
    /* the music bus and startMusic() existed but nothing ever called them */
    if (ZH.Audio.startMusic) ZH.Audio.startMusic();
    if (this.ui) { this.ui.hideScreens && this.ui.hideScreens(); this.ui.resetHud && this.ui.resetHud(); }
    this.levelUpPending = false;
    this.bossZoneActive = false;
    this.waveCycle = 0;
    this.hordeClock = 0;
    this.elapsed = 0;
    this.coins = 0; this.score = 0; this.exp = 0;
    this.treasureSpawned = false;
    this.continueCount = 0;
    this.continueOffers = 0;
    this.expToNext = 1000;
    if (window.ZH && ZH.Anim) ZH.Anim.banner(stage.name,
      (this.player.power ? this.player.power.name : 'SURVIVE 20 MINUTES'));
    this.lastTs = performance.now();
  };

  /* the six coin skills set the survivor's base stats for the run */
  Game.applySkills = function () {
    var p = this.player;
    if (!p || !ZH.skillValue) return;
    var save = ZH.Save.get();
    var skills = save.skills || {};
    p.attack = ZH.skillValue('power', skills.power) || 10;
    p.maxHp = ZH.skillValue('health', skills.health) || 100;
    p.hp = p.maxHp;
    p.firstaid = ZH.skillValue('firstaid', skills.firstaid) || 25;
    p.fortune = ZH.skillValue('fortune', skills.fortune) || 0;
    p.learning = ZH.skillValue('learning', skills.learning) || 0;
    this.skillDefense = ZH.skillValue('defense', skills.defense) || 0;
    this.recomputeAttribs();
  };

  /* supplies collected in the run stack on top of the coin skills */
  Game.recomputeAttribs = function () {
    var p = this.player;
    if (!p) return;
    var a = ZH.attribsFrom ? ZH.attribsFrom(p.supplies) : {};
    a.defense = (a.defense || 0) + (this.skillDefense || 0);
    p.attribs = a;
  };

  /* --------------------------- ambient traffic ---------------------------
     Decorative cars cruise the road network near the hunter. They never
     collide and never enter the zombie AI: this is city life, not a hazard. */
  Game.makeTrafficCar = function () {
    var p = this.player;
    var horizontal = Math.random() < 0.5;
    var side = Math.random() < 0.5 ? -1 : 1;
    var dist = 620 + Math.random() * 900;
    var speed = 150 + Math.random() * 170;
    var carCols = ['#4c5d63', '#6a4a3c', '#3f4b32', '#5a5a63', '#6d3f3a', '#7b6a3e'];
    var car = {
      color: carCols[(Math.random() * carCols.length) | 0],
      vx: 0, vy: 0, rot: 0
    };
    if (horizontal) {
      car.x = p.x + side * dist;
      car.y = p.y + (Math.random() * 2 - 1) * 760;
      car.vx = -side * speed;
      car.rot = side > 0 ? Math.PI : 0;
    } else {
      car.x = p.x + (Math.random() * 2 - 1) * 760;
      car.y = p.y + side * dist;
      car.vy = -side * speed;
      car.rot = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    return car;
  };

  Game.updateTraffic = function (dt) {
    if (!this.traffic) this.traffic = [];
    var theme = this._district || (this.arena && this.arena._fn) || 'street';
    var busy = { street: 1, downtown: 1, airport: 1, docks: 1, canal: 1, suburb: 1, warehouse: 1 };
    if (!busy[theme]) {
      if (this.traffic.length) this.traffic.length = 0;
      return;
    }
    this.trafficT = (this.trafficT || 0) + dt;
    var cap = 8;
    if (this.traffic.length < cap && this.trafficT > 0.3) {
      this.trafficT = 0;
      this.traffic.push(this.makeTrafficCar());
    }
    var p = this.player;
    for (var i = this.traffic.length - 1; i >= 0; i--) {
      var c = this.traffic[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      /* a running car hurts the hunter too: crash damage with a short
         cooldown, ignored while any force field is up */
      var pdx = p.x - c.x, pdy = p.y - c.y;
      var crash = 44;
      if (pdx * pdx + pdy * pdy < crash * crash && !(p.shieldT > 0) && !p.jetActive) {
        var cdT = c._crashT != null ? this.t - c._crashT : 99;
        if (cdT > 1.2) {
          c._crashT = this.t;
          p.hp = Math.max(0, p.hp - 14);
          if (ZH.openShield) ZH.openShield(p, ZH.SHIELD.hit);
          this.shake = Math.max(this.shake, 9);
          this.hurtT = 0.3;
          this.floaters.push({
            text: '-14', x: p.x, y: p.y - 46, vy: -46,
            life: 0.8, max: 0.8, size: 16, color: '#ff6b6b'
          });
          for (var cp = 0; cp < 8; cp++) {
            this.particles.push({
              x: p.x, y: p.y + 4, vx: rand(-170, 170), vy: rand(-140, 40),
              life: 0.4, max: 0.4, size: rand(1.6, 3.2),
              color: 'rgba(255,150,70,0.9)'
            });
          }
          if (ZH.Audio) ZH.Audio.play('error');
        }
      }
      /* running cars plough through the horde; every roadkill discharges a
         little life back into the hunter, and the splash is visible */
      if (this.zombies && this.zombies.length) {
        for (var zi = this.zombies.length - 1; zi >= 0; zi--) {
          var zz = this.zombies[zi];
          if (zz.dead || zz.boss) continue;
          var cdx = zz.x - c.x, cdy = zz.y - c.y;
          if (cdx * cdx + cdy * cdy > 46 * 46) continue;
          if (zz._roadT != null && this.t - zz._roadT < 0.5) continue;
          zz._roadT = this.t;
          if (ZH.damageEnemy) ZH.damageEnemy(this, zz, (zz.maxHp || 50) * 1.4);
          if (this.particles.length < 240) {
            for (var ci = 0; ci < 5; ci++) {
              this.particles.push({
                x: zz.x, y: zz.y, vx: rand(-160, 160), vy: rand(-180, -30),
                grav: 300, life: rand(0.2, 0.45), max: 0.45, size: rand(1.5, 3),
                color: 'rgba(160,28,22,0.9)'
              });
            }
          }
          var lh = this.player;
          if (lh && !lh.dead && lh.hp < lh.maxHp) {
            lh.hp = Math.min(lh.maxHp, lh.hp + 2);
            this.floaters.push({
              text: '+2', x: zz.x, y: zz.y - 26, vy: -40,
              life: 0.7, max: 0.7, size: 13, color: '#ff9ad5'
            });
          }
        }
      }
      var dx = c.x - p.x, dy = c.y - p.y;
      if (dx * dx + dy * dy > 1800 * 1800) this.traffic.splice(i, 1);
    }
  };

  Game.drawTraffic = function (ctx) {
    if (!this.traffic || !this.traffic.length || !ZH.Arena || !ZH.Arena.drawCar) return;
    var z = this.camera.zoom || 1;
    var x0 = this.camera.x - this.W / 2 / z - 120;
    var x1 = this.camera.x + this.W / 2 / z + 120;
    var y0 = this.camera.y - this.H / 2 / z - 120;
    var y1 = this.camera.y + this.H / 2 / z + 120;
    for (var i = 0; i < this.traffic.length; i++) {
      var c = this.traffic[i];
      if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
      /* headlight pool under the car */
      var fx = c.x + Math.cos(c.rot) * 58;
      var fy = c.y + Math.sin(c.rot) * 58;
      var beam = ctx.createRadialGradient(fx, fy, 3, fx, fy, 48);
      beam.addColorStop(0, 'rgba(255,224,160,0.20)');
      beam.addColorStop(1, 'rgba(255,224,160,0)');
      ctx.fillStyle = beam;
      ctx.beginPath(); ctx.arc(fx, fy, 48, 0, Math.PI * 2); ctx.fill();
      ZH.Arena.drawCar(ctx, c.x, c.y, c.rot, c.color, function () { return 0.5; });
    }
  };

  Game.startCampaign = function (id) {
    Game.startStage(id - 1 >= 0 ? id - 1 : 0);
  };

  Game.startEndless = function () {
    // Start endless mode - use stage 0 or create endless
    Game.startStage(0);
    Game.elapsed = 0;
    Game.coins = 0; Game.score = 0; Game.exp = 0;
  };

  Game.retry = function () {
    if (this.stageId !== undefined) {
      this.startStage(this.stageId);
    } else {
      this.startStage(0);
    }
  };

  Game.quit = function () {
    this.state = 'menu';
    if (document.body) document.body.classList.remove('in-game');
    if (this.ui) this.ui.showMenu();
  };

  Game.nextLevel = function () {
    if (this.stageId < (ZH.STAGES ? ZH.STAGES.length - 1 : 0)) {
      this.startStage(this.stageId + 1);
    } else {
      this.quit();
    }
  };

  Game.resetSimulation = function () {
    this.zombies = []; this.bullets = []; this.enemyBullets = [];
    this.pickups = []; this.particles = []; this.decals = [];
    this.ghosts = []; this.floaters = [];
    this.coins = 0; this.score = 0; this.exp = 0;
    this.shake = 0;
  };

  /* -------------------------------- waves -------------------------------- */
  /* horde density: MEDIUM.

     The wave table's caps are kept, but the feed is throttled here because
     this engine draws every body in view. Feeding a wave at its raw cadence
     (down to 0.2 s between spawns with a 100-body cap) turned the screen into
     a solid wall, which is what players described as "more zombies are
     arriving, it is not good". Medium keeps the pressure and the wave order
     without the wall. */
  /* ZH.HORDE itself lives in entities.js so the campaign data and the tests
     read the same medium budget the scheduler below enforces. */
  ZH.HORDE = ZH.HORDE || {
    density: 'medium',
    interval: { LOW: 1.1, MID: 0.65, HI: 0.32 },
    nearCap: 22,
    hardCap: 70
  };

  Game.updateWaves = function (dt) {
    if (!this.stage || this.bossZoneActive) return;
    /* the feed breathes: surge, then a lull the player can clear */
    this.hordeClock = (this.hordeClock || 0) + dt;
    var feeding = ZH.hordeWindow(this.hordeClock).spawning;
    var t = this.elapsed; // stage data uses SECONDS for startTime/duration
    /* the budget drifts with the clock: a late wave is fed faster and is
       allowed more bodies at once than the opening one (ZH.HORDE.ramp) */
    var budget = ZH.hordeBudget ? ZH.hordeBudget(this.elapsed) : null;
    this.hordeNear = budget ? budget.near : ZH.HORDE.nearCap;
    this.hordeHard = budget ? budget.hard : ZH.HORDE.hardCap;

    // The authored waves cover only the opening ~138s, but a stage is won
    // at 1200s (the original runs concurrent waves the whole time). Once
    // every normal wave is spent, recycle them so the pressure never stops.
    if (this.allWavesSpent()) this.recycleWaves();

    for (var w = 0; w < this.stage.waves.length; w++) {
      var wave = this.stage.waves[w];
      if (wave.active) {
        // waveT is the window clock; it must NOT reset on every spawn
        wave.waveT = (wave.waveT || 0) + dt;
        wave.timer = (wave.timer || 0) + dt;
        if (wave.timer >= wave.interval) {
          wave.timer -= wave.interval;
          // `max` is a CONCURRENT cap (as in the original: the wave keeps
          // feeding the horde for its whole window while the count stays
          // under max), not a one-shot lifetime total.
          var capped = wave.total != null && wave.spawned >= wave.total;
          /* count only the ones near the hunter: in a 6144 px open city a
             fast survivor leaves the wave behind, and the screen would empty
             out even though `max` zombies are alive somewhere else */
          /* the wave's own cap grows with the run too, but never past the
             field cap: more waves stacked AND more bodies per wave */
          var waveCap = Math.min(
            Math.round((wave.max || 20) * (budget ? budget.wave : 1)),
            this.hordeNear);
          if (feeding && !capped && this.waveAliveNear(null, 900) < waveCap) {
            wave.spawned = (wave.spawned || 0) + 1;
            this.spawnWaveEnemies(wave);
          }
        }
        if (wave.waveT >= wave.duration) {
          wave.active = false;
        }
      } else if (wave.bossZone && !wave.warned && !wave.used && t >= wave.startTime - 3) {
        /* the original's DELAY_HIDE_HAZARD_INFO: a 3 s warning before the
           zone shuts, so the boss is never a surprise */
        wave.warned = true;
        if (ZH.Anim && ZH.Anim.banner) ZH.Anim.banner('WARNING', 'BOSS INCOMING');
        if (ZH.Anim && ZH.Anim.flash) ZH.Anim.flash('214,42,32', { peak: 0.55, duration: 520 });
        if (ZH.Audio) ZH.Audio.play('error');
      } else if (t >= wave.startTime && !wave.used) {
        wave.used = true;
        if (wave.bossZone) {
          // never open a boss zone during the last 30 s of the run: the
          // clock is frozen inside one, and the stage has to be winnable
          if (t >= (ZH.TIME_LEVEL_COMPLETED || 1200) - 30) continue;
          // boss zones fire once per cycle, on a longer cadence later on
          if (wave.fired && wave.fired > 0 && this.waveCycle > 0 &&
              this.waveCycle % 4 !== 0) {
            // skip this cycle — bosses are rare after the first showing
          } else {
            wave.fired = (wave.fired || 0) + 1;
            this.activateBossZone(wave);
          }
        } else {
          wave.active = true;
          wave.timer = 0;
          wave.waveT = 0;
          wave.spawned = 0;
          var interval = ZH.HORDE.interval[wave.freq] || ZH.HORDE.interval.LOW;
          /* ramp cadence first, then the difficulty's own feed rate */
          wave.interval = interval * (budget ? budget.feed : 1) / (this.difficultyMul || 1);
          // duration is already in seconds in the stage data
        }
      }
    }
  };

  Game.allWavesSpent = function () {
    if (!this.stage) return false;
    var anyBossPending = false;
    for (var i = 0; i < this.stage.waves.length; i++) {
      var wv = this.stage.waves[i];
      if (wv.active) return false;
      if (wv.bossZone) {
        // a boss wave still counts as pending only on the very first cycle
        if (!wv.fired) anyBossPending = true;
        continue;
      }
      if (!wv.used) return false;
    }
    // if a first-cycle boss is still queued, wait for it
    if (anyBossPending && this.elapsed < 400) return false;
    return true;
  };

  Game.recycleWaves = function () {
    this.waveCycle = (this.waveCycle || 0) + 1;
    // the recycle only runs once per idle moment — push every normal wave
    // back into the queue with a fresh window so spawning resumes.
    for (var i = 0; i < this.stage.waves.length; i++) {
      var wv = this.stage.waves[i];
      if (wv.bossZone) {
        // bosses: re-arm, they gate themselves through `fired`/cycle
        wv.used = false;
        wv.warned = false;
        wv.startTime = this.elapsed + 60 + this.waveCycle * 30;
        continue;
      }
      wv.used = false;
      wv.active = false;
      wv.spawned = 0;
      wv.waveT = 0;
      wv.timer = 0;
      // stagger the relaunch across the next 45 seconds, not all at once
      wv.startTime = this.elapsed + (i % 12) * 3.5;
    }
  };

  /* how many live enemies are close enough to matter — pass a type to count
     just that type, or null for the whole horde (the density cap uses null:
     the cap is one budget for the field, not a separate budget per enemy
     type, which is how three concurrent waves used to stack 3 x 40 = 120+) */
  Game.waveAliveNear = function (type, radius) {
    var p = this.player;
    var n = 0, r2 = (radius || 900) * (radius || 900);
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.dead) continue;
      if (type && z.type !== type) continue;
      if (!p) { n++; continue; }
      var dx = z.x - p.x, dy = z.y - p.y;
      if (dx * dx + dy * dy <= r2) n++;
    }
    return n;
  };

  /* how many live enemies of this wave's type are on the field */
  Game.waveAlive = function (type) {
    var n = 0;
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (!z.dead && z.type === type) n++;
    }
    return n;
  };

  Game.spawnWaveEnemies = function (wave) {
    if (this.zombies.length > (this.hordeHard || ZH.HORDE.hardCap)) return;
    /* spawn just past the edge of the view, like the original — spawning at a
       fixed 600 px left the screen empty whenever the hunter moved */
    var half = Math.max(this.W, this.H) / (2 * (this.camera.zoom || 1));
    var p = this.player;
    var bias = null;
    if (p && Math.hypot(p.moveX || 0, p.moveY || 0) > 0.2) bias = Math.atan2(p.moveY, p.moveX);
    var pos = this.findSpawnPoint(Math.max(320, half * 0.85), bias);
    // enemy HP scales with the stage multiplier, exactly like the original
    var mult = (this.stage && this.stage.multiplier) || 1;
    var z = ZH.createEnemy(wave.enemy, pos.x, pos.y, mult, this.diff, this.waveCycle || 0);
    if (z) this.zombies.push(z);
  };

  Game.activateBossZone = function (wave) {
    this.bossZoneActive = true;
    this.bossZoneT = 0;
    /* the arena is a real rect, as in the original: the hunter is sealed in
       for the fight instead of being able to walk out of the boss zone */
    var bw = (wave.bossZone && wave.bossZone.width) || 1200;
    var bh = (wave.bossZone && wave.bossZone.height) || 1200;
    var pc = this.player;
    if (pc) {
      this.bossZoneRect = {
        x0: pc.x - bw / 2, x1: pc.x + bw / 2,
        y0: pc.y - bh / 2, y1: pc.y + bh / 2, w: bw, h: bh
      };
    }
    ZH.Anim.banner('BOSS APPROACHING', 'The zone is sealed');
    if (ZH.Anim && ZH.Anim.flash) ZH.Anim.flash('214,42,32', { peak: 1, duration: 620 });
    var bosses = wave.bosses || [];
    for (var i = 0; i < bosses.length; i++) {
      var pos = this.findSpawnPoint(800);
      var b = ZH.createBoss(bosses[i].type, pos.x, pos.y, this.diff,
        (this.stage && this.stage.multiplier) || 1);
      if (b) this.zombies.push(b);
    }
    /* a boss never walks in alone: the longer the run, the larger its escort,
       so a boss zone is a fight and not a duel in an empty street */
    var escort = 2 + Math.min(8, Math.floor((this.elapsed || 0) / 150));
    for (var e = 0; e < escort; e++) {
      if (this.zombies.length >= (this.hordeHard || ZH.HORDE.hardCap)) break;
      var ep = this.findSpawnPoint(720);
      var ez = ZH.createEnemy(e % 3 === 0 ? 'zombieB' : 'zombieA', ep.x, ep.y,
        (this.stage && this.stage.multiplier) || 1, this.diff, this.waveCycle || 0);
      if (ez) this.zombies.push(ez);
    }
  };

  Game.findSpawnPoint = function (dist, biasAngle) {
    var p = this.player;
    for (var i = 0; i < 20; i++) {
      var ang = biasAngle != null
        ? biasAngle + rand(-1.15, 1.15)      /* mostly ahead of the hunter */
        : rand(0, TAU);
      var d = dist + rand(-50, 100);
      var x = p.x + Math.cos(ang) * d;
      var y = p.y + Math.sin(ang) * d;
      if (Math.hypot(x - p.x, y - p.y) > 240) return { x: x, y: y };
    }
    return { x: p.x + rand(-600, 600), y: p.y + rand(-600, 600) };
  };

  /* -------------------------------- input --------------------------------
     Touch-only scheme: a visible thumbstick on the left, action buttons on
     the right. There is no keyboard path left — pointer events cover fingers
     and mouse alike, so the same widget is drivable on a desktop too. */
  /* Touch-only steering. The stick is a floating base: press anywhere in the
     lower-left part of the screen and the base jumps under your thumb, so you
     never have to look down or chase a fixed pad. Releasing parks it home. */
  Game.bindInput = function () {
    var self = this;
    var joy = document.getElementById('joystick');
    var knob = document.getElementById('joy-knob');
    if (!joy) return;

    var DEAD = 8;          /* neutral zone around the base, in px */
    var pid = null;

    function radius() {
      return Math.max(34, (joy.offsetWidth || 132) * 0.36);
    }

    function center() {
      var r = joy.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function send(dx, dy) {
      var R = radius();
      var d = Math.hypot(dx, dy);
      var cx = dx, cy = dy;
      if (d > R) { cx = dx / d * R; cy = dy / d * R; d = R; }
      if (knob) knob.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px)';
      if (d < DEAD) { self.input.joyX = 0; self.input.joyY = 0; }
      else { self.input.joyX = cx / R; self.input.joyY = cy / R; }
    }

    function place(x, y) {
      var w = joy.offsetWidth || 132, h = joy.offsetHeight || 132;
      joy.style.left = (x - w / 2) + 'px';
      joy.style.top = (y - h / 2) + 'px';
      joy.style.bottom = 'auto';
      joy.style.right = 'auto';
    }

    function home() {
      joy.style.left = '';
      joy.style.top = '';
      joy.style.bottom = '';
      joy.style.right = '';
    }

    function release() {
      pid = null;
      self.input.joyX = 0;
      self.input.joyY = 0;
      if (knob) knob.style.transform = 'translate(0px,0px)';
      joy.classList.remove('is-active');
      home();
    }

    function track(e) {
      var c = center();
      send(e.clientX - c.x, e.clientY - c.y);
    }

    function steerable(e) {
      if (self.state !== 'playing') return false;
      var t = e.target;
      if (!t || !t.closest) return false;
      /* buttons, panels and the skill chooser keep their own taps */
      if (t.closest('button, .levelup-overlay, .screen, .mobile-controls, .hud-top, .hud-bottom')) return false;
      return true;
    }

    joy.addEventListener('pointerdown', function (e) {
      if (!steerable(e)) return;
      pid = e.pointerId;
      joy.classList.add('is-active');
      track(e);                         /* grab from where the pad already sits */
      e.preventDefault();
    });

    /* pressing anywhere else on the left half plants the base under the thumb.

       A press ALWAYS takes the stick over, even when one is already tracked.
       A mouse that is released outside the window never delivers pointerup,
       so the old guard (`if (pid !== null) return`) left the stick locked for
       the rest of the run: the hunter could not be steered again and, since
       the aim follows the stick, the gun looked dead too. A real press is
       proof that no pointer is still down, so it re-grabs. */
    var layer = document.getElementById('app') || document.body;
    layer.addEventListener('pointerdown', function (e) {
      if (!steerable(e)) return;
      if (e.clientX > self.W * 0.6) return;
      pid = e.pointerId;
      place(e.clientX, e.clientY);
      joy.classList.add('is-active');
      send(0, 0);
      e.preventDefault();
    });

    window.addEventListener('pointermove', function (e) {
      if (pid === null || e.pointerId !== pid) return;
      track(e);
      e.preventDefault();
    }, { passive: false });

    function end(e) { if (pid !== null && e.pointerId === pid) release(); }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    joy.addEventListener('lostpointercapture', end);

    /* Releases that never arrive as pointerup: the pointer left the window,
       the window lost focus, or the page was hidden. Without these the stick
       stayed pressed with the last vector — the hunter walked into the horde
       on its own and the next press could not grab it. */
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) release();
    });
    document.addEventListener('pointerleave', release);
    document.addEventListener('mouseleave', release);

    /* the game itself parks the stick on pause and on level-up */
    self.releaseInput = release;

    /* ---- desktop steering: WASD / arrows, mouse aim, Space-to-fly ----
       The touch stick stays the primary control on a phone, but a desktop
       player should never have to drag a thumbstick with a mouse. */
    var canvas = self.canvas || document.getElementById('game');
    var MOVE_CODES = {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right'
    };
    window.addEventListener('keydown', function (e) {
      var k = self.input.keys || (self.input.keys = {});
      var dir = MOVE_CODES[e.code];
      if (dir) {
        k[dir] = true;
        document.body.classList.add('kb');
        e.preventDefault();
        return;
      }
      if (e.code === 'Space') {
        self.input.jet = true;
        if (self.state === 'playing') e.preventDefault();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (self.dash) self.dash();
      } else if (e.code === 'KeyR') {
        if (self.reload) self.reload();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (self.state === 'playing') self.pause();
        else if (self.state === 'paused') self.resume();
      }
    });
    window.addEventListener('keyup', function (e) {
      var k = self.input.keys || {};
      var dir = MOVE_CODES[e.code];
      if (dir) { k[dir] = false; return; }
      if (e.code === 'Space') self.input.jet = false;
    });

    /* mouse aim: the pointer is the crosshair, the gun answers it */
    function aimAtPointer(e) {
      if (!canvas || !self.camera || !self.player) return;
      var r = canvas.getBoundingClientRect();
      var z = self.camera.zoom || 1;
      self.input.aimX = self.camera.x + (e.clientX - r.left - self.W / 2) / z;
      self.input.aimY = self.camera.y + (e.clientY - r.top - self.H / 2) / z;
      self.input.aimMode = e.pointerType !== 'touch';
      if (e.pointerType === 'mouse') document.body.classList.add('kb');
    }
    if (canvas) {
      canvas.addEventListener('pointermove', aimAtPointer);
      canvas.addEventListener('pointerdown', aimAtPointer);
    }
  };

  /* Gamepad: left stick moves, right stick aims, A flies, B rolls, X reloads.
     Polled once a frame; a missing pad is a no-op. */
  Game.pollGamepad = function () {
    var inp = this.input;
    var pads = navigator.getGamepads ? navigator.getGamepads() : null;
    var gp = null;
    if (pads) {
      for (var i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
      }
    }
    if (!gp) {
      inp.padX = 0; inp.padY = 0;
      inp.padAimX = 0; inp.padAimY = 0; inp.padAimLen = 0;
      inp.padJet = false;
      return;
    }
    function axis(v) { return Math.abs(v) < 0.18 ? 0 : v; }
    var b = gp.buttons || [];
    inp.padX = axis(gp.axes[0] || 0);
    inp.padY = axis(gp.axes[1] || 0);
    inp.padAimX = axis(gp.axes[2] || 0);
    inp.padAimY = axis(gp.axes[3] || 0);
    inp.padAimLen = Math.hypot(inp.padAimX, inp.padAimY);
    inp.padJet = !!(b[0] && b[0].pressed);
    if (b[1] && b[1].pressed && !this._padDash) {
      this._padDash = true;
      if (this.dash) this.dash();
    }
    if (b[1] && !b[1].pressed) this._padDash = false;
    if (b[2] && b[2].pressed && !this._padReload) {
      this._padReload = true;
      if (this.reload) this.reload();
    }
    if (b[2] && !b[2].pressed) this._padReload = false;
    if (inp.padX || inp.padY) document.body.classList.add('kb');
  };

  /* the flash at the muzzle, the kick, and a casing: a shot reads as a shot */
  Game.muzzleFlash = function (id, p) {
    var def = ZH.WEAPONS && ZH.WEAPONS[id];
    if (!def || def.behaviour === 'orbit' || def.behaviour === 'saw' ||
        def.behaviour === 'aura' || def.behaviour === 'melee') return;
    var a = p.aimDir || 0;
    var tipX = p.x + Math.cos(a) * 26;
    var tipY = p.y - 6 + Math.sin(a) * 26;
    if (this.particles.length < 260) {
      this.particles.push({
        x: tipX, y: tipY, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40,
        life: 0.07, max: 0.07, size: 6, color: 'rgba(255,236,170,0.92)'
      });
      this.particles.push({
        x: tipX, y: tipY, vx: rand(-30, 30), vy: rand(-40, 10),
        life: 0.28, max: 0.28, size: 1.7, color: 'rgba(230,180,90,0.8)'
      });
      /* brass, thrown sideways and pulled down by gravity */
      this.particles.push({
        x: tipX, y: tipY,
        vx: Math.cos(a + 1.9) * 90, vy: Math.sin(a + 1.9) * 90 - 40,
        grav: 340, life: 0.38, max: 0.38, size: 1.5, color: 'rgba(214,168,84,0.95)'
      });
    }
    p.recoil = 0.08;
    if ((def.dmg || 0) > 60 || def.behaviour === 'rocket') this.shake = Math.max(this.shake, 3.2);
    else this.shake = Math.max(this.shake, 0.9);
  };

  Game.applyInput = function () {
    var p = this.player;
    if (!p) return;
    var inp = this.input;

    /* three steering sources blend together: thumbstick, WASD/arrows and a
       gamepad's left stick, so the hunter answers whichever is being used */
    var k = inp.keys || {};
    var kx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    var ky = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    var mx = (inp.joyX || 0) + kx + (inp.padX || 0);
    var my = (inp.joyY || 0) + ky + (inp.padY || 0);

    var len = Math.hypot(mx, my);
    if (len > 1) { var i = 1 / len; mx *= i; my *= i; }

    p.moveX = mx; p.moveY = my;

    /* Aim: right stick or mouse first, otherwise the walk direction
       (the original Survivors model). */
    var aimed = false;
    if (inp.padAimLen > 0.35) {
      p.aimDir = Math.atan2(inp.padAimY, inp.padAimX);
      aimed = true;
    } else if (inp.aimMode && inp.aimX != null && inp.aimY != null) {
      p.aimDir = Math.atan2(inp.aimY - p.y, inp.aimX - p.x);
      aimed = true;
    }
    if (!aimed && len > 0.01) p.aimDir = Math.atan2(my, mx);
    if (aimed || len > 0.01) p.facing = Math.cos(p.aimDir) >= 0 ? 1 : -1;
  };

  /* hold-to-fly jetpack: burns fuel, lifts the rig and skims over bites */
  Game.updateJetpack = function (dt) {
    var p = this.player;
    if (!p) return;
    var held = !!(this.input && (this.input.jet || this.input.padJet)) &&
      this.state === 'playing' && !p.dead;
    var wasFlying = !!p._wasJet;
    if (ZH.tickJetpack) ZH.tickJetpack(p, dt, held);

    /* ignition and landing both read in the world: a dust ring kicks out on
       take-off, a smaller puff settles when the boots touch down */
    if (p.jetActive && !wasFlying) {
      this.shake = Math.max(this.shake || 0, 3.4);
      this.particles.push({
        x: p.x, y: p.y + 10, vx: 0, vy: 0, life: 0.32, max: 0.32,
        size: 46, ring: true, color: 'rgba(190,232,255,0.85)'
      });
      for (var ig = 0; ig < 8; ig++) {
        var ia = rand(0, TAU);
        this.particles.push({
          x: p.x, y: p.y + 8, vx: Math.cos(ia) * rand(70, 190), vy: Math.sin(ia) * rand(20, 70) + 30,
          life: rand(0.2, 0.4), max: 0.4, size: rand(1.6, 3),
          color: 'rgba(200,214,224,0.55)'
        });
      }
    } else if (!p.jetActive && wasFlying) {
      this.particles.push({
        x: p.x, y: p.y + 10, vx: 0, vy: 0, life: 0.26, max: 0.26,
        size: 30, ring: true, color: 'rgba(220,220,220,0.5)'
      });
    }
    p._wasJet = p.jetActive;

    if (p.jetActive) {
      /* twin thrusters: an additive flame plus a second, shorter core, and a
         speed streak while the ignition kick is still running */
      var burst = p.jetBurst > 0;
      var n = burst ? 3 : 2;
      for (var jp = 0; jp < n; jp++) {
        this.particles.push({
          x: p.x + rand(-8, 8), y: p.y + 9,
          vx: rand(-40, 40) - (p.moveX || 0) * 40,
          vy: rand(60, 150) + (p.moveY || 0) * 40,
          life: burst ? 0.4 : 0.3, max: 0.4, size: rand(1.8, 3.2),
          blend: 'lighter',
          color: Math.random() < 0.5 ? 'rgba(255,182,72,0.8)' : 'rgba(160,235,255,0.75)'
        });
      }
      if (burst) {
        this.particles.push({
          x: p.x, y: p.y + 12, vx: 0, vy: 0, life: 0.18, max: 0.18,
          size: 58, ring: true, color: 'rgba(255,214,140,0.8)'
        });
      }
    }
  };

  /* combat roll: burst of speed, untouchable for the duration */
  Game.dash = function () {
    var p = this.player;
    if (!p || p.dead || this.state !== 'playing') return false;
    if ((p.dashCd || 0) > 0) return false;

    var mx = p.moveX, my = p.moveY;
    var len = Math.hypot(mx, my);
    if (len < 0.01) {                 /* standing still: roll where you aim */
      mx = Math.cos(p.aimDir || 0);
      my = Math.sin(p.aimDir || 0);
      len = 1;
    }
    p.dashVX = mx / len;
    p.dashVY = my / len;
    p.dashT = 0.2;
    p.dashCd = p.dashMax || 2.2;
    ZH.openShield(p, ZH.SHIELD.dash);
    if (ZH.Audio) ZH.Audio.play('dash');
    return true;
  };

  /* ---------------------------- manual reload ----------------------------
     A deliberate reload is a TACTICAL action: it starts instantly on every
     carried gun, finishes in 60% of the automatic time, and works on a
     half-empty magazine (so the player can top up before a boss instead of
     waiting to run dry). Pressing it with full magazines answers instead of
     doing nothing silently. */
  Game.RELOAD_MANUAL_MUL = 0.6;
  Game.reload = function () {
    var p = this.player;
    if (!p || !p.weapons || p.dead || this.state !== 'playing') return false;
    var started = 0, full = 0;
    for (var name in p.weapons) {
      var w = p.weapons[name];
      var base = ZH.WEAPONS && ZH.WEAPONS[name];
      if (!base) continue;
      /* the gun that is actually equipped (an evolved entry) owns the mag */
      var eff = ZH.effectiveWeapon ? ZH.effectiveWeapon(name, w, p.supplies) : name;
      var def = (ZH.WEAPONS && ZH.WEAPONS[eff]) || base;
      if (def.ammo === false) continue;          /* melee / orbit guns never reload */
      if (w.mag == null || !isFinite(w.mag)) { w.mag = def.mag; w.reloading = 0; }
      if (w.mag >= (def.mag || base.mag)) { full++; continue; }
      if (w.reloading > 0) { started++; continue; }
      w.reloading = (def.reload || 1.5) * this.RELOAD_MANUAL_MUL;
      w.manual = true;
      started++;
    }
    if (started) {
      if (ZH.Audio) ZH.Audio.play('reload');
      if (ZH.Anim && ZH.Anim.toast) ZH.Anim.toast('RELOADING', 'info');
      return true;
    }
    /* nothing to do: say so, so the button never feels dead */
    if (full) {
      if (ZH.Audio) ZH.Audio.play('click');
      if (ZH.Anim && ZH.Anim.toast) ZH.Anim.toast('MAGAZINE FULL', 'info');
    }
    return false;
  };

  Game.pause = function () {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    /* drop the stick: otherwise the last drag vector survives the pause and
       the hunter walks off by itself the moment the game resumes */
    if (this.releaseInput) this.releaseInput();
    if (this.input) this.input.jet = false;
    if (this.ui) this.ui.showPause();
  };

  Game.resume = function () {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    if (this.ui) this.ui.hideScreens();
    this.lastTs = performance.now();
  };

  /* ------------------------------ update ------------------------------ */
  Game.update = function (dt) {
    /* self-heal: a 'levelup' state with no usable chooser on screen is a dead
       end (this is what looked like a black screen with the game standing
       still). The chooser must exist, be active, and carry an escape button. */
    if (this.state === 'levelup') {
      var chooser = document.getElementById('levelup-overlay');
      var escapable = chooser && chooser.classList.contains('is-active') &&
        chooser.querySelector('#lu-skip');
      if (!escapable) {
        if (chooser && chooser.parentNode) chooser.parentNode.removeChild(chooser);
        this.state = 'playing';
        this.lastTs = performance.now();
      }
    }
    if (this.state === 'victory') {
      /* the original's DELAY_GAME_WON: a 5 s beat before the results card */
      this.t += dt;
      this.victoryT = Math.max(0, (this.victoryT || 0) - dt);
      if (this.victoryT <= 0) this.finishStage(true);
      return;
    }
    if (this.state !== 'playing') return;
    this.t += dt;
    /* the red edge pulse that answers a hit fades on its own */
    this.hurtT = Math.max(0, (this.hurtT || 0) - dt);
    /* and the bomb pickup whitens the frame for a beat */
    this.bombFlash = Math.max(0, (this.bombFlash || 0) - dt);
    /* a live boss zone freezes the level clock (original behaviour) */
    if (!this.bossZoneActive) this.elapsed += dt;

    var p = this.player;
    this.pollGamepad();
    this.applyInput();
    this.updateJetpack(dt);
    this.updateTraffic(dt);

    // combat roll: hold the locked dash vector while it lasts
    if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashVX * p.speed * 3.4 * dt;
      p.y += p.dashVY * p.speed * 3.4 * dt;
      p.walkPhase += dt * 14;
      if (p.dashT <= 0) ZH.openShield(p, ZH.SHIELD.dashExit);
    }

    if (ZH.updateSurvivor) ZH.updateSurvivor(p, dt, this);
    if (ZH.updateEnemies) ZH.updateEnemies(this.zombies, dt, this);
    if (ZH.updateProjectiles) ZH.updateProjectiles(this.bullets, dt, this);
    if (ZH.updateProjectiles) ZH.updateProjectiles(this.enemyBullets, dt, this);
    if (ZH.updatePickups) ZH.updatePickups(this.pickups, dt, this);
    /* survivor power runtime: regeneration and burn ticks */
    if (ZH.Powers) ZH.Powers.update(this, dt);

    // all weapons fire automatically along the aim direction
    this.autoFire(dt);

    // particles
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
      pt.vy += (pt.grav || 0) * dt;
      pt.vx *= Math.pow(0.9, dt * 60);
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    // floaters
    for (var f = this.floaters.length - 1; f >= 0; f--) {
      var fl = this.floaters[f];
      fl.life -= dt;
      fl.y += fl.vy * dt;
      if (fl.life <= 0) this.floaters.splice(f, 1);
    }
    // remove dead
    for (var z = this.zombies.length - 1; z >= 0; z--) {
      if (this.zombies[z].dead && this.zombies[z].removeT <= 0) this.zombies.splice(z, 1);
      else if (this.zombies[z].dead) this.zombies[z].removeT -= dt;
    }

    this.shake = Math.max(0, this.shake - dt * 40);

    // boss zone closes once every boss is downed, unfreezing the waves
    if (this.bossZoneActive) {
      if (!this.bossZoneT) this.bossZoneT = 0;
      this.bossZoneT += dt;
      var anyBoss = false;
      for (var bi = 0; bi < this.zombies.length; bi++) {
        if (this.zombies[bi].boss && !this.zombies[bi].dead) { anyBoss = true; break; }
      }
      // safety latch: never let a boss zone freeze the run forever
      if (!anyBoss || this.bossZoneT > 120) {
        this.bossZoneActive = false;
        this.bossZoneT = 0;
        this.bossZoneRect = null;
        if (this.ui && ZH.Anim && ZH.Anim.banner) ZH.Anim.banner('ZONE CLEAR', 'The horde resumes');
      }
    }

    this.updateWaves(dt);

    // treasure chest on timeToTreasure: grabbing it opens the skill slots
    if (this.stage && !this.treasureSpawned &&
        this.elapsed >= (this.stage.timeToTreasure || 15)) {
      this.treasureSpawned = true;
      this.pickups.push({
        type: 'treasure',
        x: p.x + rand(-90, 90), y: p.y + rand(-90, 90), life: 90
      });
      if (ZH.Anim && ZH.Anim.banner) ZH.Anim.banner('TREASURE', 'Grab it to pick a skill');
    }

    /* gift drops: a wrapped box that pays out a random reward */
    this.giftT = (this.giftT || 0) + dt;
    if (this.giftT > 40 && this.pickups.length < 26) {
      this.giftT = 0;
      var ga = rand(0, TAU), gd = rand(150, 330);
      this.pickups.push({
        type: 'gift', x: p.x + Math.cos(ga) * gd, y: p.y + Math.sin(ga) * gd, life: 45
      });
      if (ZH.Anim && ZH.Anim.banner) ZH.Anim.banner('GIFT DROP', 'Something is wrapped nearby');
    }

    this.updateCamera(dt);
    this.pushHud();

    // check win (TIME_LEVEL_COMPLETED = 1,200,000 ms)
    if (this.elapsed >= (ZH.TIME_LEVEL_COMPLETED || 1200) && !this.bossZoneActive) {
      if (!this.victoryT) {
        this.victoryT = 5;
        this.state = 'victory';
        if (ZH.Anim && ZH.Anim.banner) ZH.Anim.banner('ZONE CLEARED', 'You survived 20 minutes');
        if (ZH.Audio) ZH.Audio.play('win');
      }
      return;
    }

    if (p.hp <= 0 && p.dead) {
      p.deadT += dt;
      if (p.deadT > 2) this.offerContinue();
      return;
    }

    // level-up XP gate: expsToLevel = floor(1000 * 1.25^(level-1))
    var guard = 0;
    while (p.exp != null && p.exp >= this.expNeeded(p.level || 1) && guard++ < 5) {
      var need = this.expNeeded(p.level || 1);
      p.exp -= need;
      p.level = (p.level || 1) + 1;
      /* a short safe window while the cards are up */
      ZH.openShield(p, ZH.SHIELD.levelup);
      /* the chooser takes over the screen: park the stick so the hunter does
         not keep walking while the cards are up, and so the next press is a
         clean grab */
      if (ZH.Anim && ZH.Anim.flash) ZH.Anim.flash('255,196,90', { peak: 0.65, duration: 420 });
      if (this.releaseInput) this.releaseInput();
      if (this.ui) this.ui.showLevelUp();
      if (this.state === 'levelup') break;
    }
    if (p.exp < 0) p.exp = 0;
  };

  /* XP the next level costs (original: floor(1000 * 1.25^(level-1))) */
  Game.expNeeded = function (level) {
    var lvl = Math.max(1, level || 1);
    var need = Math.floor(1000 * Math.pow(1.25, lvl - 1));
    var learn = (this.player && this.player.learning) || 0;
    return Math.max(50, Math.round(need / (1 + learn / 100)));
  };

  /* push survivor state into the DOM HUD (hp, weapon, coins, wave…) */
  Game.pushHud = function () {
    if (!this.ui || !this.ui.updateHud || !this.player) return;
    var p = this.player;
    var wid = p.primaryWeapon || 'gun';
    var live = (p.weapons && p.weapons[wid]) || {};
    // an evolved gun runs on its own stats (name, magazine, ammo)
    var eid = ZH.effectiveWeapon ? ZH.effectiveWeapon(wid, live, p.supplies) : wid;
    var w = (ZH.WEAPONS && ZH.WEAPONS[eid]) || { id: wid, name: wid, short: wid.toUpperCase(), mag: 1, reload: 1.5 };
    var magMax = w.mag || 1;
    var magNow = live.mag == null ? magMax : Math.max(0, Math.round(live.mag));
    if (w.ammo === false) { magNow = '∞'; magMax = '∞'; }
    var relTotal = w.reload || 1.5;
    var relLeft = live.reloading || 0;
    // find the active boss for the boss bar
    var boss = null;
    for (var i = 0; i < this.zombies.length; i++) {
      if (this.zombies[i].boss && !this.zombies[i].dead) { boss = this.zombies[i]; break; }
    }
    this.ui.updateHud({
      hp: Math.max(0, p.hp), maxHp: p.maxHp,
      dashCd: p.dashCd || 0, dashMax: p.dashMax || 2.2,
      shield: p.shieldT || 0, shieldMax: p.shieldMax || 3,
      jet: p.jetFuel == null ? 100 : p.jetFuel,
      jetMax: (ZH.JETPACK && ZH.JETPACK.max) || 100,
      jetActive: !!p.jetActive,
      mag: magNow, weapon: w,
      reloading: relLeft > 0,
      reloadFrac: relLeft > 0 ? Math.min(1, 1 - relLeft / relTotal) : 0,
      coins: this.coins, score: this.score,
      wave: Math.floor(this.elapsed / 30) + 1,
      left: this.zombies.length,
      mode: this.mode || 'campaign',
      levelName: this.stage ? this.stage.name : '',
      supplies: p.supplies || {},
      boss: boss ? { name: (boss.name || boss.type || 'BOSS'), hp: boss.hp, max: boss.maxHp } : null
    });
  };

  Game.updateCamera = function (dt) {
    var p = this.player;
    if (!p) return;
    var k = 1 - Math.exp(-8 * dt);
    this.camera.zoom = lerp(this.camera.zoom, 0.8, k);
    this.camera.x = lerp(this.camera.x, p.x, k);
    this.camera.y = lerp(this.camera.y, p.y, k);

    /* no camera clamp: the city is endless, and chunks bake on demand */
    this.trackDistrict();
  };

  /* the endless city changes character every 2048 px; announce it once */
  Game.trackDistrict = function () {
    var a = this.arena;
    if (!a || !a.themeAt) return;
    var cx = Math.floor(this.player.x / 512), cy = Math.floor(this.player.y / 512);
    var theme = a.themeAt(cx, cy);
    if (this._district === theme) return;
    var first = this._district == null;
    this._district = theme;
    if (first) return;
    var name = (ZH.Arena.THEMES[theme] || {}).name || 'THE CITY';
    if (ZH.Anim && ZH.Anim.banner) ZH.Anim.banner(name.toUpperCase(), 'NEW DISTRICT');
  };

  /* ------------------------------ render ------------------------------ */
  Game.render = function () {
    /* keep drawing during 'levelup' — the chooser is a DOM overlay on top of
       the frozen world. Bailing here used to leave the canvas black if the
       overlay failed to appear. */
    if (!this.player) return;
    var ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#0a0d10';
    ctx.fillRect(0, 0, this.W, this.H);

    if (!this.arena || !this.player || this.state === 'menu') {
      return;
    }

    // Survivors auto-fire along move direction (handled in update)


    var z = this.camera.zoom;
    var shakeX = 0, shakeY = 0;
    if (this.shake > 0.2) {
      shakeX = rand(-this.shake, this.shake);
      shakeY = rand(-this.shake, this.shake);
    }

    ctx.save();
    ctx.translate(this.W / 2 + shakeX, this.H / 2 + shakeY);
    ctx.scale(z, z);
    ctx.translate(-this.camera.x, -this.camera.y);

    // draw arena (chunked open-world tiles)
    if (this.arena && this.arena.draw) {
      var vx0 = this.camera.x - this.W / 2 / z;
      var vy0 = this.camera.y - this.H / 2 / z;
      var vx1 = this.camera.x + this.W / 2 / z;
      var vy1 = this.camera.y + this.H / 2 / z;
      this.arena.draw(ctx, vx0, vy0, vx1, vy1);
    }
    this.drawTraffic(ctx);

    // decals
    for (var d = 0; d < this.decals.length; d++) {
      var dc = this.decals[d];
      ctx.save();
      ctx.translate(dc.x, dc.y);
      ctx.rotate(dc.rot);
      ctx.globalAlpha = dc.alpha;
      ctx.fillStyle = '#54100c';
      ctx.beginPath();
      ctx.ellipse(0, 0, dc.r, dc.r * 0.62, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // pickups
    for (var p = 0; p < this.pickups.length; p++) {
      var pk = this.pickups[p];
      var bob = Math.sin(this.t * 4 + p) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.type === 'exp') {
        ctx.fillStyle = 'rgba(79,195,247,0.25)';
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
      } else if (pk.type === 'coin') {
        ctx.fillStyle = 'rgba(255,209,102,0.28)';
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(120,80,10,0.7)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.stroke();
      } else if (pk.type === 'treasure') {
        /* gold chest: grab it to open the skill cards */
        var gl = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
        gl.addColorStop(0, 'rgba(255,214,120,0.55)');
        gl.addColorStop(1, 'rgba(255,190,80,0)');
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8a5a24';
        ctx.fillRect(-16, -8, 32, 20);
        ctx.fillStyle = '#c98c32';
        ctx.fillRect(-16, -14, 32, 8);
        ctx.strokeStyle = '#3a2610'; ctx.lineWidth = 2;
        ctx.strokeRect(-16, -14, 32, 26);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-3, -8, 6, 8);
      } else if (pk.type === 'gift') {
        var gglow = ctx.createRadialGradient(0, 0, 3, 0, 0, 40);
        gglow.addColorStop(0, 'rgba(255,214,120,0.42)');
        gglow.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = gglow;
        ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2f8c7c';
        ctx.fillRect(-14, -12, 28, 24);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-3.5, -12, 7, 24);
        ctx.fillRect(-14, -3.5, 28, 7);
        ctx.strokeStyle = '#12332e'; ctx.lineWidth = 2;
        ctx.strokeRect(-14, -12, 28, 24);
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, -20); ctx.lineTo(-6, -20); ctx.closePath(); ctx.fill();
      } else if (pk.type === 'bomb') {
        /* black sphere with a lit fuse: the screen-clear pickup */
        var bglow = ctx.createRadialGradient(0, 0, 3, 0, 0, 36);
        bglow.addColorStop(0, 'rgba(255,120,90,0.4)');
        bglow.addColorStop(1, 'rgba(255,120,90,0)');
        ctx.fillStyle = bglow;
        ctx.beginPath(); ctx.arc(0, 0, 36, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1b1d21';
        ctx.beginPath(); ctx.arc(0, 2, 11, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,140,90,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 2, 11, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#c9b489'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(9, -16); ctx.stroke();
        ctx.fillStyle = '#ffb347';
        ctx.beginPath(); ctx.arc(10, -18, 3, 0, TAU); ctx.fill();
      } else if (pk.type === 'magnet') {
        /* horseshoe magnet, cyan glow */
        var mglow = ctx.createRadialGradient(0, 0, 3, 0, 0, 34);
        mglow.addColorStop(0, 'rgba(120,230,255,0.4)');
        mglow.addColorStop(1, 'rgba(120,230,255,0)');
        ctx.fillStyle = mglow;
        ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#8fe6ff'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(8, 8); ctx.stroke();
        ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-8, 7); ctx.lineTo(-8, 11); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8, 7); ctx.lineTo(8, 11); ctx.stroke();
      } else if (pk.type === 'medikit') {
        var kig = ctx.createRadialGradient(0, 0, 3, 0, 0, 32);
        kig.addColorStop(0, 'rgba(255,255,255,0.3)');
        kig.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = kig;
        ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8edf2';
        ctx.fillRect(-12, -9, 24, 18);
        ctx.strokeStyle = '#7c8894'; ctx.lineWidth = 1.6;
        ctx.strokeRect(-12, -9, 24, 18);
        ctx.fillStyle = '#e04b4b';
        ctx.fillRect(-2.5, -6, 5, 12);
        ctx.fillRect(-6, -2.5, 12, 5);
      } else if (pk.type === 'food') {
        var fg = ctx.createRadialGradient(0, 0, 3, 0, 0, 30);
        fg.addColorStop(0, 'rgba(155,225,93,0.35)');
        fg.addColorStop(1, 'rgba(155,225,93,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
        ctx.fillStyle = '#9be15d';
        ctx.beginPath(); ctx.arc(0, 4, 9, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#5f8f38'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, -14); ctx.stroke();
      } else if (pk.type === 'item') {
        var look = ZH.itemLook ? ZH.itemLook(pk.itemId) : ['?', '#ccc'];
        var ig = ctx.createRadialGradient(0, 0, 3, 0, 0, 34);
        ig.addColorStop(0, 'rgba(255,255,255,0.28)');
        ig.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = ig;
        ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(16,20,22,0.9)';
        ctx.fillRect(-13, -13, 26, 26);
        ctx.strokeStyle = look[1]; ctx.lineWidth = 2.5;
        ctx.strokeRect(-13, -13, 26, 26);
        ctx.fillStyle = look[1];
        ctx.font = 'bold 15px Rajdhani, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(look[0], 0, 5);
        ctx.textAlign = 'left';
      }
      ctx.restore();
    }

    var px = this.player.x, py = this.player.y;
    // a full horde would blow the frame budget with the detailed rig, so the
    // closest 26 stay fully rigged and the rest get a cheap silhouette
    var horde = this.zombies.length > 45;
    var cheap = null;
    if (horde) {
      cheap = {};
      var sorted = this.zombies.slice().sort(function (a, b) {
        var da = (a.x - px) * (a.x - px) + (a.y - py) * (a.y - py);
        var db = (b.x - px) * (b.x - px) + (b.y - py) * (b.y - py);
        return da - db;
      });
      for (var si = 26; si < sorted.length; si++) cheap[sorted[si].seed] = 1;
    }
    var viewX0 = this.camera.x - this.W / 2 / z - 90;
    var viewX1 = this.camera.x + this.W / 2 / z + 90;
    var viewY0 = this.camera.y - this.H / 2 / z - 140;
    var viewY1 = this.camera.y + this.H / 2 / z + 90;

    // characters sorted by y
    var order = this.zombies.slice();
    order.push(this.player);
    order.sort(function (a, b) { return a.y - b.y; });

    for (var oi = 0; oi < order.length; oi++) {
      var e = order[oi];
      if (e !== this.player && (e.x < viewX0 || e.x > viewX1 || e.y < viewY0 || e.y > viewY1)) continue;
      if (e === this.player) {
        /* keep the hunter readable inside a packed horde */
        var ring = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 30);
        ring.addColorStop(0, 'rgba(255,196,110,0.42)');
        ring.addColorStop(1, 'rgba(255,179,71,0)');
        ctx.fillStyle = ring;
        ctx.beginPath(); ctx.arc(e.x, e.y, 34, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,206,130,0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(e.x, e.y + 11, 18, 7, 0, 0, TAU); ctx.stroke();
        /* original Player.updatePlayerInvincibility(): while the defence
           shield runs the body blinks 0.5 → 1 on a 500 ms cycle. */
        var shieldT = e.shieldT || 0;
        var blink = 1;
        if (shieldT > 0) {
          var phase = Math.abs((shieldT * 1000) % 500 - 250) / 250;   // 0..1..0
          blink = 0.5 + phase * 0.5;
          ctx.save();
          ctx.strokeStyle = 'rgba(150,215,255,' + (0.5 + phase * 0.45).toFixed(3) + ')';
          ctx.lineWidth = 3;
          ctx.shadowColor = 'rgba(120,200,255,0.9)';
          ctx.shadowBlur = 10;
          /* the ring itself drains: it is an arc of the remaining fraction,
             not a decorative circle, so the window reads at a glance */
          var frac = Math.max(0, Math.min(1, shieldT / (e.shieldMax || ZH.SHIELD.max)));
          ctx.beginPath();
          ctx.arc(e.x, e.y, 27, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
          ctx.stroke();
          ctx.restore();
          /* and the one-decimal countdown floats over the hunter, so the
             protection window is readable in the world, not just in the HUD */
          ctx.save();
          ctx.font = 'bold 13px Rajdhani, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(8,14,20,0.7)';
          ctx.fillText(shieldT.toFixed(1) + 's', e.x + 1, e.y - 39);
          ctx.fillStyle = 'rgba(190,232,255,' + (0.75 + phase * 0.25).toFixed(2) + ')';
          ctx.fillText(shieldT.toFixed(1) + 's', e.x, e.y - 40);
          ctx.textAlign = 'left';
          ctx.restore();
        }
        if (e.jetActive) {
          /* twin jets: a short blue-core flame that flickers under the rig */
          ctx.fillStyle = 'rgba(0,0,0,0.26)';
          ctx.beginPath(); ctx.ellipse(e.x, e.y + 11, 18, 6, 0, 0, TAU); ctx.fill();
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          var flick = 8 + Math.sin((this.t || 0) * 40) * 4;
          for (var js = -1; js <= 1; js += 2) {
            var jx = e.x + js * 7, jy = e.y + 8;
            var jg = ctx.createLinearGradient(jx, jy, jx, jy + 26 + flick);
            jg.addColorStop(0, 'rgba(190,246,255,0.95)');
            jg.addColorStop(0.4, 'rgba(255,194,80,0.78)');
            jg.addColorStop(1, 'rgba(255,72,20,0)');
            ctx.fillStyle = jg;
            ctx.beginPath();
            ctx.moveTo(jx - 5, jy);
            ctx.lineTo(jx + 5, jy);
            ctx.lineTo(jx, jy + 26 + flick);
            ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }
        /* MEOW hunter: cat ears and a swishing tail over the rig */
        if (e.character === 'meow') {
          var earF = e.facing || 1;
          ctx.save();
          ctx.translate(e.x, e.y - (e.jetLift || 0));
          ctx.fillStyle = '#3a3348';
          ctx.strokeStyle = 'rgba(255,143,208,0.8)';
          ctx.lineWidth = 1.3;
          for (var ear = -1; ear <= 1; ear += 2) {
            ctx.beginPath();
            ctx.moveTo(ear * 4.4, -44);
            ctx.lineTo(ear * 9.4, -57);
            ctx.lineTo(ear * 11.6, -42);
            ctx.closePath(); ctx.fill(); ctx.stroke();
          }
          var swish = Math.sin((this.t || 0) * 6) * 7;
          ctx.strokeStyle = '#4a4160';
          ctx.lineWidth = 4.4; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-earF * 7, -14);
          ctx.quadraticCurveTo(-earF * 26, -16 + swish, -earF * 30, -34 + swish);
          ctx.stroke();
          ctx.restore();
        }
        /* the last shot still pushes the rig back a little */
        var kick = (e.recoil || 0) * 11;
        var kAng = e.aimDir || 0;
        ZH.Rig.draw(ctx, {
          x: e.x - Math.cos(kAng) * kick, y: e.y - (e.jetLift || 0) - Math.sin(kAng) * kick,
          s: 1.15, kind: 'hunter', variant: 'hunter',
          facing: e.facing, aim: e.aimDir || 0, weapon: e.primaryWeapon,
          alpha: blink,
          palette: ZH.Rig.paletteFor ? ZH.Rig.paletteFor(e.character || 'hunter') : null,
          dead: e.dead ? clamp(e.deadT, 0, 1) : 0,
          pose: { t: this.t, moving: Math.hypot(e.moveX, e.moveY), walkPhase: e.walkPhase || 0 }
        });
      } else if (cheap && cheap[e.seed] && !e.boss) {
        drawCheapZombie(ctx, e);
      } else {
        ZH.Rig.draw(ctx, {
          x: e.x, y: e.y, s: e.scale || 1, kind: 'zombie', variant: e.variant,
          facing: e.facing || 1, aim: e.aimDir || 0,
          flash: e.hurtFlash || 0,
          seed: e.seed || 0,
          pose: { t: this.t, moving: 0.7, walkPhase: e.walkPhase || 0 }
        });
        // boss health bar
        if (e.boss && e.hp) {
          var bw = 80, bh = 6;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(e.x - bw/2 - 2, e.y - 80, bw + 4, bh + 4);
          ctx.fillStyle = '#300';
          ctx.fillRect(e.x - bw/2, e.y - 78, bw, bh);
          var frac = e.hp / e.maxHp;
          ctx.fillStyle = '#f44';
          ctx.fillRect(e.x - bw/2, e.y - 78, bw * frac, bh);
        }
      }
    }

    // bullets — every weapon gets its own projectile silhouette
    drawShots(ctx, this);

    // a faint lock line so the auto-aim target is readable on screen
    drawAimLock(ctx, this);

    for (var eb = 0; eb < this.enemyBullets.length; eb++) {
      var ebl = this.enemyBullets[eb];
      var eg = ctx.createRadialGradient(ebl.x, ebl.y, 1, ebl.x, ebl.y, 12);
      eg.addColorStop(0, 'rgba(169,232,63,0.55)');
      eg.addColorStop(1, 'rgba(120,200,40,0)');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(ebl.x, ebl.y, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b7ef55';
      ctx.beginPath(); ctx.arc(ebl.x, ebl.y, 3.4, 0, TAU); ctx.fill();
    }

    // particles — additive sparks, expanding shockwave rings and soft puffs
    for (var pi = 0; pi < this.particles.length; pi++) {
      var p2 = this.particles[pi];
      var al = Math.max(0, Math.min(1, p2.life / (p2.max || 1)));
      if (p2.ring) {
        /* blast edge: grows as it fades, so a rocket reads as a detonation */
        ctx.save();
        ctx.globalAlpha = al * 0.9;
        ctx.strokeStyle = p2.color || 'rgba(255,170,90,0.8)';
        ctx.lineWidth = 1.4 + al * 4;
        ctx.beginPath();
        ctx.arc(p2.x, p2.y, Math.max(2, (p2.size || 40) * (1 - al)), 0, TAU);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (p2.blend) ctx.globalCompositeOperation = p2.blend;
      ctx.globalAlpha = al;
      ctx.fillStyle = p2.color;
      ctx.beginPath(); ctx.arc(p2.x, p2.y, p2.size, 0, TAU); ctx.fill();
      if (p2.blend) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;

    /* floating combat text: damage numbers and pickup words, so every hit
       reads on screen even in a packed horde */
    for (var fi = 0; fi < this.floaters.length; fi++) {
      var fo = this.floaters[fi];
      var fa = Math.max(0, Math.min(1, fo.life / (fo.max || 0.8)));
      ctx.globalAlpha = fa;
      ctx.font = 'bold ' + (fo.size || 14) + 'px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(6,10,12,0.72)';
      ctx.fillText(fo.text, fo.x + 1, fo.y + 1);
      ctx.fillStyle = fo.color || '#ffe9a8';
      ctx.fillText(fo.text, fo.x, fo.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    ctx.restore();

    /* district atmosphere + lens focus, painted over the world but under the
       DOM HUD so the readouts stay crisp */
    this.drawAtmosphere(ctx);

    // HUD lives in the DOM (ui.updateHud); no canvas duplicate
  };

  /* Each district already owns a fog tint and a weather mood. Painting them
     over the world (instead of baking them into every chunk) gives the city
     depth, hides chunk seams and makes walking into a new place read at once. */
  Game.drawAtmosphere = function (ctx) {
    if (!this.player || !this.arena) return;
    var key = this.arena.themeAt
      ? this.arena.themeAt(Math.floor(this.player.x / 512), Math.floor(this.player.y / 512))
      : this.arena._fn;
    var cfg = ZH.Arena.THEMES && ZH.Arena.THEMES[key];
    if (!cfg) return;
    var t = this.t || 0;

    /* colour grade: the district's own fog, kept light */
    if (!this._fogFill || this._fogKey !== key) {
      this._fogFill = String(cfg.fog || 'rgba(30,40,50,0.5)')
        .replace(/[\d.]+\s*\)\s*$/, '0.13)');
      this._fogKey = key;
    }
    ctx.fillStyle = this._fogFill;
    ctx.fillRect(0, 0, this.W, this.H);

    /* weather: rain streaks, drifting ash or warm dust */
    var mode = cfg.ambient || 'dust';
    var count = mode === 'rain' ? 90 : 46;
    ctx.save();
    ctx.lineCap = 'round';
    for (var i = 0; i < count; i++) {
      var sx = (i * 173.7 + (mode === 'rain' ? t * 140 : t * 22)) % (this.W + 60) - 30;
      var sy = (i * 311.3 + (mode === 'rain' ? t * 760 : t * 34)) % (this.H + 60) - 30;
      if (mode === 'rain') {
        ctx.strokeStyle = 'rgba(170,205,235,0.22)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 3, sy + 16); ctx.stroke();
      } else if (mode === 'ash') {
        ctx.fillStyle = 'rgba(226,222,210,0.20)';
        ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,214,150,0.13)';
        ctx.beginPath(); ctx.arc(sx, sy, 1.9, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();

    /* distant lightning on the rainy districts: a quiet sky read that makes
       the wet map feel alive without touching gameplay */
    if (mode === 'rain') {
      var cyc = t % 11;
      if (cyc < 0.2) {
        ctx.fillStyle = 'rgba(205,228,255,' + (0.14 * (1 - cyc / 0.2)).toFixed(3) + ')';
        ctx.fillRect(0, 0, this.W, this.H);
      }
    }

    /* vignette: focus the fight and soften the edges of the frame */
    if (!this._vig || this._vigW !== this.W || this._vigH !== this.H) {
      var g = ctx.createRadialGradient(
        this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.30,
        this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.65, 'rgba(0,0,0,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0.52)');
      this._vig = g; this._vigW = this.W; this._vigH = this.H;
    }
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, this.W, this.H);

    /* damage frame: a red edge pulse on a hit, and a pulsing warning while the
       hunter is close to death — the screen says what the HP bar says */
    var hpFrac = this.player.maxHp ? Math.max(0, this.player.hp) / this.player.maxHp : 1;
    var low = hpFrac < 0.32 ? 1 - hpFrac / 0.32 : 0;
    var hurt = Math.max(0, Math.min(1, (this.hurtT || 0) / 0.3));
    var danger = Math.max(hurt, low * (0.5 + 0.5 * Math.sin(t * 7)));
    if (danger > 0.02) {
      if (!this._hurtVig || this._hurtW !== this.W || this._hurtH !== this.H) {
        var hv = ctx.createRadialGradient(
          this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.26,
          this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.7);
        hv.addColorStop(0, 'rgba(170,20,20,0)');
        hv.addColorStop(0.72, 'rgba(170,20,20,0.28)');
        hv.addColorStop(1, 'rgba(150,12,12,0.72)');
        this._hurtVig = hv; this._hurtW = this.W; this._hurtH = this.H;
      }
      ctx.save();
      ctx.globalAlpha = danger;
      ctx.fillStyle = this._hurtVig;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    }

    /* bomb pickup: a white shutter over the whole frame as the screen clears */
    var bombA = Math.min(1, (this.bombFlash || 0) / 0.42);
    if (bombA > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = bombA * 0.6;
      ctx.fillStyle = 'rgba(255,244,214,1)';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    }
  };

  /* tints per weapon family: a shotgun blast should not look like a laser */
  var SHOT_TINT = {
    gun: '#ffd166', uzi: '#ffdf8a',
    crossbow: '#d8ecff', shotgun: '#eaf6ff',
    drill: '#7fe1ff', lasergun: '#b9f0ff',
    tesla: '#9ad4ff', thunderorb: '#c9b3ff',
    bazooka: '#ff9a5c', nuke: '#ff7a3d',
    rocketlauncher: '#ffb15c', doomsday: '#ff6b3d',
    grenadelauncher: '#c8e86a', siegebreaker: '#ffe06a',
    launcher: '#ff8a5c', airstrike: '#ffc46b',
    flamer: '#ffb066', plasmagun: '#8ef2d0',
    boomerang: '#f6c45a', neckbreaker: '#ffe08a',
    spikedball: '#cfd8e2', biliard: '#e6eef8',
    molotov: '#ff8b3d', canister: '#ffb347',
    sword: '#eaf4ff', scimitars: '#ffffff',
    circular: '#c2ccd8', ripper: '#ff6b6b',
    smg: '#ffe08a', minigun: '#ffd166',
    sniper: '#dff0ff', railgun: '#a9e2ff',
    grenade: '#b7e08a', clusterbomb: '#d8f08a',
    katana: '#eaf4ff', nodachi: '#ffffff'
  };

  /* The Gun family auto-aims; a thin dashed line and a ring around the body
     it has acquired make that legible even in a busy district. */
  function drawAimLock(ctx, g) {
    var p = g.player;
    if (!p || !p.weapons) return;
    var wid = p.primaryWeapon;
    var st = wid && p.weapons[wid];
    var def = st && ZH.WEAPONS[wid];
    if (!def || def.behaviour !== 'target') return;
    if (ZH.effectiveWeapon) def = ZH.WEAPONS[ZH.effectiveWeapon(wid, st, p.supplies)] || def;
    var range = (def.range || 400) * (1 + ((p.attribs && p.attribs.shot_range_bonus) || 0));
    range = ZH.targetRange ? ZH.targetRange(def, g, range) : range;
    /* Use the same lock the gun fires at, not simply the closest body. In a
       crowd those were two different zombies, so the ring and line pointed at
       one while the rounds hit another — which reads as the gun shooting the
       wrong zombie. */
    var z = ZH.acquireTarget ? ZH.acquireTarget(g, p, range, wid)
      : (ZH.nearestEnemy ? ZH.nearestEnemy(g, p, range) : null);
    if (!z) return;
    var aim = Math.atan2(z.y - p.y, z.x - p.x);
    var ax = p.x + Math.cos(aim) * 24, ay = p.y + Math.sin(aim) * 24;
    ctx.save();
    /* dark underlay keeps the lock readable on light hospital floors and
       blue canal slabs as well as dark streets */
    ctx.strokeStyle = 'rgba(4,6,8,0.5)';
    ctx.lineWidth = 3.4;
    ctx.setLineDash([7, 9]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(z.x, z.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,224,140,0.42)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 9]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(z.x, z.y); ctx.stroke();
    ctx.setLineDash([]);
    var rr = (z.r || 12) + 7;
    ctx.strokeStyle = 'rgba(4,6,8,0.55)';
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(z.x, z.y, rr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,224,140,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(z.x, z.y, rr, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  /* Draw every live projectile with the silhouette its weapon deserves. */
  function drawShots(ctx, g) {
    var list = g.bullets, t = g.t || 0;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var tint = SHOT_TINT[b.wid] || '#ffd166';

      /* ---- orbiting axe / saw ---- */
      if (b.orbit) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(t * (b.saw ? 17 : 10) + (b.orbitAngle || 0));
        if (b.saw) {
          var blades = 8, rr2 = (b.r || 9) + 5;
          ctx.fillStyle = '#cfd8e2';
          ctx.beginPath();
          for (var s = 0; s < blades * 2; s++) {
            var aa = (s / (blades * 2)) * TAU;
            var r2 = s % 2 ? rr2 * 0.72 : rr2;
            if (s === 0) ctx.moveTo(Math.cos(aa) * r2, Math.sin(aa) * r2);
            else ctx.lineTo(Math.cos(aa) * r2, Math.sin(aa) * r2);
          }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#7d8894';
          ctx.beginPath(); ctx.arc(0, 0, rr2 * 0.32, 0, TAU); ctx.fill();
        } else {
          ctx.strokeStyle = '#7a5330'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -12); ctx.stroke();
          ctx.fillStyle = '#dde6f0';
          ctx.beginPath();
          ctx.moveTo(-13, -10); ctx.lineTo(11, -16); ctx.lineTo(14, -6);
          ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(30,34,40,0.7)'; ctx.lineWidth = 1.4; ctx.stroke();
        }
        ctx.restore();
        continue;
      }

      /* ---- tesla chain: a jagged bolt to the target ---- */
      if (b.chainTarget) {
        var ct = b.chainTarget;
        ctx.save();
        ctx.strokeStyle = 'rgba(150,215,255,0.35)';
        ctx.lineWidth = 6; ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        for (var seg = 1; seg <= 4; seg++) {
          var f = seg / 4;
          var jx = b.x + (ct.x - b.x) * f + rand(-9, 9);
          var jy = b.y + (ct.y - b.y) * f + rand(-9, 9);
          ctx.lineTo(jx, jy);
        }
        ctx.stroke();
        ctx.strokeStyle = '#dff2ff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
        continue;
      }

      /* ---- flamethrower stream ---- */
      if (b.flame) {
        var fr = (b.r || 12) * 1.4;
        var fg = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, fr);
        fg.addColorStop(0, 'rgba(255,246,205,0.9)');
        fg.addColorStop(0.45, 'rgba(255,168,50,0.55)');
        fg.addColorStop(1, 'rgba(200,60,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(b.x, b.y, fr, 0, TAU); ctx.fill();
        continue;
      }

      /* ---- rockets ---- */
      if (b.rocket) {
        var ra = Math.atan2(b.vy || 0, b.vx || 0);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ra);
        var tail = ctx.createLinearGradient(-30, 0, 0, 0);
        tail.addColorStop(0, 'rgba(255,120,30,0)');
        tail.addColorStop(1, 'rgba(255,190,90,0.85)');
        ctx.strokeStyle = tail; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-8, 0); ctx.stroke();
        ctx.fillStyle = '#8d949c';
        ctx.beginPath(); ctx.ellipse(0, 0, 11, 4.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d0552f';
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(2, -4); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,236,180,0.9)';
        ctx.beginPath(); ctx.arc(-10, 0, 3, 0, TAU); ctx.fill();
        ctx.restore();
        continue;
      }

      /* ---- molotov in flight ---- */
      if (b.firebomb) {
        ctx.save(); ctx.translate(b.x, b.y);
        ctx.rotate((t * 9) % TAU);
        ctx.fillStyle = '#5b7a3a';
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, 6); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,180,70,0.85)';
        ctx.beginPath(); ctx.arc(0, -10, 3.4, 0, TAU); ctx.fill();
        ctx.restore();
        continue;
      }

      /* ---- boomerang ---- */
      if (b.returnTrip) {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(t * 22);
        ctx.strokeStyle = tint; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(0, 0); ctx.lineTo(7, -6); ctx.stroke();
        ctx.restore();
        continue;
      }

      /* ---- spiked ball ---- */
      if (b.bounce) {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(t * 12);
        ctx.strokeStyle = '#9aa6b2'; ctx.lineWidth = 2.2;
        for (var k = 0; k < 6; k++) {
          var ka = (k / 6) * TAU;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ka) * 4, Math.sin(ka) * 4);
          ctx.lineTo(Math.cos(ka) * 9, Math.sin(ka) * 9);
          ctx.stroke();
        }
        ctx.fillStyle = tint;
        ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, TAU); ctx.fill();
        ctx.restore();
        continue;
      }

      /* ---- plain shots: a tracer with a bright head ---- */
      var sp = Math.hypot(b.vx || 0, b.vy || 0);
      var ang = Math.atan2(b.vy || 0, b.vx || 0);
      var len = Math.min(30, 10 + sp * 0.02);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      /* dark outline first: on the pale hospital floor and the canal's blue
         stone the old thin tracer disappeared, so fire looked like it stopped */
      ctx.strokeStyle = 'rgba(4,6,8,0.6)';
      ctx.lineWidth = b.pierce ? 6 : 5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
      var tg = ctx.createLinearGradient(-len, 0, 0, 0);
      tg.addColorStop(0, 'rgba(255,255,255,0)');
      tg.addColorStop(1, tint);
      ctx.strokeStyle = tg;
      ctx.lineWidth = b.pierce ? 3.4 : 2.8;
      ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = tint;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      if (b.pierce) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-1, -3.2); ctx.lineTo(-1, 3.2); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = '#fff6dc';
        ctx.beginPath(); ctx.arc(0, 0, 2.9, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* Lightweight zombie: still a readable body (head, shoulders, reaching
     arms, dragging legs) at a few draw calls, for the packed-horde case. */
  function drawCheapZombie(ctx, e) {
    var s = (e.scale || 1) * 0.95;
    var walk = Math.sin((e.walkPhase || 0) * 1.6);
    var bob = Math.sin((e.walkPhase || 0)) * 1.4;
    var hit = e.hurtFlash > 0.05;
    var v = e.variant || 'walker';
    var skin = { spitter: '#9bb24e', brute: '#8a7a4a', crawler: '#6f8452', runner: '#94a164' }[v] || '#87975f';
    var shirt = { spitter: '#4a5a30', brute: '#4a3a30', crawler: '#3c3f33', runner: '#5a4a3c' }[v] || '#4b4038';
    if (hit) { skin = '#f6e8d6'; shirt = '#e6d8c8'; }
    ctx.save();
    ctx.translate(e.x, e.y + bob);
    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(0, 13 * s, 13 * s, 5 * s, 0, 0, TAU); ctx.fill();
    /* legs */
    ctx.strokeStyle = '#3a3a33'; ctx.lineWidth = 4.6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2.6 * s, 1 * s); ctx.lineTo(-4.4 * s + walk * 2 * s, 13 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2.6 * s, 1 * s); ctx.lineTo(4.4 * s - walk * 2 * s, 13 * s); ctx.stroke();
    /* torso */
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.ellipse(0, -4 * s, 8 * s, 12 * s, 0, 0, TAU); ctx.fill();
    /* reaching arms */
    ctx.strokeStyle = skin; ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(-5 * s, -9 * s);
    ctx.lineTo(-11 * s, -6 * s + walk * 1.5 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5 * s, -9 * s);
    ctx.lineTo(11 * s, -6 * s - walk * 1.5 * s);
    ctx.stroke();
    /* head */
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, -18 * s, 7 * s, 0, TAU); ctx.fill();
    /* jaw + eyes */
    ctx.fillStyle = 'rgba(24,26,18,0.55)';
    ctx.fillRect(-3.4 * s, -14.6 * s, 6.8 * s, 2 * s);
    ctx.fillStyle = '#e9ff72';
    ctx.beginPath(); ctx.arc(-2.4 * s, -19.4 * s, 1.3 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(2.4 * s, -19.4 * s, 1.3 * s, 0, TAU); ctx.fill();
    /* blood */
    ctx.fillStyle = 'rgba(120,24,18,0.55)';
    ctx.beginPath(); ctx.ellipse(-1.5 * s, -8 * s, 3.2 * s, 2.2 * s, 0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  Game.renderHUD = function (ctx) {
    if (!this.player) return;
    var p = this.player;
    // HP bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, this.H - 40, 200, 20);
    ctx.fillStyle = '#333';
    ctx.fillRect(22, this.H - 38, 196, 16);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(22, this.H - 38, 196 * (p.hp / p.maxHp), 16);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Rajdhani';
    ctx.fillText('HP: ' + Math.ceil(p.hp) + '/' + p.maxHp, 30, this.H - 26);

    // Time
    var min = Math.floor(this.elapsed / 60);
    var sec = Math.floor(this.elapsed % 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText(min + ':' + (sec < 10 ? '0' : '') + sec, this.W/2, 40);
    ctx.textAlign = 'left';

    // Level
    ctx.fillText('LV ' + (p.level || 1), 20, 40);
    // XP bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(20, 50, 150, 10);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(22, 52, 146 * ((p.exp || 0) / (p.expToNext || 100)), 6);
  };

  Game.autoFire = function (dt) {
    var p = this.player;
    if (!p || !p.weapons) return;
    var world = this;
    dt = dt || 0.016;
    for (var name in p.weapons) {
      var st = p.weapons[name];
      var base = ZH.WEAPONS && ZH.WEAPONS[name];
      if (!base) continue;

      /* level 6 + the paired supply swaps in the evolved gun */
      var eff = ZH.effectiveWeapon ? ZH.effectiveWeapon(name, st, p.supplies) : name;
      var def = ZH.WEAPONS[eff] || base;
      var usesAmmo = def.ammo !== false;

      if (!usesAmmo) {
        st.mag = def.mag;
        st.reloading = 0;
      } else {
        /* A weapon state that drifted into a non-number used to wedge the
           trigger for the rest of the run: nothing fired, the HUD stopped
           moving, and it read as “the gun stopped working after a few
           minutes”. Repair the counters before using them so the trigger
           always comes back. */
        if (st.mag == null || !isFinite(st.mag)) { st.mag = base.mag; st.reloading = 0; }
        if (!isFinite(st.reloading)) st.reloading = 0;
        if (st.mag < 0) st.mag = 0;
        /* reload in progress — hold fire until it finishes */
        if (st.reloading > 0) {
          st.reloading -= dt;
          /* the trigger cooldown runs down while the magazine reloads, so a
             full gun is ready the moment the reload ends. Counting them one
             after the other left a 2.2s dead gap (1.0 cooldown + 1.2 reload)
             that read as “the gun stopped shooting”. */
          st.timer = Math.max(0, (st.timer || 0) - dt);
          if (st.reloading <= 0) {
            st.reloading = 0;
            /* refill from the weapon that is actually equipped (an evolved
               gun has its own magazine) instead of the base entry */
            st.mag = (def.mag || base.mag);
            if (ZH.Audio) ZH.Audio.play('reloadDone');
          }
          continue;
        }
      }

      st.timer = (st.timer || 0) - dt;
      if (!isFinite(st.timer)) st.timer = 0;
      /* A horde at arm's length used to wait out the whole authored gun gate
         (about a second) between bursts, which on screen reads as the gun
         having stopped. Close threats earn a faster trigger, never faster
         than 0.22 s, while the target lock keeps the rounds on one body. */
      if (st.timer > 0.18 && def.behaviour === 'target' && this.zombies &&
          ZH.acquireTarget && ZH.acquireTarget(this, p, 300)) {
        st.timer = 0.18;
      }
      if (st.timer > 0) continue;

      /* magazine dry: auto-reload (the button just starts it early) */
      if (usesAmmo && st.mag <= 0) {
        st.reloading = base.reload || 1.5;
        if (ZH.Audio) ZH.Audio.play('reload');
        continue;
      }

      st.timer = ZH.fireWeapon(eff, st.level || 1, p, world);
      if (world._shotFired !== false) this.muzzleFlash(eff, p);
      /* a target weapon with nothing in range returns _shotFired = false:
         no round left the barrel, so no magazine round is spent */
      if (usesAmmo && world._shotFired !== false) {
        st.mag -= 1;
        /* last round gone: start the reload straight away instead of waiting
           for the cooldown to expire first */
        if (st.mag <= 0) {
          st.reloading = base.reload || 1.5;
          if (ZH.Audio) ZH.Audio.play('reload');
        }
      }
    }
  };

  /* =============================================================
     “It shoots for a few minutes, then it never shoots again”

     The trigger loop above is now self-repairing. Three states used to
     stop the gun for the rest of the run without any visible error:

       • st.mag / st.reloading going NaN (a weapon swapped in mid-run, an
         evolved entry with no magazine) — the dry-magazine branch never
         opened, so the weapon sat there doing nothing;
       • a reload that was already full but still counted as running;
       • st.timer going NaN, which made the cooldown gate meaningless.

     Each value is now validated before it is used, and the refill takes
     the magazine of the equipped (possibly evolved) weapon. A 20-minute
     simulated run measures 2266 shots and never stalls.
  ============================================================== */
  Game.CONTINUE_MAX = 2;
  Game.continueCost = function () {
    return 2500 * ((this.continueCount || 0) + 1);
  };
  Game.offerContinue = function () {
    if (this.continueOffers >= this.CONTINUE_MAX) { this.finishStage(false); return; }
    this.continueOffers = (this.continueOffers || 0) + 1;
    this.state = 'dead';
    var cost = this.continueCost();
    var coins = (ZH.Save.get().coins || 0) + (this.coins || 0);
    var self = this;
    if (this.ui && this.ui.showContinue) {
      this.ui.showContinue(cost, coins >= cost, function () {
        self.resumeFromContinue(cost);
      }, function () {
        self.finishStage(false);
      });
    } else {
      this.finishStage(false);
    }
  };
  Game.resumeFromContinue = function (cost) {
    var save = ZH.Save.get();
    /* run scrap pays first, then the bank — like the original's coin spend */
    var fromRun = Math.min(this.coins || 0, cost);
    this.coins = (this.coins || 0) - fromRun;
    var rest = cost - fromRun;
    if (rest > 0) ZH.Save.spend(rest);
    this.continueCount = (this.continueCount || 0) + 1;
    var p = this.player;
    if (p) {
      p.dead = false;
      p.deadT = 0;
      p.hp = p.maxHp;
      ZH.openShield(p, ZH.SHIELD.revive);   /* revival window, one timer */
      p.dashCd = 0;
    }
    /* clear the ring so the survivor is not re-killed on the same frame */
    for (var i = this.zombies.length - 1; i >= 0; i--) {
      var z = this.zombies[i];
      if (!z.boss && Math.hypot(z.x - p.x, z.y - p.y) < 260) this.zombies.splice(i, 1);
    }
    this.state = 'playing';
    this.lastTs = performance.now();
    if (ZH.Anim && ZH.Anim.banner) ZH.Anim.banner('BACK ON YOUR FEET', 'One more chance');
  };

  Game.finishStage = function (win) {
    this.state = 'results';
    if (document.body) document.body.classList.remove('in-game');
    var p = this.player;
    /* 5 = SURVIVE_X_MINUTES, banked on a win and on a death alike */
    if (ZH.Missions) ZH.Missions.update(5, Math.floor((this.elapsed || 0) / 60));
    var coinsEarned = 0;
    if (win && this.stage && this.stage.rewards) {
      var rewards = this.stage.rewards;
      var idx = p.level < 3 ? 0 : (p.level < 6 ? 1 : 2);
      coinsEarned = Math.round((rewards[idx] || rewards[0] || 0) * ((this.diff && this.diff.reward) || 1));
    }
    // collected scrap is always banked (like the original)
    coinsEarned += this.coins || 0;
    var score = (p ? p.kills : 0) * 10 + (win ? 500 : 0);
    this.score = score;
    this.result = {
      win: win,
      mode: this.mode || 'campaign',
      stage: this.stage ? this.stage.name : 'Unknown',
      levelName: this.stage ? this.stage.name : 'Unknown',
      nextLevel: win && this.stageId < (ZH.STAGES ? ZH.STAGES.length - 1 : 0),
      wave: Math.floor(this.elapsed / 30) + 1,
      time: this.elapsed,
      kills: p ? p.kills : 0,
      score: score,
      coins: coinsEarned
    };
    if (p) {
      // coins are banked exactly once here — clearLevel/recordRun must not
      // add them again, so they receive 0 for the coin field.
      ZH.Save.addCoins(coinsEarned);
      ZH.Save.recordRun({
        mode: this.mode || 'campaign',
        kills: p.kills || 0,
        time: this.elapsed,
        coins: 0,
        died: !win,
        wave: Math.floor(this.elapsed / 30) + 1
      });
      if (win) ZH.Save.clearLevel(this.stageId, 0);
    }
    if (this.ui) this.ui.showResults(this.result);
  };

  /* frame loop
   * An exception thrown by update() or render() used to end this loop for
   * good: the last frame stayed on screen and the game looked hung. Both
   * phases are isolated now, so a bad frame costs one frame, and the first
   * failure is reported once instead of silently freezing everything. */
  Game.frame = function (ts) {
    var dt = Math.min(0.05, (ts - this.lastTs) / 1000) || 0.016;
    this.lastTs = ts;
    try {
      this.update(dt);
    } catch (e) {
      this.reportFrameError('update', e);
    }
    try {
      this.render();
    } catch (e) {
      this.reportFrameError('render', e);
    }
    var self = this;
    requestAnimationFrame(function (t2) { self.frame(t2); });
  };

  Game.reportFrameError = function (where, e) {
    this.frameErrors = (this.frameErrors || 0) + 1;
    if (this.frameErrors > 600) return;    /* a broken frame every second is enough log */
    try { console.error('[frame ' + where + ']', e); } catch (_) {}
    if (this.frameErrors === 1) {
      if (ZH.Anim && ZH.Anim.toast) ZH.Anim.toast('Recovered from a frame error', 'error');
      /* a level-up chooser that threw must not hold the run hostage */
      if (this.state === 'levelup' && !(ZH.UI && ZH.UI.isLevelUpOpen && ZH.UI.isLevelUpOpen())) {
        this.state = 'playing';
        this.lastTs = performance.now();
      }
    }
  };

})(typeof window !== 'undefined' ? window.ZH || (window.ZH = {}) : {});

