'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8400 + Math.floor(Math.random() * 500);
const BASE = 'http://127.0.0.1:' + PORT;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zh-server-'));
const dataFile = path.join(dir, 'board.json');

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE + '/api/health');
      if (res.ok) return await res.json();
    } catch (err) { /* not up yet */ }
    await wait(120);
  }
  throw new Error('server did not become healthy');
}

async function run() {
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(PORT), DATA_FILE: dataFile, HOST: '127.0.0.1',
      /* this file checks real submissions in isolation, not the practice board */
      SEED_BOARD: 'off'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  try {
    const health = await waitForHealth(12000);
    assert.strictEqual(health.ok, true, 'health endpoint answers');

    /* static game */
    const page = await fetch(BASE + '/');
    assert.strictEqual(page.status, 200);
    assert.ok((page.headers.get('content-type') || '').includes('text/html'), 'index is html');
    const html = await page.text();
    assert.ok(html.includes('ZOMBIE') && html.includes('js/game.js'), 'index serves the game');

    const css = await fetch(BASE + '/css/style.css');
    assert.strictEqual(css.status, 200);
    assert.ok((css.headers.get('content-type') || '').includes('text/css'), 'css mime type');

    const js = await fetch(BASE + '/js/rig.js');
    assert.strictEqual(js.status, 200);
    assert.ok((js.headers.get('content-type') || '').includes('javascript'), 'js mime type');

    /* server internals and traversal are closed */
    const denied = await fetch(BASE + '/server/index.js');
    assert.strictEqual(denied.status, 403, 'server sources are not public');
    const traversal = await fetch(BASE + '/..%2fserver%2findex.js');
    assert.ok(traversal.status === 403 || traversal.status === 404, 'path traversal is blocked');
    const missing = await fetch(BASE + '/nope.html');
    assert.strictEqual(missing.status, 404, 'missing files 404');

    /* score submission */
    let post = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'siva', mode: 'endless', wave: 7, kills: 61, score: 2400 })
    });
    let body = await post.json();
    assert.strictEqual(post.status, 200);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.rank, 1, 'first submission ranks first');

    post = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'magesh', mode: 'endless', wave: 11, kills: 90, score: 5200 })
    });
    body = await post.json();
    assert.strictEqual(body.rank, 1, 'stronger run takes rank 1');

    post = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(post.status, 422, 'invalid submissions are rejected');

    post = await fetch(BASE + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json'
    });
    assert.strictEqual(post.status, 400, 'malformed bodies are rejected');

    const board = await (await fetch(BASE + '/api/leaderboard?mode=endless')).json();
    assert.strictEqual(board.rows.length, 2, 'both rows are stored');
    assert.deepStrictEqual(board.rows.map((r) => r.name), ['MAGESH', 'SIVA'], 'board is ranked');

    const emptyBoard = await (await fetch(BASE + '/api/leaderboard?mode=campaign')).json();
    assert.strictEqual(emptyBoard.rows.length, 0, 'campaign board starts empty');

    assert.ok(fs.existsSync(dataFile), 'the ledger file is created on disk');
    assert.ok(!stderr.includes('Error'), 'the server logged no errors: ' + stderr);
  } finally {
    child.kill('SIGTERM');
    await wait(150);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('server.test.js ✓ health, static files, traversal guard, scoring and ranking');
}

module.exports = run();
