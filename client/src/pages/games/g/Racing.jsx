// Corrida: troque de faixa para desviar dos carros e pegue as moedas. A estrada acelera sempre.
import { useEffect, useRef, useState } from 'react';
import { COLORS, pointerPos, rand, useCanvas, useKeys, useRaf, useSwipe } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 480;
const ROAD_X = 45;
const LANE_W = 90;
const LANES = [0, 1, 2].map((i) => ROAD_X + LANE_W / 2 + i * LANE_W);
const CAR_W = 40;
const CAR_H = 66;
const PLAYER_Y = H - 100;
const CAR_COLORS = [COLORS.yellow, COLORS.sky, COLORS.lime, '#F2762E', '#C77DFF', COLORS.white];
const TREES = ['🌲', '🌳', '🌲', '🌴', '🌼'];

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'pointer' };
const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };

function newState() {
  return {
    lane: 1, x: LANES[1], speed: 260, dist: 0, coins: 0, score: 0, shown: -1, cars: [], coinsOn: [],
    nextRow: 120, lastTwo: false, scroll: 0, crashed: 0, countdown: 2.4,
    trees: Array.from({ length: 10 }, (_, i) => ({ side: i % 2, y: i * 52, e: TREES[rand(TREES.length)] })),
  };
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
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(st.current.score); }, 1100);
  };

  const steer = (d) => {
    const s = st.current;
    if (ended.current || s.crashed) return;
    const nl = s.lane + (d === 'left' ? -1 : d === 'right' ? 1 : 0);
    if (nl === s.lane || nl < 0 || nl > 2) return;
    s.lane = nl;
    sfx('move');
  };

  useKeys((k, down) => { if (down) steer(k); });
  useSwipe(canvasRef, (d) => steer(d));

  const onPointerDown = (e) => {
    if (e.pointerType === 'touch') return; // no toque, o deslizar/tocar é tratado abaixo
    const c = canvasRef.current;
    if (!c) return;
    steer(pointerPos(e, c, W, H).x < W / 2 ? 'left' : 'right');
  };
  const onTouchEnd = (e) => {
    // toque curto: lado da tela escolhe a faixa (o deslizar já é tratado pelo useSwipe)
    const c = canvasRef.current;
    const s = st.current;
    if (!c || !s.touch) return;
    const p = pointerPos(e, c, W, H);
    const moved = Math.hypot(p.x - s.touch.x, p.y - s.touch.y);
    s.touch = null;
    if (moved < 10) steer(p.x < W / 2 ? 'left' : 'right');
  };

  const spawnRow = (s) => {
    const two = !s.lastTwo && Math.random() < Math.min(0.55, 0.15 + s.dist / 40000);
    s.lastTwo = two;
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const blocked = lanes.slice(0, two ? 2 : 1);
    blocked.forEach((l) => {
      s.cars.push({ lane: l, y: -CAR_H - rand(20), color: CAR_COLORS[rand(CAR_COLORS.length)], v: 0.4 });
    });
    const free = [0, 1, 2].filter((l) => !blocked.includes(l));
    if (Math.random() < 0.6) {
      const l = free[rand(free.length)];
      const n = 1 + rand(3);
      for (let k = 0; k < n; k++) s.coinsOn.push({ lane: l, y: -40 - k * 34 });
    }
  };

  const update = (dt) => {
    const s = st.current;
    s.trees.forEach((t) => { t.y += s.speed * dt * (s.crashed ? 0 : 1); if (t.y > H + 30) { t.y -= 520; t.e = TREES[rand(TREES.length)]; } });
    if (s.crashed) { s.crashed += dt; return; }
    if (s.countdown > 0) { s.countdown -= dt; s.x = LANES[s.lane]; return; }
    s.speed = Math.min(720, s.speed + dt * 9);
    const dy = s.speed * dt;
    s.scroll = (s.scroll + dy) % 60;
    s.dist += dy;
    // posição lateral suave
    const tx = LANES[s.lane];
    s.x += (tx - s.x) * Math.min(1, dt * 16);

    s.nextRow -= dy;
    if (s.nextRow <= 0) {
      spawnRow(s);
      s.nextRow = Math.max(240, 330 - s.speed * 0.12) + rand(60);
    }
    // carros andam mais devagar que a estrada (sobem na tela em relação ao jogador)
    s.cars.forEach((c) => { c.y += dy * (1 - c.v * 0.5); });
    s.cars = s.cars.filter((c) => c.y < H + 20);
    s.coinsOn.forEach((c) => { c.y += dy * 0.8; });

    // moedas
    let got = false;
    s.coinsOn.forEach((c) => {
      if (!c.taken && Math.abs(LANES[c.lane] - s.x) < 30 && c.y > PLAYER_Y - 14 && c.y < PLAYER_Y + CAR_H + 14) { c.taken = true; s.coins += 1; got = true; }
    });
    if (got) sfx('coin');
    s.coinsOn = s.coinsOn.filter((c) => !c.taken && c.y < H + 20);

    // batida
    const hit = s.cars.some((c) => Math.abs(LANES[c.lane] - s.x) < CAR_W - 6 && c.y + CAR_H - 6 > PLAYER_Y && c.y + 6 < PLAYER_Y + CAR_H);
    s.score = Math.floor(s.dist / 10) + s.coins * 25;
    if (s.score !== s.shown && (got || s.score - s.shown >= 5)) { s.shown = s.score; onScore?.(s.score); }
    if (hit) {
      s.crashed = 0.0001;
      onScore?.(s.score);
      sfx('hit');
      finish();
    }
  };

  const drawCar = (ctx, x, y, color, player) => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rrect(ctx, x - CAR_W / 2 + 3, y + 4, CAR_W, CAR_H, 9); ctx.fill();
    ctx.fillStyle = '#111';
    [[-1, 12], [1, 12], [-1, CAR_H - 20], [1, CAR_H - 20]].forEach(([sx, wy]) => ctx.fillRect(x + sx * (CAR_W / 2) - 4, y + wy, 8, 12));
    ctx.fillStyle = color;
    rrect(ctx, x - CAR_W / 2, y, CAR_W, CAR_H, 9); ctx.fill();
    ctx.fillStyle = 'rgba(14,42,107,0.85)';
    const wy = player ? 14 : CAR_H - 26;
    rrect(ctx, x - CAR_W / 2 + 6, y + wy, CAR_W - 12, 12, 3); ctx.fill();
    rrect(ctx, x - CAR_W / 2 + 7, y + (player ? CAR_H - 18 : 8), CAR_W - 14, 8, 3); ctx.fill();
    if (player) {
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(x - 3, y + 2, 6, CAR_H - 4);
    } else {
      ctx.fillStyle = '#FF5555';
      ctx.fillRect(x - CAR_W / 2 + 4, y + CAR_H - 4, 8, 3); ctx.fillRect(x + CAR_W / 2 - 12, y + CAR_H - 4, 8, 3);
    }
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    ctx.fillStyle = '#2f8f4f';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    s.trees.forEach((t) => ctx.fillText(t.e, t.side ? W - 22 : 22, t.y));
    ctx.fillStyle = '#3a3f4b';
    ctx.fillRect(ROAD_X, 0, LANE_W * 3, H);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(ROAD_X + 3, 0, 4, H); ctx.fillRect(ROAD_X + LANE_W * 3 - 7, 0, 4, H);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 1; i < 3; i++) {
      for (let y = -60 + s.scroll; y < H; y += 60) ctx.fillRect(ROAD_X + i * LANE_W - 2, y, 4, 32);
    }
    // moedas
    s.coinsOn.forEach((c) => {
      const cx = LANES[c.lane];
      ctx.fillStyle = '#C99500';
      ctx.beginPath(); ctx.arc(cx, c.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.yellow;
      ctx.beginPath(); ctx.arc(cx, c.y, 8.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#C99500'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('$', cx, c.y + 1);
    });
    s.cars.forEach((c) => drawCar(ctx, LANES[c.lane], c.y, c.color, false));
    drawCar(ctx, s.x, PLAYER_Y, COLORS.red, true);
    if (s.crashed) {
      ctx.font = `${30 + Math.min(1, s.crashed * 3) * 20}px sans-serif`;
      ctx.fillText('💥', s.x, PLAYER_Y + 10);
    }
    // painel
    ctx.fillStyle = 'rgba(11,20,48,0.7)';
    rrect(ctx, 8, 8, 118, 28, 14); ctx.fill();
    rrect(ctx, W - 96, 8, 88, 28, 14); ctx.fill();
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = COLORS.white; ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(s.dist / 10)} m`, 67, 23);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(`🪙 ${s.coins}`, W - 52, 23);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${Math.round(s.speed / 4)} km/h`, W / 2, 22);
    if (s.countdown > 0) {
      ctx.fillStyle = 'rgba(11,20,48,0.5)'; ctx.fillRect(0, H / 2 - 50, W, 100);
      ctx.fillStyle = COLORS.yellow; ctx.font = 'bold 54px sans-serif';
      ctx.fillText(s.countdown > 0.6 ? String(Math.ceil(s.countdown - 0.6)) : 'JÁ!', W / 2, H / 2);
    }
    if (ended.current) {
      ctx.fillStyle = 'rgba(11,20,48,0.55)'; ctx.fillRect(0, H / 2 - 40, W, 80);
      ctx.fillStyle = COLORS.white; ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Bateu!', W / 2, H / 2);
    }
  };

  useRaf((dt) => { update(dt); draw(); }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Corrida"
      onPointerDown={onPointerDown}
      onTouchStart={(e) => { const c = canvasRef.current; if (c) st.current.touch = pointerPos(e, c, W, H); }}
      onTouchEnd={onTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
