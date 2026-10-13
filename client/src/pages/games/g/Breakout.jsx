// Quebra-tijolos: rebata a bola com a barra e quebre todos os tijolos. Cada fase a bola fica mais rápida.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, pointerPos, useCanvas, useKeys, useRaf } from '../kit.js';

const W = 360;
const H = 460;
const COLS = 8;
const BW = 40;
const BH = 16;
const GAP = 4;
const LEFT = (W - (COLS * BW + (COLS - 1) * GAP)) / 2;
const TOP = 56;
const PAD_Y = H - 34;
const PAD_H = 12;
const BALL_R = 6;
const ROW_COLORS = [COLORS.red, '#F2762E', COLORS.yellow, COLORS.lime, COLORS.green, COLORS.sky, COLORS.blue];

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none' };

function buildBricks(level) {
  const rows = Math.min(7, 4 + level);
  const bricks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      // fases mais altas têm tijolos que precisam de 2 batidas
      const hp = level >= 2 && r < Math.min(rows, level - 1) ? 2 : 1;
      bricks.push({ x: LEFT + c * (BW + GAP), y: TOP + r * (BH + GAP), hp, color: ROW_COLORS[r % ROW_COLORS.length], alive: true });
    }
  }
  return bricks;
}

const baseSpeed = (level) => 250 + (level - 1) * 45;
const padWidth = (level) => Math.max(54, 80 - (level - 1) * 5);

function newState() {
  return {
    level: 1, lives: 3, score: 0, bricks: buildBricks(1), padX: W / 2, padW: padWidth(1),
    ball: { x: W / 2, y: PAD_Y - BALL_R, vx: 0, vy: 0, speed: baseSpeed(1) }, stuck: true, serveT: 1.6,
    keys: { left: false, right: false }, banner: 'Fase 1', bannerT: 1.6,
  };
}

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  const launch = () => {
    const s = st.current;
    if (!s.stuck || ended.current) return;
    s.stuck = false;
    const a = (-Math.PI / 2) + (Math.random() * 0.6 - 0.3);
    s.ball.vx = Math.cos(a) * s.ball.speed;
    s.ball.vy = Math.sin(a) * s.ball.speed;
  };

  const setKey = (k, down) => {
    const s = st.current;
    if (k === 'left' || k === 'right') s.keys[k] = down;
    if (down && (k === 'action' || k === 'up')) launch();
  };
  useKeys(setKey);

  const onPointer = (e) => {
    if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return;
    const c = canvasRef.current;
    if (!c) return;
    st.current.padX = clamp(pointerPos(e, c, W, H).x, st.current.padW / 2, W - st.current.padW / 2);
  };

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    setRunning(false);
    onEnd?.(st.current.score);
  };

  const resetBall = () => {
    const s = st.current;
    s.stuck = true;
    s.serveT = 1.4;
    s.ball.speed = baseSpeed(s.level);
    s.ball.vx = 0; s.ball.vy = 0;
  };

  const physics = (dt) => {
    const s = st.current;
    const b = s.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
    if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }
    if (b.y < BALL_R + 30) { b.y = BALL_R + 30; b.vy = Math.abs(b.vy); }
    // barra
    if (b.vy > 0 && b.y + BALL_R >= PAD_Y && b.y + BALL_R <= PAD_Y + PAD_H + 8
      && b.x >= s.padX - s.padW / 2 - BALL_R && b.x <= s.padX + s.padW / 2 + BALL_R) {
      const rel = clamp((b.x - s.padX) / (s.padW / 2), -1, 1);
      const a = -Math.PI / 2 + rel * 1.05 + (Math.random() - 0.5) * 0.08;
      b.speed = Math.min(b.speed * 1.01, baseSpeed(s.level) + 200);
      b.vx = Math.cos(a) * b.speed;
      b.vy = Math.sin(a) * b.speed;
      b.y = PAD_Y - BALL_R;
    }
    // tijolos (no máximo um por passo, para a bola não atravessar tudo)
    for (const br of s.bricks) {
      if (!br.alive) continue;
      const nx = clamp(b.x, br.x, br.x + BW);
      const ny = clamp(b.y, br.y, br.y + BH);
      const dx = b.x - nx; const dy = b.y - ny;
      if (dx * dx + dy * dy > BALL_R * BALL_R) continue;
      const overX = Math.min(b.x + BALL_R - br.x, br.x + BW - (b.x - BALL_R));
      const overY = Math.min(b.y + BALL_R - br.y, br.y + BH - (b.y - BALL_R));
      if (overX < overY) b.vx = b.x < br.x + BW / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
      else b.vy = b.y < br.y + BH / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
      br.hp -= 1;
      if (br.hp <= 0) {
        br.alive = false;
        s.score += 10;
        onScore?.(s.score);
      }
      b.speed = Math.min(b.speed * 1.004, baseSpeed(s.level) + 200);
      const k = b.speed / Math.hypot(b.vx, b.vy);
      b.vx *= k; b.vy *= k;
      break;
    }
    // evita a bola ficar quase na horizontal
    if (Math.abs(b.vy) < b.speed * 0.3) {
      b.vy = Math.sign(b.vy || -1) * b.speed * 0.3;
      b.vx = Math.sign(b.vx || 1) * Math.sqrt(b.speed * b.speed - b.vy * b.vy);
    }
  };

  const update = (dt) => {
    const s = st.current;
    const kv = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0);
    if (kv) s.padX = clamp(s.padX + kv * 380 * dt, s.padW / 2, W - s.padW / 2);
    if (s.bannerT > 0) s.bannerT -= dt;
    if (s.stuck) {
      s.ball.x = s.padX;
      s.ball.y = PAD_Y - BALL_R;
      s.serveT -= dt;
      if (s.serveT <= 0) launch();
      return;
    }
    const steps = Math.ceil((s.ball.speed * dt) / 4);
    for (let i = 0; i < steps; i++) physics(dt / steps);
    if (s.ball.y - BALL_R > H) {
      s.lives -= 1;
      if (s.lives <= 0) { finish(); return; }
      resetBall();
      return;
    }
    if (s.bricks.every((br) => !br.alive)) {
      s.level += 1;
      s.bricks = buildBricks(s.level);
      s.padW = padWidth(s.level);
      s.padX = clamp(s.padX, s.padW / 2, W - s.padW / 2);
      s.banner = `Fase ${s.level}`;
      s.bannerT = 1.6;
      resetBall();
    }
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COLORS.navy); g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // topo: vidas e fase
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, W, 30);
    ctx.font = 'bold 15px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Fase ${s.level}`, 12, 15);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.red;
    ctx.fillText('❤'.repeat(Math.max(0, s.lives)), W - 12, 15);
    // tijolos
    s.bricks.forEach((br) => {
      if (!br.alive) return;
      ctx.fillStyle = br.color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(br.x, br.y, BW, BH, 4); else ctx.rect(br.x, br.y, BW, BH);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(br.x + 3, br.y + 2, BW - 6, 3);
      if (br.hp > 1) {
        ctx.strokeStyle = COLORS.white;
        ctx.lineWidth = 2;
        ctx.strokeRect(br.x + 2, br.y + 2, BW - 4, BH - 4);
      }
    });
    // barra
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    const px = s.padX - s.padW / 2;
    if (ctx.roundRect) ctx.roundRect(px, PAD_Y, s.padW, PAD_H, 6); else ctx.rect(px, PAD_Y, s.padW, PAD_H);
    ctx.fill();
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(s.padX - 6, PAD_Y + 3, 12, PAD_H - 6);
    // bola
    ctx.fillStyle = COLORS.white;
    ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center';
    if (s.bannerT > 0) {
      ctx.fillStyle = COLORS.yellow;
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(s.banner, W / 2, H / 2 + 20);
    }
    if (s.stuck) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '14px sans-serif';
      ctx.fillText('Toque ou espaço para lançar', W / 2, H / 2 + 56);
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
      aria-label="Quebra-tijolos"
      onPointerDown={(e) => {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
        onPointer(e); launch();
      }}
      onPointerMove={onPointer}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
