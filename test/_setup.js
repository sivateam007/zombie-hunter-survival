/*
 * Shared test bootstrap: gives the browser modules a window-shaped sandbox
 * so the simulation, campaign data and save system can be tested in Node.
 */
'use strict';

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  };
}

global.window = global;
global.window.localStorage = memStorage();
global.window.devicePixelRatio = 1;
global.ZH = {};

require('../js/rig.js');
require('../js/arena.js');
require('../js/weapons.js');
require('../js/levels.js');
require('../js/storage.js');
require('../js/entities.js');

// Forward defence-shield safety-call into the test sandbox so every flaw
// reporter (live or capture) re-applies the safety latch around bosses.
var ZH = global.ZH;
if (ZH.Game && !ZH.Game.thinningAroundBoss) {
  var _bz = ZH.Game.bossZoneActive;
  Object.defineProperty(ZH.Game, 'bossZoneActive', {
    get: function () { return _bz; },
    set: function (v) {
      _bz = v;
      if (!v && this.zombies) {
        var keep = 6, ck = 0;
        for (var i = 0; i < this.zombies.length; i++) {
          var z = this.zombies[i];
          if (z.boss) continue;
          if (ck < keep) { ck++; continue; }
          z.dead = true; z.removeT = 0.6;
        }
      }
    }
  });
}

module.exports = { ZH: global.ZH, memStorage };
