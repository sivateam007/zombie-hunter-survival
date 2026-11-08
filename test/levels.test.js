'use strict';
/* The campaign ships 12 stages with their wave tables, boss zones and the    20-weapon catalogue. */
const assert = require('assert');
const { ZH } = require('./_setup');

const themes = Object.keys(ZH.Arena.THEMES);
const MULTIPLIERS = [1, 1.5, 2.25, 3.5, 4.75, 7.61, 17.09, 11.42, 13.5, 18.4, 24.6, 31.2];

assert.strictEqual(ZH.STAGES.length, 12, 'the campaign has twelve stages');
assert.strictEqual(ZH.LEVELS, ZH.STAGES, 'ZH.LEVELS aliases the stage table');
assert.strictEqual(ZH.TIME_LEVEL_COMPLETED, 1200, 'a stage is won at 20 minutes');

ZH.STAGES.forEach((stage, i) => {
  assert.strictEqual(stage.id, i, 'stage ids are 0-based and sequential');
  assert.strictEqual(stage.name, 'Stage ' + (i + 1), 'stage name matches the build');
  assert.strictEqual(stage.bg, 'bg' + (i + 1), 'stage uses the original map tile');
  assert.strictEqual(stage.map, 'map_lv' + (i + 1) + '.png', 'original map image');
  assert.strictEqual(stage.multiplier, MULTIPLIERS[i], 'stage multiplier');
  assert.strictEqual(stage.timeToTreasure, 15, 'treasure chest at 15 s');
  assert.ok(themes.includes(stage.tile), 'stage ' + stage.id + ' uses a known theme');
  assert.strictEqual(stage.rewards.length, 3, 'three reward tiers');
  assert.ok(stage.rewards[0] < stage.rewards[2], 'rewards escalate');
  assert.ok(stage.waves.length >= 30, 'stage ' + stage.id + ' has the full wave list');
});

/* exact reward tables, straight from the extracted level data */
assert.deepStrictEqual(ZH.STAGES.map((s) => s.rewards), [
  [1000, 1500, 2500],
  [2000, 3000, 5000],
  [3000, 4500, 7500],
  [4000, 6000, 10000],
  [5000, 7500, 12500],
  [6000, 9000, 15000],
  [8000, 12000, 20000],
  [8000, 16000, 24000],
  [9000, 18000, 30000],
  [10000, 20000, 34000],
  [12000, 24000, 40000],
  [14000, 28000, 46000]
], 'rewards scale with the campaign');

/* every wave reference resolves, and the timings are seconds, not ms */
ZH.STAGES.forEach((stage) => {
  stage.waves.forEach((wave, wi) => {
    const where = stage.name + ' wave ' + wi;
    if (wave.enemy) assert.ok(ZH.ENEMY_TYPES[wave.enemy], where + ': ' + wave.enemy + ' exists');
    if (wave.bosses) {
      assert.ok(wave.bossZone && wave.bossZone.type === 'rect', where + ' has a rect boss zone');
      wave.bosses.forEach((b) => assert.ok(ZH.BOSS_TYPES[b.type], where + ': boss ' + b.type));
    }
    assert.ok(wave.startTime >= 0 && wave.startTime <= 630, where + ' start time in seconds');
    assert.ok(wave.duration > 0 && wave.duration <= 300, where + ' duration in seconds');
    if (wave.freq) assert.ok(['LOW', 'MID', 'HI'].includes(wave.freq), where + ' frequency');
  });
});

/* stage one: the two bosses and the minibosses the original schedules */
const s1 = ZH.STAGES[0];
const bosses = s1.waves.filter((w) => w.bosses).map((w) => w.bosses[0].type);
assert.deepStrictEqual(bosses.sort(), ['boss_soldier', 'boss_tower'], 'stage 1 bosses');
assert.deepStrictEqual(s1.waves.filter((w) => w.bossZone).map((w) => w.bossZone.width),
  [1200, 1200], 'stage 1 boss zones are 1200x1200');

/* bosses shrink later in the campaign, exactly as extracted */
assert.strictEqual(ZH.STAGES[5].waves.filter((w) => w.bossZone)[0].bossZone.width, 1024);

/* the full enemy roster the waves need is present */
['zombieA', 'zombieB', 'zombieC', 'zombieD', 'builder', 'reptile', 'bat', 'cop', 'manager',
  'spider1', 'spider2', 'toxic1', 'toxic2', 'slime1', 'slime2', 'slug', 'tower1', 'tower2',
  'assault1', 'assault2', 'miniboss_builder', 'miniboss_reptile', 'miniboss_fighter',
  'miniboss_spider', 'miniboss_toxic1', 'miniboss_toxic2', 'miniboss_soldier',
  'miniboss_tower'].forEach((t) => {
  assert.ok(ZH.ENEMY_TYPES[t], 'enemy ' + t + ' defined');
  assert.ok(ZH.ENEMY_TYPES[t].hp > 0 && ZH.ENEMY_TYPES[t].name, t + ' has hp and a name');
});

/* ---------------- weapons: 20 base + 20 evolutions ---------------- */
assert.strictEqual(ZH.WEAPON_ORDER.length, 20, 'the catalogue has 20 base weapons');
assert.deepStrictEqual(ZH.WEAPON_ORDER, ['axe', 'crossbow', 'flamethrower', 'gun', 'sword', 'drill',
  'bazooka', 'rocketlauncher', 'grenadelauncher', 'boomerang', 'circular', 'tesla', 'spikedball',
  'forcefield', 'launcher', 'molotov', 'smg', 'grenade', 'sniper', 'katana'],
'the 20 weapons, in catalogue order');

const evolutions = [];
ZH.WEAPON_ORDER.forEach((id) => {
  const w = ZH.WEAPONS[id];
  assert.ok(w.dmg > 0 && w.cooldown > 0, id + ' has usable stats');
  assert.ok(ZH.WEAPONS[w.evo], id + ' evolves into a real weapon (' + w.evo + ')');
  assert.ok(ZH.SUPPLIES[w.supply], id + ' evolves via a real supply (' + w.supply + ')');
  assert.ok(ZH.supplyEvolves(w.supply, id), id + ' is evolved by ' + w.supply);
  // level 5 without the supply keeps the base gun
  assert.strictEqual(ZH.effectiveWeapon(id, { level: 6 }, {}), id, id + ' needs the supply');
  assert.strictEqual(ZH.effectiveWeapon(id, { level: 6 }, { [w.supply]: 1 }), w.evo,
    id + ' evolves at level 6 with the supply');
  evolutions.push(w.evo);
});
assert.strictEqual(new Set(evolutions).size, 20, 'every base weapon has its own evolution');

/* ---------------- supplies ---------------- */
assert.strictEqual(ZH.SUPPLY_IDS.length, 14, '14 supplies incl. the two pickups');
const passive = ZH.SUPPLY_IDS.filter((id) => !ZH.SUPPLIES[id].consumable);
assert.strictEqual(passive.length, 12, '12 passive supplies evolve weapons');
passive.forEach((id) => {
  const s = ZH.SUPPLIES[id];
  assert.strictEqual(s.bonus.length, 6, id + ' has five levels of bonus');
  assert.ok(!ZH.supplyDesc(id, 1).includes('[x]'), id + ' description is filled in');
});
assert.strictEqual(ZH.attribsFrom({ kevlar: 1 }).defense, 10, 'kevlar level 1 gives 10 defense');
assert.strictEqual(ZH.attribsFrom({ supplements: 5 }).attack_bonus, 1, 'supplements lvl 5 = +100%');

/* ---------------- coin skills ---------------- */
assert.strictEqual(ZH.SKILLS.length, 6, 'six permanent skills');
assert.deepStrictEqual(ZH.SKILLS.map((s) => s.name),
  ['POWER', 'HEALTH', 'ARMOR', 'AID', 'FORTUNE', 'LEARNING'], 'skill names');
assert.strictEqual(ZH.MAX_PLAYER_SKILL, 30, '30 levels each');
assert.strictEqual(ZH.skillValue('power', 1), 10, 'base attack');
assert.strictEqual(ZH.skillValue('health', 1), 100, 'base health');
assert.strictEqual(ZH.skillValue('power', 30), 880, 'top attack');
assert.strictEqual(ZH.priceForSkill(1), 0, 'the first level is free');
assert.strictEqual(ZH.priceForSkill(2), 1000, 'then 1,000');
assert.strictEqual(ZH.priceForSkill(30), 435000, 'top price 435,000');

console.log('levels.test.js ✓ twelve stages, 20 weapons, 14 supplies, six coin skills');
