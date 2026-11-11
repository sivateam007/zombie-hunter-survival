'use strict';
/* Boss parity: step lists, telegraphed charge, teleport, egg mortar,
   the manager's destroyable briefcase and heavy-body shove. */
const assert = require('assert');
const { ZH } = require('./_setup');

const T = ZH.BOSS_TYPES;
assert.ok(Array.isArray(T.boss_mutant.behaviour), 'bosses run behaviour lists');
assert.ok(T.boss_reptile.behaviour.some((s) => s.kind === 'charge'), 'reptile charges');
assert.ok(T.boss_mutant.behaviour.some((s) => s.kind === 'charge'), 'mutant charges');
assert.ok(T.boss_mutant.behaviour.some((s) => s.kind === 'teleport'), 'mutant teleports');
assert.ok(T.boss_spider.behaviour.some((s) => s.kind === 'mortar'), 'spider lobs egg mortars');
assert.ok(T.boss_spider.behaviour.some((s) => s.kind === 'roam'), 'spider roams between attacks');
assert.ok(T.boss_spider.behaviour.some((s) => s.acid), 'spider fires a poison fan that leaves acid');
assert.ok(T.boss_soldier.behaviour.some((s) => s.volleys && s.volleys > 1), 'soldier fires a delayed second volley');
assert.ok(T.boss_soldier.behaviour.some((s) => s.kind === 'roam'), 'soldier roams between attacks');
assert.ok(T.boss_tower.behaviour.some((s) => s.kind === 'ring'), 'tower keeps its ring step');
assert.ok(T.boss_tower.behaviour.some((s) => s.kind === 'fan'), 'tower cycles a fan follow-up');
assert.ok(T.boss_dragon.behaviour.some((s) => s.kind === 'stream'), 'dragon keeps its stream step');
assert.ok(T.boss_reptile.behaviour.some((s) => s.kind === 'summon'), 'reptile keeps its summon step');
assert.strictEqual(T.boss_tower.pattern.count, 12, 'the signature tower ring is twelve ways');
assert.strictEqual(ZH.ENEMY_TYPES.miniboss_tower.pattern.count, 8, 'the miniboss tower fires eight ways');
assert.strictEqual(ZH.ENEMY_TYPES.miniboss_soldier.pattern.count, 8, 'the miniboss soldier fires eight ways');
assert.ok(ZH.ENEMY_TYPES.miniboss_fighter.mass === 5, 'minibosses carry mass 5');

/* the boss zone clears normal bodies and leaves bosses standing */
const body = { boss: false }, boss = { boss: true };
const list = [body, boss, { boss: false }];
assert.strictEqual(ZH.clearNonBosses(list), 2, 'two normal bodies are cleared');
assert.strictEqual(list.length, 1, 'only the boss remains');
assert.strictEqual(list[0], boss, 'the boss itself is never removed');

function makeWorld() {
  const p = ZH.createSurvivor({ weapon: 'gun' });
  return {
    arena: { w: 6144, h: 6144 },
    player: p, zombies: [], bullets: [], enemyBullets: [], pickups: [],
    particles: [], floaters: [], decals: [], hazards: [],
    briefcases: [], mortars: [], shake: 0, hurtT: 0,
    bossZoneActive: false, bossZoneRect: null
  };
}

/* tower: the first step is a full 12-way ring */
let w = makeWorld();
let p = w.player;
let b = ZH.createBoss('boss_tower', p.x + 120, p.y, null, 1);
w.zombies.push(b);
ZH.updateEnemies(w.zombies, 0.02, w);
assert.strictEqual(w.enemyBullets.length, 12, 'one tower volley is twelve rounds');

/* dragon: the stream emits its ten rounds over time */
w = makeWorld(); p = w.player;
b = ZH.createBoss('boss_dragon', p.x + 120, p.y, null, 1);
w.zombies.push(b);
for (let i = 0; i < 140; i++) ZH.updateEnemies(w.zombies, 1 / 60, w);
assert.ok(w.enemyBullets.length >= 10, 'the dragon stream fires ten rounds');

/* reptile: the summon step still adds four bodies after its charge sequence */
w = makeWorld(); p = w.player;
b = ZH.createBoss('boss_reptile', p.x + 120, p.y, null, 1);
b.step = 3; b.stepStarted = false;
w.zombies.push(b);
ZH.updateEnemies(w.zombies, 0.02, w);
assert.strictEqual(w.zombies.length, 5, 'boss plus four summoned reptiles');
assert.strictEqual(w.zombies.filter((z) => z.type === 'reptile').length, 4);

/* charge: windup telegraph, then a real dash, then recovery */
w = makeWorld(); p = w.player;
b = ZH.createBoss('boss_reptile', p.x + 300, p.y, null, 1);
b.step = 0; b.stepStarted = false;
w.zombies.push(b);
ZH.updateEnemies(w.zombies, 1 / 60, w);
assert.strictEqual(b.act.kind, 'charge');
assert.strictEqual(b.act.phase, 'windup', 'the charge starts with a windup');
const windupX = b.x;
for (let i = 0; i < 60 && b.act.phase === 'windup'; i++) {
  ZH.updateEnemies(w.zombies, 1 / 60, w);
}
assert.strictEqual(b.act.phase, 'dash', 'the windup becomes a dash');
assert.ok(Math.abs(b.x - windupX) < 1, 'no dash movement during the windup');
const dashX = b.x;
ZH.updateEnemies(w.zombies, 0.1, w);
assert.ok(Math.abs(b.x - dashX) > 20, 'the dash moves the boss');
assert.ok(w.chargeDashes >= 1, 'the dash is recorded');

/* teleport: a short disappearance and a reposition inside the fence */
w = makeWorld(); p = w.player;
w.bossZoneActive = true;
w.bossZoneRect = { x0: p.x - 500, x1: p.x + 500, y0: p.y - 500, y1: p.y + 500, w: 1000, h: 1000 };
b = ZH.createBoss('boss_mutant', p.x + 120, p.y, null, 1);
b.step = 1; b.stepStarted = false;
w.zombies.push(b);
const beforeTeleport = { x: b.x, y: b.y };
ZH.updateEnemies(w.zombies, 1 / 60, w);
assert.strictEqual(b.act.kind, 'teleport');
assert.strictEqual(b.act.phase, 'windup');
for (let i = 0; i < 60 && w.teleports !== 1; i++) {
  ZH.updateEnemies(w.zombies, 1 / 60, w);
}
assert.strictEqual(w.teleports, 1, 'the mutant teleports');
assert.ok(Math.hypot(b.x - beforeTeleport.x, b.y - beforeTeleport.y) > 50, 'it changes position');
assert.ok(b.x >= w.bossZoneRect.x0 && b.x <= w.bossZoneRect.x1, 'the teleport stays inside the fence');
assert.ok(b.y >= w.bossZoneRect.y0 && b.y <= w.bossZoneRect.y1, 'the teleport stays inside the fence vertically');

/* egg mortar: a marked landing spot, an arc, then a damaging explosion */
w = makeWorld(); p = w.player;
b = ZH.createBoss('boss_spider', p.x + 200, p.y, null, 1);
b.step = 0; b.stepStarted = false;
w.zombies.push(b);
ZH.updateEnemies(w.zombies, 1 / 60, w);
assert.strictEqual(w.mortars.length, 1, 'the spider launches an egg mortar');
const mortar = w.mortars[0];
assert.strictEqual(mortar.tx, p.x, 'the mortar is aimed at the hunter');
assert.ok(mortar.flight > 0.5, 'it has a flight time, so the marker is visible');
ZH.updateMortars(w, 0.45);
assert.strictEqual(w.mortars.length, 1, 'it is still in the air mid-flight');
assert.ok(p.hp === 100, 'it has not exploded yet');
ZH.updateMortars(w, 0.8);
assert.strictEqual(w.mortars.length, 0, 'it lands and is removed');
assert.strictEqual(w.mortarBooms, 1, 'the landing explodes');
assert.strictEqual(p.hp, 80, 'the teardown mortar hits for 20');

/* manager: the briefcase spawns, takes damage and can be destroyed */
w = makeWorld(); p = w.player;
let manager = ZH.createEnemy('manager', p.x + 80, p.y, 1);
w.zombies.push(manager);
ZH.damageEnemy(w, manager, manager.maxHp + 1);
assert.strictEqual(w.briefcases.length, 1, 'a manager death drops a briefcase');
const brief = w.briefcases[0];
brief.vx = 0; brief.vy = 0;
const briefHp = brief.hp;
w.bullets.push({ x: brief.x, y: brief.y, vx: 0, vy: 0, life: 1, dmg: 8, r: 5, enemy: false });
ZH.updateProjectiles(w.bullets, 1 / 60, w);
assert.ok(brief.hp < briefHp, 'a bullet damages the briefcase');
assert.strictEqual(w.briefcases.length, 1, 'it survives one hit');
w.bullets.push({ x: brief.x, y: brief.y, vx: 0, vy: 0, life: 1, dmg: 20, r: 5, enemy: false });
ZH.updateProjectiles(w.bullets, 1 / 60, w);
assert.strictEqual(w.briefcases.length, 0, 'enough damage destroys the briefcase');
assert.strictEqual(w.briefcaseBreaks, 1, 'the destruction is recorded');

/* an unshot briefcase hits for 10 */
w = makeWorld(); p = w.player;
manager = ZH.createEnemy('manager', p.x + 40, p.y, 1);
w.zombies.push(manager);
ZH.damageEnemy(w, manager, manager.maxHp + 1);
const contact = w.briefcases[0];
contact.x = p.x; contact.y = p.y;
ZH.updateBriefcases(w, 1 / 60);
assert.strictEqual(w.briefcases.length, 0, 'the briefcase is consumed on contact');
assert.ok(p.hp <= 90.01, 'it deals 10 damage');
assert.strictEqual(w.briefcaseHits, 1);

/* mass 5 bodies shove the hunter instead of only overlapping */
w = makeWorld(); p = w.player;
p.x = 500; p.y = 500;
const heavy = ZH.createEnemy('miniboss_fighter', p.x + 18, p.y, 1);
w.zombies.push(heavy);
const shoveFrom = p.x;
ZH.updateEnemies(w.zombies, 1 / 60, w);
assert.ok(p.x < shoveFrom, 'the heavy body pushes the hunter away');
assert.ok(w.shoveCount > 0, 'the shove is recorded');

console.log('boss.test.js ✓ lists, charge, teleport, mortar, briefcase and mass shove');
