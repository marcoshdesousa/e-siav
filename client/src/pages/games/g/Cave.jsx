// Caverna: segure para subir e solte para descer. A caverna estreita e acelera; não bata em nada.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, rand, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 460;
const SEG = 12;
const PX = 90;
const R = 8;
const GRACE = 1.6;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'pointer' };

function nextColumn(s) {
  const g = s.gap;
  if (Math.abs(s.c - s.ct) < 2) {
    const lo = g / 2 + 14; const hi = H - g / 2 - 14;
    s.ct = lo + Math.random() * Math.max(1, hi - lo);
  }
  const slope = 2 + Math.min(3, s.dist / 3000);
  s.c += clamp(s.ct - s.c, -slope, slope);
  s.c = clamp(s.c, g / 2 + 10, H - g / 2 - 10);
  return { top: s.c - g / 2, bot: s.c + g / 2 };
}

function newState() {
  const s = {
    y: H / 2, vy: 0, hold: false, dist: 0, speed: 150, gap: 280, c: H / 2, ct: H / 2, cols: [], blocks: [], nextBlock: 500,
    shown: -1, crashed: 0, t: 0, trail: [], scrollRem: 0,
  };
  for (let i = 0; i <= Math.ceil(W / SEG) + 1; i++) s.cols.push({ top: H / 2 - 140, bot: H / 2 + 140 });
  return s;
}

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);
  const endTimer = useRef(null);

  useEffect(() => { onScore?.(0); return () => clearTimeout(endTimer.current); }, []);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(Math.floor(st.current.dist / 10)); }, 1100);
  };

  const setHold = (v) => { st.current.hold = v; };

  useKeys((k, down) => { if (k === 'action' || k === 'up') setHold(down); });

  // segurar no mouse/toque também fora do canvas até soltar
  useEffect(() => {
    const up = () => setHold(false);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
    };
  }, []);

  const colAt = (s, x) => {
    const i = Math.floor((x + s.scrollRem) / SEG);
    return s.cols[clamp(i, 0, s.cols.length - 1)];
  };

  const update = (dt) => {
    const s = st.current;
    s.t += dt;
    s.trail.forEach((p) => { p.x -= s.speed * dt * (s.crashed ? 0 : 1); p.life -= dt; });
    s.trail = s.trail.filter((p) => p.life > 0);
    if (s.crashed) { s.crashed += dt; return; }

    if (s.t < GRACE && !s.hold) {
      s.y += Math.sin(s.t * 5) * 0.4;
    } else {
      s.vy += (s.hold ? -980 : 820) * dt;
      s.vy = clamp(s.vy, -330, 380);
      s.y += s.vy * dt;
    }

    s.speed = Math.min(330, 150 + s.dist / 45);
    s.gap = Math.max(118, 280 - s.dist / 30);
    const dx = s.speed * dt;
    s.dist += dx;
    s.scrollRem += dx;
    while (s.scrollRem >= SEG) {
      s.scrollRem -= SEG;
      s.cols.shift();
      s.cols.push(nextColumn(s));
    }
    s.blocks.forEach((b) => { b.x -= dx; });
    s.blocks = s.blocks.filter((b) => b.x + b.w > -10);
    s.nextBlock -= dx;
    if (s.nextBlock <= 0) {
      const col = s.cols[s.cols.length - 1];
      const gap = col.bot - col.top;
      if (gap >= 160) {
        const h = Math.min(gap - 95, 50 + rand(40));
        // deixa pelo menos 95 px livres de um dos lados
        const free = gap - h;
        const above = Math.random() < 0.5 ? 95 + Math.random() * (free - 95) : Math.random() * (free - 95);
        const y = col.top + above;
        s.blocks.push({ x: W + 4, y, w: 22, h });
      }
      s.nextBlock = Math.max(220, 480 - s.dist / 60) + rand(160);
    }
    if (Math.floor(s.t * 30) % 2 === 0) s.trail.push({ x: PX - 12, y: s.y + 2, life: 0.5 });

    const sc = Math.floor(s.dist / 10);
    if (sc - s.shown >= 5) { s.shown = sc; onScore?.(sc); }

    // colisões
    let hit = s.y - R < 0 || s.y + R > H;
    for (let x = PX - R; x <= PX + R && !hit; x += 4) {
      const c = colAt(s, x);
      if (s.y - R + 2 < c.top || s.y + R - 2 > c.bot) hit = true;
    }
    if (!hit) hit = s.blocks.some((b) => PX + R > b.x && PX - R < b.x + b.w && s.y + R > b.y && s.y - R < b.y + b.h);
    if (hit) {
      s.crashed = 0.0001;
      onScore?.(sc);
      sfx('hit');
      finish();
    }
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    ctx.fillStyle = '#1a2347';
    ctx.fillRect(0, 0, W, H);
    // fundo com pedrinhas em paralaxe
    ctx.fillStyle = 'rgba(127,178,255,0.08)';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 97 - s.dist * 0.3) % (W + 40) + W + 40) % (W + 40) - 20;
      ctx.beginPath(); ctx.arc(x, (i * 71) % H, 6 + (i % 4) * 4, 0, Math.PI * 2); ctx.fill();
    }
    // paredes
    const off = -s.scrollRem;
    const wall = (getY, edge) => {
      ctx.beginPath();
      ctx.moveTo(off, edge);
      s.cols.forEach((c, i) => ctx.lineTo(off + i * SEG, getY(c)));
      ctx.lineTo(off + (s.cols.length - 1) * SEG, edge);
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = '#6b3f1f';
    wall((c) => c.top, 0); wall((c) => c.bot, H);
    ctx.fillStyle = '#8f5a2c';
    wall((c) => c.top - 8, 0); wall((c) => c.bot + 8, H);
    ctx.strokeStyle = COLORS.lime; ctx.lineWidth = 2;
    [(c) => c.top, (c) => c.bot].forEach((f) => {
      ctx.beginPath();
      s.cols.forEach((c, i) => { if (i) ctx.lineTo(off + i * SEG, f(c)); else ctx.moveTo(off, f(c)); });
      ctx.stroke();
    });
    // obstáculos
    s.blocks.forEach((b) => {
      ctx.fillStyle = '#8f5a2c';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 6); else ctx.rect(b.x, b.y, b.w, b.h); ctx.fill();
      ctx.strokeStyle = COLORS.yellow; ctx.lineWidth = 2; ctx.stroke();
    });
    // rastro
    s.trail.forEach((p) => {
      ctx.fillStyle = `rgba(249,199,29,${Math.max(0, p.life)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.life + 1, 0, Math.PI * 2); ctx.fill();
    });
    // nave
    if (!s.crashed) {
      ctx.save();
      ctx.translate(PX, s.y);
      ctx.rotate(clamp(s.vy / 900, -0.45, 0.45));
      ctx.fillStyle = COLORS.red;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -9); ctx.lineTo(-6, 0); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = COLORS.white;
      ctx.beginPath(); ctx.ellipse(1, 0, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.sky;
      ctx.beginPath(); ctx.arc(4, -1, 3, 0, Math.PI * 2); ctx.fill();
      if (s.hold) {
        ctx.fillStyle = COLORS.yellow;
        ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-16 - Math.random() * 6, 0); ctx.lineTo(-8, 3); ctx.fill();
      }
      ctx.restore();
    } else {
      ctx.font = `${28 + Math.min(1, s.crashed * 3) * 18}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💥', PX, s.y);
    }
    // placar
    ctx.fillStyle = 'rgba(11,20,48,0.7)';
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(W / 2 - 50, 8, 100, 26, 13); else ctx.rect(W / 2 - 50, 8, 100, 26); ctx.fill();
    ctx.fillStyle = COLORS.white; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.floor(s.dist / 10)} m`, W / 2, 22);
    if (s.t < GRACE && !s.hold && !s.crashed) {
      ctx.fillStyle = COLORS.yellow; ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Segure para subir!', W / 2, H - 40);
    }
    if (ended.current) {
      ctx.fillStyle = 'rgba(11,20,48,0.55)'; ctx.fillRect(0, H / 2 - 36, W, 72);
      ctx.fillStyle = COLORS.white; ctx.font = 'bold 28px sans-serif';
      ctx.fillText('Bateu!', W / 2, H / 2);
    }
  };

  useRaf((dt) => { update(dt); draw(); }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Caverna"
      onPointerDown={(e) => { e.preventDefault(); setHold(true); }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
