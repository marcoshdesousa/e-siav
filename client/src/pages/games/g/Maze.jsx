// Labirinto: leve a bolinha até a saída. Cada fase é um labirinto novo (busca em profundidade)
// e maior. Deslize para correr pelo corredor; segure as setas para continuar andando.
import { useEffect, useRef, useState } from 'react';
import { COLORS, shuffle, useCanvas, useKeys, useRaf, useSwipe } from '../kit.js';
import DPad from '../DPad.jsx';
import { sfx } from '../audio.js';

const W = 360;
const H = 360;
const START_SECS = 60;
const BONUS_SECS = 15;
// bits de passagem: N=1, L=2, S=4, O=8
const DIRS = { up: [1, 0, -1], right: [2, 1, 0], down: [4, 0, 1], left: [8, -1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const OPPBIT = { 1: 4, 2: 8, 4: 1, 8: 2 };
const sizeFor = (level) => Math.min(24, 6 + level * 2);
const STEP_MS = 95;
const RUN_MS = 55;

function makeMaze(n) {
  const cells = new Uint8Array(n * n);
  const seen = new Uint8Array(n * n);
  const stack = [0];
  seen[0] = 1;
  const order = new Map();
  while (stack.length) {
    const cur = stack[stack.length - 1];
    if (!order.has(cur)) order.set(cur, shuffle(Object.values(DIRS)));
    const opts = order.get(cur);
    let moved = false;
    while (opts.length) {
      const [bit, dx, dy] = opts.pop();
      const x = (cur % n) + dx; const y = Math.floor(cur / n) + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const j = y * n + x;
      if (seen[j]) continue;
      seen[j] = 1;
      cells[cur] |= bit;
      cells[j] |= OPPBIT[bit];
      stack.push(j);
      moved = true;
      break;
    }
    if (!moved) stack.pop();
  }
  return cells;
}

const newLevel = (level) => {
  const n = sizeFor(level);
  return { n, cells: makeMaze(n), x: 0, y: 0, px: 0, py: 0, trail: new Set([0]), levelStart: Date.now() };
};

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none' };

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = { level: 1, ...newLevel(1), total: 0, held: null, run: null, acc: 0, flash: 0, gained: 0, over: false };
  const endAt = useRef(0);
  const ended = useRef(false);
  const [running, setRunning] = useState(true);
  const [hud, setHud] = useState({ left: START_SECS, level: 1, total: 0 });
  const timers = useRef([]);

  useEffect(() => {
    cbs.current.onScore(0);
    endAt.current = Date.now() + START_SECS * 1000;
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    st.current.over = true;
    sfx('lose');
    timers.current.push(setTimeout(() => { setRunning(false); cbs.current.onEnd(st.current.total); }, 1200));
  };

  const open = (s, dir) => !!(s.cells[s.y * s.n + s.x] & DIRS[dir][0]);

  const step = (dir) => {
    const s = st.current;
    if (s.over || s.flash > 0 || !open(s, dir)) return false;
    const [, dx, dy] = DIRS[dir];
    s.x += dx; s.y += dy;
    s.trail.add(s.y * s.n + s.x);
    if (s.x === s.n - 1 && s.y === s.n - 1) {
      const secs = (Date.now() - s.levelStart) / 1000;
      s.gained = 100 + Math.max(0, Math.round(s.n * 2.5 - secs)) * 3;
      s.total += s.gained;
      endAt.current += BONUS_SECS * 1000;
      s.flash = 1.2;
      s.held = null; s.run = null;
      sfx('win');
      cbs.current.onScore(s.total);
    }
    return true;
  };

  const press = (d, isDown) => {
    const s = st.current;
    if (!DIRS[d]) return;
    if (isDown) {
      s.run = null;
      s.held = d;
      s.acc = 0;
      if (step(d)) sfx('move');
    } else if (s.held === d) {
      s.held = null;
    }
  };

  const swipe = (d) => {
    const s = st.current;
    if (s.over || s.flash > 0) return;
    s.held = null;
    if (!open(s, d)) { sfx('error'); return; }
    s.run = d;
    s.acc = RUN_MS;
    sfx('move');
  };

  useKeys((k, isDown) => press(k, isDown));
  useSwipe(canvasRef, swipe);

  const runStep = (s) => {
    let d = s.run;
    if (!open(s, d)) {
      // Curva de corredor: segue pela única outra saída.
      const outs = Object.keys(DIRS).filter((k) => k !== OPP[d] && open(s, k));
      if (outs.length !== 1) { s.run = null; return; }
      [d] = outs;
      s.run = d;
    }
    step(d);
    if (s.flash > 0) return;
    const exits = Object.keys(DIRS).filter((k) => open(s, k)).length;
    if (exits >= 3 || exits === 1) s.run = null;
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const pad = 8;
    const cs = (W - pad * 2) / s.n;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    // trilha
    ctx.fillStyle = 'rgba(127,178,255,0.16)';
    s.trail.forEach((i) => ctx.fillRect(pad + (i % s.n) * cs, pad + Math.floor(i / s.n) * cs, cs, cs));
    // saída
    const ex = pad + (s.n - 1) * cs; const ey = pad + (s.n - 1) * cs;
    ctx.fillStyle = 'rgba(91,211,138,0.35)';
    ctx.fillRect(ex, ey, cs, cs);
    ctx.font = `${Math.floor(cs * 0.75)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏁', ex + cs / 2, ey + cs / 2 + 1);
    // paredes
    ctx.strokeStyle = COLORS.sky;
    ctx.lineWidth = Math.max(2, cs * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = 0; y < s.n; y++) {
      for (let x = 0; x < s.n; x++) {
        const m = s.cells[y * s.n + x];
        const x0 = pad + x * cs; const y0 = pad + y * cs;
        if (!(m & 1)) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + cs, y0); }
        if (!(m & 8)) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + cs); }
        if (x === s.n - 1 && !(m & 2)) { ctx.moveTo(x0 + cs, y0); ctx.lineTo(x0 + cs, y0 + cs); }
        if (y === s.n - 1 && !(m & 4)) { ctx.moveTo(x0, y0 + cs); ctx.lineTo(x0 + cs, y0 + cs); }
      }
    }
    ctx.stroke();
    // jogador
    const cx = pad + s.px * cs + cs / 2; const cy = pad + s.py * cs + cs / 2;
    ctx.fillStyle = COLORS.yellow;
    ctx.shadowColor = COLORS.yellow; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(cx, cy, cs * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    if (s.flash > 0 || s.over) {
      ctx.fillStyle = 'rgba(11,20,48,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(s.over ? 'O tempo acabou!' : 'Saída encontrada!', W / 2, H / 2 - 14);
      if (!s.over) {
        ctx.fillStyle = COLORS.lime;
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(`+${s.gained} pontos · +${BONUS_SECS}s`, W / 2, H / 2 + 20);
      }
    }
  };

  useRaf((dt) => {
    const s = st.current;
    if (!s.over) {
      if (s.flash > 0) {
        s.flash -= dt;
        if (s.flash <= 0) {
          s.flash = 0;
          s.level += 1;
          Object.assign(s, newLevel(s.level));
          endAt.current += 1200; // a pausa entre fases não conta
        }
      } else if (s.run) {
        s.acc += dt * 1000;
        while (s.run && s.acc >= RUN_MS && s.flash <= 0) { s.acc -= RUN_MS; runStep(s); }
      } else if (s.held) {
        s.acc += dt * 1000;
        if (s.acc >= STEP_MS * 1.8) { s.acc -= STEP_MS; step(s.held); }
      }
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      if (left === 0 && s.flash <= 0) finish();
      if (left !== hud.left || s.level !== hud.level || s.total !== hud.total) setHud({ left, level: s.level, total: s.total });
    }
    const k = Math.min(1, dt * 22);
    s.px += (s.x - s.px) * k; s.py += (s.y - s.py) * k;
    if (Math.abs(s.x - s.px) > 2 || Math.abs(s.y - s.py) > 2) { s.px = s.x; s.py = s.y; }
    draw();
  }, running);

  const mm = Math.floor(hud.left / 60); const ss = String(hud.left % 60).padStart(2, '0');
  const bar = { display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '0 4px', marginBottom: 8 };
  return (
    <div>
      <div style={bar}>
        <span>Fase <b>{hud.level}</b></span>
        <span style={hud.left <= 10 ? { color: COLORS.red } : undefined}>⏱ <b>{mm}:{ss}</b></span>
        <span>Pontos: <b>{hud.total}</b></span>
      </div>
      <canvas ref={canvasRef} style={canvasStyle} aria-label="Labirinto" />
      <DPad onDir={press} />
    </div>
  );
}
