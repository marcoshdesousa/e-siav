// Boliche: mire (seta que balança) e escolha a força (barra que sobe e desce). 10 jogadas com
// contagem oficial de strike e spare. Os pinos caem com colisões simples entre círculos.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 520;
const LL = 110; // borda esquerda da pista
const LR = 250; // borda direita
const LC = (LL + LR) / 2;
const TOP = 54; // fim da pista (fosso)
const BOARD = 46; // altura do placar
const BALL_R = 13;
const PIN_R = 7;
const BALL_Y0 = 474;
const MAX_ANG = 0.22;
const SUB = 6;
const SP = 38; // espaçamento dos pinos
const HEAD_Y = 188;

// --------- física pura ---------
// @@phys-start
function rack() {
  const pins = [];
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      const x = LC + (i - row / 2) * SP;
      const y = HEAD_Y - row * SP * 0.866;
      pins.push({ x, y, vx: 0, vy: 0, down: false, out: false, ang: 0, spin: 0 });
    }
  }
  return pins;
}

function collide(a, b, ra, rb, ma, mb, e) {
  let nx = b.x - a.x; let ny = b.y - a.y;
  const d = Math.hypot(nx, ny);
  const min = ra + rb;
  if (d >= min || d === 0) return 0;
  nx /= d; ny /= d;
  const over = min - d;
  const tm = ma + mb;
  a.x -= nx * over * (mb / tm); a.y -= ny * over * (mb / tm);
  b.x += nx * over * (ma / tm); b.y += ny * over * (ma / tm);
  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv >= 0) return 0;
  const j = (-(1 + e) * rv) / (1 / ma + 1 / mb);
  a.vx -= (j / ma) * nx; a.vy -= (j / ma) * ny;
  b.vx += (j / mb) * nx; b.vy += (j / mb) * ny;
  return -rv;
}

/** Avança a física; devolve a maior velocidade de impacto (para o som). */
function stepPhysics(ball, pins, dt, rnd) {
  let impact = 0;
  const h = dt / SUB;
  for (let k = 0; k < SUB; k++) {
    if (ball.live) {
      ball.x += ball.vx * h; ball.y += ball.vy * h;
      if (!ball.gutter && (ball.x < LL + 2 || ball.x > LR - 2)) {
        ball.gutter = true;
        ball.x = ball.x < LC ? LL - 12 : LR + 12;
        ball.vx = 0;
      }
      if (ball.y < TOP - 20) ball.live = false;
    }
    for (const p of pins) {
      if (p.out) continue;
      p.x += p.vx * h; p.y += p.vy * h;
      p.ang += p.spin * h;
      const f = Math.max(0, 1 - (p.down ? 2.6 : 4) * h);
      p.vx *= f; p.vy *= f; p.spin *= f;
      if (p.x < LL - 4 || p.x > LR + 4 || p.y < TOP) { p.down = true; p.out = true; }
    }
    if (ball.live && !ball.gutter) {
      for (const p of pins) {
        if (p.out) continue;
        const v = collide(ball, p, BALL_R, PIN_R, 6, 1.5, 0.75);
        if (v > 0) {
          p.vx += (rnd() - 0.5) * v * 0.45;
          p.spin = (rnd() - 0.5) * 30;
          impact = Math.max(impact, v);
        }
      }
    }
    for (let i = 0; i < pins.length; i++) {
      const a = pins[i];
      if (a.out) continue;
      for (let j = i + 1; j < pins.length; j++) {
        const b = pins[j];
        if (b.out) continue;
        const v = collide(a, b, a.down ? PIN_R * 1.7 : PIN_R, b.down ? PIN_R * 1.7 : PIN_R, 1.5, 1.5, 0.85);
        if (v > 0) {
          const tw = (rnd() - 0.5) * v * 0.35;
          a.vx += tw; b.vx -= tw;
          a.spin += (rnd() - 0.5) * 20; b.spin += (rnd() - 0.5) * 20;
          impact = Math.max(impact, v * 0.6);
        }
      }
    }
    for (const p of pins) {
      if (!p.down && Math.hypot(p.vx, p.vy) > 14) p.down = true;
    }
  }
  return impact;
}

function launch(ang, power) {
  const sp = 430 + power * 520;
  return { x: LC, y: BALL_Y0, vx: Math.sin(ang) * sp, vy: -Math.cos(ang) * sp, live: true, gutter: false, rot: 0 };
}
// @@phys-end

// --------- contagem ---------
/** Pontos acumulados por jogada (null se ainda não dá para saber). */
function frameTotals(rolls) {
  const out = [];
  let i = 0; let total = 0;
  for (let f = 0; f < 10; f++) {
    if (i >= rolls.length) { out.push(null); continue; }
    let v = null;
    if (rolls[i] === 10) {
      if (rolls[i + 2] != null) v = 10 + rolls[i + 1] + rolls[i + 2];
      i += 1;
    } else {
      if (rolls[i + 1] != null && rolls[i] + rolls[i + 1] === 10) {
        if (rolls[i + 2] != null) v = 10 + rolls[i + 2];
      } else if (rolls[i + 1] != null) v = rolls[i] + rolls[i + 1];
      i += 2;
    }
    if (v == null) { out.push(null); for (let g = f + 1; g < 10; g++) out.push(null); break; }
    total += v;
    out.push(total);
  }
  return out;
}

/** Placar parcial: quadros fechados + pinos derrubados nos que ainda estão abertos. */
function runningScore(rolls) {
  const t = frameTotals(rolls);
  let last = 0; let used = 0;
  let i = 0;
  for (let f = 0; f < 10 && i < rolls.length; f++) {
    if (t[f] == null) break;
    last = t[f];
    if (f < 9) i += rolls[i] === 10 ? 1 : 2; else i = rolls.length;
    used = i;
  }
  let extra = 0;
  for (let k = used; k < rolls.length; k++) extra += rolls[k];
  return last + extra;
}

/** Símbolos de cada quadro para o placar: [['X'], ['7','/'], ...]. */
function frameMarks(rolls) {
  const marks = [];
  let i = 0;
  for (let f = 0; f < 10 && i < rolls.length; f++) {
    if (f < 9) {
      if (rolls[i] === 10) { marks.push(['', 'X']); i += 1; continue; }
      const a = rolls[i]; const b = rolls[i + 1];
      marks.push([a === 0 ? '-' : String(a), b == null ? '' : a + b === 10 ? '/' : b === 0 ? '-' : String(b)]);
      i += 2;
    } else {
      const r = rolls.slice(i, i + 3);
      const m = [];
      r.forEach((v, k) => {
        const prev = r[k - 1];
        const fresh = k === 0 || prev === 10 || (k === 2 && r[0] !== 10 && r[0] + r[1] === 10) || (k === 2 && r[0] === 10 && r[1] === 10);
        if (v === 10 && fresh) m.push('X');
        else if (!fresh && prev + v === 10) m.push('/');
        else m.push(v === 0 ? '-' : String(v));
      });
      marks.push(m);
      i += 3;
    }
  }
  return marks;
}

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'pointer' };

function newState() {
  return {
    phase: 'aim', // aim | power | roll | result | over
    pins: rack(), ball: { x: LC, y: BALL_Y0, vx: 0, vy: 0, live: false, gutter: false, rot: 0 },
    rolls: [], frame: 0, inFrame: 0, standingBefore: 10,
    ang: 0, power: 0, t: 0, osc: 0, settle: 0, rollT: 0,
    msg: null, resT: 0, overT: 0, reported: -1, lastSnd: 0,
  };
}

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  const act = () => {
    const s = st.current;
    if (s.phase === 'aim') { s.phase = 'power'; s.osc = 0; sfx('tap'); return; }
    if (s.phase === 'power') {
      s.ball = launch(s.ang, s.power);
      s.phase = 'roll'; s.settle = 0; s.rollT = 0;
      sfx('jump');
    }
  };

  useKeys((k, down) => { if (down && k === 'action') act(); });

  const standing = (s) => s.pins.filter((p) => !p.down).length;

  const finishRoll = (s) => {
    const left = standing(s);
    const knocked = s.standingBefore - left;
    s.rolls.push(knocked);
    const f = s.frame;
    const fullRack = s.standingBefore === 10;
    let text; let color = COLORS.yellow;
    if (knocked === 10 && fullRack) { text = 'STRIKE!'; sfx('win'); }
    else if (left === 0) { text = 'SPARE!'; sfx('coin'); }
    else if (knocked === 0) { text = s.ball.gutter ? 'Canaleta!' : 'Nenhum pino'; color = COLORS.sky; sfx('error'); }
    else { text = knocked + (knocked === 1 ? ' pino' : ' pinos'); color = COLORS.white; sfx('point'); }
    s.msg = { text, color };
    // próximo estado
    let reset = false; let nextFrame = false; let over = false;
    if (f < 9) {
      if (s.inFrame === 0 && left === 0) nextFrame = true;
      else if (s.inFrame === 0) s.inFrame = 1;
      else nextFrame = true;
    } else {
      const r = s.rolls.slice(s.rolls.length - s.inFrame - 1);
      if (s.inFrame === 0) { s.inFrame = 1; if (left === 0) reset = true; }
      else if (s.inFrame === 1) {
        if (r[0] === 10 || r[0] + r[1] === 10) { s.inFrame = 2; if (left === 0) reset = true; }
        else over = true;
      } else over = true;
    }
    if (nextFrame) { s.frame += 1; s.inFrame = 0; reset = true; }
    s.pending = { reset, over };
    s.phase = 'result'; s.resT = 0;
  };

  const afterResult = (s) => {
    const { reset, over } = s.pending;
    s.msg = null;
    if (over) { s.phase = 'over'; s.overT = 0; return; }
    if (reset) s.pins = rack();
    else s.pins = s.pins.filter((p) => !p.down).map((p) => ({ ...p, vx: 0, vy: 0, spin: 0 }));
    s.standingBefore = standing(s);
    s.ball = { x: LC, y: BALL_Y0, vx: 0, vy: 0, live: false, gutter: false, rot: 0 };
    s.phase = 'aim'; s.osc = Math.random() * 6;
  };

  const update = (s, dt) => {
    s.t += dt;
    if (s.phase === 'aim') {
      s.osc += dt * (1.9 + s.frame * 0.12);
      s.ang = Math.sin(s.osc) * MAX_ANG;
    } else if (s.phase === 'power') {
      s.osc += dt * (2.4 + s.frame * 0.12);
      s.power = (1 - Math.cos(s.osc)) / 2;
    } else if (s.phase === 'roll') {
      s.rollT += dt;
      const b = s.ball;
      const imp = stepPhysics(b, s.pins, dt, Math.random);
      b.rot += dt * Math.hypot(b.vx, b.vy) * 0.05;
      if (imp > 60 && s.t - s.lastSnd > 0.08) { sfx(imp > 250 ? 'hit' : 'tap'); s.lastSnd = s.t; }
      const moving = s.pins.some((p) => !p.out && Math.hypot(p.vx, p.vy) > 8);
      if (!b.live) s.settle += dt;
      if ((s.settle > 0.6 && !moving) || s.settle > 2.2 || s.rollT > 6) finishRoll(s);
    } else if (s.phase === 'result') {
      s.resT += dt;
      if (s.resT > 1.1) afterResult(s);
    } else if (s.phase === 'over') {
      s.overT += dt;
      if (s.overT > 1.3 && !ended.current) {
        ended.current = true;
        setRunning(false);
        onEnd?.(Math.max(0, frameTotals(s.rolls)[9] ?? runningScore(s.rolls)));
      }
    }
    const sc = runningScore(s.rolls);
    if (sc !== s.reported) { s.reported = sc; onScore?.(sc); }
  };

  const drawBoard = (ctx, s) => {
    const marks = frameMarks(s.rolls);
    const totals = frameTotals(s.rolls);
    const fw = 33; const lw = W - 8 - fw * 9;
    ctx.fillStyle = '#0B1430'; ctx.fillRect(0, 0, W, BOARD);
    for (let f = 0; f < 10; f++) {
      const x = 4 + f * fw; const w = f === 9 ? lw : fw;
      const cur = f === s.frame && s.phase !== 'over';
      ctx.fillStyle = cur ? 'rgba(249,199,29,0.18)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 1, 4, w - 2, BOARD - 8);
      ctx.strokeStyle = cur ? COLORS.yellow : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, 4.5, w - 3, BOARD - 9);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '8px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(String(f + 1), x + 4, 6);
      const m = marks[f] || [];
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cells = f === 9 ? 3 : 2;
      for (let k = 0; k < cells; k++) {
        const v = m[k];
        if (!v) continue;
        ctx.fillStyle = v === 'X' ? COLORS.red : v === '/' ? COLORS.yellow : COLORS.white;
        const cx = f === 9 ? x + w - 8 - (cells - 1 - k) * 11 : x + w - 8 - (cells - 1 - k) * 11;
        ctx.fillText(v, cx, 13);
      }
      if (totals[f] != null) {
        ctx.fillStyle = COLORS.white; ctx.font = 'bold 12px sans-serif';
        ctx.fillText(String(totals[f]), x + w / 2, 31);
      }
    }
  };

  const drawPin = (ctx, p) => {
    if (p.out) return;
    if (p.down) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(0, 0, PIN_R * 1.9, PIN_R * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.red; ctx.fillRect(-2, -PIN_R * 0.75, 3, PIN_R * 1.5);
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(p.x + 2, p.y + 2, PIN_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.beginPath(); ctx.arc(p.x, p.y, PIN_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.red; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, PIN_R - 2.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#E8E8E8';
    ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 2, 0, Math.PI * 2); ctx.fill();
  };

  const draw = (s) => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#121C3E'; ctx.fillRect(0, 0, W, H);
    // laterais
    ctx.fillStyle = '#1B2E66'; ctx.fillRect(0, BOARD, LL - 24, H);
    ctx.fillRect(LR + 24, BOARD, W - LR - 24, H);
    // canaletas
    ctx.fillStyle = '#3A4256'; ctx.fillRect(LL - 24, BOARD, 24, H); ctx.fillRect(LR, BOARD, 24, H);
    ctx.fillStyle = '#2A3142'; ctx.fillRect(LL - 18, BOARD, 12, H); ctx.fillRect(LR + 6, BOARD, 12, H);
    // pista de madeira
    const g = ctx.createLinearGradient(0, TOP, 0, H);
    g.addColorStop(0, '#C98E52'); g.addColorStop(1, '#E2B47A');
    ctx.fillStyle = g; ctx.fillRect(LL, TOP, LR - LL, H - TOP);
    ctx.strokeStyle = 'rgba(120,70,30,0.25)'; ctx.lineWidth = 1;
    for (let x = LL + 7; x < LR; x += 7) { ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x, H); ctx.stroke(); }
    // fosso
    ctx.fillStyle = '#0B1430'; ctx.fillRect(LL - 24, BOARD, LR - LL + 48, TOP - BOARD);
    // setas guias e linha de falta
    ctx.fillStyle = 'rgba(14,42,107,0.55)';
    for (let i = -3; i <= 3; i++) {
      const x = LC + i * 17; const y = 330 + Math.abs(i) * 10;
      ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x - 4, y + 3); ctx.lineTo(x + 4, y + 3); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = COLORS.red; ctx.fillRect(LL, 500, LR - LL, 3);
    // marcas dos pinos
    ctx.fillStyle = 'rgba(120,70,30,0.35)';
    rack().forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill(); });
    s.pins.filter((p) => p.down).forEach((p) => drawPin(ctx, p));
    s.pins.filter((p) => !p.down).forEach((p) => drawPin(ctx, p));
    // bola
    const b = s.ball;
    if (b.live || s.phase === 'aim' || s.phase === 'power') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(b.x + 3, b.y + 3, BALL_R, 0, Math.PI * 2); ctx.fill();
      const bg = ctx.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, BALL_R);
      bg.addColorStop(0, '#5C86E0'); bg.addColorStop(1, COLORS.navy);
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#081030';
      const ra = b.rot;
      [[0, -5], [-3, 0], [3, 0]].forEach(([dx, dy]) => {
        const c = Math.cos(ra * 0.3); const sn = Math.sin(ra * 0.3);
        ctx.beginPath(); ctx.arc(b.x + dx * c - dy * sn, b.y + dx * sn + dy * c, 1.8, 0, Math.PI * 2); ctx.fill();
      });
    }
    // seta de mira
    if (s.phase === 'aim' || s.phase === 'power') {
      const len = 120;
      const ex = b.x + Math.sin(s.ang) * len; const ey = b.y - Math.cos(s.ang) * len;
      ctx.strokeStyle = s.phase === 'aim' ? COLORS.yellow : 'rgba(249,199,29,0.6)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x + Math.sin(s.ang) * 20, b.y - Math.cos(s.ang) * 20); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(s.ang);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-8, 2); ctx.lineTo(8, 2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // barra de força
    const bx = LR + 46; const by = 300; const bh = 180;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx - 4, by - 4, 30, bh + 8);
    const pg = ctx.createLinearGradient(0, by + bh, 0, by);
    pg.addColorStop(0, COLORS.green); pg.addColorStop(0.6, COLORS.yellow); pg.addColorStop(1, COLORS.red);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(bx, by, 22, bh);
    if (s.phase === 'power' || s.phase === 'roll' || s.phase === 'result') {
      const ph = bh * s.power;
      ctx.fillStyle = pg; ctx.fillRect(bx, by + bh - ph, 22, ph);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FORÇA', bx + 11, by + bh + 16);
    // info lateral
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.sky; ctx.font = 'bold 12px sans-serif';
    ctx.fillText('JOGADA', 48, 300);
    ctx.fillStyle = COLORS.white; ctx.font = 'bold 26px sans-serif';
    ctx.fillText(String(Math.min(10, s.frame + 1)), 48, 326);
    ctx.fillStyle = COLORS.sky; ctx.font = 'bold 12px sans-serif';
    ctx.fillText('BOLA', 48, 362);
    ctx.fillStyle = COLORS.white; ctx.font = 'bold 22px sans-serif';
    ctx.fillText(String(s.inFrame + 1), 48, 384);
    ctx.fillStyle = COLORS.sky; ctx.font = 'bold 12px sans-serif';
    ctx.fillText('PONTOS', 48, 420);
    ctx.fillStyle = COLORS.yellow; ctx.font = 'bold 22px sans-serif';
    ctx.fillText(String(runningScore(s.rolls)), 48, 442);
    // instrução
    if (s.phase === 'aim' || s.phase === 'power') {
      ctx.fillStyle = COLORS.white; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(s.phase === 'aim' ? 'Toque para mirar' : 'Toque para a força', LC, 513);
    }
    drawBoard(ctx, s);
    if (s.msg) {
      const sc = 1 + Math.max(0, 0.25 - s.resT) * 2;
      ctx.save(); ctx.translate(LC, 250); ctx.scale(sc, sc);
      ctx.font = 'bold 32px sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(11,20,48,0.85)';
      ctx.strokeText(s.msg.text, 0, 0); ctx.fillStyle = s.msg.color; ctx.fillText(s.msg.text, 0, 0);
      ctx.restore();
    }
    if (s.phase === 'over') {
      ctx.fillStyle = `rgba(11,20,48,${Math.min(0.75, s.overT)})`; ctx.fillRect(0, BOARD, W, H - BOARD);
      ctx.textAlign = 'center'; ctx.fillStyle = COLORS.yellow; ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Fim de jogo!', W / 2, H / 2 - 10);
      ctx.fillStyle = COLORS.white; ctx.font = 'bold 22px sans-serif';
      ctx.fillText(clamp(runningScore(s.rolls), 0, 300) + ' pontos', W / 2, H / 2 + 28);
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
      aria-label="Boliche"
      onPointerDown={(e) => { e.preventDefault(); act(); }}
    />
  );
}
