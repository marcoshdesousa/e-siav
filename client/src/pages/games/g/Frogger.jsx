// Atravesse a rua: pule entre os carros, use os troncos para cruzar o rio e chegue às 5 tocas.
import { useEffect, useRef, useState } from 'react';
import { COLORS, useCanvas, useKeys, useRaf, useSwipe } from '../kit.js';
import DPad from '../DPad.jsx';
import { sfx } from '../audio.js';
import { drawBurst, drawFrog, drawHearts } from '../art.jsx';

const CELL = 30;
const COLS = 12;
const ROWS = 13;
const TOP = 24;
const W = COLS * CELL;
const H = TOP + ROWS * CELL;
const M = 160; // margem fora da tela para os objetos darem a volta
const P = W + 2 * M;
const SLOTS = [36, 108, 180, 252, 324];
const START_ROW = 12;
const TRIP_TIME = 30;
const CAR_COLORS = [COLORS.red, COLORS.yellow, COLORS.sky, '#F2762E', COLORS.lime, '#C77DFF'];

// linha: tipo, velocidade (px/s, + direita), comprimento, deslocamentos iniciais
const LANES = {
  1: { kind: 'log', v: 42, len: 120, offs: [0, 210, 420] },
  2: { kind: 'log', v: -60, len: 75, offs: [0, 150, 300, 450] },
  3: { kind: 'log', v: 68, len: 150, offs: [0, 280] },
  4: { kind: 'log', v: -38, len: 90, offs: [0, 170, 340, 510] },
  5: { kind: 'log', v: 52, len: 105, offs: [0, 220, 440] },
  7: { kind: 'car', v: -48, len: 70, offs: [0, 300] },
  8: { kind: 'car', v: 88, len: 36, offs: [0, 220, 440] },
  9: { kind: 'car', v: -66, len: 38, offs: [0, 170, 360] },
  10: { kind: 'car', v: 58, len: 44, offs: [0, 230, 460] },
  11: { kind: 'car', v: -42, len: 36, offs: [0, 220, 440] },
};

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none' };
const mod = (a, b) => ((a % b) + b) % b;
const rowY = (r) => TOP + r * CELL;
const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };

function newState() {
  return {
    frog: { x: W / 2, row: START_ROW, hop: 0 }, best: START_ROW, lives: 3, score: 0, level: 1,
    homes: [false, false, false, false, false], shift: 0, time: TRIP_TIME, dying: 0, banner: 'Fase 1', bannerT: 1.2,
    colorSeed: Math.floor(Math.random() * 6), off: Object.fromEntries(Object.keys(LANES).map((k) => [k, Math.random() * P])),
  };
}

const speedMul = (s) => 1 + (s.level - 1) * 0.18;
// posições x dos objetos de uma linha agora
const objects = (s, row) => {
  const L = LANES[row];
  return L.offs.map((o) => mod(o + s.off[row], P) - M);
};

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
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(st.current.score); }, 1000);
  };

  const addScore = (v) => { const s = st.current; s.score += v; onScore?.(s.score); };

  const resetFrog = (s) => { s.frog = { x: W / 2, row: START_ROW, hop: 0 }; s.best = START_ROW; s.time = TRIP_TIME; };

  const die = () => {
    const s = st.current;
    if (s.dying > 0 || ended.current) return;
    sfx('hit');
    s.lives -= 1;
    s.dying = 0.9;
  };

  const hop = (d) => {
    const s = st.current;
    if (ended.current || s.dying > 0 || s.bannerT > 0) return;
    const f = s.frog;
    if (d === 'up') {
      if (f.row === 1) {
        // tenta entrar numa toca
        const i = SLOTS.findIndex((x, k) => !s.homes[k] && Math.abs(x - f.x) < 18);
        if (i < 0) { f.row = 0; die(); return; }
        s.homes[i] = true;
        addScore(10 + 100 + Math.floor(s.time) * 2);
        sfx('point');
        if (s.homes.every(Boolean)) {
          addScore(250 * s.level);
          sfx('win');
          s.level += 1;
          s.homes = s.homes.map(() => false);
          s.banner = `Fase ${s.level}`;
          s.bannerT = 1.4;
        }
        resetFrog(s);
        return;
      }
      f.row -= 1;
    } else if (d === 'down') {
      if (f.row >= START_ROW) return;
      f.row += 1;
    } else if (d === 'left') {
      if (f.x - CELL < 6) return;
      f.x -= CELL;
    } else if (d === 'right') {
      if (f.x + CELL > W - 6) return;
      f.x += CELL;
    } else return;
    f.hop = 0.12;
    sfx('move');
    if (f.row < s.best) { s.best = f.row; addScore(10); }
  };

  useKeys((k, down) => { if (down) hop(k === 'action' ? 'up' : k); });
  useSwipe(canvasRef, hop, () => hop('up'));

  const update = (dt) => {
    const s = st.current;
    s.shift += dt;
    Object.keys(LANES).forEach((k) => { s.off[k] += LANES[k].v * speedMul(s) * dt; });
    if (s.bannerT > 0) { s.bannerT -= dt; return; }
    if (ended.current) return;
    const f = s.frog;
    if (f.hop > 0) f.hop -= dt;
    if (s.dying > 0) {
      s.dying -= dt;
      if (s.dying <= 0) {
        if (s.lives <= 0) { s.dying = 0.001; finish(); return; }
        resetFrog(s);
      }
      return;
    }
    s.time -= dt;
    if (s.time <= 0) { s.time = 0; die(); return; }
    const L = LANES[f.row];
    if (!L) return;
    const xs = objects(s, f.row);
    if (L.kind === 'car') {
      if (xs.some((x) => f.x + 10 > x + 2 && f.x - 10 < x + L.len - 2)) die();
    } else {
      const on = xs.some((x) => f.x > x + 2 && f.x < x + L.len - 2);
      if (!on) { die(); return; }
      f.x += L.v * speedMul(s) * dt;
      if (f.x < 4 || f.x > W - 4) die();
    }
  };

  const drawCar = (ctx, x, y, len, right, color) => {
    ctx.fillStyle = color;
    rrect(ctx, x, y + 5, len, CELL - 10, 6); ctx.fill();
    ctx.fillStyle = 'rgba(11,20,48,0.7)';
    const wx = right ? x + len - 14 : x + 6;
    rrect(ctx, wx, y + 8, 8, CELL - 16, 2); ctx.fill();
    if (len > 50) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; rrect(ctx, right ? x + 4 : x + 18, y + 7, len - 24, CELL - 14, 3); ctx.fill(); }
    ctx.fillStyle = '#FFF5B0';
    const hx = right ? x + len - 2 : x;
    ctx.fillRect(hx, y + 7, 2, 4); ctx.fillRect(hx, y + CELL - 11, 2, 4);
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, TOP);
    // tocas
    ctx.fillStyle = '#156b45';
    ctx.fillRect(0, rowY(0), W, CELL);
    SLOTS.forEach((x, i) => {
      ctx.fillStyle = '#1d4f9c';
      ctx.fillRect(x - 18, rowY(0) + 4, 36, CELL - 4);
      if (s.homes[i]) {
        drawFrog(ctx, x, rowY(0) + CELL / 2 + 2, 24);
      }
    });
    // rio
    ctx.fillStyle = '#1d4f9c';
    ctx.fillRect(0, rowY(1), W, CELL * 5);
    ctx.strokeStyle = 'rgba(127,178,255,0.25)'; ctx.lineWidth = 1;
    for (let r = 1; r <= 5; r++) {
      for (let k = 0; k < 6; k++) {
        const wx = mod(k * 70 + s.shift * 12 * (r % 2 ? 1 : -1), W + 20) - 10;
        ctx.beginPath(); ctx.moveTo(wx, rowY(r) + 15); ctx.quadraticCurveTo(wx + 5, rowY(r) + 11, wx + 10, rowY(r) + 15); ctx.stroke();
      }
    }
    // canteiro, estrada e calçada
    ctx.fillStyle = '#5a3f8f'; ctx.fillRect(0, rowY(6), W, CELL);
    ctx.fillStyle = '#2b2f3a'; ctx.fillRect(0, rowY(7), W, CELL * 5);
    ctx.fillStyle = '#5a3f8f'; ctx.fillRect(0, rowY(12), W, CELL);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let r = 8; r <= 11; r++) for (let x = 6; x < W; x += 36) ctx.fillRect(x, rowY(r) - 1, 18, 2);
    // objetos
    Object.keys(LANES).forEach((key) => {
      const row = Number(key);
      const L = LANES[row];
      const y = rowY(row);
      objects(s, row).forEach((x, i) => {
        if (x > W || x + L.len < 0) return;
        if (L.kind === 'log') {
          ctx.fillStyle = '#8B5A2B';
          rrect(ctx, x, y + 4, L.len, CELL - 8, 10); ctx.fill();
          ctx.fillStyle = '#A9743F';
          ctx.fillRect(x + 8, y + 9, L.len - 16, 3);
          ctx.fillRect(x + 14, y + 17, L.len - 30, 2);
        } else {
          drawCar(ctx, x, y, L.len, L.v > 0, CAR_COLORS[(row + i + s.colorSeed) % CAR_COLORS.length]);
        }
      });
    });
    // sapo
    const f = s.frog;
    if (!ended.current || s.dying > 0) {
      const y = rowY(f.row) + CELL / 2 + 2;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (s.dying > 0) {
        drawBurst(ctx, f.x, y, 30, f.row >= 1 && f.row <= 5);
      } else {
        drawFrog(ctx, f.x, y, f.hop > 0 ? 30 : 26);
      }
    }
    // placar
    ctx.font = 'bold 14px sans-serif'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.white;
    ctx.fillText(`Fase ${s.level}`, 10, TOP / 2);
    drawHearts(ctx, Math.max(0, s.lives), W - 10, TOP / 2, 6, true);
    // barra de tempo
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(90, TOP / 2 - 4, 170, 8);
    ctx.fillStyle = s.time < 8 ? COLORS.red : COLORS.lime;
    ctx.fillRect(90, TOP / 2 - 4, 170 * (s.time / TRIP_TIME), 8);
    if (s.bannerT > 0 || ended.current) {
      ctx.fillStyle = 'rgba(11,20,48,0.55)'; ctx.fillRect(0, H / 2 - 30, W, 60);
      ctx.textAlign = 'center'; ctx.fillStyle = COLORS.yellow; ctx.font = 'bold 30px sans-serif';
      ctx.fillText(ended.current ? 'Fim de jogo' : s.banner, W / 2, H / 2);
    }
  };

  useRaf((dt) => { update(dt); draw(); }, running);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <canvas ref={canvasRef} style={canvasStyle} aria-label="Atravesse a rua" />
      <DPad onDir={(d, down) => { if (down) hop(d); }} />
    </div>
  );
}
