      var list = $('loadout-list');
      if (!list) return;
      list.innerHTML = '';
      var save = ZH.Save.get();
      /*
       * the original lets you pick any primary at deploy (DialogSelectPrimary),
       * so the whole 20-weapon arsenal is listed — picked guns stay unlocked
       */
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
