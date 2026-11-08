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

/* 5. target lock: the engaged body stays the target while it is in range, so
   damage is not spread over the whole horde; a new closest zombie only wins
   when it is clearly (1.5x) closer, and death releases the lock */
{
  const w = makeWorld();
  const p = w.player;
  const engaged = ZH.createEnemy('zombieA', 1180, 1000, 1);
  const other = ZH.createEnemy('zombieA', 1300, 1000, 1);
  w.zombies.push(other, engaged);
  p._lock = engaged;
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(ZH.acquireTarget(w, p, 600), engaged,
      'the lock survives repeated acquisition while the body is alive');
  }
  engaged.dead = true;
  assert.strictEqual(ZH.acquireTarget(w, p, 600), other,
    'a dead target releases the lock to the next body');
}

/* 6. locks are per weapon: a short-range weapon must not clear the gun's
   target, which used to make every gun re-acquire from scratch each frame */
{
  const w = makeWorld();
  const p = w.player;
  const a = ZH.createEnemy('zombieA', 1200, 1000, 1);
  const b = ZH.createEnemy('zombieA', 1500, 1000, 1);
  w.zombies.push(a, b);
  assert.strictEqual(ZH.acquireTarget(w, p, 600, 'gun'), a, 'gun locks its own target');
  assert.strictEqual(ZH.acquireTarget(w, p, 100, 'melee'), null, 'melee has no target in reach');
  assert.strictEqual(ZH.acquireTarget(w, p, 600, 'gun'), a, 'melee range did not clear the gun lock');
  assert.ok(p._locks && p._locks.gun === a, 'the lock is stored per weapon');
}

/* 7. the endless city has negative coordinates: rounds fired in the top-left
   quadrant must travel, not be deleted at x/y = -200 (the old cull made the
   gun work at spawn but appear dead after walking up/left) */
{
  const spots = [[-600, -600], [-600, 512], [512, -600]];
  for (const [px, py] of spots) {
    const w = makeWorld();
    const p = w.player;
    p.x = px; p.y = py; p._lock = null; p._locks = {};
    const z = ZH.createEnemy('zombieA', px - 220, py - 40, 1);
    z.speed = 0;
    w.zombies.push(z);
    ZH.fireWeapon('gun', 1, p, w);
    assert.strictEqual(w.bullets.length, 1, 'round spawns at ' + px + ',' + py);
    for (let i = 0; i < 30 && w.bullets.length; i++) {
      ZH.updateProjectiles(w.bullets, 1 / 60, w);
    }
    assert.ok(z.dead, 'round reaches and kills at ' + px + ',' + py);
  }
}

console.log('aim.test.js ✓ guns acquire visible zombies and never dry-fire');
