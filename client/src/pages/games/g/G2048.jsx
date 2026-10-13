// 2048: deslize (ou use as setas) para juntar números iguais.
import { useEffect, useReducer, useRef } from 'react';
import { rand, useKeys, useSwipe } from '../kit.js';
import { sfx } from '../audio.js';
import './G2048.css';

const N = 4;
let nextId = 1;

function addRandom(tiles) {
  const used = new Set(tiles.map((t) => t.r * N + t.c));
  const free = [];
  for (let i = 0; i < N * N; i++) if (!used.has(i)) free.push(i);
  if (!free.length) return tiles;
  const p = free[rand(free.length)];
  return [...tiles, { id: nextId++, v: Math.random() < 0.9 ? 2 : 4, r: Math.floor(p / N), c: p % N, isNew: true, pop: false }];
}

const coord = (dir, line, i) => {
  if (dir === 'left') return [line, i];
  if (dir === 'right') return [line, N - 1 - i];
  if (dir === 'up') return [i, line];
  return [N - 1 - i, line];
};

function slide(tiles, dir) {
  const grid = Array.from({ length: N }, () => Array(N).fill(null));
  tiles.forEach((t) => { grid[t.r][t.c] = t; });
  const out = [];
  let moved = false; let gained = 0;
  for (let line = 0; line < N; line++) {
    const cells = [];
    for (let i = 0; i < N; i++) cells.push(coord(dir, line, i));
    const list = cells.map(([r, c]) => grid[r][c]).filter(Boolean);
    let pos = 0; let i = 0;
    while (i < list.length) {
      const [r, c] = cells[pos];
      const t = list[i];
      if (i + 1 < list.length && list[i + 1].v === t.v) {
        const v = t.v * 2;
        gained += v;
        out.push({ id: t.id, v, r, c, isNew: false, pop: true });
        moved = true;
        i += 2;
      } else {
        if (t.r !== r || t.c !== c) moved = true;
        out.push({ ...t, r, c, isNew: false, pop: false });
        i += 1;
      }
      pos += 1;
    }
  }
  return { tiles: out, moved, gained };
}

function canMove(tiles) {
  if (tiles.length < N * N) return true;
  const g = Array.from({ length: N }, () => Array(N).fill(0));
  tiles.forEach((t) => { g[t.r][t.c] = t.v; });
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (c + 1 < N && g[r][c] === g[r][c + 1]) return true;
      if (r + 1 < N && g[r][c] === g[r + 1][c]) return true;
    }
  }
  return false;
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { tiles: addRandom(addRandom([])), score: 0, best: 2, over: false };
  const [, render] = useReducer((x) => x + 1, 0);
  const boardRef = useRef(null);
  const endTimer = useRef(null);

  useEffect(() => () => clearTimeout(endTimer.current), []);

  const finish = () => {
    const s = st.current;
    if (s.over) return;
    s.over = true;
    render();
    cbs.current.onEnd(s.score);
  };

  const doMove = (dir) => {
    const s = st.current;
    if (s.over) return;
    const res = slide(s.tiles, dir);
    if (!res.moved) return;
    s.tiles = addRandom(res.tiles);
    sfx(res.gained ? 'point' : 'move');
    s.best = Math.max(s.best, ...s.tiles.map((t) => t.v));
    if (res.gained) { s.score += res.gained; cbs.current.onScore(s.score); }
    render();
    if (!canMove(s.tiles)) {
      s.locked = true;
      endTimer.current = setTimeout(finish, 600);
    }
  };

  useKeys((k, down) => { if (down && k !== 'action' && !st.current.locked) doMove(k); });
  useSwipe(boardRef, (d) => { if (!st.current.locked) doMove(d); });

  const s = st.current;
  return (
    <div className="g2048">
      <div className="g2048-top">
        <span className="g2048-info">Maior peça: <b>{s.best}</b>{s.best >= 2048 ? ' 🏆' : ''}</span>
        <button type="button" className="g2048-quit" onClick={finish} disabled={s.over}>Desistir</button>
      </div>
      <div className="g2048-board" ref={boardRef}>
        {Array.from({ length: N * N }, (_, i) => <div key={'c' + i} className="g2048-cell" style={{ '--r': Math.floor(i / N), '--c': i % N }} />)}
        {s.tiles.map((t) => (
          <div key={t.id} className="g2048-tile" style={{ '--r': t.r, '--c': t.c }}>
            <div
              key={t.v}
              className={'g2048-in g2048-v' + Math.min(t.v, 4096) + (t.isNew ? ' g2048-new' : '') + (t.pop ? ' g2048-pop' : '')}
              style={{ fontSize: t.v >= 1000 ? '1.35em' : t.v >= 100 ? '1.7em' : '2.1em' }}
            >
              {t.v}
            </div>
          </div>
        ))}
        {s.locked && !s.over && <div className="g2048-msg">Sem jogadas!</div>}
      </div>
      <p className="g2048-hint">Deslize o dedo ou use as setas do teclado.</p>
    </div>
  );
}
