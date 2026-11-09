/* ============================================================
 * Meow Zombie Hunter — survivor powers
 *
 * Every survivor carries one named special power. A power is a small
 * data record plus one engine that the combat hooks below understand, so
 * the store can describe it and the fight can actually run it.
 *
 * Hooks are called from the existing combat paths:
 *   modifyDamage  — before damage lands (crits, executes, berserk)
 *   onHit         — after damage lands (burn, chain, splash)
 *   onKill        — when a zombie dies (scavenge, speed, force fields)
 *   onBite        — when the hunter is hit (dodge, thorns)
 *   update        — once per frame (regen, burn ticks)
 * All of them are defensive: a missing player, power or world is a no-op.
 * ============================================================ */
(function (global) {
  var ZH = global.ZH = global.ZH || {};

  var POWERS = {
    hunter:   { name: 'FIELD DISCIPLINE', blurb: '+8% damage, +8% max vitals', engine: 'stat', dmg: 1.08, hp: 1.08 },
    meow:     { name: 'NINE LIVES',       blurb: '5% of damage dealt returns as health', engine: 'lifesteal', frac: 0.05 },
    ninja:    { name: 'SHADOW STEP',      blurb: '30% chance to slip a bite', engine: 'dodge', chance: 0.3 },
    titan:    { name: 'IRON HIDE',        blurb: 'Bites rebound for 35% of the damage', engine: 'thorns', frac: 0.35 },
    reaper:   { name: 'REAP',             blurb: '+60% damage to enemies under 35% health', engine: 'execute', threshold: 0.35, mult: 1.6 },
    scout:    { name: 'QUICK FEET',       blurb: '+3% speed per 10 kills, up to +30%', engine: 'speedkill', step: 0.03, cap: 0.3 },
    banker:   { name: 'INTEREST',         blurb: 'Every kill drops 2 extra scrap', engine: 'scavenge', coins: 2, chance: 1 },
    vampire:  { name: 'BLOOD TITHE',      blurb: '7% of damage dealt returns as health', engine: 'lifesteal', frac: 0.07 },
    brawler:  { name: 'KNUCKLE UP',       blurb: 'Bites rebound; damage rises as you bleed', engine: 'thorns', frac: 0.25, berserk: 0.5 },
    catlord:  { name: 'NINE CLAWS',       blurb: '20% chance to hit for double damage', engine: 'crit', chance: 0.2, mult: 2 },
    neoncat:  { name: 'NEON ARC',         blurb: 'Hits arc to a nearby enemy for 40%', engine: 'chain', frac: 0.4 },
    ronin:    { name: 'IAI CUT',          blurb: '30% chance to hit for double damage', engine: 'crit', chance: 0.3, mult: 2 },
    frost:    { name: 'FROSTBITE',        blurb: 'Hits freeze for 5 damage/s over 2.5 s', engine: 'burn', dps: 5, time: 2.5, color: '#a8e8ff' },
    ember:    { name: 'EMBER TRAIL',      blurb: 'Hits burn for 7 damage/s over 2 s', engine: 'burn', dps: 7, time: 2, color: '#ff7a3d' },
    tech:     { name: 'OVERCLOCK',        blurb: 'Hits arc to a second target for 55%', engine: 'chain', frac: 0.55 },
    warlock:  { name: 'SOUL SIPHON',      blurb: '9% of damage dealt returns as health', engine: 'lifesteal', frac: 0.09 },
    queen:    { name: 'SWARM CALL',       blurb: 'Hits splash 35% damage around the target', engine: 'splash', frac: 0.35, radius: 78 },
    ghostcat: { name: 'PHASE PAW',        blurb: '35% chance to slip a bite', engine: 'dodge', chance: 0.35 },
    ranger:   { name: 'LONG STRIDE',      blurb: '+8% speed and +8% damage', engine: 'stat', speed: 1.08, dmg: 1.08 },
    medic:    { name: 'TRIAGE',           blurb: 'Regenerate 1.2 health per second', engine: 'regen', rate: 1.2 },
    scrapper: { name: 'SALVAGE',          blurb: 'Half of all kills drop 3 extra scrap', engine: 'scavenge', coins: 3, chance: 0.5 },
    berserk:  { name: 'ADRENALINE',       blurb: 'Up to +40% damage as your health drops', engine: 'berserk', max: 0.4 },
    ghost:    { name: 'AFTERIMAGE',       blurb: '25% chance to slip a bite', engine: 'dodge', chance: 0.25 },
    warden:   { name: 'LOCKDOWN',         blurb: 'Every 10 kills arms a 2 s force field', engine: 'aura', shieldEvery: 10, shieldSeconds: 2 },
    paladin:  { name: 'AEGIS',            blurb: 'Bites rebound and you heal 0.8/s', engine: 'thorns', frac: 0.3, regen: 0.8 },
    spectre:  { name: 'PHASE WALK',       blurb: '35% chance to slip a bite', engine: 'dodge', chance: 0.35 },
    tyrant:   { name: 'TYRANNY',          blurb: 'Up to +60% damage as your health drops', engine: 'berserk', max: 0.6 },
    oracle:   { name: 'FORESIGHT',        blurb: 'Every kill drops 4 extra scrap', engine: 'scavenge', coins: 4, chance: 1 },
    samurai:  { name: 'ONE CUT',          blurb: 'Every 4th hit deals triple damage', engine: 'countcrit', every: 4, mult: 3 },
    valkyrie: { name: 'SKY CHARGE',       blurb: '20% chance to crit, +10% speed', engine: 'crit', chance: 0.2, mult: 2, statSpeed: 1.1 },
    monk:     { name: 'INNER PEACE',      blurb: 'Regenerate 2 health per second', engine: 'regen', rate: 2 },
    huntress: { name: 'MARKSMAN',         blurb: '+80% damage to enemies under 40% health', engine: 'execute', threshold: 0.4, mult: 1.8 },
    empress:  { name: 'ROYAL DECREE',     blurb: 'Hits splash; damage grows as you bleed', engine: 'splash', frac: 0.3, radius: 70, berserk: 0.3 },
    seraph:   { name: 'HALO',             blurb: '10% lifesteal; kills arm a force field', engine: 'lifesteal', frac: 0.1, shieldEvery: 8, shieldSeconds: 1.5 },
    overlord: { name: 'VOID EDICT',       blurb: 'Splash hits; +50% damage while wounded', engine: 'splash', frac: 0.45, radius: 96, berserk: 0.5 }
  };

  function get(charId) { return POWERS[charId] || null; }

  function playerPower(world) {
    var p = world && world.player;
    return p && p.power ? p.power : null;
  }

  /* ----------------------------- attach ----------------------------- */
  /* Called once by ZH.applyCharacter, after the stat multipliers have
     already been folded into the survivor. */
  function attach(p, charId) {
    var pw = get(charId);
    if (!p) return null;
    p.power = pw;
    if (!pw) return null;
    if (pw.dmg) p.attack = Math.round((p.attack || 10) * pw.dmg * 100) / 100;
    if (pw.hp) {
      p.maxHp = Math.max(1, Math.round((p.maxHp || 100) * pw.hp));
      p.hp = Math.min(p.maxHp, (p.hp || p.maxHp));
    }
    if (pw.speed || pw.statSpeed) p.speed = Math.round((p.speed || 300) * (pw.speed || 1) * (pw.statSpeed || 1));
    if (pw.frac && pw.engine === 'lifesteal') p.lifesteal = Math.max(p.lifesteal || 0, pw.frac);
    return pw;
  }

  /* -------------------------- damage hooks -------------------------- */
  function modifyDamage(world, z, dmg) {
    var pw = playerPower(world);
    if (!pw || z._dotHit) return dmg;
    var p = world.player;
    var mult = 1;

    if (pw.engine === 'crit' && Math.random() < pw.chance) mult *= pw.mult;

    if (pw.engine === 'countcrit') {
      p._hitCount = (p._hitCount || 0) + 1;
      if (p._hitCount % pw.every === 0) mult *= pw.mult;
    }

    if (pw.engine === 'execute' && z.maxHp && z.hp / z.maxHp <= pw.threshold) mult *= pw.mult;

    /* berserk: damage climbs as the hunter's own bar empties */
    var berserk = pw.engine === 'berserk' ? pw.max : (pw.berserk || 0);
    if (berserk > 0 && p.maxHp) {
      var missing = 1 - Math.max(0, p.hp || 0) / p.maxHp;
      mult *= 1 + berserk * missing;
    }

    return mult === 1 ? dmg : dmg * mult;
  }

  function onHit(world, z, dmg) {
    if (z._dotHit) { z._dotHit = false; return; }
    var pw = playerPower(world);
    if (!pw) return;
    /* one level of splash/chain only: nested hits must not fan out forever */
    if (world._spread) return;

    if (pw.engine === 'burn') {
      z.burnT = Math.max(z.burnT || 0, pw.time);
      z.burnDps = Math.max(z.burnDps || 0, pw.dps);
      z.burnColor = pw.color;
    }

    if (pw.engine === 'chain') {
      var near = nearestOther(world, z, 220);
      if (near) { world._spread = 1; ZH.damageEnemy(world, near, dmg * pw.frac); world._spread = 0; }
    }

    if (pw.engine === 'splash') {
      var list = world.zombies || [];
      world._spread = 1;
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        if (!o || o === z || o.dead) continue;
        if (Math.hypot(o.x - z.x, o.y - z.y) > pw.radius) continue;
        ZH.damageEnemy(world, o, dmg * pw.frac);
      }
      world._spread = 0;
    }
  }

  function nearestOther(world, z, range) {
    var list = world.zombies || [], best = null, bd = range;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (!o || o === z || o.dead) continue;
      var d = Math.hypot(o.x - z.x, o.y - z.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  function onKill(world, z) {
    var pw = playerPower(world);
    if (!pw) return;
    var p = world.player;

    if (pw.engine === 'scavenge' && Math.random() < pw.chance) {
      world.pickups.push({ type: 'coin', x: z.x + (Math.random() * 8 - 4), y: z.y + (Math.random() * 8 - 4), life: 12, value: pw.coins });
    }

    if (pw.engine === 'speedkill' && p) {
      p._powerKills = (p._powerKills || 0) + 1;
      if (p._powerKills % 10 === 0 && (p._powerBonus || 0) < pw.cap) {
        p._powerBonus = Math.min(pw.cap, (p._powerBonus || 0) + pw.step);
        p.speed = Math.round(p.speed * (1 + pw.step));
      }
    }

    if (pw.shieldEvery && p && ZH.openShield) {
      p._shieldKills = (p._shieldKills || 0) + 1;
      if (p._shieldKills >= pw.shieldEvery) {
        p._shieldKills = 0;
        ZH.openShield(p, pw.shieldSeconds);
      }
    }
  }

  /* returns the damage that actually lands: 0 means the hit was dodged */
  function onBite(world, z, dmg) {
    var pw = playerPower(world);
    if (!pw) return dmg;

    if (pw.engine === 'dodge' && Math.random() < pw.chance) {
      if (world.floaters && world.floaters.length < 70) {
        world.floaters.push({
          text: 'DODGE', x: world.player.x, y: world.player.y - 52,
          vy: -42, life: 0.6, max: 0.6, size: 13, color: '#9ef7ff'
        });
      }
      return 0;
    }

    if (pw.engine === 'thorns' && z && !z.dead) ZH.damageEnemy(world, z, dmg * pw.frac);
    return dmg;
  }

  /* --------------------------- per frame ---------------------------- */
  function update(world, dt) {
    var p = world && world.player;
    if (!p || p.dead) return;
    var pw = p.power;

    var regen = pw ? (pw.regen || (pw.engine === 'regen' ? pw.rate : 0)) : 0;
    if (regen > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + regen * dt);
    }

    /* burn / frost damage over time: ticks four times a second */
    var list = world.zombies || [];
    for (var i = 0; i < list.length; i++) {
      var z = list[i];
      if (!z || z.dead || !(z.burnT > 0)) continue;
      z.burnT -= dt;
      z._burnAcc = (z._burnAcc || 0) + dt;
      if (z._burnAcc >= 0.25) {
        z._burnAcc = 0;
        z._dotHit = true;
        ZH.damageEnemy(world, z, (z.burnDps || 0) * 0.25);
        /* clear even if the hit was absorbed, so the next real shot still
           runs its burn / splash / chain effects */
        z._dotHit = false;
        if (world.particles && world.particles.length < 220) {
          world.particles.push({
            x: z.x + (Math.random() * 8 - 4), y: z.y - 18,
            vx: (Math.random() * 30 - 15), vy: -50,
            life: 0.3, max: 0.3, size: 2.2,
            color: z.burnColor || '#ff7a3d'
          });
        }
      }
    }
  }

  ZH.POWERS = POWERS;
  ZH.Powers = {
    get: get,
    attach: attach,
    modifyDamage: modifyDamage,
    onHit: onHit,
    onKill: onKill,
    onBite: onBite,
    update: update
  };
})(typeof window !== 'undefined' ? window : globalThis);
