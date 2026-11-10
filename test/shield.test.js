'use strict';
/* Defence shield: one clock drives the timeline, the ring, the blink and the
   damage gate. Asserted here: the timeline maths, arming rules, a real
   countdown to exactly zero, the shield pickup, a break and a re-acquire. */
const assert = require('assert');
const { ZH } = require('./_setup');

/* ---------------- timeline maths ---------------- */
const full = ZH.shieldTimeline(3, 3);
assert.deepStrictEqual(
  { active: full.active, remaining: full.remaining, frac: full.frac, expiring: full.expiring },
  { active: true, remaining: 3, frac: 1, expiring: false },
  'a fresh window reads 3 s / full bar'
);
assert.strictEqual(ZH.shieldTimeline(0, 3).active, false, 'no window when the clock is empty');
assert.strictEqual(ZH.shieldTimeline(0, 3).frac, 0, 'an empty bar has no width');
assert.strictEqual(ZH.shieldTimeline(0.7, 3).expiring, true, 'the last second is flagged as expiring');
assert.strictEqual(ZH.shieldTimeline(2.2, 3).expiring, false, 'a fresh window is not flagged');
assert.ok(ZH.shieldTimeline(1.5, 3).frac > ZH.shieldTimeline(0.5, 3).frac, 'the bar drains monotonically');
assert.strictEqual(ZH.shieldTimeline(9, 3).frac, 1, 'the bar never overfills');
const mid = ZH.shieldTimeline(1.8, 3);
assert.ok(Math.abs(mid.frac * mid.max - mid.remaining) < 1e-9, 'bar width and remaining time agree');

/* ---------------- arming rules ---------------- */
const p = { shieldT: 0, shieldMax: 0 };
ZH.openShield(p, 1.2);
assert.strictEqual(p.shieldT, 1.2, 'a level-up window arms 1.2 s');
ZH.openShield(p, 3);
assert.strictEqual(p.shieldT, 3, 'a bite extends it to 3 s');
ZH.openShield(p, 0.4);
assert.strictEqual(p.shieldT, 3, 'a shorter trigger cannot cut a live window');
assert.strictEqual(p.invuln, 3, 'the legacy mirror follows the one clock');
assert.strictEqual(ZH.shielded(p), true);

/* the shield cell arms the (shorter now) force field and disappears at zero */
assert.strictEqual(ZH.SHIELD.force, 25, 'force field is a 25 s window');
assert.ok(ZH.SHIELD.levelup <= 5, 'the level-up window is a short buffer, not a 2-minute field');
const field = { shieldT: 0, shieldMax: 0 };
ZH.openShield(field, ZH.SHIELD.force);
assert.strictEqual(field.shieldT, 25, 'force field starts at 25 s');
for (let i = 0; i < 26; i++) ZH.tickShield(field, 1);
assert.strictEqual(field.shieldT, 0, 'force field is gone after 25 s');
assert.strictEqual(ZH.shielded(field), false, 'no protection after the force field ends');

/* ---------------- the clock drains to exactly zero ---------------- */
let t = 3;
let frames = 0;
while (t > 0 && frames < 1000) { t = ZH.tickShield(p, 1 / 60); frames++; }
assert.strictEqual(t, 0, 'the window ends at zero, never negative');
assert.ok(frames >= 179 && frames <= 181, '3 s of shield is 180 frames at 60 fps (got ' + frames + ')');
assert.strictEqual(ZH.shielded(p), false, 'the hunter is unprotected after a break');
assert.strictEqual(ZH.shieldTimeline(p.shieldT, 3).active, false, 'the timeline hides on a break');

/* ---------------- pickup, break, re-acquire ---------------- */
function makeWorld() {
  const world = {
    arena: { w: 6144, h: 6144 },
    player: ZH.createSurvivor({ x: 3072, y: 3072, weapon: 'gun' }),
    zombies: [], bullets: [], enemyBullets: [], pickups: [], particles: [],
    coins: 0, score: 0, shake: 0, t: 0,
    ui: { showLevelUp() {} }
  };
  world.player.attack = 10;
  world.player.attribs = ZH.attribsFrom({});
  world.player.shieldT = 0;
  world.player.shieldMax = 0;
  world.player.invuln = 0;
  return world;
}

const w = makeWorld();
w.pickups.push({ type: 'shield', x: w.player.x, y: w.player.y, life: 10, value: ZH.SHIELD.hit });
ZH.updatePickups(w.pickups, 1 / 60, w);
assert.strictEqual(w.player.shieldT, ZH.SHIELD.hit, 'the shield cell arms the full 3 s window');
assert.strictEqual(w.pickups.length, 0, 'the cell is consumed');
assert.strictEqual(ZH.shieldTimeline(w.player.shieldT, w.player.shieldMax).active, true,
  'the timeline turns on with the pickup');

/* a bite during the window is blocked and the hunter keeps full health */
w.zombies.push(ZH.createEnemy('zombieA', w.player.x + 8, w.player.y, 1));
for (let i = 0; i < 90; i++) ZH.updateEnemies(w.zombies, 1 / 60, w);
assert.strictEqual(w.player.hp, 100, 'the shield blocks bites while the timeline runs');

/* run the clock out, then the same bite lands and re-arms the window */
for (let i = 0; i < 200; i++) ZH.tickShield(w.player, 1 / 60);
assert.strictEqual(w.player.shieldT, 0, 'the window expired');
let bit = false;
for (let i = 0; i < 240 && !bit; i++) {
  ZH.updateEnemies(w.zombies, 1 / 60, w);
  if (w.player.hp < 100) bit = true;
}
assert.ok(bit, 'a bite lands once the shield is down');
assert.strictEqual(w.player.shieldT, ZH.SHIELD.hit, 'the bite re-acquires a fresh 3 s window');
assert.strictEqual(ZH.shieldTimeline(w.player.shieldT, w.player.shieldMax).active, true,
  'the timeline comes back after a re-acquire');

console.log('shield.test.js ✓ timeline maths, pickup, break and re-acquire');
