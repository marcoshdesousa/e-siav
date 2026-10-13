import { useRef, useState } from 'react';
import { COLORS, clamp, pointerPos, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';
import './Dodge.css';

const W = 360;
const H = 520;
const PR = 16; // raio do jogador
const PY = H - 44;
const SPEED = 330;

const SKY = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.4 + 0.4, v: 10 + Math.random() * 25 }));

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [ref, getCtx] = useCanvas(W, H);
  const [active, setActive] = useState(true);
  const eng = useRef({
    t: -3, x: W / 2, target: null, left: false, right: false, drag: null,
    rocks: [], stars: [], fx: [], rockT: 0.3, starT: 3, starPts: 0, score: 0, over: false, endT: 0,
  });

  useKeys((k, down) => {
    const e = eng.current;
    if (k === 'left') e.left = down;
    if (k === 'right') e.right = down;
    if (down && (k === 'left' || k === 'right')) e.target = null;
  });

  const draw = (e) => {
    const ctx = getCtx();
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COLORS.bg); g.addColorStop(1, '#1b2f73');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    SKY.forEach((s) => { ctx.fillRect(s.x, s.y, s.s, s.s); });
    // chão
    ctx.fillStyle = '#0c5338'; ctx.fillRect(0, H - 18, W, 18);
    ctx.fillStyle = COLORS.green; ctx.fillRect(0, H - 18, W, 4);

    e.stars.forEach((s) => {
      ctx.save();
      ctx.shadowColor = COLORS.yellow; ctx.shadowBlur = 12;
      starPath(ctx, s.x, s.y, 13);
      ctx.fillStyle = COLORS.yellow; ctx.fill();
      ctx.restore();
    });
    e.rocks.forEach((r) => {
      ctx.save();
      ctx.translate(r.x, r.y); ctx.rotate(r.a);
      ctx.beginPath();
      r.shape.forEach((k, i) => {
        const a = (i / r.shape.length) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r.r * k, Math.sin(a) * r.r * k);
      });
      ctx.closePath();
      ctx.fillStyle = '#7d6a58'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#4b3d31'; ctx.stroke();
      ctx.fillStyle = '#5e4f41';
      ctx.beginPath(); ctx.arc(r.r * 0.3, -r.r * 0.2, r.r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-r.r * 0.35, r.r * 0.3, r.r * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // jogador
    const hit = e.over;
    ctx.save();
    ctx.translate(e.x, PY);
    ctx.fillStyle = hit ? COLORS.red : COLORS.sky;
    ctx.strokeStyle = COLORS.navy; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, PR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COLORS.yellow; // lenço
    ctx.beginPath(); ctx.moveTo(-10, 8); ctx.lineTo(10, 8); ctx.lineTo(0, 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.beginPath(); ctx.arc(-5, -3, 4, 0, Math.PI * 2); ctx.arc(5, -3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath(); ctx.arc(-5, -4, 2, 0, Math.PI * 2); ctx.arc(5, -4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    e.fx.forEach((f) => {
      ctx.globalAlpha = Math.max(0, 1 - f.age / 0.8);
      ctx.font = '800 20px Poppins, system-ui, sans-serif';
      ctx.fillStyle = COLORS.yellow;
      ctx.fillText('+50', f.x, f.y - f.age * 40);
    });
    ctx.globalAlpha = 1;

    ctx.font = '700 18px Poppins, system-ui, sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = 'left'; ctx.fillText(`⏱ ${Math.max(0, Math.floor(e.t))}s`, 12, 20);
    ctx.textAlign = 'right'; ctx.fillText(`${e.score} pts`, W - 12, 20);
    ctx.textAlign = 'center';
    if (e.t < 0) {
      ctx.font = '800 72px Poppins, system-ui, sans-serif';
      ctx.fillText(String(Math.ceil(-e.t)), W / 2, H / 2 - 20);
      ctx.font = '600 15px Poppins, system-ui, sans-serif';
      ctx.fillStyle = COLORS.sky;
      ctx.fillText('Arraste ou use as setas ← →', W / 2, H / 2 + 36);
    } else if (e.over) {
      ctx.fillStyle = 'rgba(11,20,48,.55)'; ctx.fillRect(0, 0, W, H);
      ctx.font = '800 46px Poppins, system-ui, sans-serif';
      ctx.fillStyle = COLORS.white;
      ctx.fillText('Ai!', W / 2, H / 2 - 16);
      ctx.font = '600 18px Poppins, system-ui, sans-serif';
      ctx.fillStyle = COLORS.yellow;
      ctx.fillText(`${e.score} pontos`, W / 2, H / 2 + 26);
    }
  };

  useRaf((dt) => {
    const e = eng.current;
    SKY.forEach((s) => { s.y += s.v * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
    if (!e.over) {
      e.t += dt;
      const dir = (e.right ? 1 : 0) - (e.left ? 1 : 0);
      if (dir) e.x += dir * SPEED * dt;
      else if (e.target != null) e.x += (e.target - e.x) * Math.min(1, dt * 18);
      e.x = clamp(e.x, PR + 2, W - PR - 2);
    }
    if (e.t >= 0 && !e.over) {
      const t = e.t;
      e.rockT -= dt;
      if (e.rockT <= 0) {
        const r = 11 + Math.random() * (14 + Math.min(10, t / 4));
        e.rocks.push({
          x: r + Math.random() * (W - 2 * r), y: -r, r,
          vy: (150 + t * 9) * (0.8 + Math.random() * 0.45),
          vx: t > 15 ? (Math.random() - 0.5) * Math.min(90, t * 2) : 0,
          a: Math.random() * 6, va: (Math.random() - 0.5) * 4,
          shape: Array.from({ length: 9 }, () => 0.8 + Math.random() * 0.25),
        });
        e.rockT = Math.max(0.14, 0.8 - t * 0.022) * (0.6 + Math.random() * 0.8);
      }
      e.starT -= dt;
      if (e.starT <= 0) {
        e.stars.push({ x: 20 + Math.random() * (W - 40), y: -14, vy: 120 + t * 3 });
        e.starT = 2.5 + Math.random() * 2.5;
      }
      e.rocks.forEach((r) => {
        r.y += r.vy * dt; r.x += r.vx * dt; r.a += r.va * dt;
        if (r.x < r.r || r.x > W - r.r) r.vx = -r.vx;
      });
      e.rocks = e.rocks.filter((r) => r.y - r.r < H);
      e.stars.forEach((s) => { s.y += s.vy * dt; });
      e.stars = e.stars.filter((s) => {
        if (Math.hypot(s.x - e.x, s.y - PY) < PR + 13) {
          e.starPts += 50;
          sfx('coin');
          e.fx.push({ x: s.x, y: s.y, age: 0 });
          return false;
        }
        return s.y < H + 14;
      });
      const score = Math.floor(t) * 10 + e.starPts;
      if (score !== e.score) { e.score = score; cb.current.onScore(score); }
      if (e.rocks.some((r) => Math.hypot(r.x - e.x, r.y - PY) < r.r * 0.82 + PR * 0.8)) {
        e.over = true;
        sfx('hit');
        cb.current.onEnd(Math.max(0, e.score));
      }
    }
    e.fx.forEach((f) => { f.age += dt; });
    e.fx = e.fx.filter((f) => f.age < 0.8);
    draw(e);
    if (e.over) { e.endT += dt; if (e.endT > 0.9) setActive(false); }
  }, active);

  const pos = (ev) => pointerPos(ev, ref.current, W, H);
  const onDown = (ev) => {
    ev.preventDefault();
    const e = eng.current;
    if (e.over || !ref.current) return;
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* ignora */ }
    const p = pos(ev);
    if (ev.pointerType === 'mouse') { e.target = p.x; e.drag = null; }
    else e.drag = { off: (e.target ?? e.x) - p.x };
  };
  const onMove = (ev) => {
    const e = eng.current;
    if (e.over || !ref.current) return;
    const p = pos(ev);
    if (ev.pointerType === 'mouse') e.target = p.x;
    else if (e.drag) e.target = clamp(p.x + e.drag.off, PR, W - PR);
  };
  const onUp = () => { eng.current.drag = null; };

  return (
    <div className="dodge">
      <canvas
        ref={ref}
        className="dodge-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(ev) => ev.preventDefault()}
      />
    </div>
  );
}
