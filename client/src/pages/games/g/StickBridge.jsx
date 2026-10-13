// Ponte: segure para a vara crescer e solte para ela cair. Se alcançar a próxima pedra, o
// desbravador atravessa; acertar o centro vermelho vale ponto extra. Errou o tamanho, caiu.
import { useEffect, useRef, useState } from 'react';
import { COLORS, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 480;
const TOP = 330;
const LEFT_X = 34;
const GROW = 300;
const WALK = 230;
const PERFECT = 4;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'pointer' };

function makePillar(prev, score) {
  const minW = Math.max(16, 48 - score * 1.2);
  const maxW = Math.max(28, 82 - score * 1.8);
  const w = minW + Math.random() * (maxW - minW);
  const prevRight = prev.x + prev.w;
  // espaço disponível na tela: a pedra atual vai para a esquerda (LEFT_X) depois de rolar
  const room = W - 12 - (LEFT_X + prev.w) - w;
  const minGap = Math.min(room, 34 + Math.min(40, score * 2));
  const maxGap = Math.min(room, 110 + score * 6);
  const gap = minGap + Math.random() * Math.max(0, maxGap - minGap);
  return { x: prevRight + gap, w };
}

function newState() {
  const first = { x: LEFT_X - 50, w: 50 + 20 };
  const s = {
    pillars: [first], cur: 0, len: 0, angle: 0, phase: 'idle', t: 0, camX: 0, camFrom: 0, camTo: 0,
    heroX: first.x + first.w - 12, heroY: TOP, score: 0, perfects: 0, popup: null, walkT: 0, dropV: 0, stickDrop: 0,
  };
  s.pillars.push(makePillar(first, 0));
  return s;
}

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const endTimer = useRef(null);
  const [running, setRunning] = useState(true);

  useEffect(() => { onScore?.(0); }, []);
  useEffect(() => () => clearTimeout(endTimer.current), []);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    const final = st.current.score;
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(final); }, 1000);
  };

  const press = () => {
    const s = st.current;
    if (ended.current || s.phase !== 'idle') return;
    s.phase = 'grow';
    s.stickX = s.pillars[s.cur].x + s.pillars[s.cur].w;
    s.len = 0;
    s.angle = 0;
    s.stickDrop = 0;
    sfx('tap');
  };
  const release = () => {
    const s = st.current;
    if (s.phase !== 'grow') return;
    s.phase = 'fall';
    s.t = 0;
  };

  useKeys((k, down) => {
    if (k !== 'action' && k !== 'up' && k !== 'down') return;
    if (down) press(); else release();
  });

  const update = (dt) => {
    const s = st.current;
    const cur = s.pillars[s.cur];
    const next = s.pillars[s.cur + 1];
    const origin = cur.x + cur.w;
    if (s.popup) { s.popup.t -= dt; if (s.popup.t <= 0) s.popup = null; }
    if (s.phase === 'grow') {
      s.len = Math.min(W, s.len + GROW * dt);
    } else if (s.phase === 'fall') {
      s.t += dt;
      const k = Math.min(1, s.t / 0.32);
      s.angle = k * k * (Math.PI / 2);
      if (k >= 1) {
        sfx('move');
        const end = origin + s.len;
        s.ok = end >= next.x && end <= next.x + next.w;
        s.perfect = s.ok && Math.abs(end - (next.x + next.w / 2)) <= PERFECT;
        s.walkTo = s.ok ? next.x + next.w - 12 : end + 2;
        s.phase = 'walk';
      }
    } else if (s.phase === 'walk') {
      s.walkT += dt;
      s.heroX = Math.min(s.walkTo, s.heroX + WALK * dt);
      if (s.heroX >= s.walkTo) {
        if (s.ok) {
          s.cur += 1;
          const gain = s.perfect ? 2 : 1;
          s.score += gain;
          if (s.perfect) { s.perfects += 1; s.popup = { text: 'Perfeito! +2', t: 1 }; sfx('coin'); } else sfx('point');
          onScore?.(s.score);
          s.pillars.push(makePillar(next, s.score));
          s.camFrom = s.camX;
          s.camTo = next.x - LEFT_X;
          s.t = 0;
          s.phase = 'scroll';
        } else {
          s.phase = 'drop';
          s.dropV = 0;
          s.t = 0;
          sfx('hit');
        }
      }
    } else if (s.phase === 'scroll') {
      s.t += dt;
      const k = Math.min(1, s.t / 0.4);
      s.camX = s.camFrom + (s.camTo - s.camFrom) * (1 - (1 - k) * (1 - k));
      if (k >= 1) {
        s.phase = 'idle';
        s.len = 0;
        if (s.cur > 1) { s.pillars = s.pillars.slice(s.cur - 1); s.cur = 1; }
      }
    } else if (s.phase === 'drop') {
      s.t += dt;
      s.dropV += 1400 * dt;
      s.heroY += s.dropV * dt;
      // a vara também cai (quando não alcançou nada)
      s.stickDrop = Math.min(Math.PI / 2, s.stickDrop + dt * 5);
      if (s.t > 0.25) finish();
    }
  };

  const drawHero = (ctx, x, y, walking, t) => {
    // desbravador: chapéu, lenço amarelo, camisa azul-marinho
    const step = walking ? Math.sin(t * 22) * 3 : 0;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x - 6, y - 10 + Math.max(0, step), 4, 10 - Math.max(0, step));
    ctx.fillRect(x + 2, y - 10 + Math.max(0, -step), 4, 10 - Math.max(0, -step));
    ctx.fillStyle = COLORS.navy;
    ctx.fillRect(x - 8, y - 28, 16, 19);
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath(); ctx.moveTo(x - 7, y - 28); ctx.lineTo(x + 7, y - 28); ctx.lineTo(x, y - 19); ctx.fill();
    ctx.fillStyle = '#E8B48A';
    ctx.beginPath(); ctx.arc(x, y - 34, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath(); ctx.arc(x + 3, y - 35, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8A5A2B';
    ctx.fillRect(x - 11, y - 40, 22, 3);
    ctx.beginPath(); ctx.moveTo(x - 6, y - 40); ctx.lineTo(x, y - 47); ctx.lineTo(x + 6, y - 40); ctx.fill();
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1B3B8C'); sky.addColorStop(0.6, '#F7A85B'); sky.addColorStop(1, '#F9C71D');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // sol e montanhas (paralaxe)
    ctx.fillStyle = 'rgba(255,240,200,0.8)';
    ctx.beginPath(); ctx.arc(W * 0.7, 210, 36, 0, Math.PI * 2); ctx.fill();
    const layers = [{ c: '#6D5A9C', k: 0.15, h: 120, f: 0.012 }, { c: '#3E3A7A', k: 0.3, h: 80, f: 0.02 }];
    layers.forEach((L) => {
      ctx.fillStyle = L.c;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) {
        const wx = x + s.camX * L.k;
        ctx.lineTo(x, TOP + 30 - L.h * (0.5 + 0.5 * Math.sin(wx * L.f) * Math.cos(wx * L.f * 0.37)));
      }
      ctx.lineTo(W, H); ctx.fill();
    });
    ctx.save();
    ctx.translate(-s.camX, 0);
    // pedras
    s.pillars.forEach((p, i) => {
      const g = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
      g.addColorStop(0, '#3B3F52'); g.addColorStop(0.5, '#5A6078'); g.addColorStop(1, '#2F3243');
      ctx.fillStyle = g;
      ctx.fillRect(p.x, TOP, p.w, H - TOP);
      ctx.fillStyle = COLORS.green;
      ctx.fillRect(p.x - 2, TOP, p.w + 4, 6);
      if (i === s.cur + 1) {
        ctx.fillStyle = COLORS.red;
        ctx.fillRect(p.x + p.w / 2 - PERFECT, TOP, PERFECT * 2, 5);
      }
    });
    // vara
    if (s.len > 0) {
      const ox = s.stickX;
      ctx.save();
      ctx.translate(ox, TOP);
      ctx.rotate(-Math.PI / 2 + s.angle + (s.phase === 'drop' && !s.ok ? s.stickDrop : 0));
      ctx.fillStyle = '#7A4A1E';
      ctx.fillRect(0, -2, s.len, 4);
      ctx.fillStyle = '#A8672D';
      ctx.fillRect(0, -2, s.len, 1.5);
      ctx.restore();
    }
    drawHero(ctx, s.heroX, s.heroY, s.phase === 'walk', s.walkT);
    ctx.restore();
    // placar
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = COLORS.navy;
    ctx.fillStyle = COLORS.white;
    ctx.strokeText(String(s.score), W / 2, 56);
    ctx.fillText(String(s.score), W / 2, 56);
    if (s.popup) {
      ctx.globalAlpha = Math.min(1, s.popup.t * 2);
      ctx.font = 'bold 22px sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeText(s.popup.text, W / 2, 100);
      ctx.fillStyle = COLORS.yellow;
      ctx.fillText(s.popup.text, W / 2, 100);
      ctx.globalAlpha = 1;
    }
    if (s.score === 0 && s.phase === 'idle' && !ended.current) {
      ctx.font = 'bold 18px sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeText('Segure para crescer a ponte', W / 2, 150);
      ctx.fillStyle = COLORS.white;
      ctx.fillText('Segure para crescer a ponte', W / 2, 150);
    }
    if (ended.current) {
      ctx.fillStyle = 'rgba(14,42,107,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = COLORS.white;
      ctx.fillText('Caiu!', W / 2, H / 2 - 20);
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${s.score} pontos · ${s.perfects} perfeitos`, W / 2, H / 2 + 16);
    }
  };

  useRaf((dt) => {
    const s = st.current;
    if (!ended.current) update(dt);
    else if (s.phase === 'drop') { s.dropV += 1400 * dt; s.heroY += s.dropV * dt; s.stickDrop = Math.min(Math.PI / 2, s.stickDrop + dt * 5); }
    draw();
  }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Ponte"
      onPointerDown={(e) => {
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ok */ }
        press();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
