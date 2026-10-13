// Motos de luz: cada moto deixa um rastro. Não bata em rastros nem nas bordas e faça as motos do
// computador baterem primeiro. Vencer a rodada vale +100 e a próxima tem mais motos.
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import { COLORS, useCanvas, useKeys, useRaf, useSwipe } from '../kit.js';
import { sfx } from '../audio.js';
import './LightCycles.css';

const N = 40;
const CELL = 9;
const W = N * CELL;
const H = N * CELL;
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const LEFT = { up: 'left', left: 'down', down: 'right', right: 'up' };
const RIGHT = { up: 'right', right: 'down', down: 'left', left: 'up' };
const BIKE_COLORS = [COLORS.yellow, COLORS.red, COLORS.sky, COLORS.lime];
const STARTS = [
  { x: 6, y: N / 2, dir: 'right' },
  { x: N - 7, y: N / 2 - 1, dir: 'left' },
  { x: N / 2 - 1, y: 6, dir: 'down' },
  { x: N / 2, y: N - 7, dir: 'up' },
];

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 12, userSelect: 'none' };

function newRound(round, score) {
  const cpus = Math.min(3, round);
  const bikes = [];
  for (let i = 0; i <= cpus; i++) {
    const p = STARTS[i];
    bikes.push({ id: i + 1, x: p.x, y: p.y, dir: p.dir, alive: true, cpu: i > 0, color: BIKE_COLORS[i] });
  }
  const grid = new Uint8Array(N * N);
  bikes.forEach((b) => { grid[b.y * N + b.x] = b.id; });
  return {
    round, score, bikes, grid, queue: [], acc: 0, countdown: 2.4, phase: 'play', phaseT: 0,
    booms: [], ghosts: [], visit: new Uint32Array(N * N), stamp: 1, bfs: new Int32Array(N * N),
  };
}

const stepMs = (round) => Math.max(58, 100 - (round - 1) * 7);
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

// Quantas casas livres dá para alcançar a partir de (sx, sy), até um limite.
function flood(s, sx, sy, limit) {
  s.stamp += 1;
  if (s.stamp > 4e9) { s.visit.fill(0); s.stamp = 1; }
  const mark = s.stamp;
  const q = s.bfs;
  let head = 0; let tail = 0;
  q[tail++] = sy * N + sx;
  s.visit[sy * N + sx] = mark;
  while (head < tail && tail < limit) {
    const c = q[head++];
    const x = c % N; const y = (c - x) / N;
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (!inside(nx, ny)) continue;
      const k = ny * N + nx;
      if (s.grid[k] || s.visit[k] === mark) continue;
      s.visit[k] = mark;
      q[tail++] = k;
    }
  }
  return tail;
}

function runLength(s, x, y, dir) {
  const [dx, dy] = VEC[dir];
  let n = 0;
  let cx = x + dx; let cy = y + dy;
  while (inside(cx, cy) && !s.grid[cy * N + cx] && n < 20) { n++; cx += dx; cy += dy; }
  return n;
}

function cpuChoose(s, b, player) {
  const opts = [b.dir, LEFT[b.dir], RIGHT[b.dir]];
  const safe = opts.filter((d) => {
    const nx = b.x + VEC[d][0]; const ny = b.y + VEC[d][1];
    return inside(nx, ny) && !s.grid[ny * N + nx];
  });
  if (!safe.length) return b.dir;
  // Às vezes erra (fica vencível); erra mais nas primeiras rodadas.
  const errP = Math.max(0.015, 0.05 - s.round * 0.008);
  if (Math.random() < errP) return safe[Math.floor(Math.random() * safe.length)];
  const limit = 360;
  const aggr = Math.min(1.2, 0.3 + s.round * 0.15);
  let best = safe[0]; let bestScore = -Infinity;
  for (const d of safe) {
    const nx = b.x + VEC[d][0]; const ny = b.y + VEC[d][1];
    s.grid[ny * N + nx] = 255; // considera a própria casa ocupada
    const area = flood(s, nx, ny, limit);
    s.grid[ny * N + nx] = 0;
    let sc = Math.min(area, limit) * 1.0 + runLength(s, nx, ny, d) * 1.5 + (d === b.dir ? 4 : 0) + Math.random() * 8;
    if (player?.alive && area >= limit - 4) {
      // tenta cortar a frente do jogador
      const tx = player.x + VEC[player.dir][0] * 5; const ty = player.y + VEC[player.dir][1] * 5;
      sc -= (Math.abs(tx - nx) + Math.abs(ty - ny)) * aggr;
    }
    if (sc > bestScore) { bestScore = sc; best = d; }
  }
  return best;
}

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newRound(1, 0);
  const ended = useRef(false);
  const endTimer = useRef(null);
  const [running, setRunning] = useState(true);
  const [hud, setHud] = useState({ round: 1, cpus: 1 });

  useEffect(() => { onScore?.(0); }, []);
  useEffect(() => () => clearTimeout(endTimer.current), []);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    const final = st.current.score;
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(final); }, 1300);
  };

  const lastDir = () => {
    const s = st.current;
    return s.queue.length ? s.queue[s.queue.length - 1] : s.bikes[0].dir;
  };
  const turnAbs = (d) => {
    const s = st.current;
    if (ended.current || !VEC[d] || !s.bikes[0].alive) return;
    const last = lastDir();
    if (d === last || d === OPP[last]) return;
    if (s.queue.length < 2) { s.queue.push(d); sfx('move'); }
  };
  const turnRel = (side) => turnAbs(side === 'left' ? LEFT[lastDir()] : RIGHT[lastDir()]);

  useKeys((k, down) => { if (down) turnAbs(k); });
  useSwipe(canvasRef, turnAbs);

  const tick = () => {
    const s = st.current;
    const player = s.bikes[0];
    if (s.queue.length) player.dir = s.queue.shift();
    s.bikes.forEach((b) => { if (b.alive && b.cpu) b.dir = cpuChoose(s, b, player); });
    const alive = s.bikes.filter((b) => b.alive);
    const next = alive.map((b) => ({ b, x: b.x + VEC[b.dir][0], y: b.y + VEC[b.dir][1] }));
    const dead = new Set();
    next.forEach((n) => { if (!inside(n.x, n.y) || s.grid[n.y * N + n.x]) dead.add(n.b); });
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        if (next[i].x === next[j].x && next[i].y === next[j].y) { dead.add(next[i].b); dead.add(next[j].b); }
      }
    }
    next.forEach((n) => {
      if (dead.has(n.b)) return;
      n.b.x = n.x; n.b.y = n.y;
      s.grid[n.y * N + n.x] = n.b.id;
    });
    dead.forEach((b) => {
      b.alive = false;
      s.booms.push({ x: b.x, y: b.y, color: b.color, t: 0 });
      if (b.cpu) {
        // o rastro de quem bateu some
        const cells = [];
        for (let k = 0; k < N * N; k++) if (s.grid[k] === b.id) { cells.push(k); s.grid[k] = 0; }
        s.ghosts.push({ cells, color: b.color, t: 0 });
      }
    });
    if (dead.size) sfx('hit');
    if (!player.alive) { finish(); return; }
    s.score += 1;
    if (s.bikes.every((b) => !b.cpu || !b.alive)) {
      s.score += 100;
      s.phase = 'cleared';
      s.phaseT = 0;
      sfx('win');
    } else if (dead.size) {
      setHud({ round: s.round, cpus: s.bikes.filter((b) => b.cpu && b.alive).length });
    }
    onScore?.(s.score);
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    ctx.fillStyle = '#060B1E';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(127,178,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= N; i += 2) {
      ctx.moveTo(i * CELL + 0.5, 0); ctx.lineTo(i * CELL + 0.5, H);
      ctx.moveTo(0, i * CELL + 0.5); ctx.lineTo(W, i * CELL + 0.5);
    }
    ctx.stroke();
    s.ghosts.forEach((g) => {
      ctx.globalAlpha = Math.max(0, 0.6 - g.t);
      ctx.fillStyle = g.color;
      g.cells.forEach((k) => ctx.fillRect((k % N) * CELL + 1, Math.floor(k / N) * CELL + 1, CELL - 2, CELL - 2));
    });
    ctx.globalAlpha = 1;
    const colorOf = {};
    s.bikes.forEach((b) => { colorOf[b.id] = b.color; });
    for (let k = 0; k < N * N; k++) {
      const id = s.grid[k];
      if (!id) continue;
      ctx.fillStyle = colorOf[id];
      ctx.globalAlpha = 0.75;
      ctx.fillRect((k % N) * CELL + 1, Math.floor(k / N) * CELL + 1, CELL - 2, CELL - 2);
    }
    ctx.globalAlpha = 1;
    s.bikes.forEach((b) => {
      if (!b.alive) return;
      const cx = b.x * CELL + CELL / 2; const cy = b.y * CELL + CELL / 2;
      ctx.shadowColor = b.color; ctx.shadowBlur = 12;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.white;
      ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.32, 0, Math.PI * 2); ctx.fill();
    });
    s.booms.forEach((bm) => {
      const r = 4 + bm.t * 60;
      ctx.globalAlpha = Math.max(0, 1 - bm.t * 1.6);
      ctx.strokeStyle = bm.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bm.x * CELL + CELL / 2, bm.y * CELL + CELL / 2, r, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (s.countdown > 0 && !ended.current) {
      ctx.fillStyle = 'rgba(6,11,30,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`Rodada ${s.round}`, W / 2, H / 2 - 50);
      ctx.fillStyle = COLORS.yellow;
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText(String(Math.ceil(s.countdown / 0.8)), W / 2, H / 2 + 10);
      ctx.fillStyle = COLORS.sky;
      ctx.font = '14px sans-serif';
      ctx.fillText('Você é a moto amarela', W / 2, H / 2 + 60);
    }
    if (s.phase === 'cleared') {
      ctx.fillStyle = 'rgba(6,11,30,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLORS.lime;
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Rodada vencida!', W / 2, H / 2 - 14);
      ctx.fillStyle = COLORS.yellow;
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('+100', W / 2, H / 2 + 22);
    }
    if (ended.current) {
      ctx.fillStyle = 'rgba(6,11,30,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLORS.red;
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('Você bateu!', W / 2, H / 2 - 14);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`${s.score} pontos`, W / 2, H / 2 + 22);
    }
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(String(s.score), 8, 14);
  };

  useRaf((dt) => {
    const s = st.current;
    s.booms.forEach((b) => { b.t += dt; });
    s.booms = s.booms.filter((b) => b.t < 0.7);
    s.ghosts.forEach((g) => { g.t += dt; });
    s.ghosts = s.ghosts.filter((g) => g.t < 0.6);
    if (!ended.current) {
      if (s.phase === 'cleared') {
        s.phaseT += dt;
        if (s.phaseT > 1.6) {
          st.current = newRound(s.round + 1, s.score);
          setHud({ round: s.round + 1, cpus: Math.min(3, s.round + 1) });
        }
      } else if (s.countdown > 0) {
        s.countdown -= dt;
      } else {
        s.acc += dt * 1000;
        let guard = 0;
        while (s.acc >= stepMs(s.round) && !ended.current && s.phase === 'play' && guard++ < 3) {
          s.acc -= stepMs(s.round);
          tick();
        }
        if (guard >= 3) s.acc = 0;
      }
    }
    draw();
  }, running);

  const btn = (side, Icon, label) => (
    <button
      type="button"
      className="lightcycles-btn"
      aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); turnRel(side); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Icon size={24} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="lightcycles">
      <div className="lightcycles-hud">
        <span>Rodada {hud.round}</span>
        <span>{hud.cpus === 1 ? '1 moto rival' : `${hud.cpus} motos rivais`}</span>
      </div>
      <canvas ref={canvasRef} style={canvasStyle} aria-label="Motos de luz" />
      <div className="lightcycles-controls">
        {btn('left', RotateCcw, 'Esquerda')}
        {btn('right', RotateCw, 'Direita')}
      </div>
    </div>
  );
}
