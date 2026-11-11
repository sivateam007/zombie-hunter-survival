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
world.player.jetActive = true;
world.player.hp = 100;
world.zombies.push(ZH.createEnemy('zombieA', world.player.x + 8, world.player.y, 1));
for (let i = 0; i < 90; i++) ZH.updateEnemies(world.zombies, 1 / 60, world);
assert.strictEqual(world.player.hp, 100, 'flying over a zombie blocks its bite');

/* ---------- the tactical pack: ignition fee, kick and dry-tank lock ---------- */
const j = ZH.JETPACK;
assert.ok(j.cost > 0, 'ignition burns a little extra fuel');
assert.ok(j.burstSpeed > j.speed && j.speed > 1, 'the take-off kick is faster than the hover');
assert.ok(j.regen > 20, 'the pack recharges in a few seconds, so it is a real tool');
assert.ok(j.drain > 0 && j.max / j.drain >= 3.5,
  'a full tank is worth at least ~3.5 s of flight (got ' + (j.max / j.drain).toFixed(2) + ' s)');

const q = { jetFuel: 100, jetActive: false, jetLift: 0 };
ZH.tickJetpack(q, 1 / 60, true);
assert.strictEqual(q.jetActive, true, 'a press ignites');
assert.ok(Math.abs(q.jetFuel - (100 - j.cost - j.drain / 60)) < 0.001, 'ignition charges the fee');
assert.ok(q.jetBurst > 0, 'take-off arms the speed kick');
ZH.tickJetpack(q, j.burst + 0.1, true);
assert.strictEqual(q.jetBurst, 0, 'the kick decays back to hover speed');

/* the ignition kick really moves the hunter faster than the hover */
const kick = ZH.createSurvivor({ x: 0, y: 0, weapon: 'gun' });
kick.moveX = 1; kick.moveY = 0; kick.jetActive = true; kick.jetBurst = 0.3;
kick.jetFuel = 100; kick.jetLift = j.lift;
const hover = ZH.createSurvivor({ x: 0, y: 0, weapon: 'gun' });
hover.moveX = 1; hover.moveY = 0; hover.jetActive = true; hover.jetBurst = 0; hover.jetLift = j.lift;
ZH.updateSurvivor(kick, 1 / 60, { zombies: [] });
ZH.updateSurvivor(hover, 1 / 60, { zombies: [] });
assert.ok(kick.x > hover.x, 'the ignition burst is faster than a steady hover');

/* a dry tank locks the pack until the button is released */
q.jetActive = false;
q.jetFuel = 0;
q.jetLock = true;
ZH.tickJetpack(q, 1 / 60, true);
assert.strictEqual(q.jetActive, false, 'a dry tank cannot reignite while still held');
ZH.tickJetpack(q, 1, false);   /* ground charge back above the minimum */
ZH.tickJetpack(q, 1 / 60, true);
assert.strictEqual(q.jetActive, true, 'releasing the button re-arms the pack');

console.log('jetpack.test.js ✓ take-off fee, ignition kick, fuel burn, recharge, dry-tank lock and bite immunity');
