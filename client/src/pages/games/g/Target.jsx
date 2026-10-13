import { useRef, useState } from 'react';
import { COLORS, pointerPos, useCanvas, useRaf } from '../kit.js';
import { sfx } from '../audio.js';
import './Target.css';

const W = 360;
const H = 480;
const DUR = 30;
const TOP = 46; // faixa do placar

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [ref, getCtx] = useCanvas(W, H);
  const [active, setActive] = useState(true);
  const eng = useRef({ t: -3, targets: [], fx: [], score: 0, spawnT: 0, over: false, hits: 0 });

  const spawn = (e) => {
    const p = Math.min(1, Math.max(0, e.t) / DUR);
    const r0 = 48 - 22 * p;
    const life = 2.4 - 1.2 * p;
    let x = 0; let y = 0;
    for (let k = 0; k < 12; k++) {
      x = r0 + 6 + Math.random() * (W - 2 * r0 - 12);
      y = TOP + r0 + 6 + Math.random() * (H - TOP - 2 * r0 - 12);
      if (e.targets.every((t) => Math.hypot(t.x - x, t.y - y) > t.r0 + r0 + 6)) break;
    }
    e.targets.push({ x, y, r0, life, age: 0 });
  };

  const finish = (e) => {
    if (e.over) return;
    e.over = true;
    e.targets = [];
    cb.current.onEnd(Math.max(0, Math.round(e.score)));
  };

  const draw = (e) => {
    const ctx = getCtx();
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#16245a'); g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // grade sutil
    ctx.strokeStyle = 'rgba(127,178,255,.07)'; ctx.lineWidth = 1;
    for (let x = 30; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = TOP + 30; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    e.targets.forEach((t) => {
      const r = t.r0 * (1 - t.age / t.life);
      if (r <= 1) return;
      ctx.beginPath(); ctx.arc(t.x, t.y, r + 2, 0, Math.PI * 2); ctx.fillStyle = COLORS.navy; ctx.fill();
      ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fillStyle = COLORS.red; ctx.fill();
      ctx.beginPath(); ctx.arc(t.x, t.y, (r * 2) / 3, 0, Math.PI * 2); ctx.fillStyle = COLORS.white; ctx.fill();
      ctx.beginPath(); ctx.arc(t.x, t.y, r / 3, 0, Math.PI * 2); ctx.fillStyle = COLORS.yellow; ctx.fill();
      ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(1.5, r / 10), 0, Math.PI * 2); ctx.fillStyle = COLORS.red; ctx.fill();
    });

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    e.fx.forEach((f) => {
      ctx.globalAlpha = Math.max(0, 1 - f.age / 0.7);
      ctx.font = '800 22px Poppins, system-ui, sans-serif';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - f.age * 40);
    });
    ctx.globalAlpha = 1;

    // placar
    ctx.fillStyle = 'rgba(11,20,48,.85)'; ctx.fillRect(0, 0, W, TOP);
    const left = Math.max(0, DUR - Math.max(0, e.t));
    ctx.fillStyle = COLORS.yellow; ctx.fillRect(0, TOP - 4, (W * left) / DUR, 4);
    ctx.font = '700 18px Poppins, system-ui, sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = 'left'; ctx.fillText(`⏱ ${Math.ceil(left)}s`, 14, TOP / 2 - 1);
    ctx.textAlign = 'right'; ctx.fillText(`${e.score} pts`, W - 14, TOP / 2 - 1);

    ctx.textAlign = 'center';
    if (e.t < 0) {
      ctx.font = '800 72px Poppins, system-ui, sans-serif';
      ctx.fillStyle = COLORS.white;
      ctx.fillText(String(Math.ceil(-e.t)), W / 2, H / 2);
      ctx.font = '600 16px Poppins, system-ui, sans-serif';
      ctx.fillStyle = COLORS.sky;
      ctx.fillText('Acerte o centro: 10 · 5 · 2 pontos', W / 2, H / 2 + 60);
    } else if (e.over) {
      ctx.fillStyle = 'rgba(11,20,48,.6)'; ctx.fillRect(0, TOP, W, H - TOP);
      ctx.font = '800 48px Poppins, system-ui, sans-serif';
      ctx.fillStyle = COLORS.white;
      ctx.fillText('Tempo!', W / 2, H / 2 - 10);
      ctx.font = '600 18px Poppins, system-ui, sans-serif';
      ctx.fillStyle = COLORS.yellow;
      ctx.fillText(`${e.score} pontos`, W / 2, H / 2 + 34);
    }
  };

  useRaf((dt) => {
    const e = eng.current;
    e.t += dt;
    if (e.t >= 0 && !e.over) {
      const p = Math.min(1, e.t / DUR);
      e.targets.forEach((t) => { t.age += dt; });
      e.targets = e.targets.filter((t) => t.age < t.life);
      const maxN = Math.min(3, 1 + Math.floor(p * 3));
      e.spawnT -= dt;
      if (!e.targets.length || (e.targets.length < maxN && e.spawnT <= 0)) {
        spawn(e);
        e.spawnT = 0.45 - 0.25 * p;
      }
      if (e.t >= DUR) finish(e);
    }
    e.fx.forEach((f) => { f.age += dt; });
    e.fx = e.fx.filter((f) => f.age < 0.7);
    draw(e);
    if (e.over && !e.fx.length) setActive(false);
  }, active);

  const onDown = (ev) => {
    ev.preventDefault();
    const e = eng.current;
    if (e.t < 0 || e.over || !ref.current) return;
    const { x, y } = pointerPos(ev, ref.current, W, H);
    if (y < TOP) return;
    let best = -1; let frac = 2;
    e.targets.forEach((t, i) => {
      const r = t.r0 * (1 - t.age / t.life);
      const d = Math.hypot(t.x - x, t.y - y) / r;
      if (d <= 1 && d < frac) { frac = d; best = i; }
    });
    if (best >= 0) {
      const t = e.targets[best];
      const pts = frac < 1 / 3 ? 10 : frac < 2 / 3 ? 5 : 2;
      e.score += pts;
      sfx(pts === 10 ? 'coin' : 'pop');
      e.targets.splice(best, 1);
      e.fx.push({ x: t.x, y: t.y, text: '+' + pts, color: pts === 10 ? COLORS.yellow : pts === 5 ? COLORS.lime : COLORS.sky, age: 0 });
      cb.current.onScore(e.score);
    } else {
      e.fx.push({ x, y, text: '−1', color: COLORS.red, age: 0 });
      sfx('error');
      if (e.score > 0) { e.score -= 1; cb.current.onScore(e.score); }
    }
  };

  return (
    <div className="target">
      <canvas
        ref={ref}
        className="target-canvas"
        onPointerDown={onDown}
        onContextMenu={(ev) => ev.preventDefault()}
      />
    </div>
  );
}
