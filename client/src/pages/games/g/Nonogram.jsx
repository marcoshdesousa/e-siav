// Nonograma: pinte as casas seguindo os números das linhas e colunas. 3 minutos por desenho;
// começa com 5x5 e passa para 7x7. Quanto maior e mais rápido, mais pontos.
import { useEffect, useReducer, useRef } from 'react';
import { sfx } from '../audio.js';
import { X, Timer } from 'lucide-react';
import './Nonogram.css';

const TIME = 180;
const sizeFor = (level) => (level < 2 ? 5 : 7);

const runs = (line) => {
  const out = []; let n = 0;
  for (const v of line) { if (v) n += 1; else if (n) { out.push(n); n = 0; } }
  if (n) out.push(n);
  return out.length ? out : [0];
};
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function makePuzzle(n) {
  for (;;) {
    const density = 0.5 + Math.random() * 0.15;
    const sol = Array.from({ length: n * n }, () => (Math.random() < density ? 1 : 0));
    const rows = []; const cols = [];
    for (let r = 0; r < n; r++) rows.push(runs(sol.slice(r * n, r * n + n)));
    for (let c = 0; c < n; c++) cols.push(runs(Array.from({ length: n }, (_, r) => sol[r * n + c])));
    // Evita desenhos sem graça (linha ou coluna toda vazia, ou cheio demais).
    const filled = sol.reduce((a, b) => a + b, 0);
    if (rows.some((x) => x[0] === 0) || cols.some((x) => x[0] === 0)) continue;
    if (filled > n * n * 0.72) continue;
    return { n, rows, cols };
  }
}

function newLevel(level) {
  const p = makePuzzle(sizeFor(level));
  return { ...p, cells: Array(p.n * p.n).fill(0), start: Date.now(), left: TIME, solved: false };
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { level: 0, score: 0, mode: 'fill', over: false, pz: newLevel(0), last: 0 };
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef({ next: null, end: null });
  const ended = useRef(false);
  const drag = useRef(null);
  const gridRef = useRef(null);

  const finish = () => {
    const s = st.current;
    if (s.over) return;
    s.over = true;
    sfx('lose');
    cbs.current.onScore(s.score);
    timers.current.end = setTimeout(() => {
      if (ended.current) return;
      ended.current = true;
      cbs.current.onEnd(st.current.score);
    }, 1500);
    render();
  };

  useEffect(() => {
    const t = setInterval(() => {
      const s = st.current;
      if (s.over || s.pz.solved) return;
      const left = Math.max(0, TIME - Math.floor((Date.now() - s.pz.start) / 1000));
      if (left !== s.pz.left) {
        s.pz.left = left;
        if (left <= 10 && left > 0) sfx('tap');
        if (left === 0) finish(); else render();
      }
    }, 250);
    const tm = timers.current;
    return () => { clearInterval(t); clearTimeout(tm.next); clearTimeout(tm.end); };
  }, []);

  const check = () => {
    const s = st.current;
    const { n, rows, cols, cells } = s.pz;
    for (let r = 0; r < n; r++) if (!same(runs(cells.slice(r * n, r * n + n).map((v) => (v === 1 ? 1 : 0))), rows[r])) return;
    for (let c = 0; c < n; c++) if (!same(runs(Array.from({ length: n }, (_, r) => (cells[r * n + c] === 1 ? 1 : 0))), cols[c])) return;
    s.pz.solved = true;
    const pts = n * n * 4 + s.pz.left * (n - 3);
    s.last = pts;
    s.score += pts;
    sfx('win');
    cbs.current.onScore(s.score);
    drag.current = null;
    timers.current.next = setTimeout(() => {
      const t = st.current;
      if (t.over) return;
      t.level += 1;
      t.pz = newLevel(t.level);
      render();
    }, 1600);
  };

  const apply = (i, value) => {
    const s = st.current;
    if (s.pz.cells[i] === value) return;
    s.pz.cells[i] = value;
    sfx(value === 1 ? 'tap' : 'move');
    check();
    render();
  };

  const cellAt = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const v = el && el.getAttribute && el.getAttribute('data-i');
    return v == null ? -1 : Number(v);
  };

  const onDown = (e) => {
    const s = st.current;
    if (s.over || s.pz.solved) return;
    const i = cellAt(e);
    if (i < 0) return;
    e.preventDefault();
    const want = s.mode === 'fill' ? 1 : 2;
    const value = s.pz.cells[i] === want ? 0 : want;
    drag.current = { value, id: e.pointerId };
    apply(i, value);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || st.current.pz.solved) return;
    const i = cellAt(e);
    if (i < 0) return;
    const cur = st.current.pz.cells[i];
    // Ao arrastar: pinta só casas vazias e apaga só casas do mesmo tipo (pintado ou marcado).
    const want = st.current.mode === 'fill' ? 1 : 2;
    if (d.value === 0 ? cur === want : cur === 0) apply(i, d.value);
  };
  const onUp = () => { drag.current = null; };

  const setMode = (m) => { st.current.mode = m; sfx('tap'); render(); };

  const s = st.current;
  const { n, rows, cols, cells } = s.pz;
  const rowOk = rows.map((cl, r) => same(runs(cells.slice(r * n, r * n + n).map((v) => (v === 1 ? 1 : 0))), cl));
  const colOk = cols.map((cl, c) => same(runs(Array.from({ length: n }, (_, r) => (cells[r * n + c] === 1 ? 1 : 0))), cl));
  const left = s.pz.left;
  const timeTxt = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');

  return (
    <div className="nonogram">
      <div className="nonogram-top">
        <span>Desenho <b>{s.level + 1}</b> <small>({n}x{n})</small></span>
        <span className={left <= 20 ? 'nonogram-hurry' : ''}><Timer size={14} style={{ verticalAlign: '-2px' }} /> <b>{timeTxt}</b></span>
        <span>Pontos <b>{s.score}</b></span>
      </div>
      <div className="nonogram-timebar"><i style={{ width: (left / TIME) * 100 + '%' }} /></div>
      <div className="nonogram-board" style={{ '--n': n }}>
        <div className="nonogram-corner" />
        <div className="nonogram-cols">
          {cols.map((cl, c) => (
            <div key={c} className={'nonogram-clue nonogram-colclue' + (colOk[c] ? ' nonogram-ok' : '')}>
              {cl.map((v, k) => <span key={k}>{v}</span>)}
            </div>
          ))}
        </div>
        <div className="nonogram-rows">
          {rows.map((cl, r) => (
            <div key={r} className={'nonogram-clue nonogram-rowclue' + (rowOk[r] ? ' nonogram-ok' : '')}>
              {cl.map((v, k) => <span key={k}>{v}</span>)}
            </div>
          ))}
        </div>
        <div
          ref={gridRef}
          className={'nonogram-grid' + (s.pz.solved ? ' nonogram-solved' : '') + (s.over ? ' nonogram-over' : '')}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
        >
          {cells.map((v, i) => (
            <div
              key={i}
              data-i={i}
              className={'nonogram-cell' + (v === 1 ? ' nonogram-fill' : v === 2 ? ' nonogram-x' : '')}
            >
              {v === 2 ? <X size="70%" /> : ''}
            </div>
          ))}
        </div>
      </div>
      <div className="nonogram-modes">
        <button type="button" className={'nonogram-mode' + (s.mode === 'fill' ? ' nonogram-mode-on' : '')} onClick={() => setMode('fill')}>■ Pintar</button>
        <button type="button" className={'nonogram-mode' + (s.mode === 'x' ? ' nonogram-mode-on' : '')} onClick={() => setMode('x')}><X size={14} /> Marcar vazio</button>
      </div>
      <div className={'nonogram-msg' + (s.pz.solved ? ' nonogram-msg-win' : s.over ? ' nonogram-msg-lose' : '')}>
        {s.over ? 'O tempo acabou!' : s.pz.solved ? `Desenho completo! +${s.last}` : 'Toque ou arraste para pintar as casas.'}
      </div>
    </div>
  );
}
