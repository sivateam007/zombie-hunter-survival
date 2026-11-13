'use strict';
/* Horde pressure, asserted against an explicit contract that does not move with
   the spawner.

   Two rules now hold at once:
     • the opening is MEDIUM — a pulsed, readable field that never swarms;
     • the pressure RAMPS with the run clock — later waves are fed faster and
       are allowed more bodies at once than the opening ones.
   The budget is one shared cap for the field, so overlapping wave ladders can
   never multiply it. */
const assert = require('assert');
const { ZH } = require('./_setup');

/* the explicit opening contract */
const OPENING = {
  average: 7,       // the denser opening still sits under its cap
  peak: 9,          // a readable opening, not an instant swarm
  quietShare: 0.2,  // the lull still returns for part of every cycle
  quietAt: 6,       // "quiet" means this many bodies or fewer at the new scale
  floor: 2          // never so empty that the stage stops being a survival run
};

assert.strictEqual(ZH.HORDE.density, 'medium');
assert.strictEqual(ZH.HORDE.targetAverage, OPENING.average, 'the config carries the opening target');
assert.strictEqual(ZH.HORDE.swarmCeiling, OPENING.peak, 'the config carries the no-swarm ceiling');
assert.ok(ZH.HORDE.nearCap <= OPENING.peak, 'the opening field cap cannot exceed the no-swarm ceiling');
assert.ok(ZH.HORDE.hardCap <= 70, 'the absolute ceiling stays bounded');
assert.ok(ZH.HORDE.interval.LOW > ZH.HORDE.interval.MID &&
  ZH.HORDE.interval.MID > ZH.HORDE.interval.HI, 'LOW feeds slower than MID feeds slower than HI');

/* ---------------------------- the ramp ---------------------------- */
const ramp = ZH.HORDE.ramp;
assert.ok(Array.isArray(ramp) && ramp.length >= 4, 'the ramp carries several stops');
const open = ZH.hordeBudget(0);
assert.strictEqual(open.near, ZH.HORDE.nearCap, 'the run opens at the medium field cap');
assert.strictEqual(open.hard, ZH.HORDE.hardCap, 'the run opens at the medium ceiling');
assert.strictEqual(open.feed, 1, 'the opening feed is the authored cadence');
assert.strictEqual(open.wave, 1, 'the opening waves are not boosted');

for (let i = 1; i < ramp.length; i++) {
  assert.ok(ramp[i].at > ramp[i - 1].at, 'ramp stops advance in time');
  assert.ok(ramp[i].near >= ramp[i - 1].near, 'the field cap never shrinks');
  assert.ok(ramp[i].hard >= ramp[i - 1].hard, 'the absolute ceiling never shrinks');
  assert.ok(ramp[i].feed <= ramp[i - 1].feed, 'the feed only gets faster');
  assert.ok(ramp[i].wave >= ramp[i - 1].wave, 'waves only feed more bodies');
}
const last = ramp[ramp.length - 1];
const ending = ZH.hordeBudget(last.at);
assert.ok(ending.near >= ZH.HORDE.nearCap * 3,
  'the late field is at least 3x the opening cap: ' + ending.near.toFixed(1));
assert.ok(ending.hard <= 120, 'the absolute ceiling stays bounded: ' + ending.hard);
assert.ok(ending.feed <= 0.6, 'the late feed is at least 40% faster: ' + ending.feed);
assert.ok(ending.wave >= 1.7, 'late waves feed ~2x as many bodies: ' + ending.wave);
assert.strictEqual(ZH.hordeBudget(last.at + 5000).near, ending.near, 'the ramp clamps after its last stop');

const t120 = ZH.hordeBudget(120), t600 = ZH.hordeBudget(600);
assert.ok(t600.near > t120.near, 'pressure grows through the middle of a run');
assert.ok(t600.feed < t120.feed, 'the feed tightens through the middle of a run');
assert.ok(ZH.hordeBudget(60).near >= open.near, 'the ramp never dips below the opening');

/* the pulse is a real duty cycle, not decoration */
const surge = ZH.HORDE.surge;
assert.ok(surge.spawn > 0 && surge.rest > 0, 'both phases have length');
assert.ok(surge.rest >= surge.spawn * 0.75, 'the lull is long enough to clear the surge');
assert.strictEqual(ZH.hordeWindow(0).spawning, true, 'a run opens in a surge');
assert.strictEqual(ZH.hordeWindow(surge.spawn + 0.1).spawning, false, 'then it rests');
assert.strictEqual(ZH.hordeWindow(surge.spawn + surge.rest + 0.1).spawning, true, 'and feeds again');

/* Mirror of the engine rule: one shared budget per frame, gated by the surge
   window, with the cap and the cadence read from ZH.hordeBudget(t). A steady
   clear rate stands in for the hunter's damage (fractional, so sub-60
   kills/sec still clear bodies over time instead of rounding to 0). */
const KILL_PER_SECOND = 0.85;
function simulate(stage, seconds) {
  const timers = new Map();
  const samples = [];
  let live = 0, peak = 0, clearAcc = 0;

  /* Mirror Game.recycleWaves: once every ladder window is spent the engine
     re-arms them, staggered. Without this the simulated run goes empty after
     the authored ~500 s ladder and late pressure cannot be measured. */
  const starts = stage.waves.map((w) => w.startTime);
  let cycle = 0;
  function anyWindow(t) {
    for (let i = 0; i < stage.waves.length; i++) {
      const w = stage.waves[i];
      if (w.bossZone) continue;
      if (t >= starts[i] && t < starts[i] + w.duration) return true;
    }
    return false;
  }
  function anyPending(t) {
    for (let i = 0; i < stage.waves.length; i++) {
      const w = stage.waves[i];
      if (w.bossZone) continue;
      if (t < starts[i]) return true;
    }
    return false;
  }
  function recycle(t) {
    cycle += 1;
    for (let i = 0; i < stage.waves.length; i++) {
      const w = stage.waves[i];
      if (w.bossZone) continue;
      starts[i] = t + (i % 12) * 3.5;
      timers.set(i, 0);
    }
  }

  for (let f = 0; f < seconds * 60; f++) {
    const t = f / 60;
    if (f % 30 === 0 && !anyWindow(t) && !anyPending(t)) recycle(t);
    const budget = ZH.hordeBudget(t);
    let spawned = 0;
    for (let i = 0; i < stage.waves.length; i++) {
      const w = stage.waves[i];
      if (w.bossZone) continue;
      if (t < starts[i] || t >= starts[i] + w.duration) continue;
      const cap = Math.min(Math.round((w.max || 20) * budget.wave), budget.near);
      const interval = (ZH.HORDE.interval[w.freq] || ZH.HORDE.interval.LOW) * budget.feed;
      const timer = (timers.get(i) || 0) + 1 / 60;
      if (ZH.hordeWindow(t).spawning && timer >= interval) {
        timers.set(i, 0);
        if (live + spawned + 1 <= cap && live + spawned + 1 <= budget.near) spawned += 1;
      } else {
        timers.set(i, timer);
      }
    }
    clearAcc += KILL_PER_SECOND / 60;
    const cleared = Math.floor(clearAcc);
    clearAcc -= cleared;
    live = Math.max(0, live + spawned - cleared);
    if (live > peak) peak = live;
    if (f % 60 === 0) samples.push({ t, live, near: budget.near });
  }

  const avg = (list) => list.length ? list.reduce((a, s) => a + s.live, 0) / list.length : 0;
  const early = samples.filter((s) => s.t < 120);
  const late = samples.filter((s) => s.t >= 600);
  return {
    stage,
    cycle,
    peak,
    average: avg(samples),
    earlyAverage: avg(early),
    earlyPeak: early.length ? Math.max(...early.map((s) => s.live)) : 0,
    quietShare: samples.filter((s) => s.live <= OPENING.quietAt).length / Math.max(1, samples.length),
    quietShareEarly: early.filter((s) => s.live <= OPENING.quietAt).length / Math.max(1, early.length),
    lateAverage: avg(late),
    latePeak: late.length ? Math.max(...late.map((s) => s.live)) : 0,
    lateSamples: late.length,
    overBudget: samples.filter((s) => s.live > s.near + 0.001).length
  };
}

const runs = ZH.STAGES.map((stage) => ({ stage, r: simulate(stage, 720) }));

runs.forEach(({ stage, r }) => {
  const where = stage.name + ' (' + stage.tile + ')';
  assert.strictEqual(r.overBudget, 0, where + ' never exceeds the live field budget');
  assert.ok(r.peak <= ZH.hordeBudget(720).near,
    where + ' peaks inside the late budget: ' + r.peak + ' vs ' + ZH.hordeBudget(720).near);
  assert.ok(r.earlyPeak <= OPENING.peak,
    where + ' opens without a swarm: peak ' + r.earlyPeak + ' <= ' + OPENING.peak);
  assert.ok(r.earlyAverage <= OPENING.average + 1,
    where + ' opens at the medium target: ' + r.earlyAverage.toFixed(1));
  /* the lull is part of the design: the opening two minutes (the window the
     medium contract covers) must have seconds with almost nothing on the
     street. Once the ramp raises the field cap the street legitimately stays
     busier, so this is measured where the contract applies. */
  assert.ok(r.average >= OPENING.floor - 1,
    where + ' keeps the street alive: ' + r.average.toFixed(1));
  assert.ok(r.average <= ZH.hordeBudget(720).near,
    where + ' sits under the late cap on average: ' + r.average.toFixed(1));
  assert.ok(r.quietShareEarly >= OPENING.quietShare,
    where + ' opens with lulls: ' + (r.quietShareEarly * 100).toFixed(0) + '% of the opening seconds <= ' + OPENING.quietAt);
  assert.ok(r.earlyAverage >= OPENING.floor - 1,
    where + ' still plays as a survival run: ' + r.earlyAverage.toFixed(1));
});

/* the deep end of the ladder matters: stages 9-20 are 30-wave tables, so the
   late window has to include stacked waves */
const late = runs.filter(({ stage }) => stage.id >= 8);
assert.strictEqual(late.length, 12, 'stages 9-20 are covered');
late.forEach(({ stage, r }) => {
  assert.ok(stage.waves.length >= 30, stage.name + ' still has its 30-wave ladder');
  assert.ok(r.lateSamples > 100,
    stage.name + ' was simulated past the deep ladder waves (' + r.lateSamples + ' late samples)');
  assert.ok(r.latePeak > r.earlyPeak,
    stage.name + ' gets denser as the run goes: ' + r.latePeak + ' vs ' + r.earlyPeak);
  assert.ok(r.lateAverage >= r.earlyAverage + 4,
    stage.name + ' late pressure is measurably higher: ' + r.lateAverage.toFixed(1) +
    ' vs ' + r.earlyAverage.toFixed(1));
  assert.ok(r.lateAverage <= ZH.hordeBudget(600).near,
    stage.name + ' late average stays inside the late cap: ' + r.lateAverage.toFixed(1));
  const deepWave = stage.waves.findIndex((w, i) => i >= 24 && !w.bossZone);
  assert.ok(deepWave >= 24, stage.name + ' schedules waves at ladder index >= 24');
  assert.ok(stage.waves.some((w) => w.bossZone), stage.name + ' still has its boss zone');
});

console.log('density.test.js ✓ denser opening, ramp growth, quiet stretches and deep ladders');
