// Pinte tudo: escolha cores para espalhar a mancha do canto de cima até cobrir o quadro todo.
// Quadros em sequência; o primeiro quadro perdido encerra o jogo.
import { useEffect, useReducer, useRef } from 'react';
import { rand } from '../kit.js';
import { sfx } from '../audio.js';
import './FloodIt.css';

const N = 12;
const MAX_MOVES = 22;
const PALETTE = [
  { c: '#E92A2F', name: 'Vermelho' },
  { c: '#F9C71D', name: 'Amarelo' },
  { c: '#18875A', name: 'Verde' },
  { c: '#2B54B0', name: 'Azul' },
  { c: '#F58A3A', name: 'Laranja' },
  { c: '#A66CE0', name: 'Roxo' },
];

const newBoard = () => Array.from({ length: N * N }, () => rand(PALETTE.length));

/** Células ligadas ao canto (0,0) com a mesma cor dele. */
function region(board) {
  const col = board[0];
  const seen = new Uint8Array(N * N);
  const stack = [0];
  seen[0] = 1;
  const out = [];
  while (stack.length) {
    const i = stack.pop();
    out.push(i);
    const r = Math.floor(i / N); const c = i % N;
    const nb = [];
    if (r > 0) nb.push(i - N);
    if (r < N - 1) nb.push(i + N);
    if (c > 0) nb.push(i - 1);
    if (c < N - 1) nb.push(i + 1);
    nb.forEach((j) => { if (!seen[j] && board[j] === col) { seen[j] = 1; stack.push(j); } });
  }
  return out;
}

function paint(board, color) {
  const b = [...board];
  region(board).forEach((i) => { b[i] = color; });
  return b;
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) {
    const board = newBoard();
    st.current = { board, owned: new Set(region(board)), moves: 0, level: 1, total: 0, state: 'play', gained: 0, over: false };
  }
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

  useEffect(() => {
    cbs.current.onScore(0);
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const choose = (color) => {
    const s = st.current;
    if (s.over || s.state !== 'play' || color === s.board[0]) return;
    s.board = paint(s.board, color);
    const reg = region(s.board);
    s.owned = new Set(reg);
    s.moves += 1;
    if (reg.length === N * N) {
      s.state = 'won';
      s.gained = (MAX_MOVES - s.moves) * 10 + 100;
      s.total += s.gained;
      sfx('win');
      cbs.current.onScore(s.total);
      later(() => {
        const cur = st.current;
        if (cur.over) return;
        cur.board = newBoard();
        cur.owned = new Set(region(cur.board));
        cur.moves = 0;
        cur.level += 1;
        cur.state = 'play';
        render();
      }, 1400);
    } else if (s.moves >= MAX_MOVES) {
      s.state = 'lost';
      s.over = true;
      sfx('lose');
      later(() => cbs.current.onEnd(st.current.total), 1500);
    } else {
      sfx('flip');
    }
    render();
  };

  useEffect(() => {
    const kd = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= PALETTE.length) { e.preventDefault(); choose(n - 1); }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, []);

  const s = st.current;
  const left = MAX_MOVES - s.moves;
  const pct = Math.round((s.owned.size / (N * N)) * 100);
  return (
    <div className="floodit">
      <div className="floodit-top">
        <span>Quadro <b>{s.level}</b></span>
        <span className={left <= 4 ? 'floodit-warn' : ''}>Jogadas: <b>{left}</b></span>
        <span>Pontos: <b>{s.total}</b></span>
      </div>
      <div className="floodit-bar"><div style={{ width: pct + '%', background: PALETTE[s.board[0]].c }} /></div>
      <div className="floodit-board">
        {s.board.map((v, i) => (
          <div
            key={i}
            className={'floodit-cell' + (s.owned.has(i) ? ' floodit-own' : '')}
            style={{ background: PALETTE[v].c, transitionDelay: s.owned.has(i) ? ((Math.floor(i / N) + (i % N)) * 12) + 'ms' : '0ms' }}
          />
        ))}
        {s.state === 'won' && (
          <div className="floodit-msg"><b>Quadro pintado!</b><span>+{s.gained} pontos</span></div>
        )}
        {s.state === 'lost' && (
          <div className="floodit-msg"><b>Acabaram as jogadas</b><span className="floodit-lost">Faltou {100 - pct}% do quadro</span></div>
        )}
      </div>
      <div className="floodit-colors">
        {PALETTE.map((p, i) => (
          <button
            key={p.c}
            type="button"
            className={'floodit-btn' + (s.board[0] === i ? ' floodit-cur' : '')}
            style={{ background: p.c }}
            onClick={() => choose(i)}
            disabled={s.state !== 'play'}
            aria-label={p.name}
          >
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
      <p className="floodit-hint">A mancha começa no canto de cima, à esquerda. Teclas 1 a 6 também funcionam.</p>
    </div>
  );
}
