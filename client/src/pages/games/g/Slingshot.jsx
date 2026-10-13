// Estilingue: puxe a pedra, solte e derrube as latas. 3 pedras por fase; pedras que sobram
// viram bônus. A física é simplificada: caixas alinhadas, gravidade, empurrões e quedas.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, pointerPos, useCanvas, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 440;
const GROUND = 410;
const AX = 62; // forquilha
const AY = 318;
const MAX_PULL = 72;
const POWER = 12.5;
const GRAV = 900;
const SR = 8; // raio da pedra
const STONES = 3;
const SUB = 8;
const CAN = { hw: 9, hh: 13, m: 1 };
const CRATE = { hw: 16, hh: 16, m: 3 };
const CAN_PTS = 10;
const STONE_BONUS = 25;

// ---------- montagem das fases ----------
function body(kind, cx, bottom) {
  const d = kind === 'c' ? CAN : CRATE;
  const cy = bottom - d.hh;
  return { kind: kind === 'c' ? 'can' : 'crate', cx, cy, hw: d.hw, hh: d.hh, m: d.m, vx: 0, vy: 0, x0: cx, y0: cy, asleep: true, still: 0, knocked: false, gone: false, tilt: 0, hue: Math.floor(Math.random() * 3) };
}
// Coluna: itens de baixo para cima ('c' lata, 'B' caixa).
function col(cx, base, items) {
  const out = []; let y = base;
  for (const k of items) { const b = body(k, cx, y); out.push(b); y -= b.hh * 2; }
  return out;
}
// Pirâmide de latas com n na base.
function pyr(cx, base, n) {
  const out = [];
  for (let row = 0; row < n; row++) {
    const count = n - row;
    for (let i = 0; i < count; i++) {
      out.push(body('c', cx + (i - (count - 1) / 2) * (CAN.hw * 2 + 1), base - row * CAN.hh * 2));
    }
  }
  return out;
}
// Mesa: tampo + pilar (estáticos). Devolve [retângulos, altura do tampo].
function table(x0, x1, top, pillarW = 16) {
  const mid = (x0 + x1) / 2;
  return [{ x: x0, y: top, w: x1 - x0, h: 10 }, { x: mid - pillarW / 2, y: top + 10, w: pillarW, h: GROUND - top - 10, pillar: true }];
}

const LEVELS = [
  () => ({ statics: [], bodies: pyr(272, GROUND, 2) }),
  () => ({ statics: [], bodies: [...col(256, GROUND, 'B'), ...col(289, GROUND, 'B'), ...pyr(272, GROUND - 32, 2), ...col(330, GROUND, 'c')] }),
  () => ({ statics: table(230, 300, 322), bodies: [...pyr(265, 322, 2), ...col(330, GROUND, 'cc')] }),
  () => ({ statics: [], bodies: [...pyr(285, GROUND, 3), ...col(215, GROUND, 'B')] }),
  () => ({ statics: table(196, 256, 300), bodies: [...col(226, 300, 'ccc'), ...col(312, GROUND, 'BBc'), ...col(340, GROUND, 'c')] }),
  () => ({ statics: [], bodies: [...col(300, GROUND, 'BcBcc'), ...col(236, GROUND, 'cc'), ...col(336, GROUND, 'c')] }),
  () => ({ statics: [], bodies: [...col(212, GROUND, 'BBB'), ...pyr(294, GROUND, 3)] }),
  () => ({ statics: table(262, 342, 262), bodies: [...pyr(302, 262, 3), ...col(222, GROUND, 'cBc')] }),
  () => ({ statics: [...table(200, 250, 330), ...table(290, 345, 250)], bodies: [...col(225, 330, 'Bcc'), ...pyr(317, 250, 2), ...col(270, GROUND, 'BB')] }),
];

// ---------- física ----------
const top = (b) => b.cy - b.hh;
const bottom = (b) => b.cy + b.hh;
const left = (b) => b.cx - b.hw;
const right = (b) => b.cx + b.hw;

function supported(b, s) {
  const bt = bottom(b);
  if (bt >= GROUND - 1.5) return true;
  for (const r of s.statics) if (Math.abs(r.y - bt) < 2 && b.cx >= r.x - 1 && b.cx <= r.x + r.w + 1) return true;
  for (const o of s.bodies) {
    if (o === b || o.gone) continue;
    if (Math.abs(top(o) - bt) < 2 && b.cx >= left(o) - 1 && b.cx <= right(o) + 1) return true;
  }
  return false;
}

function wake(b) { if (b.asleep) { b.asleep = false; b.still = 0; } }

// Resolve sobreposição de caixa com retângulo estático.
function vsStatic(b, r, h) {
  const ox = Math.min(right(b), r.x + r.w) - Math.max(left(b), r.x);
  const oy = Math.min(bottom(b), r.y + r.h) - Math.max(top(b), r.y);
  if (ox <= 0 || oy <= 0) return;
  if (oy < ox) {
    if (b.cy < r.y + r.h / 2) {
      b.cy -= oy;
      if (b.vy > 0) b.vy = -b.vy * 0.15;
      // centro fora do apoio: escorrega e cai
      if (b.cx < r.x || b.cx > r.x + r.w) b.vx += (b.cx < r.x ? -1 : 1) * 260 * h;
      else b.vx *= Math.max(0, 1 - 10 * h);
    } else { b.cy += oy; if (b.vy < 0) b.vy = 0; }
  } else {
    b.cx += b.cx < r.x + r.w / 2 ? -ox : ox;
    b.vx = -b.vx * 0.2;
  }
}

function vsBody(a, b, h) {
  const ox = Math.min(right(a), right(b)) - Math.max(left(a), left(b));
  const oy = Math.min(bottom(a), bottom(b)) - Math.max(top(a), top(b));
  if (ox <= 0 || oy <= 0) return;
  const rel = Math.hypot(a.vx - b.vx, a.vy - b.vy);
  if (a.asleep && rel > 140) wake(a);
  if (b.asleep && rel > 140) wake(b);
  const ma = a.asleep ? 1e6 : a.m; const mb = b.asleep ? 1e6 : b.m;
  const ta = mb / (ma + mb); const tb = ma / (ma + mb);
  if (oy < ox) {
    const aAbove = a.cy < b.cy;
    const up = aAbove ? a : b; const dn = aAbove ? b : a;
    const tu = aAbove ? ta : tb; const td = aAbove ? tb : ta;
    up.cy -= oy * tu; dn.cy += oy * td;
    const mu = aAbove ? ma : mb; const md = aAbove ? mb : ma;
    const rv = up.vy - dn.vy;
    if (rv > 0) {
      const v = (mu * up.vy + md * dn.vy) / (mu + md);
      if (!up.asleep) up.vy = v; if (!dn.asleep) dn.vy = v;
    }
    if (!up.asleep) {
      if (up.cx < left(dn) || up.cx > right(dn)) up.vx += (up.cx < dn.cx ? -1 : 1) * 260 * h;
      else up.vx += (dn.vx - up.vx) * Math.min(1, 10 * h);
    }
  } else {
    const aLeft = a.cx < b.cx;
    const sgn = aLeft ? -1 : 1;
    a.cx += sgn * ox * ta; b.cx -= sgn * ox * tb;
    const rv = (a.vx - b.vx) * -sgn;
    if (rv > 0) {
      const e = 0.25;
      const j = ((1 + e) * rv) / (1 / ma + 1 / mb);
      if (!a.asleep) a.vx += sgn * j / ma; if (!b.asleep) b.vx -= sgn * j / mb;
    }
  }
}

// Pedra (círculo) contra caixa. Devolve velocidade do impacto.
function stoneVsBody(st, b) {
  const px = clamp(st.x, left(b), right(b)); const py = clamp(st.y, top(b), bottom(b));
  let nx = st.x - px; let ny = st.y - py;
  let d = Math.hypot(nx, ny);
  if (d >= SR) return 0;
  if (d === 0) { nx = st.x < b.cx ? -1 : 1; ny = 0; d = 0; } else { nx /= d; ny /= d; }
  const over = SR - d;
  wake(b);
  const ms = 4;
  st.x += nx * over * (b.m / (ms + b.m)); st.y += ny * over * (b.m / (ms + b.m));
  b.cx -= nx * over * (ms / (ms + b.m)); b.cy -= ny * over * (ms / (ms + b.m));
  const rv = (st.vx - b.vx) * nx + (st.vy - b.vy) * ny;
  if (rv >= 0) return 0;
  const e = 0.35;
  const j = (-(1 + e) * rv) / (1 / ms + 1 / b.m);
  st.vx += (j / ms) * nx; st.vy += (j / ms) * ny;
  b.vx -= (j / b.m) * nx; b.vy -= (j / b.m) * ny;
  return -rv;
}

function stoneVsStatic(st, r) {
  const px = clamp(st.x, r.x, r.x + r.w); const py = clamp(st.y, r.y, r.y + r.h);
  let nx = st.x - px; let ny = st.y - py;
  const d = Math.hypot(nx, ny);
  if (d >= SR || d === 0) return 0;
  nx /= d; ny /= d;
  st.x = px + nx * SR; st.y = py + ny * SR;
  const vn = st.vx * nx + st.vy * ny;
  if (vn >= 0) return 0;
  st.vx -= 1.4 * vn * nx; st.vy -= 1.4 * vn * ny;
  st.vx *= 0.8;
  return -vn;
}

function step(s, dt) {
  const h = dt / SUB;
  let impact = 0;
  for (let k = 0; k < SUB; k++) {
    const stn = s.stone;
    if (stn && stn.live) {
      stn.vy += GRAV * h;
      stn.x += stn.vx * h; stn.y += stn.vy * h;
      if (stn.y > GROUND - SR) {
        stn.y = GROUND - SR;
        if (stn.vy > 0) { if (stn.vy > 120) impact = Math.max(impact, stn.vy * 0.3); stn.vy = -stn.vy * 0.3; }
        stn.vx *= Math.max(0, 1 - 6 * h);
      }
      for (const r of s.statics) impact = Math.max(impact, stoneVsStatic(stn, r) * 0.5);
      for (const b of s.bodies) if (!b.gone) impact = Math.max(impact, stoneVsBody(stn, b));
    }
    for (const b of s.bodies) {
      if (b.gone || b.asleep) continue;
      b.vy += GRAV * h;
      b.cx += b.vx * h; b.cy += b.vy * h;
      if (bottom(b) > GROUND) {
        b.cy = GROUND - b.hh;
        if (b.vy > 0) b.vy = -b.vy * 0.15;
        b.vx *= Math.max(0, 1 - 10 * h);
      }
      for (const r of s.statics) vsStatic(b, r, h);
    }
    for (let i = 0; i < s.bodies.length; i++) {
      const a = s.bodies[i];
      if (a.gone) continue;
      for (let j = i + 1; j < s.bodies.length; j++) {
        const b = s.bodies[j];
        if (b.gone || (a.asleep && b.asleep)) continue;
        vsBody(a, b, h);
      }
    }
  }
  for (const b of s.bodies) {
    if (b.gone) continue;
    if (b.cx < -40 || b.cx > W + 40 || b.cy > H + 40) { b.gone = true; continue; }
    if (b.asleep) {
      if (!supported(b, s)) wake(b);
      continue;
    }
    const sp = Math.hypot(b.vx, b.vy);
    b.tilt += (clamp(b.vx * 0.004, -0.6, 0.6) * (b.knocked ? 1.6 : 0.4) - b.tilt) * Math.min(1, dt * 8);
    if (sp < 10 && supported(b, s)) {
      b.still += dt;
      if (b.still > 0.3) { b.asleep = true; b.vx = 0; b.vy = 0; }
    } else b.still = 0;
  }
  return impact;
}

// ---------- jogo ----------
function loadLevel(s, idx) {
  const L = LEVELS[idx]();
  s.level = idx;
  s.statics = L.statics;
  s.bodies = L.bodies;
  s.stones = STONES;
  s.stone = null;
  s.phase = 'ready';
  s.turnT = 0;
}

function newState() {
  const s = { score: 0, reported: -1, t: 0, popups: [], msg: null, msgT: 0, drag: null, overT: 0, lastSnd: 0, cleared: 0 };
  loadLevel(s, 0);
  return s;
}

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'grab' };

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  const pullOf = (d) => {
    let dx = d.x - d.sx; let dy = d.y - d.sy;
    const m = Math.hypot(dx, dy);
    if (m > MAX_PULL) { dx *= MAX_PULL / m; dy *= MAX_PULL / m; }
    return { dx, dy, m: Math.min(m, MAX_PULL) };
  };

  const down = (e) => {
    const s = st.current;
    if (s.phase !== 'ready' || s.stones <= 0) return;
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
    if (!d || s.phase !== 'ready') return;
    const { dx, dy, m } = pullOf(d);
    if (m < 12) return;
    s.stone = { x: AX + dx, y: AY + dy, vx: -dx * POWER, vy: -dy * POWER, live: true, rest: 0 };
    s.stones -= 1;
    s.phase = 'fly'; s.turnT = 0;
    sfx('shoot');
  };

  const popup = (s, text, x, y, color = COLORS.yellow) => s.popups.push({ text, x, y, color, t: 1 });

  const update = (s, dt) => {
    s.t += dt;
    s.popups.forEach((p) => { p.t -= dt; });
    s.popups = s.popups.filter((p) => p.t > 0);
    if (s.msg) { s.msgT += dt; }
    if (s.phase === 'over') {
      s.overT += dt;
      if (s.overT > 1.4 && !ended.current) {
        ended.current = true;
        setRunning(false);
        onEnd?.(s.score);
      }
      return;
    }
    const imp = step(s, dt);
    if (imp > 80 && s.t - s.lastSnd > 0.09) { sfx('hit'); s.lastSnd = s.t; }
    // latas derrubadas
    for (const b of s.bodies) {
      if (b.knocked || b.kind !== 'can') continue;
      const moved = Math.abs(b.cx - b.x0) > b.hw * 1.6 || b.cy - b.y0 > b.hh * 1.2 || b.gone;
      if (moved) {
        b.knocked = true;
        s.score += CAN_PTS;
        popup(s, '+' + CAN_PTS, clamp(b.cx, 30, W - 30), Math.min(b.cy, GROUND - 20) - 14);
        sfx('pop');
      }
    }
    if (s.phase === 'fly') {
      s.turnT += dt;
      const stn = s.stone;
      if (stn.live) {
        if (stn.x > W + 30 || stn.x < -30 || stn.y > H + 30) stn.live = false;
        else if (Math.hypot(stn.vx, stn.vy) < 25 && stn.y >= GROUND - SR - 1) { stn.rest += dt; if (stn.rest > 0.25) stn.live = false; } else stn.rest = 0;
      }
      const busy = s.bodies.some((b) => !b.gone && !b.asleep);
      if ((!stn.live && !busy && s.turnT > 0.6) || s.turnT > 6) {
        const remaining = s.bodies.filter((b) => b.kind === 'can' && !b.knocked).length;
        if (remaining === 0) {
          const bonus = s.stones * STONE_BONUS;
          s.score += bonus;
          s.cleared += 1;
          s.msg = { text: 'Fase concluída!', sub: bonus ? 'Bônus +' + bonus + ' (' + s.stones + (s.stones === 1 ? ' pedra)' : ' pedras)') : '', color: COLORS.yellow };
          s.msgT = 0;
          s.phase = 'clear';
          sfx('win');
        } else if (s.stones <= 0) {
          s.msg = { text: 'Acabaram as pedras!', sub: remaining + (remaining === 1 ? ' lata ficou de pé' : ' latas ficaram de pé'), color: COLORS.red };
          s.msgT = 0;
          s.phase = 'over'; s.overT = 0;
          sfx('lose');
        } else {
          s.stone = null;
          s.phase = 'ready';
        }
      }
    } else if (s.phase === 'clear') {
      if (s.msgT > 1.5) {
        s.msg = null;
        if (s.level + 1 >= LEVELS.length) {
          s.msg = { text: 'Você venceu todas as fases!', sub: '', color: COLORS.yellow }; s.msgT = 0;
          s.phase = 'over'; s.overT = 0;
        } else loadLevel(s, s.level + 1);
      }
    }
    if (s.score !== s.reported) { s.reported = s.score; onScore?.(s.score); }
  };

  const drawBody = (ctx, b) => {
    ctx.save(); ctx.translate(b.cx, b.cy); ctx.rotate(b.tilt);
    if (b.kind === 'can') {
      const cols = [COLORS.red, COLORS.green, COLORS.blue][b.hue];
      ctx.fillStyle = '#C9CED8';
      ctx.fillRect(-b.hw, -b.hh, b.hw * 2, b.hh * 2);
      ctx.fillStyle = cols;
      ctx.fillRect(-b.hw, -b.hh + 4, b.hw * 2, b.hh * 2 - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-b.hw + 3, -b.hh + 4, 3, b.hh * 2 - 8);
      ctx.fillStyle = COLORS.yellow;
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(-b.hw + 0.5, -b.hh + 0.5, b.hw * 2 - 1, b.hh * 2 - 1);
    } else {
      ctx.fillStyle = '#B57A3C';
      ctx.fillRect(-b.hw, -b.hh, b.hw * 2, b.hh * 2);
      ctx.strokeStyle = '#7A4E25'; ctx.lineWidth = 2.5;
      ctx.strokeRect(-b.hw + 1.5, -b.hh + 1.5, b.hw * 2 - 3, b.hh * 2 - 3);
      ctx.beginPath(); ctx.moveTo(-b.hw + 3, -b.hh + 3); ctx.lineTo(b.hw - 3, b.hh - 3); ctx.stroke();
    }
    ctx.restore();
  };

  const draw = (s) => {
    const ctx = getCtx();
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, '#0B1430'); g.addColorStop(1, '#2B54B0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // estrelas e lua
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 24; i++) ctx.fillRect((i * 71) % W, 40 + ((i * 37) % 140), 1.5, 1.5);
    ctx.fillStyle = 'rgba(249,199,29,0.85)';
    ctx.beginPath(); ctx.arc(300, 80, 16, 0, Math.PI * 2); ctx.fill();
    // morros
    ctx.fillStyle = '#123A2C';
    ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 15) ctx.lineTo(x, GROUND - 50 - Math.sin(x / 40) * 16);
    ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.green; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#1E9A64'; ctx.fillRect(0, GROUND, W, 3);
    // estáticos
    s.statics.forEach((r) => {
      ctx.fillStyle = r.pillar ? '#5B6478' : '#7A4E25';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(r.x, r.y, r.w, 2);
    });
    s.bodies.forEach((b) => { if (!b.gone) drawBody(ctx, b); });
    // estilingue (trás)
    ctx.strokeStyle = '#6B3F1C'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(AX, GROUND); ctx.lineTo(AX, AY + 40); ctx.lineTo(AX - 12, AY); ctx.moveTo(AX, AY + 40); ctx.lineTo(AX + 12, AY); ctx.stroke();
    let px = AX; let py = AY;
    const pulling = s.drag && s.phase === 'ready';
    if (pulling) { const p = pullOf(s.drag); px = AX + p.dx; py = AY + p.dy; }
    ctx.strokeStyle = '#3A2410'; ctx.lineWidth = 3;
    if (s.phase === 'ready') {
      ctx.beginPath(); ctx.moveTo(AX - 12, AY); ctx.lineTo(px, py); ctx.lineTo(AX + 12, AY); ctx.stroke();
      if (s.stones > 0) {
        ctx.fillStyle = '#9AA3B5';
        ctx.beginPath(); ctx.arc(px, py, SR, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.beginPath(); ctx.moveTo(AX - 12, AY); ctx.lineTo(AX + 12, AY); ctx.stroke();
    }
    // mira curta
    if (pulling) {
      const p = pullOf(s.drag);
      if (p.m >= 12) {
        const vx = -p.dx * POWER; const vy = -p.dy * POWER;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 1; i <= 7; i++) {
          const t = i * 0.04;
          ctx.beginPath(); ctx.arc(px + vx * t, py + vy * t + 0.5 * GRAV * t * t, 3 - i * 0.25, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // pedra voando
    if (s.stone && s.phase !== 'ready') {
      ctx.fillStyle = '#9AA3B5';
      ctx.beginPath(); ctx.arc(s.stone.x, s.stone.y, SR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(s.stone.x - 2, s.stone.y - 2, 3, 0, Math.PI * 2); ctx.fill();
    }
    // popups
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 16px sans-serif';
    s.popups.forEach((p) => {
      ctx.globalAlpha = clamp(p.t * 1.5, 0, 1);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - (1 - p.t) * 24);
    });
    ctx.globalAlpha = 1;
    // placar
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, 32);
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.white; ctx.fillText('Pontos: ' + s.score, 10, 16);
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.sky; ctx.fillText('Fase ' + (s.level + 1) + '/' + LEVELS.length, W / 2 + 10, 16);
    for (let i = 0; i < STONES; i++) {
      ctx.fillStyle = i < s.stones ? '#C9CED8' : 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(W - 16 - i * 20, 16, 6.5, 0, Math.PI * 2); ctx.fill();
    }
    if (s.phase === 'ready' && s.level === 0 && s.stones === STONES && !s.drag) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '600 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Arraste para trás e solte', 150, 200);
    }
    if (s.msg) {
      const a = s.phase === 'over' ? Math.min(0.72, s.overT) : 0.55;
      ctx.fillStyle = `rgba(11,20,48,${a})`; ctx.fillRect(0, 32, W, H - 32);
      ctx.textAlign = 'center'; ctx.fillStyle = s.msg.color; ctx.font = 'bold 26px sans-serif';
      ctx.fillText(s.msg.text, W / 2, H / 2 - 30);
      ctx.fillStyle = COLORS.white; ctx.font = 'bold 16px sans-serif';
      if (s.msg.sub) ctx.fillText(s.msg.sub, W / 2, H / 2);
      if (s.phase === 'over') { ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = COLORS.yellow; ctx.fillText(s.score + ' pontos', W / 2, H / 2 + 34); }
    }
  };

  useRaf((dt) => {
    const s = st.current;
    update(s, dt);
    draw(s);
  }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Estilingue"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { st.current.drag = null; }}
    />
  );
}
