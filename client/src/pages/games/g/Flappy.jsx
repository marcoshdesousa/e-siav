// Voo da pomba (Noé): toque para bater as asas e passe entre as colunas de pedra, sobre as águas do dilúvio.
import { useEffect, useRef, useState } from 'react';
import { useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 480;
const GROUND = 440;
const BIRD_X = 100;
const R = 13;
const PIPE_W = 58;
const GRAV = 1500;
const FLAP = -430;

// ───────────── Desenho ─────────────

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}
function glass(ctx, x, y, w, h, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(14,26,60,0.42)'; rr(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke();
  ctx.restore();
}
function drawClouds(ctx, off, alpha, list) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const [x0, y, sc] of list) {
    const x = ((x0 - off) % (W + 160) + W + 160) % (W + 160) - 80;
    const g = ctx.createLinearGradient(0, y - 22 * sc, 0, y + 14 * sc);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#F3D9C8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, 34 * sc, 12 * sc, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 14 * sc, y - 8 * sc, 16 * sc, 13 * sc, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 10 * sc, y - 13 * sc, 20 * sc, 17 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawColumn(ctx, x, y, h, top) {
  if (h <= 0) return;
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  g.addColorStop(0, '#B9B2A6'); g.addColorStop(0.3, '#F5F1EA'); g.addColorStop(0.55, '#E4DED3'); g.addColorStop(1, '#9C9488');
  ctx.fillStyle = g;
  ctx.fillRect(x + 4, y, PIPE_W - 8, h);
  // caneluras
  ctx.strokeStyle = 'rgba(120,110,95,0.28)'; ctx.lineWidth = 1.5;
  for (let k = 1; k < 5; k++) { const fx = x + 4 + ((PIPE_W - 8) / 5) * k; ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(fx, y + h); ctx.stroke(); }
  // capitel na ponta (perto da abertura)
  const cy = top ? y + h - 16 : y;
  const cg = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  cg.addColorStop(0, '#A8A093'); cg.addColorStop(0.35, '#FFFDF8'); cg.addColorStop(1, '#8F877B');
  ctx.fillStyle = cg;
  rr(ctx, x - 5, cy, PIPE_W + 10, 16, 4); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x - 5, top ? cy : cy + 12, PIPE_W + 10, 4);
  ctx.fillStyle = 'rgba(212,175,55,0.85)';
  ctx.fillRect(x - 5, top ? cy + 13 : cy + 1, PIPE_W + 10, 2);
  ctx.restore();
}
function drawSea(ctx, s) {
  const layers = [[GROUND - 6, '#3C79C2', 0.5, 10], [GROUND + 6, '#2A5FA8', 0.8, 8], [GROUND + 20, '#173E78', 1.1, 7]];
  for (const [y0, c, sp, amp] of layers) {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y0 + Math.sin((x + s.groundX * 10 * sp + s.t * 40 * sp) / 26) * amp * 0.5);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, GROUND - 6 + Math.sin((x + s.groundX * 5 + s.t * 20) / 26) * 5);
  ctx.stroke();
}
function drawFeather(ctx, f) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, f.life);
  ctx.translate(f.x, f.y); ctx.rotate(f.a);
  ctx.fillStyle = '#F7F9FC';
  ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/** Pomba branca vista de lado, com o ramo de oliveira no bico. wing: 1 = acabou de bater a asa. */
function drawDove(ctx, x, y, ang, wing) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1.3, 1.3);
  ctx.shadowColor = 'rgba(20,30,60,0.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  // cauda em leque
  ctx.fillStyle = '#E6EBF3';
  for (const a of [-0.35, 0, 0.35]) {
    ctx.save(); ctx.translate(-12, 1); ctx.rotate(Math.PI + a);
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.quadraticCurveTo(10, -5, 14, 0); ctx.quadraticCurveTo(10, 5, 0, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // corpo
  const body = ctx.createLinearGradient(0, -10, 0, 10);
  body.addColorStop(0, '#FFFFFF'); body.addColorStop(1, '#DCE3EE');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.bezierCurveTo(-8, -10, 6, -11, 12, -6);
  ctx.bezierCurveTo(15, -2, 12, 8, 2, 9);
  ctx.bezierCurveTo(-6, 9, -12, 5, -14, 0);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // cabeça
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(12, -8, 6.5, 0, Math.PI * 2); ctx.fill();
  // olho com brilho
  ctx.fillStyle = '#1B1F2A'; ctx.beginPath(); ctx.arc(14.2, -9.2, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(14.7, -9.8, 0.6, 0, Math.PI * 2); ctx.fill();
  // bico
  ctx.fillStyle = '#F0A06A';
  ctx.beginPath(); ctx.moveTo(17.5, -8.5); ctx.quadraticCurveTo(22, -7.5, 23, -6.2); ctx.lineTo(17.5, -5.8); ctx.closePath(); ctx.fill();
  // ramo de oliveira
  ctx.strokeStyle = '#6B5A2E'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(20, -6.5); ctx.quadraticCurveTo(26, -3, 28, 4); ctx.stroke();
  for (const [lx, ly, a] of [[23, -5, -0.7], [25.5, -1.5, 0.6], [26.5, 2, -0.5], [28, 5.5, 0.4]]) {
    const lg = ctx.createLinearGradient(lx - 3, ly, lx + 3, ly);
    lg.addColorStop(0, '#4E8A2E'); lg.addColorStop(1, '#8CC152');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.ellipse(lx, ly, 3.6, 1.5, a, 0, Math.PI * 2); ctx.fill();
  }
  // asa (bate para baixo quando toca e volta devagar)
  // logo depois do toque a asa está no alto e desce batendo; parada, plana de leve
  const wa = -1.0 * wing + 0.25 * (1 - wing);
  ctx.save();
  ctx.translate(-1, -4); ctx.rotate(-wa);
  const wg = ctx.createLinearGradient(0, -14, 0, 4);
  wg.addColorStop(0, '#FFFFFF'); wg.addColorStop(1, '#C9D3E2');
  ctx.fillStyle = wg; ctx.strokeStyle = 'rgba(120,135,160,0.55)'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.bezierCurveTo(2, -10, -10, -16, -20, -14);
  ctx.lineTo(-17, -11); ctx.lineTo(-21, -9); ctx.lineTo(-17, -6.5); ctx.lineTo(-20, -4); ctx.lineTo(-15, -2.5);
  ctx.bezierCurveTo(-9, 1, -2, 3, 4, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(140,155,180,0.45)';
  for (const k of [-6, -10]) { ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(k, k * 0.6, k - 7, k * 0.55); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'pointer' };

const newState = () => ({ started: false, y: H / 2 - 30, vy: 0, t: 0, pipes: [], nextPipe: 0, passed: 0, groundX: 0, wing: 0, fx: [], pop: 0 });

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
    s.wing = 1; // batida de asa
    for (let i = 0; i < 2; i++) s.fx.push({ x: BIRD_X - 12, y: s.y + 4, vx: -40 - Math.random() * 60, vy: -20 + Math.random() * 60, a: Math.random() * 6, life: 1 });
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
    s.wing = Math.max(0, s.wing - dt * 3.2);
    s.pop = Math.max(0, s.pop - dt * 4);
    s.fx.forEach((f) => { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt; f.a += dt * 3; f.life -= dt * 0.9; });
    s.fx = s.fx.filter((f) => f.life > 0);
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
        s.pop = 1;
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
    // céu do entardecer com sol
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#1B3A7A'); sky.addColorStop(0.55, '#4F7FD0'); sky.addColorStop(1, '#F6C58F');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GROUND);
    const sun = ctx.createRadialGradient(W * 0.78, GROUND - 70, 4, W * 0.78, GROUND - 70, 120);
    sun.addColorStop(0, 'rgba(255,244,214,1)'); sun.addColorStop(0.18, 'rgba(255,220,150,0.9)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, GROUND);
    // nuvens em duas camadas (as de trás andam mais devagar)
    drawClouds(ctx, s.t * 8, 0.55, [[30, 70, 0.9], [200, 110, 1.2], [330, 50, 0.8]]);
    drawClouds(ctx, s.t * 18, 0.85, [[120, 170, 1.0], [300, 210, 1.3]]);
    // colunas de mármore
    s.pipes.forEach((p) => { drawColumn(ctx, p.x, 0, p.top, true); drawColumn(ctx, p.x, p.top + p.gap, GROUND - p.top - p.gap, false); });
    // águas do dilúvio: três camadas de ondas
    drawSea(ctx, s);
    // partículas (penas) e a pomba
    s.fx.forEach((f) => drawFeather(ctx, f));
    const ang = s.started ? Math.max(-0.45, Math.min(1.1, s.vy / 650)) : Math.sin(s.t * 3) * 0.05;
    drawDove(ctx, BIRD_X, s.y, ang, s.wing);
    // placar em pílula de vidro
    const txt = String(s.passed);
    ctx.font = '800 34px system-ui, sans-serif';
    const tw = Math.max(54, ctx.measureText(txt).width + 30);
    glass(ctx, W / 2 - tw / 2, 18, tw, 46, 23);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, W / 2, 42 + s.pop * -4);
    if (!s.started) {
      glass(ctx, W / 2 - 92, H / 2 + 18, 184, 44, 22);
      ctx.font = '700 18px system-ui, sans-serif'; ctx.fillStyle = '#fff';
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
