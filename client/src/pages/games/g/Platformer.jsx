// Aventura do Desbravador: corra por uma fase sem fim, pule buracos, pise nos besouros e pegue moedas.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, rand, useCanvas, useKeys, useRaf } from '../kit.js';
import DPad from '../DPad.jsx';
import { sfx } from '../audio.js';

const W = 360;
const H = 400;
const T = 24;
const BASE = H - 3 * T; // topo do chão "normal"
const PW = 18;
const PH = 28;
const GRAV = 1700;
const JUMP = 610;
const RUN = 170;
const START_X = 3 * T;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none' };

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function newState() {
  const s = {
    p: { x: START_X, y: BASE - PH, w: PW, h: PH, vx: 0, vy: 0, face: 1, onGround: true, groundT: 0, walk: 0 },
    keys: { left: false, right: false }, jumpBuf: 0, jumpHeld: false,
    camX: 0, maxX: START_X, lives: 3, coins: 0, stomps: 0, inv: 0, t: 0,
    solids: [], coinsList: [], enemies: [], genX: 0, lastTop: BASE, lastSafe: null, score: 0, msg: '', msgT: 0,
  };
  // começo plano e seguro
  const first = { x: -4 * T, y: BASE, w: 20 * T, h: H, kind: 'ground' };
  s.solids.push(first);
  s.lastSafe = first;
  s.genX = first.x + first.w;
  return s;
}

function generate(s) {
  const d = Math.min(1.3, s.genX / (T * 350));
  // buraco
  const up = rand(3) - 1; // -1 sobe, 0 igual, 1 desce
  const top = clamp(s.lastTop - up * T, BASE - 2 * T, BASE);
  const rose = top < s.lastTop;
  const maxGap = rose ? 3 : Math.min(4, 2 + Math.round(d * 2));
  const gap = 1 + rand(maxGap);
  const gapX = s.genX;
  // moedas em arco sobre o buraco
  if (Math.random() < 0.5) {
    const mid = gapX + (gap * T) / 2;
    [-1, 0, 1].forEach((k) => s.coinsList.push({ x: mid + k * 20, y: Math.min(top, s.lastTop) - 64 - (k === 0 ? 14 : 0), taken: false }));
  }
  s.genX += gap * T;
  // trecho de chão
  const len = Math.max(4, 5 + rand(8) - Math.round(d * 2));
  const g = { x: s.genX, y: top, w: len * T, h: H - top + 60, kind: 'ground' };
  s.solids.push(g);
  const espeed = 40 + d * 45;
  const nEnemies = len >= 6 && Math.random() < 0.35 + d * 0.4 ? (len >= 9 && Math.random() < d * 0.8 ? 2 : 1) : 0;
  for (let i = 0; i < nEnemies; i++) {
    const ex = g.x + T * 2 + rand(Math.max(1, len - 4)) * T;
    s.enemies.push({ x: ex, y: top - 20, w: 22, h: 20, vx: (Math.random() < 0.5 ? -1 : 1) * espeed, minX: g.x, maxX: g.x + g.w, alive: true, deadT: 0 });
  }
  // plataforma flutuante com moedas
  if (len >= 5 && Math.random() < 0.5) {
    const pw = 2 + rand(3);
    const px = g.x + T * (1 + rand(Math.max(1, len - pw - 1)));
    const py = top - 3 * T - rand(2) * T;
    const plat = { x: px, y: py, w: pw * T, h: T, kind: 'brick' };
    s.solids.push(plat);
    for (let i = 0; i < pw; i++) s.coinsList.push({ x: px + i * T + T / 2, y: py - 16, taken: false });
    if (pw >= 3 && d > 0.4 && Math.random() < 0.4) {
      s.enemies.push({ x: px + 2, y: py - 20, w: 22, h: 20, vx: espeed * 0.8, minX: px, maxX: px + plat.w, alive: true, deadT: 0 });
    }
  } else if (Math.random() < 0.5) {
    const n = 2 + rand(3);
    const cx = g.x + T * (1 + rand(Math.max(1, len - n - 1)));
    for (let i = 0; i < n; i++) s.coinsList.push({ x: cx + i * 22, y: top - 18, taken: false });
  }
  s.genX += g.w;
  s.lastTop = top;
}

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  const input = (k, down) => {
    const s = st.current;
    if (k === 'left' || k === 'right') s.keys[k] = down;
    if (k === 'up' || k === 'action') {
      if (down && !s.jumpHeld) s.jumpBuf = 0.14;
      s.jumpHeld = down;
      if (!down && s.p.vy < -260) s.p.vy = -260; // pulo curto ao soltar
    }
  };
  useKeys(input);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    setRunning(false);
    onEnd?.(st.current.score);
  };

  const report = () => {
    const s = st.current;
    const dist = Math.max(0, Math.floor((s.maxX - START_X) / T));
    const sc = dist + s.coins * 10 + s.stomps * 50;
    if (sc !== s.score) { s.score = sc; onScore?.(sc); }
  };

  const loseLife = (fell, from) => {
    const s = st.current;
    s.lives -= 1;
    sfx('hit');
    if (s.lives <= 0) { finish(); return; }
    s.inv = 2;
    s.msg = fell ? 'Caiu! -1 vida' : 'Ai! -1 vida';
    s.msgT = 1.2;
    const p = s.p;
    if (fell) {
      const r = s.lastSafe;
      p.x = clamp(s.camX + 40, r.x + 4, r.x + r.w - PW - 4);
      p.y = r.y - PH;
      p.vx = 0; p.vy = 0;
      s.camX = Math.min(s.camX, p.x - 40);
    } else {
      p.vy = -380;
      p.vx = (from && p.x + PW / 2 < from.x + from.w / 2 ? -1 : 1) * 160;
    }
  };

  const update = (dt) => {
    const s = st.current;
    const p = s.p;
    s.t += dt;
    if (s.inv > 0) s.inv -= dt;
    if (s.msgT > 0) s.msgT -= dt;
    if (s.jumpBuf > 0) s.jumpBuf -= dt;

    // horizontal
    const dir = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0);
    if (dir) {
      p.face = dir;
      p.vx += dir * (p.onGround ? 1500 : 1000) * dt;
      p.vx = clamp(p.vx, -RUN, RUN);
    } else {
      const f = (p.onGround ? 1400 : 300) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    // pulo (com tolerância logo após sair da beirada)
    if (p.onGround) p.groundT = 0.1; else p.groundT -= dt;
    if (s.jumpBuf > 0 && p.groundT > 0) {
      p.vy = -JUMP;
      p.onGround = false;
      p.groundT = 0;
      s.jumpBuf = 0;
      sfx('jump');
    }
    p.vy = Math.min(p.vy + GRAV * dt, 900);

    // move em x
    p.x += p.vx * dt;
    if (p.x < s.camX) { p.x = s.camX; p.vx = Math.max(0, p.vx); }
    for (const r of s.solids) {
      if (!overlap(p, r)) continue;
      if (p.vx > 0) p.x = r.x - p.w; else if (p.vx < 0) p.x = r.x + r.w; else p.x = p.x + p.w / 2 < r.x + r.w / 2 ? r.x - p.w : r.x + r.w;
      p.vx = 0;
    }
    // move em y
    const prevBottom = p.y + p.h;
    p.y += p.vy * dt;
    p.onGround = false;
    for (const r of s.solids) {
      if (!overlap(p, r)) continue;
      if (p.vy >= 0) {
        p.y = r.y - p.h; p.vy = 0; p.onGround = true;
        if (r.kind === 'ground') s.lastSafe = r;
      } else {
        p.y = r.y + r.h; p.vy = 0;
      }
    }
    if (p.onGround && p.vx !== 0) p.walk += Math.abs(p.vx) * dt; else if (p.onGround) p.walk = 0;

    // câmera e geração da fase
    s.camX = Math.max(s.camX, p.x - W * 0.4);
    while (s.genX < s.camX + W + 240) generate(s);
    const cut = s.camX - 80;
    if (s.solids.length > 40) s.solids = s.solids.filter((r) => r.x + r.w > cut || r === s.lastSafe);
    s.coinsList = s.coinsList.filter((c) => !c.taken && c.x > cut);
    s.enemies = s.enemies.filter((e) => e.x + e.w > cut && (e.alive || e.deadT < 0.5));
    s.maxX = Math.max(s.maxX, p.x);

    // moedas
    for (const c of s.coinsList) {
      if (!c.taken && overlap(p, { x: c.x - 8, y: c.y - 8, w: 16, h: 16 })) { c.taken = true; s.coins += 1; sfx('coin'); }
    }
    // inimigos
    for (const e of s.enemies) {
      if (!e.alive) { e.deadT += dt; continue; }
      e.x += e.vx * dt;
      if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
      if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
      if (!overlap(p, e)) continue;
      if (p.vy > 0 && prevBottom <= e.y + 10) {
        e.alive = false;
        s.stomps += 1;
        sfx('pop');
        p.vy = s.jumpHeld ? -JUMP * 0.9 : -420;
        p.y = e.y - p.h;
      } else if (s.inv <= 0) {
        loseLife(false, e);
        if (ended.current) return;
      }
    }
    report();
    if (p.y > H + 60) { loseLife(true); }
  };

  const drawScout = (ctx, x, y, face, walk, air) => {
    ctx.save();
    ctx.translate(x + PW / 2, y);
    ctx.scale(face, 1);
    const leg = air ? 3 : Math.sin(walk / 6) * 4;
    // pernas (calça azul-marinho) e sapatos
    ctx.fillStyle = COLORS.navy;
    ctx.fillRect(-6 + leg * 0.5, 19, 5, 7);
    ctx.fillRect(1 - leg * 0.5, 19, 5, 7);
    ctx.fillStyle = '#2A1A0E';
    ctx.fillRect(-7 + leg * 0.5, 25, 7, 3);
    ctx.fillRect(1 - leg * 0.5, 25, 7, 3);
    // camisa caqui
    ctx.fillStyle = '#CDB47A';
    ctx.fillRect(-7, 10, 14, 10);
    // braço
    ctx.fillStyle = '#B79C5E';
    ctx.fillRect(2, 11 + (air ? -3 : leg * 0.3), 4, 7);
    // lenço amarelo
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(6, 10); ctx.lineTo(0, 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(-1.5, 11, 3, 3);
    // rosto
    ctx.fillStyle = '#F2C29B';
    ctx.fillRect(-5, 2, 10, 9);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(2, 5, 2, 2);
    // chapéu
    ctx.fillStyle = '#7A5230';
    ctx.fillRect(-8, 2, 16, 2);
    ctx.fillRect(-5, -3, 10, 5);
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(-5, 0, 10, 1.5);
    ctx.restore();
  };

  const drawEnemy = (ctx, e, t) => {
    const x = e.x; const y = e.y;
    if (!e.alive) {
      ctx.fillStyle = '#7A2A1A';
      ctx.fillRect(x, y + e.h - 6, e.w, 6);
      return;
    }
    const step = Math.sin(t * 12 + x) * 2;
    ctx.fillStyle = '#2A1A0E';
    ctx.fillRect(x + 3 + step, y + e.h - 4, 6, 4);
    ctx.fillRect(x + e.w - 9 - step, y + e.h - 4, 6, 4);
    ctx.fillStyle = '#A8361F';
    ctx.beginPath(); ctx.ellipse(x + e.w / 2, y + e.h - 8, e.w / 2, e.h / 2 + 2, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(x, y + e.h - 9, e.w, 5);
    ctx.fillStyle = '#E8A86A';
    ctx.fillRect(x + 4, y + e.h - 6, e.w - 8, 3);
    const lx = e.vx < 0 ? -2 : 2;
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x + 5 + lx, y + 5, 5, 6);
    ctx.fillRect(x + e.w - 10 + lx, y + 5, 5, 6);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x + 7 + lx, y + 7, 2, 3);
    ctx.fillRect(x + e.w - 8 + lx, y + 7, 2, 3);
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#4D86E8'); sky.addColorStop(1, '#BFDBFF');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // nuvens (paralaxe)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = -1; i < 4; i++) {
      const base = Math.floor(s.camX * 0.15 / 160) + i;
      const cx = base * 160 - s.camX * 0.15 + 40 + (base % 3) * 25;
      const cy = 50 + ((base * 37) % 3) * 22;
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.arc(cx + 16, cy - 6, 18, 0, Math.PI * 2); ctx.arc(cx + 34, cy, 13, 0, Math.PI * 2); ctx.fill();
    }
    // morros e pinheiros ao fundo
    ctx.fillStyle = '#6FBF8A';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) ctx.lineTo(x, BASE - 50 - Math.sin((x + s.camX * 0.3) / 70) * 26);
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = '#2F8A5B';
    for (let i = -1; i < 9; i++) {
      const base = Math.floor(s.camX * 0.5 / 50) + i;
      const tx = base * 50 - s.camX * 0.5 + ((base * 13) % 20);
      const th = 40 + ((base * 7) % 3) * 12;
      ctx.beginPath(); ctx.moveTo(tx, BASE + 4); ctx.lineTo(tx + 12, BASE + 4 - th); ctx.lineTo(tx + 24, BASE + 4); ctx.fill();
    }

    ctx.save();
    ctx.translate(-Math.round(s.camX), 0);
    // blocos
    s.solids.forEach((r) => {
      if (r.x > s.camX + W || r.x + r.w < s.camX) return;
      if (r.kind === 'ground') {
        ctx.fillStyle = '#8B5A2B';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = '#74471F';
        for (let x = r.x + 6; x < r.x + r.w - 4; x += 18) ctx.fillRect(x, r.y + 18 + ((x / 18) % 2) * 14, 5, 4);
        ctx.fillStyle = COLORS.green;
        ctx.fillRect(r.x, r.y, r.w, 8);
        ctx.fillStyle = COLORS.lime;
        ctx.fillRect(r.x, r.y, r.w, 3);
      } else {
        for (let x = r.x; x < r.x + r.w; x += T) {
          ctx.fillStyle = '#C8642C';
          ctx.fillRect(x, r.y, T, T);
          ctx.strokeStyle = '#7A3414';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, r.y + 1, T - 2, T - 2);
          ctx.beginPath(); ctx.moveTo(x, r.y + T / 2); ctx.lineTo(x + T, r.y + T / 2);
          ctx.moveTo(x + T / 2, r.y); ctx.lineTo(x + T / 2, r.y + T / 2); ctx.stroke();
        }
      }
    });
    // moedas
    s.coinsList.forEach((c) => {
      if (c.taken) return;
      const k = Math.abs(Math.cos(s.t * 4 + c.x * 0.05));
      ctx.fillStyle = COLORS.yellow;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 2 + 6 * k, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#C99400'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    s.enemies.forEach((e) => drawEnemy(ctx, e, s.t));
    const p = s.p;
    if (s.inv <= 0 || Math.floor(s.inv * 12) % 2 === 0) drawScout(ctx, p.x, p.y, p.face, p.walk, !p.onGround);
    ctx.restore();

    // painel
    ctx.fillStyle = 'rgba(14,42,107,0.75)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(8, 8, 150, 28, 10); else ctx.rect(8, 8, 150, 28);
    ctx.fill();
    ctx.font = 'bold 15px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.red;
    ctx.fillText('❤'.repeat(Math.max(0, s.lives)), 16, 23);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(`● ${s.coins}`, 92, 23);
    if (s.msgT > 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = COLORS.navy;
      ctx.fillStyle = COLORS.white;
      ctx.strokeText(s.msg, W / 2, H / 2 - 40);
      ctx.fillText(s.msg, W / 2, H / 2 - 40);
    }
  };

  useRaf((dt) => {
    if (ended.current) return;
    update(dt);
    draw();
  }, running);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <canvas ref={canvasRef} style={canvasStyle} aria-label="Aventura do Desbravador" onContextMenu={(e) => e.preventDefault()} />
      <DPad dirs={['left', 'right']} onDir={input} action="Pular" />
    </div>
  );
}
