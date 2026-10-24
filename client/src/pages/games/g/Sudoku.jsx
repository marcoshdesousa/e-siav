// Sudoku 9x9 com solução única. 3 erros encerram. Resolver vale max(100, 2000 − 2×segundos − 100×erros).
import { useEffect, useReducer, useRef } from 'react';
import { shuffle, useKeys } from '../kit.js';
import { sfx } from '../audio.js';
import { X, Timer } from 'lucide-react';
import './Sudoku.css';

const LEVELS = { easy: { name: 'Fácil', clues: 38, mult: 1 }, medium: { name: 'Médio', clues: 30, mult: 1.5 } };
const MAX_MISTAKES = 3;
const row = (i) => Math.floor(i / 9);
const col = (i) => i % 9;
const box = (i) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

function canPut(g, i, v) {
  const r = row(i); const c = col(i);
  for (let k = 0; k < 9; k++) {
    if (g[r * 9 + k] === v || g[k * 9 + c] === v) return false;
  }
  const br = r - (r % 3); const bc = c - (c % 3);
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) if (g[(br + dr) * 9 + bc + dc] === v) return false;
  return true;
}

function fill(g) {
  const i = g.indexOf(0);
  if (i < 0) return true;
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPut(g, i, v)) { g[i] = v; if (fill(g)) return true; g[i] = 0; }
  }
  return false;
}

// Conta soluções (para em 2). Escolhe a casa com menos opções.
function countSolutions(g, limit = 2) {
  let best = -1; let bestOpts = null;
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    const opts = [];
    for (let v = 1; v <= 9; v++) if (canPut(g, i, v)) opts.push(v);
    if (!opts.length) return 0;
    if (!bestOpts || opts.length < bestOpts.length) { best = i; bestOpts = opts; if (opts.length === 1) break; }
  }
  if (best < 0) return 1;
  let n = 0;
  for (const v of bestOpts) {
    g[best] = v;
    n += countSolutions(g, limit - n);
    g[best] = 0;
    if (n >= limit) break;
  }
  return n;
}

function generate(level) {
  const sol = Array(81).fill(0);
  fill(sol);
  const puz = [...sol];
  let clues = 81;
  for (const i of shuffle([...Array(81).keys()])) {
    if (clues <= LEVELS[level].clues) break;
    const keep = puz[i];
    puz[i] = 0;
    if (countSolutions([...puz]) !== 1) puz[i] = keep; else clues -= 1;
  }
  return { sol, puz };
}

function newState(level) {
  const { sol, puz } = generate(level);
  return {
    level, sol, given: puz.map(Boolean), grid: [...puz], notes: Array(81).fill(0), sel: puz.indexOf(0), mistakes: 0,
    filled: 0, notesMode: false, start: Date.now(), secs: 0, state: 'play', bad: null, final: 0,
  };
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = newState('easy');
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef({ end: null, bad: null });
  const ended = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      const s = st.current;
      if (s.state !== 'play') return;
      const secs = Math.floor((Date.now() - s.start) / 1000);
      if (secs !== s.secs) { s.secs = secs; render(); }
    }, 500);
    const tm = timers.current;
    return () => { clearInterval(t); clearTimeout(tm.end); clearTimeout(tm.bad); };
  }, []);

  const endGame = (final, delay) => {
    cbs.current.onScore(final);
    timers.current.end = setTimeout(() => {
      if (ended.current) return;
      ended.current = true;
      cbs.current.onEnd(final);
    }, delay);
  };

  const enter = (v) => {
    const s = st.current;
    if (s.state !== 'play' || s.sel < 0 || s.given[s.sel] || s.grid[s.sel]) return;
    const i = s.sel;
    if (s.notesMode) {
      s.notes[i] ^= 1 << v;
      sfx('move');
      render();
      return;
    }
    if (s.sol[i] !== v) {
      s.mistakes += 1;
      s.bad = { i, v };
      sfx('error');
      clearTimeout(timers.current.bad);
      timers.current.bad = setTimeout(() => { st.current.bad = null; render(); }, 700);
      if (s.mistakes >= MAX_MISTAKES) {
        s.state = 'lost';
        sfx('lose');
        s.final = s.filled * 5;
        endGame(s.final, 1600);
      }
      render();
      return;
    }
    s.grid[i] = v;
    s.notes[i] = 0;
    // Tira a anotação desse número da linha, coluna e quadrado.
    for (let k = 0; k < 81; k++) if (row(k) === row(i) || col(k) === col(i) || box(k) === box(i)) s.notes[k] &= ~(1 << v);
    s.filled += 1;
    s.bad = null;
    if (s.grid.every((x, k) => x === s.sol[k])) {
      s.state = 'won';
      s.secs = Math.floor((Date.now() - s.start) / 1000);
      s.final = Math.round(Math.max(100, 2000 - s.secs * 2 - s.mistakes * 100) * LEVELS[s.level].mult);
      sfx('win');
      endGame(s.final, 1500);
    } else {
      const unitDone = [row, col, box].some((f) => s.grid.every((x, k) => f(k) !== f(i) || x));
      sfx(unitDone ? 'point' : 'tap');
      cbs.current.onScore(s.filled * 5);
    }
    render();
  };

  const erase = () => {
    const s = st.current;
    if (s.state !== 'play' || s.sel < 0 || s.grid[s.sel]) return;
    if (s.notes[s.sel]) { s.notes[s.sel] = 0; sfx('move'); render(); }
  };

  const select = (i) => {
    const s = st.current;
    if (s.state !== 'play') return;
    s.sel = i;
    render();
  };

  const changeLevel = (level) => {
    const s = st.current;
    if (s.level === level || s.filled > 0 || s.mistakes > 0 || s.state !== 'play') return;
    st.current = newState(level);
    sfx('flip');
    render();
  };

  useKeys((k, down) => {
    if (!down) return;
    const s = st.current;
    if (s.state !== 'play') return;
    const i = s.sel < 0 ? 0 : s.sel;
    const r = row(i); const c = col(i);
    if (k === 'up') select(((r + 8) % 9) * 9 + c);
    else if (k === 'down') select(((r + 1) % 9) * 9 + c);
    else if (k === 'left') select(r * 9 + ((c + 8) % 9));
    else if (k === 'right') select(r * 9 + ((c + 1) % 9));
  });

  const enterRef = useRef(null);
  enterRef.current = { enter, erase };
  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (m) { e.preventDefault(); enterRef.current.enter(Number(m[1])); } else if (e.code === 'Backspace' || e.code === 'Delete') enterRef.current.erase();
      else if (e.code === 'KeyN') { st.current.notesMode = !st.current.notesMode; render(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const s = st.current;
  const selV = s.sel >= 0 ? s.grid[s.sel] : 0;
  const counts = Array(10).fill(0);
  s.grid.forEach((v) => { counts[v] += 1; });
  const mm = String(Math.floor(s.secs / 60)).padStart(2, '0');
  const ss = String(s.secs % 60).padStart(2, '0');
  const canChange = s.filled === 0 && s.mistakes === 0 && s.state === 'play';

  return (
    <div className="sudoku">
      <div className="sudoku-top">
        <div className="sudoku-levels">
          {Object.entries(LEVELS).map(([id, l]) => (
            <button key={id} type="button" className={'sudoku-level' + (s.level === id ? ' sudoku-level-on' : '')} onClick={() => changeLevel(id)} disabled={!canChange && s.level !== id}>{l.name}</button>
          ))}
        </div>
        <span><Timer size={14} style={{ verticalAlign: '-2px' }} /> <b>{mm}:{ss}</b></span>
        <span className="sudoku-mistakes" aria-label={'Erros: ' + s.mistakes}>
          {Array.from({ length: MAX_MISTAKES }, (_, k) => <i key={k} className={k < s.mistakes ? 'sudoku-x' : ''}><X size={14} /></i>)}
        </span>
      </div>
      <div className={'sudoku-grid' + (s.state === 'won' ? ' sudoku-won' : s.state === 'lost' ? ' sudoku-lost' : '')}>
        {s.grid.map((v, i) => {
          const sel = i === s.sel;
          const peer = s.sel >= 0 && !sel && (row(i) === row(s.sel) || col(i) === col(s.sel) || box(i) === box(s.sel));
          const same = selV && v === selV;
          const bad = s.bad && s.bad.i === i;
          const cls = 'sudoku-cell' + (s.given[i] ? ' sudoku-given' : v ? ' sudoku-mine' : '') + (sel ? ' sudoku-sel' : peer ? ' sudoku-peer' : '')
            + (same ? ' sudoku-same' : '') + (bad ? ' sudoku-bad' : '') + (col(i) % 3 === 2 && col(i) < 8 ? ' sudoku-br' : '') + (row(i) % 3 === 2 && row(i) < 8 ? ' sudoku-bb' : '');
          return (
            <button key={i} type="button" className={cls} onClick={() => select(i)} aria-label={'Linha ' + (row(i) + 1) + ', coluna ' + (col(i) + 1) + (v ? ': ' + v : ': vazia')}>
              {v ? v : bad ? s.bad.v : s.notes[i] ? (
                <span className="sudoku-notes">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <i key={n}>{s.notes[i] & (1 << n) ? n : ''}</i>)}
                </span>
              ) : ''}
            </button>
          );
        })}
      </div>
      <div className="sudoku-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} type="button" className="sudoku-num" onClick={() => enter(n)} disabled={counts[n] >= 9 || s.state !== 'play'}>
            {n}<small>{9 - counts[n] || ''}</small>
          </button>
        ))}
      </div>
      <div className="sudoku-tools">
        <button type="button" className={'sudoku-tool' + (s.notesMode ? ' sudoku-tool-on' : '')} onClick={() => { st.current.notesMode = !st.current.notesMode; sfx('tap'); render(); }} disabled={s.state !== 'play'}>
          Anotações: {s.notesMode ? 'ligadas' : 'desligadas'}
        </button>
        <button type="button" className="sudoku-tool" onClick={erase} disabled={s.state !== 'play'}>⌫ Apagar notas</button>
      </div>
      <div className={'sudoku-msg' + (s.state !== 'play' ? ' sudoku-msg-' + s.state : '')}>
        {s.state === 'won' ? `Resolvido! ${s.final} pontos` : s.state === 'lost' ? '3 erros: fim de jogo.' : 'Escolha uma casa e depois o número.'}
      </div>
    </div>
  );
}
