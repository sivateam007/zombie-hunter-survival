'use strict';
const assert = require('assert');
const { ZH } = require('./_setup');

const Save = ZH.Save;
Save.reset();

/* defaults */
assert.strictEqual(Save.get().bestLevel, 1, 'starts on mission 1');
assert.deepStrictEqual(Save.get().weapons, ['pistol'], 'starts with the sidearm');
assert.strictEqual(Save.get().coins, 0, 'starts broke');

/* coins + purchases */
Save.addCoins(20000);
assert.strictEqual(Save.get().coins, 20000);

const smg = Save.buyWeapon('smg');
assert.ok(smg.ok, 'buys the SMG');
assert.ok(Save.hasWeapon('smg'), 'SMG is owned');
assert.strictEqual(Save.get().coins, 20000 - ZH.WEAPONS.smg.price, 'price is deducted');
assert.strictEqual(Save.buyWeapon('smg').ok, false, 'cannot buy twice');

/* upgrades escalate and cap */
const first = Save.buyUpgrade('damage');
assert.ok(first.ok, 'buys a damage upgrade');
assert.strictEqual(first.level, 1);
const price2 = ZH.priceFor(ZH.UP_BY_ID.damage, 1);
assert.ok(price2 > ZH.UP_BY_ID.damage.price, 'second level costs more');

const many = Save.get().coins;
for (let i = 1; i < ZH.UP_BY_ID.damage.max; i++) Save.buyUpgrade('damage');
assert.strictEqual(Save.upgradeLevel('damage'), ZH.UP_BY_ID.damage.max, 'upgrade reaches cap');
assert.strictEqual(Save.buyUpgrade('damage').reason, 'max', 'cap cannot be exceeded');
assert.ok(Save.get().coins < many, 'coins were spent');

/* cannot overspend */
Save.reset();
Save.addCoins(100);
assert.strictEqual(Save.buyWeapon('sniper').ok, false, 'cannot afford the sniper');
assert.strictEqual(Save.buyWeapon('sniper').reason, 'coins');

/* progression */
Save.clearLevel(1, 250);
assert.strictEqual(Save.get().bestLevel, 2, 'mission 2 unlocks');
assert.ok(Save.get().coins >= 250, 'clear reward is banked');
Save.unlockWeapon('shotgun');
assert.ok(Save.hasWeapon('shotgun'), 'milestone weapon unlock');

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

console.log('storage.test.js ✓ coins, purchases, progression, records and persistence');
