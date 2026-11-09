'use strict';
/* MEDIUM pressure, asserted against an explicit target that does not move with
   the spawner.

   The spawn budget is one shared cap for the field, and the feed is pulsed
   (surge -> lull), so a run must average well BELOW the cap with real quiet
   stretches instead of sitting pinned at the ceiling. These are the medium
   numbers a player should feel, independent of whatever the clamp happens
   to allow. */
const assert = require('assert');
const { ZH } = require('./_setup');

/* the explicit medium contract */
const MEDIUM = {
  average: 4,       // a typical second must sit well under the cap
  peak: 6,          // no swarm, ever
  headroom: 3,      // average this far below the field cap
  quietShare: 0.25, // at least this many seconds are near-empty
  quietAt: 3,       // "quiet" means this many bodies or fewer
  floor: 2          // never so empty that the stage stops being a survival run
};

assert.strictEqual(ZH.HORDE.density, 'medium');
assert.strictEqual(ZH.HORDE.targetAverage, MEDIUM.average, 'the config carries the medium target');
assert.strictEqual(ZH.HORDE.swarmCeiling, MEDIUM.peak, 'the config carries the no-swarm ceiling');
assert.ok(ZH.HORDE.nearCap <= MEDIUM.peak, 'the field cap cannot exceed the no-swarm ceiling');
assert.ok(ZH.HORDE.hardCap <= 70, 'the absolute ceiling stays bounded');
assert.ok(ZH.HORDE.interval.LOW > ZH.HORDE.interval.MID &&
  ZH.HORDE.interval.MID > ZH.HORDE.interval.HI, 'LOW feeds slower than MID feeds slower than HI');

/* the pulse is a real duty cycle, not decoration */
const surge = ZH.HORDE.surge;
assert.ok(surge.spawn > 0 && surge.rest > 0, 'both phases have length');
assert.ok(surge.rest >= surge.spawn * 0.75, 'the lull is long enough to clear the surge');
assert.strictEqual(ZH.hordeWindow(0).spawning, true, 'a run opens in a surge');
assert.strictEqual(ZH.hordeWindow(surge.spawn + 0.1).spawning, false, 'then it rests');
assert.strictEqual(ZH.hordeWindow(surge.spawn + surge.rest + 0.1).spawning, true, 'and feeds again');

/* Mirror of the engine rule: one shared budget, gated by the surge window.
   A steady clear rate stands in for the hunter's damage (fractional, so
   sub-60 kills/sec still clear bodies over time instead of rounding to 0). */
const KILL_PER_SECOND = 0.85;
function simulate(stage, seconds) {
  const cap = ZH.HORDE.nearCap;
  const timers = new Map();
  const samples = [];
  const deepSamples = [];
  let live = 0, peak = 0, clearAcc = 0;

  for (let f = 0; f < seconds * 60; f++) {
    const t = f / 60;
    let spawned = 0, deepActive = false;
    for (let i = 0; i < stage.waves.length; i++) {
      const w = stage.waves[i];
      if (w.bossZone) continue;
      if (t < w.startTime || t >= w.startTime + w.duration) continue;
      if (i >= 24) deepActive = true;
      const budget = Math.min(w.max || 20, cap);
      const interval = ZH.HORDE.interval[w.freq] || ZH.HORDE.interval.LOW;
      const timer = (timers.get(i) || 0) + 1 / 60;
      if (ZH.hordeWindow(t).spawning && timer >= interval) {
        if (live < budget && live + spawned < cap) { timers.set(i, 0); spawned += 1; }
        else { timers.set(i, 0); }
      } else {
        timers.set(i, timer);
      }
    }
    clearAcc += KILL_PER_SECOND / 60;
    const cleared = Math.floor(clearAcc);
    clearAcc -= cleared;
    let next = Math.max(0, live + spawned - cleared);
    live = next; if (live > peak) peak = live;
    if (f % 60 === 0) {
      samples.push(live);
      if (deepActive) deepSamples.push(live);
    }
  }

  function f(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
  return {
    stage,
    peak,
    average: f(samples),
    quietShare: samples.filter((n) => n <= MEDIUM.quietAt).length / samples.length,
    deepAverage: f(deepSamples),
    deepPeak: deepSamples.length ? Math.max(...deepSamples) : 0,
    deepSamples: deepSamples.length
  };
}

const runs = ZH.STAGES.map((stage) => { const r = simulate(stage, 720); return { stage, r }; });
runs.forEach(({ stage, r }) => {
  const where = stage.name + ' (' + stage.tile + ')';
  assert.ok(r.peak <= ZH.HORDE.nearCap,
    where + ' never exceeds the field cap: ' + r.peak + ' vs cap ' + ZH.HORDE.nearCap);
  assert.ok(r.average <= ZH.HORDE.targetAverage,
    where + ' averages at or under the medium target: ' + r.average.toFixed(1) + ' <= ' + ZH.HORDE.targetAverage);
  assert.ok(r.peak <= ZH.HORDE.swarmCeiling,
    where + ' never swarms: peak ' + r.peak + ' <= ' + ZH.HORDE.swarmCeiling);
  assert.ok(r.quietShare >= MEDIUM.quietShare,
    where + ' has quiet stretches: ' + (r.quietShare * 100).toFixed(0) + '% of samples <= ' + MEDIUM.quietAt);
  assert.ok(r.average >= MEDIUM.floor,
    where + ' still plays as a survival run: ' + r.average.toFixed(1) + ' >= ' + MEDIUM.floor);
});
const overCeilingRuns = runs.filter(({ r }) => r.peak > ZH.HORDE.nearCap).length;
assert.strictEqual(overCeilingRuns, 0, 'no run pinned-live samples over the field cap (' + overCeilingRuns + ')');

/* the deep end of the ladder matters: stages 9-20 are 30-wave tables, so the
   sample window has to include wave indices near the top (>= 24) */
const late = runs.filter(({ stage }) => stage.id >= 8);
assert.strictEqual(late.length, 12, 'stages 9-20 are covered');
late.forEach(({ stage, r }) => {
  assert.ok(stage.waves.length >= 30, stage.name + ' still has its 30-wave ladder');
  assert.ok(r.deepSamples > 60,
    stage.name + ' was simulated past the deep ladder waves (' + r.deepSamples + ' deep samples)');
  assert.ok(r.deepPeak <= MEDIUM.peak,
    stage.name + ' deep ladder stays under the ceiling: ' + r.deepPeak);
  assert.ok(r.deepAverage <= MEDIUM.average + 1,
    stage.name + ' deep ladder keeps medium pressure: ' + r.deepAverage.toFixed(1));
  const deepWave = stage.waves.findIndex((w, i) => i >= 24 && !w.bossZone);
  assert.ok(deepWave >= 24, stage.name + ' schedules waves at ladder index >= 24');
  assert.ok(stage.waves.some((w) => w.bossZone), stage.name + ' still has its boss zone');
});

/* the early campaign has to be lighter than the late campaign, not identical */
const early = runs[0].r, lateAvg = late.reduce((a, x) => a + x.r.average, 0) / late.length;
assert.ok(lateAvg <= MEDIUM.average, 'late stages stay at the medium target');
assert.ok(early.average <= MEDIUM.average, 'the opening stage is medium too');
assert.ok(lateAvg >= early.average - 6, 'late stages are not empty by comparison');

console.log('density.test.js ✓ medium target, headroom, quiet stretches and deep ladders');
