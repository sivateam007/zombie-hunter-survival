/*
 * Zombie Hunter: Survival — server
 * One dependency-free Node process that serves the static game and the
 * leaderboard API. Designed for a Render web service (PORT + health check).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createLedger } = require('./ledger');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data', 'leaderboard.json');

const ledger = createLedger(DATA_FILE);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
};

const DENY_DIRS = new Set(['server', 'data', 'test', 'node_modules', '.git', '.freebuff']);

/* crude but effective per-IP write throttle */
const hits = new Map();
function allowed(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (list.length >= 24) { hits.set(ip, list); return false; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 4000) hits.clear();
  return true;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;

  if (pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      rows: ledger.size(),
      uptime: Math.round(process.uptime()),
      now: new Date().toISOString()
    });
  }

  if (pathname === '/api/leaderboard' && req.method === 'GET') {
    const mode = url.searchParams.get('mode') || 'endless';
    return sendJson(res, 200, { ok: true, mode, rows: ledger.list(mode, 50) });
  }

  if (pathname === '/api/score' && req.method === 'POST') {
    const ip = (req.socket.remoteAddress || 'unknown');
    if (!allowed(ip)) return sendJson(res, 429, { ok: false, error: 'slow down' });

    let body;
    try {
      const raw = await readBody(req, 8192);
      body = JSON.parse(raw || '{}');
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: 'bad body' });
    }
    const result = ledger.add(body);
    if (!result.ok) return sendJson(res, 422, { ok: false, error: result.error });
    return sendJson(res, 200, { ok: true, rank: result.rank, rows: result.rows });
  }

  return sendJson(res, 404, { ok: false, error: 'not found' });
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method not allowed');
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (err) {
    res.writeHead(400);
    return res.end('Bad request');
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((s) => s === '..' || s === '.' || s.startsWith('.'))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (DENY_DIRS.has(segments[0])) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const filePath = path.join(ROOT, ...segments);
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    /* code must revalidate so a deploy can never serve a stale build to a
       player who already opened the game once; images/fonts can sit in cache */
    const revalidate = ['.html', '.js', '.css', '.json', '.webmanifest'].includes(ext);
    const lastModified = new Date(stat.mtimeMs).toUTCString();
    const since = req.headers['if-modified-since'];
    if (revalidate && since && new Date(since).getTime() >= Math.floor(stat.mtimeMs / 1000) * 1000) {
      res.writeHead(304, { 'Cache-Control': 'no-cache', 'Last-Modified': lastModified });
      return res.end();
    }
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Last-Modified': lastModified,
      'Cache-Control': revalidate ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.end());
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
    "script-src 'self'; connect-src 'self'; font-src 'self' data:; base-uri 'none'; form-action 'none'");
  res.on('finish', () => {
    if (process.env.LOG_REQUESTS) {
      console.log(`${req.method} ${req.url} → ${res.statusCode} ${Date.now() - started}ms`);
    }
  });

  let url;
  try {
    url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  } catch (err) {
    res.writeHead(400);
    return res.end('Bad request');
  }

  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      console.error('[api]', err);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'server error' });
    });
    return;
  }
  serveStatic(req, res, url);
});

server.on('error', (err) => {
  console.error('[server]', err.message);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Zombie Hunter: Survival listening on http://${HOST}:${PORT}`);
  console.log(`Survivor log: ${DATA_FILE} (${ledger.size()} rows)`);
});

function shutdown() {
  console.log('Shutting down…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 4000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
