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

/** Ruído filtrado (vento, arrasto, passo): o filtro desliza de f0 para f1. */
function swish(start, dur, { vol = 0.2, f0 = 800, f1 = 2400, q = 1.2, type = 'bandpass' } = {}) {
  const a = audio();
  if (!a || muted) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  const t0 = a.currentTime + start;
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.buffer = buf; s.connect(f); f.connect(g); g.connect(master);
  s.start(t0); s.stop(t0 + dur + 0.02);
}
/** Sininho (moeda): som de metal com harmônicos. */
function bell(freq, start, dur, vol = 0.16) {
  tone(freq, start, dur, { type: 'sine', vol });
  tone(freq * 2.01, start, dur * 0.6, { type: 'sine', vol: vol * 0.45 });
  tone(freq * 3.98, start, dur * 0.35, { type: 'sine', vol: vol * 0.18 });
}

const SFX = {
  // Surf DBV: troca de trilho (vento curto), pulo, rolar, cair no chão e moedas que vão subindo de tom
  lane: () => swish(0, 0.16, { vol: 0.16, f0: 700, f1: 2600, q: 0.9 }),
  hop: () => { swish(0, 0.18, { vol: 0.12, f0: 500, f1: 1800 }); tone(260, 0, 0.14, { type: 'sine', vol: 0.12, to: 520 }); },
  slide: () => swish(0, 0.35, { vol: 0.18, f0: 1800, f1: 500, q: 0.7 }),
  land: () => { tone(120, 0, 0.12, { type: 'sine', vol: 0.22, to: 55 }); swish(0, 0.1, { vol: 0.08, f0: 400, f1: 200, type: 'lowpass' }); },
  coinstreak: (k = 0) => { const f = 1046 * 2 ** ((Math.min(k, 12) % 13) / 12); bell(f, 0, 0.22); bell(f * 1.5, 0.045, 0.2, 0.1); },

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
  whistle: () => { for (let k = 0; k < 2; k++) { tone(2600, k * 0.32, 0.26, { type: 'sine', vol: 0.18, to: 2450 }); tone(2690, k * 0.32, 0.26, { type: 'sine', vol: 0.1 }); } },
  whoosh: () => noise(0, 0.25, 0.12),
  crash: () => { noise(0, 0.35, 0.45); tone(120, 0, 0.3, { type: 'sawtooth', vol: 0.2, to: 40 }); },
  explode: () => { noise(0, 0.6, 0.5); tone(90, 0, 0.5, { type: 'square', vol: 0.18, to: 30 }); },
  skate: () => [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.05, 0.12, { type: 'triangle', vol: 0.18 })),
  spray: () => noise(0, 0.5, 0.08),
  power: () => [523, 784, 1047, 1568].forEach((f, i) => tone(f, i * 0.06, 0.16, { type: 'triangle', vol: 0.2 })),
  rocket: () => { noise(0, 0.9, 0.18); tone(140, 0, 0.8, { type: 'sawtooth', vol: 0.08, to: 320 }); },
  boing: () => tone(180, 0, 0.28, { type: 'sine', vol: 0.25, to: 900 }),
  // Stumble DBV: pulo, mergulho, pancada, queda na água, ponto seguro, classificação e a roleta das fases
  stbJump: () => { tone(330, 0, 0.13, { type: 'sine', vol: 0.2, to: 760 }); tone(660, 0.02, 0.08, { type: 'triangle', vol: 0.06, to: 1300 }); },
  stbBounce: () => { tone(160, 0, 0.32, { type: 'sine', vol: 0.26, to: 980 }); tone(320, 0.03, 0.22, { type: 'triangle', vol: 0.07, to: 1500 }); },
  stbDive: () => { noise(0, 0.22, 0.1); tone(520, 0, 0.18, { type: 'triangle', vol: 0.12, to: 220 }); },
  stbLand: () => { tone(110, 0, 0.1, { type: 'sine', vol: 0.22, to: 55 }); noise(0, 0.06, 0.06); },
  stbBump: () => { tone(220, 0, 0.12, { type: 'square', vol: 0.12, to: 90 }); tone(90, 0, 0.18, { type: 'sine', vol: 0.3, to: 45 }); noise(0, 0.08, 0.18); },
  stbFall: () => { tone(900, 0, 0.5, { type: 'sine', vol: 0.14, to: 160 }); noise(0.42, 0.3, 0.2); },
  stbDoor: () => { tone(500, 0, 0.08, { type: 'sine', vol: 0.22, to: 1300 }); noise(0, 0.1, 0.12); },
  stbCheckpoint: () => [784, 988, 1175].forEach((f, i) => tone(f, i * 0.06, 0.12, { type: 'triangle', vol: 0.16 })),
  stbQualify: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.16, { type: 'square', vol: 0.12 })); noise(0.3, 0.5, 0.06); },
  stbTick: () => tone(1800, 0, 0.025, { type: 'square', vol: 0.06, to: 1200 }),
  stbDing: () => { tone(1568, 0, 0.5, { type: 'sine', vol: 0.22 }); tone(2093, 0.05, 0.45, { type: 'sine', vol: 0.12 }); tone(3136, 0.05, 0.25, { type: 'sine', vol: 0.05 }); },
  stbGo: () => { tone(880, 0, 0.3, { type: 'square', vol: 0.12 }); tone(1320, 0, 0.3, { type: 'triangle', vol: 0.1 }); },
  stbCount: () => tone(660, 0, 0.12, { type: 'square', vol: 0.12 }),
  // Stumble DBV 2: vento do ventilador
  stbWind: () => { swish(0, 0.55, { vol: 0.12, f0: 500, f1: 1400, q: 0.7 }); noise(0.05, 0.4, 0.05); },
  // Uno DBV: jogar carta, comprar, embaralhar, gritar UNO, pular, inverter, +2/+4, ser pego, sua vez
  unoPlay: () => { swish(0, 0.09, { vol: 0.2, f0: 2600, f1: 900, q: 0.8 }); tone(180, 0.06, 0.06, { type: 'sine', vol: 0.18, to: 90 }); },
  unoDraw: () => swish(0, 0.14, { vol: 0.16, f0: 900, f1: 2800, q: 1 }),
  unoShuffle: () => { for (let k = 0; k < 9; k++) swish(k * 0.045, 0.05, { vol: 0.13, f0: 1800 + (k % 3) * 400, f1: 3200, q: 1.4 }); },
  unoCall: () => { [784, 988, 1319].forEach((f, i) => tone(f, i * 0.07, 0.14, { type: 'square', vol: 0.13 })); tone(1568, 0.21, 0.25, { type: 'triangle', vol: 0.15 }); },
  unoSkip: () => { tone(700, 0, 0.09, { type: 'square', vol: 0.12, to: 350 }); tone(350, 0.1, 0.12, { type: 'square', vol: 0.12, to: 175 }); },
  unoReverse: () => { tone(400, 0, 0.14, { type: 'triangle', vol: 0.18, to: 900 }); tone(900, 0.14, 0.14, { type: 'triangle', vol: 0.18, to: 400 }); },
  unoPlus: () => { [0, 0.07, 0.14, 0.21].forEach((t) => swish(t, 0.07, { vol: 0.14, f0: 1200, f1: 3000 })); tone(220, 0, 0.3, { type: 'sawtooth', vol: 0.08, to: 110 }); },
  unoCaught: () => { tone(300, 0, 0.12, { type: 'square', vol: 0.14 }); tone(220, 0.12, 0.25, { type: 'square', vol: 0.14, to: 150 }); },
  unoTurn: () => { tone(988, 0, 0.08, { type: 'sine', vol: 0.16 }); tone(1319, 0.08, 0.12, { type: 'sine', vol: 0.14 }); },
};

/** Efeito sonoro: tap, move, flip, point, coin, jump, shoot, pop, hit, error, win, lose, record, whistle, whoosh, crash, explode, skate, spray, power, rocket, boing. */
export function sfx(name, v) {
  try { SFX[name]?.(v); } catch { /* sem som */ }
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
