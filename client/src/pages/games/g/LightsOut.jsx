// Apague as luzes: cada toque troca a luz e as vizinhas. Fases geradas a partir do tabuleiro
// apagado com toques aleatórios, então sempre têm solução.
import { useEffect, useReducer, useRef } from 'react';
import { shuffle, useKeys } from '../kit.js';
import { sfx } from '../audio.js';
import './LightsOut.css';

const N = 5;
const LEVELS = 10;
const TOTAL_SECS = 180;
const presses = (level) => 3 + level; // fase 1: 4 toques ... fase 10: 13

function toggle(board, i) {
  const r = Math.floor(i / N); const c = i % N;
  const b = [...board];
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
    const rr = r + dr; const cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) b[rr * N + cc] = !b[rr * N + cc];
  });
  return b;
}

function makeLevel(level) {
  const k = presses(level);
  for (;;) {
    const cells = shuffle(Array.from({ length: N * N }, (_, i) => i)).slice(0, k);
    let b = Array(N * N).fill(false);
    cells.forEach((i) => { b = toggle(b, i); });
    // Algumas combinações se anulam no 5x5; queremos várias luzes acesas.
    if (b.filter(Boolean).length >= Math.min(6, k + 2)) return { board: b, start: b, par: k };
  }
}

const levelScore = (par, moves) => Math.max(20, 50 + par * 10 - Math.max(0, moves - par) * 5);

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { level: 1, ...makeLevel(1), moves: 0, total: 0, left: TOTAL_SECS, cursor: 12, over: false, done: false, gained: 0 };
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const endAt = useRef(0);

  const finish = (delay) => {
    const s = st.current;
    if (s.over) return;
    s.over = true;
    render();
    later(() => cbs.current.onEnd(st.current.total), delay);
  };

  useEffect(() => {
    cbs.current.onScore(0);
    endAt.current = Date.now() + TOTAL_SECS * 1000;
    const iv = setInterval(() => {
      const s = st.current;
      if (s.over) return;
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      if (left !== s.left) {
        s.left = left;
        if (left === 0 && !s.done) { sfx('lose'); finish(1200); }
        render();
      }
    }, 250);
    const t = timers.current;
    return () => { clearInterval(iv); t.forEach(clearTimeout); };
  }, []);

  const press = (i) => {
    const s = st.current;
    if (s.over || s.done) return;
    s.cursor = i;
    s.board = toggle(s.board, i);
    s.moves += 1;
    sfx('flip');
    if (s.board.every((v) => !v)) {
      s.done = true;
      s.gained = levelScore(s.par, s.moves);
      s.total += s.gained;
      if (s.level >= LEVELS) {
        const bonus = s.left * 2;
        s.bonus = bonus;
        s.total += bonus;
        sfx('win');
        cbs.current.onScore(s.total);
        finish(1600);
      } else {
        sfx('point');
        cbs.current.onScore(s.total);
        later(() => {
          const cur = st.current;
          if (cur.over) return;
          cur.level += 1;
          Object.assign(cur, makeLevel(cur.level), { moves: 0, done: false });
          render();
        }, 1000);
      }
    }
    render();
  };

  const restart = () => {
    const s = st.current;
    if (s.over || s.done) return;
    s.board = s.start;
    sfx('tap');
    render();
  };

  useKeys((k, down) => {
    if (!down) return;
    const s = st.current;
    const r = Math.floor(s.cursor / N); const c = s.cursor % N;
    if (k === 'up' && r > 0) s.cursor -= N;
    else if (k === 'down' && r < N - 1) s.cursor += N;
    else if (k === 'left' && c > 0) s.cursor -= 1;
    else if (k === 'right' && c < N - 1) s.cursor += 1;
    else if (k === 'action') { press(s.cursor); return; }
    render();
  });

  const s = st.current;
  const mm = Math.floor(s.left / 60); const ss = String(s.left % 60).padStart(2, '0');
  const on = s.board.filter(Boolean).length;
  return (
    <div className="lightsout">
      <div className="lightsout-top">
        <span>Fase <b>{s.level}</b>/{LEVELS}</span>
        <span className={s.left <= 20 ? 'lightsout-warn' : ''}>⏱ <b>{mm}:{ss}</b></span>
        <span>Pontos: <b>{s.total}</b></span>
      </div>
      <div className={'lightsout-board' + (s.done ? ' lightsout-clear' : '')}>
        {s.board.map((v, i) => (
          <button
            key={i}
            type="button"
            className={'lightsout-cell' + (v ? ' lightsout-on' : '') + (s.cursor === i ? ' lightsout-cur' : '')}
            onClick={() => press(i)}
            aria-label={v ? 'Luz acesa' : 'Luz apagada'}
          />
        ))}
        {s.done && (
          <div className="lightsout-msg">
            <b>{s.level >= LEVELS ? 'Todas as fases!' : 'Tudo apagado!'}</b>
            <span>+{s.gained} pontos{s.bonus ? ` · bônus de tempo +${s.bonus}` : ''}</span>
          </div>
        )}
        {s.over && !s.done && <div className="lightsout-msg"><b>O tempo acabou!</b></div>}
      </div>
      <div className="lightsout-foot">
        <span>Toques: <b>{s.moves}</b> · meta: {s.par} · acesas: {on}</span>
        <button type="button" className="lightsout-btn" onClick={restart} disabled={s.over || s.done}>↺ Recomeçar fase</button>
      </div>
    </div>
  );
}
