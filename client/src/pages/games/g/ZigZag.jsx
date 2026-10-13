// Zigue-zague: a bola corre pela trilha em diagonal; toque para trocar de direção. Pegue os
// diamantes e não caia da trilha. A bola acelera aos poucos. Pontos = passos + diamantes.
import { useEffect, useRef, useState } from 'react';
import { COLORS, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 500;
const TW = 64;
const TH = 32;
const DEPTH = 18;
const BALL_R = 8;
const AHEAD = 45;
const THEMES = [
  ['#3F6FD8', '#24479A', '#183372'],
  ['#2FA36E', '#1B7A50', '#125A3A'],
  ['#E0533E', '#B23A28', '#85291B'],
  ['#8E5CD6', '#6A3EAA', '#4C2B7E'],
  ['#D9A21F', '#A87B12', '#7C5A0B'],
];

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'pointer' };
const key = (i, j) => i * 100000 + j;

function extend(s) {
  while (s.path.length < s.maxIdx + AHEAD) {
    const drift = s.gi - s.gj;
    let L;
    if (s.gdir === 'x') L = drift > 3 ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 5);
    else L = drift < -3 ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 5);
    for (let k = 0; k < L; k++) {
      if (s.gdir === 'x') s.gi += 1; else s.gj += 1;
      const idx = s.path.length;
      const t = { i: s.gi, j: s.gj, idx, gem: idx > 8 && Math.random() < 0.12, fall: 0 };
      s.path.push(t);
      s.map.set(key(t.i, t.j), t);
    }
    s.gdir = s.gdir === 'x' ? 'y' : 'x';
  }
}

function newState() {
  const s = {
    path: [], map: new Map(), gi: 0, gj: 0, gdir: 'x', bx: 0, by: 0, dir: 'x',
    maxIdx: 0, steps: 0, gems: 0, falling: false, fallZ: 0, fallV: 0, camX: 0, camY: 0, t: 0, popups: [],
  };
  // trilha inicial reta para dar tempo de começar
  for (let k = 0; k <= 5; k++) {
    const t = { i: k, j: 0, idx: k, gem: false, fall: 0 };
    s.path.push(t); s.map.set(key(k, 0), t);
  }
  s.gi = 5; s.gj = 0; s.gdir = 'y';
  extend(s);
  return s;
}

const proj = (i, j) => ({ x: (i - j) * (TW / 2), y: -(i + j) * (TH / 2) });
const speedOf = (steps) => Math.min(6, 2.6 + steps * 0.018);

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const endTimer = useRef(null);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);
  useEffect(() => () => clearTimeout(endTimer.current), []);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    const final = st.current.steps + st.current.gems;
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(final); }, 1100);
  };

  const turn = () => {
    const s = st.current;
    if (ended.current || s.falling) return;
    s.dir = s.dir === 'x' ? 'y' : 'x';
    sfx('tap');
  };

  useKeys((k, down) => { if (down) turn(); });

  const update = (dt) => {
    const s = st.current;
    s.t += dt;
    s.popups.forEach((p) => { p.t -= dt; });
    s.popups = s.popups.filter((p) => p.t > 0);
    const v = speedOf(s.steps);
    if (s.falling) {
      const fv = Math.max(0, v * (1 - s.fallZ / 60));
      if (s.dir === 'x') s.bx += fv * dt; else s.by += fv * dt;
      s.fallV += 900 * dt;
      s.fallZ += s.fallV * dt;
    } else {
      if (s.dir === 'x') s.bx += v * dt; else s.by += v * dt;
      const tile = s.map.get(key(Math.round(s.bx), Math.round(s.by)));
      if (!tile) {
        s.falling = true;
        sfx('hit');
        finish();
      } else {
        let changed = false;
        if (tile.idx > s.maxIdx) {
          s.steps += tile.idx - s.maxIdx;
          s.maxIdx = tile.idx;
          changed = true;
          extend(s);
        }
        if (tile.gem) {
          tile.gem = false;
          s.gems += 1;
          changed = true;
          s.popups.push({ i: tile.i, j: tile.j, t: 0.7 });
          sfx('coin');
        }
        if (changed) onScore?.(s.steps + s.gems);
      }
    }
    // a trilha que ficou para trás desmorona
    for (const t of s.path) {
      if (t.idx < s.maxIdx - 4) t.fall += dt * (60 + t.fall * 6);
      else break;
    }
    while (s.path.length && s.path[0].fall > 500) {
      const t = s.path.shift();
      s.map.delete(key(t.i, t.j));
    }
    const p = proj(s.bx, s.by);
    const k = Math.min(1, dt * 4);
    s.camX += (p.x - s.camX) * k;
    s.camY += (p.y - s.camY) * Math.min(1, dt * 8);
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0B1430'); bg.addColorStop(1, '#1D2F66');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const ox = W / 2 - s.camX;
    const oy = H * 0.64 - s.camY;
    const theme = THEMES[Math.floor(s.maxIdx / 60) % THEMES.length];
    const drawBall = () => {
      const p = proj(s.bx, s.by);
      const x = ox + p.x; const y = oy + p.y - BALL_R + s.fallZ;
      if (!s.falling) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(x, y + BALL_R - 1, BALL_R, BALL_R / 2, 0, 0, Math.PI * 2); ctx.fill();
      }
      const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, BALL_R);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, COLORS.yellow);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, Math.PI * 2); ctx.fill();
    };
    const ballDepth = s.bx + s.by;
    let ballDrawn = false;
    // de trás (maior i + j) para a frente
    for (let n = s.path.length - 1; n >= 0; n--) {
      const t = s.path[n];
      if (s.falling && !ballDrawn && t.i + t.j < ballDepth - 0.5) { drawBall(); ballDrawn = true; }
      const p = proj(t.i, t.j);
      const x = ox + p.x; const y = oy + p.y + t.fall;
      if (y < -TH * 2 || y > H + TH) continue;
      ctx.globalAlpha = Math.max(0, 1 - t.fall / 400);
      ctx.fillStyle = theme[1];
      ctx.beginPath();
      ctx.moveTo(x - TW / 2, y); ctx.lineTo(x, y + TH / 2); ctx.lineTo(x, y + TH / 2 + DEPTH); ctx.lineTo(x - TW / 2, y + DEPTH);
      ctx.fill();
      ctx.fillStyle = theme[2];
      ctx.beginPath();
      ctx.moveTo(x + TW / 2, y); ctx.lineTo(x, y + TH / 2); ctx.lineTo(x, y + TH / 2 + DEPTH); ctx.lineTo(x + TW / 2, y + DEPTH);
      ctx.fill();
      ctx.fillStyle = theme[0];
      ctx.beginPath();
      ctx.moveTo(x, y - TH / 2); ctx.lineTo(x + TW / 2, y); ctx.lineTo(x, y + TH / 2); ctx.lineTo(x - TW / 2, y);
      ctx.fill();
      if (t.gem) {
        const by = y - 12 + Math.sin(s.t * 4 + t.idx) * 3;
        ctx.fillStyle = COLORS.sky;
        ctx.beginPath();
        ctx.moveTo(x, by - 9); ctx.lineTo(x + 7, by - 2); ctx.lineTo(x, by + 8); ctx.lineTo(x - 7, by - 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.moveTo(x, by - 9); ctx.lineTo(x + 7, by - 2); ctx.lineTo(x, by - 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (!ballDrawn) drawBall();
    s.popups.forEach((pp) => {
      const p = proj(pp.i, pp.j);
      ctx.globalAlpha = Math.min(1, pp.t * 2);
      ctx.fillStyle = COLORS.sky;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+1', ox + p.x, oy + p.y - 30 - (0.7 - pp.t) * 40);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(String(s.steps + s.gems), W / 2, 44);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = COLORS.sky;
    ctx.fillText(`◆ ${s.gems}`, W / 2, 76);
    if (s.maxIdx < 3 && !ended.current) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = COLORS.white;
      ctx.fillText('Toque para virar', W / 2, H - 40);
    }
    if (ended.current) {
      ctx.fillStyle = 'rgba(11,20,48,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLORS.yellow;
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Caiu da trilha!', W / 2, H / 2 - 16);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${s.steps} passos + ${s.gems} diamantes`, W / 2, H / 2 + 18);
    }
  };

  useRaf((dt) => { update(dt); draw(); }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Zigue-zague"
      onPointerDown={(e) => { e.preventDefault(); turn(); }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
