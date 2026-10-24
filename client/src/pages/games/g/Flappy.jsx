// Voo da pomba (Noé): toque para bater as asas e passe entre as colunas de pedra, sobre as águas do dilúvio.
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
    // monte Ararate e a arca ao longe
    ctx.fillStyle = '#6E7F95';
    ctx.beginPath(); ctx.moveTo(W * 0.45, GROUND - 30); ctx.lineTo(W * 0.72, GROUND - 120); ctx.lineTo(W, GROUND - 30); ctx.fill();
    ctx.fillStyle = '#E9EEF5';
    ctx.beginPath(); ctx.moveTo(W * 0.66, GROUND - 98); ctx.lineTo(W * 0.72, GROUND - 120); ctx.lineTo(W * 0.78, GROUND - 98); ctx.fill();
    ctx.fillStyle = '#7A4E25';
    ctx.beginPath(); ctx.moveTo(W * 0.62, GROUND - 34); ctx.lineTo(W * 0.84, GROUND - 34); ctx.lineTo(W * 0.8, GROUND - 22); ctx.lineTo(W * 0.66, GROUND - 22); ctx.fill();
    ctx.fillRect(W * 0.67, GROUND - 46, W * 0.12, 12);
    // colunas de pedra
    s.pipes.forEach((p) => {
      const g = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      g.addColorStop(0, '#9C8E78'); g.addColorStop(0.45, '#D8CCB4'); g.addColorStop(1, '#8A7C66');
      ctx.fillStyle = g;
      ctx.fillRect(p.x, 0, PIPE_W, p.top);
      ctx.fillRect(p.x, p.top + p.gap, PIPE_W, GROUND - p.top - p.gap);
      ctx.strokeStyle = 'rgba(80,66,48,.35)'; ctx.lineWidth = 2;
      for (let k = 1; k < 4; k++) { const fx = p.x + (PIPE_W / 4) * k; ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, p.top - 14); ctx.moveTo(fx, p.top + p.gap + 14); ctx.lineTo(fx, GROUND); ctx.stroke(); }
      ctx.fillStyle = '#7D6F5A';
      ctx.fillRect(p.x - 5, p.top - 16, PIPE_W + 10, 16);
      ctx.fillRect(p.x - 5, p.top + p.gap, PIPE_W + 10, 16);
    });
    // águas do dilúvio
    const sea = ctx.createLinearGradient(0, GROUND, 0, H);
    sea.addColorStop(0, '#2F6FB2'); sea.addColorStop(1, '#173E70');
    ctx.fillStyle = sea;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
    for (let x = -s.groundX; x < W + 24; x += 24) { ctx.beginPath(); ctx.moveTo(x, GROUND + 4); ctx.quadraticCurveTo(x + 6, GROUND - 2, x + 12, GROUND + 4); ctx.stroke(); }
    // pássaro
    const ang = s.started ? Math.max(-0.5, Math.min(1.2, s.vy / 600)) : 0;
    ctx.save();
    ctx.translate(BIRD_X, s.y);
    ctx.rotate(ang);
    // pomba branca com o ramo de oliveira
    ctx.fillStyle = '#E3E8F0';
    ctx.beginPath(); ctx.moveTo(-R - 1, -2); ctx.lineTo(-R - 9, -6); ctx.lineTo(-R - 9, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#F8FAFD'; ctx.strokeStyle = '#A9B4C6'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, R + 2, R - 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(R - 1, -R + 3, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const wing = Math.sin(s.t * 22) * 6;
    ctx.fillStyle = '#DCE2EC';
    ctx.beginPath(); ctx.ellipse(-3, -2 - wing, 10, 5, -0.5 - wing / 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath(); ctx.arc(R + 1, -R + 2, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#E7A33C';
    ctx.beginPath(); ctx.moveTo(R + 4, -R + 3); ctx.lineTo(R + 10, -R + 5); ctx.lineTo(R + 4, -R + 6); ctx.fill();
    ctx.strokeStyle = '#3F7D2C'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(R + 8, -R + 5); ctx.quadraticCurveTo(R + 14, -R + 8, R + 16, -R + 14); ctx.stroke();
    ctx.fillStyle = '#5FA03A';
    for (const [lx, ly, a] of [[R + 12, -R + 6, 0.8], [R + 15, -R + 10, -0.4], [R + 15, -R + 15, 0.9]]) { ctx.beginPath(); ctx.ellipse(lx, ly, 3.2, 1.6, a, 0, Math.PI * 2); ctx.fill(); }
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
      aria-label="Voo da pomba"
      onPointerDown={(e) => { e.preventDefault(); flap(); }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
