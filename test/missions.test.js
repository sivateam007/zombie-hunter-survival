/* Contracts + idle coffer: table parity, progress, claims and refresh. */
'use strict';
const assert = require('assert');
const { ZH } = require('./_setup');
require('../js/missions.js');

const Save = ZH.Save;
const M = ZH.Missions;
const T = ZH.MISSION_TYPES;
/* a fixed clock: 10 Nov 2026, 09:00 UTC */
const NOW = Date.UTC(2026, 10, 10, 9, 0, 0);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/* ---------- 1. the board ---------- */
Save.reset();
let s = M.ensure(NOW);
assert.strictEqual(s.missions.length, 6, 'daily + three contracts + two chains');
assert.strictEqual(s.missions[0].type, T.DAILY_LOGIN);
assert.strictEqual(s.missions[0].reward, 2500);
assert.strictEqual(s.missions[0].target, 1);
assert.strictEqual(s.missions[0].value, 1, 'the daily patrol is claimable on login');

const pool = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const rolled = s.missions.slice(1, 4).map((m) => m.type);
rolled.forEach((t) => assert.ok(pool.indexOf(t) !== -1, 'slot type ' + t + ' is in the original pool'));
assert.strictEqual(new Set(rolled).size, 3, 'the three contracts are distinct');
assert.deepStrictEqual(s.missions.slice(1, 4).map((m) => m.tier), [1, 2, 3], 'tiers 1 / 2 / 3');

assert.strictEqual(s.missions[4].type, T.COMPLETE_4_MISSIONS);
assert.strictEqual(s.missions[4].reward, 8000);
assert.strictEqual(s.missions[4].target, 4);
assert.strictEqual(s.missions[5].type, T.COMPLETE_10_MISSIONS);
assert.strictEqual(s.missions[5].reward, 15000);
assert.strictEqual(s.missions[5].target, 10);

/* the reward/target ladder, straight from GenerateMission */
const ladder = (type) => [1, 2, 3].map((tier) => {
  const m = M.makeMission(type, tier);
  return [m.reward, m.target];
});
assert.deepStrictEqual(ladder(2), [[3000, 1000], [6000, 10000], [12000, 100000]]);
assert.deepStrictEqual(ladder(3), [[3000, 3], [6000, 7], [12000, 15]]);
assert.deepStrictEqual(ladder(4), [[3000, 1], [6000, 2], [12000, 4]]);
assert.deepStrictEqual(ladder(5), [[3000, 4], [6000, 7], [12000, 10]]);
assert.deepStrictEqual(ladder(6), [[3000, 2], [6000, 4], [12000, 8]]);
assert.deepStrictEqual(ladder(7), [[3000, 10000], [6000, 25000], [12000, 75000]]);
assert.deepStrictEqual(ladder(8), [[3000, 100000], [6000, 1000000], [12000, 10000000]]);
assert.deepStrictEqual(ladder(9), [[3000, 50000], [6000, 500000], [12000, 5000000]]);
assert.deepStrictEqual(ladder(10), [[3000, 500], [6000, 1200], [12000, 2500]]);
assert.deepStrictEqual(ladder(11), [[3000, 250], [6000, 600], [12000, 1250]]);
assert.deepStrictEqual(ladder(12), [[3000, 10], [6000, 25], [12000, 75]]);

/* ---------- 2. progress and claims ---------- */
s.missions[1] = M.makeMission(2, 2);          /* kill 10,000, pays 6,000 */
M.update(T.KILL_ENEMIES, 2500);
assert.strictEqual(s.missions[1].value, 2500, 'kills advance the matching contract');
M.update(T.KILL_ENEMIES, 99999);
assert.strictEqual(s.missions[1].value, 10000, 'progress caps at the target');

const before = Save.get().coins;
const claim = M.claim(1);
assert.ok(claim.ok, 'a finished contract can be claimed');
assert.strictEqual(claim.coins, 6000, 'the tier-2 payout is exact');
assert.strictEqual(Save.get().coins, before + 6000, 'the payout reaches the bank');
assert.strictEqual(s.missions[1].claimed, true);
assert.strictEqual(s.missionsDone, 1, 'claims feed the chains');
assert.strictEqual(s.missions[4].value, 1, 'the 4-contract chain advances');

const again = M.claim(1);
assert.strictEqual(again.ok, false, 'a contract cannot pay twice');

/* difficulty multiplies the payout: 3,000 x 2.5 on insane */
Save.setDifficulty('insane');
s.missions[2] = M.makeMission(4, 1);
s.missions[2].value = s.missions[2].target;
const insane = M.claim(2);
assert.strictEqual(insane.coins, 7500, 'insane pays x2.5');
Save.setDifficulty('normal');

const incomplete = M.claim(3);
assert.strictEqual(incomplete.ok, false);
assert.strictEqual(incomplete.reason, 'incomplete', 'unfinished contracts do not pay');

/* ---------- 3. the coffer ---------- */
Save.reset();
s = M.ensure(NOW);
assert.strictEqual(s.cofferTime, NOW + 158 * HOUR, 'a fresh save starts 10 h short of full');
assert.strictEqual(M.cofferValue(NOW), 1000, '10 h of segments are already banked');
assert.strictEqual(M.cofferValue(NOW + 15 * MIN), 1025, 'one segment lands every 15 minutes');
assert.strictEqual(M.cofferValue(NOW + 158 * HOUR), 16800, 'the 168 h cap is 16,800');
assert.strictEqual(M.cofferValue(NOW + 200 * HOUR), 16800, 'the cap never overflows');

const c = M.claimCoffer(NOW + 158 * HOUR);
assert.strictEqual(c.ok, true);
assert.strictEqual(c.coins, 16800);
assert.strictEqual(Save.get().coins, 16800);
assert.strictEqual(M.cofferValue(NOW + 158 * HOUR), 0, 'claiming empties the coffer');
assert.strictEqual(M.cofferValue(NOW + 158 * HOUR + 15 * MIN), 25, 'it starts filling again');
const empty = M.claimCoffer(NOW + 158 * HOUR + 5 * MIN);
assert.strictEqual(empty.ok, false, 'nothing to collect below one segment');

/* ---------- 4. daily refresh ---------- */
Save.reset();
s = M.ensure(NOW);
s.missions[0].claimed = true;
s.loginDay = 'old-day';
M.ensure(NOW + DAY);
assert.strictEqual(s.missions[0].claimed, false, 'the daily patrol resets on a new day');
assert.strictEqual(s.missions[0].value, 1);
assert.ok(s.missionsTime > NOW + DAY, 'the contract cycle moves forward');

s.missionsTime = NOW + 2 * DAY;
s.missions[1].claimed = true;
M.ensure(NOW + 2 * DAY);
assert.strictEqual(s.missions[1].claimed, false, 'claimed slots are replaced on refresh');

Save.reset();
console.log('missions.test.js ✓ contract table, progress, claims, chains, coffer and daily refresh');
