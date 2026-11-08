'use strict';
/* Simulation: movement, melee bites, weapon fire, pickups, ranged enemies. */
const assert = require('assert');
const { ZH } = require('./_setup');

function makeWorld(opts) {
  opts = opts || {};
  const world = {
    arena: { w: 6144, h: 6144 },
    player: ZH.createSurvivor({ x: 3072, y: 3072, weapon: opts.weapon || 'gun' }),
    zombies: [], bullets: [], enemyBullets: [], pickups: [], particles: [],
    coins: 0, score: 0, shake: 0, t: 0,
    ui: { showLevelUp() { world.levelUps = (world.levelUps || 0) + 1; } }
  };
  world.player.attack = 10;
  world.player.attribs = ZH.attribsFrom({});
  return world;
}

/* ---------- 1. the survivor has the original base stats ---------- */
{
  const p = ZH.createSurvivor({ weapon: 'gun' });
  assert.strictEqual(p.speed, 300, 'player speed is 0.3 px/ms = 300 px/s');
  assert.strictEqual(p.hp, 100, 'base health');
  assert.deepStrictEqual(Object.keys(p.weapons), ['gun'], 'starts with the Gun');
  assert.strictEqual(ZH.createSurvivor({ weapon: 'nonsense' }).weapon, 'gun', 'falls back to the Gun');
}

/* ---------- 2. a zombie closes in and bites ---------- */
{
  const w = makeWorld();
  const z = ZH.createEnemy('zombieA', 3300, 3072, 1);
  w.zombies.push(z);
  assert.strictEqual(w.player.shieldT, 3, 'a stage opens with the original 3 s defence shield');
  w.player.invuln = 0;   // let the opening shield expire so the bite can land
  w.player.shieldT = 0;
  const startDist = Math.hypot(z.x - w.player.x, z.y - w.player.y);
  for (let i = 0; i < 180; i++) ZH.updateEnemies(w.zombies, 1 / 60, w);
  const endDist = Math.hypot(z.x - w.player.x, z.y - w.player.y);
  assert.ok(endDist < startDist, 'the zombie closes the distance');
  assert.ok(w.player.hp < 100, 'it lands a bite');
  assert.strictEqual(w.player.invuln, 3.0, 'a hit grants the original 3 s invincibility');
  assert.strictEqual(w.player.shieldT, 3.0, 'the defence shield timeline restarts on a hit');
}

/* ---------- 3. weapons kill, score and drop loot ---------- */
ZH.WEAPON_ORDER.forEach((id) => {
  const w = makeWorld({ weapon: 'gun' });
  const p = w.player;
  p.aimDir = 0; p.moveX = 1; p.moveY = 0;
  const z = ZH.createEnemy('zombieA', 3140, 3072, 1);
  w.zombies.push(z);
  let fired = 0;
  for (let i = 0; i < 300 && !z.dead; i++) {
    ZH.updateEnemies(w.zombies, 1 / 60, w);
    p.timer = (p.timer || 0) - 1 / 60;
    if (p.timer <= 0) { p.timer = ZH.fireWeapon(id, 6, p, w); fired++; }
    ZH.updateProjectiles(w.bullets, 1 / 60, w);
  }
  assert.ok(fired > 0, id + ' fires');
  assert.ok(z.dead, id + ' kills a zombie');
  assert.ok(w.score > 0, id + ' scores');
  assert.ok(w.pickups.length > 0, id + ' drops loot');
});

/* ---------- 4. pickups: exp and scrap ---------- */
{
  const w = makeWorld();
  w.pickups.push({ type: 'exp', x: w.player.x, y: w.player.y, life: 5, value: 10 });
  w.pickups.push({ type: 'coin', x: w.player.x, y: w.player.y, life: 5, value: 5 });
  ZH.updatePickups(w.pickups, 1 / 60, w);
  assert.strictEqual(w.player.exp, 10, 'exp gem is collected');
  assert.strictEqual(w.coins, 5, 'scrap is collected');
  assert.strictEqual(w.pickups.length, 0, 'pickups are consumed');
}

/* ---------- 5. a treasure chest opens the skill slots ---------- */
{
  const w = makeWorld();
  w.pickups.push({ type: 'treasure', x: w.player.x, y: w.player.y, life: 5 });
  ZH.updatePickups(w.pickups, 1 / 60, w);
  assert.strictEqual(w.levelUps, 1, 'the chest offers a skill card');
}

/* ---------- 6. ranged enemies shoot and their shots hurt ---------- */
{
  const w = makeWorld();
  w.player.invuln = 0;   // past the opening defence shield
  w.player.shieldT = 0;
  const cop = ZH.createEnemy('cop', 3160, 3072, 1);
  w.zombies.push(cop);
  for (let i = 0; i < 120 && !w.enemyBullets.length; i++) ZH.updateEnemies(w.zombies, 1 / 60, w);
  assert.ok(w.enemyBullets.length > 0, 'the cop fires');
  for (let i = 0; i < 120; i++) ZH.updateProjectiles(w.enemyBullets, 1 / 60, w);
  assert.ok(w.player.hp < 100, 'enemy shots damage the hunter');
}

/* ---------- 7. supplies change the survivor's attribs ---------- */
{
  const p = ZH.createSurvivor({ weapon: 'gun' });
  p.supplies = { sneakers: 5, energydrink: 1 };
  p.attribs = ZH.attribsFrom(p.supplies);
  assert.strictEqual(p.attribs.speed_bonus, 0.5, 'sneakers lvl 5 = +50% speed');
  assert.strictEqual(p.attribs.regen_bonus, 0.01, 'energy drink heals 1% every 5 s');
}

/* ---------- 8. evolutions swap the firing gun at level 6 ---------- */
{
  const w = makeWorld({ weapon: 'gun' });
  const p = w.player;
  p.weapons.gun = { level: 6, class: 'gun', mag: 30, reloading: 0, timer: 0 };
  p.supplies = { ammobooster: 1 };
  assert.strictEqual(ZH.effectiveWeapon('gun', p.weapons.gun, p.supplies), 'uzi', 'Gun → Uzi');
  p.aimDir = 0;
  w.zombies.push(ZH.createEnemy('builder', 3300, 3072, 1));
  for (let i = 0; i < 60; i++) {
    ZH.updateEnemies(w.zombies, 1 / 60, w);
    ZH.fireWeapon('uzi', 6, p, w);
    ZH.updateProjectiles(w.bullets, 1 / 60, w);
  }
  assert.ok(w.zombies[0].hp < w.zombies[0].maxHp, 'the evolved gun deals damage');
}

console.log('sim.test.js ✓ movement, bites, every weapon, pickups, ranged enemies, evolutions');
