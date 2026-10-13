// Jogo da memória: 8 pares de emojis de acampamento, natureza e Bíblia.
import { useEffect, useReducer, useRef } from 'react';
import { shuffle } from '../kit.js';
import './Memory.css';

const POOL = ['⛺', '🔥', '🧭', '🌲', '🏕️', '📖', '⭐', '🐦', '🌄', '🍃', '🕊️', '🐑', '🌈', '🔦', '🛶', '🦉', '🐟'];

const calcScore = (moves, secs) => Math.max(50, 1000 - moves * 20 - secs * 5);

function deal() {
  const chosen = shuffle(POOL).slice(0, 8);
  return shuffle([...chosen, ...chosen]).map((e, i) => ({ id: i, e, up: false, done: false }));
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { cards: deal(), open: [], moves: 0, pairs: 0, start: 0, secs: 0, over: false, busy: false };
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

  useEffect(() => {
    const t = setInterval(() => {
      const s = st.current;
      if (!s.start || s.over) return;
      const secs = Math.floor((Date.now() - s.start) / 1000);
      if (secs !== s.secs) { s.secs = secs; render(); }
    }, 250);
    const list = timers.current;
    return () => { clearInterval(t); list.forEach(clearTimeout); };
  }, []);

  const flip = (card) => {
    const s = st.current;
    if (s.over || s.busy || card.up || card.done) return;
    if (!s.start) s.start = Date.now();
    card.up = true;
    s.open.push(card);
    if (s.open.length === 2) {
      s.moves += 1;
      const [a, b] = s.open;
      if (a.e === b.e) {
        a.done = true; b.done = true;
        s.open = [];
        s.pairs += 1;
        if (s.pairs === 8) {
          s.over = true;
          s.secs = Math.floor((Date.now() - s.start) / 1000);
          const final = calcScore(s.moves, s.secs);
          cbs.current.onScore(final);
          later(() => cbs.current.onEnd(final), 700);
        }
      } else {
        s.busy = true;
        later(() => {
          a.up = false; b.up = false;
          s.open = [];
          s.busy = false;
          render();
        }, 750);
      }
    }
    render();
  };

  const s = st.current;
  const mm = String(Math.floor(s.secs / 60)).padStart(2, '0');
  const ss = String(s.secs % 60).padStart(2, '0');
  return (
    <div className="memory">
      <div className="memory-top">
        <span>Jogadas: <b>{s.moves}</b></span>
        <span>Pares: <b>{s.pairs}/8</b></span>
        <span>⏱ <b>{mm}:{ss}</b></span>
      </div>
      <div className="memory-grid">
        {s.cards.map((c) => (
          <button
            key={c.id}
            type="button"
            className={'memory-card' + (c.up || c.done ? ' memory-up' : '') + (c.done ? ' memory-done' : '')}
            onClick={() => flip(c)}
            aria-label={c.up || c.done ? c.e : 'Carta virada'}
          >
            <span className="memory-inner">
              <span className="memory-back">✦</span>
              <span className="memory-front">{c.e}</span>
            </span>
          </button>
        ))}
      </div>
      {s.over && <p className="memory-win">Muito bem! Todos os pares encontrados 🎉</p>}
    </div>
  );
}
