/*
 * Meow Zombie Hunter — contracts and the idle coffer
 *
 * Rebuilt from the shipped GameSnacks bundle:
 *   • six slots: a daily patrol, three rolled contracts (tiers 1/2/3 with
 *     x2 / x4 rewards), and the 4- and 10-contract chains
 *   • the original's exact table (3,000 base; 6,000 / 12,000 for higher tiers)
 *   • rewards multiply by difficulty (normal x1, hard x1.5, insane x2.5)
 *   • three contracts refresh every 24 h; claimed slots are replaced
 *   • coffer: 25 coins per 15-minute segment, 672 segments (168 h) cap,
 *     16,800 coins total; a fresh save starts with the last 10 h missing
 *     (so 1,000 coins are already waiting), and claiming resets the clock
 *     to a full 168 h.
 *
 * Progress is written straight into the save blob, so contracts survive a
 * reload exactly like the original's ActiveMissions array.
 */
window.ZH = window.ZH || {};
(function (ZH) {
  'use strict';

  var T = ZH.MISSION_TYPES = {
    DAILY_LOGIN: 0,
    WATCH_AD: 1,          /* kept for parity: this build has no ad service */
    KILL_ENEMIES: 2,
    KILL_MINI_BOSSES: 3,
    KILL_BOSSES: 4,
    SURVIVE_X_MINUTES: 5,
    BUY_X_UPGRADES: 6,
    EARN_X_GOLD: 7,
    COLLECT_X_EXPS: 8,
    DEAL_X_DMG: 9,
    RECEIVE_X_DMG: 10,
    HEAL_X_PTS: 11,
    OPEN_X_CRATES: 12,
    COMPLETE_4_MISSIONS: 20,
    COMPLETE_10_MISSIONS: 21
  };

  var DAY_MS = 24 * 60 * 60 * 1000;
  var COFFER_SEGMENT_MINUTES = 15;
  var COFFER_SEGMENT_VALUE = 25;
  var COFFER_TOTAL_SEGMENTS = (60 / COFFER_SEGMENT_MINUTES) * 168;   /* 672 */
  var COFFER_TOTAL_VALUE = COFFER_TOTAL_SEGMENTS * COFFER_SEGMENT_VALUE;
  var COFFER_FULL_MS = 168 * 60 * 60 * 1000;
  var COFFER_START_MS = 158 * 60 * 60 * 1000;

  ZH.COFFER = {
    segmentMinutes: COFFER_SEGMENT_MINUTES,
    segmentValue: COFFER_SEGMENT_VALUE,
    totalSegments: COFFER_TOTAL_SEGMENTS,
    totalValue: COFFER_TOTAL_VALUE,
    fullMs: COFFER_FULL_MS,
    startMs: COFFER_START_MS
  };

  /* name, description and exact reward/target ladder per type */
  var SPECS = {
    0:  { name: 'DAILY PATROL',  desc: 'Report in for the daily patrol', reward: 2500, target: 1 },
    1:  { name: 'SUPPLY DROP',   desc: 'Watch a supply drop',            reward: 10000, target: 1 },
    2:  { name: 'EXTERMINATOR',  desc: 'Kill {target} zombies',          reward: 3000, target: 1000,
          tiers: { 2: [6000, 10000], 3: [12000, 100000] } },
    3:  { name: 'BREAKER',       desc: 'Kill {target} minibosses',       reward: 3000, target: 3,
          tiers: { 2: [6000, 7], 3: [12000, 15] } },
    4:  { name: 'GIANT KILLER',  desc: 'Kill {target} bosses',           reward: 3000, target: 1,
          tiers: { 2: [6000, 2], 3: [12000, 4] } },
    5:  { name: 'ENDURANCE',     desc: 'Survive {target} minutes',       reward: 3000, target: 4,
          tiers: { 2: [6000, 7], 3: [12000, 10] } },
    6:  { name: 'INVESTOR',      desc: 'Buy {target} permanent upgrades', reward: 3000, target: 2,
          tiers: { 2: [6000, 4], 3: [12000, 8] } },
    7:  { name: 'SCRAP RUNNER',  desc: 'Earn {target} scrap',            reward: 3000, target: 10000,
          tiers: { 2: [6000, 25000], 3: [12000, 75000] } },
    8:  { name: 'DATA MINER',    desc: 'Collect {target} XP',            reward: 3000, target: 100000,
          tiers: { 2: [6000, 1000000], 3: [12000, 10000000] } },
    9:  { name: 'PAIN DEALER',   desc: 'Deal {target} damage',           reward: 3000, target: 50000,
          tiers: { 2: [6000, 500000], 3: [12000, 5000000] } },
    10: { name: 'PUNCHING BAG',  desc: 'Take {target} damage',           reward: 3000, target: 500,
          tiers: { 2: [6000, 1200], 3: [12000, 2500] } },
    11: { name: 'FIELD MEDIC',   desc: 'Heal {target} HP',               reward: 3000, target: 250,
          tiers: { 2: [6000, 600], 3: [12000, 1250] } },
    12: { name: 'CRATE OPENER',  desc: 'Open {target} crates',           reward: 3000, target: 10,
          tiers: { 2: [6000, 25], 3: [12000, 75] } },
    20: { name: 'FIELD RECORD',  desc: 'Complete {target} contracts',    reward: 8000, target: 4 },
    21: { name: 'VETERAN',       desc: 'Complete {target} contracts',    reward: 15000, target: 10 }
  };

  var RANDOM_POOL = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  ZH.MISSION_TABLE = Object.keys(SPECS).map(function (type) {
    var s = SPECS[type];
    return { type: Number(type), name: s.name, reward: s.reward, target: s.target, tiers: s.tiers || {} };
  });

  function makeMission(type, tier) {
    var spec = SPECS[type];
    if (!spec) return null;
    var reward = spec.reward, target = spec.target;
    var over = tier && spec.tiers && spec.tiers[tier];
    if (over) { reward = over[0]; target = over[1]; }
    return {
      type: type,
      name: spec.name,
      tier: tier || 0,
      reward: reward,
      target: target,
      value: type === T.DAILY_LOGIN ? 1 : 0,
      claimed: false
    };
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  /* six slots, exactly like GenerateActiveMissions() */
  function generate() {
    var pool = shuffle(RANDOM_POOL.slice());
    var out = [makeMission(T.DAILY_LOGIN, 0)];
    for (var slot = 1; slot <= 3; slot++) out.push(makeMission(pool[slot - 1], slot));
    out.push(makeMission(T.COMPLETE_4_MISSIONS, 0));
    out.push(makeMission(T.COMPLETE_10_MISSIONS, 0));
    return out;
  }

  function dayStamp(now) {
    var d = new Date(now);
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }

  function ensure(now) {
    now = now || Date.now();
    var s = ZH.Save.get();
    var changed = false;

    if (!s.cofferTime || !isFinite(s.cofferTime)) {
      s.cofferTime = now + COFFER_START_MS;
      changed = true;
    }
    if (!s.missionsTime || !isFinite(s.missionsTime)) {
      s.missionsTime = now + DAY_MS;
      changed = true;
    }
    if (!Array.isArray(s.missions) || s.missions.length !== 6) {
      s.missions = generate();
      s.missionsTime = now + DAY_MS;
      s.missionsDone = s.missionsDone || 0;
      changed = true;
    }

    /* daily patrol: the original compares calendar days, not a 24 h timer */
    var today = dayStamp(now);
    if (s.loginDay !== today) {
      s.loginDay = today;
      var daily = s.missions[0];
      if (!daily || daily.type !== T.DAILY_LOGIN) daily = s.missions[0] = makeMission(T.DAILY_LOGIN, 0);
      daily.value = daily.target;
      daily.claimed = false;
      changed = true;
    }

    if (now >= s.missionsTime) {
      refresh(s, now);
      changed = true;
    }

    if (changed) ZH.Save.persist();
    return s;
  }

  /* replace claimed contracts, keep the ones still in progress — the
     original's RegenActiveMissions does the same on its 24 h tick */
  function refresh(s, now) {
    now = now || Date.now();
    var active = s.missions.slice(1, 4).map(function (m) { return m.type; });
    for (var i = 1; i <= 3; i++) {
      if (!s.missions[i] || s.missions[i].claimed) {
        var pool = RANDOM_POOL.filter(function (t) { return active.indexOf(t) === -1; });
        if (!pool.length) pool = RANDOM_POOL.slice();
        var pick = pool[Math.floor(Math.random() * pool.length)];
        s.missions[i] = makeMission(pick, i);
        active[i - 1] = pick;
      }
    }
    if (s.missions[4] && s.missions[4].claimed) s.missions[4] = makeMission(T.COMPLETE_4_MISSIONS, 0);
    if (s.missions[5] && s.missions[5].claimed) s.missions[5] = makeMission(T.COMPLETE_10_MISSIONS, 0);
    s.missionsTime = now + DAY_MS;
  }

  var lastFlush = 0;
  function flush() {
    var now = Date.now();
    if (now - lastFlush < 800) return;
    lastFlush = now;
    ZH.Save.persist();
  }

  /* advance every matching contract; `data` is reserved for per-enemy
     missions in the original and is not used by our tracked types */
  function update(type, amount, data) {
    if (!amount || !isFinite(amount)) return [];
    var s = ensure();
    var hits = [];
    s.missions.forEach(function (m) {
      if (!m || m.claimed || m.value >= m.target || m.type !== type) return;
      if (data != null && m.data != null && m.data !== data) return;
      if (type === T.SURVIVE_X_MINUTES) {
        if (amount > m.value) m.value = Math.min(m.target, amount);
      } else {
        m.value = Math.min(m.target, m.value + amount);
      }
      if (m.value >= m.target) hits.push(m);
    });
    if (hits.length || amount) flush();
    return hits;
  }

  function difficultyMultiplier(s) {
    if (ZH.difficulty) {
      var d = ZH.difficulty(s.difficulty);
      if (d && d.reward) return d.reward;
    }
    /* missions.js must not require game.js: keep the same three steps here */
    return s.difficulty === 'insane' ? 2.5 : s.difficulty === 'hard' ? 1.5 : 1;
  }

  function claim(index, now) {
    now = now || Date.now();
    var s = ensure(now);
    var m = s.missions[index];
    if (!m) return { ok: false, reason: 'missing' };
    if (m.claimed) return { ok: false, reason: 'claimed' };
    if (m.value < m.target) return { ok: false, reason: 'incomplete' };

    var coins = Math.round(m.reward * difficultyMultiplier(s));
    m.claimed = true;

    /* every non-chain claim feeds the 4- and 10-contract chains */
    if (m.type < 20) {
      s.missionsDone = (s.missionsDone || 0) + 1;
      s.missions.forEach(function (c) {
        if (c.type === T.COMPLETE_4_MISSIONS || c.type === T.COMPLETE_10_MISSIONS) {
          if (!c.claimed) c.value = Math.min(c.target, s.missionsDone);
        }
      });
      if (index >= 1 && index <= 3) {
        /* the slot keeps its CLAIMED stamp until the daily refresh */
      }
    }

    ZH.Save.addCoins(coins);
    ZH.Save.persist();
    return { ok: true, coins: coins, mission: m };
  }

  /* ------------------------------ coffer ------------------------------ */

  function cofferState(now) {
    now = now || Date.now();
    var s = ZH.Save.get();
    var end = s.cofferTime;
    if (!end || !isFinite(end)) { end = now + COFFER_START_MS; }
    var left = Math.max(0, end - now);
    var segments = COFFER_TOTAL_SEGMENTS - Math.ceil(left / (COFFER_SEGMENT_MINUTES * 60000));
    segments = Math.max(0, Math.min(COFFER_TOTAL_SEGMENTS, segments));
    return {
      value: segments * COFFER_SEGMENT_VALUE,
      segments: segments,
      total: COFFER_TOTAL_VALUE,
      full: segments >= COFFER_TOTAL_SEGMENTS,
      leftMs: left,
      nextMs: left % (COFFER_SEGMENT_MINUTES * 60000)
    };
  }

  function cofferValue(now) { return cofferState(now).value; }

  function claimCoffer(now) {
    now = now || Date.now();
    var s = ensure(now);
    var st = cofferState(now);
    if (!st.value) return { ok: false, reason: 'empty', value: 0 };
    s.cofferTime = now + COFFER_FULL_MS;
    ZH.Save.addCoins(st.value);
    ZH.Save.persist();
    return { ok: true, coins: st.value };
  }

  ZH.Missions = {
    Types: T,
    spec: SPECS,
    generate: generate,
    ensure: ensure,
    refresh: refresh,
    update: update,
    claim: claim,
    cofferState: cofferState,
    cofferValue: cofferValue,
    claimCoffer: claimCoffer,
    makeMission: makeMission,
    DAY_MS: DAY_MS
  };
})(window.ZH);
