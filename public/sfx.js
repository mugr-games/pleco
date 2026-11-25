// Pleco sound effects: tiny chiptune synth built on the Web Audio API (no audio files needed).
let ctx = null;
let master = null;
let muted = localStorage.getItem('pleco-muted') === '1';

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** One synth note. Times are in seconds from now. */
function tone({ freq, to, type = 'square', dur = 0.1, when = 0, vol = 0.5, attack = 0.004 }) {
  const a = audio();
  if (!a || muted) return;
  const t = a.currentTime + when;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Short burst of filtered noise (splashes, whooshes, crab clicks). */
function noise({ dur = 0.1, when = 0, vol = 0.3, freq = 1200, to, q = 1 }) {
  const a = audio();
  if (!a || muted) return;
  const t = a.currentTime + when;
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

const notes = (list, step = 0.08, opts = {}) =>
  list.forEach((f, i) => f && tone({ freq: f, dur: step * 1.6, when: i * step, ...opts }));

let lastType = 0;

export const sfx = {
  get muted() { return muted; },
  toggleMute() {
    muted = !muted;
    localStorage.setItem('pleco-muted', muted ? '1' : '0');
    if (!muted) this.click();
    return muted;
  },
  /** Call on the first user gesture so browsers allow audio. */
  unlock() { audio(); },

  click() { tone({ freq: 740, dur: 0.05, vol: 0.25 }); tone({ freq: 1110, dur: 0.04, when: 0.03, vol: 0.15 }); },
  type() {
    const now = performance.now();
    if (now - lastType < 40) return;
    lastType = now;
    tone({ freq: 1400 + Math.random() * 500, dur: 0.018, vol: 0.06, type: 'triangle' });
  },
  submit() { tone({ freq: 420, to: 900, dur: 0.14, vol: 0.3 }); noise({ dur: 0.12, freq: 900, to: 3000, vol: 0.08 }); },
  invalid() { tone({ freq: 160, dur: 0.09, vol: 0.35, type: 'sawtooth' }); tone({ freq: 120, dur: 0.14, when: 0.1, vol: 0.35, type: 'sawtooth' }); },

  /** Each tier creature has its own entrance sound. */
  tier(type) {
    if (type === 'pleco') { tone({ freq: 300, to: 520, dur: 0.12, vol: 0.3, type: 'sine' }); noise({ dur: 0.15, freq: 600, to: 1800, vol: 0.06 }); }
    else if (type === 'schooler') { [0, 0.05, 0.1, 0.15].forEach((w, i) => tone({ freq: 600 + i * 120, dur: 0.05, when: w, vol: 0.18, type: 'triangle' })); }
    else if (type === 'reef') { [0, 0.07, 0.14].forEach((w) => noise({ dur: 0.03, when: w, freq: 3200, vol: 0.35, q: 6 })); tone({ freq: 220, dur: 0.08, when: 0.2, vol: 0.2 }); }
    else if (type === 'deep') { tone({ freq: 110, to: 82, dur: 0.6, vol: 0.35, type: 'triangle' }); tone({ freq: 1320, dur: 0.25, when: 0.15, vol: 0.08, type: 'sine' }); }
  },

  row(i) { tone({ freq: 520 + i * 70, dur: 0.04, vol: 0.12, type: 'triangle' }); },
  count() { tone({ freq: 1800, dur: 0.015, vol: 0.05, type: 'square' }); },
  coin() { tone({ freq: 988, dur: 0.07, vol: 0.25 }); tone({ freq: 1319, dur: 0.18, when: 0.07, vol: 0.25 }); },

  top() {
    notes([523, 659, 784, 1047], 0.075, { vol: 0.3 });
    tone({ freq: 1568, dur: 0.35, when: 0.32, vol: 0.18, type: 'triangle' });
    [0.4, 0.48, 0.56].forEach((w) => tone({ freq: 2093 + Math.random() * 600, dur: 0.05, when: w, vol: 0.08, type: 'sine' }));
  },
  good() { notes([659, 880], 0.09, { vol: 0.28 }); },
  miss() { tone({ freq: 420, to: 140, dur: 0.3, vol: 0.3, type: 'sine' }); [0.1, 0.2, 0.28].forEach((w, i) => tone({ freq: 500 + i * 200, to: 900 + i * 200, dur: 0.06, when: w, vol: 0.1, type: 'sine' })); },

  flip(i) { noise({ dur: 0.04, freq: 2000 + i * 60, vol: 0.12, q: 3 }); tone({ freq: 400 + i * 40, dur: 0.04, vol: 0.08, type: 'triangle' }); },
  finale(good) {
    if (good) notes([523, 659, 784, 659, 784, 1047, 0, 1047], 0.11, { vol: 0.28 });
    else notes([392, 330, 294, 262], 0.14, { vol: 0.25, type: 'triangle' });
  },
};
