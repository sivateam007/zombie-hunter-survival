'use strict';
/* The wave/stage contract, the idle-siege curve and the practice roster.

   A stage is twenty 60-second waves, which is exactly the authored
   TIME_LEVEL_COMPLETED window: "survive wave 20" and "survive 20 minutes"
   are the same moment, so the auto-advance never cuts authored boss content.
   Standing still feeds a bounded siege; the board ships a deterministic cat
   roster that both the browser fallback and the Node server use. */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ZH } = require('./_setup');
const roster = require('../js/roster');
const { createLedger } = require('../server/ledger');

/* ------------------------- twenty waves per stage ------------------------- */
assert.strictEqual(ZH.WAVE_SECONDS, 60, 'a wave lasts a minute');
assert.strictEqual(ZH.WAVES_PER_STAGE, 20, 'a stage is twenty waves');
assert.strictEqual(ZH.WAVE_SECONDS * ZH.WAVES_PER_STAGE, ZH.TIME_LEVEL_COMPLETED,
  'twenty waves are exactly the authored stage length');

assert.strictEqual(ZH.waveNumber(0), 1);
assert.strictEqual(ZH.waveNumber(59.9), 1);
assert.strictEqual(ZH.waveNumber(60), 2);
assert.strictEqual(ZH.waveNumber(1140), 20, 'the last minute is wave 20');
assert.strictEqual(ZH.waveNumber(3000), 20, 'campaign waves clamp at the stage length');
assert.strictEqual(ZH.waveNumber(3000, true), 51, 'endless keeps counting');
assert.strictEqual(ZH.waveNumber(-5), 1, 'a negative clock is still wave 1');

/* ------------------------------ idle siege ------------------------------- */
assert.ok(ZH.SIEGE.grace >= 1 && ZH.SIEGE.grace <= 3, 'a short grace before the siege');
assert.ok(ZH.SIEGE.extraCap > 0 && ZH.SIEGE.extraCap <= 24, 'the overspill is bounded');
assert.strictEqual(ZH.siegeCadence(0), ZH.SIEGE.cadence[0].s, 'the curve opens at its first stop');

const lastStop = ZH.SIEGE.cadence[ZH.SIEGE.cadence.length - 1];
assert.strictEqual(ZH.siegeCadence(5000), lastStop.s, 'the curve clamps after its last stop');
for (let i = 1; i < ZH.SIEGE.cadence.length; i++) {
  assert.ok(ZH.SIEGE.cadence[i].s < ZH.SIEGE.cadence[i - 1].s, 'the siege tightens with the clock');
}
assert.ok(ZH.siegeCadence(0) <= 2.2, 'the opening siege is not a wall');
assert.ok(ZH.siegeCadence(1200) >= 0.45, 'the late siege stays survivable');
assert.ok(ZH.siegeCadence(600) < ZH.siegeCadence(0), 'minute ten closes in faster than minute one');

/* --------------------------- practice roster ----------------------------- */
assert.ok(Array.isArray(roster.NAMES) && roster.NAMES.length >= 50,
  'a full board of callsigns: ' + roster.NAMES.length);
assert.strictEqual(new Set(roster.NAMES).size, roster.NAMES.length, 'names are unique');
roster.NAMES.forEach((n) => {
  assert.ok(/^[A-Z][A-Z ]*$/.test(n), 'uppercase callsign: ' + n);
  assert.ok(n.length <= 14, 'fits the save/ledger name limit: ' + n);
});

const endless = roster.ghosts('endless');
assert.strictEqual(endless.length, roster.NAMES.length);
for (let i = 1; i < endless.length; i++) {
  assert.ok(endless[i - 1].wave >= endless[i].wave, 'the board is ranked by wave');
}
assert.ok(endless[0].wave >= 20, 'the top ghost is a real survivor');
assert.ok(endless.every((r) => r.score > 0 && r.kills > 0), 'every ghost has a record');
assert.deepStrictEqual(roster.ghosts('endless'), endless, 'the board is deterministic');

const campaign = roster.ghosts('campaign');
assert.ok(campaign.every((r) => r.mode === 'campaign' && r.wave <= 20),
  'campaign ghosts stay inside the campaign');

/* the server seeds the same roster, exactly once */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zh-roster-'));
const ledger = createLedger(path.join(dir, 'board.json'));
assert.strictEqual(ledger.seed(endless), endless.length, 'every ghost is seeded');
assert.strictEqual(ledger.seed(endless), 0, 'seeding twice adds nothing');
const board = ledger.list('endless', 50);
assert.strictEqual(board.length, Math.min(50, endless.length), 'the board is capped at 50 rows');
assert.strictEqual(board[0].name, endless[0].name, 'the seed preserves the ranking');
fs.rmSync(dir, { recursive: true, force: true });

console.log('waves.test.js ✓ 20 waves per stage, the idle siege and the cat roster');
