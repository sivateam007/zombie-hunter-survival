/*
 * Zombie Hunter: Survival — survivor log
 * A tiny JSON-backed leaderboard. No database, no dependencies: the whole
 * service is one Node process, which is exactly what a free Render instance
 * wants. Writes are atomic (temp file + rename) so a crash mid-write cannot
 * corrupt the board.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const MODES = ['endless', 'campaign'];
const MAX_ROWS_PER_MODE = 120;

function cleanName(raw) {
  let name = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f]/g, '');
  name = name.replace(/\s+/g, ' ').trim();
  if (!name) name = 'HUNTER';
  return name.slice(0, 14).toUpperCase();
}

function int(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Validate + normalise an incoming score entry. Returns null when unusable. */
function normalise(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const mode = MODES.includes(entry.mode) ? entry.mode : 'endless';
  const wave = int(entry.wave, 0, 9999);
  const kills = int(entry.kills, 0, 999999);
  const score = int(entry.score, 0, 99999999);
  if (wave === 0 && kills === 0 && score === 0) return null;
  return {
    name: cleanName(entry.name),
    mode,
    wave,
    kills,
    score,
    ts: Date.now()
  };
}

function compare(a, b) {
  if (b.wave !== a.wave) return b.wave - a.wave;
  if (b.score !== a.score) return b.score - a.score;
  if (b.kills !== a.kills) return b.kills - a.kills;
  return a.ts - b.ts;
}

function createLedger(filePath, options) {
  const opts = options || {};
  const cap = opts.cap || MAX_ROWS_PER_MODE;
  let rows = [];

  function load() {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      rows = Array.isArray(parsed.rows) ? parsed.rows.filter((r) => r && r.name && r.mode) : [];
    } catch (err) {
      rows = [];
    }
    return rows;
  }

  function persist() {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const tmp = filePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ rows, updated: Date.now() }, null, 2));
      fs.renameSync(tmp, filePath);
    } catch (err) {
      /* a read-only filesystem should never take the game down */
      console.error('[ledger] could not persist:', err.message);
    }
  }

  function list(mode, limit) {
    const m = MODES.includes(mode) ? mode : 'endless';
    return rows.filter((r) => r.mode === m).sort(compare).slice(0, limit || 50);
  }

  function add(entry) {
    const row = normalise(entry);
    if (!row) return { ok: false, error: 'invalid' };

    const existing = rows.find((r) => r.mode === row.mode && r.name === row.name);
    if (existing) {
      /* keep the best run per callsign */
      if (compare(row, existing) < 0) {
        Object.assign(existing, row);
      } else {
        existing.ts = row.ts;
      }
    } else {
      rows.push(row);
    }

    /* trim per mode, keeping the strongest */
    MODES.forEach((m) => {
      const inMode = rows.filter((r) => r.mode === m).sort(compare);
      const keep = new Set(inMode.slice(0, cap).map((r) => r.name));
      rows = rows.filter((r) => r.mode !== m || keep.has(r.name));
    });

    persist();
    const board = list(row.mode, 50);
    const rank = board.findIndex((r) => r.name === row.name) + 1;
    return { ok: true, rank, rows: board };
  }

  function size() {
    return rows.length;
  }

  load();
  return { add, list, load, persist, size, normalise, cleanName };
}

module.exports = { createLedger, normalise, cleanName, compare, MODES };
