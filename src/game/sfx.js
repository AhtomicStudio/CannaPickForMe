/**
 * CannaGotchi — Sound FX
 *
 * Synth-tone SFX using the Web Audio API. No assets, no deps.
 * Each effect is an envelope on an oscillator (or two). The whole
 * thing is gated behind a user-controlled mute toggle and
 * starts the AudioContext lazily on first user gesture.
 */

const STORAGE_KEY = 'cpfm_sfx_muted';

let _ctx = null;
let _muted = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) === 'true';
let _master = null;

function ctx() {
  if (_ctx) return _ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  _ctx = new Ctor();
  _master = _ctx.createGain();
  _master.gain.value = 0.16; // overall game SFX level
  _master.connect(_ctx.destination);
  return _ctx;
}

function blip({ freq = 440, dur = 0.12, type = 'square', sweep = 0, vol = 1.0, attack = 0.005, release = 0.08 }) {
  if (_muted) return;
  const c = ctx(); if (!c) return;
  // Resume on first interaction (autoplay policy)
  if (c.state === 'suspended') c.resume().catch(() => {});

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (sweep) osc.frequency.linearRampToValueAtTime(freq + sweep, c.currentTime + dur);

  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur + release);

  osc.connect(g);
  g.connect(_master);
  osc.start();
  osc.stop(c.currentTime + dur + release + 0.02);
}

function chord(freqs, opts = {}) {
  freqs.forEach((f, i) => setTimeout(() => blip({ freq: f, ...opts }), i * 35));
}

// ── Public effects ───────────────────────────────────────────
export const sfx = {
  setMuted(m) {
    _muted = !!m;
    try { localStorage.setItem(STORAGE_KEY, String(_muted)); } catch (_) {}
  },
  isMuted() { return _muted; },

  click()        { blip({ freq: 700, dur: 0.04, type: 'square', vol: 0.7 }); },
  tap()          { blip({ freq: 880, dur: 0.05, type: 'triangle' }); },
  feed()         { chord([523, 659, 784], { dur: 0.12, type: 'triangle' }); },
  water()        { blip({ freq: 660, dur: 0.18, type: 'sine', sweep: -160 }); },
  pet()          { blip({ freq: 988, dur: 0.07, type: 'sine' }); },
  buy()          { chord([392, 493, 587], { dur: 0.08, type: 'square' }); },
  error()        { blip({ freq: 200, dur: 0.18, type: 'sawtooth' }); },
  xpGain()       { blip({ freq: 880, dur: 0.06, type: 'triangle', sweep: 160 }); },
  levelUp()      { chord([523, 659, 784, 1047], { dur: 0.18, type: 'square' }); },
  evolution()    { chord([261, 329, 392, 523, 659, 784, 1047], { dur: 0.22, type: 'sine' }); },
  battleStart()  { chord([392, 261], { dur: 0.20, type: 'square' }); },
  hit()          { blip({ freq: 220, dur: 0.10, type: 'sawtooth', sweep: -120, vol: 1.1 }); },
  crit()         { chord([880, 1100, 1320], { dur: 0.10, type: 'square', vol: 1.2 }); },
  miss()         { blip({ freq: 180, dur: 0.10, type: 'square' }); },
  victory()      { chord([523, 659, 784, 1047, 1319], { dur: 0.20, type: 'triangle' }); },
  defeat()       { chord([392, 311, 261, 196], { dur: 0.32, type: 'sawtooth' }); },
  achievement()  { chord([784, 1047, 1319, 1568], { dur: 0.16, type: 'sine' }); },
  prestige()     { chord([261, 523, 1047, 2093, 1568, 1319], { dur: 0.18, type: 'sine' }); },
  questDone()    { chord([659, 784, 988], { dur: 0.10, type: 'triangle' }); },
  encounter()    { blip({ freq: 130, dur: 0.18, type: 'sawtooth', sweep: 240, vol: 1.1 }); },
};
