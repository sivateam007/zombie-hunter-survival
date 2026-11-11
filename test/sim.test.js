'use strict';
/* Simulation: movement, melee bites, weapon fire, pickups, ranged enemies. */
const assert = require('assert');
const { ZH } = require('./_setup');

assert.strictEqual(ZH.SHIELD, undefined, 'the force field system is gone');
assert.strictEqual(ZH.openShield, undefined, 'there is no shield arming function');

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
  const startDist = Math.hypot(z.x - w.player.x, z.y - w.player.y);
  for (let i = 0; i < 180; i++) ZH.updateEnemies(w.zombies, 1 / 60, w);
  const endDist = Math.hypot(z.x - w.player.x, z.y - w.player.y);
  assert.ok(endDist < startDist, 'the zombie closes the distance');
  assert.ok(w.player.hp < 100, 'it lands a bite');
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
  assert.strictEqual(p.attribs.defense, 0.03, 'energy drink cuts bite damage by 3%');
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

/* ---------- 9. bomb clears the field, medikit heals, magnet vacuums ---------- */
{
  const w = makeWorld();
  for (let i = 0; i < 6; i++) {
    w.zombies.push(ZH.createEnemy('zombieA', w.player.x + 40 + i * 10, w.player.y, 1));
  }
  const boss = ZH.createBoss('boss_soldier', w.player.x + 90, w.player.y, null, 1);
  const bossHp = boss.hp;
  w.zombies.push(boss);
  w.player.hp = 40;
  w.pickups.push({ type: 'bomb', x: w.player.x, y: w.player.y, life: 5 });
  ZH.updatePickups(w.pickups, 1 / 60, w);
  assert.strictEqual(w.zombies.filter((z) => !z.boss && !z.dead).length, 0,
    'the bomb clears every normal body on the field');
  assert.ok(boss.hp < bossHp, 'a boss only takes a bite of its bar');
  assert.ok(w.bombFlash > 0, 'the bomb flashes the screen');
}
{
  const w = makeWorld();
  w.player.hp = 50;
  w.pickups.push({ type: 'medikit', x: w.player.x, y: w.player.y, life: 5, value: 50 });
  ZH.updatePickups(w.pickups, 1 / 60, w);
  assert.strictEqual(w.player.hp, 100, 'the medikit heals the hunter');
}
{
  const w = makeWorld();
  w.pickups.push({ type: 'magnet', x: w.player.x, y: w.player.y, life: 5 });
  const far = { type: 'coin', x: w.player.x + 600, y: w.player.y, life: 5, value: 5 };
  w.pickups.push(far);
  ZH.updatePickups(w.pickups, 1 / 60, w);
  assert.strictEqual(far.pulling, 1, 'the magnet marks distant drops');
  const before = Math.hypot(far.x - w.player.x, far.y - w.player.y);
  ZH.updatePickups(w.pickups, 1 / 60, w);
  const after = Math.hypot(far.x - w.player.x, far.y - w.player.y);
  assert.ok(after < before, 'a marked drop flies to the hunter');
}

/* ---------- 10. minibosses keep the original deaddrop table ---------- */
{
  /* the original: tower pays 1,500 coins, toxic2 500, fighter 1,000;
     soldier drops a bomb, builder a magnet, toxic1 a medikit; the reptiles
     and spiders leave 1- and 3-card chests. */
  const drops = {
    miniboss_soldier: 'bomb', miniboss_tower: 'coin', miniboss_builder: 'magnet',
    miniboss_toxic1: 'medikit', miniboss_toxic2: 'coin', miniboss_fighter: 'coin',
    miniboss_spider: 'treasure', miniboss_reptile: 'treasure'
  };
  const coinValue = { miniboss_tower: 1500, miniboss_toxic2: 500, miniboss_fighter: 1000 };
  Object.keys(drops).forEach((type) => {
    const w = makeWorld();
    const mb = ZH.createEnemy(type, w.player.x + 300, w.player.y, 1);
    w.zombies.push(mb);
    ZH.damageEnemy(w, mb, mb.maxHp + 1);
    const matches = w.pickups.filter((p) => p.type === drops[type]);
    assert.ok(matches.length, type + ' drops a ' + drops[type]);
    if (coinValue[type]) {
      assert.ok(matches.some((p) => p.value === coinValue[type]),
        type + ' pays the original ' + coinValue[type] + ' coins');
    }
  });
}

/* ---------- 10b. deadshot acid and deadspawn splits ---------- */
{
  const w = makeWorld();
  const z = ZH.createEnemy('slime2', w.player.x + 40, w.player.y, 1);
  w.zombies.push(z);
  ZH.damageEnemy(w, z, z.maxHp + 1);
  assert.strictEqual(w.hazards.length, 1, 'a slime2 death leaves an acid pool');
  assert.strictEqual(
    w.zombies.filter((c) => c !== z && c.type === 'slime1').length, 2,
    'a slime2 splits into two slime1'
  );
}
{
  const w = makeWorld();
  w.player.hp = 10;
  w.player.maxHp = 200;          /* headroom, or the heal is capped at 100 */
  w.pickups.push({ type: 'food', x: w.player.x, y: w.player.y, life: 5, value: 100 });
  ZH.updatePickups(w.pickups, 1 / 60, w);
  assert.strictEqual(w.player.hp, 110, 'food heals a flat 100 HP');
}

/* ---------- 11. the horde separates instead of stacking ---------- */
{
  const w = makeWorld();
  const zs = [];
  for (let i = 0; i < 12; i++) zs.push(ZH.createEnemy('zombieA', w.player.x + 60, w.player.y + 2, 1));
  w.zombies.push(...zs);
  ZH.updateEnemies(w.zombies, 1 / 60, w);
  const spread = Math.max(...zs.map((z) => z.y)) - Math.min(...zs.map((z) => z.y));
  assert.ok(spread > 20, 'a stacked horde spreads across the street (spread ' + spread.toFixed(1) + 'px)');
}

console.log('sim.test.js ✓ movement, bites, every weapon, pickups, bomb/magnet/medikit, deaddrops, ranged enemies, evolutions');
