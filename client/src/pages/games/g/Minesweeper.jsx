// Campo minado 9x9 com 10 bombas. O primeiro toque nunca é bomba.
import { useEffect, useReducer, useRef } from 'react';
import { rand } from '../kit.js';
import { sfx } from '../audio.js';
import { Bomb, Flag, Pickaxe, Timer } from 'lucide-react';
import './Minesweeper.css';

const N = 9; const MINES = 10;
const SAFE = N * N - MINES;

const neighbors = (i) => {
  const r = Math.floor(i / N); const c = i % N; const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr; const cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
    }
  }
  return out;
};

const emptyCells = () => Array.from({ length: N * N }, () => ({ mine: false, n: 0, open: false, flag: false, boom: false }));

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { cells: emptyCells(), placed: false, opened: 0, start: 0, secs: 0, state: 'play', flagMode: false };
  const [, render] = useReducer((x) => x + 1, 0);
  const endTimer = useRef(null);
  const press = useRef({ timer: null, fired: false, type: 'mouse' });

  useEffect(() => {
    const t = setInterval(() => {
      const s = st.current;
      if (!s.start || s.state !== 'play') return;
      const secs = Math.floor((Date.now() - s.start) / 1000);
      if (secs !== s.secs) { s.secs = secs; render(); }
    }, 250);
    const p = press.current;
    return () => { clearInterval(t); clearTimeout(endTimer.current); clearTimeout(p.timer); };
  }, []);

  const placeMines = (s, first) => {
    const banned = new Set([first, ...neighbors(first)]);
    let left = MINES;
    while (left > 0) {
      const i = rand(N * N);
      if (banned.has(i) || s.cells[i].mine) continue;
      s.cells[i].mine = true;
      left -= 1;
    }
    s.cells.forEach((cell, i) => { cell.n = neighbors(i).filter((j) => s.cells[j].mine).length; });
    s.placed = true;
    s.start = Date.now();
  };

  const finish = (s, win) => {
    s.state = win ? 'win' : 'lose';
    s.secs = Math.floor((Date.now() - s.start) / 1000);
    s.cells.forEach((cell) => {
      if (cell.mine) { if (win) cell.flag = true; else if (!cell.flag) cell.open = true; }
    });
    const final = win ? Math.max(100, 1000 - s.secs * 5) : s.opened;
    cbs.current.onScore(final);
    endTimer.current = setTimeout(() => cbs.current.onEnd(final), win ? 1000 : 1300);
  };

  const openCell = (s, i) => {
    const stack = [i];
    let hitMine = false;
    while (stack.length) {
      const j = stack.pop();
      const cell = s.cells[j];
      if (cell.open || cell.flag) continue;
      cell.open = true;
      if (cell.mine) { cell.boom = true; hitMine = true; continue; }
      s.opened += 1;
      if (cell.n === 0) neighbors(j).forEach((k) => { if (!s.cells[k].open && !s.cells[k].flag) stack.push(k); });
    }
    return hitMine;
  };

  const reveal = (i) => {
    const s = st.current;
    if (s.state !== 'play') return;
    const cell = s.cells[i];
    if (cell.flag) return;
    if (!s.placed) placeMines(s, i);
    let hit = false;
    if (cell.open) {
      // Acorde: número com bandeiras suficientes abre os vizinhos.
      if (!cell.n) return;
      const nb = neighbors(i);
      if (nb.filter((j) => s.cells[j].flag).length !== cell.n) return;
      nb.forEach((j) => { if (!s.cells[j].open && !s.cells[j].flag) hit = openCell(s, j) || hit; });
    } else {
      hit = openCell(s, i);
    }
    if (hit) { sfx('hit'); finish(s, false); } else {
      sfx('tap');
      cbs.current.onScore(s.opened);
      if (s.opened === SAFE) finish(s, true);
    }
    render();
  };

  const toggleFlag = (i) => {
    const s = st.current;
    if (s.state !== 'play') return;
    const cell = s.cells[i];
    if (cell.open) return;
    cell.flag = !cell.flag;
    sfx('flip');
    if (navigator.vibrate) { try { navigator.vibrate(25); } catch { /* sem vibração */ } }
    render();
  };

  const onDown = (i) => (e) => {
    const p = press.current;
    p.type = e.pointerType || 'mouse';
    p.fired = false;
    clearTimeout(p.timer);
    if (p.type === 'mouse') return;
    p.timer = setTimeout(() => { p.fired = true; toggleFlag(i); }, 420);
  };
  const cancel = () => clearTimeout(press.current.timer);
  const onClick = (i) => () => {
    const p = press.current;
    clearTimeout(p.timer);
    if (p.fired) { p.fired = false; return; }
    if (st.current.flagMode) toggleFlag(i);
    else reveal(i);
  };
  const onContext = (i) => (e) => {
    e.preventDefault();
    // No celular o toque longo já marca a bandeira (alguns navegadores também disparam este evento).
    if (press.current.type !== 'mouse') return;
    clearTimeout(press.current.timer);
    press.current.fired = false;
    toggleFlag(i);
  };

  const s = st.current;
  const flags = s.cells.filter((c) => c.flag).length;
  return (
    <div className="minesweeper">
      <div className="minesweeper-top">
        <span className="ico"><Bomb size={15} /> <b>{MINES - flags}</b></span>
        <span>{s.state === 'win' ? 'Venceu!' : s.state === 'lose' ? 'Explodiu!' : 'Boa sorte'}</span>
        <span><Timer size={14} style={{ verticalAlign: '-2px' }} /> <b>{s.secs}s</b></span>
      </div>
      <div className="minesweeper-grid" onContextMenu={(e) => e.preventDefault()}>
        {s.cells.map((c, i) => (
          <button
            key={i}
            type="button"
            className={'minesweeper-cell' + (c.open ? ' minesweeper-open' : '') + (c.boom ? ' minesweeper-boom' : '') + (c.open && !c.mine && c.n ? ' minesweeper-n' + c.n : '')}
            onPointerDown={onDown(i)}
            onPointerUp={cancel}
            onPointerLeave={cancel}
            onPointerCancel={cancel}
            onClick={onClick(i)}
            onContextMenu={onContext(i)}
            aria-label={c.open ? (c.mine ? 'bomba' : String(c.n)) : c.flag ? 'bandeira' : 'fechado'}
          >
            {c.open ? (c.mine ? <Bomb size="60%" /> : c.n || '') : c.flag ? <Flag size="58%" color="#E5383B" fill="#E5383B" /> : ''}
          </button>
        ))}
      </div>
      <div className="minesweeper-bar">
        <button
          type="button"
          className={'minesweeper-mode' + (s.flagMode ? ' minesweeper-mode-on' : '')}
          onClick={() => { s.flagMode = !s.flagMode; render(); }}
          disabled={s.state !== 'play'}
        >
          {s.flagMode ? <><Flag size={14} /> Modo bandeira: ligado</> : <><Pickaxe size={14} /> Modo abrir: toque para usar a bandeira</>}
        </button>
      </div>
      <p className="minesweeper-hint">Segure o dedo ou use o botão direito para marcar uma bandeira.</p>
    </div>
  );
}
