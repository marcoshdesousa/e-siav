// Pingue-pongue contra o computador. Você joga embaixo; o computador melhora a cada ponto seu.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, pointerPos, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 480;
const PW = 72;
const PH = 12;
const ME_Y = H - 36;
const CPU_Y = 24;
const R = 7;
const CPU_WIN = 5;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none' };

const newState = () => ({
  me: W / 2, cpu: W / 2, my: 0, their: 0,
  ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: 260 },
  wait: 1.2, serveDir: 1, err: 0, keys: { left: false, right: false }, flash: '', flashT: 0,
});

// Onde a bola vai cruzar a linha y (considerando as tabelas nas paredes).
function predictX(b, y) {
  if (b.vy === 0) return b.x;
  const t = (y - b.y) / b.vy;
  if (t < 0) return b.x;
  const span = W - 2 * R;
  let x = b.x - R + b.vx * t;
  x = ((x % (2 * span)) + 2 * span) % (2 * span);
  if (x > span) x = 2 * span - x;
  return x + R;
}

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(newState());
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  useKeys((k, down) => { if (k === 'left' || k === 'right') st.current.keys[k] = down; });

  const onPointer = (e) => {
    if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return;
    const c = canvasRef.current;
    if (!c) return;
    st.current.me = clamp(pointerPos(e, c, W, H).x, PW / 2, W - PW / 2);
  };

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    setRunning(false);
    onEnd?.(st.current.my);
  };

  const serve = () => {
    const s = st.current;
    const b = s.ball;
    b.x = W / 2; b.y = H / 2;
    b.speed = Math.min(380, 250 + s.my * 10);
    const a = (Math.random() * 0.8 - 0.4);
    b.vx = Math.sin(a) * b.speed;
    b.vy = Math.cos(a) * b.speed * s.serveDir;
    s.err = (Math.random() - 0.5) * 2 * errAmp(s);
  };

  const errAmp = (s) => Math.max(8, 60 - s.my * 5);
  const cpuSpeed = (s) => Math.min(430, 190 + s.my * 22);

  const bounce = (b, padX, dir) => {
    const rel = clamp((b.x - padX) / (PW / 2 + R), -1, 1);
    const a = rel * 1.0 + (Math.random() - 0.5) * 0.08;
    b.speed = Math.min(620, b.speed * 1.05);
    b.vx = Math.sin(a) * b.speed;
    b.vy = Math.cos(a) * b.speed * dir;
  };

  const point = (mine) => {
    const s = st.current;
    sfx(mine ? 'point' : 'error');
    if (mine) { s.my += 1; onScore?.(s.my); s.flash = 'Ponto seu!'; s.serveDir = -1; } else { s.their += 1; s.flash = 'Ponto do computador'; s.serveDir = 1; }
    s.flashT = 1.1;
    s.ball.vx = 0; s.ball.vy = 0;
    s.ball.x = W / 2; s.ball.y = H / 2;
    if (s.their >= CPU_WIN) { finish(); return; }
    s.wait = 1.1;
  };

  const step = (dt) => {
    const s = st.current;
    const b = s.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); }
    if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); }
    if (b.vy > 0 && b.y + R >= ME_Y && b.y + R <= ME_Y + PH + 10 && Math.abs(b.x - s.me) <= PW / 2 + R) {
      b.y = ME_Y - R;
      bounce(b, s.me, -1);
      sfx('tap');
      // quanto mais rápida a bola, mais o computador erra a previsão
      s.err = (Math.random() - 0.5) * 2 * errAmp(s) * (b.speed / 300);
    }
    if (b.vy < 0 && b.y - R <= CPU_Y + PH && b.y - R >= CPU_Y - 10 && Math.abs(b.x - s.cpu) <= PW / 2 + R) {
      b.y = CPU_Y + PH + R;
      bounce(b, s.cpu, 1);
      sfx('move');
    }
    if (b.y > H + R) point(false);
    else if (b.y < -R) point(true);
  };

  const update = (dt) => {
    const s = st.current;
    const kv = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0);
    if (kv) s.me = clamp(s.me + kv * 420 * dt, PW / 2, W - PW / 2);
    if (s.flashT > 0) s.flashT -= dt;
    // computador
    const b = s.ball;
    const target = b.vy < 0 ? predictX(b, CPU_Y + PH + R) + s.err : W / 2 + (b.x - W / 2) * 0.3;
    const d = target - s.cpu;
    const mv = cpuSpeed(s) * dt * (b.vy < 0 ? 1 : 0.5);
    s.cpu = clamp(s.cpu + clamp(d, -mv, mv), PW / 2, W - PW / 2);
    if (s.wait > 0) {
      s.wait -= dt;
      if (s.wait <= 0) serve();
      return;
    }
    const steps = Math.ceil((b.speed * dt) / 5);
    for (let i = 0; i < steps && !ended.current && s.wait <= 0; i++) step(dt / steps);
  };

  const paddle = (ctx, x, y, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - PW / 2, y, PW, PH, 6); else ctx.rect(x - PW / 2, y, PW, PH);
    ctx.fill();
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(6, H / 2); ctx.lineTo(W - 6, H / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillText(String(s.their), W - 20, H / 2 - 44);
    ctx.fillText(String(s.my), W - 20, H / 2 + 46);
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`COMPUTADOR (até ${CPU_WIN})`, 16, H / 2 - 16);
    ctx.fillText('VOCÊ', 16, H / 2 + 18);
    paddle(ctx, s.cpu, CPU_Y, COLORS.red);
    paddle(ctx, s.me, ME_Y, COLORS.yellow);
    ctx.fillStyle = COLORS.white;
    ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, R, 0, Math.PI * 2); ctx.fill();
    if (s.flashT > 0 && s.flash) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = COLORS.yellow;
      ctx.strokeStyle = COLORS.navy;
      ctx.lineWidth = 5;
      ctx.strokeText(s.flash, W / 2, H / 2 + 100);
      ctx.fillText(s.flash, W / 2, H / 2 + 100);
    }
  };

  useRaf((dt) => {
    if (ended.current) return;
    update(dt);
    draw();
  }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Pingue-pongue"
      onPointerDown={(e) => {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
        onPointer(e);
      }}
      onPointerMove={onPointer}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
