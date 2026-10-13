// Corte as frutas: arraste o dedo (ou o mouse apertado) para cortar as frutas jogadas para cima.
// Bomba cortada termina o jogo; cada fruta que cai sem corte custa uma vida (3). Vários cortes num
// só movimento dão bônus de combo.
import { useEffect, useRef, useState } from 'react';
import { COLORS, pick, rand, useCanvas, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 500;
const R = 26;
const FRUITS = [
  { e: '🍉', c: '#E8414A' }, { e: '🍊', c: '#FF9A1F' }, { e: '🍎', c: '#E92A2F' }, { e: '🍐', c: '#B5D33A' },
  { e: '🍋', c: '#F9DC2E' }, { e: '🍑', c: '#FFA77A' }, { e: '🍍', c: '#F6C53B' }, { e: '🥝', c: '#7CC243' },
  { e: '🍇', c: '#8E4CC4' }, { e: '🥥', c: '#F2EEE6' },
];
const TRAIL_LIFE = 0.16;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'crosshair' };

function newState() {
  return {
    t: 0, items: [], queue: [], halves: [], drops: [], splats: [], trail: [], texts: [],
    nextWave: 0.8, score: 0, lives: 3, comboN: 0, comboT: 0, flash: 0, boom: null, missFlash: 0,
  };
}

// Distância do ponto (cx, cy) ao segmento a-b.
function segDist(ax, ay, bx, by, cx, cy) {
  const dx = bx - ax; const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let u = len2 ? ((cx - ax) * dx + (cy - ay) * dy) / len2 : 0;
  u = Math.max(0, Math.min(1, u));
  const px = ax + u * dx - cx; const py = ay + u * dy - cy;
  return Math.sqrt(px * px + py * py);
}

const timeScale = (score) => Math.min(1.45, 1 + score * 0.006);
const GRAV = 560;

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const endTimer = useRef(null);
  const ptr = useRef({ id: null, x: 0, y: 0 });
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);
  useEffect(() => () => clearTimeout(endTimer.current), []);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    ptr.current.id = null;
    const final = st.current.score;
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(final); }, 1200);
  };

  const resolveCombo = (s) => {
    if (s.comboN >= 3) {
      const bonus = s.comboN;
      s.score += bonus;
      s.texts.push({ x: W / 2, y: 120, text: `Combo x${s.comboN}! +${bonus}`, color: COLORS.yellow, life: 1.1 });
      sfx('coin');
      onScore?.(s.score);
    }
    s.comboN = 0;
    s.comboT = 0;
  };

  const launch = (s, bomb) => {
    const x = 50 + Math.random() * (W - 100);
    const h = 260 + Math.random() * 150;
    const vy = -Math.sqrt(2 * GRAV * h);
    const T = (2 * -vy) / GRAV;
    const target = 40 + Math.random() * (W - 80);
    const f = pick(FRUITS);
    s.items.push({
      x, y: H + R + 4, vx: (target - x) / T, vy, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 5,
      bomb, e: bomb ? '💣' : f.e, c: f.c, done: false,
    });
    sfx('jump');
  };

  const sliceAt = (ax, ay, bx, by) => {
    const s = st.current;
    if (ended.current) return;
    if (Math.hypot(bx - ax, by - ay) < 3) return;
    const ang = Math.atan2(by - ay, bx - ax);
    for (const it of s.items) {
      if (it.done) continue;
      if (segDist(ax, ay, bx, by, it.x, it.y) > R) continue;
      it.done = true;
      if (it.bomb) {
        s.boom = { x: it.x, y: it.y, t: 0 };
        s.flash = 1;
        sfx('hit');
        finish();
        return;
      }
      const nx = -Math.sin(ang); const ny = Math.cos(ang);
      [-1, 1].forEach((side) => {
        s.halves.push({ x: it.x, y: it.y, vx: it.vx * 0.5 + nx * side * 70, vy: Math.min(it.vy, 0) * 0.3 + ny * side * 70 - 40, rot: 0, a: ang, vr: side * 3, e: it.e, side, life: 2 });
      });
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2; const v = 40 + Math.random() * 160;
        s.drops.push({ x: it.x, y: it.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, c: it.c, life: 0.6 });
      }
      s.splats.push({ x: it.x, y: it.y, c: it.c, r: 18 + Math.random() * 14, life: 1.5 });
      s.score += 1;
      s.comboN += 1;
      s.comboT = 0;
      sfx('pop');
      onScore?.(s.score);
    }
  };

  const onDown = (e) => {
    e.preventDefault();
    if (ended.current || ptr.current.id != null) return;
    const c = canvasRef.current;
    try { c.setPointerCapture(e.pointerId); } catch { /* ok */ }
    const p = toLocal(e);
    ptr.current = { id: e.pointerId, x: p.x, y: p.y };
    st.current.trail = [{ x: p.x, y: p.y, t: st.current.t }];
  };
  const onMove = (e) => {
    const P = ptr.current;
    if (P.id !== e.pointerId) return;
    const p = toLocal(e);
    sliceAt(P.x, P.y, p.x, p.y);
    P.x = p.x; P.y = p.y;
    st.current.trail.push({ x: p.x, y: p.y, t: st.current.t });
  };
  const onUp = (e) => {
    if (ptr.current.id !== e.pointerId) return;
    ptr.current.id = null;
    if (!ended.current) resolveCombo(st.current);
  };
  const toLocal = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const update = (rawDt) => {
    const s = st.current;
    s.t += rawDt;
    s.trail = s.trail.filter((p) => s.t - p.t < TRAIL_LIFE);
    s.flash = Math.max(0, s.flash - rawDt * 1.5);
    s.missFlash = Math.max(0, s.missFlash - rawDt * 2.5);
    if (s.boom) s.boom.t += rawDt;
    s.texts.forEach((t) => { t.life -= rawDt; t.y -= 30 * rawDt; });
    s.texts = s.texts.filter((t) => t.life > 0);
    s.splats.forEach((p) => { p.life -= rawDt; });
    s.splats = s.splats.filter((p) => p.life > 0);
    const dt = rawDt * timeScale(s.score);
    s.drops.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += GRAV * dt; p.life -= rawDt; });
    s.drops = s.drops.filter((p) => p.life > 0);
    s.halves.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += GRAV * dt; p.rot += p.vr * dt; });
    s.halves = s.halves.filter((p) => p.y < H + 60);
    if (ended.current) return;
    if (s.comboN > 0) { s.comboT += rawDt; if (s.comboT > 0.3 && ptr.current.id == null) resolveCombo(s); }
    // ondas de frutas
    s.nextWave -= dt;
    if (s.nextWave <= 0 && s.queue.length === 0) {
      const n = 1 + rand(Math.min(5, 2 + Math.floor(s.score / 12)));
      const bombOk = s.score >= 5;
      const bombIdx = bombOk && Math.random() < 0.25 + Math.min(0.35, s.score * 0.004) ? rand(n + 1) : -1;
      const total = bombIdx >= 0 ? n + 1 : n;
      for (let i = 0; i < total; i++) s.queue.push({ delay: i * (0.12 + Math.random() * 0.2), bomb: i === bombIdx });
      s.nextWave = Math.max(1.1, 2.4 - s.score * 0.015);
    }
    if (s.queue.length) {
      s.queue.forEach((q) => { q.delay -= dt; });
      s.queue.filter((q) => q.delay <= 0).forEach((q) => launch(s, q.bomb));
      s.queue = s.queue.filter((q) => q.delay > 0);
    }
    for (const it of s.items) {
      it.x += it.vx * dt; it.y += it.vy * dt; it.vy += GRAV * dt; it.rot += it.vr * dt;
      if (!it.done && it.vy > 0 && it.y > H + R + 10) {
        it.done = true;
        if (!it.bomb) {
          s.lives -= 1;
          s.missFlash = 1;
          s.texts.push({ x: Math.max(30, Math.min(W - 30, it.x)), y: H - 30, text: '✖', color: COLORS.red, life: 0.8 });
          sfx('error');
          if (s.lives <= 0) { finish(); return; }
        }
      }
    }
    s.items = s.items.filter((it) => !it.done);
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const bg = ctx.createRadialGradient(W / 2, H * 0.4, 40, W / 2, H / 2, H * 0.75);
    bg.addColorStop(0, '#5A3A22'); bg.addColorStop(1, '#2A1A0E');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // tábuas de madeira
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let x = 60; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    s.splats.forEach((p) => {
      ctx.globalAlpha = Math.min(0.45, p.life * 0.4);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${R * 2}px sans-serif`;
    s.items.forEach((it) => {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      if (it.bomb) {
        ctx.shadowColor = COLORS.red; ctx.shadowBlur = 14;
      }
      ctx.fillText(it.e, 0, 2);
      ctx.restore();
    });
    s.halves.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot + p.a);
      ctx.beginPath();
      ctx.rect(-R - 6, p.side < 0 ? -R - 6 : 0, R * 2 + 12, R + 6);
      ctx.clip();
      ctx.rotate(-p.a); // metade cortada na direção do movimento do dedo
      ctx.fillText(p.e, 0, 2);
      ctx.restore();
    });
    s.drops.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 1.6);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // rastro do corte
    if (s.trail.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < s.trail.length; i++) {
        const a = s.trail[i - 1]; const b = s.trail[i];
        const k = 1 - (s.t - b.t) / TRAIL_LIFE;
        ctx.strokeStyle = `rgba(255,255,255,${0.35 + k * 0.6})`;
        ctx.lineWidth = 2 + k * 7;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    // explosão
    if (s.boom) {
      const r = 20 + s.boom.t * 420;
      const g = ctx.createRadialGradient(s.boom.x, s.boom.y, 0, s.boom.x, s.boom.y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, 'rgba(249,199,29,0.8)'); g.addColorStop(1, 'rgba(233,42,47,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.boom.x, s.boom.y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
    if (s.missFlash > 0) {
      ctx.strokeStyle = `rgba(233,42,47,${s.missFlash * 0.8})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, W, H);
    }
    s.texts.forEach((t) => {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = 'bold 24px sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = COLORS.ink;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;
    // placar e vidas
    ctx.textAlign = 'left';
    ctx.font = 'bold 30px sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = COLORS.ink;
    ctx.strokeText(String(s.score), 14, 30);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(String(s.score), 14, 30);
    ctx.textAlign = 'right';
    ctx.font = '22px sans-serif';
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < s.lives ? 1 : 0.25;
      ctx.fillText('❤️', W - 12 - i * 30, 28);
    }
    ctx.globalAlpha = 1;
    if (s.t < 2 && !ended.current) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = COLORS.white;
      ctx.fillText('Arraste para cortar!', W / 2, H / 2);
    }
    if (ended.current && s.t > 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = COLORS.ink;
      const msg = s.lives <= 0 ? 'Acabaram as vidas!' : 'Bomba!';
      ctx.strokeText(msg, W / 2, H / 2 - 10);
      ctx.fillStyle = COLORS.white;
      ctx.fillText(msg, W / 2, H / 2 - 10);
    }
  };

  useRaf((dt) => { update(dt); draw(); }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Corte as frutas"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
