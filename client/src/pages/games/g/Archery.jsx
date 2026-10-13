// Arco e flecha: arraste para trás para mirar e dar força, solte para atirar. A flecha sofre
// gravidade e vento. Anéis valem de 10 (centro) a 1. São 10 flechas.
import { useEffect, useRef, useState } from 'react';
import { COLORS, clamp, pointerPos, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 460;
const GROUND = 410;
const BOW_X = 58;
const BOW_Y = 336;
const G = 400;
const ARROWS = 10;
const TR = 50; // raio do alvo
const RING_COLORS = ['#F9C71D', '#F9C71D', '#E92A2F', '#E92A2F', '#2B7DE9', '#2B7DE9', '#1A1A1A', '#1A1A1A', '#F4F4F4', '#F4F4F4'];
const MIN_ANG = -1.25;
const MAX_ANG = 0.45;
const LEN = 34; // comprimento da flecha

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'crosshair' };

const rnd = (a, b) => a + Math.random() * (b - a);

function setupShot(s) {
  const n = s.shot;
  s.target = { x: Math.round(clamp(250 + n * 9 + rnd(-12, 12), 240, 330)), y: Math.round(rnd(250, 320)) };
  const maxWind = 40 + n * 24;
  s.wind = Math.round(rnd(-maxWind, maxWind) / 10) * 10;
  s.arrow = null;
}

function newState() {
  const s = {
    phase: 'aim', // aim | fly | result | over
    shot: 0, score: 0, reported: -1, hits: [], stuck: [],
    aim: { ang: -0.3, pow: 0 }, drag: null, keyCharge: false,
    t: 0, resT: 0, overT: 0, msg: null, clouds: [rnd(0, W), rnd(0, W), rnd(0, W)],
  };
  setupShot(s);
  return s;
}

const speedOf = (pow) => 230 + pow * 420;

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);

  const fire = (s) => {
    if (s.phase !== 'aim' || s.aim.pow < 0.08) { s.aim.pow = 0; return; }
    const v = speedOf(s.aim.pow);
    const a = s.aim.ang;
    s.arrow = { x: BOW_X + Math.cos(a) * 10, y: BOW_Y + Math.sin(a) * 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0 };
    s.phase = 'fly';
    sfx('shoot');
  };

  const down = (e) => {
    const s = st.current;
    if (s.phase !== 'aim') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = pointerPos(e, canvasRef.current, W, H);
    s.drag = { sx: p.x, sy: p.y };
    s.aim.pow = 0;
  };
  const move = (e) => {
    const s = st.current;
    if (!s.drag || s.phase !== 'aim') return;
    const p = pointerPos(e, canvasRef.current, W, H);
    const dx = s.drag.sx - p.x; const dy = s.drag.sy - p.y;
    const len = Math.hypot(dx, dy);
    if (len > 6) s.aim.ang = clamp(Math.atan2(dy, dx), MIN_ANG, MAX_ANG);
    s.aim.pow = clamp(len / 130, 0, 1);
  };
  const up = () => {
    const s = st.current;
    if (!s.drag) return;
    s.drag = null;
    fire(s);
  };

  useKeys((k, isDown) => {
    const s = st.current;
    if (s.phase !== 'aim') return;
    if (isDown && k === 'up') s.aim.ang = clamp(s.aim.ang - 0.03, MIN_ANG, MAX_ANG);
    if (isDown && k === 'down') s.aim.ang = clamp(s.aim.ang + 0.03, MIN_ANG, MAX_ANG);
    if (k === 'action') {
      if (isDown) { s.keyCharge = true; s.aim.pow = 0; } else if (s.keyCharge) { s.keyCharge = false; fire(s); }
    }
  });

  const land = (s, ring, text, color) => {
    s.score += ring;
    s.hits.push(ring);
    s.msg = { text, color };
    s.phase = 'result';
    s.resT = 0;
  };

  const update = (s, dt) => {
    s.t += dt;
    s.clouds = s.clouds.map((c, i) => {
      let x = c + (s.wind * 0.15 + (i - 1) * 2) * dt;
      if (x > W + 60) x = -60; if (x < -60) x = W + 60;
      return x;
    });
    if (s.phase === 'aim') {
      if (s.keyCharge) s.aim.pow = Math.min(1, s.aim.pow + dt * 0.8);
    } else if (s.phase === 'fly') {
      const a = s.arrow;
      const steps = 4; const h = dt / steps;
      for (let i = 0; i < steps && s.phase === 'fly'; i++) {
        const px = a.x;
        a.vx += s.wind * h; a.vy += G * h;
        a.x += a.vx * h; a.y += a.vy * h;
        a.t += h;
        const tipX = a.x; const tipY = a.y;
        const tx = s.target.x;
        if (px < tx && tipX >= tx) {
          const yAt = tipY;
          const d = Math.abs(yAt - s.target.y);
          if (d <= TR) {
            const ring = clamp(10 - Math.floor(d / (TR / 10)), 1, 10);
            a.x = tx; a.y = yAt;
            s.stuck = [{ x: tx, y: yAt, ang: Math.atan2(a.vy, a.vx), tgt: true }];
            s.face = s.face || [];
            s.face.push({ dy: yAt - s.target.y, dx: rnd(-1, 1) * Math.sqrt(Math.max(0, TR * TR - (yAt - s.target.y) ** 2)) * 0.6 });
            land(s, ring, ring === 10 ? 'Na mosca! +10' : '+' + ring, ring >= 8 ? COLORS.yellow : COLORS.white);
            sfx(ring === 10 ? 'win' : ring >= 7 ? 'coin' : 'point');
            break;
          }
          // estacas do alvo
          if (yAt > s.target.y + TR && yAt < GROUND) {
            a.x = tx; a.y = yAt;
            s.stuck = [{ x: tx, y: yAt, ang: Math.atan2(a.vy, a.vx) }];
            land(s, 0, 'Na estaca!', COLORS.sky); sfx('hit');
            break;
          }
        }
        if (tipY >= GROUND) {
          a.y = GROUND;
          s.stuck = [{ x: a.x, y: GROUND, ang: Math.atan2(a.vy, a.vx) }];
          land(s, 0, 'Errou!', COLORS.sky); sfx('error');
          break;
        }
        if (a.x > W + 40 || a.y < -400 || a.t > 5) {
          land(s, 0, 'Passou!', COLORS.sky); sfx('error');
          break;
        }
      }
    } else if (s.phase === 'result') {
      s.resT += dt;
      if (s.resT > 1.3) {
        s.shot += 1;
        s.msg = null;
        if (s.shot >= ARROWS) { s.phase = 'over'; s.overT = 0; }
        else { setupShot(s); s.stuck = []; s.aim.pow = 0; s.phase = 'aim'; }
      }
    } else if (s.phase === 'over') {
      s.overT += dt;
      if (s.overT > 1.2 && !ended.current) {
        ended.current = true;
        setRunning(false);
        onEnd?.(s.score);
      }
    }
    if (s.score !== s.reported) { s.reported = s.score; onScore?.(s.score); }
  };

  const drawArrow = (ctx, x, y, ang, len = LEN) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.strokeStyle = '#C8A06A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = '#C9CED8';
    ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-4, -3); ctx.lineTo(-4, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.red;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-len - 5, -4); ctx.lineTo(-len + 6, 0); ctx.lineTo(-len - 5, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  const draw = (s) => {
    const ctx = getCtx();
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, '#0E2A6B'); g.addColorStop(1, '#5C86E0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // nuvens (andam com o vento)
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    s.clouds.forEach((x, i) => {
      const y = 70 + i * 38;
      ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.arc(x + 18, y - 6, 20, 0, Math.PI * 2); ctx.arc(x + 38, y, 15, 0, Math.PI * 2); ctx.fill();
    });
    // morros e chão
    ctx.fillStyle = '#16603F';
    ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, GROUND - 40 - Math.sin(x / 50) * 18 - Math.sin(x / 23) * 6);
    ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.green; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#1E9A64'; ctx.fillRect(0, GROUND, W, 4);
    // alvo (de lado, levemente virado)
    const t = s.target;
    ctx.strokeStyle = '#7A4E25'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(t.x + 2, t.y + TR - 6); ctx.lineTo(t.x - 8, GROUND); ctx.moveTo(t.x + 2, t.y + TR - 6); ctx.lineTo(t.x + 14, GROUND); ctx.stroke();
    ctx.fillStyle = '#B98A55';
    ctx.beginPath(); ctx.ellipse(t.x + 6, t.y, 9, TR + 3, 0, 0, Math.PI * 2); ctx.fill();
    for (let r = 10; r >= 1; r--) {
      ctx.fillStyle = RING_COLORS[r - 1];
      ctx.beginPath(); ctx.ellipse(t.x, t.y, 8 * (r / 10) + 1, (TR * r) / 10, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(t.x, t.y, 9, TR, 0, 0, Math.PI * 2); ctx.stroke();
    // flechas cravadas
    s.stuck.forEach((a) => drawArrow(ctx, a.x, a.y, a.ang));
    // arqueiro
    const ang = s.aim.ang;
    ctx.strokeStyle = COLORS.navy; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const hipX = BOW_X - 22; const hipY = GROUND - 34;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(hipX - 8, GROUND); ctx.moveTo(hipX, hipY); ctx.lineTo(hipX + 10, GROUND); ctx.stroke();
    ctx.strokeStyle = COLORS.green; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(hipX + 2, BOW_Y - 8); ctx.stroke();
    ctx.fillStyle = '#C98B5E';
    ctx.beginPath(); ctx.arc(hipX + 3, BOW_Y - 22, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath(); ctx.ellipse(hipX + 3, BOW_Y - 28, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hipX + 3, BOW_Y - 29, 6, Math.PI, Math.PI * 2); ctx.fill();
    // arco
    const pull = s.phase === 'aim' ? s.aim.pow * 16 : 0;
    ctx.save(); ctx.translate(BOW_X, BOW_Y); ctx.rotate(ang);
    ctx.strokeStyle = '#8B5A2B'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(-10, 0, 26, -1.15, 1.15); ctx.stroke();
    const tipX = -10 + Math.cos(1.15) * 26; const tipY = Math.sin(1.15) * 26;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tipX, -tipY); ctx.lineTo(tipX - 6 - pull, 0); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.restore();
    // braços
    ctx.strokeStyle = '#C98B5E'; ctx.lineWidth = 4;
    const shX = hipX + 2; const shY = BOW_Y - 12;
    ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(BOW_X + Math.cos(ang) * 6, BOW_Y + Math.sin(ang) * 6);
    const hx = BOW_X + Math.cos(ang) * (tipX - 6 - pull); const hy = BOW_Y + Math.sin(ang) * (tipX - 6 - pull);
    ctx.moveTo(shX, shY); ctx.lineTo(hx, hy); ctx.stroke();
    if (s.phase === 'aim') drawArrow(ctx, BOW_X + Math.cos(ang) * (24 - pull), BOW_Y + Math.sin(ang) * (24 - pull), ang, 30);
    // dica curta da trajetória (sem vento)
    if (s.phase === 'aim' && s.aim.pow > 0.05) {
      const v = speedOf(s.aim.pow);
      const vx = Math.cos(s.aim.ang) * v; const vy = Math.sin(s.aim.ang) * v;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 1; i <= 6; i++) {
        const tt = i * 0.035;
        ctx.beginPath(); ctx.arc(BOW_X + vx * tt, BOW_Y + vy * tt + 0.5 * G * tt * tt, 2.8 - i * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // flecha voando
    if (s.phase === 'fly' && s.arrow) drawArrow(ctx, s.arrow.x, s.arrow.y, Math.atan2(s.arrow.vy, s.arrow.vx));
    // vento
    const wx = W - 92; const wy = 50;
    ctx.fillStyle = 'rgba(11,20,48,0.55)';
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(wx - 6, wy - 16, 92, 40, 10); else ctx.rect(wx - 6, wy - 16, 92, 40); ctx.fill();
    ctx.fillStyle = COLORS.white; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.wind === 0 ? 'SEM VENTO' : 'VENTO ' + Math.abs(s.wind / 10), wx + 40, wy - 5);
    if (s.wind !== 0) {
      const dir = Math.sign(s.wind);
      const len = 12 + Math.min(60, Math.abs(s.wind) / 4);
      const cx = wx + 40;
      ctx.strokeStyle = Math.abs(s.wind) > 150 ? COLORS.red : COLORS.yellow; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - (len / 2) * dir, wy + 11); ctx.lineTo(cx + (len / 2) * dir, wy + 11); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(cx + (len / 2 + 6) * dir, wy + 11); ctx.lineTo(cx + (len / 2 - 2) * dir, wy + 5); ctx.lineTo(cx + (len / 2 - 2) * dir, wy + 17); ctx.closePath(); ctx.fill();
    }
    // face do alvo (onde acertou)
    const fx = 34; const fy = 80; const fr = 26;
    for (let r = 10; r >= 1; r--) {
      ctx.fillStyle = RING_COLORS[r - 1];
      ctx.beginPath(); ctx.arc(fx, fy, (fr * r) / 10, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.stroke();
    (s.face || []).forEach((p, i, arr) => {
      ctx.fillStyle = i === arr.length - 1 ? COLORS.lime : '#0B1430';
      ctx.beginPath(); ctx.arc(fx + (p.dx * fr) / TR, fy + (p.dy * fr) / TR, 2.4, 0, Math.PI * 2); ctx.fill();
    });
    // placar
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, 30);
    ctx.font = 'bold 15px sans-serif'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.white; ctx.fillText('Pontos: ' + s.score, 10, 15);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.yellow;
    ctx.fillText('Flecha ' + Math.min(ARROWS, s.shot + 1) + '/' + ARROWS, W - 10, 15);
    if (s.phase === 'aim' && s.shot === 0 && !s.drag && s.aim.pow === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '600 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Arraste para trás e solte ↙', W / 2, 160);
    }
    if (s.msg) {
      ctx.textAlign = 'center';
      ctx.save(); ctx.translate(W / 2 + 20, 200); const sc = 1 + Math.max(0, 0.25 - s.resT) * 2; ctx.scale(sc, sc);
      ctx.font = 'bold 30px sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(11,20,48,0.8)';
      ctx.strokeText(s.msg.text, 0, 0); ctx.fillStyle = s.msg.color; ctx.fillText(s.msg.text, 0, 0);
      ctx.restore();
    }
    if (s.phase === 'over') {
      ctx.fillStyle = `rgba(11,20,48,${Math.min(0.75, s.overT)})`; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.fillStyle = COLORS.yellow; ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Fim de jogo!', W / 2, H / 2 - 20);
      ctx.fillStyle = COLORS.white; ctx.font = 'bold 20px sans-serif';
      ctx.fillText(s.score + ' de ' + ARROWS * 10 + ' pontos', W / 2, H / 2 + 18);
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
      aria-label="Arco e flecha"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { st.current.drag = null; st.current.aim.pow = 0; }}
    />
  );
}
