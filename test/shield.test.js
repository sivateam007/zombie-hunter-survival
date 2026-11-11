'use strict';
/* Force field: one earned, timed protection window.

   Nothing passive arms it any more — no bite, dash, level-up or revive — and
   health never regenerates on its own. A cell drops on every 40th kill (and
   from every boss), arms a one-minute field, and the same clock drains it to
   exactly zero. Asserted here: timeline maths, the single arming path, the
   kill-gift gate, the pickup, a real block and a break that does not re-arm. */
const assert = require('assert');
const { ZH } = require('./_setup');

/* ---------------- timeline maths ---------------- */
const full = ZH.shieldTimeline(3, 3);
assert.deepStrictEqual(
  { active: full.active, remaining: full.remaining, frac: full.frac, expiring: full.expiring },
  { active: true, remaining: 3, frac: 1, expiring: false },
  'a fresh window reads full'
);
assert.strictEqual(ZH.shieldTimeline(0, 3).active, false, 'no window when the clock is empty');
assert.strictEqual(ZH.shieldTimeline(0, 3).frac, 0, 'an empty bar has no width');
assert.strictEqual(ZH.shieldTimeline(0.7, 3).expiring, true, 'the last second is flagged as expiring');
assert.strictEqual(ZH.shieldTimeline(2.2, 3).expiring, false, 'a fresh window is not flagged');
assert.ok(ZH.shieldTimeline(1.5, 3).frac > ZH.shieldTimeline(0.5, 3).frac, 'the bar drains monotonically');
assert.strictEqual(ZH.shieldTimeline(9, 3).frac, 1, 'the bar never overfills');
const mid = ZH.shieldTimeline(1.8, 3);
assert.ok(Math.abs(mid.frac * mid.max - mid.remaining) < 1e-9, 'bar width and remaining time agree');

/* ---------------- one arming path: the earned cell ---------------- */
assert.strictEqual(ZH.SHIELD.force, 60, 'a force field lasts exactly one minute');
assert.ok(ZH.SHIELD.max >= ZH.SHIELD.force, 'the HUD bar spans the whole window');
assert.strictEqual(ZH.SHIELD.hit, 0, 'a bite does not arm the field');
assert.strictEqual(ZH.SHIELD.levelup, 0, 'a level-up does not arm the field');
assert.strictEqual(ZH.SHIELD.dash, 0, 'a roll does not arm the field');
assert.strictEqual(ZH.SHIELD.revive, 0, 'a revive does not arm the field');

const p = { shieldT: 0, shieldMax: 0 };
ZH.openShield(p);
assert.strictEqual(p.shieldT, 60, 'the default arming path is the 60 s cell');
ZH.openShield(p, 30);
assert.strictEqual(p.shieldT, 60, 'a shorter trigger cannot cut a live window');
assert.strictEqual(p.invuln, 60, 'the legacy mirror follows the one clock');
assert.strictEqual(ZH.shielded(p), true);
assert.strictEqual(ZH.openShield({}, 0), 0, 'a zero trigger is a no-op');

/* a stage starts with no protection at all */
assert.strictEqual(ZH.createSurvivor({ weapon: 'gun' }).shieldT, 0,
  'the hunter spawns without a force field');
assert.strictEqual(ZH.createSurvivor({ weapon: 'gun' }).shieldMax, 0,
  'and without a stale bar span');

/* ---------------- earned, not timed: the kill gift ---------------- */
assert.ok(ZH.SHIELD.killGiftEvery >= 20 && ZH.SHIELD.killGiftEvery <= 100,
  'cells are rare enough to matter: ' + ZH.SHIELD.killGiftEvery + ' kills');
assert.strictEqual(ZH.shieldGiftDue(0, false), false, 'no cell at spawn');
assert.strictEqual(ZH.shieldGiftDue(39, false), false, 'not before the milestone');
assert.strictEqual(ZH.shieldGiftDue(40, false), true, 'the 40th kill earns a cell');
assert.strictEqual(ZH.shieldGiftDue(80, false), true, 'and every 40th after that');
assert.strictEqual(ZH.shieldGiftDue(0, true), true, 'a boss always leaves a cell');
assert.strictEqual(ZH.shieldGiftDue(40, true), true, 'bosses stay generous');

/* ---------------- the clock drains to exactly zero ---------------- */
const field = { shieldT: 0, shieldMax: 0 };
ZH.openShield(field, ZH.SHIELD.force);
let t = field.shieldT;
let frames = 0;
while (t > 0 && frames < 20000) { t = ZH.tickShield(field, 1 / 60); frames++; }
assert.strictEqual(t, 0, 'the window ends at zero, never negative');
assert.ok(frames >= 59 * 60 && frames <= 61 * 60,
  '60 s of field is ~3,600 frames at 60 fps (got ' + frames + ')');
assert.strictEqual(ZH.shielded(field), false, 'the hunter is unprotected after the break');
assert.strictEqual(ZH.shieldTimeline(field.shieldT, ZH.SHIELD.max).active, false,
  'the timeline hides on a break');

/* ---------------- pickup, block, break, no re-arm ---------------- */
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
  return world;
}

const w = makeWorld();
assert.strictEqual(w.player.shieldT, 0, 'no opening shield to hide behind');
w.pickups.push({ type: 'shield', x: w.player.x, y: w.player.y, life: 10, value: ZH.SHIELD.force });
ZH.updatePickups(w.pickups, 1 / 60, w);
assert.strictEqual(w.player.shieldT, ZH.SHIELD.force, 'the earned cell arms the 60 s window');
assert.strictEqual(w.pickups.length, 0, 'the cell is consumed');
assert.strictEqual(ZH.shieldTimeline(w.player.shieldT, w.player.shieldMax).active, true,
  'the timeline turns on with the pickup');

/* a bite during the window is blocked and the hunter keeps full health */
w.zombies.push(ZH.createEnemy('zombieA', w.player.x + 8, w.player.y, 1));
for (let i = 0; i < 90; i++) ZH.updateEnemies(w.zombies, 1 / 60, w);
assert.strictEqual(w.player.hp, 100, 'the field blocks bites while the timeline runs');

/* run the clock out, then the same bite lands and must NOT re-arm the field */
for (let i = 0; i < 3700; i++) ZH.tickShield(w.player, 1 / 60);
assert.strictEqual(w.player.shieldT, 0, 'the window expired');
let bit = false;
for (let i = 0; i < 420 && !bit; i++) {
  ZH.updateEnemies(w.zombies, 1 / 60, w);
  if (w.player.hp < 100) bit = true;
}
assert.ok(bit, 'a bite lands once the field is down');
assert.strictEqual(w.player.shieldT, 0, 'a bite does not re-arm the field');
assert.strictEqual(w.player.invuln, 0, 'no hidden invulnerability window either');

console.log('shield.test.js ✓ earned 60 s field, kill-gift gate, block and break');
