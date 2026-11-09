/*
 * Meow Zombie Hunter — audio
 * Everything is synthesised at runtime with WebAudio: no sound files,
 * no licences. A low drone + wind bed plays underneath the action.
 */
window.ZH = window.ZH || {};
(function (ZH) {
  'use strict';

  var ctx = null;
  var master = null;
  var sfxBus = null;
  var musicBus = null;
  var noiseBuf = null;
  var muted = false;
  var started = false;
  var musicNodes = [];

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.4;
    musicBus.connect(master);

    /* shared noise buffer */
    var len = ctx.sampleRate * 1.2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function noise(dur, gain, filter, freq, q, dest) {
    var c = ensure();
    if (!c) return;
    var src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var g = c.createGain();
    var bq = c.createBiquadFilter();
    bq.type = filter || 'lowpass';
    bq.frequency.value = freq || 1200;
    bq.Q.value = q || 0.8;
    var t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(bq);
    bq.connect(g);
    g.connect(dest || sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  function tone(type, f0, f1, dur, gain, dest, when) {
    var c = ensure();
    if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type;
    var t = c.currentTime + (when || 0);
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    o.connect(g);
    g.connect(dest || sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  var PLAY = {
    pistol: function () { noise(0.16, 0.5, 'bandpass', 1700, 1.1); tone('square', 240, 70, 0.1, 0.22); },
    smg: function () { noise(0.09, 0.34, 'bandpass', 2400, 1.4); tone('square', 300, 120, 0.06, 0.12); },
    shotgun: function () {
      noise(0.34, 0.75, 'lowpass', 900, 0.9); tone('sawtooth', 130, 46, 0.28, 0.3);
      tone('sine', 70, 40, 0.36, 0.28);
    },
    rifle: function () { noise(0.13, 0.5, 'bandpass', 2000, 1.1); tone('square', 200, 60, 0.09, 0.2); },
    sniper: function () {
      noise(0.5, 0.8, 'lowpass', 1400, 0.7); tone('sawtooth', 180, 38, 0.42, 0.34);
    },
    flamer: function () { noise(0.22, 0.2, 'lowpass', 900, 0.5); },
    reload: function () { tone('square', 180, 120, 0.05, 0.06); tone('square', 240, 160, 0.05, 0.05, null, 0.11); },
    reloadDone: function () { tone('square', 320, 420, 0.05, 0.07); tone('triangle', 520, 620, 0.06, 0.06, null, 0.07); },
    empty: function () { tone('square', 160, 120, 0.04, 0.05); },
    hit: function () { noise(0.07, 0.22, 'bandpass', 900, 2.2); },
    zdie: function () { tone('sawtooth', 190, 60, 0.32, 0.16); noise(0.22, 0.2, 'lowpass', 700, 0.8); },
    bossDeath: function () {
      tone('sawtooth', 120, 30, 1.1, 0.32); noise(1.0, 0.4, 'lowpass', 500, 0.7);
      tone('sine', 60, 28, 1.2, 0.3);
    },
    playerHurt: function () { tone('sawtooth', 220, 90, 0.28, 0.28); noise(0.18, 0.24, 'lowpass', 600, 1); },
    playerDeath: function () {
      tone('sawtooth', 180, 40, 1.3, 0.3); noise(1.2, 0.3, 'lowpass', 420, 0.6);
    },
    coin: function () { tone('triangle', 880, 1320, 0.08, 0.09); tone('triangle', 1320, 1760, 0.07, 0.06, null, 0.05); },
    heal: function () { tone('sine', 420, 660, 0.2, 0.12); tone('sine', 660, 880, 0.22, 0.1, null, 0.1); },
    spit: function () { noise(0.2, 0.22, 'highpass', 900, 1.2); tone('sawtooth', 300, 120, 0.16, 0.1); },
    roar: function () {
      tone('sawtooth', 90, 48, 0.85, 0.32); noise(0.7, 0.28, 'lowpass', 380, 0.8);
    },
    slam: function () { tone('sine', 90, 34, 0.5, 0.4); noise(0.45, 0.4, 'lowpass', 500, 0.7); },
    summon: function () { tone('sawtooth', 140, 320, 0.4, 0.16); noise(0.4, 0.16, 'bandpass', 700, 1.4); },
    dash: function () { noise(0.2, 0.24, 'highpass', 1500, 0.8); },
    waveStart: function () {
      tone('sawtooth', 160, 240, 0.5, 0.14);
      tone('sawtooth', 240, 320, 0.5, 0.1, null, 0.18);
    },
    levelUp: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone('triangle', f, f, 0.28, 0.1, null, i * 0.09);
      });
    },
    click: function () { tone('square', 420, 520, 0.035, 0.05); },
    buy: function () { tone('triangle', 660, 990, 0.12, 0.1); tone('triangle', 990, 1320, 0.14, 0.07, null, 0.08); },
    error: function () { tone('square', 200, 140, 0.16, 0.1); }
  };

  function play(name) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    var fn = PLAY[name];
    if (fn) { try { fn(); } catch (e) { /* audio is never fatal */ } }
  }

  function startMusic() {
    var c = ensure();
    if (!c || started) return;
    started = true;
    var t = c.currentTime;
    /* low drone */
    var o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    var o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 82.5;
    var g = c.createGain(); g.gain.value = 0.16;
    o1.connect(g); o2.connect(g); g.connect(musicBus);
    o1.start(t); o2.start(t);
    /* slow tremolo */
    var lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.11;
    var lg = c.createGain(); lg.gain.value = 0.06;
    lfo.connect(lg); lg.connect(g.gain); lfo.start(t);
    /* wind bed */
    var src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var bq = c.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = 520; bq.Q.value = 0.6;
    var wg = c.createGain(); wg.gain.value = 0.1;
    src.connect(bq); bq.connect(wg); wg.connect(musicBus); src.start(t);
    musicNodes = [o1, o2, lfo, src];
  }

  function setMuted(v) {
    muted = !!v;
    if (master) master.gain.value = muted ? 0 : 0.85;
  }

  function setVolume(v) {
    if (master) master.gain.value = muted ? 0 : v;
  }

  function unlock() {
    var c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  ZH.Audio = {
    play: play,
    startMusic: startMusic,
    setMuted: setMuted,
    setVolume: setVolume,
    unlock: unlock,
    isMuted: function () { return muted; }
  };
})(typeof window !== 'undefined' ? window.ZH || (window.ZH = {}) : {});
