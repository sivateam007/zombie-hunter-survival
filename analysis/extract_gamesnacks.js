/*
 * GameSnacks bundle miner.
 *
 * Reads the shipped Phaser bundle (zh_orig_src/js_game.js) and the already
 * parsed level JSON, and writes plain-text extracts under analysis/ so the
 * game's real tables can be read and compared instead of remembered.
 *
 * Run: node analysis/extract_gamesnacks.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'zh_orig_src', 'js_game.js');
const OUT = __dirname;
const src = fs.readFileSync(SRC, 'utf8');

function wrap(text) {
  return text
    .replace(/;(?=[a-zA-Z_$.])/g, ';\n')
    .replace(/\}(?=[a-zA-Z_$.])/g, '}\n')
    .replace(/\},\{/g, '},\n{');
}

function slice(name, from, to) {
  const body = wrap(src.slice(from, to));
  fs.writeFileSync(path.join(OUT, name), body);
  return { name, bytes: body.length, lines: body.split('\n').length };
}

/* ---------------- 1. raw regions ---------------- */
const regions = [
  slice('orig_01_constants.txt', 1526500, 1536600),
  slice('orig_02_enemies_bosses.txt', 1536400, 1554200),
  slice('orig_03_levels.txt', 1554100, 1587300),
  slice('orig_04_skills.txt', 1587200, 1599600),
  slice('orig_05_weapons.txt', 1599000, 1712000),
  slice('orig_06_pickups.txt', 1712000, 1745000)
];

/* ---------------- 2. constants table ---------------- */
const constants = {};
const constRe = /\b([A-Z][A-Z0-9_]{3,})\s*=\s*(-?\d+(?:\.\d+)?(?:E\d+)?)/g;
let m;
while ((m = constRe.exec(src))) {
  if (!(m[1] in constants)) constants[m[1]] = Number(m[2]);
}
const wanted = Object.keys(constants).filter((k) =>
  /^(TIME_|DELAY_|MAX_|MIN_|BONUS_|DIFFICULTY_|FREQ_|SKILL_|BOSS_ZONE|LEVEL_|RES_|SOUND_)/.test(k)).sort();

/* ---------------- 3. weapons from the prototype dump ---------------- */
const protoPath = path.join(__dirname, '..', 'zh_orig_assets', 'weapons_prototypes.json');
const protos = JSON.parse(fs.readFileSync(protoPath, 'utf8'));
const weapons = [];
for (const key of Object.keys(protos)) {
  const s = protos[key];
  const grab = (re) => { const x = s.match(re); return x ? x[1] : null; };
  const nums = (re) => { const out = []; let x; const rr = new RegExp(re.source, 'g'); while ((x = rr.exec(s))) out.push(x[1]); return out; };
  weapons.push({
    key,
    name: grab(/this\.name="([^"]+)"/),
    evoName: grab(/this\.evoName="([^"]+)"/),
    evoSupp: grab(/this\.evoSupp="([^"]+)"/),
    cooldown: grab(/this\.cooldown=([0-9.E]+)/),
    speed: grab(/this\.speed=([0-9.E]+)/),
    range: grab(/this\.range=([0-9.E]+)/),
    radius: grab(/this\.radius=([0-9.E]+)/),
    life: grab(/this\.life=([0-9.E]+)/),
    damageMul: nums(/\(\w\*=([0-9.]+)\)/),
    counts: nums(/getCount:function\(\)\{([^}]*)\}/),
    supportsSplash: /explosive/.test(s),
    destroysShots: /invalidateProjectiles|killEnmShots/.test(s),
    sourceChars: s.length
  });
}

/* ---------------- 4. parsed levels ---------------- */
const levelDir = path.join(__dirname, '..', 'zh_orig_assets', 'extracted_levels');
const levels = [];
if (fs.existsSync(levelDir)) {
  for (const file of fs.readdirSync(levelDir).filter((f) => /_parsed\.json$/.test(f)).sort()) {
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(levelDir, file), 'utf8')); } catch (e) { continue; }
    const stage = data.level || data.stage || data;
    const waves = stage.waves || data.waves || [];
    const bossWaves = waves.filter((w) => w.bossZone || w.bossZoneActive);
    const enemies = [...new Set(waves.map((w) => w.enemy).filter(Boolean))];
    const lastWave = waves.reduce((a, w) => Math.max(a, (w.startTime || 0) + (w.duration || 0)), 0);
    levels.push({
      file,
      name: stage.name || data.name,
      tile: stage.tile || stage.map,
      multiplier: stage.multiplier,
      rewards: stage.rewards,
      waves: waves.length,
      enemies: enemies.length,
      bossZones: bossWaves.length,
      lastWaveEndSec: Math.round(lastWave / 1000),
      durations: [...new Set(waves.map((w) => w.duration))].slice(0, 6),
      maxes: [...new Set(waves.map((w) => w.max))].slice(0, 12)
    });
  }
}

/* ---------------- 5. enemies table ---------------- */
const enemies = {};
const enemyRe = /EnemiesData\.([a-z0-9_]+)=\{([^}]*?)\}(?=[,;]|EnemiesData|const|var|function|$)/g;
let em;
while ((em = enemyRe.exec(src))) {
  const body = em[2];
  const num = (k) => { const x = body.match(new RegExp('(?:^|,)' + k + ':(-?[0-9.E]+)')); return x ? Number(x[1]) : null; };
  enemies[em[1]] = {
    speed: num('speed'), health: num('health'), range: num('range'),
    damage: num('damage'), attackDelay: num('attackDelay'), bonus: num('bonus'),
    mass: num('mass'), scale: num('scale'),
    static: /static:!0/.test(body),
    healthbar: /healthbar:!0/.test(body),
    shots: (body.match(/shots:\[/g) || []).length,
    deaddrop: (body.match(/deaddrop:\{([^}]*)\}/) || [])[1] || null
  };
}

/* ---------------- 6. boss classes + movement AI ---------------- */
const bossClasses = [];
const bossRe = /function\s+(\w*Boss\w*)\s*\(/g;
while ((m = bossRe.exec(src))) bossClasses.push(m[1]);
const movements = {};
const movRe = /\b(BOSS_MOVEMENT_[A-Z]+)\s*=\s*(\d+)/g;
while ((m = movRe.exec(src))) movements[m[1]] = Number(m[2]);

/* ---------------- 7. skills ---------------- */
const skills = [];
const skillRe = /PlayerSkillsData\[(SKILL_[A-Z]+)\]=\{([^}]*)\}/g;
while ((m = skillRe.exec(src))) {
  const body = m[2];
  const values = (body.match(/values:\[([^\]]*)\]/) || [])[1];
  skills.push({
    id: m[1],
    attrib: (body.match(/attrib:"([^"]+)"/) || [])[1],
    name: (body.match(/name:"([^"]+)"/) || [])[1],
    values: values ? values.split(',').map(Number) : null
  });
}

/* ---------------- 8. sounds + text keys ---------------- */
const sounds = [...new Set((src.match(/SOUND_VOLUMES\.([a-zA-Z0-9_]+)=/g) || []).map((x) => x.slice(14, -1)))];
const textKeys = [...new Set((src.match(/Str\("([A-Z0-9_]+)"\)/g) || []).map((x) => x.slice(5, -2)))];
const textPrefixes = {};
for (const k of textKeys) {
  const p = k.split('_').slice(0, 2).join('_');
  textPrefixes[p] = (textPrefixes[p] || 0) + 1;
}

const report = {
  regions,
  sourceBytes: src.length,
  constants: Object.fromEntries(wanted.map((k) => [k, constants[k]])),
  weapons,
  levels,
  enemies,
  enemyCount: Object.keys(enemies).length,
  bossClasses,
  movements,
  skills,
  sounds,
  textKeyCount: textKeys.length,
  textPrefixes
};
fs.writeFileSync(path.join(OUT, 'gamesnacks_extract.json'), JSON.stringify(report, null, 2));

console.log('regions:');
regions.forEach((r) => console.log('  ' + r.name, r.lines + ' lines', r.bytes + ' chars'));
console.log('constants:', wanted.length);
console.log('weapons:', weapons.length);
console.log('levels:', levels.length, levels.map((l) => l.file + ':' + l.waves + 'w').join(' '));
console.log('enemies:', Object.keys(enemies).length);
console.log('boss classes:', bossClasses.length, bossClasses.join(','));
console.log('movements:', JSON.stringify(movements));
console.log('skills:', skills.map((s) => s.id + '/' + s.attrib + '/' + (s.values ? s.values.length + 'lv' : '?')).join(' '));
console.log('sounds:', sounds.length);
console.log('text keys:', textKeys.length, JSON.stringify(textPrefixes));
