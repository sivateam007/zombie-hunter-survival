'use strict';
const assert = require('assert');
const { ZH } = require('./_setup');

function makeWorld() {
  const world = {
    arena: { w: 1600, h: 1600, props: [] },
    player: ZH.createPlayer({ x: 800, y: 800 }),
    zombies: [], bullets: [], enemyBullets: [], shockwaves: [], pickups: [],
    particles: [], decals: [], floaters: [], ghosts: [], shockwaves: [],
    upgrades: {}, t: 0, score: 0, coins: 0, coinMul: 1, shake: 0,
    audio: null,
    spawnBlood() {}, spawnSparks() {}, spawnDust() {}, spawnFire() {},
    spawnFlame() {}, spawnGhost() {}, addDecal() {},
    spawnCoin(x, y, v) { ZH.spawnCoinPickup(this, x, y, v); },
    floatText() {}
  };
  world.player.aim = 0;
  return world;
}

function step(world, dt, fn) {
  world.t += dt;
  fn(dt);
}

/* ---------- 1. a walker closes in and bites ---------- */
{
  const world = makeWorld();
  const z = ZH.createZombie('walker', 860, 800);
  z.spawnT = 0;
  world.zombies.push(z);
  const startHp = world.player.hp;
  const startDist = Math.hypot(z.x - world.player.x, z.y - world.player.y);

  for (let i = 0; i < 240; i++) {
    step(world, 1 / 60, (dt) => {
      ZH.updateZombies(world.zombies, dt, world);
    });
  }
  const endDist = Math.hypot(z.x - world.player.x, z.y - world.player.y);
  assert.ok(endDist < startDist, 'walker closes the distance');
  assert.ok(world.player.hp < startHp, 'walker lands a bite');
  assert.ok(Number.isFinite(z.x) && Number.isFinite(z.y), 'positions stay finite');
}

/* ---------- 2. bullets kill and score ---------- */
{
  const world = makeWorld();
  const z = ZH.createZombie('walker', world.player.x + 70, world.player.y - 6);
  z.spawnT = 0;
  world.zombies.push(z);

  const weapon = ZH.statsFor('sniper', {});
  for (let shot = 0; shot < 4 && !z.dead; shot++) {
    world.bullets.length = 0;
    /* spawnBullet is internal; drive the player's own firing path instead */
    world.player.weaponId = 'sniper';
    world.player.mag = 5;
    world.player.cooldown = 0;
    world.player.reloading = 0;
    world.player.firing = true;
    world.player.aim = 0;
    world.player.moveX = 0;
    world.player.moveY = 0;
    for (let i = 0; i < 40; i++) {
      step(world, 1 / 60, (dt) => {
        ZH.updatePlayer(world.player, dt, world);
        ZH.updateBullets(world.bullets, dt, world);
      });
      if (z.dead) break;
    }
  }
  assert.ok(z.dead, 'sniper rounds put the walker down');
  assert.ok(world.score > 0, 'a kill scores');
  assert.ok(world.pickups.length > 0, 'the dead drop scrap');
  assert.ok(world.player.shots > 0, 'shots are counted');
  assert.ok(Number.isFinite(weapon.dmg), 'weapon stats resolve');
}

/* ---------- 3. reload refills the magazine ---------- */
{
  const world = makeWorld();
  const p = world.player;
  p.weaponId = 'rifle';
  p.mag = 0;
  ZH.startReload(p, world);
  assert.ok(p.reloading > 0, 'reload starts');
  for (let i = 0; i < 300 && p.reloading > 0; i++) {
    step(world, 1 / 60, (dt) => ZH.updatePlayer(p, dt, world));
  }
  const st = ZH.statsFor('rifle', {});
  assert.strictEqual(p.mag, st.mag, 'magazine is refilled');
}

/* ---------- 4. dash grants invulnerability ---------- */
{
  const world = makeWorld();
  const p = world.player;
  p.dashT = 0.18;
  step(world, 1 / 60, (dt) => ZH.updatePlayer(p, dt, world));
  assert.ok(p.invuln >= 0.05, 'dashing makes the hunter briefly untouchable');
}

/* ---------- 5. pickups collect ---------- */
{
  const world = makeWorld();
  const p = world.player;
  p.hp = 40;
  ZH.spawnCoinPickup(world, p.x, p.y, 25);
  ZH.spawnHealthPickup(world, p.x, p.y);
  step(world, 1 / 60, (dt) => ZH.updatePickups(world.pickups, dt, world));
  assert.strictEqual(world.coins, 25, 'scrap is collected');
  assert.ok(p.hp > 40, 'medkit heals');
}

/* ---------- 6. hordes separate instead of stacking ---------- */
{
  const world = makeWorld();
  for (let i = 0; i < 12; i++) {
    const z = ZH.createZombie('walker', 820, 820);
    z.spawnT = 0;
    world.zombies.push(z);
  }
  for (let i = 0; i < 120; i++) {
    step(world, 1 / 60, (dt) => ZH.updateZombies(world.zombies, dt, world));
  }
  let distinct = 0;
  const seen = new Set();
  world.zombies.forEach((z) => {
    const key = Math.round(z.x) + ':' + Math.round(z.y);
    if (!seen.has(key)) { seen.add(key); distinct++; }
    assert.ok(Number.isFinite(z.x) && Number.isFinite(z.y), 'no NaN positions');
  });
  assert.ok(distinct > 8, 'zombies spread out (' + distinct + ' distinct spots)');
}

/* ---------- 7. player damage respects armour ---------- */
{
  const world = makeWorld();
  const p = world.player;
  const plain = ZH.hurtPlayer(p, 20, world, 0, 0);
  assert.ok(plain && p.hp < p.maxHp, 'damage lands');
  p.invuln = 0;
  p.armor = 0.36;
  const before = p.hp;
  ZH.hurtPlayer(p, 30, world, 0, 0);
  assert.ok(Math.abs((before - p.hp) - 30 * 0.64) < 0.001, 'armour reduces damage');
}

console.log('sim.test.js ✓ AI, shooting, reload, dash, pickups, separation, armour');
