// Cobrinha: coma as frutas, cresça e não bata em nada. Fica mais rápida conforme cresce.
import { useEffect, useRef, useState } from 'react';
import { COLORS, rand, useCanvas, useKeys, useRaf, useSwipe } from '../kit.js';
import DPad from '../DPad.jsx';

const N = 18;
const CELL = 20;
const W = N * CELL;
const H = N * CELL;
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const FRUITS = ['🍎', '🍓', '🍊', '🍇', '🍒'];

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none' };

function newState() {
  const snake = [{ x: 6, y: 9 }, { x: 5, y: 9 }, { x: 4, y: 9 }];
  const s = { snake, dir: 'right', queue: [], fruit: null, fruitIcon: FRUITS[0], eaten: 0, acc: 0, countdown: 3, grow: 0 };
  placeFruit(s);
  return s;
}

function placeFruit(s) {
  const busy = new Set(s.snake.map((p) => p.y * N + p.x));
  const free = [];
  for (let i = 0; i < N * N; i++) if (!busy.has(i)) free.push(i);
  if (!free.length) { s.fruit = null; return false; }
  const i = free[rand(free.length)];
  s.fruit = { x: i % N, y: Math.floor(i / N) };
  s.fruitIcon = FRUITS[rand(FRUITS.length)];
  return true;
}

const rrect = (ctx, x, y, w, h, r) => (ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h));

const stepMs = (s) => Math.max(65, 160 - s.eaten * 4);

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  const turn = (d) => {
    const s = st.current;
    if (!VEC[d] || ended.current) return;
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (d === last || d === OPP[last]) return;
    if (s.queue.length < 3) s.queue.push(d);
  };

  useKeys((k, down) => { if (down) turn(k); });
  useSwipe(canvasRef, turn);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    setRunning(false);
    onEnd?.(st.current.eaten * 10);
  };

  const tick = () => {
    const s = st.current;
    if (s.queue.length) s.dir = s.queue.shift();
    const [dx, dy] = VEC[s.dir];
    const head = s.snake[0];
    const nx = head.x + dx; const ny = head.y + dy;
    if (nx < 0 || ny < 0 || nx >= N || ny >= N) return finish();
    const eating = s.fruit && nx === s.fruit.x && ny === s.fruit.y;
    // A ponta da cauda sai do lugar neste passo (se não estiver crescendo), então pode ocupar.
    const body = s.grow > 0 || eating ? s.snake : s.snake.slice(0, -1);
    if (body.some((p) => p.x === nx && p.y === ny)) return finish();
    s.snake.unshift({ x: nx, y: ny });
    if (eating) {
      s.eaten += 1;
      s.grow += 1;
      onScore?.(s.eaten * 10);
      if (!placeFruit(s)) return finish();
    }
    if (s.grow > 0) s.grow -= 1; else s.snake.pop();
    return undefined;
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#122046' : '#0F1B3D';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    if (s.fruit) {
      ctx.font = `${CELL - 2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.fruitIcon, s.fruit.x * CELL + CELL / 2, s.fruit.y * CELL + CELL / 2 + 1);
    }
    s.snake.forEach((p, i) => {
      const t = i / Math.max(1, s.snake.length - 1);
      ctx.fillStyle = i === 0 ? COLORS.yellow : t < 0.5 ? COLORS.lime : COLORS.green;
      const pad = i === 0 ? 1 : 2;
      ctx.beginPath();
      rrect(ctx, p.x * CELL + pad, p.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 6);
      ctx.fill();
    });
    // olhos
    const h = s.snake[0];
    const [dx, dy] = VEC[s.dir];
    const cx = h.x * CELL + CELL / 2; const cy = h.y * CELL + CELL / 2;
    ctx.fillStyle = COLORS.navy;
    [[-1, 1], [1, -1]].forEach(([a]) => {
      const ex = cx + dx * 4 + (dy ? a * 4 : 0);
      const ey = cy + dy * 4 + (dx ? a * 4 : 0);
      ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, Math.PI * 2); ctx.fill();
    });
    if (s.countdown > 0) {
      ctx.fillStyle = 'rgba(11,20,48,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLORS.yellow;
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.ceil(s.countdown)), W / 2, H / 2);
    }
  };

  useRaf((dt) => {
    const s = st.current;
    if (ended.current) return;
    if (s.countdown > 0) {
      s.countdown -= dt;
    } else {
      s.acc += dt * 1000;
      let guard = 0;
      while (s.acc >= stepMs(s) && !ended.current && guard++ < 3) {
        s.acc -= stepMs(s);
        tick();
      }
      if (guard >= 3) s.acc = 0;
    }
    draw();
  }, running);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <canvas ref={canvasRef} style={canvasStyle} aria-label="Cobrinha" />
      <DPad onDir={(d, down) => { if (down) turn(d); }} />
    </div>
  );
}
