/*
 * Zombie Hunter: Survival — save data
 * One JSON blob in localStorage. Everything degrades gracefully when
 * storage is unavailable (private mode, embedded webviews).
 */
window.ZH = window.ZH || {};
(function (ZH) {
  'use strict';

  var KEY = 'zhs.save.v1';
  var DEFAULTS = {
    version: 1,
    name: 'Hunter',
    coins: 0,
    bestLevel: 0,
    maxLevel: 6,
    weapons: ['gun'],
    currentWeapon: 'gun',
    difficulty: 'normal',
    // the original's six coin skills, each starting at level 1
    skills: { power: 1, health: 1, defense: 1, firstaid: 1, fortune: 1, learning: 1 },
    upgrades: {},
    stats: { kills: 0, shots: 0, deaths: 0, bestEndless: 0, endlessKills: 0, playTime: 0, levelsCleared: 0 },
    settings: { muted: false, shake: true, quality: 'high' },
    seenIntro: false
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      var data = JSON.parse(raw);
      var out = merge(clone(DEFAULTS), data);
      // the campaign size lives in levels.js; an old save cannot outvote it
      if (ZH.STAGES && ZH.STAGES.length) out.maxLevel = ZH.STAGES.length;
      return out;
    } catch (e) {
      return clone(DEFAULTS);
    }
  }

  function merge(base, data) {
    if (!data || typeof data !== 'object') return base;
    Object.keys(data).forEach(function (k) {
      if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k]) &&
        base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        base[k] = merge(base[k], data[k]);
      } else if (data[k] !== undefined) {
        base[k] = data[k];
      }
    });
    return base;
  }

  var save = read();
  var listeners = [];

  function persist() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(save));
    } catch (e) { /* ignore */ }
    listeners.forEach(function (fn) { try { fn(save); } catch (e) {} });
  }

  function get() { return save; }
  function onChange(fn) { listeners.push(fn); }

  function addCoins(n) {
    save.coins = Math.max(0, Math.round(save.coins + n));
    persist();
    return save.coins;
  }
  function spend(n) {
    if (save.coins < n) return false;
    save.coins -= n;
    persist();
    return true;
  }

  function unlockWeapon(id) {
    if (save.weapons.indexOf(id) === -1) {
      save.weapons.push(id);
      persist();
      return true;
    }
    return false;
  }

  function hasWeapon(id) { return save.weapons.indexOf(id) !== -1; }

  function clearLevel(id, coins) {
    save.bestLevel = Math.max(save.bestLevel, Math.min(save.maxLevel, id + 1));
    save.stats.levelsCleared++;
    if (coins) save.coins += Math.round(coins);
    persist();
  }

  /* ---- coin skills (the original's only shop: six skills, 30 levels) ---- */
  function skillLevel(id) { return (save.skills && save.skills[id]) || 1; }

  function buySkill(id) {
    var def = ZH.SKILL_BY_ID && ZH.SKILL_BY_ID[id];
    if (!def) return { ok: false, reason: 'unknown' };
    var lvl = skillLevel(id);
    var max = ZH.MAX_PLAYER_SKILL || 30;
    if (lvl >= max) return { ok: false, reason: 'max' };
    var price = ZH.priceForSkill(lvl);
    if (save.coins < price) return { ok: false, reason: 'coins', price: price };
    save.coins -= price;
    save.skills[id] = lvl + 1;
    persist();
    return { ok: true, level: lvl + 1, price: price };
  }

  /* weapons are not sold anywhere: the original hands them out as level-up
     cards. Kept so old call sites fail gracefully instead of throwing. */
  function buyWeapon() { return { ok: false, reason: 'shop' }; }

  function recordRun(result) {
    var s = save.stats;
    if (result.mode === 'endless') {
      s.bestEndless = Math.max(s.bestEndless, result.wave || 0);
      s.endlessKills = Math.max(s.endlessKills, result.kills || 0);
    } else {
      s.kills += result.kills || 0;
    }
    s.shots += result.shots || 0;
    s.deaths += result.died ? 1 : 0;
    s.playTime += result.time || 0;
    if (result.coins) save.coins += Math.round(result.coins);
    persist();
  }

  /* difficulty chosen on the deploy screen (normal / hard / insane) */
  function setDifficulty(id) {
    save.difficulty = id || 'normal';
    persist();
    return save.difficulty;
  }

  function setName(name) {
    save.name = String(name || 'Hunter').slice(0, 14).trim() || 'Hunter';
    persist();
  }

  function setSetting(k, v) {
    save.settings[k] = v;
    persist();
  }

  function reset() {
    save = clone(DEFAULTS);
    persist();
  }

  ZH.Save = {
    get: get,
    onChange: onChange,
    persist: persist,
    addCoins: addCoins,
    spend: spend,
    unlockWeapon: unlockWeapon,
    hasWeapon: hasWeapon,
    clearLevel: clearLevel,
    skillLevel: skillLevel,
    buySkill: buySkill,
    buyWeapon: buyWeapon,
    recordRun: recordRun,
    setDifficulty: setDifficulty,
    setName: setName,
    setSetting: setSetting,
    reset: reset,
    DEFAULTS: DEFAULTS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ZH.Save;
})(typeof window !== 'undefined' ? window.ZH || (window.ZH = {}) : {});
