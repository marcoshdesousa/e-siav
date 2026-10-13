// Torre de Hanói: leve todos os discos para a última torre, sem pôr disco maior sobre menor.
import { useEffect, useReducer, useRef } from 'react';
import { useKeys } from '../kit.js';
import { sfx } from '../audio.js';
import './Hanoi.css';

const FIRST = 3;
const LAST = 7;
const DISK_COLORS = ['#E92A2F', '#F58A3A', '#F9C71D', '#5BD38A', '#18875A', '#7FB2FF', '#2B54B0'];
const optimal = (n) => 2 ** n - 1;
const levelScore = (n, moves) => Math.max(10, optimal(n) * 10 - Math.max(0, moves - optimal(n)) * 5);

function newLevel(n) {
  return { n, towers: [Array.from({ length: n }, (_, i) => n - i), [], []], moves: 0, sel: null, done: false };
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { ...newLevel(FIRST), total: 0, cursor: 0, last: 0, over: false, bad: null };
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

  useEffect(() => {
    cbs.current.onScore(0);
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const tapTower = (i) => {
    const s = st.current;
    if (s.over || s.done) return;
    s.cursor = i;
    if (s.sel == null) {
      if (!s.towers[i].length) { sfx('error'); s.bad = i; render(); later(() => { st.current.bad = null; render(); }, 300); return; }
      s.sel = i; sfx('tap'); render(); return;
    }
    if (s.sel === i) { s.sel = null; render(); return; }
    const from = s.towers[s.sel]; const to = s.towers[i];
    const d = from[from.length - 1];
    if (to.length && to[to.length - 1] < d) {
      sfx('error'); s.bad = i; s.sel = null; render();
      later(() => { st.current.bad = null; render(); }, 300);
      return;
    }
    from.pop(); to.push(d); s.moves += 1; s.sel = null; s.last = d;
    sfx('move');
    if (to.length === s.n && i === 2) {
      s.done = true;
      const pts = levelScore(s.n, s.moves);
      s.gained = pts;
      s.total += pts;
      cbs.current.onScore(s.total);
      sfx('win');
      if (s.n >= LAST) {
        s.over = true;
        later(() => cbs.current.onEnd(st.current.total), 1400);
      } else {
        later(() => { const cur = st.current; Object.assign(cur, newLevel(cur.n + 1)); cur.cursor = 0; render(); }, 1400);
      }
    }
    render();
  };

  useKeys((k, down) => {
    if (!down) return;
    const s = st.current;
    if (k === 'left') { s.cursor = (s.cursor + 2) % 3; render(); }
    else if (k === 'right') { s.cursor = (s.cursor + 1) % 3; render(); }
    else if (k === 'action' || k === 'up' || k === 'down') tapTower(s.cursor);
  });

  const s = st.current;
  const opt = optimal(s.n);
  return (
    <div className="hanoi">
      <div className="hanoi-top">
        <span>Fase <b>{s.n - FIRST + 1}</b>/{LAST - FIRST + 1}</span>
        <span>Movimentos: <b>{s.moves}</b> <small>(mínimo {opt})</small></span>
      </div>
      <div className="hanoi-board">
        {s.towers.map((t, i) => (
          <button
            key={i}
            type="button"
            className={'hanoi-tower' + (s.sel === i ? ' hanoi-sel' : '') + (s.cursor === i ? ' hanoi-cur' : '') + (s.bad === i ? ' hanoi-bad' : '') + (i === 2 ? ' hanoi-goal' : '')}
            onClick={() => tapTower(i)}
            aria-label={'Torre ' + (i + 1)}
          >
            <span className="hanoi-pole" />
            <span className="hanoi-stack">
              {t.map((d, j) => (
                <span
                  key={d}
                  className={'hanoi-disk' + (s.sel === i && j === t.length - 1 ? ' hanoi-lift' : '') + (s.last === d && s.sel !== i ? ' hanoi-drop' : '')}
                  style={{ width: `${28 + (d / LAST) * 68}%`, background: DISK_COLORS[d - 1] }}
                />
              ))}
            </span>
            <span className="hanoi-base" />
            {i === 2 && <span className="hanoi-flag">🏁</span>}
          </button>
        ))}
        {s.done && (
          <div className="hanoi-msg">
            <b>{s.n >= LAST ? 'Você completou todas as torres!' : 'Torre completa!'}</b>
            <span>+{s.gained} pontos</span>
          </div>
        )}
      </div>
      <div className="hanoi-foot">
        <span>Pontos: <b>{s.total}</b></span>
        <span className="hanoi-hint">Toque numa torre para pegar o disco e noutra para soltar.</span>
      </div>
    </div>
  );
}
