/*
 * Full structured teardown of the GameSnacks Zombie Hunter bundle.
 *
 * Resolves the bundle's named shot templates (BOSS_TOWER_ATTACK1_SHOT,
 * ASSAULT1_SHOT, ...) through Object.assign so the extracted numbers are the
 * effective ones, then writes JSON + a complete wave-ladder markdown file.
 *
 * Run: node analysis/full_teardown.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'zh_orig_src', 'js_game.js'), 'utf8');

/* ------------------------------------------------------------------ */
/* generic scanning                                                    */
/* ------------------------------------------------------------------ */

function balancedAt(text, start) {
  if (start < 0 || start >= text.length) return null;
  const open = text[start];
  if (open !== '{' && open !== '[') return null;
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

const balanced = (start) => balancedAt(src, start);

// Balanced (...) — Object.assign calls need this.
function parenAt(text, start) {
  if (text[start] !== '(') return null;
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function blockAfter(needle, from = 0, opener = '{') {
  const i = src.indexOf(needle, from);
  if (i < 0) return null;
  const start = src.indexOf(opener, i);
  return start < 0 ? null : balanced(start);
}

// Split an argument list (no surrounding brackets) at depth 0.
function splitArgs(text) {
  const inner = text;
  const out = [];
  let depth = 0;
  let quote = null;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote) {
      cur += c;
      if (c === '\\') { cur += inner[++i]; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    if (c === '}' || c === ']' || c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Split the inside of a {...} or [...] literal.
function splitTop(text) {
  const inner = (text.startsWith('[') || text.startsWith('{')) ? text.slice(1, -1) : text;
  return splitArgs(inner);
}

const numConsts = (() => {
  const map = {};
  for (const m of src.matchAll(/\b([A-Z][A-Z0-9_]{2,})=(-?[0-9.]+(?:E\d+)?)\b/g)) {
    if (!(m[1] in map)) map[m[1]] = Number(m[2]);
  }
  return map;
})();

function namedLiteral(name) {
  const i = src.indexOf(name + '={');
  return i < 0 ? null : balanced(src.indexOf('{', i));
}

function flatEntries(objText) {
  const out = {};
  for (const entry of splitTop(objText)) {
    const i = entry.indexOf(':');
    if (i < 0) continue;
    out[entry.slice(0, i).trim()] = entry.slice(i + 1).trim();
  }
  return out;
}

// Resolve a value expression into a flat key -> raw-value map.
function resolve(expr) {
  expr = (expr || '').trim();
  if (!expr) return {};
  if (expr.startsWith('{')) return flatEntries(expr);
  if (expr.startsWith('Object.assign')) {
    const call = parenAt(expr, expr.indexOf('('));
    if (!call) return {};
    let merged = {};
    for (const arg of splitArgs(call.slice(1, -1))) merged = Object.assign(merged, resolve(arg));
    return merged;
  }
  const lit = namedLiteral(expr.replace(/\s+/g, ''));
  return lit ? flatEntries(lit) : {};
}

// Arithmetic on constants: "5*BOSS_DRAGON_SHOT_DELAY" -> 1750.
function numeric(expr) {
  if (expr == null) return null;
  const trimmed = String(expr).trim();
  if (/^-?[0-9.]+(?:E\d+)?$/.test(trimmed)) return Number(trimmed);
  const replaced = trimmed.replace(/\b[A-Z][A-Z0-9_]{2,}\b/g,
    (n) => (n in numConsts ? '(' + numConsts[n] + ')' : n));
  if (!/^[\d\s+\-*/().E]+$/.test(replaced)) return null;
  try { return Function('"use strict";return (' + replaced + ')')(); } catch (e) { return null; }
}

const value = (map, key) => (key in map ? map[key] : null);
const numberField = (map, key) => numeric(value(map, key));
const stringField = (map, key) => {
  const v = value(map, key);
  if (v == null) return null;
  const m = v.match(/^"([^"]*)"$/) || v.match(/^'([^']*)'$/);
  return m ? m[1] : null;
};
const boolField = (map, key) => {
  const v = value(map, key);
  return v === '!0' || v === '!1' ? v === '!0' : null;
};

function parseShot(entry) {
  const map = resolve(entry);
  if (!Object.keys(map).length) return null;
  return {
    damage: numberField(map, 'damage'),
    speed: numberField(map, 'speed'),
    attackDelay: numberField(map, 'attackDelay'),
    delay: numberField(map, 'delay'),
    angleInc: numberField(map, 'angleInc'),
    angle: numberField(map, 'angle'),
    range: numberField(map, 'range'),
    radius: numberField(map, 'radius'),
    life: numberField(map, 'life'),
    homing: boolField(map, 'homing'),
    grenade: boolField(map, 'grenade'),
    explosive: boolField(map, 'explosive'),
    fragment: boolField(map, 'fragment'),
    bounce: boolField(map, 'bounceBossZn'),
    sound: stringField(map, 'sound'),
    sprite: stringField(map, 'sprite'),
  };
}

const parseList = (raw) => (!raw || !raw.startsWith('[') ? [] : splitTop(raw).map(parseShot).filter(Boolean));

/* ------------------------------------------------------------------ */
/* 1. supplies                                                         */
/* ------------------------------------------------------------------ */

const SUPPLIES = ['Kevlar', 'AmmoBooster', 'Handbook', 'Scope', 'Propane', 'Magnet',
  'Chronometer', 'EnergyDrink', 'ActionGloves', 'Sneakers', 'Detector', 'Supplements'];

const supplies = {};
for (const name of SUPPLIES) {
  const start = src.indexOf(name + '=function');
  if (start < 0) continue;
  const ends = SUPPLIES.map((n) => src.indexOf(n + '=function', start + 12)).filter((i) => i > start);
  const end = ends.length ? Math.min(...ends) : start + 6000;
  const t = src.slice(start, end);
  supplies[name] = {
    bonus: (t.match(/this\.bonus=\[([^\]]*)\]/) || [])[1]?.split(',').map(Number) || null,
    attrib: ((t.match(/updateAttribs:function\(\)\{([\s\S]{0,160}?)\}\s*,\s*levelUp/) || [])[1] || '')
      .replace(/\s+/g, ' ').replace(/;+$/, '').trim(),
    evo: [...t.matchAll(/this\.evoSupp=(?:"([^"]+)"|\[([^\]]+)\])/g)]
      .map((m) => (m[1] || m[2].replace(/"/g, '').split(',').join(' + '))),
    nameKey: (t.match(/this\.name="([^"]+)"/) || [])[1],
    descKey: (t.match(/this\.desc="([^"]+)"/) || [])[1],
  };
}

/* ------------------------------------------------------------------ */
/* 2. enemies                                                          */
/* ------------------------------------------------------------------ */

const enemies = {};
for (const m of src.matchAll(/EnemiesData\.([a-zA-Z0-9_]+)=/g)) {
  const objStart = src.indexOf('{', m.index + m[0].length);
  if (objStart < 0 || src.slice(m.index + m[0].length, objStart).trim() !== '') continue;
  const body = balanced(objStart);
  if (!body || body.length > 6000) continue;
  const f = flatEntries(body);
  const grab = (key) => {
    const v = value(f, key);
    if (!v || !v.startsWith('{')) return null;
    return flatEntries(v);
  };
  const deadshot = grab('deadshot');
  const deadspawn = grab('deadspawn');
  const deaddrop = grab('deaddrop');
  enemies[m[1]] = {
    hp: numberField(f, 'health'),
    speed: numberField(f, 'speed'),
    scale: numberField(f, 'scale'),
    mass: numberField(f, 'mass'),
    meleeRange: numberField(f, 'range'),
    meleeDamage: numberField(f, 'damage'),
    meleeDelay: numberField(f, 'attackDelay'),
    xp: numberField(f, 'bonus'),
    static: boolField(f, 'static') === true,
    healthbar: boolField(f, 'healthbar') === true,
    shots: parseList(value(f, 'shots')),
    deadshot: deadshot && {
      damage: numberField(deadshot, 'damage'),
      life: numberField(deadshot, 'life'),
      speed: numberField(deadshot, 'speed'),
      destroyable: boolField(deadshot, 'destroyable') === true,
      rotationSpeed: numberField(deadshot, 'rotationSpeed'),
    },
    deadspawn: deadspawn && {
      enemy: stringField(deadspawn, 'enemy'),
      count: numberField(deadspawn, 'count'),
      radius: numberField(deadspawn, 'radius'),
    },
    deaddrop: deaddrop && {
      type: numberField(deaddrop, 'type'),
      data: numberField(deaddrop, 'data'),
      bonus: numberField(deaddrop, 'bonus'),
    },
  };
}

/* ------------------------------------------------------------------ */
/* 3. bosses                                                           */
/* ------------------------------------------------------------------ */

const MOVEMENT = { 0: 'CHASE', 1: 'CHARGE', 2: 'ROAM', 3: 'RETREAT', 4: 'TELEPORT', 5: 'SPAWN', 10: 'ATTACK' };
const bosses = {};
for (const m of src.matchAll(/BossesData\.([a-zA-Z0-9_]+)=/g)) {
  const objStart = src.indexOf('{', m.index + m[0].length);
  if (objStart < 0 || src.slice(m.index + m[0].length, objStart).trim() !== '') continue;
  const body = balanced(objStart);
  if (!body) continue;
  const f = flatEntries(body);

  const steps = [];
  const behRaw = value(f, 'behaviour');
  if (behRaw && behRaw.startsWith('[')) {
    for (const entry of splitTop(behRaw)) {
      const s = resolve(entry);
      if (!Object.keys(s).length) continue;
      const moveRaw = value(s, 'movement');
      const moveNum = /^-?\d+$/.test(moveRaw || '') ? Number(moveRaw) : numeric(moveRaw);
      const dRaw = value(s, 'duration');
      let durations = null;
      if (dRaw && dRaw.startsWith('[')) durations = splitTop(dRaw).map(numeric);
      else if (dRaw) durations = [0, numeric(dRaw), 0];
      steps.push({
        movement: MOVEMENT[moveNum] || moveRaw || 'ATTACK',
        durations,
        speed: numberField(s, 'speed'),
        anim: stringField(s, 'anim'),
        tag: stringField(s, 'tag'),
        shots: parseList(value(s, 'shots')),
        spawns: (() => {
          const raw = value(s, 'spawns');
          if (!raw || !raw.startsWith('[')) return [];
          return splitTop(raw).map((e) => {
            const o = resolve(e);
            return { enemy: stringField(o, 'enemy'), radius: numberField(o, 'radius'), delay: numberField(o, 'delay') };
          }).filter((o) => o.enemy);
        })(),
      });
    }
  }
  bosses[m[1]] = {
    hp: numberField(f, 'health'),
    speed: numberField(f, 'speed'),
    scale: numberField(f, 'scale'),
    meleeDamage: numberField(f, 'damage'),
    attackDelay: numberField(f, 'attackDelay'),
    meleeDelay: numberField(f, 'meleeDelay'),
    static: boolField(f, 'static') === true,
    steps,
  };
}

/* ------------------------------------------------------------------ */
/* 4. levels                                                           */
/* ------------------------------------------------------------------ */

const levelDir = path.join(ROOT, 'zh_orig_assets', 'extracted_levels');
const levels = [];
const levelSections = [];
for (const file of fs.readdirSync(levelDir)
  .filter((f) => /_parsed\.json$/.test(f))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  const data = JSON.parse(fs.readFileSync(path.join(levelDir, file), 'utf8'));
  const stage = data.level || data.stage || data;
  const waves = stage.waves || data.waves || [];
  const summary = {
    file,
    name: stage.name || data.name,
    tile: stage.tile || stage.map,
    rewards: stage.rewards,
    timeToTreasure: stage.timeToTreasure,
    waves: waves.length,
    bossZones: waves.filter((w) => w.bossZone).length,
    lastWaveEnd: Math.max(...waves.map((w) => (w.startTime || 0) + (w.duration || 0))),
    enemyTypes: [...new Set(waves.map((w) => w.enemy).filter(Boolean))],
    maxConcurrent: Math.max(...waves.map((w) => w.max || 0)),
    totalSpawnCap: waves.reduce((a, w) => a + (w.total || 0), 0),
    bossWaves: waves.filter((w) => w.bossZone).map((w) => ({
      start: (w.startTime || 0) / 1000,
      duration: (w.duration || 0) / 1000,
      zone: w.bossZone,
      bosses: (w.bosses || []).map((b) => (typeof b === 'string' ? b : b.type)),
    })),
  };
  levels.push(summary);

  const FREQ = { LOW: 700, MID: 350, HI: 100 };
  const rows = waves.map((w, i) => {
    const bossNames = Array.isArray(w.bosses)
      ? w.bosses.map((b) => (typeof b === 'string' ? b : b.type)).join(' + ')
      : '';
    const zone = w.bossZone && typeof w.bossZone === 'object'
      ? `${w.bossZone.type} ${w.bossZone.width}×${w.bossZone.height}` : '';
    const flags = [
      w.bossZone ? 'boss zone ' + zone : '',
      bossNames ? 'bosses: ' + bossNames : '',
    ].filter(Boolean).join(', ');
    const freqRaw = w.freq ?? w.frequency;
    const freq = typeof freqRaw === 'string'
      ? (FREQ[freqRaw.toUpperCase()] ?? freqRaw)
      : (freqRaw ?? '—');
    return `| ${i + 1} | ${w.enemy || '—'} | ${freq} | ${w.max ?? '—'} | ${(w.startTime || 0) / 1000} | ${(w.duration || 0) / 1000} | ${w.total ?? '—'} | ${flags || '—'} |`;
  });
  levelSections.push(
    `\n### ${summary.name}\n\n` +
    `Waves **${summary.waves}** · boss zones **${summary.bossZones}** · enemy types **${summary.enemyTypes.length}** · ` +
    `max concurrent **${summary.maxConcurrent}** · ladder ends **${summary.lastWaveEnd / 1000}s** · ` +
    `rewards ${JSON.stringify(summary.rewards)} · treasure every ${(summary.timeToTreasure || 0) / 1000}s.\n\n` +
    '| # | enemy | freq (ms) | max | start (s) | duration (s) | total | flags |\n' +
    '|---|---|---|---|---|---|---|---|\n' + rows.join('\n') + '\n');
}

fs.writeFileSync(path.join(__dirname, 'levels_full.md'),
  '# GameSnacks level ladders — every wave of all eight stages\n\n' +
  'Generated by `analysis/full_teardown.js` from `zh_orig_assets/extracted_levels/*_parsed.json`.\n' +
  '`freq` is the authored spawn interval, `max` the concurrent ceiling for that type, ' +
  '`total` how many the wave may spawn overall; a boss-zone wave freezes the clock.\n' +
  levelSections.join('\n'));

/* ------------------------------------------------------------------ */
/* 5. audio, player attributes, missions, save, platform               */
/* ------------------------------------------------------------------ */

const soundVolumes = {};
for (const m of src.matchAll(/SOUND_VOLUMES(?:\["([\w]+)"\]|\.(\w+))=([0-9.]+)/g)) {
  soundVolumes[m[1] || m[2]] = Number(m[3]);
}

// Player attribute block: the first attribs object that lists attack/health.
const playerAttribs = (() => {
  for (const m of src.matchAll(/this\.attribs=\{/g)) {
    const block = balanced(src.indexOf('{', m.index));
    if (block && /attack:/.test(block) && /health:/.test(block)) return flatEntries(block);
  }
  return null;
})();

const missionTypes = [...src.matchAll(/MISSION_TYPE_([A-Z0-9_]+)=(\d+)/g)]
  .map((m) => ({ name: m[1], value: Number(m[2]) }))
  .filter((v, i, a) => a.findIndex((x) => x.name === v.name) === i);

const genMission = blockAfter('function GenerateMission(b)');
const genActive = blockAfter('function GenerateActiveMissions()');
const slots = blockAfter('prepareSlots:function');

fs.writeFileSync(path.join(__dirname, 'teardown.json'), JSON.stringify({
  supplies, enemies, bosses, levels, soundVolumes, playerAttribs, missionTypes,
  slotGenerator: slots,
}, null, 2));

const platformCalls = [...new Set([...src.matchAll(/GameSnacks\.[a-zA-Z.]+/g)].map((m) => m[0]))];

// Mission matrix: base reward/target from f/h, per-slot tier overrides from `Ne&&(f=..,h=..)`.
const missionTable = (() => {
  const re = /function\s+GenerateMission\s*\(/;
  const m = re.exec(src);
  if (!m) return [];
  const body = balanced(src.indexOf('{', m.index));
  const out = [];
  for (const chunk of body.split(/if\(b==MISSION_TYPE_/).slice(1)) {
    const name = (chunk.match(/^(\w+)/) || [])[1];
    if (!name) continue;
    const lit = chunk.match(/reward:([0-9.E]+),target:([0-9.E]+)/);
    const base = chunk.match(/f=([0-9.E]+),h=([0-9.E]+)/);
    const tiers = {};
    for (const t of chunk.matchAll(/([23])==e&&\(f=([0-9.E]+),\s*h=([0-9.E]+)\)/g)) {
      tiers[t[1]] = { reward: numeric(t[2]), target: numeric(t[3]) };
    }
    out.push({
      name,
      reward: lit ? numeric(lit[1]) : (base ? numeric(base[1]) : null),
      target: lit ? numeric(lit[2]) : (base ? numeric(base[2]) : null),
      tiers,
    });
  }
  return out;
})();

const resetAttribs = (() => {
  const i = src.indexOf('resetAttribs:function');
  if (i < 0) return null;
  const body = balanced(src.indexOf('{', i));
  const out = {};
  for (const m of body.matchAll(/this\.attribs\.(\w+)=([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
})();

fs.writeFileSync(path.join(__dirname, 'missions.json'), JSON.stringify({ missionTable, resetAttribs }, null, 2));

fs.writeFileSync(path.join(__dirname, 'missions.txt'),
  'MISSION TYPES\n' + missionTypes.map((m) => `${m.value}  ${m.name}`).join('\n') +
  '\n\nGenerateMission\n' + (genMission || 'missing') +
  '\n\nGenerateActiveMissions\n' + (genActive || 'missing') +
  '\n\nSave schema\n' + src.slice(src.indexOf('DataVersion='), src.indexOf('DataVersion=') + 1400) +
  '\n\nRewarded ads\n' + src.slice(src.indexOf('REWARDED_ADS_ENABLED'), src.indexOf('REWARDED_ADS_ENABLED') + 1400) +
  '\n\nGameSnacks platform calls\n' + platformCalls.join('\n') +
  '\n\nLevel-up slot generation\n' + (slots || 'missing') +
  '\n\nPlayer attribs\n' + (playerAttribs ? Object.entries(playerAttribs).map(([k, v]) => k + ' = ' + v).join('\n') : 'missing'));

/* ------------------------------------------------------------------ */
/* 6. weapon getter bodies (verbatim, for the weapon appendix)         */
/* ------------------------------------------------------------------ */

const protoPath = path.join(ROOT, 'zh_orig_assets', 'weapons_prototypes.json');
if (fs.existsSync(protoPath)) {
  const protos = JSON.parse(fs.readFileSync(protoPath, 'utf8'));
  const grabBody = (text, name) => {
    const i = text.indexOf(name + ':function()');
    if (i < 0) return null;
    const start = text.indexOf('{', i);
    return balancedAt(text, start);
  };
  const sections = ['# Weapon getter bodies (verbatim)\n',
    'Generated by `analysis/full_teardown.js` from `zh_orig_assets/weapons_prototypes.json`.\n',
    'These are the bundle\'s own prototype functions, so damage/count/radius scaling is exact.\n'];
  for (const key of Object.keys(protos)) {
    const t = protos[key];
    const nameKey = (t.match(/this\.name="([^"]+)"/) || [])[1];
    const evoName = (t.match(/this\.evoName="([^"]+)"/) || [])[1];
    const evoSupp = (t.match(/this\.evoSupp="([^"]+)"/) || [])[1];
    const parts = [
      ['reset', grabBody(t, 'reset')],
      ['getCount', grabBody(t, 'getCount')],
      ['getDamage', grabBody(t, 'getDamage')],
      ['getRadius', grabBody(t, 'getRadius')],
      ['getCooldown', grabBody(t, 'getCooldown')],
      ['update', grabBody(t, 'update')],
    ];
    sections.push('\n## ' + key + '\n\n' +
      '- name: `' + (nameKey || '?') + '`\n' +
      '- evolution: `' + (evoName || '?') + '` via `' + (evoSupp || '?') + '`\n');
    for (const [label, body] of parts) {
      if (!body) continue;
      sections.push('\n**' + label + '**\n\n```js\n' + body.replace(/;/g, ';\n').replace(/\n{2,}/g, '\n') + '\n```\n');
    }
  }
  fs.writeFileSync(path.join(__dirname, 'weapons_full.md'), sections.join('\n'));
  console.log('weapon appendix bytes', sections.join('\n').length);

  // Compact numeric summary straight from the getters.
  const weaponTable = {};
  for (const key of Object.keys(protos)) {
    const t = protos[key];
    const reset = grabBody(t, 'reset') || '';
    const dmg = grabBody(t, 'getDamage') || '';
    const cnt = grabBody(t, 'getCount') || '';
    const rad = grabBody(t, 'getRadius') || '';
    weaponTable[key] = {
      name: (t.match(/this\.name="([^"]+)"/) || [])[1],
      evo: (t.match(/this\.evoName="([^"]+)"/) || [])[1],
      evoSupp: (t.match(/this\.evoSupp="([^"]+)"/) || [])[1],
      cooldown: numeric((reset.match(/this\.cooldown=([0-9.E]+)/) || [])[1]),
      speed: numeric((reset.match(/this\.speed=([0-9.E]+)/) || [])[1]),
      baseDamage: numeric((dmg.match(/var b=([0-9.]+)\*Player/) || [])[1]),
      damageMuls: [...dmg.matchAll(/b\*=([0-9.]+)/g)].map((m) => Number(m[1])),
      counts: [...cnt.matchAll(/return ([0-9]+)/g)].map((m) => Number(m[1])),
      baseRadius: numeric((rad.match(/var b=([0-9.]+)/) || [])[1]),
      radiusSet: [...rad.matchAll(/b=([0-9.]+)\)/g)].map((m) => Number(m[1])),
    };
  }
  fs.writeFileSync(path.join(__dirname, 'weapons_summary.json'), JSON.stringify(weaponTable, null, 2));
  console.log('\nWEAPONS');
  for (const [k, w] of Object.entries(weaponTable)) {
    console.log(k.padEnd(14), 'cd', String(w.cooldown).padEnd(5), 'dmg', String(w.baseDamage).padEnd(3),
      'muls', w.damageMuls.join('/'), '| counts', w.counts.join('/') || '-',
      '| radius', w.baseRadius ?? '-', w.radiusSet.join('/'), '| evo', w.evoSupp);
  }
}

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */

console.log('supplies', Object.keys(supplies).length,
  '| enemies', Object.keys(enemies).length,
  '| bosses', Object.keys(bosses).length,
  '| levels', levels.length,
  '| waves', levels.reduce((a, l) => a + l.waves, 0),
  '| sounds', Object.keys(soundVolumes).length,
  '| missions', missionTypes.length,
  '| playerAttribs', playerAttribs ? Object.keys(playerAttribs).length : 'missing');

console.log('\nSUPPLIES');
for (const [k, v] of Object.entries(supplies)) {
  console.log(k.padEnd(13), JSON.stringify(v.bonus), '->', v.attrib, '| evo', v.evo.join(','));
}

console.log('\nBOSSES');
for (const [k, v] of Object.entries(bosses)) {
  console.log(`${k}  hp=${v.hp} steps=${v.steps.length}`);
  v.steps.forEach((s, i) => {
    const shots = s.shots.length
      ? ' shots[' + s.shots.map((x) => `${x.damage ?? '?'}dmg${x.angleInc != null ? '@' + x.angleInc + '°' : ''}${x.delay ? '+' + x.delay + 'ms' : ''}${x.radius ? ' r' + x.radius : ''}${x.homing ? ' homing' : ''}${x.grenade ? ' grenade' : ''}${x.bounce ? ' bounce' : ''}`).join(', ') + ']'
      : '';
    const spawns = s.spawns.length
      ? ' spawns[' + s.spawns.map((x) => `${x.enemy}${x.delay ? '+' + x.delay + 'ms' : ''}`).join(', ') + ']'
      : '';
    console.log(`  ${i + 1}. ${s.movement} [${(s.durations || []).join('/')}] spd=${s.speed ?? '-'}${shots}${spawns}`);
  });
}

console.log('\nENEMY SHOTS');
for (const [k, v] of Object.entries(enemies)) {
  if (!v.shots.length) continue;
  console.log(k, v.shots.map((s) => `${s.damage}dmg/${s.attackDelay}ms/ang${s.angleInc}`).join(' | '));
}

console.log('\nDEADSHOT / DEADSPAWN');
for (const [k, v] of Object.entries(enemies)) {
  if (v.deadshot) console.log(k, 'acid', v.deadshot.damage + 'dmg', v.deadshot.life + 'ms',
    v.deadshot.destroyable ? 'projectile' : '');
  if (v.deadspawn) console.log(k, '->', v.deadspawn.count + 'x' + v.deadspawn.enemy);
}

console.log('\nLEVELS');
for (const l of levels) {
  console.log(`${l.name}: waves ${l.waves}, bossZones ${l.bossZones}, end ${l.lastWaveEnd / 1000}s, max ${l.maxConcurrent}, types ${l.enemyTypes.length}, spawnCap ${l.totalSpawnCap}`);
}

console.log('\nSOUNDS'); console.log(Object.keys(soundVolumes).join(', '));
console.log('\nPLAYER ATTRIBS');
if (playerAttribs) for (const [k, v] of Object.entries(playerAttribs)) console.log(' ', k, '=', v);
console.log('\nMISSIONS', missionTypes.map((m) => `${m.value}:${m.name}`).join(' '));
console.log('\nMISSION MATRIX');
for (const m of missionTable) {
  console.log(m.name.padEnd(24), 'reward', String(m.reward).padEnd(6), 'target', String(m.target).padEnd(8),
    Object.entries(m.tiers).map(([t, v]) => `slot${t}: ${v.reward}/${v.target}`).join('  '));
}
console.log('\nPLAYER BASE ATTRIBS');
if (resetAttribs) for (const [k, v] of Object.entries(resetAttribs)) console.log(' ', k, '=', v);
console.log('\nBOSS WAVES');
for (const l of levels) console.log(l.name, JSON.stringify(l.bossWaves));
