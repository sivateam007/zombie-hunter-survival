/*
 * Zombie Hunter: Survival — interface
 * DOM panels + anime.js motion. The canvas owns the world; everything here
 * is chrome: menus, shop, briefing, results, leaderboard and the live HUD.
 */
window.ZH = window.ZH || {};
(function (ZH) {
  'use strict';
  var G = null;
  var last = {};
  var menuRAF = null;
  var menuT = 0;
  var boardMode = 'endless';
  var menuOpts = {};

  function $(id) { return document.getElementById(id); }
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  /* skill values are small decimals (0.1) or big numbers (435000) */
  function fmtNum(v) {
    if (v == null) return '—';
    return (Math.round(v * 100) / 100).toLocaleString();
  }

  var UI = {
    init: function (game) {
      G = game;
      this.el = {
        hud: $('hud'),
        hpFill: $('hp-fill'),
        hpText: $('hp-text'),
        hpBar: document.querySelector('.bar.hp'),
        dashFill: $('dash-fill'),
        dashBar: $('dash-fill').parentElement,
        mag: $('hud-mag'),
        magMax: $('hud-magmax'),
        weaponName: $('hud-weapon-name'),
        weaponType: $('hud-weapon-type'),
        reload: $('reload-fill'),
        reloadBar: document.querySelector('.reload-bar'),
        coins: $('hud-coins'),
        score: $('hud-score'),
        wave: $('hud-wave'),
        left: $('hud-left'),
        mode: $('hud-mode'),
        level: $('hud-level'),
        bossBar: $('boss-bar'),
        bossFill: $('boss-fill'),
        bossName: $('boss-name'),
        slots: $('weapon-slots'),
        items: $('hud-items'),
        banner: $('banner'),
        toast: $('toast')
      };
      this.bind();
      this.renderLevels();
      this.renderShop();
      this.refreshWeapons();
      this.updateMenuStats();
      this.applyAudio();
      this.startMenuHunter();
    },

    /* ------------------------------ screens ------------------------------ */
    showOnly: function (id) {
      /* menu-ish screens freeze a live run instead of leaving the horde
         moving and a level-up card stack sitting over the briefing */
      if (/^screen-(menu|levels|briefing|shop|board)$/.test(id) && G &&
          (G.state === 'playing' || G.state === 'levelup')) {
        G.state = 'menu';
        var ov = document.getElementById('levelup-overlay');
        if (ov) ov.style.display = 'none';
      }
      document.querySelectorAll('.screen').forEach(function (s) {
        if (s.id !== id && s.classList.contains('is-open')) ZH.Anim.hide(s);
      });
      ZH.Anim.show($(id));
    },

    hideScreens: function () {
      document.querySelectorAll('.screen.is-open').forEach(function (s) { ZH.Anim.hide(s); });
      this.el.hud.classList.add('is-active');
      this.el.hud.setAttribute('aria-hidden', 'false');
    },

    showMenu: function (opts) {
      opts = opts || {};
      this.showOnly('screen-menu');
      this.el.hud.classList.remove('is-active');
      this.el.hud.setAttribute('aria-hidden', 'true');
      this.updateMenuStats();
      this.renderShop();
      ZH.Anim.staggerIn($('screen-menu'), '[data-anim]');
      this.bindMenuButtons(opts);
      this.renderMenuWeaponPick(opts);
    },

    /* menu buttons that depend on the options showMenu() received.
       Core buttons are bound once in bind(); this only records opts. */
    bindMenuButtons: function (opts) {
      menuOpts = opts || {};
    },

    showLevels: function () {
      this.renderLevels();
      this.showOnly('screen-levels');
      ZH.Anim.staggerIn($('levels-list'), '.level-card');
    },

    showShop: function () {
      this.renderShop();
      this.showOnly('screen-shop');
      ZH.Anim.staggerIn($('screen-shop'), '.weapon-tile, .upgrade');
    },

    showHelp: function () { this.showOnly('screen-help'); },

    showBriefing: function (level, mode) {
      var chapter = ZH.chapterOf ? ZH.chapterOf(level) : { name: 'CAMPAIGN' };
      $('brief-name').textContent = mode === 'endless' ? 'ENDLESS NIGHT' : level.name.toUpperCase();
      $('brief-chapter').textContent = mode === 'endless'
        ? 'SURVIVAL'
        : 'STAGE ' + ((level.id || 0) + 1) + ' OF ' + (ZH.STAGES ? ZH.STAGES.length : 6) +
          ' · ' + chapter.name;
      $('brief-text').textContent = mode === 'endless'
        ? 'The waves never stop. Survive as long as you can.'
        : 'Survive ' + Math.round((ZH.TIME_LEVEL_COMPLETED || 1200) / 60) +
          ' minutes. The horde runs on the original wave schedule and the boss zone freezes the clock.';
      $('brief-objective').textContent = mode === 'endless'
        ? 'Survive as long as you can.'
        : 'Survive ' + Math.round((ZH.TIME_LEVEL_COMPLETED || 1200) / 60) + ' minutes and clear every boss zone.';
      var roster = ZH.stageRoster ? ZH.stageRoster(level) : [];
      $('brief-horde').textContent = mode === 'endless' ? 'Everything, eventually'
        : (roster.map(function (k) { return ZH.enemyName ? ZH.enemyName(k) : k; }).join(', ') || 'Zombies');
      $('brief-reward').textContent = mode === 'endless' ? 'Scrap per wave' : ((level.rewards && level.rewards[0]) + ' scrap');
      var start = $('btn-start');
      start.querySelector('span').textContent = mode === 'endless' ? 'BEGIN THE NIGHT' : 'DEPLOY';
      start.querySelector('em').textContent = mode === 'endless'
        ? 'No extraction' : 'Stage ' + ((level.id || 0) + 1) + ' · ' + level.name;
      this.renderLoadout();
      this.renderDifficulty();
      this.showOnly('screen-briefing');
    },

    /* normal / hard / insane — the original's three difficulty steps */
    renderDifficulty: function () {
      var list = $('diff-list');
      if (!list || !ZH.DIFFICULTIES) return;
      var save = ZH.Save.get();
      var cur = save.difficulty || 'normal';
      list.innerHTML = '';
      ZH.DIFFICULTIES.forEach(function (d) {
        var b = document.createElement('button');
        b.className = 'loadout-chip' + (cur === d.id ? ' is-active' : '');
        b.innerHTML = '<span>' + d.name + '</span><span>x' + d.reward + '</span>';
        b.title = d.note;
        b.addEventListener('click', function () {
          ZH.Audio.play('click');
          ZH.Save.setDifficulty(d.id);
          UI.renderDifficulty();
        });
        list.appendChild(b);
      });
    },

    renderLoadout: function () {
      var list = $('loadout-list');
      if (!list) return;
      list.innerHTML = '';
      var save = ZH.Save.get();
      /* the original lets you pick any primary at deploy (DialogSelectPrimary),
         so the whole 14-weapon arsenal is listed — picked guns stay unlocked */
      (ZH.WEAPON_ORDER || []).forEach(function (id) {
        var w = ZH.WEAPONS[id];
        if (!w || w.evoOnly) return;
        var owned = save.weapons.indexOf(id) !== -1;
        var b = document.createElement('button');
        b.className = 'loadout-chip' + (save.currentWeapon === id ? ' is-active' : '') +
          (owned ? '' : ' is-locked');
        b.innerHTML = '<span>' + w.short + '</span><span>' + (owned ? w.mag : 'NEW') + '</span>';
        b.title = w.name + ' — ' + (w.desc || '');
        b.addEventListener('click', function () {
          ZH.Audio.play('click');
          save.currentWeapon = id;
          if (!owned) {
            save.weapons.push(id);
            if (window.ZH && ZH.Anim) ZH.Anim.toast(w.name.toUpperCase() + ' UNLOCKED', 'good');
          }
          ZH.Save.persist();
          UI.renderLoadout();
          UI.refreshWeapons();
        });
        list.appendChild(b);
      });
    },

    showPause: function () {
      this.showOnly('screen-pause');
      this.el.hud.classList.remove('is-active');
    },

    /* Build the 3-card offer pool, same shape as the original's
       ShowSkillSlots(3): a new weapon, a weapon level, or a supply.
       Everything comes out of the real catalogue in weapons.js. */
    pickOffers: function () {
      var p = (G && G.player) || {};
      var runWeapons = p.weapons || {};
      var runSupplies = p.supplies || {};
      var pool = [];

      // 1. a weapon the survivor is not carrying yet
      (ZH.WEAPON_ORDER || []).forEach(function (id) {
        var w = ZH.WEAPONS && ZH.WEAPONS[id];
        if (!w || w.evoOnly) return;
        if (runWeapons[id]) return;
        pool.push({ type: 'weapon', id: id, name: w.name, desc: w.desc || '' });
      });

      // 2. level up a weapon already in hand (level 6 evolves it)
      Object.keys(runWeapons).forEach(function (id) {
        var w = ZH.WEAPONS && ZH.WEAPONS[id];
        var st = runWeapons[id] || {};
        if (!w || w.evoOnly) return;
        var lvl = st.level || 1;
        if (lvl >= 8) return;
        var evoHint = '';
        if (lvl === 5 && w.evo && ZH.WEAPONS[w.evo]) {
          var sup = ZH.SUPPLIES[w.supply];
          evoHint = sup
            ? ' · at 6 it becomes ' + ZH.WEAPONS[w.evo].name + ' if you hold ' + sup.name
            : '';
        }
        pool.push({
          type: 'upgrade', id: id,
          name: w.name + ' LV ' + (lvl + 1),
          desc: 'More damage for your ' + w.name + '.' + evoHint
        });
      });

      // 3. a supply: new or one level higher, exactly as in the original
      (ZH.SUPPLY_IDS || []).forEach(function (id) {
        var s = ZH.SUPPLIES && ZH.SUPPLIES[id];
        if (!s) return;
        var owned = runSupplies[id] || 0;
        if (s.consumable) {
          pool.push({ type: 'supply', id: id, name: s.name, desc: ZH.supplyDesc(id, 1) });
          return;
        }
        if (owned >= (s.maxLevel || 5)) return;
        var lvl = owned + 1;
        pool.push({
          type: 'supply', id: id, level: lvl,
          name: s.name + (owned ? ' LV ' + lvl : ''),
          desc: ZH.supplyDesc(id, lvl)
        });
      });

      var picked = [];
      for (var n = 0; n < 3 && pool.length > 0; n++) {
        var idx = Math.floor(Math.random() * pool.length);
        picked.push(pool.splice(idx, 1)[0]);
      }
      return picked;
    },

    showLevelUp: function () {
      if (!G || !G.player) return;
      var picked = UI.pickOffers();
      if (!picked || picked.length === 0) {
        // nothing left to offer — never trap the player in 'levelup'
        G.state = 'playing';
        G.lastTs = performance.now();
        return;
      }
      G.levelUpChoices = picked;
      G.state = 'levelup';
      UI.showLevelUpCard(picked);
    },

    showLevelUpCard: function (choices) {
      var p = G.player;
      var panel = document.getElementById('levelup-overlay');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'levelup-overlay';
        panel.className = 'levelup-overlay';
        document.body.appendChild(panel);
      }
      panel.innerHTML =
        '<div class="levelup-panel">' +
          '<div class="levelup-head">' +
            '<h3>LEVEL ' + (p.level || 1) + ' · GET STRONGER</h3>' +
            '<button class="levelup-x" id="lu-x" aria-label="Close">×</button>' +
          '</div>' +
          '<div class="levelup-desc">Pick one: a new weapon, a weapon upgrade, or a supply.</div>' +
          '<div class="levelup-cards" id="levelup-cards"></div>' +
          '<div class="levelup-foot">' +
            '<button class="btn small" id="lu-reroll">REROLL</button>' +
            '<button class="btn ghost small" id="lu-skip">KEEP PLAYING</button>' +
          '</div>' +
        '</div>';
      panel.classList.add('is-active');
      // the panel markup is rebuilt on every call, so the listeners below
      // are always attached to fresh nodes and never stack
      var cards = panel.querySelector('#levelup-cards');
      cards.innerHTML = '';
      choices.forEach(function (c) {
        var b = document.createElement('button');
        b.className = 'levelup-card' + (c.type === 'supply' ? ' is-supply' : '') +
          (c.type === 'evolution' ? ' is-evo' : '');
        b.dataset.id = c.id;
        b.dataset.type = c.type || 'weapon';
        var tag = c.type === 'supply' ? 'SUPPLY'
          : c.type === 'upgrade' ? 'WEAPON UPGRADE' : 'NEW WEAPON';
        var w = ZH.WEAPONS && ZH.WEAPONS[c.id];
        var sup = ZH.SUPPLIES && ZH.SUPPLIES[c.id];
        if (sup && sup.evoWeapon) {
          var evo = Object.prototype.toString.call(sup.evoWeapon) === '[object Array]'
            ? sup.evoWeapon.slice() : [sup.evoWeapon];
          var names = evo.map(function (k) {
            var base = ZH.WEAPONS[k];
            var grown = base && base.evo ? ZH.WEAPONS[base.evo] : null;
            return base && grown ? base.name + ' → ' + grown.name : '';
          }).filter(Boolean);
          if (names.length) tag += ' · EVOLVES ' + names.join(', ');
        }
        b.innerHTML = '<div class="lc-tag">' + tag + '</div>' +
          '<div class="lc-name">' + c.name + '</div>' +
          '<div class="lc-desc">' + (c.desc || '') + '</div>' +
          '<div class="lc-foot">' +
            '<button class="btn small primary" data-act="take">TAKE</button>' +
            '<button class="btn small ghost" data-act="skip">SKIP</button>' +
          '</div>';
        cards.appendChild(b);
      });
      var binding = function (ev) {
        var btn = ev.target.closest('button');
        if (!btn) return;
        var card = btn.closest('.levelup-card');
        if (!card) return;
        var id = card.dataset.id;
        var ctype = card.dataset.type || 'weapon';
        var save = ZH.Save.get();
        if (btn.dataset.act === 'take') {
          if (ctype === 'upgrade') {
            // level up the weapon already in the run
            if (G && G.player) {
              if (!G.player.weapons) G.player.weapons = {};
              var wv = G.player.weapons[id] || { level: 1, class: id };
              wv.level = (wv.level || 1) + 1;
              G.player.weapons[id] = wv;
              if (save.weapons.indexOf(id) === -1) save.weapons.push(id);
              ZH.Save.persist();
            }
          } else if (ctype === 'supply') {
            var s = ZH.SUPPLIES[id];
            if (G && G.player) {
              if (s && s.consumable) {
                // Medikit / Coins are instant pickups
                if (id === 'medikit') {
                  G.player.hp = Math.min(G.player.maxHp, G.player.hp + 50);
                } else {
                  G.coins = (G.coins || 0) + 1000;
                }
              } else {
                if (!G.player.supplies) G.player.supplies = {};
                G.player.supplies[id] = (G.player.supplies[id] || 0) + 1;
                if (G.recomputeAttribs) G.recomputeAttribs();
              }
            }
          } else {
            if (save.weapons.indexOf(id) === -1) save.weapons.push(id);
            ZH.Save.persist();
            // equip it in the live run so it starts firing right away
            if (G && G.player) {
              if (!G.player.weapons) G.player.weapons = {};
              if (!G.player.weapons[id]) {
                var wd = ZH.WEAPONS[id] || {};
                G.player.weapons[id] = {
                  level: 1, class: id, timer: 0,
                  mag: wd.mag, reloading: 0
                };
              }
            }
          }
          ZH.Audio.play && ZH.Audio.play('click');
          UI.hideLevelUp();
        } else {
          ZH.Audio.play && ZH.Audio.play('click');
          card.style.opacity = '0.35';
          var takeBtns = cards.querySelectorAll('[data-act="take"]');
          var anyLeft = false;
          for (var i = 0; i < takeBtns.length; i++) {
            if (takeBtns[i].textContent === 'TAKE') { anyLeft = true; break; }
          }
          if (!anyLeft) UI.hideLevelUp();
        }
      };
      cards.addEventListener('click', binding);
      var skip = panel.querySelector('#lu-skip');
      if (skip) skip.addEventListener('click', function () {
        ZH.Audio.play && ZH.Audio.play('click');
        UI.hideLevelUp();
      });

      /* close button: same as KEEP PLAYING, but the overlay is never a dead end */
      var xBtn = panel.querySelector('#lu-x');
      if (xBtn) {
        xBtn.addEventListener('click', function () {
          ZH.Audio.play && ZH.Audio.play('click');
          UI.hideLevelUp();
        });
      }

      /* reroll the three offers, paid from run scrap (500 x n, max 5) */
      var rerollBtn = panel.querySelector('#lu-reroll');
      if (rerollBtn) {
        if (!G.luReroll) G.luReroll = 0;
        var rerolls = G.luReroll;
        if (rerolls >= 5) {
          rerollBtn.disabled = true;
          rerollBtn.textContent = 'MAX REROLLS';
        } else {
          var cost = 500 * (rerolls + 1);
          rerollBtn.textContent = 'REROLL · ' + cost;
          rerollBtn.addEventListener('click', function () {
            if ((G.coins || 0) < cost) {
              ZH.Anim.toast && ZH.Anim.toast('Not enough scrap to reroll', 'error');
              ZH.Audio.play && ZH.Audio.play('error');
              return;
            }
            G.coins -= cost;
            G.luReroll = rerolls + 1;
            ZH.Audio.play && ZH.Audio.play('click');
            UI.showLevelUpCard(UI.pickOffers());
          });
        }
      }

      ZH.Anim && ZH.Anim.staggerIn && ZH.Anim.staggerIn(panel, '.levelup-card');
    },

    hideLevelUp: function () {
      var old = document.getElementById('levelup-overlay');
      if (old) {
        old.classList.remove('is-active');
        ZH.Anim.hide && ZH.Anim.hide(old, { duration: 120 });
        setTimeout(function () {
          if (old.parentNode) old.parentNode.removeChild(old);
        }, 140);
      }
      if (G) {
        G.luReroll = 0;
        G.state = 'playing';
        G.lastTs = performance.now();
      }
    },

    showResults: function (res) {
      this.el.hud.classList.remove('is-active');
      var stamp = $('res-stamp');
      stamp.textContent = res.win ? 'MISSION CLEARED' : 'HUNTER DOWN';
      stamp.classList.toggle('is-lost', !res.win);
      $('res-title').textContent = res.win
        ? (res.levelName || res.stage || 'STAGE CLEARED').toUpperCase()
        : 'YOU DIED';
      $('res-sub').textContent = res.win
        ? (res.mode === 'endless' ? 'The night is not over.' :
          (res.nextLevel ? 'The horde thins. Something worse is ahead.' : 'The roof is quiet. You made it.'))
        : (res.mode === 'endless' ? 'Wave ' + res.wave + ' took you. Again.' : 'They got you. The street remembers.');
      $('res-stats').innerHTML =
        '<div><span>' + res.kills + '</span><small>KILLS</small></div>' +
        '<div><span>' + (res.mode === 'endless' ? res.wave : (res.win ? '✓' : '—')) + '</span><small>' +
        (res.mode === 'endless' ? 'WAVES' : 'CLEARED') + '</small></div>' +
        '<div><span>' + res.score + '</span><small>SCORE</small></div>' +
        '<div><span>' + fmtTime(res.time) + '</span><small>TIME</small></div>';
      ZH.Anim.countUp($('res-coins'), 0, res.coins, { duration: 900 });

      var unlock = $('res-unlock');
      if (res.unlock && ZH.WEAPONS[res.unlock]) {
        unlock.classList.add('is-active');
        unlock.textContent = 'UNLOCKED · ' + ZH.WEAPONS[res.unlock].name;
      } else {
        unlock.classList.remove('is-active');
        unlock.textContent = '';
      }

      var submit = $('res-submit');
      var nextBtn = $('btn-next');
      if (res.mode === 'endless') {
        submit.classList.add('is-active');
        $('name-input').value = ZH.Save.get().name || '';
        this.loadBoard(res.wave ? 'endless' : 'endless', true);
        nextBtn.style.display = 'none';
      } else {
        submit.classList.remove('is-active');
        nextBtn.style.display = res.win && res.nextLevel ? '' : 'none';
      }

      this.res = res;
      this.showOnly('screen-results');
      ZH.Anim.pop($('res-coins'));
      ZH.Audio.play(res.win ? 'levelUp' : 'error');

      /* campaign clears also post a row, quietly */
      if (res.mode === 'campaign' && res.win) {
        ZH.Net.submitScore({
          name: ZH.Save.get().name, mode: 'campaign', wave: res.levelId,
          kills: res.kills, score: res.score
        });
      }
    },

    /* ---------------------------- leaderboard ---------------------------- */
    showLeaderboard: function (mode) {
      boardMode = mode || boardMode;
      document.querySelectorAll('.tab').forEach(function (t) {
        t.classList.toggle('is-active', t.dataset.mode === boardMode);
      });
      this.showOnly('screen-board');
      this.loadBoard(boardMode);
    },

    loadBoard: function (mode, mini) {
      var body = mini ? $('res-board') : $('board-body');
      var note = $('board-note');
      if (!body) return;
      body.innerHTML = '<div class="board-empty">Loading survivors…</div>';
      ZH.Net.leaderboard(mode).then(function (res) {
        var rows = res.rows || [];
        if (mini) {
          body.innerHTML = rows.slice(0, 5).map(function (r, i) {
            return '<div class="row"><span>' + (i + 1) + '. ' + esc(r.name) +
              '</span><span>wave ' + (r.wave || 0) + ' · ' + (r.kills || 0) + ' kills</span></div>';
          }).join('') || '<div class="row"><span>No entries yet.</span></div>';
          return;
        }
        body.innerHTML = rows.length ? rows.map(function (r, i) {
          return '<div class="board-row ' + (i === 0 ? 'top1' : '') + '">' +
            '<span class="rank">' + (i + 1) + '</span>' +
            '<span class="nm">' + esc(r.name) + '</span>' +
            '<span>' + (r.wave || 0) + '</span>' +
            '<span>' + (r.kills || 0) + '</span>' +
            '<span>' + (r.score || 0) + '</span>' +
            '</div>';
        }).join('') : '<div class="board-empty">No survivors logged yet. Be the first.</div>';
        if (note) {
          note.textContent = res.offline
            ? 'Offline — showing your local record. Start the Node server to sync the global board.'
            : 'Live from the survivor log · ' + rows.length + ' entries';
        }
      });
    },

    /* ------------------------------- levels ------------------------------ */
    renderLevels: function () {
      var wrap = $('levels-list');
      if (!wrap) return;
      var save = ZH.Save ? (ZH.Save.get ? ZH.Save.get() : {coins:0, bestLevel:1, weapons:['gun'], currentWeapon:'gun'}) : {coins:0, bestLevel:1, weapons:['gun'], currentWeapon:'gun'};
      wrap.innerHTML = '';
      if (ZH.STAGES) {
        ZH.STAGES.forEach(function (st, i) {
          var card = document.createElement('button');
          var unlocked = (i === 0) || (i <= save.bestLevel);
          var already = i < save.bestLevel;
          var chapter = ZH.chapterOf ? ZH.chapterOf(st) : { name: '' };
          card.className = 'level-card' + (unlocked ? '' : ' is-locked') + (already ? ' is-cleared' : '');
          card.innerHTML = '<span class="num">MAP ' + String(st.bg || '').toUpperCase() + '</span>' +
            '<span class="name">' + st.name + '</span>' +
            '<span class="meta">' + chapter.name + ' · x' + st.multiplier + ' · ' +
              (st.rewards ? st.rewards[0] + ' scrap' : '') + '</span>';
          if (unlocked) {
            card.addEventListener('click', function () {
              if (window.ZH && ZH.Game) {
                ZH.Game.startStage(i);
                UI.hideScreens && UI.hideScreens();
                if (menuOpts && menuOpts.onLevels) menuOpts.onLevels(i);
              }
            });
          } else {
            card.title = 'Unlock by clearing all previous stages';
          }
          wrap.appendChild(card);
        });
      }
      if ($('levels-coins')) $('levels-coins').textContent = (save.coins||0).toLocaleString();
    },

    /* -------------------------------- shop -------------------------------
       The original store is not a weapon shop: weapons come from level-up
       cards. Scrap buys the six permanent coin skills (30 levels each). */
    renderShop: function () {
      var save = ZH.Save.get ? ZH.Save.get() : { coins: 0, skills: {} };
      var coins = save.coins || 0;
      if ($('shop-coins')) $('shop-coins').textContent = coins.toLocaleString();
      var ug = $('upgrade-grid');
      if (!ug) return;

      ug.innerHTML = '';
      (ZH.SKILLS || []).forEach(function (sk) {
        var lvl = (save.skills && save.skills[sk.id]) || 1;
        var maxLevel = ZH.MAX_PLAYER_SKILL || 30;
        var max = lvl >= maxLevel;
        var price = ZH.priceForSkill(lvl);
        var now = ZH.skillValue(sk.id, lvl);
        var next = ZH.skillValue(sk.id, Math.min(maxLevel, lvl + 1));
        var div = document.createElement('div');
        div.className = 'upgrade' + (max ? ' is-max' : '');
        div.innerHTML = '<div class="u-name">' + sk.name + ' LV ' + lvl + '</div>' +
          '<div class="u-val">' + fmtNum(now) + (next !== now ? ' → ' + fmtNum(next) : '') + '</div>' +
          '<button class="btn small' + (max ? ' ghost' : '') + '">' + (max ? 'MAX' : price.toLocaleString()) + '</button>';
        var ubtn = div.querySelector('button');
        if (!max) {
          ubtn.addEventListener('click', function () {
            ZH.Audio.play && ZH.Audio.play('click');
            var r = ZH.Save.buySkill(sk.id);
            if (!r.ok) {
              ZH.Anim.toast && ZH.Anim.toast(r.reason === 'coins' ? 'Not enough scrap' : 'Maxed out', 'error');
              ZH.Audio.play && ZH.Audio.play('error');
              return;
            }
            ZH.Anim.toast && ZH.Anim.toast(sk.name + ' → LV ' + r.level, 'good');
            UI.renderShop();
          });
        }
        ug.appendChild(div);
      });
    },

    refreshWeapons: function () {
      var slots = this.el && this.el.slots;
      if (!slots) return;
      var p = G && G.player;
      var ids = [];
      if (p && p.weapons) {
        ids = Object.keys(p.weapons);
      } else {
        var save = ZH.Save && ZH.Save.get ? ZH.Save.get() : { weapons: ['gun'] };
        ids = (save.weapons || []).slice();
      }
      var primary = (p && p.primaryWeapon) || (ZH.Save && ZH.Save.get().currentWeapon) || 'gun';
      slots.innerHTML = '';
      ids.forEach(function (id, i) {
        var st = p && p.weapons ? p.weapons[id] : null;
        var eff = ZH.effectiveWeapon && st ? ZH.effectiveWeapon(id, st, p.supplies) : id;
        var w = ZH.WEAPONS && ZH.WEAPONS[eff] ? ZH.WEAPONS[eff] : { short: id };
        var b = document.createElement('button');
        b.className = 'slot' + (primary === id ? ' is-active' : '');
        b.innerHTML = '<b>' + (i + 1) + '</b>' + (w.short || id);
        slots.appendChild(b);
      });
    },

    /* -------------------------------- HUD -------------------------------- */
    updateHud: function (d) {
      if (!d) return;
      var e = this.el;
      var hpFrac = d.hp / d.maxHp;
      if (last.hp !== Math.round(d.hp)) {
        e.hpFill.style.width = (hpFrac * 100).toFixed(1) + '%';
        e.hpText.textContent = Math.ceil(d.hp) + ' / ' + Math.round(d.maxHp);
        e.hpBar.classList.toggle('is-low', hpFrac < 0.35);
        last.hp = Math.round(d.hp);
      }
      var dashReady = d.dashCd <= 0.001;
      e.dashFill.style.width = (dashReady ? 100 : (1 - d.dashCd / d.dashMax) * 100).toFixed(1) + '%';
      e.dashBar.classList.toggle('is-ready', dashReady);

      if (last.mag !== d.mag || last.weapon !== d.weapon.id) {
        e.mag.textContent = d.mag;
        e.magMax.textContent = d.weapon.mag;
        last.mag = d.mag;
      }
      if (last.weapon !== d.weapon.id) {
        e.weaponName.textContent = d.weapon.name.toUpperCase();
        e.weaponType.textContent = d.weapon.short;
        last.weapon = d.weapon.id;
        this.refreshWeapons();
      }
      if (last.reloading !== d.reloading) {
        e.reloadBar.classList.toggle('is-active', d.reloading);
        last.reloading = d.reloading;
      }

      /* roll button cools down with the dash */
      var dashBtn = $('btn-dash');
      if (dashBtn) {
        var cooling = d.dashCd > 0.01;
        dashBtn.classList.toggle('is-cooling', cooling);
        dashBtn.textContent = cooling ? Math.ceil(d.dashCd) : 'ROLL';
      }
      if (d.reloading) e.reload.style.width = (d.reloadFrac * 100).toFixed(1) + '%';

      if (last.coins !== d.coins) {
        e.coins.textContent = d.coins.toLocaleString();
        last.coins = d.coins;
      }
      if (last.score !== d.score) {
        e.score.textContent = d.score.toLocaleString();
        last.score = d.score;
      }
      if (last.wave !== d.wave || last.left !== d.left) {
        e.wave.textContent = d.wave;
        e.left.textContent = d.left;
        last.wave = d.wave;
        last.left = d.left;
      }
      if (last.mode !== d.mode) {
        e.mode.textContent = d.mode === 'endless' ? 'ENDLESS NIGHT' : 'CAMPAIGN';
        last.mode = d.mode;
      }
      if (last.levelName !== d.levelName) {
        e.level.textContent = (d.levelName || '').toUpperCase();
        last.levelName = d.levelName;
      }
      /* the supplies you are carrying, with their level */
      if (e.items) {
        var sig = '';
        for (var sk in (d.supplies || {})) sig += sk + (d.supplies[sk] || 0);
        if (sig !== last.itemsSig) {
          last.itemsSig = sig;
          e.items.innerHTML = '';
          for (var sid in (d.supplies || {})) {
            var lvl = d.supplies[sid] || 1;
            if (!ZH.SUPPLIES || !ZH.SUPPLIES[sid]) continue;
            var look = ZH.itemLook ? ZH.itemLook(sid) : ['?', '#ccc'];
            var chip = document.createElement('button');
            chip.className = 'item-chip';
            chip.style.borderColor = look[1];
            chip.title = ZH.SUPPLIES[sid].name + ' LV ' + lvl + ' — ' +
              ZH.supplyDesc(sid, lvl);
            chip.innerHTML = '<i style="color:' + look[1] + '">' + look[0] + '</i>' +
              '<span>' + lvl + '</span>';
            e.items.appendChild(chip);
          }
        }
      }
      if (d.boss) {
        e.bossBar.classList.add('is-active');
        e.bossName.textContent = d.boss.name;
        e.bossFill.style.width = (d.boss.hp / d.boss.max * 100).toFixed(1) + '%';
        last.boss = true;
      } else if (last.boss) {
        e.bossBar.classList.remove('is-active');
        last.boss = false;
      }
    },

    /* short banner when a ground item is collected */
    toastItem: function (id, level) {
      var s = ZH.SUPPLIES && ZH.SUPPLIES[id];
      if (!s || !ZH.Anim || !ZH.Anim.toast) return;
      ZH.Anim.toast(s.name + ' LV ' + level + ' — ' + ZH.supplyDesc(id, level), 'good');
      ZH.Audio.play && ZH.Audio.play('pickup');
    },

    resetHud: function () {
      last = {};
      var e = this.el;
      e.bossBar.classList.remove('is-active');
      e.reloadBar.classList.remove('is-active');
    },

    /* -------------------------------- menu ------------------------------- */
    updateMenuStats: function () {
      var s = ZH.Save.get();
      $('menu-coins').textContent = s.coins.toLocaleString();
      $('menu-best').textContent = s.bestLevel + '/' + s.maxLevel;
      $('menu-kills').textContent = s.stats.kills.toLocaleString();
      var eb = $('menu-endless');
      if (eb) eb.textContent = s.stats.bestEndless;
      $('levels-coins').textContent = s.coins.toLocaleString();
      this.syncMute();
    },

    syncMute: function () {
      var muted = ZH.Save.get().settings.muted;
      var label = 'SOUND: ' + (muted ? 'OFF' : 'ON');
      var m = $('btn-mute');
      if (m) m.textContent = label;
      var pm = $('btn-pause-mute');
      if (pm) pm.querySelector('span').textContent = label;
    },

    applyAudio: function () {
      var s = ZH.Save.get();
      ZH.Audio.setMuted(!!s.settings.muted);
      this.syncMute();
    },

    toggleMute: function () {
      var s = ZH.Save.get();
      s.settings.muted = !s.settings.muted;
      ZH.Save.persist();
      this.applyAudio();
      ZH.Audio.play('click');
    },

    /* animated idle hunter on the menu */
    startMenuHunter: function () {
      var canvas = $('menu-hunter');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var w = 300, h = 340;
      function fit() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = canvas.clientWidth || 300;
        h = canvas.clientHeight || 340;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      fit();
      window.addEventListener('resize', fit);
      var aim = -0.5;
      canvas.addEventListener('pointermove', function (ev) {
        var r = canvas.getBoundingClientRect();
        aim = Math.atan2((ev.clientY - r.top) - h * 0.46, (ev.clientX - r.left) - w * 0.5);
      });
      function frame(ts) {
        menuT = ts / 1000;
        if (!canvas.offsetParent) { menuRAF = requestAnimationFrame(frame); return; }
        ctx.clearRect(0, 0, w, h);
        var bob = Math.sin(menuT * 1.3) * 2;
        ctx.save();
        ctx.translate(w / 2, h - 40 + bob);
        ZH.Rig.draw(ctx, {
          x: 0, y: 0, s: 3.4, kind: 'hunter', variant: 'hunter',
          facing: 1, aim: aim, weapon: ZH.Save.get().currentWeapon || 'gun',
          pose: { t: menuT, moving: 0, walkPhase: 0, reload: 0 }
        });
        ctx.restore();
        /* ground glow */
        var g = ctx.createRadialGradient(w / 2, h - 40, 4, w / 2, h - 40, 120);
        g.addColorStop(0, 'rgba(255,179,71,0.14)');
        g.addColorStop(1, 'rgba(255,179,71,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, h - 170, w, 170);
        menuRAF = requestAnimationFrame(frame);
      }
      this.menuRAF = requestAnimationFrame(frame);
    },

    /* -------------------------------- bind ------------------------------- */
    renderMenuWeaponPick: function (opts) {
      opts = opts || {};
      var wrap = $('mw-chips');
      if (!wrap) return;
      wrap.innerHTML = '';
      var save = ZH.Save.get();
      var current = save.currentWeapon || 'gun';
      var unblocked = opts.unblockedWeaponIds || [];
      var owned = save.weapons || [];
      ZH.WEAPON_ORDER.forEach(function (id) {
        var w = ZH.WEAPONS && ZH.WEAPONS[id];
        if (!w) return;
        var chip = document.createElement('button');
        chip.className = 'mw-chip' + (current === id ? ' is-active' : '') +
          (unblocked.length && unblocked.indexOf(id) === -1 ? ' is-locked' : '');
        chip.textContent = w.short || id.toUpperCase();
        chip.title = w.name + (unblocked.length && unblocked.indexOf(id) === -1 ? ' · locked' : '');
        chip.addEventListener('click', function () {
          if (unblocked.length && unblocked.indexOf(id) === -1) {
            ZH.Anim.toast && ZH.Anim.toast('That weapon is not unlocked yet', 'info');
            ZH.Audio.play && ZH.Audio.play('error');
            return;
          }
          ZH.Audio.play && ZH.Audio.play('click');
          save.currentWeapon = id;
          ZH.Save.persist();
          UI.renderMenuWeaponPick(opts);
        });
        wrap.appendChild(chip);
      });
      if (unblocked.length) {
        var hint = document.querySelector('.mw-hint');
        if (hint) hint.textContent = 'Choose the weapon your survivor starts every run with.';
      }
    },

    bind: function () {
      var self = this;
      function on(id, ev, fn) {
        var el = $(id);
        if (el) el.addEventListener(ev, fn);
      }
      on('btn-campaign', 'click', function () { ZH.Audio.play('click'); self.showLevels(menuOpts && menuOpts.onLevels); });
      on('btn-endless', 'click', function () { ZH.Audio.play('click'); G.startEndless(); });
      on('btn-shop', 'click', function () { ZH.Audio.play('click'); self.showShop(); });
      on('btn-board', 'click', function () { ZH.Audio.play('click'); self.showLeaderboard('endless'); });
      on('btn-help', 'click', function () { ZH.Audio.play('click'); self.showHelp(); });
      on('btn-mute', 'click', function () { self.toggleMute(); });

      document.querySelectorAll('[data-back]').forEach(function (b) {
        b.addEventListener('click', function () {
          ZH.Audio.play('click');
          self.showMenu();
        });
      });

      on('btn-start', 'click', function () {
        ZH.Audio.play('click');
        self.resetHud();
        if (G.begin) {
          G.begin();
        } else if (window.ZH && ZH.Game && ZH.Game.startStage) {
          /* restart on this stage so the gun chosen in the loadout is the one
             the survivor actually deploys with (autoStart no-ops mid-run) */
          ZH.Game.startStage(G.stageId != null ? G.stageId : 0);
        } else if (window.ZH && ZH.Game && ZH.Game.autoStart) {
          ZH.Game.autoStart(0);
        }
      });
      on('btn-brief-back', 'click', function () {
        ZH.Audio.play('click');
        if (G.mode === 'endless') self.showMenu();
        else self.showLevels();
      });

      on('btn-pause', 'click', function () { G.pause(); });
      on('btn-resume', 'click', function () { ZH.Audio.play('click'); G.resume(); });
      on('btn-restart', 'click', function () { ZH.Audio.play('click'); G.retry(); });
      on('btn-quit', 'click', function () {
        ZH.Audio.play('click');
        G.state = 'menu';
        G.quit();
      });
      on('btn-pause-mute', 'click', function () { self.toggleMute(); });

      on('btn-next', 'click', function () { ZH.Audio.play('click'); G.nextLevel(); });
      on('btn-retry', 'click', function () { ZH.Audio.play('click'); G.retry(); });
      on('btn-res-menu', 'click', function () { ZH.Audio.play('click'); G.quit(); });

      on('btn-submit-score', 'click', function () { self.submitEndless(); });
      var nameInput = $('name-input');
      if (nameInput) {
        nameInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') self.submitEndless();
          e.stopPropagation();
        });
      }

      document.querySelectorAll('.tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          ZH.Audio.play('click');
          boardMode = tab.dataset.mode;
          document.querySelectorAll('.tab').forEach(function (t) {
            t.classList.toggle('is-active', t === tab);
          });
          self.loadBoard(boardMode);
        });
      });

      /* touch action buttons — dash and reload are the only two */
      var dashBtn = $('btn-dash');
      if (dashBtn) {
        var fireDash = function (ev) {
          ev.preventDefault();
          if (G && G.dash) G.dash();
        };
        dashBtn.addEventListener('pointerdown', fireDash);
      }
      var reloadBtn = $('btn-reload');
      if (reloadBtn) {
        var fireReload = function (ev) {
          ev.preventDefault();
          if (G && G.reload) G.reload();
        };
        reloadBtn.addEventListener('pointerdown', fireReload);
      }

      /* any first interaction unlocks WebAudio */
      document.addEventListener('pointerdown', function () { ZH.Audio.unlock(); }, { once: true });
    },

    submitEndless: function () {
      var res = this.res;
      if (!res) return;
      var name = ($('name-input').value || 'HUNTER').toUpperCase().slice(0, 14);
      ZH.Save.setName(name);
      ZH.Audio.play('buy');
      ZH.Net.submitScore({
        name: name, mode: 'endless', wave: res.wave,
        kills: res.kills, score: res.score
      }).then(function (r) {
        if (r.ok) {
          ZH.Anim.toast('Logged at rank #' + (r.rank || '—'), 'good');
          UI.loadBoard('endless', true);
        } else {
          ZH.Anim.toast('Leaderboard offline — score kept locally', 'info');
        }
      });
    }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  ZH.UI = UI;
})(typeof window !== 'undefined' ? window.ZH || (window.ZH = {}) : {});
