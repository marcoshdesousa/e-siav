// Nave espacial: a nave atira sozinha; mova para desviar e destruir as ondas de invasores.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, pointerPos, rand, useCanvas, useKeys, useRaf } from '../kit.js';

const W = 360;
const H = 480;
const SHIP_Y = H - 44;
const SHIP_W = 30;
const INV_W = 26;
const INV_H = 18;
const ROW_COLORS = [COLORS.red, '#F2762E', COLORS.yellow, COLORS.lime, COLORS.sky];
const ROW_POINTS = [50, 40, 30, 20, 10];

// Desenho de cada invasor (8x6 pixels), duas poses.
const SPRITES = [
  ['00111100', '01111110', '11011011', '11111111', '01011010', '10000001'],
  ['00111100', '01111110', '11011011', '11111111', '00100100', '01011010'],
];

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none' };

function buildWave(n) {
  const rows = Math.min(5, 2 + Math.floor((n + 1) / 2));
  const cols = Math.min(8, 5 + Math.floor(n / 2));
  const gapX = 12;
  const total = cols * INV_W + (cols - 1) * gapX;
  const x0 = (W - total) / 2;
  const inv = [];
  for (let r = 0; r < rows; r++) {
    const type = 5 - rows + r;
    for (let c = 0; c < cols; c++) inv.push({ x: x0 + c * (INV_W + gapX), y: 50 + r * (INV_H + 14), type, alive: true });
  }
  return inv;
}

function newState() {
  return {
    x: W / 2, keys: { left: false, right: false }, lives: 3, score: 0, wave: 1,
    inv: buildWave(1), dir: 1, shots: [], bombs: [], fireT: 0, bombT: 1.5, t: 0,
    hurtT: 0, banner: 'Onda 1', bannerT: 1.6, booms: [], stars: Array.from({ length: 40 }, () => ({ x: rand(W), y: rand(H), s: 1 + rand(2) })),
  };
}

const hitBox = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  useKeys((k, down) => { if (k === 'left' || k === 'right') st.current.keys[k] = down; });

  const onPointer = (e) => {
    if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return;
    const c = canvasRef.current;
    if (!c) return;
    st.current.x = clamp(pointerPos(e, c, W, H).x, SHIP_W / 2, W - SHIP_W / 2);
  };

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    setRunning(false);
    onEnd?.(st.current.score);
  };

  const boom = (x, y, color) => st.current.booms.push({ x, y, t: 0, color });

  const hurt = () => {
    const s = st.current;
    if (s.hurtT > 0) return;
    s.lives -= 1;
    boom(s.x, SHIP_Y + 8, COLORS.yellow);
    if (s.lives <= 0) { finish(); return; }
    s.hurtT = 2;
    s.bombs = [];
  };

  const update = (dt) => {
    const s = st.current;
    s.t += dt;
    const kv = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0);
    if (kv) s.x = clamp(s.x + kv * 300 * dt, SHIP_W / 2, W - SHIP_W / 2);
    if (s.hurtT > 0) s.hurtT -= dt;
    s.stars.forEach((p) => { p.y += p.s * 30 * dt; if (p.y > H) { p.y = 0; p.x = rand(W); } });
    s.booms.forEach((b) => { b.t += dt; });
    s.booms = s.booms.filter((b) => b.t < 0.45);
    if (s.bannerT > 0) { s.bannerT -= dt; return; }

    // tiro automático
    s.fireT -= dt;
    if (s.fireT <= 0) {
      s.fireT = Math.max(0.2, 0.34 - s.wave * 0.01);
      s.shots.push({ x: s.x, y: SHIP_Y - 6 });
    }
    s.shots.forEach((p) => { p.y -= 520 * dt; });
    s.shots = s.shots.filter((p) => p.y > -10);

    // invasores andam em bloco e descem nas bordas
    const alive = s.inv.filter((v) => v.alive);
    const total = s.inv.length;
    const frac = alive.length / total;
    const speed = (26 + s.wave * 9) * (1 + (1 - frac) * 1.8);
    let minX = W; let maxX = 0; let maxY = 0;
    alive.forEach((v) => { minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x + INV_W); maxY = Math.max(maxY, v.y + INV_H); });
    const dx = s.dir * speed * dt;
    if (maxX + dx > W - 6 || minX + dx < 6) {
      s.dir *= -1;
      alive.forEach((v) => { v.y += 14; });
    } else {
      alive.forEach((v) => { v.x += dx; });
    }
    if (maxY >= SHIP_Y - 4) {
      // chegaram na nave: perde uma vida e a onda recomeça
      s.hurtT = 0;
      hurt();
      if (ended.current) return;
      s.inv = buildWave(s.wave);
      s.dir = 1;
      s.shots = [];
      s.banner = `Onda ${s.wave}`;
      s.bannerT = 1.4;
      return;
    }

    // bombas dos invasores (só os da frente de cada coluna atiram)
    s.bombT -= dt;
    if (s.bombT <= 0 && alive.length) {
      s.bombT = Math.max(0.35, 1.4 - s.wave * 0.12) * (0.6 + Math.random() * 0.8);
      const front = new Map();
      alive.forEach((v) => {
        const k = Math.round(v.x);
        if (!front.has(k) || front.get(k).y < v.y) front.set(k, v);
      });
      const shooters = [...front.values()];
      // prefere quem está perto da nave
      shooters.sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x));
      const v = Math.random() < 0.5 ? shooters[0] : shooters[rand(shooters.length)];
      s.bombs.push({ x: v.x + INV_W / 2, y: v.y + INV_H, vy: 170 + s.wave * 14 });
    }
    s.bombs.forEach((b) => { b.y += b.vy * dt; });
    s.bombs = s.bombs.filter((b) => b.y < H + 10);

    // colisões dos tiros
    for (const p of s.shots) {
      for (const v of alive) {
        if (v.alive && hitBox(p.x - 2, p.y - 6, 4, 12, v.x, v.y, INV_W, INV_H)) {
          v.alive = false;
          p.y = -100;
          s.score += ROW_POINTS[v.type] + (s.wave - 1) * 5;
          onScore?.(s.score);
          boom(v.x + INV_W / 2, v.y + INV_H / 2, ROW_COLORS[v.type]);
          break;
        }
      }
    }
    if (s.hurtT <= 0) {
      for (const b of s.bombs) {
        if (hitBox(b.x - 3, b.y - 6, 6, 12, s.x - SHIP_W / 2 + 3, SHIP_Y, SHIP_W - 6, 22)) { b.y = H + 100; hurt(); break; }
      }
      if (ended.current) return;
    }

    if (s.inv.every((v) => !v.alive)) {
      s.wave += 1;
      s.score += 100;
      onScore?.(s.score);
      s.inv = buildWave(s.wave);
      s.dir = 1;
      s.shots = [];
      s.bombs = [];
      s.banner = `Onda ${s.wave}`;
      s.bannerT = 1.4;
    }
  };

  const drawInvader = (ctx, v, pose) => {
    const px = INV_W / 8; const py = INV_H / 6;
    ctx.fillStyle = ROW_COLORS[v.type];
    SPRITES[pose].forEach((row, j) => {
      for (let i = 0; i < 8; i++) if (row[i] === '1') ctx.fillRect(v.x + i * px, v.y + j * py, px + 0.5, py + 0.5);
    });
  };

  const drawShip = (ctx, x) => {
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.moveTo(x, SHIP_Y - 4);
    ctx.lineTo(x + SHIP_W / 2, SHIP_Y + 22);
    ctx.lineTo(x - SHIP_W / 2, SHIP_Y + 22);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.sky;
    ctx.beginPath(); ctx.arc(x, SHIP_Y + 10, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(x - SHIP_W / 2, SHIP_Y + 16, 6, 6);
    ctx.fillRect(x + SHIP_W / 2 - 6, SHIP_Y + 16, 6, 6);
    ctx.fillStyle = COLORS.yellow;
    const f = 4 + Math.random() * 5;
    ctx.beginPath(); ctx.moveTo(x - 5, SHIP_Y + 22); ctx.lineTo(x, SHIP_Y + 22 + f); ctx.lineTo(x + 5, SHIP_Y + 22); ctx.fill();
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    s.stars.forEach((p) => { ctx.fillStyle = p.s > 1 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)'; ctx.fillRect(p.x, p.y, p.s, p.s); });
    ctx.font = 'bold 15px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Onda ${s.wave}`, 12, 18);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.red;
    ctx.fillText('❤'.repeat(Math.max(0, s.lives)), W - 12, 18);
    const pose = Math.floor(s.t * 3) % 2;
    s.inv.forEach((v) => { if (v.alive) drawInvader(ctx, v, pose); });
    ctx.fillStyle = COLORS.yellow;
    s.shots.forEach((p) => ctx.fillRect(p.x - 2, p.y - 6, 4, 12));
    ctx.fillStyle = COLORS.red;
    s.bombs.forEach((b) => { ctx.beginPath(); ctx.ellipse(b.x, b.y, 3, 6, 0, 0, Math.PI * 2); ctx.fill(); });
    if (s.lives > 0 && (s.hurtT <= 0 || Math.floor(s.hurtT * 10) % 2 === 0)) drawShip(ctx, s.x);
    s.booms.forEach((b) => {
      const k = b.t / 0.45;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, 4 + k * 18, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    });
    if (s.bannerT > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.yellow;
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(s.banner, W / 2, H / 2 + 30);
    }
  };

  useRaf((dt) => {
    if (ended.current) return;
    update(dt);
    draw();
  }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Nave espacial"
      onPointerDown={(e) => {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
        onPointer(e);
      }}
      onPointerMove={onPointer}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
