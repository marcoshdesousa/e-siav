// Pescaria: o anzol balança de um lado para o outro; toque para soltar a linha. O primeiro que
// encostar no anzol é fisgado. Peixes mais fundos valem mais; lixo tira pontos. 60 segundos.
import { useEffect, useRef, useState } from 'react';
import { COLORS, pick, rand, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';

const W = 360;
const H = 480;
const SURFACE = 96;
const BOAT_Y = 70;
const TIME = 60;
const KINDS = [
  { e: '🐟', val: 10, y: [130, 195], v: [45, 70], size: 28 },
  { e: '🐠', val: 20, y: [205, 275], v: [60, 90], size: 28 },
  { e: '🐡', val: 35, y: [285, 360], v: [70, 105], size: 30 },
  { e: '🦀', val: 50, y: [446, 452], v: [25, 40], size: 26, crab: true },
];
const TRASH = [{ e: '👢', val: -15 }, { e: '🥫', val: -15 }, { e: '🧦', val: -10 }];

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none', cursor: 'pointer' };
const between = ([a, b]) => a + Math.random() * (b - a);

function spawn(kindIdx, fromSide) {
  const isTrash = kindIdx < 0;
  const k = isTrash ? { ...pick(TRASH), y: [130, 420], v: [18, 30], size: 26 } : KINDS[kindIdx];
  const dir = Math.random() < 0.5 ? 1 : -1;
  const x = fromSide ? (dir > 0 ? -20 : W + 20) : 20 + Math.random() * (W - 40);
  return { e: k.e, val: k.val, x, y: between(k.y), vx: dir * between(k.v), size: k.size, trash: isTrash, crab: !!k.crab, ph: Math.random() * 6, kind: kindIdx };
}

const MIX = [0, 0, 0, 1, 1, 1, 2, 2, 3, -1, -1];

function newState() {
  return {
    t: 0, left: TIME, score: 0, hookX: W / 2, phase: 'swing', lineY: SURFACE + 6, caught: null, popups: [], over: false,
    items: MIX.map((k) => spawn(k, false)), bubbles: Array.from({ length: 12 }, () => ({ x: rand(W), y: SURFACE + rand(H - SURFACE), r: 1 + rand(3) })),
    swingT: 0,
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
    sfx('win');
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(Math.max(0, st.current.score)); }, 1300);
  };

  const drop = () => {
    const s = st.current;
    if (ended.current || s.over || s.phase !== 'swing') return;
    s.phase = 'down';
    sfx('tap');
  };

  useKeys((k, down) => { if (down && (k === 'action' || k === 'down')) drop(); });

  const update = (dt) => {
    const s = st.current;
    s.t += dt;
    s.bubbles.forEach((b) => { b.y -= (10 + b.r * 8) * dt; if (b.y < SURFACE) { b.y = H; b.x = rand(W); } });
    s.popups.forEach((p) => { p.t -= dt; p.y -= 30 * dt; });
    s.popups = s.popups.filter((p) => p.t > 0);
    if (s.over) return;

    s.left -= dt;
    if (s.left <= 0) { s.left = 0; s.over = true; finish(); return; }

    // peixes nadando (os que saem da tela voltam por um lado)
    s.items.forEach((it, i) => {
      if (it === s.caught) return;
      it.x += it.vx * dt;
      if (!it.crab) it.y += Math.sin(s.t * 2 + it.ph) * 6 * dt;
      if (it.x < -40 || it.x > W + 40) s.items[i] = spawn(it.kind, true);
    });

    // anzol: vai e volta cada vez mais rápido
    if (s.phase === 'swing') {
      const sp = 1.6 + (TIME - s.left) * 0.012;
      s.swingT += dt * sp;
      s.hookX = W / 2 + Math.sin(s.swingT) * (W / 2 - 26);
    } else if (s.phase === 'down') {
      s.lineY += 300 * dt;
      const hit = s.items.find((it) => Math.abs(it.x - s.hookX) < it.size * 0.55 && Math.abs(it.y - s.lineY) < it.size * 0.45);
      if (hit) {
        s.caught = hit;
        s.phase = 'up';
        sfx(hit.trash ? 'error' : 'pop');
      } else if (s.lineY >= H - 14) {
        s.phase = 'up';
      }
    } else if (s.phase === 'up') {
      const sp = s.caught ? 230 - Math.min(110, (s.lineY - SURFACE) * 0.25) : 420;
      s.lineY -= sp * dt;
      if (s.caught) { s.caught.x = s.hookX; s.caught.y = s.lineY + 10; }
      if (s.lineY <= SURFACE + 6) {
        s.lineY = SURFACE + 6;
        s.phase = 'swing';
        const c = s.caught;
        if (c) {
          s.score = Math.max(0, s.score + c.val);
          onScore?.(s.score);
          sfx(c.trash ? 'hit' : 'coin');
          s.popups.push({ x: s.hookX, y: SURFACE - 6, t: 1, txt: c.val > 0 ? `+${c.val}` : String(c.val), bad: c.trash });
          const i = s.items.indexOf(c);
          // repõe com um tipo sorteado para manter o lago cheio
          if (i >= 0) s.items[i] = spawn(pick(MIX), true);
          s.caught = null;
        }
      }
    }
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    // céu
    const sky = ctx.createLinearGradient(0, 0, 0, SURFACE);
    sky.addColorStop(0, '#7FB2FF'); sky.addColorStop(1, '#cfe3ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, SURFACE);
    ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('☀️', W - 30, 28);
    // água
    const water = ctx.createLinearGradient(0, SURFACE, 0, H);
    water.addColorStop(0, '#2B7BD0'); water.addColorStop(0.6, '#1d4f9c'); water.addColorStop(1, '#0E2A6B');
    ctx.fillStyle = water; ctx.fillRect(0, SURFACE, W, H - SURFACE);
    // fundo de areia
    ctx.fillStyle = '#C9A15A';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - 18 + Math.sin(x * 0.05) * 4);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.font = '22px sans-serif';
    ctx.fillText('🌿', 30, H - 26); ctx.fillText('🪸', 200, H - 24); ctx.fillText('🌿', 320, H - 26);
    // faixas de profundidade (dica sutil de valor)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
    [[160, '10'], [240, '20'], [322, '35'], [430, '50']].forEach(([y, v]) => ctx.fillText(v, 4, y));
    // bolhas
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    s.bubbles.forEach((b) => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke(); });
    // ondas da superfície
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = SURFACE + Math.sin(x * 0.06 + s.t * 2) * 2;
      if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    // peixes e lixo
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    s.items.forEach((it) => {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.font = `${it.size}px sans-serif`;
      if (it === s.caught && !it.crab) ctx.rotate(-Math.PI / 2 * Math.sign(it.vx || 1));
      else if (it.vx > 0 && !it.crab && !it.trash) ctx.scale(-1, 1);
      ctx.fillText(it.e, 0, 0);
      ctx.restore();
    });
    // barco e linha
    const bx = s.hookX;
    ctx.fillStyle = '#8B5A2B';
    ctx.beginPath();
    ctx.moveTo(bx - 34, BOAT_Y); ctx.lineTo(bx + 34, BOAT_Y); ctx.lineTo(bx + 24, BOAT_Y + 18); ctx.lineTo(bx - 24, BOAT_Y + 18); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.red; ctx.fillRect(bx - 34, BOAT_Y - 3, 68, 4);
    ctx.font = '24px sans-serif';
    ctx.fillText('🧑', bx - 10, BOAT_Y - 13);
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx - 4, BOAT_Y - 8); ctx.lineTo(bx + 18, BOAT_Y - 34); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx + 18, BOAT_Y - 34); ctx.lineTo(bx, s.lineY); ctx.stroke();
    // anzol
    ctx.strokeStyle = '#E0E6F0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx, s.lineY); ctx.lineTo(bx, s.lineY + 8); ctx.arc(bx - 4, s.lineY + 8, 4, 0, Math.PI); ctx.stroke();
    if (s.phase === 'swing') {
      ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.moveTo(bx, s.lineY + 14); ctx.lineTo(bx, H - 20); ctx.stroke();
      ctx.setLineDash([]);
    }
    // pontos flutuando
    ctx.font = 'bold 18px sans-serif';
    s.popups.forEach((p) => { ctx.fillStyle = p.bad ? COLORS.red : COLORS.yellow; ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillText(p.txt, p.x, p.y); });
    ctx.globalAlpha = 1;
    // placar
    ctx.fillStyle = 'rgba(11,20,48,0.7)';
    const pill = (x, w) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, 8, w, 26, 13); else ctx.rect(x, 8, w, 26); ctx.fill(); };
    pill(8, 92); pill(108, 92);
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = s.left < 10 ? '#FF7A7A' : COLORS.white;
    ctx.fillText(`⏱ ${Math.ceil(s.left)} s`, 54, 22);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText(`⭐ ${s.score}`, 154, 22);
    if (s.over) {
      ctx.fillStyle = 'rgba(11,20,48,0.6)'; ctx.fillRect(0, H / 2 - 40, W, 80);
      ctx.fillStyle = COLORS.white; ctx.font = 'bold 28px sans-serif';
      ctx.fillText('Tempo esgotado!', W / 2, H / 2);
    }
  };

  useRaf((dt) => { update(dt); draw(); }, running);

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      aria-label="Pescaria"
      onPointerDown={(e) => { e.preventDefault(); drop(); }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
