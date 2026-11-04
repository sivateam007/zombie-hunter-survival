'use strict';
/* Save data: default loadout, the six coin skills, progression, records. */
const assert = require('assert');
const { ZH } = require('./_setup');

const Save = ZH.Save;
Save.reset();

/* defaults */
assert.strictEqual(Save.get().bestLevel, 0, 'nothing cleared yet');
assert.strictEqual(Save.get().maxLevel, ZH.STAGES.length, 'campaign size comes from levels.js');
assert.deepStrictEqual(Save.get().weapons, ['gun'], 'the survivor starts with the Gun');
assert.strictEqual(Save.get().coins, 0, 'starts broke');
assert.strictEqual(Save.skillLevel('power'), 1, 'skills start at level 1');

/* coins + skill purchases */
Save.addCoins(20000);
assert.strictEqual(Save.get().coins, 20000);

const first = Save.buySkill('power');
assert.ok(first.ok, 'buys a POWER level');
assert.strictEqual(first.level, 2);
assert.strictEqual(Save.get().coins, 20000, 'first level is free (original price table)');

const second = Save.buySkill('power');
assert.ok(second.ok, 'buys again');
assert.strictEqual(second.price, 1000, 'second level costs 1,000');
assert.strictEqual(Save.get().coins, 19000, 'price is deducted');
assert.strictEqual(ZH.skillValue('power', Save.skillLevel('power')), 16, 'POWER LV 3 = 16');

/* climb to the cap */
Save.addCoins(20000000);
for (let i = Save.skillLevel('health'); i < ZH.MAX_PLAYER_SKILL; i++) Save.buySkill('health');
assert.strictEqual(Save.skillLevel('health'), ZH.MAX_PLAYER_SKILL, 'skill reaches the cap');
assert.strictEqual(Save.buySkill('health').reason, 'max', 'cap cannot be exceeded');

/* weapons are not sold */
assert.strictEqual(Save.buyWeapon('shotgun').ok, false, 'the store sells skills, not guns');

/* cannot overspend */
Save.reset();
Save.addCoins(500);
Save.buySkill('power');           /* free */
assert.strictEqual(Save.buySkill('power').ok, false, '1,000 is out of reach on 500 scrap');
assert.strictEqual(Save.buySkill('power').reason, 'coins');

/* progression */
Save.clearLevel(0, 250);
assert.strictEqual(Save.get().bestLevel, 1, 'clearing stage 1 unlocks stage 2');
assert.ok(Save.get().coins >= 750, 'clear reward is banked');
Save.unlockWeapon('crossbow');
assert.ok(Save.hasWeapon('crossbow'), 'in-run pickups are remembered');

/* runs */
const before = Save.get().stats.kills;
Save.recordRun({ mode: 'campaign', kills: 42, coins: 100, died: true, time: 90 });
assert.strictEqual(Save.get().stats.kills, before + 42, 'kills accumulate');
assert.strictEqual(Save.get().stats.deaths, 1, 'deaths are recorded');

/* settings + name */
Save.setName('  siva  ');
assert.strictEqual(Save.get().name, 'siva', 'name is trimmed');
Save.setSetting('muted', true);
assert.strictEqual(Save.get().settings.muted, true, 'settings persist');

/* persistence round-trip */
Save.persist();
const raw = global.window.localStorage.getItem('zhs.save.v1');
assert.ok(raw && raw.includes('"siva"'), 'save is written to storage');

console.log('storage.test.js ✓ defaults, coin skills, progression, records and persistence');
