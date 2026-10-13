// Basquete: arraste e solte para arremessar a bola em arco até a cesta. 60 segundos.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, useCanvas, useRaf, pointerPos } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 520;
const FLOOR = 486;
const BR = 13; // raio da bola
const RIM = 29; // meia largura do aro
const G = 980;
const TIME = 60;
const SUB = 5;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'grab' };

const rnd = (a, b) => a + Math.random() * (b - a);

function newBall(s) {
  const x = s.baskets < 2 ? 70 : rnd(45, 140);
  return { x, y: FLOOR - 70, vx: 0, vy: 0, live: false, touched: false, scored: false, t: 0, bounces: 0, spin: 0, ang: 0 };
}

function newState() {
  const s = {
    score: 0, reported: -1, baskets: 0, streak: 0, best: 0, time: TIME, level: 0,
    hoop: { bx: 280, y: 200, x: 280, phase: 0 }, net: 0, drag: null, texts: [], over: false, overT: 0, t: 0,
    flash: 0,
  };
  s.ball = newBall(s);
  return s;
}

function relocate(s) {
  const h = s.hoop;
  h.bx = rnd(235, 300);
  h.y = rnd(150, 255);
  h.phase = Math.random() * Math.PI * 2;
}

// Colisão da bola com um segmento (aro, tabela) com raio extra rad.
function collideSeg(b, ax, ay, bx, by, rad, e) {
  const dx = bx - ax; const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((b.x - ax) * dx + (b.y - ay) * dy) / len2, 0, 1);
  const px = ax + dx * t; const py = ay + dy * t;
  let nx = b.x - px; let ny = b.y - py;
  const d = Math.hypot(nx, ny);
  const min = BR + rad;
  if (d >= min || d === 0) return false;
  nx /= d; ny /= d;
  b.x = px + nx * min; b.y = py + ny * min;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx;
    b.vy -= (1 + e) * vn * ny;
    b.vx *= 0.92; b.vy *= 0.92;
    b.spin = -b.spin * 0.5 + b.vx * 0.01;
    return Math.abs(vn) > 60;
  }
  return false;
}

const launchVel = (d) => {
  let vx = (d.x - d.sx) * 4.6; let vy = (d.y - d.sy) * 4.6;
  const m = Math.hypot(vx, vy);
  if (m > 1150) { vx *= 1150 / m; vy *= 1150 / m; }
  return { vx, vy };
};

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  const addText = (s, text, x, y, color = COLORS.yellow) => s.texts.push({ text, x, y, color, t: 1.2 });

  const down = (e) => {
    const s = st.current;
    if (s.over || s.ball.live || s.time <= 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = pointerPos(e, canvasRef.current, W, H);
    s.drag = { sx: p.x, sy: p.y, x: p.x, y: p.y };
  };
  const move = (e) => {
    const s = st.current;
    if (!s.drag) return;
    const p = pointerPos(e, canvasRef.current, W, H);
    s.drag.x = p.x; s.drag.y = p.y;
  };
  const up = () => {
    const s = st.current;
    const d = s.drag;
    s.drag = null;
    if (!d || s.over || s.ball.live) return;
    const { vx, vy } = launchVel(d);
    if (Math.hypot(vx, vy) < 160 || vy > -60) return;
    const b = s.ball;
    b.vx = vx; b.vy = vy; b.live = true; b.spin = -vx * 0.02;
    sfx('jump');
  };

  const endShot = (s) => {
    if (!s.ball.scored) {
      if (s.streak > 0) addText(s, 'Errou!', s.ball.x < 30 ? 60 : clamp(s.ball.x, 40, W - 40), FLOOR - 40, COLORS.sky);
      s.streak = 0;
    }
    s.ball = newBall(s);
    if (s.time <= 0) s.over = true;
  };

  const scoreBasket = (s) => {
    const b = s.ball;
    b.scored = true;
    s.baskets += 1;
    s.streak += 1;
    s.best = Math.max(s.best, s.streak);
    const swish = !b.touched;
    let pts = swish ? 3 : 2;
    const bonus = s.streak >= 3 ? Math.min(3, s.streak - 2) : 0;
    pts += bonus;
    s.score += pts;
    s.net = 1;
    s.flash = 0.4;
    const hx = s.hoop.x;
    addText(s, (swish ? 'Cesta limpa! ' : 'Cesta! ') + '+' + pts, hx - 20, s.hoop.y - 40);
    if (bonus) addText(s, 'Sequência ' + s.streak + '! 🔥', hx - 20, s.hoop.y - 64, COLORS.red);
    sfx(swish ? 'coin' : 'point');
    const lvl = Math.floor(s.baskets / 3);
    if (lvl !== s.level) { s.level = lvl; relocate(s); }
  };

  const physics = (s, dt) => {
    const b = s.ball;
    const h = s.hoop;
    const amp = s.level >= 3 ? Math.min(45, 15 + (s.level - 3) * 8) : 0;
    const speed = 0.8 + Math.min(1.6, s.level * 0.15);
    h.phase += dt * speed;
    h.x = clamp(h.bx + Math.sin(h.phase) * amp, 200, 305);
    if (!b.live) return;
    b.t += dt;
    const sdt = dt / SUB;
    for (let i = 0; i < SUB; i++) {
      const py = b.y;
      b.vy += G * sdt;
      b.x += b.vx * sdt; b.y += b.vy * sdt;
      b.ang += b.spin * sdt * 10;
      const fx = h.x - RIM; const bkx = h.x + RIM;
      const boardX = h.x + RIM + 9;
      let hit = false;
      hit = collideSeg(b, fx, h.y, fx, h.y, 3, 0.55) || hit;
      hit = collideSeg(b, bkx, h.y, bkx, h.y, 3, 0.55) || hit;
      hit = collideSeg(b, bkx, h.y, boardX, h.y, 2, 0.4) || hit;
      const boardHit = collideSeg(b, boardX, h.y - 78, boardX, h.y + 14, 4, 0.6);
      if (hit || boardHit) {
        b.touched = true;
        if (b.t - (b.lastHit || 0) > 0.12) { sfx('tap'); b.lastHit = b.t; }
      }
      if (!b.scored && b.vy > 0 && py < h.y && b.y >= h.y && b.x > fx + 2 && b.x < bkx - 2) scoreBasket(s);
      if (b.y > FLOOR - BR) {
        b.y = FLOOR - BR;
        if (b.vy > 0) { b.vy *= -0.55; b.vx *= 0.8; b.bounces += 1; if (b.bounces < 3) sfx('move'); }
      }
      if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x > W + 40) { endShot(s); return; }
    }
    if (b.bounces >= 2 || b.t > 4.5 || (b.scored && b.y > h.y + 90)) endShot(s);
  };

  const draw = (s) => {
    const ctx = getCtx();
    if (!ctx) return;
    const h = s.hoop;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0B1430'); g.addColorStop(1, '#1B2E66');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // arquibancada / luzes
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 6; i++) ctx.fillRect(0, 70 + i * 26, W, 12);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgba(249,199,29,0.12)';
      ctx.beginPath(); ctx.arc(36 + i * 72, 40, 10, 0, Math.PI * 2); ctx.fill();
    }
    if (s.flash > 0) { ctx.fillStyle = `rgba(249,199,29,${s.flash * 0.25})`; ctx.fillRect(0, 0, W, H); }
    // piso de madeira
    ctx.fillStyle = '#B9773A'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.strokeStyle = '#94592A'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x - 12, H); ctx.stroke(); }
    ctx.fillStyle = COLORS.white; ctx.fillRect(0, FLOOR, W, 3);
    // poste + tabela
    const boardX = h.x + RIM + 9;
    ctx.fillStyle = '#6B7488';
    ctx.fillRect(boardX + 6, h.y - 50, 8, FLOOR - h.y + 50);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(boardX - 4, h.y - 82, 9, 100);
    ctx.fillStyle = COLORS.red; ctx.fillRect(boardX - 4, h.y - 40, 9, 34);
    // aro de trás
    ctx.strokeStyle = '#E8692A'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(h.x, h.y, RIM, 5, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h.x + RIM, h.y); ctx.lineTo(boardX, h.y); ctx.stroke();
    // bola
    const b = s.ball;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ang);
    ctx.fillStyle = '#F07A23';
    ctx.beginPath(); ctx.arc(0, 0, BR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5A2A0A'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-BR, 0); ctx.lineTo(BR, 0); ctx.moveTo(0, -BR); ctx.lineTo(0, BR); ctx.stroke();
    ctx.beginPath(); ctx.arc(-BR * 1.15, 0, BR * 0.8, -0.9, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(BR * 1.15, 0, BR * 0.8, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    ctx.restore();
    // rede
    const stretch = s.net > 0 ? Math.sin(s.net * Math.PI) * 14 : 0;
    const sway = s.net > 0 ? Math.sin(s.net * 20) * 3 * s.net : 0;
    const nb = h.y + 34 + stretch;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2;
    const N = 6;
    for (let i = 0; i <= N; i++) {
      const tx = h.x - RIM + (2 * RIM * i) / N;
      const bx = h.x - RIM * 0.55 + (1.1 * RIM * i) / N + sway;
      ctx.beginPath(); ctx.moveTo(tx, h.y); ctx.lineTo(bx, nb); ctx.stroke();
    }
    for (let k = 1; k <= 3; k++) {
      const f = k / 3.4; const yy = h.y + (nb - h.y) * f;
      const half = RIM - (RIM * 0.45) * f;
      ctx.beginPath(); ctx.moveTo(h.x - half + sway * f, yy); ctx.lineTo(h.x + half + sway * f, yy); ctx.stroke();
    }
    // aro da frente
    ctx.strokeStyle = '#FF7A2E'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(h.x, h.y, RIM, 5, 0, 0, Math.PI); ctx.stroke();
    // mira
    if (s.drag && !b.live) {
      const { vx, vy } = launchVel(s.drag);
      if (Math.hypot(vx, vy) > 160 && vy < -60) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 1; i <= 7; i++) {
          const t = i * 0.045;
          ctx.beginPath(); ctx.arc(b.x + vx * t, b.y + vy * t + 0.5 * G * t * t, 3.2 - i * 0.3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.strokeStyle = 'rgba(249,199,29,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(s.drag.sx, s.drag.sy); ctx.lineTo(s.drag.x, s.drag.y); ctx.stroke();
      ctx.setLineDash([]);
    } else if (!b.live && !s.over && s.baskets === 0 && s.time > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '600 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Arraste para cima e solte ↗', W / 2, FLOOR - 120);
    }
    // textos
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    s.texts.forEach((t) => {
      ctx.globalAlpha = clamp(t.t, 0, 1);
      ctx.fillStyle = t.color; ctx.font = 'bold 18px sans-serif';
      ctx.fillText(t.text, clamp(t.x, 80, W - 80), t.y - (1.2 - t.t) * 30);
    });
    ctx.globalAlpha = 1;
    // placar
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, 34);
    ctx.font = 'bold 16px sans-serif'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.white; ctx.fillText('Pontos: ' + s.score, 10, 17);
    ctx.textAlign = 'center'; ctx.fillStyle = s.time < 10 ? COLORS.red : COLORS.yellow;
    ctx.fillText('⏱ ' + Math.ceil(Math.max(0, s.time)), W / 2, 17);
    ctx.textAlign = 'right'; ctx.fillStyle = s.streak >= 3 ? COLORS.red : COLORS.sky;
    ctx.fillText((s.streak >= 3 ? '🔥 ' : '') + 'Seq. ' + s.streak, W - 10, 17);
    if (s.over) {
      ctx.fillStyle = 'rgba(11,20,48,0.7)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.fillStyle = COLORS.yellow; ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Fim de jogo!', W / 2, H / 2 - 30);
      ctx.fillStyle = COLORS.white; ctx.font = 'bold 20px sans-serif';
      ctx.fillText(s.score + ' pontos · ' + s.baskets + ' cestas', W / 2, H / 2 + 10);
    }
  };

  useRaf((dt) => {
    const s = st.current;
    s.t += dt;
    if (!s.over) {
      if (s.time > 0) {
        s.time -= dt;
        if (s.time <= 0) { s.time = 0; s.drag = null; sfx('error'); if (!s.ball.live) s.over = true; }
      }
      physics(s, dt);
    } else {
      s.overT += dt;
      if (s.overT > 1.1 && !ended.current) {
        ended.current = true;
        setRunning(false);
        onEnd?.(s.score);
      }
    }
    s.net = Math.max(0, s.net - dt * 1.6);
    s.flash = Math.max(0, s.flash - dt);
    s.texts.forEach((t) => { t.t -= dt; });
    s.texts = s.texts.filter((t) => t.t > 0);
    if (s.score !== s.reported) { s.reported = s.score; onScore?.(s.score); }
    draw(s);
  }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Basquete"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { st.current.drag = null; }}
    />
  );
}
