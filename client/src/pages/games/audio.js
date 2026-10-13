// Som dos mini jogos (sem arquivos): efeitos curtos e uma musiquinha em loop, gerados na hora
// com WebAudio. O botão de som liga/desliga tudo e a escolha fica salva no aparelho.
let ctx = null;
let master = null;
let musicGain = null;
let musicTimer = null;
let muted = false;
const listeners = new Set();
try { muted = localStorage.getItem('jogos-mudo') === '1'; } catch { /* sem armazenamento */ }

function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(master);
  } catch { ctx = null; }
  return ctx;
}

/** Chame num toque/clique para liberar o som no celular. */
export function unlockAudio() {
  const a = audio();
  if (a && a.state === 'suspended') a.resume().catch(() => {});
}

export const isMuted = () => muted;
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem('jogos-mudo', muted ? '1' : '0'); } catch { /* ok */ }
  if (master) master.gain.value = muted ? 0 : 0.5;
  listeners.forEach((f) => f(muted));
}
export function onMuteChange(f) { listeners.add(f); return () => listeners.delete(f); }

function tone(freq, start, dur, { type = 'square', vol = 0.3, to = null, out = master } = {}) {
  const a = audio();
  if (!a || muted || !out) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(start, dur, vol = 0.25) {
  const a = audio();
  if (!a || muted) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = vol;
  s.buffer = buf; s.connect(g); g.connect(master);
  s.start(a.currentTime + start);
}

const SFX = {
  tap: () => tone(660, 0, 0.05, { type: 'triangle', vol: 0.2 }),
  move: () => tone(440, 0, 0.04, { type: 'triangle', vol: 0.15 }),
  flip: () => tone(520, 0, 0.06, { type: 'sine', vol: 0.2, to: 780 }),
  point: () => { tone(880, 0, 0.07, { vol: 0.18 }); tone(1320, 0.06, 0.08, { vol: 0.16 }); },
  coin: () => { tone(988, 0, 0.06, { vol: 0.18 }); tone(1319, 0.05, 0.12, { vol: 0.18 }); },
  jump: () => tone(300, 0, 0.16, { type: 'square', vol: 0.16, to: 700 }),
  shoot: () => tone(900, 0, 0.09, { type: 'sawtooth', vol: 0.1, to: 200 }),
  pop: () => tone(500, 0, 0.08, { type: 'sine', vol: 0.25, to: 1200 }),
  hit: () => { noise(0, 0.15, 0.3); tone(160, 0, 0.15, { type: 'square', vol: 0.18, to: 60 }); },
  error: () => tone(180, 0, 0.22, { type: 'sawtooth', vol: 0.16, to: 120 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.16, { vol: 0.2 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.12, 0.2, { type: 'triangle', vol: 0.22 })),
  record: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.14, { vol: 0.2 })),
};

/** Efeito sonoro: tap, move, flip, point, coin, jump, shoot, pop, hit, error, win, lose, record. */
export function sfx(name) {
  try { SFX[name]?.(); } catch { /* sem som */ }
}

// ---------- Música: cada jogo tem a sua (escala, andamento e melodia tirados do id) ----------
const SCALES = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10]];
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function startMusic(seed = 'jogo') {
  stopMusic();
  const a = audio();
  if (!a) return;
  let h = hash(seed);
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
  const scale = SCALES[Math.floor(rnd() * SCALES.length)];
  const root = 196 * 2 ** (Math.floor(rnd() * 7) / 12);
  const bpm = 96 + Math.floor(rnd() * 50);
  const step = 60 / bpm / 2;
  const note = (deg, oct = 0) => root * 2 ** ((scale[((deg % scale.length) + scale.length) % scale.length] + 12 * (oct + Math.floor(deg / scale.length))) / 12);
  const melody = Array.from({ length: 16 }, () => (rnd() < 0.2 ? null : Math.floor(rnd() * 8)));
  const bass = [0, 0, 3, 4].map((d) => (rnd() < 0.5 ? d : Math.floor(rnd() * 5)));
  let i = 0;
  const tick = () => {
    if (!muted) {
      const m = melody[i % 16];
      if (m != null) tone(note(m, 1), 0, step * 0.9, { type: 'square', vol: 0.12, out: musicGain });
      if (i % 4 === 0) tone(note(bass[(i / 4) % 4], -1), 0, step * 3.5, { type: 'triangle', vol: 0.28, out: musicGain });
    }
    i++;
  };
  tick();
  musicTimer = setInterval(tick, step * 1000);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
