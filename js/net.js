/*
 * Zombie Hunter: Survival — leaderboard client
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

  function localBoard() {
    var s = ZH.Save.get();
    return [
      { name: s.name, mode: 'endless', wave: s.stats.bestEndless, kills: s.stats.endlessKills, local: true }
    ];
  }

  function leaderboard(mode) {
    return request('/api/leaderboard?mode=' + encodeURIComponent(mode || 'endless'))
      .then(function (data) {
        return { rows: data.rows || [], offline: false };
      })
      .catch(function () {
        return { rows: localBoard(), offline: true };
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
