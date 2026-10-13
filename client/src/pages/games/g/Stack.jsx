// Empilhar: solte o bloco em cima da torre. O que sobrar para fora cai.
import { useRef } from 'react';
import { COLORS, useKeys, useRaf, useCanvas } from '../kit.js';
import './Stack.css';

const W = 300; const H = 440;
const BH = 22; const BASE_W = 160; const GROUND = H - 30;
const PALETTE = [COLORS.yellow, COLORS.red, COLORS.lime, COLORS.sky, '#F58A3A', '#A66BFF', COLORS.green, COLORS.white];
const colorOf = (i) => PALETTE[i % PALETTE.length];

function newState() {
  return {
    tower: [{ x: (W - BASE_W) / 2, w: BASE_W }],
    cur: { x: -BASE_W * 0.3, w: BASE_W, dir: 1 },
    debris: [], cam: 0, score: 0, combo: 0, msg: '', msgT: 0, over: false, endT: 0, ended: false, t: 0, flash: 0,
  };
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();

  const speedOf = (n) => Math.min(430, 130 + n * 9);

  const drop = () => {
    const s = st.current;
    if (s.over) return;
    const prev = s.tower[s.tower.length - 1];
    const c = s.cur;
    const level = s.tower.length;
    const left = Math.max(c.x, prev.x);
    const right = Math.min(c.x + c.w, prev.x + prev.w);
    const overlap = right - left;
    if (overlap <= 0) {
      s.debris.push({ x: c.x, w: c.w, level, vy: 0, dy: 0, rot: 0, vr: (c.x < prev.x ? -1 : 1) * 1.5, color: colorOf(level) });
      s.over = true;
      s.endT = 1.1;
      s.msg = 'Errou!'; s.msgT = 1.5;
      return;
    }
    let nb;
    if (Math.abs(c.x - prev.x) <= 3) {
      s.combo += 1;
      let w = prev.w;
      if (s.combo >= 3) w = Math.min(BASE_W, w + 6);
      nb = { x: prev.x - (w - prev.w) / 2, w };
      s.msg = s.combo >= 3 ? `Perfeito! x${s.combo}` : 'Perfeito!';
      s.msgT = 0.9;
      s.flash = 0.25;
    } else {
      s.combo = 0;
      nb = { x: left, w: overlap };
      const cutX = c.x < prev.x ? c.x : right;
      const cutW = c.w - overlap;
      if (cutW > 0.5) s.debris.push({ x: cutX, w: cutW, level, vy: 0, dy: 0, rot: 0, vr: (c.x < prev.x ? -1 : 1) * 2, color: colorOf(level) });
    }
    s.tower.push(nb);
    s.score += 1;
    cbs.current.onScore(s.score);
    const dir = s.tower.length % 2 ? 1 : -1;
    s.cur = { x: dir > 0 ? -nb.w * 0.3 : W - nb.w * 0.7, w: nb.w, dir };
  };

  useKeys((k, down) => { if (down && k === 'action') drop(); });

  const levelY = (i, cam) => GROUND - (i + 1) * BH + cam;

  const draw = () => {
    const ctx = getCtx();
    const s = st.current;
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const k = Math.min(1, s.tower.length / 60);
    g.addColorStop(0, k > 0.5 ? '#050A1C' : COLORS.bg);
    g.addColorStop(1, k > 0.5 ? COLORS.bg : COLORS.navy);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // estrelinhas que aparecem conforme sobe
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 24; i++) {
      const sx = (i * 97) % W; const sy = ((i * 53 + s.cam * 0.3) % H);
      ctx.fillRect(sx, sy, 2, 2);
    }
    // chão
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(0, GROUND + s.cam, W, H);

    const block = (x, y, w, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, BH);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, y + BH - 4, w, 4);
    };

    const first = Math.max(0, Math.floor((s.cam - 40) / BH) - 1);
    for (let i = first; i < s.tower.length; i++) {
      const y = levelY(i, s.cam);
      if (y > H) continue;
      const b = s.tower[i];
      block(b.x, y, b.w, i === 0 ? COLORS.blue : colorOf(i));
    }
    if (s.flash > 0) {
      const top = s.tower[s.tower.length - 1];
      ctx.strokeStyle = `rgba(255,255,255,${s.flash * 4})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(top.x - 3, levelY(s.tower.length - 1, s.cam) - 3, top.w + 6, BH + 6);
    }
    s.debris.forEach((d) => {
      const y = levelY(d.level, s.cam) + d.dy;
      ctx.save();
      ctx.translate(d.x + d.w / 2, y + BH / 2);
      ctx.rotate(d.rot);
      ctx.globalAlpha = 0.9;
      block(-d.w / 2, -BH / 2, d.w, d.color);
      ctx.restore();
    });
    if (!s.over) block(s.cur.x, levelY(s.tower.length, s.cam), s.cur.w, colorOf(s.tower.length));

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(String(s.score), W / 2, 56);
    if (s.msgT > 0) {
      ctx.globalAlpha = Math.min(1, s.msgT * 2);
      ctx.fillStyle = s.over ? COLORS.red : COLORS.yellow;
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(s.msg, W / 2, 90);
      ctx.globalAlpha = 1;
    }
    if (s.score === 0 && !s.over) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '14px sans-serif';
      ctx.fillText('Toque na tela ou aperte espaço', W / 2, 120);
    }
  };

  useRaf((dt) => {
    const s = st.current;
    if (s.ended) return;
    s.t += dt;
    if (!s.over) {
      const c = s.cur;
      c.x += c.dir * speedOf(s.score) * dt;
      const minX = -c.w * 0.45; const maxX = W - c.w * 0.55;
      if (c.x < minX) { c.x = minX; c.dir = 1; }
      if (c.x > maxX) { c.x = maxX; c.dir = -1; }
    } else {
      s.endT -= dt;
      if (s.endT <= 0) {
        s.ended = true;
        draw();
        cbs.current.onEnd(s.score);
        return;
      }
    }
    s.debris.forEach((d) => { d.vy += 900 * dt; d.dy += d.vy * dt; d.rot += d.vr * dt; });
    s.debris = s.debris.filter((d) => levelY(d.level, s.cam) + d.dy < H + 60);
    const target = Math.max(0, (s.tower.length + 1) * BH - H * 0.5);
    s.cam += (target - s.cam) * Math.min(1, dt * 6);
    if (s.msgT > 0) s.msgT -= dt;
    if (s.flash > 0) s.flash -= dt;
    draw();
  }, true);

  return (
    <div className="stack">
      <canvas
        ref={canvasRef}
        className="stack-canvas"
        onPointerDown={(e) => { e.preventDefault(); drop(); }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <p className="stack-hint">Toque na tela, clique ou aperte espaço para soltar o bloco.</p>
    </div>
  );
}
