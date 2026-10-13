// Pênalti: escolha o ponto do gol e chute. O goleiro tenta adivinhar; cantos valem mais. 3 erros acabam.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, pointerPos, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 480;
const GL = 50; // trave esquerda
const GR = 310; // trave direita
const GT = 100; // travessão
const GB = 220; // linha do gol
const GCX = (GL + GR) / 2;
const KEEP_Y = 176; // centro do goleiro
const BALL_X = 180;
const BALL_Y = 420;
const FLIGHT = 0.62;
const MAX_MISS = 3;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'crosshair' };

const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

function newState() {
  return {
    phase: 'aim', // aim | flight | result | over
    aim: { x: GCX, y: (GT + GB) / 2 }, aiming: false,
    score: 0, reported: -1, misses: 0, shots: 0, goals: 0, streak: 0,
    hist: [], // lados escolhidos (-1, 0, 1)
    ball: { x: BALL_X, y: BALL_Y, r: 14, t: 0, sx: BALL_X, sy: BALL_Y, tx: 0, ty: 0, vx: 0, vy: 0, out: false },
    keeper: { x: GCX, y: KEEP_Y, hx: GCX, hy: KEEP_Y - 40, guess: null, delay: 0, dive: 0, sway: 0 },
    msg: null, resT: 0, overT: 0, t: 0, net: 0,
  };
}

const level = (s) => Math.floor(s.shots / 3);

// Pontos pela região do gol: centro 1, lados 2, ângulo (alto e no canto) 3.
function zonePoints(x, y) {
  const fx = Math.abs(x - GCX) / ((GR - GL) / 2);
  const fy = (GB - y) / (GB - GT);
  if (fx > 0.62 && fy > 0.6) return 3;
  if (fx > 0.62 || (fx > 0.3 && fy > 0.6)) return 2;
  return 1;
}

// Distância de um ponto a um segmento.
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// Direção do corpo (pés -> mãos) e centro do desenho do goleiro.
function keeperGeom(k) {
  let ux = k.hx - k.x; let uy = k.hy - k.y;
  const d = Math.hypot(ux, uy);
  if (d < 25) return { ux: 0, uy: -1, hx: k.x, hy: k.y - 40, cx: k.x, cy: k.y + 3 };
  ux /= d; uy /= d;
  return { ux, uy, hx: k.hx, hy: k.hy, cx: k.hx - ux * 43, cy: k.hy - uy * 43 };
}

const rrect = (ctx, x, y, w, h, r) => (ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h));

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  const setAim = (s, x, y) => {
    s.aim.x = clamp(x, GL - 30, GR + 30);
    s.aim.y = clamp(y, GT - 30, GB - 4);
  };

  const shoot = (s) => {
    if (s.phase !== 'aim') return;
    const lv = level(s);
    const err = 6 + Math.min(24, lv * 2);
    const tx = s.aim.x + gauss() * err;
    const ty = s.aim.y + gauss() * err;
    const b = s.ball;
    Object.assign(b, { t: 0, sx: BALL_X, sy: BALL_Y, tx, ty, x: BALL_X, y: BALL_Y, r: 14, out: false, vx: 0, vy: 0 });
    // Goleiro: adivinha o lado (lê o chute ou aposta no costume do jogador).
    const k = s.keeper;
    const smart = Math.min(0.62, 0.22 + lv * 0.06);
    let guess;
    if (Math.random() < smart) {
      guess = { x: tx + rnd(-22, 22), y: ty + rnd(-18, 18) };
    } else {
      const recent = s.hist.slice(-5);
      const sum = recent.reduce((a, v) => a + v, 0);
      let side;
      if (recent.length >= 3 && Math.abs(sum) >= 2 && Math.random() < 0.6) side = Math.sign(sum);
      else side = [-1, 0, 1][Math.floor(Math.random() * 3)];
      guess = { x: GCX + side * rnd(50, 120), y: rnd(GT + 10, GB - 10) };
    }
    k.guess = guess;
    k.delay = Math.max(0.06, 0.24 - lv * 0.02);
    k.dive = 0;
    s.hist.push(Math.abs(tx - GCX) < 40 ? 0 : Math.sign(tx - GCX));
    s.phase = 'flight';
    s.aiming = false;
    sfx('shoot');
  };

  const resolve = (s) => {
    const b = s.ball; const k = s.keeper;
    s.shots += 1;
    const inside = b.tx > GL + 6 && b.tx < GR - 6 && b.ty > GT + 6 && b.ty < GB;
    const kg = keeperGeom(k);
    const saved = inside && segDist(b.tx, b.ty, kg.hx + kg.ux * 4, kg.hy + kg.uy * 4, kg.hx - kg.ux * 74, kg.hy - kg.uy * 74) < 22;
    if (!inside) {
      s.misses += 1; s.streak = 0;
      s.msg = { text: b.ty < GT + 6 ? 'Por cima!' : 'Pra fora!', color: COLORS.sky };
      b.out = true;
      b.vx = (b.tx - b.sx) * 0.4; b.vy = -40;
      sfx('error');
    } else if (saved) {
      s.misses += 1; s.streak = 0;
      s.msg = { text: 'Defendeu! 🧤', color: COLORS.red };
      b.vx = (b.tx - k.x) * 2.2 + rnd(-60, 60); b.vy = 260;
      sfx('hit');
    } else {
      const pts = zonePoints(b.tx, b.ty);
      s.streak += 1; s.goals += 1;
      const bonus = s.streak >= 3 ? 1 : 0;
      s.score += pts + bonus;
      s.net = 1;
      s.msg = { text: (pts === 3 ? 'No ângulo! ' : 'GOL! ') + '+' + (pts + bonus), color: COLORS.yellow, sub: bonus ? 'Sequência ' + s.streak + ' 🔥' : '' };
      b.vx = 0; b.vy = 0;
      sfx(pts === 3 ? 'win' : 'coin');
    }
    s.phase = 'result';
    s.resT = 0;
  };

  const nextShot = (s) => {
    if (s.misses >= MAX_MISS) { s.phase = 'over'; s.overT = 0; sfx('lose'); return; }
    const k = s.keeper;
    Object.assign(k, { x: GCX, y: KEEP_Y, hx: GCX, hy: KEEP_Y - 40, guess: null, dive: 0 });
    Object.assign(s.ball, { x: BALL_X, y: BALL_Y, r: 14, t: 0 });
    s.msg = null;
    s.phase = 'aim';
  };

  const down = (e) => {
    const s = st.current;
    if (s.phase !== 'aim') return;
    const p = pointerPos(e, canvasRef.current, W, H);
    if (p.y > GB + 70) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    s.aiming = true;
    setAim(s, p.x, p.y);
    sfx('tap');
  };
  const move = (e) => {
    const s = st.current;
    if (s.phase !== 'aim') return;
    const p = pointerPos(e, canvasRef.current, W, H);
    if (s.aiming || e.pointerType === 'mouse') setAim(s, p.x, p.y);
  };
  const up = () => {
    const s = st.current;
    if (!s.aiming) return;
    shoot(s);
  };

  useKeys((k, isDown) => {
    const s = st.current;
    if (!isDown || s.phase !== 'aim') return;
    const step = 14;
    if (k === 'left') setAim(s, s.aim.x - step, s.aim.y);
    if (k === 'right') setAim(s, s.aim.x + step, s.aim.y);
    if (k === 'up') setAim(s, s.aim.x, s.aim.y - step);
    if (k === 'down') setAim(s, s.aim.x, s.aim.y + step);
    if (k === 'action') shoot(s);
  });

  const update = (s, dt) => {
    const k = s.keeper; const b = s.ball;
    s.t += dt;
    s.net = Math.max(0, s.net - dt * 1.5);
    if (s.phase === 'aim') {
      // Goleiro se mexe na linha, esperando.
      k.sway += dt * (1.6 + level(s) * 0.1);
      k.x = GCX + Math.sin(k.sway) * 12;
      k.hx = k.x; k.hy = KEEP_Y - 40;
    } else if (s.phase === 'flight') {
      b.t += dt / FLIGHT;
      const t = Math.min(1, b.t);
      const e = 1 - (1 - t) * (1 - t) * 0.35;
      b.x = b.sx + (b.tx - b.sx) * t;
      b.y = b.sy + (b.ty - b.sy) * e - Math.sin(t * Math.PI) * 22;
      b.r = 14 - 6 * t;
      if (k.delay > 0) k.delay -= dt;
      else if (k.guess) {
        k.dive = Math.min(1, k.dive + dt / 0.34);
        const lv = level(s);
        const reach = Math.min(155, 108 + lv * 6);
        let dx = k.guess.x - GCX; let dy = k.guess.y - KEEP_Y;
        const d = Math.hypot(dx, dy);
        if (d > reach) { dx *= reach / d; dy *= reach / d; }
        const p = 1 - (1 - k.dive) ** 2;
        k.x = GCX + dx * 0.45 * p;
        k.y = KEEP_Y + Math.max(0, dy) * 0.3 * p;
        k.hx = GCX + dx * p;
        k.hy = KEEP_Y - 40 + (dy + 40) * p;
      }
      if (b.t >= 1) resolve(s);
    } else if (s.phase === 'result') {
      s.resT += dt;
      if (b.vx || b.vy) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.vy += 500 * dt * (b.out ? 0.2 : 1);
      }
      if (s.resT > 1.2) nextShot(s);
    } else if (s.phase === 'over') {
      s.overT += dt;
      if (s.overT > 1.1 && !ended.current) {
        ended.current = true;
        setRunning(false);
        onEnd?.(s.score);
      }
    }
    if (s.score !== s.reported) { s.reported = s.score; onScore?.(s.score); }
  };

  const drawKeeper = (ctx, k) => {
    const kg = keeperGeom(k);
    const ang = Math.atan2(kg.uy, kg.ux) + Math.PI / 2;
    ctx.save();
    ctx.translate(kg.cx, kg.cy);
    ctx.rotate(ang);
    // pernas
    ctx.fillStyle = '#10204F';
    ctx.fillRect(-11, 10, 9, 26); ctx.fillRect(2, 10, 9, 26);
    // corpo
    ctx.fillStyle = COLORS.green;
    ctx.beginPath(); rrect(ctx, -14, -22, 28, 36, 8); ctx.fill();
    ctx.fillStyle = COLORS.yellow; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('1', 0, -4);
    // braços
    ctx.strokeStyle = COLORS.green; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, -16); ctx.lineTo(-18, -40); ctx.moveTo(12, -16); ctx.lineTo(18, -40); ctx.stroke();
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath(); ctx.arc(-18, -43, 6, 0, Math.PI * 2); ctx.arc(18, -43, 6, 0, Math.PI * 2); ctx.fill();
    // cabeça
    ctx.fillStyle = '#C98B5E';
    ctx.beginPath(); ctx.arc(0, -30, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2A1A10';
    ctx.beginPath(); ctx.arc(0, -33, 9, Math.PI, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const drawBall = (ctx, x, y, r) => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = i * (Math.PI * 2 / 5) - Math.PI / 2;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, r * 0.18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  };

  const draw = (s) => {
    const ctx = getCtx();
    if (!ctx) return;
    // céu e arquibancada
    const g = ctx.createLinearGradient(0, 0, 0, GB);
    g.addColorStop(0, '#0B1430'); g.addColorStop(1, '#1B2E66');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      const x = (i * 37) % W; const y = 40 + ((i * 53) % 50);
      ctx.fillStyle = ['rgba(233,42,47,.35)', 'rgba(249,199,29,.35)', 'rgba(255,255,255,.25)', 'rgba(127,178,255,.35)'][i % 4];
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // gramado
    const fieldTop = GB - 8;
    for (let i = 0; i < 8; i++) {
      const y0 = fieldTop + ((H - fieldTop) * (i / 8) ** 1.3);
      const y1 = fieldTop + ((H - fieldTop) * ((i + 1) / 8) ** 1.3);
      ctx.fillStyle = i % 2 ? '#1E8A4E' : '#18784A';
      ctx.fillRect(0, y0, W, y1 - y0 + 1);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GB); ctx.lineTo(W, GB); ctx.stroke();
    // grande área em perspectiva
    ctx.beginPath(); ctx.moveTo(20, GB); ctx.lineTo(-10, GB + 70); ctx.moveTo(W - 20, GB); ctx.lineTo(W + 10, GB + 70);
    ctx.moveTo(-10, GB + 70); ctx.lineTo(W + 10, GB + 70); ctx.stroke();
    ctx.fillStyle = COLORS.white;
    ctx.beginPath(); ctx.ellipse(BALL_X, BALL_Y + 12, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    // rede
    const bulge = s.net > 0 ? Math.sin(s.net * Math.PI) * 6 : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(GL, GT, GR - GL, GB - GT);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
    for (let x = GL; x <= GR; x += 13) { ctx.beginPath(); ctx.moveTo(x, GT); ctx.lineTo(x + (x - GCX) * 0.02 * bulge, GB); ctx.stroke(); }
    for (let y = GT; y <= GB; y += 13) { ctx.beginPath(); ctx.moveTo(GL, y); ctx.lineTo(GR, y + bulge * 0.3); ctx.stroke(); }
    // zonas (dica sutil na mira)
    if (s.phase === 'aim' && s.shots < 3) {
      ctx.fillStyle = 'rgba(249,199,29,0.10)';
      const cw = (GR - GL) * 0.19; const chh = (GB - GT) * 0.4;
      ctx.fillRect(GL, GT, cw, chh); ctx.fillRect(GR - cw, GT, cw, chh);
      ctx.fillStyle = 'rgba(249,199,29,0.8)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+3', GL + cw / 2, GT + chh / 2); ctx.fillText('+3', GR - cw / 2, GT + chh / 2);
    }
    // goleiro (atrás da bola quando ela chega)
    const ballFront = s.phase === 'flight' || s.phase === 'result';
    if (!ballFront || s.ball.r > 9) drawKeeper(ctx, s.keeper);
    // traves
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(GL - 6, GT - 6, 6, GB - GT + 6);
    ctx.fillRect(GR, GT - 6, 6, GB - GT + 6);
    ctx.fillRect(GL - 6, GT - 6, GR - GL + 12, 6);
    // bola
    if (s.phase === 'result' && !s.ball.out && !s.ball.vy && !s.ball.vx) {
      drawBall(ctx, s.ball.x, s.ball.y, s.ball.r);
      drawKeeper(ctx, s.keeper);
    } else {
      if (ballFront && s.ball.r <= 9) drawKeeper(ctx, s.keeper);
      drawBall(ctx, s.ball.x, s.ball.y, s.ball.r);
    }
    // mira
    if (s.phase === 'aim') {
      const { x, y } = s.aim;
      const pulse = 1 + Math.sin(s.t * 6) * 0.12;
      ctx.strokeStyle = COLORS.yellow; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 12 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 18, y);
      ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 18); ctx.stroke();
      ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(249,199,29,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(BALL_X, BALL_Y - 14); ctx.quadraticCurveTo((BALL_X + x) / 2, (BALL_Y + y) / 2 - 40, x, y + 12); ctx.stroke();
      ctx.setLineDash([]);
      if (s.shots === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '600 14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Toque no gol para mirar e solte para chutar', W / 2, GB + 100);
      }
    }
    // mensagem
    if (s.msg) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sc = 1 + Math.max(0, 0.3 - s.resT) * 1.5;
      ctx.save(); ctx.translate(W / 2, GB + 95); ctx.scale(sc, sc);
      ctx.font = 'bold 34px sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(11,20,48,0.8)';
      ctx.strokeText(s.msg.text, 0, 0);
      ctx.fillStyle = s.msg.color; ctx.fillText(s.msg.text, 0, 0);
      ctx.restore();
      if (s.msg.sub) { ctx.fillStyle = COLORS.white; ctx.font = 'bold 16px sans-serif'; ctx.fillText(s.msg.sub, W / 2, GB + 128); }
    }
    // placar
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, 32);
    ctx.font = 'bold 15px sans-serif'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.white; ctx.fillText('Pontos: ' + s.score, 10, 16);
    ctx.textAlign = 'center'; ctx.fillStyle = COLORS.sky; ctx.fillText('Gols: ' + s.goals, W / 2, 16);
    ctx.textAlign = 'right';
    for (let i = 0; i < MAX_MISS; i++) {
      ctx.fillStyle = i < s.misses ? COLORS.red : 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(W - 16 - i * 20, 16, 7, 0, Math.PI * 2); ctx.fill();
    }
    if (s.phase === 'over') {
      ctx.fillStyle = `rgba(11,20,48,${Math.min(0.75, s.overT)})`; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.fillStyle = COLORS.yellow; ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Fim de jogo!', W / 2, H / 2 - 20);
      ctx.fillStyle = COLORS.white; ctx.font = 'bold 20px sans-serif';
      ctx.fillText(s.score + ' pontos · ' + s.goals + (s.goals === 1 ? ' gol' : ' gols'), W / 2, H / 2 + 18);
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
      aria-label="Pênalti"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { st.current.aiming = false; }}
    />
  );
}
