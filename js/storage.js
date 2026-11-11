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
    settings: { muted: false, shake: true, quality: 'high', ringReload: true },
    /* safehouse roster: the first survivor is free, the rest are bought */
    characters: ['hunter'],
    character: 'hunter',
    redeemed: [],
    lastDaily: '',
    seenIntro: false,
    /* contracts + idle coffer (js/missions.js owns the format) */
    missions: [],
    missionsTime: 0,
    missionsDone: 0,
    loginDay: '',
    cofferTime: 0
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
    { id: 'reaper',  name: 'REAPER',       tag: '+20% DAMAGE',        desc: 'Every round lands heavier.', price: 8400, hp: 1, speed: 1.02, damage: 1.2, scrap: 1, coat: '#2a2430', accent: '#ff4d4d' },
    { id: 'scout',   name: 'SCATTER SCOUT', tag: '+30% SPEED / -10% HP', desc: 'First in, first out.', price: 7600, hp: 0.9, speed: 1.3, damage: 1, scrap: 1, coat: '#2f3d36', accent: '#ffe066' },
    { id: 'banker',  name: 'THE BANKER',   tag: '+50% SCRAP',         desc: 'Even the dead pay interest.', price: 9800, hp: 1, speed: 1, damage: 1, scrap: 1.5, coat: '#3a3226', accent: '#ffd166' },
    { id: 'vampire', name: 'NIGHT VAMPIRE', tag: 'LIFESTEAL +6%',      desc: 'Bites back, and keeps what it takes.', price: 11800, hp: 1.05, speed: 1.05, damage: 1, scrap: 1, coat: '#2b1f28', accent: '#c04dff' },
    { id: 'brawler', name: 'BRAWLER',      tag: '+30% HP / +10% DMG', desc: 'Walks into the horde on purpose.', price: 13500, hp: 1.3, speed: 0.96, damage: 1.1, scrap: 1, coat: '#332722', accent: '#ff8a4a' },
    { id: 'catlord', name: 'CAT LORD',     tag: '+35% SPEED / +15% HP', desc: 'Nine lives, nine ways to spend them.', price: 15000, hp: 1.15, speed: 1.35, damage: 1.05, scrap: 1.1, coat: '#30283f', accent: '#ffd6f2' },
    { id: 'neoncat', name: 'NEON CAT',     tag: '+25% SPEED',           desc: 'Runs the rooftops like a stray current.', price: 9000, hp: 1, speed: 1.25, damage: 1, scrap: 1, coat: '#2a2f45', accent: '#5cf2ff' },
    { id: 'ronin',   name: 'THE RONIN',    tag: '+25% DAMAGE',          desc: 'One blade, no master, many dead.', price: 10500, hp: 1.02, speed: 1.04, damage: 1.25, scrap: 1, coat: '#2b2b30', accent: '#e8e8e8' },
    { id: 'frost',   name: 'FROSTBITE',    tag: '+40% MAX VITALS',      desc: 'Cold hands, colder blood.', price: 11000, hp: 1.4, speed: 0.98, damage: 1, scrap: 1, coat: '#283a44', accent: '#a8e8ff' },
    { id: 'ember',   name: 'EMBER',        tag: '+15% DMG / +10% SPD',  desc: 'Leaves a trail of ash behind the horde.', price: 12500, hp: 1.05, speed: 1.1, damage: 1.15, scrap: 1, coat: '#3d2a22', accent: '#ff7a3d' },
    { id: 'tech',    name: 'THE TECHIE',   tag: '+35% SCRAP',           desc: 'Strips every corpse for parts.', price: 13000, hp: 1, speed: 1.04, damage: 1.05, scrap: 1.35, coat: '#2b333a', accent: '#7dffd4' },
    { id: 'warlock', name: 'WARLOCK',      tag: 'LIFESTEAL +8%',        desc: 'Trades blood for blood.', price: 14500, hp: 1.08, speed: 1.05, damage: 1.1, scrap: 1, coat: '#2c2136', accent: '#9b5cff' },
    { id: 'queen',   name: 'HIVE QUEEN',   tag: '+20% HP / +20% DMG',   desc: 'The horde answers to her.', price: 18000, hp: 1.2, speed: 1, damage: 1.2, scrap: 1.1, coat: '#3a2d33', accent: '#ff5c9e' },
    { id: 'ghostcat',name: 'GHOST CAT',    tag: '+40% SPEED',           desc: 'You hear the meow after the claws.', price: 20000, hp: 0.95, speed: 1.4, damage: 1.1, scrap: 1, coat: '#2a3038', accent: '#d8f6ff' },
    { id: 'ranger',  name: 'DUNE RANGER', tag: '+12% MOVE SPEED',    desc: 'Long strides. Slips through alleys fast.', price: 1500, hp: 1,    speed: 1.12, damage: 1,    scrap: 1,    coat: '#3d4a2a', accent: '#d7a13a' },
    { id: 'medic',   name: 'FIELD MEDIC', tag: '+25% MAX VITALS',    desc: 'A bigger health pool for the long waves.', price: 2600, hp: 1.25, speed: 1,    damage: 1,    scrap: 1,    coat: '#2b4548', accent: '#58d6c0' },
    { id: 'scrapper',name: 'SCRAP BARON', tag: '+25% SCRAP',         desc: 'Every corpse pays a little better.', price: 3600, hp: 1,    speed: 1,    damage: 1,    scrap: 1.25, coat: '#4a3a2c', accent: '#c78cff' },
    { id: 'berserk', name: 'BERSERKER',   tag: '+15% DAMAGE',        desc: 'Hit first. Ask questions never.', price: 5200, hp: 1,    speed: 1,    damage: 1.15, scrap: 1,    coat: '#4a2626', accent: '#ff6b4a' },
    { id: 'ghost',   name: 'NIGHT GHOST', tag: '+8% SPEED / +10% HP',desc: 'Quiet boots and a stubborn pulse.', price: 7000, hp: 1.10, speed: 1.08, damage: 1,    scrap: 1,    coat: '#2c3446', accent: '#8fd6ff' },
    /* ---- prestige roster: serious scrap, serious stats ---- */
    { id: 'warden',  name: 'THE WARDEN',  tag: '+30% HP / +20% DMG', desc: 'Runs the block. Nothing gets past.', price: 30000, hp: 1.3, speed: 1, damage: 1.2, scrap: 1.1, coat: '#2f3a3d', accent: '#8fd9ff' },
    { id: 'paladin', name: 'PALADIN',     tag: '+45% HP / LIFESTEAL 5%', desc: 'Armoured in faith, healed by the fight.', price: 38000, hp: 1.45, speed: 0.98, damage: 1.1, scrap: 1, lifesteal: 0.05, coat: '#3a3a46', accent: '#ffe9a8' },
    { id: 'spectre', name: 'SPECTRE',     tag: '+50% SPEED',           desc: 'Gone before the shot lands.', price: 44000, hp: 0.95, speed: 1.5, damage: 1.1, scrap: 1, coat: '#242c34', accent: '#b9ffef' },
    { id: 'tyrant',  name: 'TYRANT',      tag: '+45% DMG / +25% HP',   desc: 'Rules by attrition.', price: 50000, hp: 1.25, speed: 1, damage: 1.45, scrap: 1.1, coat: '#3d2a2a', accent: '#ff5a3d' },
    { id: 'oracle',  name: 'THE ORACLE',  tag: '+90% SCRAP',           desc: 'Sees where every corpse pays out.', price: 56000, hp: 1.05, speed: 1.05, damage: 1.05, scrap: 1.9, coat: '#2e2a3f', accent: '#c9a8ff' },
    { id: 'samurai', name: 'SAMURAI',     tag: '+35% DMG / +30% HP',   desc: 'One clean cut per wave.', price: 64000, hp: 1.3, speed: 1.04, damage: 1.35, scrap: 1, coat: '#33262b', accent: '#ff5252' },
    { id: 'valkyrie',name: 'VALKYRIE',    tag: '+30% SPD / +30% DMG',  desc: 'Picks the horde, then picks it apart.', price: 72000, hp: 1.1, speed: 1.3, damage: 1.3, scrap: 1.05, coat: '#2b3340', accent: '#a8d8ff' },
    { id: 'monk',    name: 'IRON MONK',   tag: '+65% MAX VITALS',      desc: 'Breathes. Endures. Still standing.', price: 82000, hp: 1.65, speed: 1.02, damage: 1.05, scrap: 1, coat: '#3a3227', accent: '#ffcf70' },
    { id: 'huntress',name: 'HUNTRESS',    tag: '+45% DMG / +20% SPD',  desc: 'Never misses the second shot.', price: 95000, hp: 1.05, speed: 1.2, damage: 1.45, scrap: 1.1, coat: '#2c3a2c', accent: '#b6ff7a' },
    { id: 'empress', name: 'THE EMPRESS', tag: '+35% TO EVERYTHING',   desc: 'Owns the district, the scrap, the night.', price: 115000, hp: 1.35, speed: 1.35, damage: 1.35, scrap: 1.35, coat: '#3a2838', accent: '#ffa8d8' },
    { id: 'seraph',  name: 'SERAPH',      tag: '+30% ALL / LIFESTEAL 10%', desc: 'Wings of scrap, halo of teeth.', price: 150000, hp: 1.3, speed: 1.3, damage: 1.3, scrap: 1.3, lifesteal: 0.1, coat: '#3a3830', accent: '#fff4c2' },
    { id: 'overlord',name: 'VOID OVERLORD', tag: '+60% HP / +60% DMG', desc: 'The horde is staff. You are management.', price: 250000, hp: 1.6, speed: 1.1, damage: 1.6, scrap: 1.2, coat: '#241f2e', accent: '#c45cff' }
  ];
  /* five permanent store upgrades, kept across every run and every survivor.
     Separate from the original six coin skills so GameSnacks parity holds. */
  ZH.STORE_UPGRADES = ZH.STORE_UPGRADES || [
    { id: 'magnet',   name: 'MAGNET',      max: 5, base: 1200, desc: function (l) { return '+' + (l * 25) + '% pickup reach'; } },
    { id: 'siphon',   name: 'SIPHON',      max: 5, base: 1800, desc: function (l) { return '+' + l + '% life discharge'; } },
    { id: 'sprint',   name: 'SPRINT',      max: 5, base: 1500, desc: function (l) { return '+' + (l * 3) + '% move speed'; } },
    { id: 'vitality', name: 'VITALITY',    max: 8, base: 900,  desc: function (l) { return '+' + (l * 5) + ' max vitals'; } },
    { id: 'fortune',  name: 'FORTUNE',     max: 5, base: 2000, desc: function (l) { return '+' + (l * 5) + '% scrap'; } }
  ];

  ZH.CHARACTER_BY_ID = ZH.CHARACTER_BY_ID || {};
  ZH.CHARACTERS.forEach(function (ch) { ZH.CHARACTER_BY_ID[ch.id] = ch; });

  /* one-time reward codes: local to the save, no server needed */
  ZH.REDEEM_CODES = ZH.REDEEM_CODES || {
    SIVA1000:   { coins: 1000, label: 'SIVA DROP' },
    ZOMBIEBUFF: { coins: 1500, label: 'ZOMBIE BUFF' },
    GAMESNACKS: { coins: 2000, character: 'ranger', label: 'GAME SNACKS PACK' },
    MEOWCAT:    { coins: 1500, character: 'catlord', label: 'MEOW CAT PACK' },
    NEON2026:   { coins: 1200, label: 'NEON DROP' },
    GIFTBOX:    { coins: 800,  label: 'GIFT BOX' },
    BRIDGE100:  { coins: 1000, label: 'SKYWAY CACHE' },
    CITY25:     { coins: 2500, label: 'CITY TOUR' },
    DAILY777:   { coins: 700,  label: 'LUCKY SEVEN' },
    STOREUP:    { coins: 900,  label: 'STORE CREDIT' },
    SURVIVOR:   { coins: 1800, character: 'scout', label: 'SCOUT RECRUIT' },
    RAGHUL:     { coins: 50000, label: 'RAGHUL DROP' },
    QSP:        { coins: 5000,  label: 'QSP DROP' },
    SIVA:       { coins: 30000, label: 'SIVA CACHE' }
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
    if (ch.lifesteal) p.lifesteal = Math.max(p.lifesteal || 0, ch.lifesteal);
    /* every survivor brings one named special power into the run */
    if (ZH.Powers) ZH.Powers.attach(p, ch.id);
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
    /* 7 = EARN_X_GOLD: every scrap gain counts toward the contract */
    if (ZH.Missions && n > 0) ZH.Missions.update(7, n);
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
    /* 6 = BUY_X_UPGRADES */
    if (ZH.Missions) ZH.Missions.update(6, 1);
    persist();
    return { ok: true, level: lvl + 1, price: price };
  }

  /* weapons are not sold anywhere: the original hands them out as level-up
     cards. Kept so old call sites fail gracefully instead of throwing. */
  function buyWeapon() { return { ok: false, reason: 'shop' }; }

  /* ------------------------- survivor roster ------------------------- */
  function hasCharacter(id) { return save.characters.indexOf(id) !== -1; }

  /* ------------------------- permanent upgrades ----------------------- */
  function upgradeDef(id) {
    var found = null;
    (ZH.STORE_UPGRADES || []).forEach(function (u) { if (u.id === id) found = u; });
    return found;
  }
  function upgradeLevel(id) {
    return (save.upgrades && save.upgrades[id]) || 0;
  }
  function upgradePrice(id, level) {
    var def = upgradeDef(id);
    if (!def) return Infinity;
    var lvl = level == null ? upgradeLevel(id) + 1 : level;
    return Math.round(def.base * Math.pow(1.75, Math.max(0, lvl - 1)));
  }
  function buyUpgrade(id) {
    var def = upgradeDef(id);
    if (!def) return { ok: false, reason: 'unknown' };
    var lvl = upgradeLevel(id);
    if (lvl >= def.max) return { ok: false, reason: 'max' };
    var price = upgradePrice(id, lvl + 1);
    if (save.coins < price) return { ok: false, reason: 'coins', price: price };
    save.coins -= price;
    save.upgrades[id] = lvl + 1;
    /* 6 = BUY_X_UPGRADES */
    if (ZH.Missions) ZH.Missions.update(6, 1);
    persist();
    return { ok: true, level: lvl + 1, price: price };
  }

  /* apply every bought upgrade once, at the start of a run */
  ZH.applyUpgrades = function (p, s) {
    if (!p) return p;
    s = s || save;
    var up = (s && s.upgrades) || {};
    var lv = function (id) { return up[id] || 0; };
    var vit = lv('vitality');
    if (vit) { p.maxHp = Math.round(p.maxHp + vit * 5); p.hp = p.maxHp; }
    var spr = lv('sprint');
    if (spr) p.speed = Math.round(p.speed * (1 + spr * 0.03));
    var mag = lv('magnet');
    if (mag) p.magnet = (p.magnet || 0) + mag * 0.25;
    var fort = lv('fortune');
    if (fort) p.fortune = Math.round((p.fortune || 0) + fort * 5);
    var sip = lv('siphon');
    if (sip) p.lifesteal = Math.max(p.lifesteal || 0, 0.03 + sip * 0.01);
    return p;
  };

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
    /* the daily crate: 350 scrap guaranteed, plus one random bonus */
    var bonus = 0, kind = 'scrap', label = 'DAILY DROP';
    var roll = Math.random();
    if (roll < 0.42) {
      bonus = 200 + Math.floor(Math.random() * 600);
      label = 'DAILY CRATE';
    } else if (roll < 0.62) {
      save.upgrades.magnet = Math.min(5, (save.upgrades.magnet || 0) + 1);
      kind = 'upgrade'; label = 'FREE MAGNET LEVEL';
    } else if (roll < 0.82) {
      bonus = 1200; label = 'BIG CRATE';
    } else {
      save.upgrades.vitality = Math.min(8, (save.upgrades.vitality || 0) + 1);
      kind = 'upgrade'; label = 'FREE VITALITY LEVEL';
    }
    save.coins += 350 + bonus;
    if (ZH.Missions) ZH.Missions.update(7, 350 + bonus);   /* EARN_X_GOLD */
    persist();
    return { ok: true, coins: 350 + bonus, bonus: bonus, kind: kind, label: label };
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
    upgradeLevel: upgradeLevel,
    upgradePrice: upgradePrice,
    buyUpgrade: buyUpgrade,
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
