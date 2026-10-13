// Voo do pássaro: toque para bater as asas e passe entre os canos.
import { useEffect, useRef, useState } from 'react';
import { COLORS, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 480;
const GROUND = 440;
const BIRD_X = 100;
const R = 13;
const PIPE_W = 58;
const GRAV = 1500;
const FLAP = -430;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'pointer' };

const newState = () => ({ started: false, y: H / 2 - 30, vy: 0, t: 0, pipes: [], nextPipe: 0, passed: 0, groundX: 0 });

const hit = (cx, cy, r, x, y, w, h) => {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
};

const gapSize = (n) => Math.max(118, 160 - n * 2.2);
const speed = (n) => Math.min(235, 150 + n * 3.5);
const spacing = (n) => Math.max(175, 215 - n * 2);

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(newState());
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  const flap = () => {
    const s = st.current;
    if (ended.current) return;
    if (!s.started) { s.started = true; s.nextPipe = 120; }
    s.vy = FLAP;
    sfx('jump');
  };

  useKeys((k, down) => { if (down && (k === 'action' || k === 'up')) flap(); });

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    setRunning(false);
    onEnd?.(st.current.passed);
  };

  const update = (dt) => {
    const s = st.current;
    s.t += dt;
    if (!s.started) {
      s.y = H / 2 - 30 + Math.sin(s.t * 4) * 8;
      s.groundX = (s.groundX + 120 * dt) % 24;
      return;
    }
    const v = speed(s.passed);
    s.groundX = (s.groundX + v * dt) % 24;
    s.vy = Math.min(s.vy + GRAV * dt, 700);
    s.y += s.vy * dt;
    if (s.y < R) { s.y = R; s.vy = Math.max(0, s.vy); }
    s.nextPipe -= v * dt;
    if (s.nextPipe <= 0) {
      const gap = gapSize(s.passed);
      const prev = s.pipes.length ? s.pipes[s.pipes.length - 1].top + gap / 2 : GROUND / 2;
      const span = Math.min(260, 140 + s.passed * 6);
      let mid = prev + (Math.random() * 2 - 1) * span / 2;
      mid = Math.max(60 + gap / 2, Math.min(GROUND - 50 - gap / 2, mid));
      s.pipes.push({ x: W + 10, top: mid - gap / 2, gap, scored: false });
      s.nextPipe = spacing(s.passed);
    }
    s.pipes.forEach((p) => { p.x -= v * dt; });
    s.pipes = s.pipes.filter((p) => p.x > -PIPE_W - 10);
    for (const p of s.pipes) {
      if (!p.scored && p.x + PIPE_W < BIRD_X - R) {
        p.scored = true;
        s.passed += 1;
        sfx('point');
        onScore?.(s.passed);
      }
      // círculo x retângulos (com uma pequena folga para ser justo)
      const rr = R - 2;
      if (hit(BIRD_X, s.y, rr, p.x - 2, -1000, PIPE_W + 4, p.top + 1000)
        || hit(BIRD_X, s.y, rr, p.x - 2, p.top + p.gap, PIPE_W + 4, 1000)) { sfx('hit'); return finish(); }
    }
    if (s.y + R >= GROUND) { s.y = GROUND - R; sfx('hit'); return finish(); }
    return undefined;
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#3A6FD0');
    sky.addColorStop(1, COLORS.sky);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND);
    // nuvens e morros ao fundo
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const cOff = (s.t * 12) % (W + 120);
    [[40, 80], [220, 130], [330, 60]].forEach(([x, y]) => {
      const cx = ((x - cOff + W + 120) % (W + 120)) - 60;
      ctx.beginPath();
      ctx.arc(cx, y, 16, 0, Math.PI * 2); ctx.arc(cx + 18, y - 6, 20, 0, Math.PI * 2); ctx.arc(cx + 38, y, 15, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#4FA36F';
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, GROUND - 40 - Math.sin(x / 50 + 1) * 18);
    ctx.lineTo(W, GROUND); ctx.fill();
    // canos
    s.pipes.forEach((p) => {
      const g = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      g.addColorStop(0, COLORS.green); g.addColorStop(0.4, COLORS.lime); g.addColorStop(1, COLORS.green);
      ctx.fillStyle = g;
      ctx.fillRect(p.x, 0, PIPE_W, p.top);
      ctx.fillRect(p.x, p.top + p.gap, PIPE_W, GROUND - p.top - p.gap);
      ctx.fillStyle = '#0F6A45';
      ctx.fillRect(p.x - 4, p.top - 18, PIPE_W + 8, 18);
      ctx.fillRect(p.x - 4, p.top + p.gap, PIPE_W + 8, 18);
    });
    // chão
    ctx.fillStyle = '#C9A15A';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(0, GROUND, W, 8);
    ctx.fillStyle = '#B08640';
    for (let x = -s.groundX; x < W; x += 24) ctx.fillRect(x, GROUND + 14, 12, 4);
    // pássaro
    const ang = s.started ? Math.max(-0.5, Math.min(1.2, s.vy / 600)) : 0;
    ctx.save();
    ctx.translate(BIRD_X, s.y);
    ctx.rotate(ang);
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath(); ctx.ellipse(0, 0, R + 2, R, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#E8A800';
    const wing = Math.sin(s.t * 22) * 5;
    ctx.beginPath(); ctx.ellipse(-4, 2 + wing * 0.4, 8, 5, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.beginPath(); ctx.arc(6, -4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath(); ctx.arc(7.5, -4, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.red;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(21, 3); ctx.lineTo(12, 6); ctx.fill();
    ctx.restore();
    // placar
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = COLORS.navy;
    ctx.fillStyle = COLORS.white;
    ctx.strokeText(String(s.passed), W / 2, 50);
    ctx.fillText(String(s.passed), W / 2, 50);
    if (!s.started) {
      ctx.font = 'bold 22px sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeText('Toque para voar', W / 2, H / 2 + 40);
      ctx.fillText('Toque para voar', W / 2, H / 2 + 40);
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
      aria-label="Voo do pássaro"
      onPointerDown={(e) => { e.preventDefault(); flap(); }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
