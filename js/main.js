/*
 * Meow Zombie Hunter — bootstrap
 */
(function (ZH) {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var canvas = document.getElementById('game');
    if (!canvas) return;

    ZH.UI.init(ZH.Game);
    ZH.Game.boot(canvas, ZH.UI);

    // Survivor primary-weapon picker on the menu: pick once, every run
    // starts with that weapon.
    var unblockedWeaponIds = (ZH.Save && ZH.Save.get && ZH.Save.get().weapons) ||
      ['gun'];
    ZH.UI.showMenu({ unblockedWeaponIds: unblockedWeaponIds });

    // The menu is the front door: campaign stage list, endless night, arsenal
    // and leaderboard all live there. A run starts only when the player asks
    // for one (CAMPAIGN -> stage -> DEPLOY), so the list is never skipped.

    /* unlock audio on the first gesture */
    var unlock = function () {
      ZH.Audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    /* keep the touch class in sync with the input device */
    window.addEventListener('touchstart', function () {
      document.body.classList.add('touch');
      if (!ZH.Game.touch) ZH.Game.touch = { enabled: true };
      else ZH.Game.touch.enabled = true;
    }, { passive: true, once: true });

    /* prevent page scrolling / pull-to-refresh inside the canvas */
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

    /* a small console signature for the deployed build */
    if (window.console) {
      console.log('%cMEOW ZOMBIE HUNTER', 'color:#ffb347;font-weight:bold;letter-spacing:2px');
      console.log('Campaign: ' + (ZH.STAGES ? ZH.STAGES.length : 0) + ' stages · ' + ZH.WEAPON_ORDER.length + ' weapons');
      console.log('%cDeveloped by SIVA', 'color:#9be15d;font-weight:bold;letter-spacing:1px');
      console.log('Build 11 · 16 stages, 19 city districts, life discharge, running cars, keyboard/gamepad controls');
    }
  });
})(window.ZH);
