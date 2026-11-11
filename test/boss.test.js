'use strict';
/* Boss parity: sealed-zone clear helper and the scripted attack patterns. */
const assert = require('assert');
const { ZH } = require('./_setup');

const T = ZH.BOSS_TYPES;
assert.ok(T.boss_tower.pattern, 'the tower has a scripted pattern');
assert.strictEqual(T.boss_tower.pattern.kind, 'ring');
assert.strictEqual(T.boss_tower.pattern.count, 12, 'the tower fires a 12-way ring');
assert.strictEqual(T.boss_soldier.pattern.kind, 'fan', 'the soldier fires a fan');
assert.strictEqual(T.boss_dragon.pattern.kind, 'stream');
assert.strictEqual(T.boss_dragon.pattern.count, 10, 'the dragon stream is ten shots');
assert.strictEqual(T.boss_reptile.pattern.kind, 'summon');
assert.strictEqual(T.boss_reptile.pattern.count, 3, 'the reptile summons three adds');
assert.strictEqual(ZH.ENEMY_TYPES.miniboss_tower.pattern.count, 8, 'the miniboss tower fires eight ways');
assert.strictEqual(ZH.ENEMY_TYPES.miniboss_soldier.pattern.count, 8, 'the miniboss soldier fires eight ways');

/* the boss zone clears normal bodies and leaves bosses standing */
const body = { boss: false }, boss = { boss: true };
const list = [body, boss, { boss: false }];
assert.strictEqual(ZH.clearNonBosses(list), 2, 'two normal bodies are cleared');
assert.strictEqual(list.length, 1, 'only the boss remains');
assert.strictEqual(list[0], boss, 'the boss itself is never removed');

function makeWorld() {
  const p = ZH.createSurvivor({ weapon: 'gun' });
  return {
    player: p, zombies: [], enemyBullets: [], pickups: [],
    particles: [], floaters: [], hazards: [], shake: 0, hurtT: 0
  };
}

/* tower: one volley is a full 12-way ring */
let w = makeWorld();
let p = w.player;
let b = ZH.createBoss('boss_tower', p.x + 120, p.y, null, 1);
b.cdT = 0;
w.zombies.push(b);
ZH.updateEnemies(w.zombies, 0.02, w);
assert.strictEqual(w.enemyBullets.length, 12, 'one tower volley is twelve rounds');

/* dragon: the stream emits its ten rounds over time */
w = makeWorld();
p = w.player;
b = ZH.createBoss('boss_dragon', p.x + 120, p.y, null, 1);
b.cdT = 0;
w.zombies.push(b);
for (let i = 0; i < 140; i++) ZH.updateEnemies(w.zombies, 1 / 60, w);
assert.ok(w.enemyBullets.length >= 10, 'the dragon stream fires ten rounds');

/* reptile: the summon pattern adds three bodies around the boss */
w = makeWorld();
p = w.player;
b = ZH.createBoss('boss_reptile', p.x + 120, p.y, null, 1);
b.cdT = 0;
w.zombies.push(b);
ZH.updateEnemies(w.zombies, 0.02, w);
assert.strictEqual(w.zombies.length, 4, 'boss plus three summoned reptiles');
assert.strictEqual(w.zombies.filter((z) => z.type === 'reptile').length, 3);

console.log('boss.test.js ✓ zone clear, tower ring, dragon stream and summons');
