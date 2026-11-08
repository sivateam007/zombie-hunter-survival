'use strict';
/* Jetpack: one fuel clock, a real take-off threshold, a finite flight and a
   recharge on the ground. Bites pass underneath while the jets are lit. */
const assert = require('assert');
const { ZH } = require('./_setup');

assert.ok(ZH.JETPACK, 'jetpack tuning exists');
assert.strictEqual(ZH.JETPACK.max, 100, 'full tank is 100');
assert.ok(ZH.JETPACK.drain > 0 && ZH.JETPACK.regen > 0, 'fuel drains and recharges');

const p = { jetFuel: 100, jetActive: false, jetLift: 0 };
ZH.tickJetpack(p, 1, true);
assert.strictEqual(p.jetActive, true, 'holding the button takes off on a full tank');
assert.ok(p.jetFuel < 100, 'flight burns fuel');
assert.ok(p.jetLift > 0, 'the rig lifts');

for (let i = 0; i < 4; i++) ZH.tickJetpack(p, 1, true);
assert.strictEqual(p.jetFuel, 0, 'the tank empties');
assert.strictEqual(p.jetActive, false, 'no flight without fuel');

ZH.tickJetpack(p, 1, false);
assert.ok(p.jetFuel >= ZH.JETPACK.regen - 0.001, 'fuel recharges on the ground');
assert.strictEqual(p.jetActive, false, 'released input keeps the hunter grounded');

/* A bite cannot land while the hunter is flying. */
const world = {
  arena: {}, player: ZH.createSurvivor({ x: 100, y: 100, weapon: 'gun' }),
  zombies: [], bullets: [], enemyBullets: [], pickups: [], particles: [],
  coins: 0, score: 0, shake: 0, t: 0,
  ui: { showLevelUp() {} }
};
world.player.shieldT = 0;
world.player.jetActive = true;
world.player.hp = 100;
world.zombies.push(ZH.createEnemy('zombieA', world.player.x + 8, world.player.y, 1));
for (let i = 0; i < 90; i++) ZH.updateEnemies(world.zombies, 1 / 60, world);
assert.strictEqual(world.player.hp, 100, 'flying over a zombie blocks its bite');

console.log('jetpack.test.js ✓ take-off, fuel burn, recharge and bite immunity');
