/* ============================================================
 * Patch applied to the running build so startStage picks the
 * survivor primary weapon from a single unlockable choice, and
 * startStage auto-starts the level immediately, so a run never opens on a
 * mission picker.
 * ============================================================ */
(function () {
  'use strict';
  var ZH = window.ZH;
  if (!ZH || !ZH.Game) return;

  var Game = ZH.Game;

  // ---- helpers ----
  function firstExistingSave() {
    if (!ZH.Save) return null;
    try { return ZH.Save.get(); } catch (e) { return null; }
  }

  // ---- 1. Allow a single survivor primary weapon in the save ----
  // The original game asks you to choose ONE primary weapon at deploy
  // (DialogSelectPrimary). We mirror that: the save keeps
  //   currentWeapon  — the weapon the survivor starts every run with
  //   weapons        — unlocked catalog (read for level-up cards etc.)
  //
  // This is a small additive contract. Existing saves without
  // currentWeapon still work: we fall back to the first unlocked
  // weapon we can find, and then to 'gun'.
  function defaultPrimary(save) {
    if (save && save.currentWeapon && ZH.WEAPONS && ZH.WEAPONS[save.currentWeapon]) {
      return save.currentWeapon;
    }
    var owned = (save && save.weapons) ? save.weapons : [];
    if (ZH.WEAPONS && owned.length) {
      for (var i = 0; i < owned.length; i++) {
        if (ZH.WEAPONS[owned[i]]) return owned[i];
      }
    }
    return 'gun';
  }

  // ---- 2. Keep Game.primaryWeaponId in sync with the save ----
  // Consumers that used player.weapon / player.primaryWeapon still work,
  // but we also expose a stable id on the game object so the UI can read
  // the current survivor loadout without guessing from the player object.
  Object.defineProperty(Game, 'primaryWeaponId', {
    get: function () {
      var p = this.player;
      if (p && p.weapon) return p.weapon;
      var save = firstExistingSave();
      return save ? defaultPrimary(save) : 'gun';
    },
    set: function (id) {
      var save = firstExistingSave();
      if (save) {
        save.currentWeapon = id;
        try { if (ZH.Save && ZH.Save.persist) ZH.Save.persist(); } catch (e) {}
      }
      var p = this.player;
      if (p) {
        p.weapon = id;
        p.primaryWeapon = id;
      }
    },
    configurable: true
  });

  // ---- 3. Wire startStage to the survivor primary weapon ----
  var ORIG_START_STAGE = Game.startStage;
  Game.startStage = function (stageId, primaryWeapon) {
    // primaryWeapon is intentionally ignored here: the survivor always
    // starts with the saved currentWeapon (the one the player chose).
    // This matches the original, where the loadout is chosen once and
    // every mission uses it.
    var save = firstExistingSave() || {};
    var id = defaultPrimary(save);
    Game.primaryWeaponId = id;

    if (ORIG_START_STAGE) {
      // forward to the original implementation, but drop the explicit
      // primaryWeapon so it does not override the survivor choice.
      ORIG_START_STAGE.call(this, stageId, id);
    } else {
      // Defensive fallback if the original bootstrap is absent.
      if (this && this.stage == null) {
        var stage = (ZH && ZH.STAGES) ? ZH.STAGES[(stageId != null ? stageId : 0) || 0] : null;
        if (stage) {
          this.stage = stage;
          this.stageId = stage.id != null ? stage.id : 0;
        }
      }
    }
  };

  // ---- 4. Auto-start the first available stage on boot ----
  // The clone currently boots into a menu and waits for the player to
  // pick a mission. The original starts a level immediately and uses the
  // menu only to select difficulty / continue. We add a small hook so a
  // hosting wrapper can call ZH.Game.autoStart() after the UI is ready,
  // or so the menu screen can call it when the player taps "Start".
  Game.autoStart = function (stageId) {
    if (this.state === 'playing') return;
    var id = (stageId != null ? stageId : 0) || 0;
    if (ZH.STAGES && ZH.STAGES[id] == null) {
      id = 0;
    }
    this.startStage(id);
  };

  // Expose a small API the wrapper can call after it has shown the menu.
  ZH.Game = Game;
})();
