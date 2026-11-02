/*
 * Zombie Hunter: Survival — entity definitions + simulation
 *
 * Enemy catalogue is taken from the GameSnacks zombie-hunter build we
 * extracted earlier (https://gamesnacks.com/games/6ctmcm40nbff0).
 * The four placeholder zombies (zombieA..D) are gone; every campaign
 * wave now spawns real types: walker, runner, spitter, brute, crawler.
 */
(function (global) {
  'use strict';
  var ZH = global.ZH = global.ZH || {};
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  var ENEMY_TYPES = {
    walker:  { hp: 10,  speed: 78,  dmg: 5,  range: 24, cd: 1.05, r: 12, coins: 5,  scale: 1.00 },
    runner:  { hp: 8,   speed: 135, dmg: 4,  range: 22, cd: 0.95, r: 10, coins: 4,  scale: 0.94 },
    spitter: { hp: 9,   speed: 62,  dmg: 6,  range: 28, cd: 1.0,  r: 11, coins: 6,  scale: 1.04 },
    brute:   { hp: 38,  speed: 55,  dmg: 12, range: 26, cd: 1.15, r: 16, coins: 18, scale: 1.34 },
    crawler: { hp: 7,   speed: 38,  dmg: 3,  range: 18, cd: 1.1,  r: 9,  coins: 3,  scale: 0.86 },
    walkerF: { hp: 11,  speed: 82,  dmg: 5,  range: 24, cd: 1.05, r: 12, coins: 5,  scale: 1.00 }
  };

  // bosses extracted from the original campaign (rott + the chapter bosses)
  var BOSS_TYPES = {
    rott:    { hp: 620,  speed: 78,  dmg: 14, range: 30, cd: 0.9,  r: 22, coins: 240, scale: 1.75, variant: 'rott' },
    matron:  { hp: 980,  speed: 62,  dmg: 18, range: 34, cd: 1.0,  r: 24, coins: 360, scale: 1.68, variant: 'matron' },
    butcher: { hp: 1280, speed: 52,  dmg: 22, range: 30, cd: 1.0,  r: 26, coins: 420, scale: 1.80, variant: 'butcher' },
    warden:  { hp: 1520, speed: 70,  dmg: 24, range: 36, cd: 0.9,  r: 28, coins: 520, scale: 1.95, variant: 'warden' }
  };

  function createSurvivor(opts) {
    opts = opts || {};
    var s = {
      x: opts.x || 0, y: opts.y || 0,
      vx: 0, vy: 0, r: 12,
      hp: 100, maxHp: 100,
      speed: 200,
      moveX: 0, moveY: 0,
      aimDir: -Math.PI/2,
      facing: 1,
      walkPhase: 0,
      weapons: {},
      supplies: {},
      level: 1,
      exp: 0,
      expToNext: 100,
      kills: 0,
      dead: false,
      deadT: 0,
      invuln: 0,
      dashT: 0, dashCd: 0, dashMax: 2.2, dashVX: 0, dashVY: 0,
      fireRate: 0.18
    };
    // the survivor always starts with a real weapon id from the catalog
    var wid = opts.weapon;
    if (!wid || !ZH.WEAPONS || !ZH.WEAPONS[wid]) wid = 'pistol';
    s.weapon = wid;
    s.primaryWeapon = wid;
    var base = ZH.WEAPONS[wid];
    s.weapons[wid] = { level: 1, class: wid, timer: 0, mag: base.mag, reloading: 0 };
    return s;
  }

  function createEnemy(type, x, y, difficulty) {
    difficulty = difficulty || 1;
    var def = ENEMY_TYPES[type] || ENEMY_TYPES.walker;
    var hp = def.hp + difficulty * 3;
    return {
      x: x, y: y, r: def.r,
      hp: hp, maxHp: hp,
      speed: def.speed * (1 + difficulty * 0.08),
      dmg: def.dmg + difficulty * 1.2,
      range: def.range,
      cd: def.cd,
      cdT: Math.random() * def.cd,
      type: type,
      variant: type,
      coins: def.coins,
      scale: def.scale || 1,
      facing: 1,
      walkPhase: Math.random() * Math.PI * 2,
      hurtFlash: 0,
      dead: false,
      removeT: 0.5,
      ranged: false,
      stationary: false,
      seed: Math.random() * 100
    };
  }

  function createBoss(type, x, y) {
    var def = BOSS_TYPES[type];
    if (!def) def = BOSS_TYPES.rott;
    return {
      x: x, y: y, r: def.r,
      hp: def.hp, maxHp: def.hp,
      speed: def.speed,
      dmg: def.dmg,
      cd: def.cd, cdT: Math.random() * def.cd,
      type: type,
      variant: def.variant || type,
      coins: def.coins,
      scale: def.scale,
      facing: 1,
      walkPhase: 0,
      hurtFlash: 0,
      dead: false,
      removeT: 1.0,
      boss: true,
      ranged: false,
      seed: Math.random() * 100
    };
  }

  function updateSurvivor(p, dt, world) {
    if (p.dead) {
      p.deadT += dt;
      return;
    }

    // movement
    var mx = p.moveX, my = p.moveY;
    var len = Math.hypot(mx, my);
    if (len > 0.01) {
      p.x += mx * p.speed * dt;
      p.y += my * p.speed * dt;
      p.walkPhase += dt * 8;
    }
    // clamp to arena
    if (world.arena) {
      p.x = clamp(p.x, 80, world.arena.w - 80);
      p.y = clamp(p.y, 80, world.arena.h - 80);
    }

    // (weapon firing is driven by Game.autoFire in the main update loop)

    p.invuln = Math.max(0, p.invuln - dt);
  }

  /**
   * Fire the named weapon from the player, using the same behaviour the
   * real game uses (projectile speed, splash, count, spread). When no
   * explicit behaviour is defined for a weapon we fall back to a generic
   * projectile aimed along the player's actual aim direction.
   */
  /**
   * Aim at the nearest live enemy inside range, else fall back to the
   * survivor's facing. This mirrors the original catalog's Gun, Drill,
   * Boomerang and Bazooka, which all target the closest enemy.
   */
  function aimAt(world, p, range) {
    var best = (range || 600);
    var bestD = best * best;
    var tgt = null;
    var anyD = Infinity;
    var any = null;
    for (var i = 0; i < world.zombies.length; i++) {
      var z = world.zombies[i];
      if (z.dead) continue;
      var dx = z.x - p.x, dy = z.y - p.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < anyD) { anyD = d2; any = z; }
      if (d2 <= bestD) { bestD = d2; tgt = z; }
    }
    // in-range target wins; otherwise shoot at the closest threat anyway
    // (firing blind into empty ground wastes the whole magazine — and
    //  would leave a boss zone permanently latched).
    var final = tgt || any;
    if (final) return Math.atan2(final.y - p.y, final.x - p.x);
    return p.aimDir || 0;
  }

  function fireWeapon(name, level, p, world) {
    var WEAPONS = ZH.WEAPONS && ZH.WEAPONS[name] ? ZH.WEAPONS[name] : null;

    // exotic / non-projectile behaviours modelled on the original catalog
    if (name === 'tesla') {
      // zap the nearest enemies in a chain every cycle
      if (world.zombies.length) {
        var nearest = null, best = 9999;
        for (var i = 0; i < world.zombies.length; i++) {
          var z = world.zombies[i];
          if (z.dead) continue;
          var d = Math.hypot(z.x - p.x, z.y - p.y);
          if (d < best) { best = d; nearest = z; }
        }
        if (nearest) {
          world.bullets.push({
            x: p.x, y: p.y, vx: 0, vy: 0, dmg: 6, life: 0.5, r: 10,
            splash: 120, enemy: false, teslaTarget: nearest
          });
        }
      }
      return 0.18;
    }
    if (name === 'forcefield') {
      world.bullets.push({
        x: p.x, y: p.y, vx: 0, vy: 0, dmg: 0, life: 2.0, r: 120,
        splash: 120, enemy: false, shield: true
      });
      return 1.4;
    }
    if (name === 'chainsaw') {
      // melee: damage anything within reach, no projectile
      for (var k = 0; k < world.zombies.length; k++) {
        var z2 = world.zombies[k];
        if (z2.dead) continue;
        if (Math.hypot(z2.x - p.x, z2.y - p.y) < 95) {
          z2.hp -= 16;
          z2.hurtFlash = 0.2;
          if (z2.hp <= 0) {
            z2.dead = true;
            world.player.kills++;
            world.score += 10;
            world.pickups.push({ type: Math.random() < 0.7 ? 'exp' : 'coin', x: z2.x, y: z2.y, life: 10 });
          }
        }
      }
      return 0.32;
    }
    if (name === 'boomerang') {
      var a = aimAt(world, p, 700);
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
        dmg: 18, life: 2.6, r: 6, splash: 14, enemy: false, returnTrip: true
      });
      return 1.2;
    }
    if (name === 'grenade') {
      var ga = aimAt(world, p, 380);
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(ga) * 220, vy: Math.sin(ga) * 220,
        dmg: 0, life: 1.4, r: 8, splash: 130, enemy: false, grenade: true
      });
      return 1.6;
    }
    if (name === 'rocket') {
      var ra = aimAt(world, p, 700);
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(ra) * 360, vy: Math.sin(ra) * 360,
        dmg: 58, life: 2.4, r: 7, splash: 80, enemy: false
      });
      return 1.4;
    }
    if (name === 'nuke') {
      world.bullets.push({
        x: p.x, y: p.y, vx: 0, vy: 0, dmg: 1, life: 0.2, r: 520,
        splash: 520, enemy: false, nuke: true
      });
      return 8.0;
    }
    if (name === 'laser') {
      var la = aimAt(world, p, 600);
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(la) * 1400, vy: Math.sin(la) * 1400,
        dmg: 8, life: 0.5, r: 3, splash: 4, enemy: false, laser: true
      });
      return 0.05;
    }
    if (name === 'minigun') {
      var ma = aimAt(world, p, 340);
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(ma) * 600, vy: Math.sin(ma) * 600,
        dmg: 5, life: 2.0, r: 3, splash: 6, enemy: false
      });
      return 0.045;
    }
    if (name === 'gatling') {
      var ga2 = aimAt(world, p, 300);
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(ga2) * 580, vy: Math.sin(ga2) * 580,
        dmg: 4, life: 1.8, r: 3, splash: 5, enemy: false
      });
      return 0.035;
    }
    if (name === 'flare') {
      var fa = aimAt(world, p, 520);
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(fa) * 260, vy: Math.sin(fa) * 260,
        dmg: 0, life: 1.2, r: 6, splash: 100, enemy: false, flare: true
      });
      return 1.8;
    }
    if (name === 'railgun') {
      var rng = aimAt(world, p, 980);
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(rng) * 1100, vy: Math.sin(rng) * 1100,
        dmg: 110, life: 2.8, r: 4, splash: 14, enemy: false
      });
      return 2.0;
    }
    if (name === 'revolver') {
      var rev = aimAt(world, p, 520);
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(rev) * 780, vy: Math.sin(rev) * 780,
        dmg: 36, life: 2.0, r: 4, splash: 10, enemy: false
      });
      return 0.5;
    }
    if (name === 'duo') {
      var d1 = aimAt(world, p, 360);
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(d1) * 740, vy: Math.sin(d1) * 740,
        dmg: 7, life: 2.0, r: 3, splash: 6, enemy: false
      });
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(d1 + 0.18) * 740, vy: Math.sin(d1 + 0.18) * 740,
        dmg: 7, life: 2.0, r: 3, splash: 6, enemy: false
      });
      return 0.11;
    }

    // generic projectile for every normal gun + anything unhandled
    if (!WEAPONS) {
      // last-resort: a basic bullet aimed at the actual aim direction
      var a = p.aimDir || 0;
      world.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
        dmg: 10 + (level || 1) * 3, life: 1.6, r: 3, splash: 0, enemy: false
      });
      return 0.4;
    }

    var base = WEAPONS;
    var rate = base.fireRate || 0.5;
    var dmg = base.damage || 10;
    var speed = base.bulletSpeed || 600;
    var count = (base.count || 1) + (level > 6 ? 1 : 0);
    var spread = base.recoil ? 0.08 + base.recoil * 0.18 : 0.06;
    var splash = base.splash || 0;
    var a = p.aimDir || 0;

    // Gun-like weapons auto-target the nearest enemy, exactly like the
    // original catalog's Gun / Drill / Boomerang / Bazooka do. Weapons
    // that are "aimed" by walking (shotgun, flamer, laser) keep the
    // movement direction.
    var AUTO_AIM = {
      pistol: 1, smg: 1, rifle: 1, sniper: 1, revolver: 1,
      minigun: 1, gatling: 1, railgun: 1, duo: 1, rocket: 1
    };
    if (AUTO_AIM[name]) {
      a = aimAt(world, p, base.range || 600);
    }

    for (var j = 0; j < count; j++) {
      var ang = a + (j - (count - 1) / 2) * spread;
      world.bullets.push({
        x: p.x, y: p.y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        dmg: dmg,
        life: 2.0,
        r: 3,
        splash: splash,
        enemy: false
      });
    }
    return rate;
  }

  function updateEnemies(list, dt, world) {
    var p = world.player;
    for (var i = list.length - 1; i >= 0; i--) {
      var z = list[i];
      if (z.dead) {
        z.removeT -= dt;
        continue;
      }
      if (z.spawnT > 0) {
        z.spawnT -= dt;
        continue;
      }

      z.hurtFlash = Math.max(0, z.hurtFlash - dt * 5);
      z.walkPhase += dt * 4;

      var dx = p.x - z.x;
      var dy = p.y - z.y;
      var dist = Math.hypot(dx, dy) || 1;

      if (!z.stationary && dist > 10) {
        z.x += (dx / dist) * z.speed * dt;
        z.y += (dy / dist) * z.speed * dt;
        z.facing = dx >= 0 ? 1 : -1;
      }

      // attack
      if (dist < (z.range || 30)) {
        z.cdT -= dt;
        if (z.cdT <= 0) {
          z.cdT = z.cd;
          if (!p.invuln) {
            var dmg = z.dmg * (1 - (p.armor || 0));
            p.hp -= dmg;
            p.invuln = 0.3;
            if (p.hp <= 0) p.dead = true;
            world.shake = 5;
          }
        }
      }

      // clamp
      if (world.arena) {
        z.x = clamp(z.x, 60, world.arena.w - 60);
        z.y = clamp(z.y, 60, world.arena.h - 60);
      }
    }
  }

  function updateProjectiles(list, dt, world) {
    for (var i = list.length - 1; i >= 0; i--) {
      var b = list[i];
      b.life -= dt;
      if (b.life <= 0) { list.splice(i, 1); continue; }

      // tesla: keep the bolt riding its target and zap a new one each frame
      if (b.teslaTarget) {
        var dz = b.teslaTarget.x - b.x, dzy = b.teslaTarget.y - b.y;
        var dt2 = Math.hypot(dz, dzy) || 1;
        b.x += (dz / dt2) * 600 * dt;
        b.y += (dzy / dt2) * 600 * dt;
        b.life = 0.5;
        for (var j = 0; j < world.zombies.length; j++) {
          var z = world.zombies[j];
          if (z.dead) continue;
          if (Math.hypot(b.x - z.x, b.y - z.y) < z.r + 10) {
            z.hp -= 6;
            z.hurtFlash = 0.2;
            if (z.hp <= 0) {
              z.dead = true;
              world.player.kills++;
              world.score += 10;
              world.pickups.push({ type: Math.random() < 0.7 ? 'exp' : 'coin', x: z.x, y: z.y, life: 10 });
            }
          }
        }
        if (b.life <= 0) list.splice(i, 1);
        continue;
      }

      // shield: bloomed circle, no travel
      if (b.shield) {
        for (var sh = 0; sh < world.zombies.length; sh++) {
          var zs = world.zombies[sh];
          if (zs.dead) continue;
          if (Math.hypot(b.x - zs.x, b.y - zs.y) < b.splash) {
            // push them back without killing
            zs.x += (zs.x - b.x) * dt * 90;
            zs.y += (zs.y - b.y) * dt * 90;
          }
        }
        if (b.life <= 0) list.splice(i, 1);
        continue;
      }

      // normal movement — keep the previous position so collision can be
      // swept (fast bullets travel ~26px per frame, far more than the
      // 13px hit radius, so point tests tunnel straight through them)
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // grenade: arc a little then detonate
      if (b.grenade) {
        b.vy += 120 * dt;
        if (b.life <= 0.4) {
          for (var g = 0; g < world.zombies.length; g++) {
            var zg = world.zombies[g];
            if (zg.dead) continue;
            if (Math.hypot(b.x - zg.x, b.y - zg.y) < b.splash) {
              zg.hp -= 30;
              zg.hurtFlash = 0.3;
              if (zg.hp <= 0) {
                zg.dead = true;
                world.player.kills++;
                world.score += 10;
                world.pickups.push({ type: Math.random() < 0.7 ? 'exp' : 'coin', x: zg.x, y: zg.y, life: 10 });
              }
            }
          }
          list.splice(i, 1);
        }
        continue;
      }

      // flare: travels then blooms
      if (b.flare) {
        if (b.life <= 0.4) {
          for (var fl = 0; fl < world.zombies.length; fl++) {
            var zf = world.zombies[fl];
            if (zf.dead) continue;
            if (Math.hypot(b.x - zf.x, b.y - zf.y) < b.splash) {
              zf.hp -= 28;
              zf.hurtFlash = 0.3;
              if (zf.hp <= 0) {
                zf.dead = true;
                world.player.kills++;
                world.score += 10;
                world.pickups.push({ type: Math.random() < 0.7 ? 'exp' : 'coin', x: zf.x, y: zf.y, life: 10 });
              }
            }
          }
          list.splice(i, 1);
        }
        continue;
      }

      // boomerang return
      if (b.returnTrip) {
        if (b.life <= 1.3) {
          var back = { x: p.x - b.x, y: p.y - b.y };
          var bm = Math.hypot(back.x, back.y) || 1;
          b.vx = (back.x / bm) * 560;
          b.vy = (back.y / bm) * 560;
        }
      }

      // hit enemies (swept: distance from the zombie to the bullet's
      // travel segment this frame, not just to its endpoint)
      if (!b.enemy) {
        var hit = false;
        var segX = (b.px != null ? b.px : b.x);
        var segY = (b.py != null ? b.py : b.y);
        var segDX = b.x - segX;
        var segDY = b.y - segY;
        var segLen2 = segDX * segDX + segDY * segDY;
        for (var j = 0; j < world.zombies.length; j++) {
          var z = world.zombies[j];
          if (z.dead) continue;
          var tproj = 0;
          if (segLen2 > 0) {
            tproj = ((z.x - segX) * segDX + (z.y - segY) * segDY) / segLen2;
            if (tproj < 0) tproj = 0;
            else if (tproj > 1) tproj = 1;
          }
          var cx = segX + segDX * tproj;
          var cy = segY + segDY * tproj;
          var d = Math.hypot(cx - z.x, cy - z.y);
          if (d < z.r + b.r) {
            z.hp -= b.dmg;
            z.hurtFlash = 0.2;
            if (b.splash > 1) {
              // splash: also scour nearby ones (centered on the hit point)
              for (var s = 0; s < world.zombies.length; s++) {
                var zs2 = world.zombies[s];
                if (zs2.dead || zs2 === z) continue;
                if (Math.hypot(cx - zs2.x, cy - zs2.y) < b.splash) {
                  zs2.hp -= b.dmg * 0.5;
                  zs2.hurtFlash = 0.18;
                  if (zs2.hp <= 0) {
                    zs2.dead = true;
                    world.player.kills++;
                    world.score += 10;
                    world.pickups.push({ type: Math.random() < 0.7 ? 'exp' : 'coin', x: zs2.x, y: zs2.y, life: 10 });
                  }
                }
              }
            }
            if (z.hp <= 0) {
              z.dead = true;
              world.player.kills++;
              world.score += 10;
              world.pickups.push({ type: Math.random() < 0.7 ? 'exp' : 'coin', x: z.x, y: z.y, life: 10 });
            }
            hit = true;
            break;
          }
        }
        if (hit) { list.splice(i, 1); continue; }
      }

      // nuke live for a blink then detonate
      if (b.nuke) {
        if (b.life <= 0.15) {
          for (var n = 0; n < world.zombies.length; n++) {
            var zn = world.zombies[n];
            if (zn.dead) continue;
            if (Math.hypot(b.x - zn.x, b.y - zn.y) < b.splash) {
              zn.hp -= 9999;
              zn.hurtFlash = 0.4;
              if (zn.hp <= 0) {
                zn.dead = true;
                world.player.kills++;
                world.score += 10;
                world.pickups.push({ type: Math.random() < 0.7 ? 'exp' : 'coin', x: zn.x, y: zn.y, life: 10 });
              }
            }
          }
          list.splice(i, 1);
        }
      }
    }
  }

  function updatePickups(list, dt, world) {
    var p = world.player;
    for (var i = list.length - 1; i >= 0; i--) {
      var pk = list[i];
      pk.life -= dt;
      if (pk.life <= 0) { list.splice(i, 1); continue; }
      var d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < 150) {
        pk.x += (p.x - pk.x) / (d || 1) * 200 * dt;
        pk.y += (p.y - pk.y) / (d || 1) * 200 * dt;
      }
      if (d < 20) {
        if (pk.type === 'exp') {
          // XP only accumulates here; Game.update owns the level-up gate
          p.exp += 10;
        } else if (pk.type === 'coin') {
          world.coins += 5;
        }
        list.splice(i, 1);
      }
    }
  }

  ZH.createSurvivor = createSurvivor;
  ZH.createEnemy = createEnemy;
  ZH.createBoss = createBoss;
  ZH.updateSurvivor = updateSurvivor;
  ZH.updateEnemies = updateEnemies;
  ZH.updateProjectiles = updateProjectiles;
  ZH.updatePickups = updatePickups;
  ZH.fireWeapon = fireWeapon;

})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
