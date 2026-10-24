// Aventura do Desbravador: corra por uma fase sem fim, pule buracos, pise nos besouros e pegue moedas.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, rand, useCanvas, useKeys, useRaf } from '../kit.js';
import DPad from '../DPad.jsx';
import { sfx } from '../audio.js';
import { drawHearts } from '../art.jsx';

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

  // Desbravador: cabeça redonda, chapéu de abas, camisa caqui, lenço amarelo; braços e pernas animados.
  const drawScout = (ctx, x, y, face, walk, air) => {
    ctx.save();
    ctx.translate(x + PW / 2, y);
    ctx.scale(face, 1);
    const sw = air ? 0.6 : Math.sin(walk / 5) * 0.7;
    const limb = (px, py, len, ang, w, c, end) => {
      ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len); ctx.stroke();
      if (end) { ctx.fillStyle = end; ctx.beginPath(); ctx.ellipse(1.5, len + 1, 3.6, 2.2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    };
    // sombra no chão
    if (!air) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, PH + 1, 9, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
    limb(-2, 18, 8, sw, 4.6, '#1C2E5E', '#2A1A0E');
    limb(2, 18, 8, -sw, 4.6, '#22386E', '#2A1A0E');
    limb(-4, 12, 7, -sw * 0.9 + (air ? -1.6 : 0), 3.6, '#B79C5E', '#F2C29B');
    // tronco
    const shirt = ctx.createLinearGradient(-7, 10, 7, 20);
    shirt.addColorStop(0, '#DCC58C'); shirt.addColorStop(1, '#B9A065');
    ctx.fillStyle = shirt;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-7, 10, 14, 11, 4); else ctx.rect(-7, 10, 14, 11); ctx.fill();
    ctx.fillStyle = '#1C2E5E'; ctx.fillRect(-7, 18.5, 14, 2.5);
    // lenço
    ctx.fillStyle = '#F9C71D';
    ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(6, 10); ctx.lineTo(0, 17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E92A2F'; ctx.beginPath(); ctx.arc(0, 12, 1.6, 0, Math.PI * 2); ctx.fill();
    limb(4, 12, 7, sw * 0.9 + (air ? -1.6 : 0), 3.6, '#C9AE6E', '#F2C29B');
    // cabeça
    const skin = ctx.createRadialGradient(1, 4, 1, 0, 6, 7);
    skin.addColorStop(0, '#FFD8B5'); skin.addColorStop(1, '#E3A97F');
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, 6, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#101831'; ctx.beginPath(); ctx.arc(3, 5.5, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9A5A3A'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(2.5, 7.5, 1.6, 0.2, 1.4); ctx.stroke();
    // chapéu de abas
    ctx.fillStyle = '#7A5230';
    ctx.beginPath(); ctx.ellipse(0, 1.5, 9.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    const hat = ctx.createLinearGradient(0, -5, 0, 2);
    hat.addColorStop(0, '#A87545'); hat.addColorStop(1, '#7A5230');
    ctx.fillStyle = hat;
    ctx.beginPath(); ctx.moveTo(-5.5, 1.5); ctx.quadraticCurveTo(-5, -5, 0, -5.5); ctx.quadraticCurveTo(5, -5, 5.5, 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#18875A'; ctx.fillRect(-5.3, -0.6, 10.6, 1.6);
    ctx.restore();
  };

  // Besouro com casco brilhante e perninhas.
  const drawEnemy = (ctx, e, t) => {
    const x = e.x; const y = e.y;
    const cx = x + e.w / 2; const by = y + e.h;
    if (!e.alive) {
      ctx.fillStyle = '#5E1E14';
      ctx.beginPath(); ctx.ellipse(cx, by - 3, e.w / 2, 3, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const step = Math.sin(t * 14 + x) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx, by, e.w / 2, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1A0F08'; ctx.lineWidth = 1.6;
    for (const [lx, d] of [[-5, 1], [0, -1], [5, 1]]) { ctx.beginPath(); ctx.moveTo(cx + lx, by - 5); ctx.lineTo(cx + lx + step * d - 2, by); ctx.stroke(); }
    const shell = ctx.createRadialGradient(cx - 3, by - 13, 1, cx, by - 7, e.w * 0.7);
    shell.addColorStop(0, '#FF8A6A'); shell.addColorStop(0.4, '#C2321E'); shell.addColorStop(1, '#5E140A');
    ctx.fillStyle = shell;
    ctx.beginPath(); ctx.ellipse(cx, by - 6, e.w / 2, e.h / 2 + 1, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, by - 6 - e.h / 2); ctx.lineTo(cx, by - 6); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (const [sx, sy] of [[-4, -10], [4, -9], [-3, -5], [5, -4]]) { ctx.beginPath(); ctx.arc(cx + sx, by + sy, 1.4, 0, Math.PI * 2); ctx.fill(); }
    const hx = cx + (e.vx < 0 ? -e.w / 2 : e.w / 2);
    ctx.fillStyle = '#1A0F08'; ctx.beginPath(); ctx.arc(hx, by - 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + (e.vx < 0 ? -1.5 : 1.5), by - 6, 1.3, 0, Math.PI * 2); ctx.fill();
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2E6FD8'); sky.addColorStop(0.6, '#8EC1FF'); sky.addColorStop(1, '#E8F3FF');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(W - 60, 60, 4, W - 60, 60, 90);
    sun.addColorStop(0, 'rgba(255,250,220,1)'); sun.addColorStop(0.2, 'rgba(255,240,180,0.7)'); sun.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    // nuvens (paralaxe)
    for (let i = -1; i < 4; i++) {
      const base = Math.floor(s.camX * 0.12 / 170) + i;
      const cx = base * 170 - s.camX * 0.12 + 40 + (((base % 3) + 3) % 3) * 25;
      const cy = 46 + ((((base * 37) % 3) + 3) % 3) * 20;
      const g = ctx.createLinearGradient(0, cy - 20, 0, cy + 12);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(225,236,250,0.85)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx + 18, cy, 30, 10, 0, 0, Math.PI * 2); ctx.ellipse(cx + 6, cy - 6, 13, 11, 0, 0, Math.PI * 2); ctx.ellipse(cx + 24, cy - 11, 16, 14, 0, 0, Math.PI * 2); ctx.fill();
    }
    // montanhas em camadas (atmosfera)
    const ridge = (par, y0, amp, freq, c1, c2) => {
      const g = ctx.createLinearGradient(0, y0 - amp, 0, H);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) { const u = (x + s.camX * par) / freq; ctx.lineTo(x, y0 - Math.abs(Math.sin(u)) * amp - Math.sin(u * 2.3) * amp * 0.25); }
      ctx.lineTo(W, H); ctx.fill();
    };
    ridge(0.12, BASE - 70, 60, 90, '#A9C3E8', '#D6E4F5');
    ridge(0.25, BASE - 36, 40, 60, '#6FAF8F', '#9CCFB0');
    // pinheiros
    for (let i = -1; i < 9; i++) {
      const base = Math.floor(s.camX * 0.5 / 50) + i;
      const tx = base * 50 - s.camX * 0.5 + ((((base * 13) % 20) + 20) % 20);
      const th = 40 + ((((base * 7) % 3) + 3) % 3) * 12;
      const g = ctx.createLinearGradient(tx, 0, tx + 24, 0);
      g.addColorStop(0, '#1F6B45'); g.addColorStop(1, '#2E9161');
      ctx.fillStyle = g;
      for (let k = 0; k < 3; k++) { const yy = BASE + 4 - k * th * 0.28; const ww = 13 - k * 3; ctx.beginPath(); ctx.moveTo(tx + 12 - ww, yy); ctx.lineTo(tx + 12, yy - th * 0.5); ctx.lineTo(tx + 12 + ww, yy); ctx.fill(); }
    }

    ctx.save();
    ctx.translate(-Math.round(s.camX), 0);
    // blocos
    s.solids.forEach((r) => {
      if (r.x > s.camX + W || r.x + r.w < s.camX) return;
      if (r.kind === 'ground') {
        const dirt = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
        dirt.addColorStop(0, '#9A6534'); dirt.addColorStop(1, '#5E3A1C');
        ctx.fillStyle = dirt;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let x = r.x + 6; x < r.x + r.w - 4; x += 18) { ctx.beginPath(); ctx.ellipse(x, r.y + 22 + ((x / 18) % 2) * 14, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
        const grass = ctx.createLinearGradient(0, r.y, 0, r.y + 10);
        grass.addColorStop(0, '#7DDB6A'); grass.addColorStop(1, '#2F9A4A');
        ctx.fillStyle = grass;
        ctx.beginPath(); ctx.moveTo(r.x, r.y + 10);
        for (let x = r.x; x <= r.x + r.w; x += 6) ctx.lineTo(x, r.y + ((x / 6) % 2 ? 0 : 3));
        ctx.lineTo(r.x + r.w, r.y + 10); ctx.closePath(); ctx.fill();
      } else {
        for (let x = r.x; x < r.x + r.w; x += T) {
          const wood = ctx.createLinearGradient(x, r.y, x, r.y + T);
          wood.addColorStop(0, '#D99A55'); wood.addColorStop(1, '#9C5F2A');
          ctx.fillStyle = wood;
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 1, r.y + 1, T - 2, T - 2, 4); else ctx.rect(x + 1, r.y + 1, T - 2, T - 2); ctx.fill();
          ctx.strokeStyle = '#6B3E18'; ctx.lineWidth = 2; ctx.stroke();
          ctx.strokeStyle = 'rgba(107,62,24,0.6)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x + 4, r.y + 4); ctx.lineTo(x + T - 4, r.y + T - 4); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 3, r.y + 3, T - 6, 3);
        }
      }
    });
    // moedas douradas girando
    s.coinsList.forEach((c) => {
      if (c.taken) return;
      const k = Math.abs(Math.cos(s.t * 4 + c.x * 0.05));
      const g = ctx.createLinearGradient(c.x - 8, c.y - 8, c.x + 8, c.y + 8);
      g.addColorStop(0, '#FFF2A8'); g.addColorStop(0.5, '#F9C71D'); g.addColorStop(1, '#C98E00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 2 + 6 * k, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#A87400'; ctx.lineWidth = 1.2; ctx.stroke();
      if (k > 0.5) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(c.x - 2 * k, c.y - 3, 1.5 * k, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
    });
    s.enemies.forEach((e) => drawEnemy(ctx, e, s.t));
    const p = s.p;
    if (s.inv <= 0 || Math.floor(s.inv * 12) % 2 === 0) drawScout(ctx, p.x, p.y, p.face, p.walk, !p.onGround);
    ctx.restore();

    // painel de vidro
    ctx.fillStyle = 'rgba(10,22,56,0.45)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(8, 8, 150, 30, 15); else ctx.rect(8, 8, 150, 30);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    drawHearts(ctx, Math.max(0, s.lives), 14, 24, 6);
    const cg = ctx.createLinearGradient(96, 16, 108, 30);
    cg.addColorStop(0, '#FFF2A8'); cg.addColorStop(1, '#C98E00');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(102, 23, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(String(s.coins), 113, 24);
    if (s.msgT > 0) {
      ctx.textAlign = 'center';
      ctx.font = '800 24px system-ui, sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(10,22,56,0.8)';
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
