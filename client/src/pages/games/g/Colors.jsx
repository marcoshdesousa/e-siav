import { useEffect, useRef, useState } from 'react';
import { rand, shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './Colors.css';

const COLS = [
  { word: 'VERMELHO', label: 'Vermelho', c: '#E92A2F' },
  { word: 'AZUL', label: 'Azul', c: '#3D7BFF' },
  { word: 'VERDE', label: 'Verde', c: '#22B36B' },
  { word: 'AMARELO', label: 'Amarelo', c: '#F9C71D' },
  { word: 'ROXO', label: 'Roxo', c: '#A05CE0' },
  { word: 'LARANJA', label: 'Laranja', c: '#FF8A1F' },
];
const BASE = 3200;
const MIN = 900;

function makeQ(n) {
  const w = rand(COLS.length);
  let ink = rand(COLS.length - 1);
  if (ink >= w) ink += 1;
  const others = shuffle(COLS.map((_, i) => i).filter((i) => i !== w && i !== ink)).slice(0, 2);
  return { id: n, w, ink, opts: shuffle([ink, w, ...others]), limit: Math.max(MIN, Math.round(BASE * 0.94 ** n)) };
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [count, setCount] = useState(3);
  const [q, setQ] = useState(() => makeQ(0));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(null); // null | { picked, why }
  const [pop, setPop] = useState(null);
  const st = useRef({ n: 0, score: 0, start: 0, over: false });
  const timer = useRef(null);

  const finish = (picked, why) => {
    const s = st.current;
    if (s.over) return;
    s.over = true;
    sfx('error');
    clearTimeout(timer.current);
    setOver({ picked, why });
    cb.current.onEnd(Math.max(0, s.score));
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (count <= 0) return undefined;
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [count]);

  // Cronômetro da pergunta atual.
  useEffect(() => {
    if (count !== 0 || st.current.over) return undefined;
    st.current.start = Date.now();
    timer.current = setTimeout(() => finishRef.current(-1, 'Tempo esgotado!'), q.limit);
    return () => clearTimeout(timer.current);
  }, [count, q]);

  const answer = (i) => {
    const s = st.current;
    if (count > 0 || s.over) return;
    const c = q.opts[i];
    if (c !== q.ink) { finish(c, 'Cor errada!'); return; }
    const frac = Math.max(0, 1 - (Date.now() - s.start) / q.limit);
    const bonus = Math.round(frac * 10);
    s.score += 10 + bonus;
    sfx('point');
    s.n += 1;
    setScore(s.score);
    setPop({ id: s.n, text: bonus >= 7 ? `+${10 + bonus} Rápido!` : `+${10 + bonus}` });
    cb.current.onScore(s.score);
    setQ(makeQ(s.n));
  };
  const ansRef = useRef(answer);
  ansRef.current = answer;

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i < 0 || e.repeat) return;
      e.preventDefault();
      ansRef.current(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const playing = count === 0 && !over;

  return (
    <div className="colors">
      <div className="colors-hud">
        <span>Acertos: <b>{st.current.n}</b></span>
        <span><b>{score}</b> pts</span>
      </div>
      <div className="colors-bar">
        {playing && <i key={q.id} style={{ animationDuration: q.limit + 'ms' }} />}
      </div>
      <div className="colors-stage">
        {count > 0 ? (
          <>
            <b className="colors-count">{count}</b>
            <small>Toque na COR da tinta, não na palavra!</small>
          </>
        ) : (
          <>
            <b className="colors-word" style={{ color: COLS[q.ink].c }}>{COLS[q.w].word}</b>
            {over ? <small className="colors-msg">{over.why} A cor era {COLS[q.ink].label.toLowerCase()}.</small>
              : pop && <small key={pop.id} className="colors-pop">{pop.text}</small>}
          </>
        )}
      </div>
      <div className="colors-opts">
        {q.opts.map((c, i) => {
          let cls = 'colors-opt';
          if (over) {
            if (c === q.ink) cls += ' colors-right';
            else if (c === over.picked) cls += ' colors-wrong';
            else cls += ' colors-dim';
          }
          return (
            <button
              key={i}
              type="button"
              className={cls}
              style={{ '--c': COLS[c].c }}
              disabled={!playing}
              onPointerDown={(e) => { e.preventDefault(); answer(i); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); answer(i); } }}
            >
              <small>{i + 1}</small>
              <span className="colors-swatch" />
              {COLS[c].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
