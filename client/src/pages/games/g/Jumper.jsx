// Pula-pula: o desbravador pula sozinho; incline para a esquerda/direita e suba o mais alto possível.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 500;
const GRAV = 1400;
const JUMP = 720; // altura máxima ≈ 185 px
const SPRING = 1180; // altura máxima ≈ 500 px
const PW = 28; // largura do jogador
const PLAT_H = 12;
const MAX_VX = 270;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'pointer' };

const rnd = (a, b) => a + Math.random() * (b - a);

function newState() {
  const s = {
    x: W / 2, y: 40, vy: JUMP, vx: 0, cam: 0, best: 0, score: 0, t: 0, dead: false, face: 1, squash: 0,
    plats: [{ x: W / 2 - 60, y: 30, w: 120, type: 'static', vx: 0, broken: false, spring: false, fall: 0 }],
    topY: 30,
    stars: Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * 2000, r: rnd(0.6, 1.8), p: rnd(0.15, 0.45) })),
  };
  fill(s);
  return s;
}

/** Cria plataformas até acima da tela. A distância entre plataformas firmes sempre dá para pular. */
function fill(s) {
  while (s.topY < s.cam + H + 120) {
    const h = s.topY;
    const lvl = Math.min(1, h / 12000);
    const gap = rnd(42 + lvl * 50, 72 + lvl * 78); // máx. 150 < 185
    const y = h + gap;
    const w = Math.round(rnd(68, 76) - lvl * 22);
    const moving = Math.random() < 0.08 + lvl * 0.4 && h > 600;
    const p = {
      x: rnd(0, W - w), y, w, type: moving ? 'move' : 'static',
      vx: moving ? (Math.random() < 0.5 ? -1 : 1) * rnd(50, 70 + lvl * 80) : 0,
      broken: false, spring: !moving && h > 300 && Math.random() < 0.07, fall: 0,
    };
    s.plats.push(p);
    // plataforma quebradiça extra (enfeite/armadilha) entre as firmes
    if (h > 400 && Math.random() < 0.18 + lvl * 0.3 && gap > 60) {
      const bw = 64;
      s.plats.push({ x: rnd(0, W - bw), y: h + gap * rnd(0.35, 0.65), w: bw, type: 'break', vx: 0, broken: false, spring: false, fall: 0 });
    }
    s.topY = y;
  }
}

const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const endTimer = useRef(null);
  const keys = useRef({ left: false, right: false });
  const touches = useRef(new Map());
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); return () => clearTimeout(endTimer.current); }, []);

  useKeys((k, down) => { if (k === 'left' || k === 'right') keys.current[k] = down; });

  const dir = () => {
    let d = 0;
    if (keys.current.left) d -= 1;
    if (keys.current.right) d += 1;
    touches.current.forEach((v) => { d += v; });
    return clamp(d, -1, 1);
  };

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    sfx('hit');
    const sc = st.current.score;
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(sc); }, 1100);
  };

  const update = (dt) => {
    const s = st.current;
    s.t += dt;
    s.squash = Math.max(0, s.squash - dt * 4);
    // plataformas móveis / quebradas
    s.plats.forEach((p) => {
      if (p.type === 'move') {
        p.x += p.vx * dt;
        if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
        if (p.x + p.w > W) { p.x = W - p.w; p.vx = -Math.abs(p.vx); }
      }
      if (p.broken) { p.fall += dt; p.y -= 400 * dt * p.fall * 3; }
    });
    if (s.dead) { s.vy -= GRAV * dt; s.y += s.vy * dt; return; }
    const d = ended.current ? 0 : dir();
    if (d) s.face = d;
    const target = d * MAX_VX;
    s.vx += clamp(target - s.vx, -1600 * dt, 1600 * dt);
    s.x = (s.x + s.vx * dt + W) % W;
    const prevY = s.y;
    s.vy -= GRAV * dt;
    s.y += s.vy * dt;
    if (s.vy < 0) {
      for (const p of s.plats) {
        if (p.broken) continue;
        const top = p.y + PLAT_H / 2;
        if (prevY >= top && s.y <= top && s.x + PW / 2 - 4 > p.x && s.x - PW / 2 + 4 < p.x + p.w) {
          if (p.type === 'break') { p.broken = true; sfx('pop'); continue; }
          s.y = top;
          s.squash = 1;
          const sc = p.x + p.w / 2;
          if (p.spring && Math.abs(s.x - sc) < 18) { s.vy = SPRING; p.sprung = 0.4; sfx('flip'); } else { s.vy = JUMP; sfx('jump'); }
          break;
        }
      }
    }
    s.plats.forEach((p) => { if (p.sprung) p.sprung = Math.max(0, p.sprung - dt); });
    if (s.y - s.cam > H * 0.45) s.cam = s.y - H * 0.45;
    if (s.y > s.best) {
      s.best = s.y;
      const sc = Math.floor(s.best / 10);
      if (sc !== s.score) { s.score = sc; onScore?.(sc); }
    }
    s.plats = s.plats.filter((p) => p.y > s.cam - 60);
    fill(s);
    if (s.y < s.cam - 40) { s.dead = true; finish(); }
  };

  const drawPlayer = (ctx, x, y) => {
    const s = st.current;
    const sq = s.squash * 0.25;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 + sq, 1 - sq);
    // corpo (uniforme)
    ctx.fillStyle = COLORS.navy;
    rrect(ctx, -11, -24, 22, 20, 7); ctx.fill();
    // pernas
    ctx.fillStyle = '#2A2F45';
    ctx.fillRect(-9, -6, 6, 6); ctx.fillRect(3, -6, 6, 6);
    // lenço vermelho
    ctx.fillStyle = COLORS.red;
    ctx.beginPath(); ctx.moveTo(-9, -24); ctx.lineTo(9, -24); ctx.lineTo(0, -13); ctx.fill();
    // cabeça
    ctx.fillStyle = '#F2C8A0';
    ctx.beginPath(); ctx.arc(0, -33, 10, 0, Math.PI * 2); ctx.fill();
    // chapéu
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(-13, -42, 26, 4);
    rrect(ctx, -8, -49, 16, 8, 3); ctx.fill();
    // olhos
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath(); ctx.arc(s.face * 3 - 3, -33, 1.6, 0, Math.PI * 2); ctx.arc(s.face * 3 + 3, -33, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const sy = (wy) => H - (wy - s.cam);
    const k = Math.min(1, s.cam / 15000);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, k > 0.5 ? '#050A1E' : COLORS.bg);
    g.addColorStop(1, '#1D3F8F');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // estrelas com paralaxe
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    s.stars.forEach((st2) => {
      const yy = ((st2.y + s.cam * st2.p) % 2000) - 2000 + H + 1000;
      const y = ((H - (st2.y - s.cam * st2.p)) % H + H) % H;
      if (yy || y) { ctx.beginPath(); ctx.arc(st2.x, y, st2.r, 0, Math.PI * 2); ctx.fill(); }
    });
    // plataformas
    s.plats.forEach((p) => {
      const y = sy(p.y) - PLAT_H / 2;
      if (y > H + 20 || y < -30) return;
      if (p.type === 'break') {
        ctx.globalAlpha = p.broken ? Math.max(0, 1 - p.fall * 2) : 1;
        ctx.fillStyle = '#9A6B3A';
        rrect(ctx, p.x, y, p.w, PLAT_H, 5); ctx.fill();
        ctx.strokeStyle = '#5E3B1A'; ctx.lineWidth = 2;
        ctx.beginPath();
        if (p.broken) { ctx.moveTo(p.x + p.w / 2, y); ctx.lineTo(p.x + p.w / 2, y + PLAT_H); } else {
          ctx.moveTo(p.x + p.w * 0.45, y); ctx.lineTo(p.x + p.w * 0.52, y + 6); ctx.lineTo(p.x + p.w * 0.47, y + PLAT_H);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      }
      ctx.fillStyle = p.type === 'move' ? COLORS.sky : COLORS.lime;
      rrect(ctx, p.x, y, p.w, PLAT_H, 6); ctx.fill();
      ctx.fillStyle = p.type === 'move' ? COLORS.blue : COLORS.green;
      rrect(ctx, p.x, y + PLAT_H - 4, p.w, 4, 2); ctx.fill();
      if (p.spring) {
        const cx = p.x + p.w / 2;
        const hgt = p.sprung ? 16 : 9;
        ctx.strokeStyle = '#C8CCD8'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) { const yy = y - (i / 4) * hgt; ctx.lineTo(cx + (i % 2 ? 6 : -6), yy); }
        ctx.stroke();
        ctx.fillStyle = COLORS.yellow;
        rrect(ctx, cx - 9, y - hgt - 4, 18, 4, 2); ctx.fill();
      }
    });
    // jogador (com reaparição nas bordas)
    const py = sy(s.y);
    drawPlayer(ctx, s.x, py);
    if (s.x < PW) drawPlayer(ctx, s.x + W, py);
    if (s.x > W - PW) drawPlayer(ctx, s.x - W, py);
    // placar
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 34px sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = COLORS.navy;
    ctx.fillStyle = COLORS.white;
    ctx.strokeText(String(s.score), W / 2, 34);
    ctx.fillText(String(s.score), W / 2, 34);
    if (s.t < 2.5 && !s.dead) {
      ctx.font = 'bold 16px sans-serif';
      ctx.globalAlpha = Math.min(1, 2.5 - s.t);
      ctx.lineWidth = 4;
      const msg = 'Toque nos lados para inclinar';
      ctx.strokeText(msg, W / 2, H - 60);
      ctx.fillText(msg, W / 2, H - 60);
      ctx.globalAlpha = 1;
    }
    if (s.dead) {
      ctx.fillStyle = 'rgba(11,20,48,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLORS.yellow;
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('Caiu!', W / 2, H / 2 - 16);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`Altura: ${s.score}`, W / 2, H / 2 + 20);
    }
  };

  useRaf((dt) => { update(dt); draw(); }, running);

  const press = (e) => {
    e.preventDefault();
    if (ended.current) return;
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    touches.current.set(e.pointerId, e.clientX - r.left < r.width / 2 ? -1 : 1);
    try { c.setPointerCapture(e.pointerId); } catch { /* ok */ }
  };
  const move = (e) => {
    if (!touches.current.has(e.pointerId)) return;
    const r = canvasRef.current.getBoundingClientRect();
    touches.current.set(e.pointerId, e.clientX - r.left < r.width / 2 ? -1 : 1);
  };
  const release = (e) => { touches.current.delete(e.pointerId); };

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Pula-pula"
      onPointerDown={press}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
