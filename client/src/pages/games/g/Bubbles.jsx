// Bolhas: mire e atire para juntar 3 ou mais da mesma cor. Grupos soltos do teto caem.
// A cada poucas jogadas desce uma fileira nova; se as bolhas passarem da linha, acabou.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, pointerPos, rand, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 500;
const R = 18;
const ROW_H = R * Math.sqrt(3);
const TOP = 4;
const SX = W / 2;
const SY = H - 42;
const LINE_Y = H - 92;
const SPEED = 820;
const BALL = ['#E92A2F', '#F9C71D', '#2F7BFF', '#3CC46E', '#A66CE0'];
const LIGHT = ['#FFB3B3', '#FFF2B0', '#CFE0FF', '#B9F5CF', '#E8CCFF'];
const NEXT_X = SX - 70;
const NEXT_Y = SY + 8;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'crosshair' };

const shifted = (s, r) => (r + s.parity) % 2 === 1;
const colsOf = (s, r) => (shifted(s, r) ? 9 : 10);
const cx = (s, r, c) => R + c * 2 * R + (shifted(s, r) ? R : 0);
const cy = (s, r) => TOP + R + r * ROW_H + s.slide;

function randomRow(s, r, nColors) {
  return Array.from({ length: colsOf(s, r) }, () => rand(nColors));
}

function neighbors(s, r, c) {
  const out = [[r, c - 1], [r, c + 1]];
  const d = shifted(s, r) ? [0, 1] : [-1, 0];
  [r - 1, r + 1].forEach((rr) => d.forEach((dc) => out.push([rr, c + dc])));
  return out.filter(([rr, cc]) => rr >= 0 && rr < s.grid.length && cc >= 0 && cc < colsOf(s, rr));
}

function colorsLeft(s) {
  const set = new Set();
  s.grid.forEach((row) => row.forEach((v) => { if (v != null) set.add(v); }));
  return [...set];
}

function pickColor(s) {
  const left = colorsLeft(s);
  return left.length ? left[rand(left.length)] : rand(s.nColors);
}

function newState() {
  const s = { grid: [], parity: 0, slide: 0, nColors: 4, shots: 0, rowsAdded: 0, score: 0, angle: -Math.PI / 2, shot: null, fx: [], over: false, aiming: false, popups: [], held: null };
  for (let r = 0; r < 5; r++) s.grid.push(randomRow(s, r, s.nColors));
  s.cur = pickColor(s);
  s.next = pickColor(s);
  return s;
}

const shotsPerRow = (s) => Math.max(3, 7 - Math.floor(s.rowsAdded / 3));

function addRow(s) {
  s.parity = (s.parity + 1) % 2;
  s.rowsAdded += 1;
  if (s.rowsAdded % 4 === 0 && s.nColors < BALL.length) s.nColors += 1;
  const row = Array.from({ length: shifted(s, 0) ? 9 : 10 }, () => rand(s.nColors));
  s.grid.unshift(row);
  s.slide = -ROW_H;
}

function trimRows(s) {
  while (s.grid.length && s.grid[s.grid.length - 1].every((v) => v == null)) s.grid.pop();
}

/** Trajetória com tabelas nas paredes até bater numa bolha ou no teto. */
function trace(s, angle, maxLen = 1400) {
  let x = SX; let y = SY;
  let vx = Math.cos(angle); let vy = Math.sin(angle);
  const pts = [[x, y]];
  const stepLen = 4;
  for (let d = 0; d < maxLen; d += stepLen) {
    x += vx * stepLen; y += vy * stepLen;
    if (x < R) { x = 2 * R - x; vx = -vx; pts.push([x, y]); }
    if (x > W - R) { x = 2 * (W - R) - x; vx = -vx; pts.push([x, y]); }
    if (y <= TOP + R + s.slide) { pts.push([x, y]); return { pts, x, y, hit: true }; }
    if (hitsAny(s, x, y)) { pts.push([x, y]); return { pts, x, y, hit: true }; }
  }
  pts.push([x, y]);
  return { pts, x, y, hit: false };
}

function hitsAny(s, x, y) {
  const r0 = Math.max(0, Math.floor((y - TOP - s.slide) / ROW_H) - 1);
  for (let r = r0; r < Math.min(s.grid.length, r0 + 3); r++) {
    const row = s.grid[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] == null) continue;
      const dx = cx(s, r, c) - x; const dy = cy(s, r) - y;
      if (dx * dx + dy * dy < (2 * R * 0.86) ** 2) return true;
    }
  }
  return false;
}

/** Casa vazia mais próxima de (x, y) que esteja presa ao teto ou a outra bolha. */
function snap(s, x, y) {
  const approx = Math.max(0, Math.round((y - TOP - R - s.slide) / ROW_H));
  return snapIn(s, x, y, Math.max(0, approx - 1), approx + 1) || snapIn(s, x, y, 0, Math.max(approx + 1, s.grid.length));
}

function snapIn(s, x, y, from, to) {
  let best = null; let bd = Infinity;
  for (let r = from; r <= to; r++) {
    while (s.grid.length <= r) s.grid.push(Array(colsOf(s, s.grid.length)).fill(null));
    for (let c = 0; c < colsOf(s, r); c++) {
      if (s.grid[r][c] != null) continue;
      const attached = r === 0 || neighbors(s, r, c).some(([rr, cc]) => s.grid[rr][cc] != null);
      if (!attached) continue;
      const dx = cx(s, r, c) - x; const dy = cy(s, r) - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = [r, c]; }
    }
  }
  return best;
}

function group(s, r, c) {
  const col = s.grid[r][c];
  const seen = new Set([r + ',' + c]);
  const st = [[r, c]];
  const out = [];
  while (st.length) {
    const [a, b] = st.pop();
    out.push([a, b]);
    neighbors(s, a, b).forEach(([rr, cc]) => {
      const k = rr + ',' + cc;
      if (!seen.has(k) && s.grid[rr][cc] === col) { seen.add(k); st.push([rr, cc]); }
    });
  }
  return out;
}

function floating(s) {
  const seen = new Set();
  const st = [];
  if (s.grid.length) s.grid[0].forEach((v, c) => { if (v != null) { seen.add('0,' + c); st.push([0, c]); } });
  while (st.length) {
    const [a, b] = st.pop();
    neighbors(s, a, b).forEach(([rr, cc]) => {
      const k = rr + ',' + cc;
      if (!seen.has(k) && s.grid[rr][cc] != null) { seen.add(k); st.push([rr, cc]); }
    });
  }
  const out = [];
  s.grid.forEach((row, r) => row.forEach((v, c) => { if (v != null && !seen.has(r + ',' + c)) out.push([r, c]); }));
  return out;
}

function drawBall(ctx, x, y, color, rad = R - 1, alpha = 1) {
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
  g.addColorStop(0, LIGHT[color]);
  g.addColorStop(0.55, BALL[color]);
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = BALL[color];
  ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(x - rad * 0.35, y - rad * 0.38, rad * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);
  const timers = useRef([]);

  useEffect(() => {
    cbs.current.onScore(0);
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const gameOver = () => {
    const s = st.current;
    if (ended.current) return;
    ended.current = true;
    s.over = true;
    s.shot = null;
    sfx('lose');
    timers.current.push(setTimeout(() => { setRunning(false); cbs.current.onEnd(st.current.score); }, 1300));
  };

  const setAim = (x, y) => {
    const s = st.current;
    const a = Math.atan2(y - SY, x - SX);
    // só para cima, com um mínimo de inclinação
    s.angle = clamp(a > Math.PI / 2 ? -Math.PI + 0.18 : a > 0 ? -0.18 : a, -Math.PI + 0.18, -0.18);
  };

  const shoot = () => {
    const s = st.current;
    if (s.over || s.shot) return;
    s.shot = { x: SX, y: SY, vx: Math.cos(s.angle) * SPEED, vy: Math.sin(s.angle) * SPEED, color: s.cur };
    s.cur = s.next;
    s.next = pickColor(s);
    sfx('shoot');
  };

  const swapNext = () => {
    const s = st.current;
    if (s.over) return;
    [s.cur, s.next] = [s.next, s.cur];
    sfx('flip');
  };

  const land = (x, y, color) => {
    const s = st.current;
    const cell = snap(s, x, y);
    if (!cell) return;
    const [r, c] = cell;
    s.grid[r][c] = color;
    const g = group(s, r, c);
    let gained = 0;
    if (g.length >= 3) {
      g.forEach(([a, b]) => { s.fx.push({ kind: 'pop', x: cx(s, a, b), y: cy(s, a), color: s.grid[a][b], t: 0 }); s.grid[a][b] = null; });
      gained += g.length * 10;
      const fl = floating(s);
      fl.forEach(([a, b]) => { s.fx.push({ kind: 'fall', x: cx(s, a, b), y: cy(s, a), vx: (Math.random() - 0.5) * 80, vy: -60 - Math.random() * 80, color: s.grid[a][b], t: 0 }); s.grid[a][b] = null; });
      gained += fl.length * 20;
      sfx(fl.length ? 'coin' : 'pop');
      s.popups.push({ text: '+' + gained, x: cx(s, r, c), y: cy(s, r), t: 0 });
    } else {
      sfx('tap');
    }
    trimRows(s);
    s.shots += 1;
    if (!s.grid.length) {
      gained += 500;
      s.popups.push({ text: 'Quadro limpo! +500', x: W / 2, y: H / 2 - 60, t: 0 });
      sfx('win');
      for (let k = 0; k < 4; k++) addRow(s);
      s.shots = 0;
    } else if (s.shots >= shotsPerRow(s)) {
      s.shots = 0;
      addRow(s);
    }
    if (gained) { s.score += gained; cbs.current.onScore(s.score); }
    if (!colorsLeft(s).includes(s.cur)) s.cur = pickColor(s);
    if (!colorsLeft(s).includes(s.next)) s.next = pickColor(s);
  };

  const tooLow = (s) => s.grid.some((row, r) => row.some((v) => v != null) && TOP + R + r * ROW_H + R > LINE_Y);

  const onDown = (e) => {
    const s = st.current;
    if (s.over) return;
    const p = pointerPos(e, canvasRef.current, W, H);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (Math.hypot(p.x - NEXT_X, p.y - NEXT_Y) < 26) { swapNext(); return; }
    s.aiming = true;
    setAim(p.x, p.y);
  };
  const onMove = (e) => {
    const s = st.current;
    if (s.over) return;
    if (!s.aiming && e.pointerType !== 'mouse') return;
    const p = pointerPos(e, canvasRef.current, W, H);
    setAim(p.x, p.y);
  };
  const onUp = (e) => {
    const s = st.current;
    if (!s.aiming) return;
    s.aiming = false;
    const p = pointerPos(e, canvasRef.current, W, H);
    // soltar lá embaixo, perto do canhão, cancela o tiro
    if (p.y > SY + 10) return;
    setAim(p.x, p.y);
    shoot();
  };

  useKeys((k, down) => {
    const s = st.current;
    if (k === 'left' || k === 'right') { if (down) s.held = k; else if (s.held === k) s.held = null; }
    if (down && k === 'action') shoot();
    if (down && (k === 'down' || k === 'up')) swapNext();
  });

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0E2A6B'); bg.addColorStop(1, COLORS.bg);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // linha limite
    ctx.strokeStyle = 'rgba(233,42,47,0.6)';
    ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, LINE_Y); ctx.lineTo(W, LINE_Y); ctx.stroke();
    ctx.setLineDash([]);
    // grade
    s.grid.forEach((row, r) => row.forEach((v, c) => { if (v != null) drawBall(ctx, cx(s, r, c), cy(s, r), v); }));
    // guia pontilhada
    if (!s.over) {
      const tr = trace(s, s.angle, 700);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      let acc = 0;
      for (let i = 1; i < tr.pts.length; i++) {
        const [x0, y0] = tr.pts[i - 1]; const [x1, y1] = tr.pts[i];
        const len = Math.hypot(x1 - x0, y1 - y0);
        for (let d = (14 - acc) % 14; d < len; d += 14) {
          const t = d / len;
          ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 2.4, 0, Math.PI * 2); ctx.fill();
        }
        acc = (acc + len) % 14;
      }
    }
    // efeitos
    s.fx.forEach((f) => {
      if (f.kind === 'pop') drawBall(ctx, f.x, f.y, f.color, (R - 1) * (1 + f.t * 2), Math.max(0, 1 - f.t * 5));
      else drawBall(ctx, f.x, f.y, f.color, R - 1, 0.9);
    });
    // tiro
    if (s.shot) drawBall(ctx, s.shot.x, s.shot.y, s.shot.color);
    // canhão
    ctx.save();
    ctx.translate(SX, SY);
    ctx.rotate(s.angle);
    ctx.fillStyle = '#C9D3EA';
    ctx.fillRect(0, -7, 34, 14);
    ctx.restore();
    ctx.fillStyle = '#1A2A57';
    ctx.beginPath(); ctx.arc(SX, SY, R + 6, 0, Math.PI * 2); ctx.fill();
    if (!s.shot) drawBall(ctx, SX, SY, s.cur);
    drawBall(ctx, NEXT_X, NEXT_Y, s.next, R * 0.75);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('trocar', NEXT_X, NEXT_Y + R + 4);
    // contador de tiros até a próxima fileira
    const left = shotsPerRow(s) - s.shots;
    ctx.textAlign = 'right';
    ctx.font = '13px sans-serif';
    ctx.fillText('Nova fileira em', W - 12, SY - 4);
    for (let i = 0; i < shotsPerRow(s); i++) {
      ctx.fillStyle = i < left ? COLORS.yellow : 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.arc(W - 16 - i * 12, SY + 14, 4, 0, Math.PI * 2); ctx.fill();
    }
    // placar
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(String(s.score), 12, SY + 14);
    ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('pontos', 12, SY - 4);
    // textos que sobem
    s.popups.forEach((p) => {
      ctx.globalAlpha = Math.max(0, 1 - p.t);
      ctx.fillStyle = COLORS.yellow; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.text, clamp(p.x, 70, W - 70), p.y - p.t * 40);
      ctx.globalAlpha = 1;
    });
    if (s.over) {
      ctx.fillStyle = 'rgba(11,20,48,0.65)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('As bolhas desceram!', W / 2, H / 2 - 10);
      ctx.fillStyle = COLORS.lime; ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${s.score} pontos`, W / 2, H / 2 + 24);
    }
  };

  useRaf((dt) => {
    const s = st.current;
    if (s.held && !s.over) s.angle = clamp(s.angle + (s.held === 'left' ? -1 : 1) * dt * 1.6, -Math.PI + 0.18, -0.18);
    if (s.slide < 0) s.slide = Math.min(0, s.slide + dt * 140);
    if (s.shot && !s.over) {
      const sh = s.shot;
      const sub = 6;
      for (let i = 0; i < sub && s.shot; i++) {
        sh.x += (sh.vx * dt) / sub; sh.y += (sh.vy * dt) / sub;
        if (sh.x < R) { sh.x = 2 * R - sh.x; sh.vx = -sh.vx; }
        if (sh.x > W - R) { sh.x = 2 * (W - R) - sh.x; sh.vx = -sh.vx; }
        if (sh.y <= TOP + R + s.slide || hitsAny(s, sh.x, sh.y)) {
          s.shot = null;
          land(sh.x, sh.y, sh.color);
          if (tooLow(s)) gameOver();
        }
      }
    }
    s.fx = s.fx.filter((f) => {
      f.t += dt;
      if (f.kind === 'fall') { f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; return f.y < H + R; }
      return f.t < 0.2;
    });
    s.popups = s.popups.filter((p) => { p.t += dt; return p.t < 1; });
    draw();
  }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Bolhas"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => { st.current.aiming = false; }}
    />
  );
}
