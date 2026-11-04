/*
 * Zombie Hunter: Survival — Vampire Survivors style engine
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
    input: { joyX: 0, joyY: 0 },
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
    this.dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    this.W = c.clientWidth || window.innerWidth;
    this.H = c.clientHeight || window.innerHeight;
    c.width = Math.round(this.W * this.dpr);
    c.height = Math.round(this.H * this.dpr);
    this.quality = this.W * this.H > 1400 * 900 ? 1 : 0.9;
  };

  /* -------------------------------- stage -------------------------------- */
  Game.startStage = function (stageId, primaryWeapon) {
    var stage = ZH.STAGES[stageId] || ZH.STAGES[0];
    if (!stage) return;
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
      if (rw.__origStart == null) rw.__origStart = rw.startTime;
      rw.startTime = rw.__origStart;
    }
    this.arena = ZH.Arena.get(stage.tile || 'street', (stageId || 0) * 123);
    this.resetSimulation();
    var save = ZH.Save.get();
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
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.camera.zoom = 0.8;
    this.state = 'playing';
    if (document.body) document.body.classList.add('in-game');
    ZH.Audio.unlock();
    if (this.ui) { this.ui.hideScreens && this.ui.hideScreens(); this.ui.resetHud && this.ui.resetHud(); }
    this.levelUpPending = false;
    this.bossZoneActive = false;
    this.waveCycle = 0;
    this.elapsed = 0;
    this.coins = 0; this.score = 0; this.exp = 0;
    this.treasureSpawned = false;
    this.expToNext = 1000;
    if (window.ZH && ZH.Anim) ZH.Anim.banner(stage.name, 'SURVIVE 20 MINUTES');
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
  Game.updateWaves = function (dt) {
    if (!this.stage || this.bossZoneActive) return;
    var t = this.elapsed; // stage data uses SECONDS for startTime/duration

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
          if (!capped && this.waveAliveNear(wave.enemy, 900) < (wave.max || 20)) {
            wave.spawned = (wave.spawned || 0) + 1;
            this.spawnWaveEnemies(wave);
          }
        }
        if (wave.waveT >= wave.duration) {
          wave.active = false;
        }
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
          var interval = wave.freq === 'HI' ? 0.1 : wave.freq === 'MID' ? 0.35 : 0.7;
          wave.interval = interval / (this.difficultyMul || 1);
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

  /* how many live enemies of this type are close enough to matter */
  Game.waveAliveNear = function (type, radius) {
    var p = this.player;
    var n = 0, r2 = (radius || 900) * (radius || 900);
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.dead || z.type !== type) continue;
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
    if (this.zombies.length > 320) return;
    /* spawn just past the edge of the view, like the original — spawning at a
       fixed 600 px left the screen empty whenever the hunter moved */
    var half = Math.max(this.W, this.H) / (2 * (this.camera.zoom || 1));
    var p = this.player;
    var bias = null;
    if (p && Math.hypot(p.moveX || 0, p.moveY || 0) > 0.2) bias = Math.atan2(p.moveY, p.moveX);
    var pos = this.findSpawnPoint(Math.max(320, half * 0.85), bias);
    // enemy HP scales with the stage multiplier, exactly like the original
    var mult = (this.stage && this.stage.multiplier) || 1;
    var z = ZH.createEnemy(wave.enemy, pos.x, pos.y, mult);
    if (z) this.zombies.push(z);
  };

  Game.activateBossZone = function (wave) {
    this.bossZoneActive = true;
    this.bossZoneT = 0;
    ZH.Anim.banner('BOSS APPROACHING', 'Get ready!');
    var bosses = wave.bosses || [];
    for (var i = 0; i < bosses.length; i++) {
      var pos = this.findSpawnPoint(800);
      var b = ZH.createBoss(bosses[i].type, pos.x, pos.y);
      if (b) this.zombies.push(b);
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

    /* pressing anywhere else on the left half plants the base under the thumb */
    var layer = document.getElementById('app') || document.body;
    layer.addEventListener('pointerdown', function (e) {
      if (pid !== null) return;
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
  };

  Game.applyInput = function () {
    var p = this.player;
    if (!p) return;
    var mx = this.input.joyX || 0;
    var my = this.input.joyY || 0;

    var len = Math.hypot(mx, my);
    if (len > 1) { var i = 1 / len; mx *= i; my *= i; }

    p.moveX = mx; p.moveY = my;

    // Move direction IS the aim direction (original model)
    if (len > 0.01) {
      p.aimDir = Math.atan2(my, mx);
      p.facing = mx >= 0 ? 1 : -1;
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
    p.invuln = Math.max(p.invuln || 0, 0.35);
    if (ZH.Audio) ZH.Audio.play('dash');
    return true;
  };

  /* top up every magazine that is not already full or loading */
  Game.reload = function () {
    var p = this.player;
    if (!p || !p.weapons || p.dead || this.state !== 'playing') return false;
    var started = false;
    for (var name in p.weapons) {
      var w = p.weapons[name];
      var def = ZH.WEAPONS && ZH.WEAPONS[name];
      if (!def) continue;
      if (def.ammo === false) continue;          /* melee / orbit guns never reload */
      if (w.mag == null) { w.mag = def.mag; w.reloading = 0; }
      if (w.reloading > 0 || w.mag >= def.mag) continue;
      w.reloading = def.reload || 1.5;
      started = true;
    }
    if (started && ZH.Audio) ZH.Audio.play('reload');
    return started;
  };

  Game.pause = function () {
    if (this.state !== 'playing') return;
    this.state = 'paused';
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
    /* self-heal: a 'levelup' state with no chooser on screen is a dead end. */
    if (this.state === 'levelup' && !document.getElementById('levelup-overlay')) {
      this.state = 'playing';
    }
    if (this.state !== 'playing') return;
    this.t += dt;
    /* a live boss zone freezes the level clock (original behaviour) */
    if (!this.bossZoneActive) this.elapsed += dt;

    var p = this.player;
    this.applyInput();

    // combat roll: hold the locked dash vector while it lasts
    if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashVX * p.speed * 3.4 * dt;
      p.y += p.dashVY * p.speed * 3.4 * dt;
      p.walkPhase += dt * 14;
      if (p.dashT <= 0) p.invuln = Math.max(p.invuln, 0.12);
    }

    if (ZH.updateSurvivor) ZH.updateSurvivor(p, dt, this);
    if (ZH.updateEnemies) ZH.updateEnemies(this.zombies, dt, this);
    if (ZH.updateProjectiles) ZH.updateProjectiles(this.bullets, dt, this);
    if (ZH.updateProjectiles) ZH.updateProjectiles(this.enemyBullets, dt, this);
    if (ZH.updatePickups) ZH.updatePickups(this.pickups, dt, this);

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

    this.updateCamera(dt);
    this.pushHud();

    // check win (TIME_LEVEL_COMPLETED = 1,200,000 ms)
    if (this.elapsed >= (ZH.TIME_LEVEL_COMPLETED || 1200) && !this.bossZoneActive) {
      this.finishStage(true);
      return;
    }

    if (p.hp <= 0 && p.dead) {
      p.deadT += dt;
      if (p.deadT > 2) this.finishStage(false);
      return;
    }

    // level-up XP gate: expsToLevel = floor(1000 * 1.25^(level-1))
    var guard = 0;
    while (p.exp != null && p.exp >= this.expNeeded(p.level || 1) && guard++ < 5) {
      var need = this.expNeeded(p.level || 1);
      p.exp -= need;
      p.level = (p.level || 1) + 1;
      p.invuln = 1.2;
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
  Game.frame = function (ts) {
    var dt = Math.min(0.05, (ts - this.lastTs) / 1000) || 0.016;
    this.lastTs = ts;
    this.update(dt);
    this.render();
    var self = this;
    requestAnimationFrame(function (t2) { self.frame(t2); });
  };

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
        ZH.Rig.draw(ctx, {
          x: e.x, y: e.y, s: 1.15, kind: 'hunter', variant: 'hunter',
          facing: e.facing, aim: e.aimDir || 0, weapon: e.primaryWeapon,
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

    // particles
    for (var pi = 0; pi < this.particles.length; pi++) {
      var p2 = this.particles[pi];
      ctx.globalAlpha = p2.life / p2.max;
      ctx.fillStyle = p2.color;
      ctx.beginPath(); ctx.arc(p2.x, p2.y, p2.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // HUD lives in the DOM (ui.updateHud); no canvas duplicate
  };

  /* tints per weapon family: a shotgun blast should not look like a laser */
  var SHOT_TINT = {
    gun: '#ffd166', uzi: '#ffdf8a',
    crossbow: '#d8ecff', shotgun: '#eaf6ff',
    drill: '#7fe1ff', lasergun: '#b9f0ff',
    tesla: '#9ad4ff', thunderorb: '#c9b3ff',
    bazooka: '#ff9a5c', nuke: '#ff7a3d',
    launcher: '#ff8a5c', airstrike: '#ffc46b',
    flamer: '#ffb066', plasmagun: '#8ef2d0',
    boomerang: '#f6c45a', neckbreaker: '#ffe08a',
    spikedball: '#cfd8e2', biliard: '#e6eef8',
    molotov: '#ff8b3d', canister: '#ffb347',
    sword: '#eaf4ff', scimitars: '#ffffff',
    circular: '#c2ccd8', ripper: '#ff6b6b'
  };

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
      var tg = ctx.createLinearGradient(-len, 0, 0, 0);
      tg.addColorStop(0, 'rgba(255,255,255,0)');
      tg.addColorStop(1, tint);
      ctx.strokeStyle = tg;
      ctx.lineWidth = b.pierce ? 2.8 : 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = tint;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
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
        if (st.mag == null) { st.mag = base.mag; st.reloading = 0; }
        /* reload in progress — hold fire until it finishes */
        if (st.reloading > 0) {
          st.reloading -= dt;
          if (st.reloading <= 0) {
            st.reloading = 0;
            st.mag = base.mag;
            if (ZH.Audio) ZH.Audio.play('reloadDone');
          }
          continue;
        }
      }

      st.timer = (st.timer || 0) - dt;
      if (st.timer > 0) continue;

      /* magazine dry: auto-reload (the button just starts it early) */
      if (usesAmmo && st.mag <= 0) {
        st.reloading = base.reload || 1.5;
        if (ZH.Audio) ZH.Audio.play('reload');
        continue;
      }

      st.timer = ZH.fireWeapon(eff, st.level || 1, p, world);
      if (usesAmmo) st.mag -= 1;
    }
  };

  Game.finishStage = function (win) {
    this.state = 'results';
    if (document.body) document.body.classList.remove('in-game');
    var p = this.player;
    var coinsEarned = 0;
    if (win && this.stage && this.stage.rewards) {
      var rewards = this.stage.rewards;
      var idx = p.level < 3 ? 0 : (p.level < 6 ? 1 : 2);
      coinsEarned = rewards[idx] || rewards[0] || 0;
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

  /* frame loop */
  Game.frame = function (ts) {
    var dt = Math.min(0.05, (ts - this.lastTs) / 1000) || 0.016;
    this.lastTs = ts;
    this.update(dt);
    this.render();
    var self = this;
    requestAnimationFrame(function (t2) { self.frame(t2); });
  };

})(typeof window !== 'undefined' ? window.ZH || (window.ZH = {}) : {});

