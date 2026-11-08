'use strict';
/* Auto-aim: the Gun must answer visible zombies, from any direction, and must
   not fire (or spend a magazine round) when the street is empty. */
const assert = require('assert');
const { ZH } = require('./_setup');

function makeWorld(extra) {
  const w = {
    arena: { w: 1e9, h: 1e9 },
    player: ZH.createSurvivor({ x: 1000, y: 1000, weapon: 'gun' }),
    zombies: [], bullets: [], enemyBullets: [], pickups: [], particles: [],
    coins: 0, score: 0, shake: 0, t: 0
  };
  return Object.assign(w, extra || {});
}

/* 1. empty street: the trigger does not dry-fire or touch the magazine */
{
  const w = makeWorld();
  w.player.aimDir = 0;
  ZH.fireWeapon('gun', 1, w.player, w);
  assert.strictEqual(w.bullets.length, 0, 'no shot without a target');
  assert.strictEqual(w._shotFired, false, 'the caller is told nothing fired');
}

/* 2. a zombie straight up while the hunter faces right is acquired */
{
  const w = makeWorld();
  const p = w.player;
  p.aimDir = 0; p.facing = 1;
  const z = ZH.createEnemy('zombieA', 1000, 850, 1);
  w.zombies.push(z);
  for (let i = 0; i < 40 && !z.dead; i++) {
    ZH.fireWeapon('gun', 1, p, w);
    ZH.updateProjectiles(w.bullets, 1 / 60, w);
  }
  assert.ok(z.dead, 'the gun kills the off-axis zombie');
  assert.strictEqual(p.aimDir.toFixed(2), '-1.57', 'the arm and shot point at the zombie');
}

/* 3. a wide window: a zombie outside the old 460px circle is still acquired */
{
  const w = makeWorld({ W: 1920, H: 1080, camera: { zoom: 0.8 } });
  w.player.aimDir = 0;
  const z = ZH.createEnemy('zombieA', 1000 + 800, 1000, 1);
  w.zombies.push(z);
  ZH.fireWeapon('gun', 1, w.player, w);
  assert.strictEqual(w.bullets.length, 1, 'visible zombies are targeted');
  assert.ok(w.player.aimDir.toFixed(2) === '0.00', 'shot travels at the target');
  assert.ok(ZH.targetRange(ZH.WEAPONS.gun, w, 600) > 600, 'acquisition extends to the view');
}

/* 4. every auto-aim behaviour points at the body, not the last walk vector */
['gun', 'smg', 'crossbow', 'flamethrower', 'drill', 'bazooka', 'boomerang',
  'tesla', 'spikedball', 'launcher', 'molotov'].forEach((id) => {
  const w = makeWorld();
  const p = w.player;
  p.weapons = {};
  p.weapons[id] = { level: 1, timer: 0, mag: 99, reloading: 0 };
  p.aimDir = 0; p.facing = 1;
  const z = ZH.createEnemy('zombieA', 1000, 880, 1);
  w.zombies.push(z);
  ZH.fireWeapon(id, 1, p, w);
  assert.ok(Math.abs(p.aimDir + Math.PI / 2) < 0.05, id + ' aims at the zombie above');
});

console.log('aim.test.js ✓ guns acquire visible zombies and never dry-fire');
