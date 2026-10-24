// Cobrinha: coma as frutas, cresça e não bata em nada. Fica mais rápida conforme cresce.
import { useEffect, useRef, useState } from 'react';
import { rand, useCanvas, useKeys, useRaf, useSwipe } from '../kit.js';
import DPad from '../DPad.jsx';
import { sfx } from '../audio.js';
import { FRUIT_KINDS, drawFruit } from '../art.jsx';

const N = 18;
const CELL = 20;
const W = N * CELL;
const H = N * CELL;
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const FRUITS = FRUIT_KINDS;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none' };

function newState() {
  const snake = [{ x: 6, y: 9 }, { x: 5, y: 9 }, { x: 4, y: 9 }];
  const s = { snake, dir: 'right', queue: [], fruit: null, fruitIcon: FRUITS[0], eaten: 0, acc: 0, countdown: 3, grow: 0, prev: null, fx: [], t: 0 };
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
    s.prev = s.snake.map((p) => ({ ...p }));
    if (s.queue.length) s.dir = s.queue.shift();
    const [dx, dy] = VEC[s.dir];
    const head = s.snake[0];
    const nx = head.x + dx; const ny = head.y + dy;
    if (nx < 0 || ny < 0 || nx >= N || ny >= N) { sfx('hit'); return finish(); }
    const eating = s.fruit && nx === s.fruit.x && ny === s.fruit.y;
    // A ponta da cauda sai do lugar neste passo (se não estiver crescendo), então pode ocupar.
    const body = s.grow > 0 || eating ? s.snake : s.snake.slice(0, -1);
    if (body.some((p) => p.x === nx && p.y === ny)) { sfx('hit'); return finish(); }
    s.snake.unshift({ x: nx, y: ny });
    if (eating) {
      s.eaten += 1;
      s.grow += 1;
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        s.fx.push({ x: nx * CELL + CELL / 2, y: ny * CELL + CELL / 2, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 1 });
      }
      sfx('coin');
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
    // jardim: gramado em xadrez suave com vinheta
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#3E8E41' : '#46994A';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,30,10,0.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // fruta com sombra e brilho pulsando
    if (s.fruit) {
      const fx = s.fruit.x * CELL + CELL / 2; const fy = s.fruit.y * CELL + CELL / 2;
      const pulse = 1 + Math.sin(s.t * 6) * 0.06;
      const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, CELL);
      glow.addColorStop(0, 'rgba(255,240,180,0.55)'); glow.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = glow; ctx.fillRect(fx - CELL, fy - CELL, CELL * 2, CELL * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(fx + 1, fy + CELL * 0.42, CELL * 0.35, CELL * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      drawFruit(ctx, s.fruitIcon, fx, fy, (CELL / 2 - 1) * pulse);
    }
    // corpo contínuo e liso, andando suave entre as casas
    const k = s.countdown > 0 ? 1 : Math.min(1, s.acc / stepMs(s));
    const pts = s.snake.map((p, i) => {
      const q = s.prev?.[i] || p;
      return [(q.x + (p.x - q.x) * k) * CELL + CELL / 2, (q.y + (p.y - q.y) * k) * CELL + CELL / 2];
    });
    const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = CELL * 0.86;
    ctx.save(); ctx.translate(1.5, 2.5); path(); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = '#1F6F8B'; ctx.lineWidth = CELL * 0.82; path(); ctx.stroke();
    ctx.strokeStyle = '#2FA4C7'; ctx.lineWidth = CELL * 0.62; path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = CELL * 0.18;
    ctx.save(); ctx.translate(-1.5, -2); path(); ctx.stroke(); ctx.restore();
    // pintas
    ctx.fillStyle = 'rgba(249,199,29,0.85)';
    pts.forEach(([x, y], i) => { if (i && i % 2 === 0) { ctx.beginPath(); ctx.arc(x, y, CELL * 0.12, 0, Math.PI * 2); ctx.fill(); } });
    // cabeça
    const [hx, hy] = pts[0];
    const [dx, dy] = VEC[s.dir];
    const ang = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    const hg = ctx.createRadialGradient(-2, -3, 1, 0, 0, CELL * 0.6);
    hg.addColorStop(0, '#5CC8E6'); hg.addColorStop(1, '#1F6F8B');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(1, 0, CELL * 0.56, CELL * 0.48, 0, 0, Math.PI * 2); ctx.fill();
    if (Math.sin(s.t * 9) > 0.55) { // língua
      ctx.strokeStyle = '#E5383B'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(CELL * 0.55, 0); ctx.lineTo(CELL * 0.85, 0); ctx.lineTo(CELL * 0.98, -3); ctx.moveTo(CELL * 0.85, 0); ctx.lineTo(CELL * 0.98, 3); ctx.stroke();
    }
    for (const sy of [-1, 1]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(CELL * 0.18, sy * CELL * 0.22, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#101831'; ctx.beginPath(); ctx.arc(CELL * 0.25, sy * CELL * 0.22, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // brilhos ao comer
    s.fx.forEach((f) => { ctx.globalAlpha = Math.max(0, f.life); ctx.fillStyle = '#FFE36E'; ctx.beginPath(); ctx.arc(f.x, f.y, 2.4, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
    if (s.countdown > 0) {
      ctx.fillStyle = 'rgba(8,16,40,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '800 76px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.ceil(s.countdown)), W / 2, H / 2);
    }
  };

  useRaf((dt) => {
    const s = st.current;
    if (ended.current) return;
    s.t += dt;
    s.fx.forEach((f) => { f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt * 2.2; });
    s.fx = s.fx.filter((f) => f.life > 0);
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
