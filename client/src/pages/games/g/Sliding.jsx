// Quebra-cabeça 15: deslize as peças até ordenar de 1 a 15.
import { useEffect, useReducer, useRef } from 'react';
import { rand, useKeys, useSwipe } from '../kit.js';
import { sfx } from '../audio.js';
import './Sliding.css';

const N = 4;
const SOLVED = [...Array.from({ length: N * N - 1 }, (_, i) => i + 1), 0];
const calcScore = (moves, secs) => Math.max(50, 2000 - moves * 5 - secs * 3);
const isSolved = (b) => b.every((v, i) => v === SOLVED[i]);

// Embaralha com movimentos válidos a partir do resolvido: sempre tem solução.
function scramble() {
  let b; let tries = 0;
  do {
    b = [...SOLVED];
    let empty = N * N - 1; let prev = -1;
    for (let k = 0; k < 400; k++) {
      const r = Math.floor(empty / N); const c = empty % N;
      const opts = [];
      if (r > 0) opts.push(empty - N);
      if (r < N - 1) opts.push(empty + N);
      if (c > 0) opts.push(empty - 1);
      if (c < N - 1) opts.push(empty + 1);
      const choices = opts.filter((o) => o !== prev);
      const t = choices[rand(choices.length)];
      b[empty] = b[t]; b[t] = 0; prev = empty; empty = t;
    }
    tries += 1;
  } while (tries < 10 && b.filter((v, i) => v && v === SOLVED[i]).length > 4);
  return b;
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { board: scramble(), moves: 0, start: 0, secs: 0, over: false, won: false };
  const [, render] = useReducer((x) => x + 1, 0);
  const boardRef = useRef(null);
  const endTimer = useRef(null);

  useEffect(() => {
    const t = setInterval(() => {
      const s = st.current;
      if (!s.start || s.over) return;
      const secs = Math.floor((Date.now() - s.start) / 1000);
      if (secs !== s.secs) { s.secs = secs; render(); }
    }, 250);
    return () => { clearInterval(t); clearTimeout(endTimer.current); };
  }, []);

  // Move a peça do índice i (na mesma linha/coluna do vazio), empurrando as do meio.
  const moveFrom = (i) => {
    const s = st.current;
    if (s.over) return;
    const b = s.board;
    const e = b.indexOf(0);
    const er = Math.floor(e / N); const ec = e % N; const r = Math.floor(i / N); const c = i % N;
    let step;
    if (r === er && c !== ec) step = c > ec ? 1 : -1;
    else if (c === ec && r !== er) step = r > er ? N : -N;
    else return;
    if (!s.start) s.start = Date.now();
    let cur = e;
    while (cur !== i) { b[cur] = b[cur + step]; cur += step; s.moves += 1; }
    b[i] = 0;
    sfx('move');
    if (isSolved(b)) {
      sfx('point');
      s.over = true; s.won = true;
      s.secs = Math.floor((Date.now() - s.start) / 1000);
      const final = calcScore(s.moves, s.secs);
      cbs.current.onScore(final);
      endTimer.current = setTimeout(() => cbs.current.onEnd(final), 900);
    }
    render();
  };

  // Direção = para onde a peça anda (a peça do lado oposto entra no vazio).
  const moveDir = (dir) => {
    const e = st.current.board.indexOf(0);
    const r = Math.floor(e / N); const c = e % N;
    if (dir === 'left' && c < N - 1) moveFrom(e + 1);
    else if (dir === 'right' && c > 0) moveFrom(e - 1);
    else if (dir === 'up' && r < N - 1) moveFrom(e + N);
    else if (dir === 'down' && r > 0) moveFrom(e - N);
  };

  useKeys((k, down) => { if (down && k !== 'action') moveDir(k); });
  useSwipe(boardRef, moveDir);

  const giveUp = () => {
    const s = st.current;
    if (s.over) return;
    s.over = true;
    render();
    cbs.current.onEnd(0);
  };

  const s = st.current;
  const pos = {};
  s.board.forEach((v, i) => { if (v) pos[v] = i; });
  const mm = String(Math.floor(s.secs / 60)).padStart(2, '0');
  const ss = String(s.secs % 60).padStart(2, '0');
  return (
    <div className="sliding">
      <div className="sliding-top">
        <span>Movimentos: <b>{s.moves}</b></span>
        <span>⏱ <b>{mm}:{ss}</b></span>
        <button type="button" className="sliding-quit" onClick={giveUp} disabled={s.over}>Desistir</button>
      </div>
      <div className={'sliding-board' + (s.won ? ' sliding-won' : '')} ref={boardRef}>
        {Array.from({ length: N * N - 1 }, (_, k) => k + 1).map((v) => {
          const i = pos[v];
          return (
            <button
              key={v}
              type="button"
              className={'sliding-tile' + (i === v - 1 ? ' sliding-ok' : '')}
              style={{ '--r': Math.floor(i / N), '--c': i % N }}
              onClick={() => moveFrom(i)}
            >
              {v}
            </button>
          );
        })}
      </div>
      <p className="sliding-hint">Toque numa peça ao lado do espaço vazio, deslize o dedo ou use as setas.</p>
    </div>
  );
}
