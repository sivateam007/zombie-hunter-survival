/*
 * Zombie Hunter: Survival — bootstrap
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

    // After the player finishes picking a weapon, start the first stage.
    // The menu UI now renders the weapon picker immediately, so we can
    // start the game right away if a weapon is already chosen.
    var save = ZH.Save && ZH.Save.get ? ZH.Save.get() : null;
    var startOnMenu = function () {
      if (ZH.Game && ZH.Game.autoStart) {
        ZH.Game.autoStart(0);
      }
    };
    if (save && save.currentWeapon) {
      startOnMenu();
    } else {
      window.addEventListener('pointerdown', function once() {
        window.removeEventListener('pointerdown', once);
        startOnMenu();
      }, { once: true });
    }

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
      console.log('%cZOMBIE HUNTER: SURVIVAL', 'color:#ffb347;font-weight:bold;letter-spacing:2px');
      console.log('Campaign: ' + (ZH.STAGES ? ZH.STAGES.length : 0) + ' stages · ' + ZH.WEAPON_ORDER.length + ' weapons · anime.js motion');
      console.log('%cDeveloped by SIVA', 'color:#9be15d;font-weight:bold;letter-spacing:1px');
      console.log('Build 6 · truthful target ring, per-weapon locks, visible tracers');
    }
  });
})(window.ZH);
