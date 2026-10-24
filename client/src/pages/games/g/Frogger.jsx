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

  // Carro visto de cima: carroceria com brilho, para-brisa, rodas e faróis acesos.
  const drawCar = (ctx, x, y, len, right, color) => {
    const top = y + 5; const h = CELL - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rrect(ctx, x + 2, top + 3, len, h, 7); ctx.fill();
    ctx.fillStyle = '#111';
    for (const wx of [x + 7, x + len - 13]) { ctx.fillRect(wx, top - 1.5, 7, 3); ctx.fillRect(wx, top + h - 1.5, 7, 3); }
    const g = ctx.createLinearGradient(0, top, 0, top + h);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = color; rrect(ctx, x, top, len, h, 7); ctx.fill();
    ctx.fillStyle = g; rrect(ctx, x, top, len, h, 7); ctx.fill();
    // vidros
    ctx.fillStyle = 'rgba(20,32,60,0.85)';
    const front = right ? x + len - 17 : x + 8;
    rrect(ctx, front, top + 3, 9, h - 6, 3); ctx.fill();
    if (len > 50) { ctx.fillStyle = 'rgba(235,240,248,0.92)'; rrect(ctx, right ? x + 5 : x + 20, top + 2.5, len - 26, h - 5, 3); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(20,32,60,0.6)'; rrect(ctx, right ? x + 5 : x + len - 12, top + 4, 7, h - 8, 2); ctx.fill(); }
    // faróis com luz
    const hx = right ? x + len : x;
    const beam = ctx.createRadialGradient(hx, top + h / 2, 1, hx, top + h / 2, 18);
    beam.addColorStop(0, 'rgba(255,245,180,0.55)'); beam.addColorStop(1, 'rgba(255,245,180,0)');
    ctx.fillStyle = beam; ctx.fillRect(hx - 18, top - 6, 36, h + 12);
    ctx.fillStyle = '#FFF5B0';
    ctx.fillRect(right ? hx - 2.5 : hx, top + 2, 2.5, 4); ctx.fillRect(right ? hx - 2.5 : hx, top + h - 6, 2.5, 4);
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const hud = ctx.createLinearGradient(0, 0, 0, TOP);
    hud.addColorStop(0, '#0B1430'); hud.addColorStop(1, '#16224A');
    ctx.fillStyle = hud;
    ctx.fillRect(0, 0, W, TOP);
    // margem com vitórias-régias (tocas)
    const bank = ctx.createLinearGradient(0, rowY(0), 0, rowY(1));
    bank.addColorStop(0, '#2E8B4A'); bank.addColorStop(1, '#1F6B37');
    ctx.fillStyle = bank;
    ctx.fillRect(0, rowY(0), W, CELL);
    // rio com brilho
    const river = ctx.createLinearGradient(0, rowY(1), 0, rowY(6));
    river.addColorStop(0, '#1E5FA8'); river.addColorStop(0.5, '#2A79C9'); river.addColorStop(1, '#1A4F91');
    ctx.fillStyle = river;
    ctx.fillRect(0, rowY(1), W, CELL * 5);
    SLOTS.forEach((x, i) => {
      ctx.fillStyle = '#2A79C9';
      ctx.fillRect(x - 18, rowY(0) + 4, 36, CELL - 4);
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath(); ctx.arc(x, rowY(0) + CELL / 2 + 2, 12, 0.35, Math.PI * 2 - 0.35); ctx.lineTo(x, rowY(0) + CELL / 2 + 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,60,20,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      if (s.homes[i]) drawFrog(ctx, x, rowY(0) + CELL / 2 + 2, 24);
    });
    ctx.strokeStyle = 'rgba(200,230,255,0.35)'; ctx.lineWidth = 1.2;
    for (let r = 1; r <= 5; r++) {
      for (let k = 0; k < 6; k++) {
        const wx = mod(k * 70 + s.shift * 12 * (r % 2 ? 1 : -1), W + 20) - 10;
        ctx.beginPath(); ctx.moveTo(wx, rowY(r) + 15); ctx.quadraticCurveTo(wx + 6, rowY(r) + 10, wx + 12, rowY(r) + 15); ctx.stroke();
      }
    }
    // calçadas, asfalto e faixas
    const walk = (row) => {
      ctx.fillStyle = '#B7B2A8'; ctx.fillRect(0, rowY(row), W, CELL);
      ctx.strokeStyle = 'rgba(80,76,70,0.35)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, rowY(row)); ctx.lineTo(x, rowY(row) + CELL); ctx.stroke(); }
      ctx.fillStyle = '#8E8A82'; ctx.fillRect(0, row === 6 ? rowY(row) + CELL - 3 : rowY(row), W, 3);
    };
    walk(6);
    const road = ctx.createLinearGradient(0, rowY(7), 0, rowY(12));
    road.addColorStop(0, '#2F333C'); road.addColorStop(1, '#23262E');
    ctx.fillStyle = road; ctx.fillRect(0, rowY(7), W, CELL * 5);
    walk(12);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let r = 8; r <= 11; r++) for (let x = 6; x < W; x += 36) ctx.fillRect(x, rowY(r) - 1, 18, 2);
    ctx.fillStyle = '#F9C71D'; ctx.fillRect(0, rowY(7) + 2, W, 1.5); ctx.fillRect(0, rowY(12) - 3.5, W, 1.5);
    // objetos
    Object.keys(LANES).forEach((key) => {
      const row = Number(key);
      const L = LANES[row];
      const y = rowY(row);
      objects(s, row).forEach((x, i) => {
        if (x > W || x + L.len < 0) return;
        if (L.kind === 'log') {
          ctx.fillStyle = 'rgba(0,30,60,0.35)';
          rrect(ctx, x + 2, y + 7, L.len, CELL - 8, 10); ctx.fill();
          const bark = ctx.createLinearGradient(0, y + 4, 0, y + CELL - 4);
          bark.addColorStop(0, '#B07842'); bark.addColorStop(0.5, '#8B5A2B'); bark.addColorStop(1, '#5E3A1C');
          ctx.fillStyle = bark;
          rrect(ctx, x, y + 4, L.len, CELL - 8, 10); ctx.fill();
          ctx.strokeStyle = 'rgba(60,35,15,0.5)'; ctx.lineWidth = 1;
          for (let k = x + 10; k < x + L.len - 8; k += 14) { ctx.beginPath(); ctx.moveTo(k, y + 9); ctx.lineTo(k + 8, y + 9); ctx.moveTo(k + 4, y + CELL - 10); ctx.lineTo(k + 12, y + CELL - 10); ctx.stroke(); }
          ctx.fillStyle = '#D6A66B';
          ctx.beginPath(); ctx.ellipse(x + L.len - 4, y + CELL / 2, 3.5, (CELL - 8) / 2 - 1, 0, 0, Math.PI * 2); ctx.fill();
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
