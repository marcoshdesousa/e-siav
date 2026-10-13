// Come-come: coma todas as bolinhas do labirinto e fuja dos fantasmas. As bolonas deixam os
// fantasmas assustados por alguns segundos, e aí dá para comê-los.
import { useEffect, useRef, useState } from 'react';
import { COLORS, useCanvas, useKeys, useRaf, useSwipe } from '../kit.js';
import DPad from '../DPad.jsx';
import { sfx } from '../audio.js';

const MAP = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '   #.#       #.#   ',
  '####.# ##-## #.####',
  '    .  #   #  .    ',
  '####.# ##### #.####',
  '   #.#       #.#   ',
  '####.# ##### #.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....P.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];
const COLS = 19;
const ROWS = MAP.length;
const CELL = 18;
const TOP = 22;
const W = COLS * CELL;
const H = TOP + ROWS * CELL;
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DIRS = ['up', 'left', 'down', 'right']; // ordem de desempate
const EXIT = { x: 9, y: 7 }; // casa logo acima da porta
const PAC_START = { x: 9, y: 15 };
const GHOSTS = [
  { name: 'Vermelho', color: '#FF4B4B', corner: { x: 18, y: -2 }, home: { x: 9, y: 7 }, wait: 0 },
  { name: 'Rosa', color: '#FF9BD2', corner: { x: 0, y: -2 }, home: { x: 9, y: 9 }, wait: 1.5 },
  { name: 'Ciano', color: '#3FE0E0', corner: { x: 18, y: 22 }, home: { x: 8, y: 9 }, wait: 4 },
  { name: 'Laranja', color: '#FFA94D', corner: { x: 0, y: 22 }, home: { x: 10, y: 9 }, wait: 7 },
];

const canvasStyle = { width: '100%', height: 'auto', display: 'block', touchAction: 'none', borderRadius: 16, userSelect: 'none' };
const wrapX = (x) => ((x % COLS) + COLS) % COLS;
const isWall = (x, y) => {
  if (y < 0 || y >= ROWS) return true;
  const c = MAP[y][wrapX(x)];
  return c === '#' || c === '-';
};
// fantasmas fora de casa não entram na casa (porta e interior contam como parede)
const ghostWall = (x, y) => isWall(x, y) || (y === 9 && x >= 8 && x <= 10);

function freshDots() {
  return MAP.map((row) => row.split('').map((c) => (c === '.' ? 1 : c === 'o' ? 2 : 0)));
}

function placeActors(s) {
  s.pac = { x: PAC_START.x, y: PAC_START.y, dir: 'left', prog: 0, moving: true, want: 'left' };
  s.ghosts = GHOSTS.map((g, i) => ({
    i, x: g.home.x, y: g.home.y, dir: 'left', prog: 0,
    state: i === 0 ? 'out' : 'house', wait: Math.max(0.5, g.wait - (s.level - 1) * 0.8),
  }));
  s.mode = 'scatter';
  s.modeT = 5;
  s.fright = 0;
  s.ready = 1.6;
}

function newState() {
  const s = { level: 1, lives: 3, score: 0, dots: freshDots(), left: 0, dying: 0, combo: 0, dotSnd: 0, t: 0, flash: 0 };
  s.left = s.dots.flat().filter(Boolean).length;
  placeActors(s);
  return s;
}

const pacSpeed = (s) => Math.min(9, 6.2 + (s.level - 1) * 0.45);
const ghostSpeed = (s, g) => {
  if (g.state === 'eaten') return 12;
  if (s.fright > 0 && g.frightened) return 3.6;
  const tunnel = g.y === 9 && (g.x < 4 || g.x > 14);
  return Math.min(8.6, 5.6 + (s.level - 1) * 0.5) * (tunnel ? 0.6 : 1);
};
const frightTime = (s) => Math.max(1.8, 6.5 - (s.level - 1) * 0.9);

// distância ao quadrado até o alvo
const d2 = (x, y, t) => (x - t.x) ** 2 + (y - t.y) ** 2;

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
    endTimer.current = setTimeout(() => { setRunning(false); onEnd?.(st.current.score); }, 1200);
  };

  const addScore = (v) => { const s = st.current; s.score += v; onScore?.(s.score); };

  const want = (d) => {
    if (!VEC[d] || ended.current) return;
    const p = st.current.pac;
    p.want = d;
  };
  useKeys((k, down) => { if (down) want(k); });
  useSwipe(canvasRef, want);

  const ghostTarget = (s, g) => {
    const p = s.pac;
    const G = GHOSTS[g.i];
    if (g.state === 'eaten') return EXIT;
    if (s.mode === 'scatter') return G.corner;
    const [dx, dy] = VEC[p.dir];
    if (g.i === 0) return { x: p.x, y: p.y };
    if (g.i === 1) return { x: p.x + dx * 4, y: p.y + dy * 4 };
    if (g.i === 2) {
      const r = s.ghosts[0];
      const ax = p.x + dx * 2; const ay = p.y + dy * 2;
      return { x: ax * 2 - r.x, y: ay * 2 - r.y };
    }
    return d2(g.x, g.y, p) > 64 ? { x: p.x, y: p.y } : G.corner;
  };

  // fantasma no centro de uma casa escolhe a próxima direção
  const ghostChoose = (s, g) => {
    const opts = DIRS.filter((d) => d !== OPP[g.dir] && !ghostWall(g.x + VEC[d][0], g.y + VEC[d][1]));
    if (!opts.length) { g.dir = OPP[g.dir]; return; }
    if (g.state !== 'eaten' && s.fright > 0 && g.frightened) { g.dir = opts[Math.floor(Math.random() * opts.length)]; return; }
    // um pouco de imprevisibilidade para não ficar mecânico
    if (g.state !== 'eaten' && opts.length > 1 && Math.random() < 0.08) { g.dir = opts[Math.floor(Math.random() * opts.length)]; return; }
    const t = ghostTarget(s, g);
    let best = opts[0]; let bd = Infinity;
    opts.forEach((d) => {
      const v = d2(g.x + VEC[d][0], g.y + VEC[d][1], t);
      if (v < bd) { bd = v; best = d; }
    });
    g.dir = best;
  };

  const eatAt = (s, x, y) => {
    const v = s.dots[y]?.[x];
    if (!v) return;
    s.dots[y][x] = 0;
    s.left -= 1;
    if (v === 2) {
      addScore(50);
      sfx('pop');
      s.fright = frightTime(s);
      s.combo = 0;
      s.ghosts.forEach((g) => {
        if (g.state === 'out') { g.frightened = true; g.dir = OPP[g.dir]; g.prog = g.prog > 0 ? 1 - g.prog : 0; if (g.prog > 0) { g.x = wrapX(g.x - VEC[g.dir][0]); g.y -= VEC[g.dir][1]; } }
        else if (g.state === 'house') g.frightened = true;
      });
    } else {
      addScore(10);
      if (s.dotSnd <= 0) { sfx('tap'); s.dotSnd = 0.14; }
    }
    if (s.left <= 0) {
      addScore(500 * s.level);
      sfx('win');
      s.level += 1;
      s.dots = freshDots();
      s.left = s.dots.flat().filter(Boolean).length;
      s.flash = 1.4;
      placeActors(s);
      s.ready = 2.2;
    }
  };

  const movePac = (s, dt) => {
    const p = s.pac;
    // inverter no meio do caminho
    if (p.want === OPP[p.dir] && p.prog > 0) {
      p.x = wrapX(p.x + VEC[p.dir][0]); p.y += VEC[p.dir][1];
      p.prog = 1 - p.prog; p.dir = p.want; p.moving = true;
    }
    let step = pacSpeed(s) * dt;
    let guard = 0;
    while (step > 0 && guard++ < 4) {
      if (p.prog === 0) {
        // no centro da casa: tenta a curva guardada, senão segue em frente
        if (p.want && !isWall(p.x + VEC[p.want][0], p.y + VEC[p.want][1])) { p.dir = p.want; p.moving = true; }
        if (isWall(p.x + VEC[p.dir][0], p.y + VEC[p.dir][1])) { p.moving = false; return; }
        p.moving = true;
      }
      const room = 1 - p.prog;
      if (step < room) { p.prog += step; step = 0; } else {
        step -= room; p.prog = 0;
        p.x = wrapX(p.x + VEC[p.dir][0]); p.y += VEC[p.dir][1];
        eatAt(s, p.x, p.y);
        if (s.ready > 0) return; // passou de fase
      }
    }
  };

  const moveGhost = (s, g, dt) => {
    if (g.state === 'house') {
      g.wait -= dt;
      if (g.wait <= 0 && s.ready <= 0) {
        g.state = 'out'; g.x = 9; g.y = 8; g.dir = 'up'; g.prog = 0.01;
        if (s.fright <= 0) g.frightened = false;
      }
      return;
    }
    let step = ghostSpeed(s, g) * dt;
    let guard = 0;
    while (step > 0 && guard++ < 4) {
      const room = 1 - g.prog;
      if (step < room) { g.prog += step; step = 0; } else {
        step -= room; g.prog = 0;
        g.x = wrapX(g.x + VEC[g.dir][0]); g.y += VEC[g.dir][1];
        if (g.state === 'eaten' && g.x === EXIT.x && g.y === EXIT.y) {
          // olhos chegaram em casa: renasce e sai de novo
          g.state = 'house'; g.x = 9; g.y = 9; g.wait = 0.8; g.frightened = false; g.prog = 0;
          return;
        }
        ghostChoose(s, g);
      }
    }
  };

  const pos = (a) => {
    const [dx, dy] = VEC[a.dir];
    let x = a.x + dx * a.prog;
    if (x < -0.5) x += COLS; else if (x > COLS - 0.5) x -= COLS;
    return { x, y: a.y + dy * a.prog };
  };

  const update = (dt) => {
    const s = st.current;
    s.t += dt;
    if (s.flash > 0) s.flash -= dt;
    if (ended.current) return;
    if (s.dying > 0) {
      s.dying -= dt;
      if (s.dying <= 0) {
        if (s.lives <= 0) { s.dying = 0.0001; finish(); return; }
        placeActors(s);
      }
      return;
    }
    if (s.ready > 0) { s.ready -= dt; return; }
    s.dotSnd -= dt;
    if (s.fright > 0) {
      s.fright -= dt;
      if (s.fright <= 0) s.ghosts.forEach((g) => { g.frightened = false; });
    } else {
      s.modeT -= dt;
      if (s.modeT <= 0) {
        s.mode = s.mode === 'scatter' ? 'chase' : 'scatter';
        s.modeT = s.mode === 'chase' ? 20 + s.level * 2 : Math.max(2, 6 - s.level);
        s.ghosts.forEach((g) => { if (g.state === 'out' && g.prog > 0) { g.x = wrapX(g.x + VEC[g.dir][0]); g.y += VEC[g.dir][1]; g.prog = 1 - g.prog; g.dir = OPP[g.dir]; } });
      }
    }
    movePac(s, dt);
    if (s.ready > 0) return;
    s.ghosts.forEach((g) => moveGhost(s, g, dt));
    // colisões
    const pp = pos(s.pac);
    for (const g of s.ghosts) {
      if (g.state !== 'out') continue;
      const gp = pos(g);
      let dx = Math.abs(gp.x - pp.x); if (dx > COLS / 2) dx = COLS - dx;
      if (dx + Math.abs(gp.y - pp.y) > 0.7) continue;
      if (s.fright > 0 && g.frightened) {
        g.state = 'eaten'; g.frightened = false;
        s.combo += 1;
        addScore(100 * 2 ** s.combo);
        sfx('point');
        s.popup = { x: gp.x, y: gp.y, t: 0.8, v: 100 * 2 ** s.combo };
      } else {
        sfx('hit');
        s.lives -= 1;
        s.dying = 1.4;
        return;
      }
    }
    if (s.popup) { s.popup.t -= dt; if (s.popup.t <= 0) s.popup = null; }
  };

  const drawWalls = (ctx) => {
    const s = st.current;
    const flashing = s.flash > 0 && Math.floor(s.flash * 6) % 2 === 0;
    const pass = (color, w) => {
      ctx.fillStyle = color;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (MAP[y][x] !== '#') continue;
          const cx = x * CELL + CELL / 2; const cy = TOP + y * CELL + CELL / 2;
          ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, Math.PI * 2); ctx.fill();
          if (x + 1 < COLS && MAP[y][x + 1] === '#') ctx.fillRect(cx, cy - w / 2, CELL, w);
          if (y + 1 < ROWS && MAP[y + 1][x] === '#') ctx.fillRect(cx - w / 2, cy, w, CELL);
        }
      }
    };
    pass(flashing ? COLORS.white : COLORS.blue, CELL * 0.72);
    pass(COLORS.navy, CELL * 0.3);
    ctx.fillStyle = '#FF9BD2';
    ctx.fillRect(9 * CELL + 1, TOP + 8 * CELL + CELL / 2 - 2, CELL - 2, 4);
  };

  const drawGhost = (ctx, g, s) => {
    const p = g.state === 'house'
      ? { x: g.x, y: g.y + Math.sin(s.t * 6 + g.i) * 0.15 }
      : pos(g);
    const cx = p.x * CELL + CELL / 2; const cy = TOP + p.y * CELL + CELL / 2;
    const r = CELL * 0.48;
    const scared = s.fright > 0 && g.frightened && g.state !== 'eaten';
    if (g.state !== 'eaten') {
      const blink = scared && s.fright < 1.6 && Math.floor(s.fright * 6) % 2 === 0;
      ctx.fillStyle = scared ? (blink ? COLORS.white : '#3346D3') : GHOSTS[g.i].color;
      ctx.beginPath();
      ctx.arc(cx, cy - 1, r, Math.PI, 0);
      const bottom = cy + r;
      const wob = Math.floor(s.t * 8) % 2;
      ctx.lineTo(cx + r, bottom);
      const n = 4;
      for (let k = 1; k <= n * 2; k++) {
        const x = cx + r - (k * r) / n;
        const up = (k + wob) % 2 === 1;
        ctx.lineTo(x, up ? bottom - 3.5 : bottom);
      }
      ctx.closePath();
      ctx.fill();
    }
    if (scared) {
      ctx.fillStyle = '#FFD1D1';
      ctx.fillRect(cx - 4, cy - 3, 2, 2); ctx.fillRect(cx + 2, cy - 3, 2, 2);
      return;
    }
    const [dx, dy] = g.state === 'house' ? [0, 0] : VEC[g.dir];
    [-1, 1].forEach((side) => {
      const ex = cx + side * r * 0.4; const ey = cy - 2;
      ctx.fillStyle = COLORS.white;
      ctx.beginPath(); ctx.ellipse(ex, ey, 2.8, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.navy;
      ctx.beginPath(); ctx.arc(ex + dx * 1.3, ey + dy * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
    });
  };

  const draw = () => {
    const ctx = getCtx();
    if (!ctx) return;
    const s = st.current;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    drawWalls(ctx);
    // bolinhas
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = s.dots[y][x];
        if (!v) continue;
        const cx = x * CELL + CELL / 2; const cy = TOP + y * CELL + CELL / 2;
        ctx.fillStyle = v === 2 ? COLORS.yellow : '#FFE7A8';
        if (v === 2 && Math.floor(s.t * 4) % 2) continue;
        ctx.beginPath(); ctx.arc(cx, cy, v === 2 ? 5 : 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // come-come
    const pp = pos(s.pac);
    const px = pp.x * CELL + CELL / 2; const py = TOP + pp.y * CELL + CELL / 2;
    const ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[s.pac.dir];
    let mouth = s.pac.moving ? Math.abs(Math.sin(s.t * 14)) * 0.8 + 0.05 : 0.35;
    let rad = CELL * 0.5;
    if (s.dying > 0) { mouth = Math.min(Math.PI, (1.4 - s.dying) * 3); rad *= Math.max(0.2, s.dying / 1.4); }
    ctx.fillStyle = COLORS.yellow;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, rad, ang + mouth, ang + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    if (s.dying <= 0) s.ghosts.forEach((g) => drawGhost(ctx, g, s));
    if (s.popup) {
      ctx.fillStyle = COLORS.sky; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(s.popup.v), s.popup.x * CELL + CELL / 2, TOP + s.popup.y * CELL + CELL / 2);
    }
    // placar
    ctx.font = 'bold 14px sans-serif'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.white;
    ctx.fillText(`Fase ${s.level}`, 8, TOP / 2 + 1);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.yellow;
    ctx.fillText('●'.repeat(Math.max(0, s.lives)), W - 8, TOP / 2 + 1);
    if ((s.ready > 0 && s.dying <= 0) || ended.current) {
      ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = ended.current ? COLORS.red : COLORS.yellow;
      ctx.fillText(ended.current ? 'FIM DE JOGO' : s.flash > 0 ? `FASE ${s.level}!` : 'PREPARE-SE!', W / 2, TOP + 11 * CELL + CELL / 2);
    }
  };

  useRaf((dt) => { update(dt); draw(); }, running);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <canvas ref={canvasRef} style={canvasStyle} aria-label="Come-come" />
      <DPad onDir={(d, down) => { if (down) want(d); }} />
    </div>
  );
}
