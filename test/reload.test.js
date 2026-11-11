'use strict';
/* Ring reload: orbiting rounds, notch timing and the HOT MAG reward. */
const assert = require('assert');
const { ZH } = require('./_setup');

const R = ZH.RELOAD_RING;
assert.ok(R && R.window > 0, 'the ring has tuning');
assert.strictEqual(R.hotMul, 1.2, 'HOT MAG is +20% damage');
assert.strictEqual(R.hotTime, 5, 'HOT MAG lasts five seconds');

/* a 30-round magazine shows at most six pips */
const p = {};
const ring = ZH.startReloadRing(p, { name: 'gun', count: 30, time: 1 });
assert.ok(ring && ring.active, 'the ring starts active');
assert.strictEqual(ring.total, 6, 'pips cap at six');
assert.strictEqual(ring.pips.length, 6, 'one pip per seat');
assert.strictEqual(ring.time, 1, 'the window is carried through');

/* the orbit moves and the window eventually closes */
const before = ring.pips[0].a;
assert.strictEqual(ZH.tickReloadRing(p, 0.25), null, 'inside the window');
assert.notStrictEqual(ring.pips[0].a, before, 'pips orbit');
assert.strictEqual(ZH.tickReloadRing(p, 1), 'timeout', 'the ring times out');

/* a tap away from the notch is a miss and seats nothing */
const p2 = {};
ZH.startReloadRing(p2, { count: 6, time: 2 });
p2.reloadRing.pips.forEach(function (pip) { pip.a = 0; });
const miss = ZH.seatReloadRing(p2);
assert.strictEqual(miss.ok, false, 'a round away from the notch does not seat');
assert.strictEqual(p2.reloadRing.pips.length, 6, 'a miss keeps every round');

/* a round inside the notch seats exactly once */
p2.reloadRing.pips[0].a = -Math.PI / 2;
const hit = ZH.seatReloadRing(p2);
assert.strictEqual(hit.ok, true, 'a round in the notch seats');
assert.strictEqual(hit.seated, 1);
assert.strictEqual(hit.perfect, 1);
assert.strictEqual(p2.reloadRing.pips.length, 5, 'one round leaves the ring');

/* four of six perfect seats arm HOT MAG; three do not */
const hotState = {};
ZH.startReloadRing(hotState, { count: 6, time: 2 });
hotState.reloadRing.perfect = 4;
hotState.reloadRing.seated = 4;
hotState.reloadRing.pips = [];
assert.strictEqual(ZH.finishReloadRing(hotState).hot, true, '4/6 perfect seats arm HOT MAG');
assert.strictEqual(hotState.reloadRing, null, 'the ring is cleared');

const coldState = {};
ZH.startReloadRing(coldState, { count: 6, time: 2 });
coldState.reloadRing.perfect = 3;
assert.strictEqual(ZH.finishReloadRing(coldState).hot, false, '3/6 is not enough');

console.log('reload.test.js ✓ orbit, notch seats, timeout and HOT MAG threshold');
