/*
 * Meow Zombie Hunter — leaderboard client
 * Talks to the little Node service in /server. Every call degrades to an
 * offline answer so the game is fully playable on a flat file host.
 */
window.ZH = window.ZH || {};
(function (ZH) {
  'use strict';

  var BASE = '';
  var TIMEOUT = 4500;

  function request(path, opts) {
    opts = opts || {};
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);
    return fetch(BASE + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).catch(function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  /* The local board is the practice roster plus your own record, so a
     flat-file host still shows a full board instead of a single line. */
  function localRows(mode) {
    var s = ZH.Save.get();
    var rows = (ZH.ROSTER && ZH.ROSTER.ghosts ? ZH.ROSTER.ghosts(mode) : []).slice();
    var mine = mode === 'campaign'
      ? { name: s.name, mode: 'campaign', wave: s.bestLevel || 0,
          kills: s.stats.kills || 0,
          score: (s.stats.kills || 0) * 10 + (s.bestLevel || 0) * 500, local: true }
      : { name: s.name, mode: 'endless', wave: s.stats.bestEndless || 0,
          kills: s.stats.endlessKills || 0,
          score: (s.stats.endlessKills || 0) * 10 + (s.stats.bestEndless || 0) * 500, local: true };
    rows.push(mine);
    rows.sort(function (a, b) {
      if (b.wave !== a.wave) return b.wave - a.wave;
      if (b.score !== a.score) return b.score - a.score;
      return (b.kills || 0) - (a.kills || 0);
    });
    var board = rows.slice(0, 50);
    /* a new hunter (wave 0) is legitimately last; keep that row visible */
    if (board.indexOf(mine) === -1) board[board.length - 1] = mine;
    return board;
  }

  function leaderboard(mode) {
    return request('/api/leaderboard?mode=' + encodeURIComponent(mode || 'endless'))
      .then(function (data) {
        return { rows: data.rows || [], offline: false };
      })
      .catch(function () {
        return { rows: localRows(mode), offline: true };
      });
  }

  function submitScore(entry) {
    return request('/api/score', { method: 'POST', body: entry })
      .then(function (data) {
        return { ok: true, rank: data.rank, rows: data.rows || [] };
      })
      .catch(function () {
        return { ok: false, offline: true };
      });
  }

  function ping() {
    return request('/api/health').then(function (d) { return !!d.ok; }).catch(function () { return false; });
  }

  ZH.Net = { leaderboard: leaderboard, submitScore: submitScore, ping: ping, BASE: BASE };
})(typeof window !== 'undefined' ? window.ZH || (window.ZH = {}) : {});
