'use strict';
/* GameSnacks parity: the eight original missions and the safehouse store.
   The reference tables are the extracted level dumps and the constants in
   zh_orig_assets/js_game.js. This test fails the build the moment the clone
   drifts from the original mission data. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ZH } = require('./_setup');

const ORIGINAL_DIR = path.join(__dirname, '..', 'zh_orig_assets', 'extracted_levels');
/* this build stores wave times in seconds; the original dumps are in ms */
const WAVE_FIELDS = (w, scale) => JSON.stringify({
  enemy: w.enemy || '',
  freq: w.freq || '',
  max: w.max || 0,
  total: w.total || 0,
  startTime: Math.round((w.startTime || 0) * scale),
  duration: Math.round((w.duration || 0) * scale),
  bosses: (w.bosses || []).map((b) => b.type).join(','),
  zone: w.bossZone ? (w.bossZone.width + 'x' + w.bossZone.height) : ''
});

for (let i = 0; i < 8; i++) {
  const original = JSON.parse(fs.readFileSync(path.join(ORIGINAL_DIR, 'level_' + (i + 1) + '_parsed.json'), 'utf8'));
  const stage = ZH.STAGES[i];
  const where = 'Stage ' + (i + 1);

  assert.ok(stage, where + ' exists');
  assert.strictEqual(stage.name.replace(/\s+/g, ''), original.name.replace(/\s+/g, ''),
    where + ' keeps the original mission name');
  assert.strictEqual(stage.bg, original.tile, where + ' uses the original map tile');
  assert.strictEqual(stage.map, original.image, where + ' uses the original map image');
  assert.strictEqual(stage.timeToTreasure, original.timeToTreasure / 1000,
    where + ' keeps the 15 s treasure timer');
  assert.strictEqual(stage.multiplier || 1, original.multiplier || 1,
    where + ' keeps the original health multiplier');
  assert.deepStrictEqual(stage.rewards, original.rewards, where + ' keeps the original rewards');

  const ours = stage.waves.map((w) => WAVE_FIELDS(w, 1000)).sort();
  const theirs = original.waves.map((w) => WAVE_FIELDS(w, 1)).sort();
  assert.deepStrictEqual(ours, theirs, where + ' has the exact original wave table');
}

/* ---------------- the safehouse store: six skills, 30 levels, same prices ---- */
const SKILL_PRICES = [0, 0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000,
  45000, 55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000,
  190000, 210000, 231000, 253000, 276000, 300000, 325000, 351000, 378000,
  406000, 435000];

assert.deepStrictEqual(ZH.SKILLS.map((s) => s.name),
  ['POWER', 'HEALTH', 'ARMOR', 'AID', 'FORTUNE', 'LEARNING'],
  'the store lists the original six skills, in the original order');
assert.strictEqual(ZH.MAX_PLAYER_SKILL, 30, '30 levels per skill');
for (let level = 0; level < SKILL_PRICES.length; level++) {
  assert.strictEqual(ZH.priceForSkill(level), SKILL_PRICES[level],
    'skill price at level ' + level + ' matches the original table');
}
const EXPECTED_VALUES = {
  POWER: [10, 10, 12, 16, 22, 30, 40, 52, 66, 82, 100, 120, 142, 166, 192, 220, 250, 282, 316, 352, 390, 430, 472, 516, 562, 610, 660, 712, 766, 822, 880],
  HEALTH: [100, 100, 110, 130, 160, 200, 250, 310, 380, 460, 550, 650, 760, 880, 1010, 1150, 1300, 1460, 1630, 1810, 2000, 2200, 2410, 2630, 2860, 3100, 3350, 3610, 3880, 4160, 4450],
  ARMOR: [0, 0, 0.1, 0.3, 0.6, 1, 1.5, 2.1, 2.8, 3.6, 4.5, 5.5, 6.6, 7.8, 9.1, 10.5, 12, 13.6, 15.3, 17.1, 19, 21, 23.1, 25.3, 27.6, 30, 32.5, 35.1, 37.8, 40.6, 43.5],
  AID: [25, 25, 30, 40, 55, 75, 100, 130, 165, 205, 250, 300, 355, 415, 480, 550, 625, 705, 790, 880, 975, 1075, 1180, 1290, 1405, 1525, 1650, 1780, 1915, 2055, 2200, 2350],
  FORTUNE: [0, 0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105, 120, 136, 153, 171, 190, 210, 231, 253, 276, 300, 325, 351, 378, 406, 435],
  LEARNING: [0, 0, 0.5, 1.5, 3, 5, 7.5, 10.5, 14, 18, 22.5, 27.5, 33, 39, 45.5, 52.5, 60, 68, 76.5, 85.5, 95, 105, 115.5, 126.5, 138, 150, 162.5, 175.5, 189, 203, 217.5, 232.5, 248, 264, 280.5, 297.5]
};
ZH.SKILLS.forEach((skill) => {
  const values = EXPECTED_VALUES[skill.name];
  assert.ok(values, skill.name + ' is an original skill');
  for (let level = 1; level <= 30; level++) {
    assert.strictEqual(ZH.skillValue(skill.id, level), values[level],
      skill.name + ' level ' + level + ' value');
  }
});

console.log('parity.test.js ✓ 8 original missions + the six-skill store match GameSnacks exactly');
