// Asteroides: gire, acelere e atire. As rochas se partem; a tela dá a volta nas bordas. 3 vidas.
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw, Rocket, Crosshair } from 'lucide-react';
import { COLORS, rand, useCanvas, useKeys, useRaf } from '../kit.js';
import { sfx } from '../audio.js';
import './Asteroids.css';

const W = 360;
const H = 400;
const SIZES = [0, 11, 21, 34]; // raio por tamanho (1 pequeno, 3 grande)
const POINTS = [0, 100, 50, 20];
const TAU = Math.PI * 2;

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none' };

const wrap = (v, m) => ((v % m) + m) % m;
// distância considerando a volta nas bordas
const wdist = (ax, ay, bx, by) => {
  let dx = Math.abs(ax - bx); let dy = Math.abs(ay - by);
  if (dx > W / 2) dx = W - dx;
  if (dy > H / 2) dy = H - dy;
  return Math.hypot(dx, dy);
};

function makeRock(x, y, size, speedMul) {
  const a = Math.random() * TAU;
  const sp = (30 + Math.random() * 40) * speedMul * (1 + (3 - size) * 0.35);
  const n = 9 + rand(4);
  const shape = Array.from({ length: n }, () => 0.72 + Math.random() * 0.32);
  return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size, r: SIZES[size], rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 1.6, shape };
}

function spawnWave(s) {
  const count = Math.min(9, 2 + s.wave);
  const mul = 1 + (s.wave - 1) * 0.12;
  s.rocks = [];
  for (let i = 0; i < count; i++) {
    let x; let y;
    do { x = Math.random() * W; y = Math.random() * H; } while (wdist(x, y, s.ship.x, s.ship.y) < 120);
    s.rocks.push(makeRock(x, y, 3, mul));
  }
  s.banner = `Onda ${s.wave}`;
  s.bannerT = 1.4;
}

function newShip() {
  return { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, inv: 2.5 };
}

function newState() {
  const s = {
    ship: newShip(), keys: { left: false, right: false, thrust: false, fire: false }, lives: 3, score: 0, wave: 1,
    rocks: [], shots: [], parts: [], fireT: 0, dead: 0, banner: '', bannerT: 0, thrustSnd: 0,
    stars: Array.from({ length: 50 }, () => ({ x: rand(W), y: rand(H), s: Math.random() < 0.3 ? 2 : 1 })),
  };
  spawnWave(s);
  return s;
}

export default function Game({ onScore, onEnd }) {
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  if (!st.current) st.current = newState();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);
  const [pressed, setPressed] = useState({});
  const endTimer = useRef(null);

  useEffect(() => { onScore?.(0); return () => clearTimeout(endTimer.current); }, []);

  const setKey = (k, v) => {
    st.current.keys[k] = v;
    setPressed((p) => (p[k] === v ? p : { ...p, [k]: v }));
  };

  useKeys((k, down) => {
    if (k === 'left' || k === 'right') setKey(k, down);
    else if (k === 'up') setKey('thrust', down);
    else if (k === 'action') setKey('fire', down);
  });

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(st.current.score); }, 1000);
  };

  const burst = (x, y, color, n = 10) => {
    const s = st.current;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU; const sp = 30 + Math.random() * 110;
      s.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.4 + Math.random() * 0.4, color });
    }
  };

  const addScore = (v) => { const s = st.current; s.score += v; onScore?.(s.score); };

  const update = (dt) => {
    const s = st.current;
    s.parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    s.parts = s.parts.filter((p) => p.t < p.life);
    s.rocks.forEach((r) => { r.x = wrap(r.x + r.vx * dt, W); r.y = wrap(r.y + r.vy * dt, H); r.rot += r.vr * dt; });
    if (s.bannerT > 0) s.bannerT -= dt;
    if (ended.current) return;

    const sh = s.ship;
    if (s.dead > 0) {
      s.dead -= dt;
      if (s.dead <= 0) {
        // renasce no centro quando não houver rocha perto
        const safe = s.rocks.every((r) => wdist(r.x, r.y, W / 2, H / 2) > r.r + 60);
        if (safe) { s.ship = newShip(); } else s.dead = 0.1;
      }
    } else {
      const turn = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0);
      sh.a += turn * 4.2 * dt;
      if (s.keys.thrust) {
        sh.vx += Math.cos(sh.a) * 220 * dt;
        sh.vy += Math.sin(sh.a) * 220 * dt;
        s.thrustSnd -= dt;
        if (s.thrustSnd <= 0) { s.thrustSnd = 0.35; sfx('move'); }
      }
      const drag = Math.pow(0.45, dt);
      sh.vx *= drag; sh.vy *= drag;
      const sp = Math.hypot(sh.vx, sh.vy);
      if (sp > 260) { sh.vx *= 260 / sp; sh.vy *= 260 / sp; }
      sh.x = wrap(sh.x + sh.vx * dt, W); sh.y = wrap(sh.y + sh.vy * dt, H);
      if (sh.inv > 0) sh.inv -= dt;

      s.fireT -= dt;
      if (s.keys.fire && s.fireT <= 0 && s.shots.length < 6) {
        s.fireT = 0.22;
        s.shots.push({ x: sh.x + Math.cos(sh.a) * 13, y: sh.y + Math.sin(sh.a) * 13, vx: sh.vx + Math.cos(sh.a) * 330, vy: sh.vy + Math.sin(sh.a) * 330, t: 0 });
        sfx('shoot');
      }
    }

    s.shots.forEach((p) => { p.t += dt; p.x = wrap(p.x + p.vx * dt, W); p.y = wrap(p.y + p.vy * dt, H); });
    s.shots = s.shots.filter((p) => p.t < 0.9);

    // tiros x rochas
    const born = [];
    const mul = 1 + (s.wave - 1) * 0.12;
    let popped = false;
    for (const p of s.shots) {
      for (const r of s.rocks) {
        if (!r.gone && wdist(p.x, p.y, r.x, r.y) < r.r) {
          r.gone = true; p.t = 99; popped = true;
          addScore(POINTS[r.size]);
          burst(r.x, r.y, '#C9B79C', 6 + r.size * 3);
          if (r.size > 1) { born.push(makeRock(r.x, r.y, r.size - 1, mul)); born.push(makeRock(r.x, r.y, r.size - 1, mul)); }
          break;
        }
      }
    }
    if (popped) sfx('pop');
    s.shots = s.shots.filter((p) => p.t < 0.9);
    s.rocks = s.rocks.filter((r) => !r.gone).concat(born);

    // nave x rochas
    if (s.dead <= 0 && sh.inv <= 0) {
      if (s.rocks.some((r) => wdist(sh.x, sh.y, r.x, r.y) < r.r + 8)) {
        sfx('hit');
        burst(sh.x, sh.y, COLORS.yellow, 18);
        s.lives -= 1;
        if (s.lives <= 0) { s.dead = 99; finish(); return; }
        s.dead = 1.2;
      }
    }

    if (!s.rocks.length) {
      addScore(200 + s.wave * 50);
      sfx('win');
      s.wave += 1;
      spawnWave(s);
      if (s.dead <= 0) s.ship.inv = Math.max(s.ship.inv, 1.5);
    }
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    s.stars.forEach((p) => { ctx.fillStyle = p.s > 1 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)'; ctx.fillRect(p.x, p.y, p.s, p.s); });

    // rochas (desenhadas também do outro lado quando cruzam a borda)
    ctx.lineWidth = 2;
    s.rocks.forEach((r) => {
      const offs = [[0, 0]];
      if (r.x < r.r) offs.push([W, 0]); if (r.x > W - r.r) offs.push([-W, 0]);
      if (r.y < r.r) offs.push([0, H]); if (r.y > H - r.r) offs.push([0, -H]);
      offs.forEach(([ox, oy]) => {
        ctx.beginPath();
        r.shape.forEach((k, i) => {
          const a = r.rot + (i / r.shape.length) * TAU;
          const x = r.x + ox + Math.cos(a) * r.r * k; const y = r.y + oy + Math.sin(a) * r.r * k;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = '#4B3F33';
        ctx.fill();
        ctx.strokeStyle = '#C9B79C';
        ctx.stroke();
      });
    });

    ctx.fillStyle = COLORS.yellow;
    s.shots.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, TAU); ctx.fill(); });

    s.parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    });
    ctx.globalAlpha = 1;

    const sh = s.ship;
    if (s.dead <= 0 && (sh.inv <= 0 || Math.floor(sh.inv * 10) % 2 === 0)) {
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.a);
      if (s.keys.thrust) {
        ctx.fillStyle = Math.random() < 0.5 ? COLORS.red : COLORS.yellow;
        ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(-16 - Math.random() * 8, 0); ctx.lineTo(-8, 5); ctx.fill();
      }
      ctx.fillStyle = COLORS.white;
      ctx.strokeStyle = COLORS.sky;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -9); ctx.lineTo(-6, 0); ctx.lineTo(-10, 9); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.red;
      ctx.beginPath(); ctx.arc(3, 0, 3, 0, TAU); ctx.fill();
      ctx.restore();
    }

    ctx.font = 'bold 15px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Onda ${s.wave}`, 12, 18);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.red;
    ctx.fillText('❤'.repeat(Math.max(0, s.lives)), W - 12, 18);
    if (s.bannerT > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.yellow;
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(s.banner, W / 2, H / 2 - 50);
    }
    if (ended.current) {
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('Fim de jogo', W / 2, H / 2);
    }
  };

  useRaf((dt) => { update(dt); draw(); }, running);

  const hold = (k) => ({
    onPointerDown: (e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ok */ } setKey(k, true); },
    onPointerUp: () => setKey(k, false),
    onPointerCancel: () => setKey(k, false),
    onLostPointerCapture: () => setKey(k, false),
    onContextMenu: (e) => e.preventDefault(),
  });

  return (
    <div className="asteroids">
      <canvas ref={canvasRef} style={canvasStyle} aria-label="Asteroides" />
      <div className="asteroids-pad">
        <button type="button" aria-label="Girar à esquerda" className={'asteroids-btn' + (pressed.left ? ' asteroids-on' : '')} {...hold('left')}><RotateCcw size={24} /></button>
        <button type="button" aria-label="Girar à direita" className={'asteroids-btn' + (pressed.right ? ' asteroids-on' : '')} {...hold('right')}><RotateCw size={24} /></button>
        <button type="button" aria-label="Acelerar" className={'asteroids-btn asteroids-thrust' + (pressed.thrust ? ' asteroids-on' : '')} {...hold('thrust')}><Rocket size={22} /><span>Acelerar</span></button>
        <button type="button" aria-label="Atirar" className={'asteroids-btn asteroids-fire' + (pressed.fire ? ' asteroids-on' : '')} {...hold('fire')}><Crosshair size={22} /><span>Atirar</span></button>
      </div>
    </div>
  );
}
