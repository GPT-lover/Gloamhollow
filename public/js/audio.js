// Synthesized sound effects and an ambient score (WebAudio, no assets).

let ac = null, master, sfx, music, verb, noiseBuf;
let muted = false;
let musicTimer = null;

try { muted = localStorage.getItem('gh_muted') === '1'; } catch {}

function makeImpulse(sec, decay) {
  const len = ac.sampleRate * sec;
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.7;
  master.connect(ac.destination);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.connect(master);
  sfx = ac.createGain(); sfx.gain.value = 0.9; sfx.connect(comp);
  music = ac.createGain(); music.gain.value = 0.32; music.connect(comp);
  verb = ac.createConvolver();
  verb.buffer = makeImpulse(3.2, 2.6);
  const vg = ac.createGain(); vg.gain.value = 0.5;
  verb.connect(vg); vg.connect(comp);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('gh_muted', muted ? '1' : '0'); } catch {}
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.7, ac.currentTime, 0.05);
  return muted;
}
export function isMuted() { return muted; }

function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone({ type = 'sine', f0, f1 = f0, dur = 0.2, vol = 0.2, a = 0.005, wet = 0, delay = 0, dest }) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  env(g, t, a, vol, dur);
  o.connect(g);
  g.connect(dest || sfx);
  if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.2, f0 = 1000, f1 = f0, type = 'bandpass', q = 1, a = 0.004, wet = 0, delay = 0 }) {
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  env(g, t, a, vol, dur);
  s.connect(f); f.connect(g); g.connect(sfx);
  if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); }
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

const SFX = {
  slash() { noise({ dur: 0.13, vol: 0.28, f0: 3800, f1: 1100, q: 1.2 }); tone({ type: 'triangle', f0: 900, f1: 300, dur: 0.07, vol: 0.04 }); },
  hit() {
    noise({ dur: 0.09, vol: 0.5, f0: 2400, f1: 500, type: 'lowpass', q: 2 });
    tone({ f0: 190, f1: 60, dur: 0.14, vol: 0.55 });
    tone({ type: 'square', f0: 1400, f1: 900, dur: 0.03, vol: 0.05 });
  },
  parry() { tone({ type: 'triangle', f0: 1700, f1: 1600, dur: 0.35, vol: 0.12, wet: 0.5 }); tone({ type: 'square', f0: 2400, dur: 0.04, vol: 0.05 }); },
  jump() { noise({ dur: 0.1, vol: 0.1, f0: 500, f1: 1800, q: 1.5 }); },
  dj() { noise({ dur: 0.22, vol: 0.16, f0: 1800, f1: 5000, type: 'highpass' }); tone({ f0: 600, f1: 1300, dur: 0.16, vol: 0.05, wet: 0.4 }); },
  dash() { noise({ dur: 0.22, vol: 0.3, f0: 350, f1: 2600, q: 0.9 }); },
  land() { tone({ f0: 120, f1: 50, dur: 0.1, vol: 0.25 }); noise({ dur: 0.08, vol: 0.12, f0: 400, type: 'lowpass' }); },
  hurt() {
    tone({ type: 'sawtooth', f0: 240, f1: 50, dur: 0.4, vol: 0.25, wet: 0.4 });
    noise({ dur: 0.35, vol: 0.55, f0: 3000, f1: 200, type: 'lowpass', wet: 0.4 });
    tone({ type: 'triangle', f0: 1900, f1: 1700, dur: 0.6, vol: 0.06, wet: 0.8 });
  },
  down() { tone({ type: 'triangle', f0: 400, f1: 80, dur: 1.4, vol: 0.18, wet: 0.8 }); noise({ dur: 0.6, vol: 0.4, f0: 1500, f1: 100, type: 'lowpass', wet: 0.6 }); },
  die() { noise({ dur: 0.3, vol: 0.4, f0: 1400, f1: 180, type: 'lowpass', q: 4 }); tone({ f0: 320, f1: 70, dur: 0.25, vol: 0.3 }); },
  bossdie() { noise({ dur: 2, vol: 0.6, f0: 2000, f1: 60, type: 'lowpass', wet: 0.8 }); tone({ type: 'sawtooth', f0: 110, f1: 30, dur: 2, vol: 0.25, wet: 0.6 }); },
  spell() { tone({ type: 'sawtooth', f0: 180, f1: 900, dur: 0.28, vol: 0.12, wet: 0.5 }); noise({ dur: 0.3, vol: 0.25, f0: 800, f1: 4000, q: 0.8, wet: 0.4 }); },
  focus() { tone({ f0: 220, f1: 440, dur: 0.9, vol: 0.06, a: 0.3, wet: 0.6 }); },
  heal() { [880, 1320, 1760].forEach((f, i) => tone({ f0: f, dur: 1.2, vol: 0.08, delay: i * 0.05, wet: 0.8 })); },
  revive() { [440, 660, 880, 1320].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 1, vol: 0.08, delay: i * 0.09, wet: 0.8 })); },
  wave() {
    [55, 82.5, 110].forEach(f => tone({ f0: f, dur: 3.2, vol: 0.22, a: 0.02, wet: 0.7 }));
    tone({ type: 'triangle', f0: 220, dur: 2.4, vol: 0.06, wet: 0.9 });
    noise({ dur: 1.5, vol: 0.15, f0: 200, type: 'lowpass', wet: 0.5 });
  },
  clear() { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 1.6, vol: 0.07, delay: i * 0.12, wet: 0.9 })); },
  roar() { tone({ type: 'sawtooth', f0: 95, f1: 45, dur: 1.3, vol: 0.3, a: 0.05, wet: 0.6 }); noise({ dur: 1.2, vol: 0.4, f0: 900, f1: 150, type: 'lowpass', q: 3, wet: 0.5 }); },
  slam() { tone({ f0: 90, f1: 30, dur: 0.6, vol: 0.7 }); noise({ dur: 0.5, vol: 0.5, f0: 800, f1: 80, type: 'lowpass', wet: 0.4 }); },
  thud() { tone({ f0: 140, f1: 40, dur: 0.3, vol: 0.5 }); noise({ dur: 0.2, vol: 0.3, f0: 600, type: 'lowpass' }); },
  swing() { noise({ dur: 0.3, vol: 0.35, f0: 300, f1: 1800, q: 0.8 }); },
  spit() { tone({ f0: 420, f1: 140, dur: 0.14, vol: 0.2 }); noise({ dur: 0.1, vol: 0.12, f0: 900, q: 3 }); },
  hop() { tone({ f0: 300, f1: 520, dur: 0.08, vol: 0.06 }); },
  spawn() { noise({ dur: 0.7, vol: 0.12, f0: 160, f1: 420, type: 'lowpass', q: 6 }); },
  over() { [220, 196, 165, 110].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 2.4, vol: 0.1, delay: i * 0.4, wet: 0.9 })); },
  ui() { tone({ type: 'triangle', f0: 660, dur: 0.12, vol: 0.06, wet: 0.4 }); },
};

export function play(name) {
  if (!ac || muted) return;
  const f = SFX[name];
  if (f) try { f(); } catch {}
}

// Ambient score: low drone + sparse, reverberant bell notes in a minor mode.
function startMusic() {
  const t = ac.currentTime;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 2;
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ac.createGain(); lfoG.gain.value = 140;
  lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start(t);
  const dg = ac.createGain(); dg.gain.value = 0.0001;
  dg.gain.exponentialRampToValueAtTime(0.11, t + 6);
  lp.connect(dg); dg.connect(music);
  for (const [f, type] of [[55, 'sawtooth'], [55.3, 'sawtooth'], [82.4, 'triangle'], [110, 'sine']]) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.connect(lp); o.start(t);
  }
  const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
  const bell = () => {
    if (!ac) return;
    if (!muted) {
      const f = scale[Math.floor(Math.random() * scale.length)];
      tone({ f0: f, dur: 3.5, vol: 0.05, a: 0.01, wet: 1, dest: music });
      tone({ f0: f * 2.01, dur: 1.5, vol: 0.012, a: 0.01, wet: 1, dest: music });
      if (Math.random() < 0.35) tone({ f0: f * 1.5, dur: 3, vol: 0.03, delay: 0.4, wet: 1, dest: music });
    }
    musicTimer = setTimeout(bell, 1800 + Math.random() * 3800);
  };
  musicTimer = setTimeout(bell, 2500);
}
