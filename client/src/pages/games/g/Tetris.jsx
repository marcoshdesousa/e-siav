// Blocos: tetris clássico 10x20 com as 7 peças, prévia da próxima e níveis.
import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, RotateCw } from 'lucide-react';
import { COLORS, shuffle, useKeys, useRaf, useCanvas } from '../kit.js';
import { sfx } from '../audio.js';
import './Tetris.css';

const COLS = 10; const ROWS = 20; const CELL = 20;
const W = 300; const H = ROWS * CELL; // 200px de tabuleiro + 100px de painel
const PX = COLS * CELL;

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};
const PIECE_COLORS = {
  I: COLORS.sky, O: COLORS.yellow, T: '#A66BFF', S: COLORS.lime, Z: COLORS.red, J: COLORS.blue, L: '#F58A3A',
};
const LINE_POINTS = [0, 100, 300, 500, 800];

const rotate = (m) => m[0].map((_, c) => m.map((row) => row[c]).reverse());

function newState() {
  return {
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    bag: [], piece: null, next: null, score: 0, lines: 0, level: 1, acc: 0, lockT: 0, resets: 0, over: false, flash: 0,
  };
}

function takeFromBag(s) {
  if (!s.bag.length) s.bag = shuffle(Object.keys(SHAPES));
  return s.bag.pop();
}

function collides(s, m, x, y) {
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue;
      const bx = x + c; const by = y + r;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && s.board[by][bx]) return true;
    }
  }
  return false;
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const [canvasRef, getCtx] = useCanvas(W, H);
  const st = useRef(null);
  const repeat = useRef(null);

  const spawn = (s) => {
    const type = s.next || takeFromBag(s);
    s.next = takeFromBag(s);
    const m = SHAPES[type];
    const p = { type, m, x: Math.floor((COLS - m[0].length) / 2), y: type === 'I' ? -1 : 0 };
    s.piece = p;
    if (collides(s, p.m, p.x, p.y)) {
      s.over = true;
      clearInterval(repeat.current);
      cbs.current.onEnd(s.score);
    }
  };

  if (!st.current) { st.current = newState(); spawn(st.current); }

  useEffect(() => () => clearInterval(repeat.current), []);

  const addScore = (s, n) => {
    if (!n) return;
    s.score += n;
    cbs.current.onScore(s.score);
  };

  const lock = (s) => {
    const p = s.piece;
    p.m.forEach((row, r) => row.forEach((v, c) => {
      if (v && p.y + r >= 0) s.board[p.y + r][p.x + c] = p.type;
    }));
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (s.board[r].every(Boolean)) {
        s.board.splice(r, 1);
        s.board.unshift(Array(COLS).fill(null));
        cleared += 1;
        r += 1;
      }
    }
    if (cleared) {
      addScore(s, LINE_POINTS[cleared] * s.level);
      s.lines += cleared;
      s.level = 1 + Math.floor(s.lines / 10);
      s.flash = 0.15;
      sfx('point');
    } else sfx('tap');
    s.acc = 0; s.lockT = 0; s.resets = 0;
    spawn(s);
  };

  const softDown = (s) => {
    const p = s.piece;
    if (!collides(s, p.m, p.x, p.y + 1)) { p.y += 1; addScore(s, 1); } else lock(s);
  };

  const resetLock = (s) => {
    if (s.lockT > 0 && s.resets < 15) { s.lockT = 0; s.resets += 1; }
  };

  const act = (a) => {
    const s = st.current;
    if (!s || s.over) return;
    const p = s.piece;
    if (a === 'left' || a === 'right') {
      const dx = a === 'left' ? -1 : 1;
      if (!collides(s, p.m, p.x + dx, p.y)) { p.x += dx; resetLock(s); sfx('move'); }
    } else if (a === 'rotate') {
      if (p.type === 'O') return;
      const m = rotate(p.m);
      const kicks = p.type === 'I' ? [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]] : [[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]];
      for (const [kx, ky] of kicks) {
        if (!collides(s, m, p.x + kx, p.y + ky)) { p.m = m; p.x += kx; p.y += ky; resetLock(s); sfx('move'); break; }
      }
    } else if (a === 'down') {
      s.acc = 0;
      softDown(s);
    } else if (a === 'drop') {
      let n = 0;
      while (!collides(s, p.m, p.x, p.y + 1)) { p.y += 1; n += 1; }
      addScore(s, n * 2);
      lock(s);
    }
  };

  useKeys((k, isDown) => {
    if (!isDown) return;
    if (k === 'up') act('rotate');
    else if (k === 'action') act('drop');
    else act(k);
  });

  const stopRepeat = () => { clearInterval(repeat.current); repeat.current = null; };
  const press = (a) => (e) => {
    e.preventDefault();
    stopRepeat();
    act(a);
    if (a === 'left' || a === 'right' || a === 'down') {
      let first = true;
      repeat.current = setInterval(() => {
        if (first) { first = false; return; }
        act(a);
      }, a === 'down' ? 50 : 90);
    }
  };

  const draw = () => {
    const ctx = getCtx();
    const s = st.current;
    if (!ctx || !s) return;
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0A1230'); bg.addColorStop(1, '#1A1240');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // poço com brilho suave e grade fina
    const well = ctx.createLinearGradient(0, 0, 0, H);
    well.addColorStop(0, '#0F1A3E'); well.addColorStop(1, '#162457');
    ctx.fillStyle = well;
    ctx.fillRect(0, 0, PX, H);
    ctx.strokeStyle = 'rgba(127,178,255,0.07)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL + 0.5, 0); ctx.lineTo(c * CELL + 0.5, H); ctx.stroke(); }
    for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL + 0.5); ctx.lineTo(PX, r * CELL + 0.5); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(127,178,255,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, PX - 2, H - 2);

    // bloco de vidro: gradiente, borda clara, reflexo e brilho
    const block = (x, y, color, size = CELL, alpha = 1) => {
      ctx.globalAlpha = alpha;
      const r = Math.max(2, size * 0.16);
      const g = ctx.createLinearGradient(x, y, x + size, y + size);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.12, color); g.addColorStop(1, color);
      ctx.save();
      if (alpha === 1) { ctx.shadowColor = color; ctx.shadowBlur = size * 0.35; }
      ctx.fillStyle = g;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 1, y + 1, size - 2, size - 2, r); else ctx.rect(x + 1, y + 1, size - 2, size - 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 1, y + size * 0.62, size - 2, size * 0.38 - 1, [0, 0, r, r]); else ctx.rect(x + 1, y + size * 0.62, size - 2, size * 0.38 - 1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + size * 0.18, y + size * 0.14, size * 0.5, size * 0.14, size * 0.07); else ctx.rect(x + size * 0.18, y + size * 0.14, size * 0.5, size * 0.14); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 1.5, y + 1.5, size - 3, size - 3, r); else ctx.rect(x + 1.5, y + 1.5, size - 3, size - 3); ctx.stroke();
      ctx.globalAlpha = 1;
    };

    s.board.forEach((row, r) => row.forEach((t, c) => { if (t) block(c * CELL, r * CELL, PIECE_COLORS[t]); }));

    const p = s.piece;
    if (p && !s.over) {
      let gy = p.y;
      while (!collides(s, p.m, p.x, gy + 1)) gy += 1;
      p.m.forEach((row, r) => row.forEach((v, c) => {
        if (v && gy + r >= 0) block((p.x + c) * CELL, (gy + r) * CELL, PIECE_COLORS[p.type], CELL, 0.22);
      }));
      p.m.forEach((row, r) => row.forEach((v, c) => {
        if (v && p.y + r >= 0) block((p.x + c) * CELL, (p.y + r) * CELL, PIECE_COLORS[p.type]);
      }));
    }
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${s.flash * 2})`;
      ctx.fillRect(0, 0, PX, H);
    }

    // painel
    const cx = PX + 50;
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('PRÓXIMA', cx, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(PX + 12, 30, 76, 64);
    if (s.next) {
      const m = SHAPES[s.next];
      const rows = m.filter((row) => row.some(Boolean));
      const top = m.findIndex((row) => row.some(Boolean));
      let minC = 9; let maxC = 0;
      m.forEach((row) => row.forEach((v, c) => { if (v) { minC = Math.min(minC, c); maxC = Math.max(maxC, c); } }));
      const sz = 16;
      const ox = cx - ((maxC - minC + 1) * sz) / 2;
      const oy = 62 - (rows.length * sz) / 2;
      m.forEach((row, r) => row.forEach((v, c) => {
        if (v) block(ox + (c - minC) * sz, oy + (r - top) * sz, PIECE_COLORS[s.next], sz);
      }));
    }
    const stat = (label, val, y) => {
      ctx.fillStyle = COLORS.gray;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(label, cx, y);
      ctx.fillStyle = COLORS.yellow;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(String(val), cx, y + 22);
    };
    stat('PONTOS', s.score, 130);
    stat('NÍVEL', s.level, 190);
    stat('LINHAS', s.lines, 250);
    if (s.over) {
      ctx.fillStyle = 'rgba(11,20,48,0.7)';
      ctx.fillRect(0, 0, PX, H);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Fim de jogo', PX / 2, H / 2);
    }
  };

  useRaf((dt) => {
    const s = st.current;
    if (!s) return;
    if (s.over) {
      if (!s.drawnOver) { s.drawnOver = true; draw(); }
      return;
    }
    if (s.flash > 0) s.flash = Math.max(0, s.flash - dt);
    const p = s.piece;
    if (collides(s, p.m, p.x, p.y + 1)) {
      s.lockT += dt;
      if (s.lockT >= 0.5) lock(s);
    } else {
      s.lockT = 0;
      const interval = Math.max(0.07, 0.8 - (s.level - 1) * 0.07);
      s.acc += dt;
      if (s.acc >= interval) { s.acc = 0; p.y += 1; }
    }
    draw();
  }, true);

  const btn = (a, label, children, wide) => (
    <button
      key={a}
      type="button"
      className={'tetris-btn' + (wide ? ' tetris-btn-wide' : '')}
      aria-label={label}
      onPointerDown={press(a)}
      onPointerUp={stopRepeat}
      onPointerLeave={stopRepeat}
      onPointerCancel={stopRepeat}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );


  return (
    <div className="tetris">
      <canvas ref={canvasRef} className="tetris-canvas" />
      <div className="tetris-controls">
        {btn('left', 'Esquerda', <ChevronLeft size={26} />)}
        {btn('rotate', 'Girar', <RotateCw size={24} />)}
        {btn('right', 'Direita', <ChevronRight size={26} />)}
        {btn('down', 'Descer', <ChevronDown size={26} />)}
        {btn('drop', 'Cair de vez', <><ChevronsDown size={24} /><span>Cair</span></>, true)}
      </div>
      <p className="tetris-hint">Teclado: ← → mover, ↑ girar, ↓ descer, espaço cair.</p>
    </div>
  );
}
