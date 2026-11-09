/*
 * Meow Zombie Hunter — save data
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
    /* safehouse roster: the first survivor is free, the rest are bought */
    characters: ['hunter'],
    character: 'hunter',
    redeemed: [],
    lastDaily: '',
    seenIntro: false
  };

  /* ---------------------------- survivors ----------------------------
     The rig already knows how to draw a hunter; these are colour palettes
     plus small stat perks. `hp`, `speed`, `damage` and `scrap` are
     multipliers applied once at the start of a run. */
  ZH.CHARACTERS = ZH.CHARACTERS || [
    { id: 'hunter',  name: 'ASH HUNTER',  tag: 'BALANCED',           desc: 'The last ranger. No bonus, no penalty.', price: 0,    hp: 1,    speed: 1,    damage: 1,    scrap: 1,    coat: '#33402f', accent: '#c0472f' },
    { id: 'meow',    name: 'MEOW HUNTER', tag: 'LIFE DISCHARGE',     desc: 'Cat ears, nine lives. Every hit siphons vitality back.', price: 0, hp: 1, speed: 1.06, damage: 1, scrap: 1, free: true, coat: '#3a3348', accent: '#ff8fd0' },
    { id: 'ninja',   name: 'SILENT NINJA', tag: '+22% MOVE SPEED',     desc: 'Fastest boots in the city. Never gets surrounded.', price: 4200, hp: 0.9, speed: 1.22, damage: 1, scrap: 1, coat: '#22262e', accent: '#7dffd4' },
    { id: 'titan',   name: 'IRON TITAN',   tag: '+45% MAX VITALS',     desc: 'Slow, enormous, impossible to bite down.', price: 6400, hp: 1.45, speed: 0.92, damage: 1.05, scrap: 1, coat: '#3b3430', accent: '#ffb347' },
    { id: 'ranger',  name: 'DUNE RANGER', tag: '+12% MOVE SPEED',    desc: 'Long strides. Slips through alleys fast.', price: 1500, hp: 1,    speed: 1.12, damage: 1,    scrap: 1,    coat: '#3d4a2a', accent: '#d7a13a' },
    { id: 'medic',   name: 'FIELD MEDIC', tag: '+25% MAX VITALS',    desc: 'A bigger health pool for the long waves.', price: 2600, hp: 1.25, speed: 1,    damage: 1,    scrap: 1,    coat: '#2b4548', accent: '#58d6c0' },
    { id: 'scrapper',name: 'SCRAP BARON', tag: '+25% SCRAP',         desc: 'Every corpse pays a little better.', price: 3600, hp: 1,    speed: 1,    damage: 1,    scrap: 1.25, coat: '#4a3a2c', accent: '#c78cff' },
    { id: 'berserk', name: 'BERSERKER',   tag: '+15% DAMAGE',        desc: 'Hit first. Ask questions never.', price: 5200, hp: 1,    speed: 1,    damage: 1.15, scrap: 1,    coat: '#4a2626', accent: '#ff6b4a' },
    { id: 'ghost',   name: 'NIGHT GHOST', tag: '+8% SPEED / +10% HP',desc: 'Quiet boots and a stubborn pulse.', price: 7000, hp: 1.10, speed: 1.08, damage: 1,    scrap: 1,    coat: '#2c3446', accent: '#8fd6ff' }
  ];
  ZH.CHARACTER_BY_ID = ZH.CHARACTER_BY_ID || {};
  ZH.CHARACTERS.forEach(function (ch) { ZH.CHARACTER_BY_ID[ch.id] = ch; });

  /* one-time reward codes: local to the save, no server needed */
  ZH.REDEEM_CODES = ZH.REDEEM_CODES || {
    SIVA1000:   { coins: 1000, label: 'SIVA DROP' },
    ZOMBIEBUFF: { coins: 1500, label: 'ZOMBIE BUFF' },
    GAMESNACKS: { coins: 2000, character: 'ranger', label: 'GAME SNACKS PACK' },
    FORCEFIELD: { coins: 600,  label: 'FORCE FIELD SUPPLY' }
  };

  /** apply the selected survivor once, after the six skills have been set */
  ZH.applyCharacter = function (p, id) {
    var ch = ZH.CHARACTER_BY_ID[id] || ZH.CHARACTER_BY_ID.hunter;
    if (!p || !ch) return p;
    p.character = ch.id;
    p.char = ch;
    p.maxHp = Math.max(1, Math.round((p.maxHp || 100) * (ch.hp || 1)));
    p.hp = p.maxHp;
    p.speed = Math.round((p.speed || 300) * (ch.speed || 1));
    if (p.attack) p.attack = Math.round(p.attack * (ch.damage || 1) * 100) / 100;
    p.fortune = Math.round((p.fortune || 0) * (ch.scrap || 1) * 100) / 100;
    return p;
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

  /* ------------------------- survivor roster ------------------------- */
  function hasCharacter(id) { return save.characters.indexOf(id) !== -1; }

  function buyCharacter(id) {
    var ch = ZH.CHARACTER_BY_ID[id];
    if (!ch) return { ok: false, reason: 'unknown' };
    if (hasCharacter(id)) return { ok: false, reason: 'owned', character: id };
    if (save.coins < ch.price) return { ok: false, reason: 'coins', price: ch.price };
    save.coins -= ch.price;
    save.characters.push(id);
    save.character = id;
    persist();
    return { ok: true, character: id, price: ch.price };
  }

  function selectCharacter(id) {
    var pick = ZH.CHARACTER_BY_ID[id];
    if (!pick) return { ok: false, reason: 'unknown' };
    /* starter survivors are free: the cat is equipable without a purchase */
    if (!hasCharacter(id) && !pick.free) return { ok: false, reason: 'locked' };
    save.character = id;
    persist();
    return { ok: true, character: id };
  }

  /* ---------------------------- rewards ------------------------------ */
  function today() { return new Date().toISOString().slice(0, 10); }
  function dailyAvailable() { return save.lastDaily !== today(); }

  function claimDaily() {
    if (!dailyAvailable()) return { ok: false, reason: 'claimed' };
    save.lastDaily = today();
    save.coins += 350;
    persist();
    return { ok: true, coins: 350 };
  }

  function redeem(code) {
    code = String(code || '').trim().toUpperCase();
    var def = ZH.REDEEM_CODES[code];
    if (!def) return { ok: false, reason: 'invalid' };
    if (save.redeemed.indexOf(code) !== -1) return { ok: false, reason: 'used' };
    save.redeemed.push(code);
    if (def.coins) save.coins += def.coins;
    if (def.character && !hasCharacter(def.character)) save.characters.push(def.character);
    persist();
    return { ok: true, code: code, coins: def.coins || 0, character: def.character || null, label: def.label || code };
  }

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
    /* the campaign size always comes from levels.js, never from a stale default */
    if (ZH.STAGES && ZH.STAGES.length) save.maxLevel = ZH.STAGES.length;
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
    hasCharacter: hasCharacter,
    buyCharacter: buyCharacter,
    selectCharacter: selectCharacter,
    dailyAvailable: dailyAvailable,
    claimDaily: claimDaily,
    redeem: redeem,
    recordRun: recordRun,
    setDifficulty: setDifficulty,
    setName: setName,
    setSetting: setSetting,
    reset: reset,
    DEFAULTS: DEFAULTS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ZH.Save;
})(typeof window !== 'undefined' ? window.ZH || (window.ZH = {}) : {});
