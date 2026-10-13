// Joias: troque joias vizinhas para formar linhas de 3 ou mais. Quedas em cascata valem combo;
// 4 ou mais em linha limpam a fileira inteira (horizontal) ou a coluna inteira (vertical).
import { useEffect, useReducer, useRef } from 'react';
import { rand, useKeys } from '../kit.js';
import { sfx } from '../audio.js';
import './Match3.css';

const N = 8;
const TYPES = 6;
const MOVES = 30;
let nextId = 1;

const gem = (t) => ({ id: nextId++, t, from: 0, dying: false });

function newBoard() {
  for (;;) {
    const b = Array.from({ length: N }, () => Array(N).fill(null));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let t;
        do { t = rand(TYPES); } while (
          (c >= 2 && b[r][c - 1].t === t && b[r][c - 2].t === t)
          || (r >= 2 && b[r - 1][c].t === t && b[r - 2][c].t === t)
        );
        b[r][c] = { ...gem(t), from: -(N + 2) };
      }
    }
    if (hasMove(b)) return b;
  }
}

/** Grupos de 3+ iguais. Devolve as casas a limpar e quantas linhas de 4+ houve. */
function findMatches(b) {
  const clear = new Set();
  let lines = 0;
  for (let r = 0; r < N; r++) {
    let c = 0;
    while (c < N) {
      let e = c + 1;
      while (e < N && b[r][e] && b[r][c] && b[r][e].t === b[r][c].t) e++;
      if (b[r][c] && e - c >= 3) {
        if (e - c >= 4) { lines++; for (let k = 0; k < N; k++) clear.add(r * N + k); } else for (let k = c; k < e; k++) clear.add(r * N + k);
      }
      c = e;
    }
  }
  for (let c = 0; c < N; c++) {
    let r = 0;
    while (r < N) {
      let e = r + 1;
      while (e < N && b[e][c] && b[r][c] && b[e][c].t === b[r][c].t) e++;
      if (b[r][c] && e - r >= 3) {
        if (e - r >= 4) { lines++; for (let k = 0; k < N; k++) clear.add(k * N + c); } else for (let k = r; k < e; k++) clear.add(k * N + c);
      }
      r = e;
    }
  }
  return { clear, lines };
}

const swapped = (b, a, z) => {
  const nb = b.map((row) => [...row]);
  const [ar, ac] = [Math.floor(a / N), a % N]; const [zr, zc] = [Math.floor(z / N), z % N];
  [nb[ar][ac], nb[zr][zc]] = [nb[zr][zc], nb[ar][ac]];
  return nb;
};

function hasMove(b) {
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N); const c = i % N;
    if (c < N - 1 && findMatches(swapped(b, i, i + 1)).clear.size) return true;
    if (r < N - 1 && findMatches(swapped(b, i, i + N)).clear.size) return true;
  }
  return false;
}

const adjacent = (a, b) => Math.abs(a - b) === N || (Math.abs(a - b) === 1 && Math.floor(a / N) === Math.floor(b / N));

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { board: newBoard(), score: 0, moves: MOVES, busy: false, sel: null, cursor: 27, combo: 0, popup: null, over: false, shuffling: false };
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const drag = useRef(null);
  const boardRef = useRef(null);

  useEffect(() => {
    cbs.current.onScore(0);
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const settle = () => {
    const s = st.current;
    s.busy = false;
    s.combo = 0;
    if (s.moves <= 0) {
      s.over = true;
      s.busy = true;
      sfx('win');
      render();
      later(() => cbs.current.onEnd(st.current.score), 1300);
      return;
    }
    if (!hasMove(s.board)) {
      s.busy = true;
      s.shuffling = true;
      render();
      later(() => {
        const cur = st.current;
        cur.board = newBoard();
        cur.shuffling = false;
        cur.busy = false;
        render();
      }, 900);
    }
    render();
  };

  const resolve = () => {
    const s = st.current;
    const { clear, lines } = findMatches(s.board);
    if (!clear.size) { settle(); return; }
    s.combo += 1;
    const gained = clear.size * 10 * s.combo + lines * 50;
    s.score += gained;
    s.popup = { text: (s.combo > 1 ? `Combo x${s.combo}! ` : '') + `+${gained}`, key: nextId++ };
    cbs.current.onScore(s.score);
    sfx(lines ? 'coin' : s.combo > 1 ? 'point' : 'pop');
    s.board = s.board.map((row, r) => row.map((g, c) => (clear.has(r * N + c) ? { ...g, dying: true } : g)));
    render();
    later(() => {
      const cur = st.current;
      const b = Array.from({ length: N }, () => Array(N).fill(null));
      for (let c = 0; c < N; c++) {
        const keep = [];
        for (let r = N - 1; r >= 0; r--) if (!cur.board[r][c].dying) keep.push(cur.board[r][c]);
        const fresh = N - keep.length;
        for (let k = 0; k < keep.length; k++) b[N - 1 - k][c] = { ...keep[k], from: 0 };
        for (let k = 0; k < fresh; k++) b[fresh - 1 - k][c] = { ...gem(rand(TYPES)), from: -fresh };
      }
      cur.board = b;
      render();
      later(resolve, 330);
    }, 230);
  };

  const trySwap = (a, z) => {
    const s = st.current;
    if (s.busy || s.over || !adjacent(a, z)) return;
    s.sel = null;
    s.busy = true;
    s.board = swapped(s.board, a, z);
    render();
    if (!findMatches(s.board).clear.size) {
      later(() => {
        const cur = st.current;
        cur.board = swapped(cur.board, a, z);
        cur.busy = false;
        sfx('error');
        render();
      }, 200);
      return;
    }
    sfx('move');
    s.moves -= 1;
    later(resolve, 200);
  };

  const cellFrom = (e) => {
    const r = boardRef.current.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * N);
    const y = Math.floor(((e.clientY - r.top) / r.height) * N);
    if (x < 0 || y < 0 || x >= N || y >= N) return -1;
    return y * N + x;
  };

  const onDown = (e) => {
    const s = st.current;
    if (s.busy || s.over) return;
    const i = cellFrom(e);
    if (i < 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { i, x: e.clientX, y: e.clientY, used: false };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d || d.used) return;
    const dx = e.clientX - d.x; const dy = e.clientY - d.y;
    const cell = boardRef.current.getBoundingClientRect().width / N;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * 0.35) return;
    d.used = true;
    const r = Math.floor(d.i / N); const c = d.i % N;
    let z = -1;
    if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0 && c < N - 1) z = d.i + 1; if (dx < 0 && c > 0) z = d.i - 1; } else { if (dy > 0 && r < N - 1) z = d.i + N; if (dy < 0 && r > 0) z = d.i - N; }
    if (z >= 0) trySwap(d.i, z);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    const s = st.current;
    if (!d || d.used || s.busy || s.over) return;
    s.cursor = d.i;
    if (s.sel != null && adjacent(s.sel, d.i)) { trySwap(s.sel, d.i); return; }
    s.sel = s.sel === d.i ? null : d.i;
    sfx('tap');
    render();
  };

  useKeys((k, down) => {
    if (!down) return;
    const s = st.current;
    if (s.busy || s.over) return;
    if (k === 'action') { s.sel = s.sel === s.cursor ? null : s.cursor; sfx('tap'); render(); return; }
    const r = Math.floor(s.cursor / N); const c = s.cursor % N;
    let z = -1;
    if (k === 'up' && r > 0) z = s.cursor - N;
    if (k === 'down' && r < N - 1) z = s.cursor + N;
    if (k === 'left' && c > 0) z = s.cursor - 1;
    if (k === 'right' && c < N - 1) z = s.cursor + 1;
    if (z < 0) return;
    if (s.sel != null) { const a = s.sel; s.cursor = z; trySwap(a, z); return; }
    s.cursor = z;
    render();
  });

  const s = st.current;
  const items = [];
  s.board.forEach((row, r) => row.forEach((g, c) => {
    if (!g) return;
    const i = r * N + c;
    items.push(
      <div key={g.id} className="match3-slot" style={{ left: c * 12.5 + '%', top: r * 12.5 + '%', '--from': g.from }}>
        <div className={'match3-gem match3-t' + g.t + (g.dying ? ' match3-dying' : '') + (g.from ? ' match3-new' : '') + (s.sel === i ? ' match3-sel' : '')}>
          <span />
        </div>
      </div>,
    );
  }));
  return (
    <div className="match3">
      <div className="match3-top">
        <span className={s.moves <= 5 ? 'match3-warn' : ''}>Jogadas: <b>{s.moves}</b></span>
        <span>Pontos: <b>{s.score}</b></span>
      </div>
      <div
        className="match3-board"
        ref={boardRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { drag.current = null; }}
      >
        <div className="match3-cur" style={{ left: (s.cursor % N) * 12.5 + '%', top: Math.floor(s.cursor / N) * 12.5 + '%' }} />
        {items}
        {s.popup && <div key={s.popup.key} className="match3-pop">{s.popup.text}</div>}
        {s.shuffling && <div className="match3-msg"><b>Sem jogadas! Embaralhando…</b></div>}
        {s.over && <div className="match3-msg"><b>Fim das jogadas!</b><span>{s.score} pontos</span></div>}
      </div>
      <p className="match3-hint">Deslize uma joia ou toque em duas vizinhas para trocar.</p>
    </div>
  );
}

