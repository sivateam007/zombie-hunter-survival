'use strict';
const assert = require('assert');
const { ZH } = require('./_setup');

const themes = Object.keys(ZH.Arena.THEMES);

assert.strictEqual(ZH.LEVELS.length, 15, 'campaign has 15 missions');
assert.strictEqual(ZH.CHAPTERS.length, 4, 'four chapters');

const names = new Set();
ZH.LEVELS.forEach((level, index) => {
  assert.strictEqual(level.id, index + 1, 'level ids are sequential');
  assert.ok(level.name && level.name.length > 2, 'level ' + level.id + ' has a name');
  assert.ok(!names.has(level.name), 'level names are unique');
  names.add(level.name);
  assert.ok(themes.includes(level.theme), 'level ' + level.id + ' uses a known theme');
  assert.ok(level.chapter >= 1 && level.chapter <= 4, 'level ' + level.id + ' chapter');
  assert.ok(Array.isArray(level.waves) && level.waves.length >= 3, 'level ' + level.id + ' has waves');
  assert.ok(level.reward > 0, 'level ' + level.id + ' pays out');
  if (level.unlockWeapon) {
    assert.ok(ZH.WEAPONS[level.unlockWeapon], 'unlock weapon exists');
  }

  level.waves.forEach((wave, wi) => {
    if (wave.boss) {
      assert.ok(ZH.BOSSES[wave.boss], 'boss ' + wave.boss + ' is defined');
    }
    (wave.z || []).forEach(([type, count]) => {
      assert.ok(ZH.TYPES[type], 'level ' + level.id + ' wave ' + wi + ' type ' + type);
      assert.ok(count > 0 && count < 40, 'wave sizes stay sane');
    });
    assert.ok(typeof wave.delay === 'number' && wave.delay >= 0, 'wave delay');
  });
});

/* chapter bosses */
[4, 8, 12, 15].forEach((id) => {
  const level = ZH.LEVEL_BY_ID[id];
  assert.ok(level.boss, 'mission ' + id + ' is a boss mission');
  assert.ok(ZH.BOSSES[level.boss], 'mission ' + id + ' boss exists');
});

/* every boss has the stats the AI reads */
Object.keys(ZH.BOSSES).forEach((id) => {
  const b = ZH.BOSSES[id];
  ['hp', 'speed', 'dmg', 'atkRange', 'atkCd', 'coins', 'variant'].forEach((k) => {
    assert.ok(b[k] != null, 'boss ' + id + ' has ' + k);
  });
});

/* warden scales above the first boss */
assert.ok(ZH.BOSSES.warden.hp > ZH.BOSSES.rott.hp * 3, 'final boss is far tougher');

/* endless curve */
for (let n = 1; n <= 24; n++) {
  const wave = ZH.endlessWave(n);
  assert.strictEqual(wave.wave, n);
  assert.ok(wave.z.length > 0, 'endless wave ' + n + ' spawns something');
  const total = wave.z.reduce((sum, p) => sum + p[1], 0);
  assert.ok(total >= 4 && total <= 46, 'endless wave ' + n + ' population is bounded');
  assert.ok(wave.hpScale >= 1, 'endless hp scales up');
  if (n % 5 === 0) assert.ok(wave.boss, 'every fifth wave is a boss');
  else assert.ok(!wave.boss, 'no boss on wave ' + n);
}

/* weapons */
assert.ok(ZH.WEAPON_ORDER.length >= 5, 'arsenal has depth');
ZH.WEAPON_ORDER.forEach((id) => {
  const w = ZH.WEAPONS[id];
  assert.ok(w.dmg > 0 && w.rate > 0 && w.mag > 0 && w.reload > 0, id + ' has usable stats');
  const st = ZH.statsFor(id, { damage: 3, mag: 2, reload: 2 });
  assert.ok(st.dmg > w.dmg, id + ' damage upgrade applies');
  assert.ok(st.mag > w.mag, id + ' magazine upgrade applies');
  assert.ok(st.reload < w.reload, id + ' reload upgrade applies');
});

ZH.UPGRADES.forEach((u) => {
  assert.ok(u.max > 0 && u.price > 0, 'upgrade ' + u.id + ' is purchasable');
  assert.ok(ZH.priceFor(u, 0) >= u.price, 'first level costs the base price');
  assert.ok(ZH.priceFor(u, 2) > ZH.priceFor(u, 1), 'upgrade prices escalate');
});

console.log('levels.test.js ✓ campaign, bosses, endless curve and arsenal');
