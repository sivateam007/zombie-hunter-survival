'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLedger, normalise, cleanName } = require('../server/ledger');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zh-ledger-'));
const file = path.join(dir, 'board.json');
const ledger = createLedger(file);

/* validation */
assert.strictEqual(normalise(null), null, 'null entries are rejected');
assert.strictEqual(normalise({}), null, 'empty entries are rejected');
assert.strictEqual(cleanName('  '), 'HUNTER', 'blank names fall back');
assert.strictEqual(cleanName('a'.repeat(40)).length, 14, 'names are clamped');
assert.strictEqual(cleanName('si\u0000va'), 'SIVA', 'control characters are stripped');

/* ranking */
let res = ledger.add({ name: 'siva', mode: 'endless', wave: 4, kills: 20, score: 400 });
assert.ok(res.ok && res.rank === 1, 'first entry ranks first');
res = ledger.add({ name: 'magesh', mode: 'endless', wave: 9, kills: 40, score: 900 });
assert.strictEqual(res.rank, 1, 'higher wave takes the top spot');
res = ledger.add({ name: 'allen', mode: 'endless', wave: 9, kills: 12, score: 300 });
assert.strictEqual(res.rank, 2, 'tie on wave falls back to score');

let board = ledger.list('endless');
assert.deepStrictEqual(board.map((r) => r.name), ['MAGESH', 'ALLEN', 'SIVA'], 'board is sorted');

/* best run per callsign wins */
ledger.add({ name: 'siva', mode: 'endless', wave: 2, kills: 5, score: 50 });
board = ledger.list('endless');
assert.strictEqual(board.length, 3, 'no duplicate rows for the same callsign');
assert.strictEqual(board.find((r) => r.name === 'SIVA').wave, 4, 'a worse run does not overwrite the best');

/* modes are independent */
ledger.add({ name: 'siva', mode: 'campaign', wave: 12, kills: 300, score: 5000 });
assert.strictEqual(ledger.list('campaign').length, 1, 'campaign board is separate');
assert.strictEqual(ledger.list('endless').length, 3, 'endless board is untouched');

/* persistence */
assert.ok(fs.existsSync(file), 'ledger file is written');
const reloaded = createLedger(file);
assert.strictEqual(reloaded.list('endless').length, 3, 'rows survive a reload');
assert.strictEqual(reloaded.list('endless')[0].name, 'MAGESH', 'order survives a reload');

/* corrupt file degrades to an empty board */
fs.writeFileSync(file, 'not json');
const recovered = createLedger(file);
assert.strictEqual(recovered.list('endless').length, 0, 'corrupt ledgers reset instead of crashing');

/* cap */
const capped = createLedger(path.join(dir, 'capped.json'), { cap: 3 });
for (let i = 0; i < 10; i++) {
  capped.add({ name: 'p' + i, mode: 'endless', wave: i + 1, kills: i, score: i * 10 });
}
assert.strictEqual(capped.list('endless').length, 3, 'board is capped');
assert.strictEqual(capped.list('endless')[0].name, 'P9', 'the strongest runs are kept');

fs.rmSync(dir, { recursive: true, force: true });
console.log('ledger.test.js ✓ ranking, dedupe, sanitising, persistence and caps');
