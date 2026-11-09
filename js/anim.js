/*
 * Meow Zombie Hunter — motion
 * anime.js drives every screen change, card stagger, count-up, banner and
 * button response. Canvas effects keep their own light tweening because
 * they run at world scale, but all UI motion funnels through here.
 */
window.ZH = window.ZH || {};
(function (ZH) {
  'use strict';
  var A = window.anime;
  /* Embedded webviews and desktop shells can report the document as hidden
     while it is on screen; anime.js would pause every tween there. UI motion
     (including the damage flash) must follow the game clock, not that flag. */
  if (A) A.suspendWhenDocumentHidden = false;

  function has() { return !!A; }

  function show(el, opts) {
    if (!el) return;
    opts = opts || {};
    el.style.display = opts.display || 'flex';
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    if (!has()) { el.style.opacity = 1; return; }
    A.remove(el);
    A({
      targets: el,
      opacity: [0, 1],
      duration: opts.duration || 280,
      easing: 'easeOutQuad'
    });
    var inner = el.querySelectorAll('[data-anim]');
    if (inner.length) {
      A.remove(inner);
      A({
        targets: inner,
        opacity: [0, 1],
        translateY: [18, 0],
        delay: A.stagger(45, { start: 90 }),
        duration: 460,
        easing: 'easeOutCubic'
      });
    }
  }

  function hide(el, opts) {
    if (!el) return;
    opts = opts || {};
    if (!has()) { el.style.display = 'none'; return; }
    A.remove(el);
    A({
      targets: el,
      opacity: [1, 0],
      duration: opts.duration || 180,
      easing: 'easeInQuad',
      complete: function () {
        el.style.display = 'none';
        el.classList.remove('is-open');
        el.setAttribute('aria-hidden', 'true');
        el.style.opacity = '';
      }
    });
  }

  /** Switch between full-screen panels. */
  var current = null;
  function screen(id) {
    var next = typeof id === 'string' ? document.getElementById(id) : id;
    if (current === next) return next;
    if (current) hide(current, { duration: 150 });
    current = next;
    if (next) show(next);
    return next;
  }

  function staggerIn(container, selector) {
    if (!container) return;
    var nodes = container.querySelectorAll(selector || '[data-card]');
    if (!nodes.length) return;
    if (!has()) return;
    A.remove(nodes);
    A({
      targets: nodes,
      opacity: [0, 1],
      translateY: [26, 0],
      scale: [0.96, 1],
      delay: A.stagger(42, { start: 60 }),
      duration: 520,
      easing: 'easeOutCubic'
    });
  }

  function countUp(el, from, to, opts) {
    if (!el) return;
    opts = opts || {};
    var obj = { v: from };
    var dur = opts.duration || 700;
    function paint() { el.textContent = (opts.prefix || '') + Math.round(obj.v).toLocaleString() + (opts.suffix || ''); }
    paint();
    if (!has()) { obj.v = to; paint(); return; }
    A.remove(obj);
    A({
      targets: obj, v: to, duration: dur, easing: opts.easing || 'easeOutQuart',
      update: paint
    });
  }

  function pop(el, scale) {
    if (!el || !has()) return;
    A.remove(el);
    A({
      targets: el,
      scale: [scale || 0.86, 1],
      duration: 380,
      easing: 'easeOutElastic(1, .5)'
    });
  }

  function pulse(el) {
    if (!el || !has()) return;
    A.remove(el);
    A({
      targets: el,
      scale: [1, 1.14, 1],
      duration: 420,
      easing: 'easeOutQuad'
    });
  }

  function press(el) {
    if (!el || !has()) return;
    A.remove(el);
    A({
      targets: el, scale: [0.94, 1], duration: 260, easing: 'easeOutBack'
    });
  }

  /** Big centre-screen banner, e.g. "WAVE 3". */
  var bannerTimer = null;
  function banner(title, sub, opts) {
    opts = opts || {};
    var el = document.getElementById('banner');
    if (!el) return;
    var t = el.querySelector('.banner-title');
    var s = el.querySelector('.banner-sub');
    if (t) t.textContent = title || '';
    if (s) s.textContent = sub || '';
    el.classList.remove('banner-in');
    void el.offsetWidth;
    el.classList.add('banner-in');
    if (has()) {
      A.remove(el);
      A({
        targets: el,
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 340,
        easing: 'easeOutBack'
      });
      if (t) {
        A.remove(t);
        A({
          targets: t, translateY: [16, 0], duration: 480,
          easing: 'easeOutCubic'
        });
      }
    }
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      if (has()) A({ targets: el, opacity: 0, duration: 320, easing: 'easeInQuad' });
      else el.style.opacity = 0;
    }, opts.duration || 1500);
  }

  var toastTimer = null;
  function toast(text, kind) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.className = 'toast ' + (kind || '');
    if (has()) {
      A.remove(el);
      A({
        targets: el, opacity: [0, 1], translateY: [14, 0], duration: 260, easing: 'easeOutCubic'
      });
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (has()) A({ targets: el, opacity: 0, duration: 260, easing: 'easeInQuad' });
    }, 1900);
  }

  function shakeEl(el, strength) {
    if (!el || !has()) return;
    A.remove(el);
    A({
      targets: el,
      translateX: [0, strength || 6, -(strength || 6), (strength || 6) * 0.5, 0],
      duration: 320,
      easing: 'easeOutQuad'
    });
  }

  /* anime.js event wash: a red hit, a red-alert boss entrance, a gold
     level-up. The overlay is a single element, so a burst of hits reuses it
     instead of stacking dozens of tweens. */
  function flash(rgb, opts) {
    opts = opts || {};
    var el = document.getElementById('fx-flash');
    if (!el) return;
    rgb = rgb || '228,72,48';
    el.style.background = 'radial-gradient(circle at 50% 50%, rgba(' + rgb +
      ',0) 30%, rgba(' + rgb + ',' + (opts.edge || 0.7) + ') 100%)';
    var peak = opts.peak || 0.85, dur = opts.duration || 340;
    /* Set the peak immediately, so the wash is visible even when the shell
       throttles animation frames; the timer guarantees it always clears. */
    el.style.opacity = String(peak);
    clearTimeout(el._fxT);
    el._fxT = setTimeout(function () { el.style.opacity = 0; }, dur + 60);
    if (!has()) return;
    A.remove(el);
    A({
      targets: el, opacity: [peak, 0],
      duration: dur, easing: 'easeOutQuad'
    });
  }

  function hurt() {
    flash('228,72,48', { peak: 0.85, duration: 300 });
    shakeEl(document.getElementById('hud'), 5);
  }

  function bar(el, frac) {
    if (!el) return;
    frac = Math.max(0, Math.min(1, frac));
    if (has()) {
      A.remove(el);
      A({ targets: el, width: (frac * 100) + '%', duration: 260, easing: 'easeOutQuad' });
    } else {
      el.style.width = (frac * 100) + '%';
    }
  }

  function resetScreen() {
    if (current) {
      current.style.display = 'none';
      current.classList.remove('is-open');
    }
    current = null;
  }

  ZH.Anim = {
    show: show, hide: hide, screen: screen, staggerIn: staggerIn,
    countUp: countUp, pop: pop, pulse: pulse, press: press,
    banner: banner, toast: toast, shakeEl: shakeEl, bar: bar,
    flash: flash, hurt: hurt,
    resetScreen: resetScreen,
    has: has
  };
})(typeof window !== 'undefined' ? window.ZH || (window.ZH = {}) : {});
