// Ritmo: as notas descem pelas 4 pistas; toque na pista (ou D F J K) quando a nota chegar na linha.
// O andamento acelera aos poucos. 10 erros terminam o jogo. Sequências seguidas multiplicam os pontos.
import { useEffect, useRef, useState } from 'react';
import { COLORS, rand, useCanvas, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 500;
const LANES = 4;
const LW = W / LANES;
const HIT_Y = 405;
const PERFECT = 0.06;
const GOOD = 0.13;
const MAX_MISS = 10;
const LANE_COLORS = [COLORS.red, COLORS.yellow, COLORS.lime, COLORS.sky];
const KEY_LANE = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
const LABELS = ['D', 'F', 'J', 'K'];

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'pointer' };
const rrect = (ctx, x, y, w, h, r) => (ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h));

function newState() {
  return {
    time: 0, real: window.performance.now(), notes: [], nextBeat: 2.2, beatN: 0, lastLane: -1,
    score: 0, combo: 0, best: 0, misses: 0, hits: 0,
    flash: [0, 0, 0, 0], judge: null, sparks: [],
  };
}

const bpmAt = (t) => Math.min(170, 92 + t * 1.1);
const travelAt = (t) => Math.max(0.95, 1.7 - t * 0.008);
const mult = (combo) => Math.min(4, 1 + Math.floor(combo / 10));

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const endTimer = useRef(null);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);
  useEffect(() => () => clearTimeout(endTimer.current), []);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    const final = st.current.score;
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(final); }, 1100);
  };

  const press = (lane) => {
    const s = st.current;
    if (ended.current) return;
    s.flash[lane] = 1;
    const now = s.time + Math.min(0.05, (window.performance.now() - s.real) / 1000);
    let best = null;
    for (const n of s.notes) {
      if (n.lane !== lane || n.done) continue;
      const d = Math.abs(n.t - now);
      if (d <= GOOD && (!best || d < Math.abs(best.t - now))) best = n;
    }
    if (!best) {
      // Toque fora de hora quebra a sequência (evita ganhar só batendo em tudo).
      if (s.combo > 0) { s.combo = 0; s.judge = { text: 'Fora do tempo', color: COLORS.gray, t: 0.6 }; }
      sfx('tap');
      return;
    }
    best.done = true;
    const perfect = Math.abs(best.t - now) <= PERFECT;
    s.combo += 1;
    s.best = Math.max(s.best, s.combo);
    s.hits += 1;
    s.score += (perfect ? 3 : 1) * mult(s.combo);
    s.judge = perfect ? { text: 'Perfeito!', color: COLORS.yellow, t: 0.6 } : { text: 'Bom', color: COLORS.lime, t: 0.6 };
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2; const v = 60 + Math.random() * 120;
      s.sparks.push({ x: lane * LW + LW / 2, y: HIT_Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.5, color: LANE_COLORS[lane] });
    }
    sfx(perfect ? 'point' : 'tap');
    if (s.combo > 0 && s.combo % 10 === 0) sfx('coin');
    onScore?.(s.score);
  };

  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const down = (e) => {
      const lane = KEY_LANE[e.code];
      if (lane == null) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      e.preventDefault();
      if (e.repeat) return;
      pressRef.current(lane);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const onPointer = (e) => {
    e.preventDefault();
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    press(Math.max(0, Math.min(LANES - 1, Math.floor(x / LW))));
  };

  const spawn = (s) => {
    const travel = travelAt(s.time);
    while (s.nextBeat < s.time + travel) {
      const bpm = bpmAt(s.nextBeat);
      const half = 60 / bpm / 2;
      const onBeat = s.beatN % 2 === 0;
      const lvl = Math.min(1, s.nextBeat / 120);
      const chance = onBeat ? 0.85 : 0.12 + lvl * 0.4;
      if (Math.random() < chance) {
        let lane = rand(LANES);
        if (lane === s.lastLane && Math.random() < 0.6) lane = (lane + 1 + rand(3)) % LANES;
        s.notes.push({ lane, t: s.nextBeat, done: false });
        s.lastLane = lane;
        if (onBeat && s.beatN % 8 === 0 && Math.random() < 0.15 + lvl * 0.35) {
          const other = (lane + 1 + rand(3)) % LANES;
          s.notes.push({ lane: other, t: s.nextBeat, done: false });
        }
      }
      s.nextBeat += half;
      s.beatN += 1;
    }
  };

  const update = (dt) => {
    const s = st.current;
    s.real = window.performance.now();
    s.flash = s.flash.map((f) => Math.max(0, f - dt * 5));
    if (s.judge) { s.judge.t -= dt; if (s.judge.t <= 0) s.judge = null; }
    s.sparks.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; });
    s.sparks = s.sparks.filter((p) => p.life > 0);
    if (ended.current) return;
    s.time += dt;
    spawn(s);
    let missed = false;
    for (const n of s.notes) {
      if (!n.done && s.time - n.t > GOOD) { n.done = true; n.missed = true; s.misses += 1; missed = true; }
    }
    if (missed) {
      s.combo = 0;
      s.judge = { text: 'Errou', color: COLORS.red, t: 0.6 };
      sfx('error');
      if (s.misses >= MAX_MISS) finish();
    }
    s.notes = s.notes.filter((n) => !n.done || (n.missed && s.time - n.t < 0.5));
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#081028'); bg.addColorStop(1, COLORS.navy);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const travel = travelAt(s.time);
    // pistas
    for (let i = 0; i < LANES; i++) {
      const x = i * LW;
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, 0, LW, H);
      if (s.flash[i] > 0) {
        const g = ctx.createLinearGradient(0, HIT_Y, 0, 0);
        g.addColorStop(0, LANE_COLORS[i] + '66'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = s.flash[i];
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, LW, HIT_Y);
        ctx.globalAlpha = 1;
      }
    }
    // linhas de batida passando
    const bpm = bpmAt(s.time);
    const beat = 60 / bpm;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    const firstBeat = Math.ceil(s.time / beat) * beat;
    for (let t = firstBeat; t < s.time + travel; t += beat) {
      const y = HIT_Y - ((t - s.time) / travel) * HIT_Y;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // linha de acerto e alvos
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, HIT_Y - 1.5, W, 3);
    for (let i = 0; i < LANES; i++) {
      const cx = i * LW + LW / 2;
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, HIT_Y, 24 + s.flash[i] * 4, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = LANE_COLORS[i] + (s.flash[i] > 0.1 ? 'AA' : '33');
      ctx.fill();
    }
    // notas
    for (const n of s.notes) {
      if (n.done && !n.missed) continue;
      const y = HIT_Y - ((n.t - s.time) / travel) * HIT_Y;
      if (y < -30) continue;
      const cx = n.lane * LW + LW / 2;
      ctx.globalAlpha = n.missed ? 0.35 : 1;
      ctx.fillStyle = LANE_COLORS[n.lane];
      ctx.beginPath(); rrect(ctx, cx - 32, y - 12, 64, 24, 12); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); rrect(ctx, cx - 24, y - 8, 48, 6, 3); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // faíscas
    s.sparks.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    });
    ctx.globalAlpha = 1;
    // teclas
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < LANES; i++) {
      const x = i * LW;
      ctx.fillStyle = s.flash[i] > 0.1 ? LANE_COLORS[i] : 'rgba(255,255,255,0.1)';
      ctx.beginPath(); rrect(ctx, x + 8, HIT_Y + 40, LW - 16, 50, 12); ctx.fill();
      ctx.fillStyle = s.flash[i] > 0.1 ? COLORS.ink : 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(LABELS[i], x + LW / 2, HIT_Y + 65);
    }
    // placar
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(String(s.score), W / 2, 32);
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.sky;
    ctx.fillText(`Sequência ${s.combo}`, 12, 26);
    if (mult(s.combo) > 1) { ctx.fillStyle = COLORS.yellow; ctx.fillText(`x${mult(s.combo)}`, 12, 46); }
    ctx.textAlign = 'right';
    ctx.fillStyle = s.misses >= MAX_MISS - 3 ? COLORS.red : COLORS.gray;
    ctx.fillText(`Erros ${s.misses}/${MAX_MISS}`, W - 12, 26);
    ctx.fillStyle = COLORS.gray;
    ctx.fillText(`${Math.round(bpm)} bpm`, W - 12, 46);
    ctx.textAlign = 'center';
    if (s.judge) {
      ctx.globalAlpha = Math.min(1, s.judge.t * 3);
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = s.judge.color;
      ctx.fillText(s.judge.text, W / 2, HIT_Y - 120 - (0.6 - s.judge.t) * 30);
      ctx.globalAlpha = 1;
    }
    if (s.time < 2 && !ended.current) {
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = COLORS.white;
      ctx.fillText('Prepare-se...', W / 2, H / 2 - 60);
    }
    if (ended.current) {
      ctx.fillStyle = 'rgba(8,16,40,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLORS.yellow;
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('Fim da música!', W / 2, H / 2 - 40);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${s.score} pontos · ${s.hits} acertos`, W / 2, H / 2);
      ctx.fillText(`Maior sequência: ${s.best}`, W / 2, H / 2 + 28);
    }
  };

  useRaf((dt) => { update(dt); draw(); }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Ritmo"
      onPointerDown={onPointer}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
