// Trilha (moinho de nove peças) contra o computador. Você joga com as peças azuis e começa.
import { useEffect, useRef, useState } from 'react';
import { pick, rand } from '../kit.js';
import { sfx } from '../audio.js';
import './Morris.css';

// #region logic
const P = 1; const C = 2;
const XY = [[0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6]];
const MILLS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23]];
const ADJ = Array.from({ length: 24 }, () => []);
for (const [a, b, c] of MILLS) { ADJ[a].push(b); ADJ[b].push(a, c); ADJ[c].push(b); }
const MAX_TURNS = 150;
const opp = (w) => (w === P ? C : P);

function initial() {
  return { b: Array(24).fill(0), hand: [0, 9, 9], turn: P, ply: 0, removing: false };
}

const inMill = (b, sq) => !!b[sq] && MILLS.some((m) => m.includes(sq) && m.every((x) => b[x] === b[sq]));
const onBoard = (b, w) => b.reduce((n, v) => n + (v === w ? 1 : 0), 0);
const total = (st, w) => onBoard(st.b, w) + st.hand[w];

/** Passos (colocar/mover) de quem joga: { from (-1 = colocar), to }. */
function steps(st) {
  const { b, turn } = st;
  const out = [];
  if (st.hand[turn] > 0) {
    for (let i = 0; i < 24; i++) if (!b[i]) out.push({ from: -1, to: i });
    return out;
  }
  const flying = onBoard(b, turn) === 3;
  for (let i = 0; i < 24; i++) {
    if (b[i] !== turn) continue;
    const targets = flying ? [...Array(24).keys()] : ADJ[i];
    for (const t of targets) if (!b[t]) out.push({ from: i, to: t });
  }
  return out;
}

/** Peças do adversário de `who` que podem ser removidas. */
function removable(b, who) {
  const theirs = [];
  for (let i = 0; i < 24; i++) if (b[i] === opp(who)) theirs.push(i);
  const free = theirs.filter((i) => !inMill(b, i));
  return free.length ? free : theirs;
}

/** Aplica um passo; se formar moinho, fica esperando a remoção (removing = true). */
function doStep(st, s) {
  const b = st.b.slice();
  const hand = st.hand.slice();
  if (s.from < 0) hand[st.turn]--; else b[s.from] = 0;
  b[s.to] = st.turn;
  const mill = inMill(b, s.to) && removable(b, st.turn).length > 0;
  if (mill) return { ...st, b, hand, removing: true };
  return { b, hand, turn: opp(st.turn), ply: st.ply + 1, removing: false };
}

function doRemove(st, sq) {
  const b = st.b.slice();
  b[sq] = 0;
  return { b, hand: st.hand, turn: opp(st.turn), ply: st.ply + 1, removing: false };
}

/** null = em andamento; senão { winner } ou { draw: true }. Só faz sentido com removing = false. */
function status(st) {
  if (total(st, st.turn) < 3 || !steps(st).length) return { winner: opp(st.turn) };
  if (total(st, opp(st.turn)) < 3) return { winner: st.turn };
  if (st.ply >= MAX_TURNS) return { draw: true };
  return null;
}

/** Jogadas completas (passo + remoção, se houver). */
function turns(st) {
  const out = [];
  for (const s of steps(st)) {
    const n = doStep(st, s);
    if (n.removing) for (const r of removable(n.b, st.turn)) out.push({ s, r, st: doRemove(n, r) });
    else out.push({ s, r: -1, st: n });
  }
  return out;
}

function evaluate(st) {
  const me = st.turn; const op = opp(me);
  const { b } = st;
  let s = (total(st, me) - total(st, op)) * 100;
  for (const m of MILLS) {
    const mine = m.filter((x) => b[x] === me).length;
    const theirs = m.filter((x) => b[x] === op).length;
    const empty = 3 - mine - theirs;
    if (mine === 2 && empty === 1) s += 14;
    if (theirs === 2 && empty === 1) s -= 18;
    if (mine === 3) s += 8;
    if (theirs === 3) s -= 8;
  }
  if (!st.hand[me] && !st.hand[op]) {
    let mob = 0;
    for (let i = 0; i < 24; i++) {
      if (!b[i]) continue;
      const free = ADJ[i].filter((t) => !b[t]).length;
      mob += (b[i] === me ? 1 : -1) * Math.min(free, 2) * 3;
    }
    s += mob;
  }
  return s;
}

const WIN = 100000;
class Timeout extends Error {}

function negamax(st, depth, alpha, beta, ply, ctx) {
  if (++ctx.nodes % 128 === 0 && ctx.deadline && window.performance.now() > ctx.deadline) throw new Timeout();
  const res = status(st);
  if (res) return res.draw ? 0 : res.winner === st.turn ? WIN - ply : -WIN + ply;
  if (depth === 0) return evaluate(st);
  const list = turns(st).sort((x, y) => (y.r >= 0) - (x.r >= 0));
  let best = -Infinity;
  for (const t of list) {
    const s = -negamax(t.st, depth - 1, -beta, -alpha, ply + 1, ctx);
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

const MARGIN = 10;
function aiTurn(st, budget = 500, maxDepth = 3) {
  const roots = turns(st);
  const t0 = window.performance.now();
  let scored = roots.map((t) => ({ t, s: 0 }));
  for (let d = 1; d <= maxDepth; d++) {
    const ctx = { nodes: 0, deadline: d === 1 ? 0 : t0 + budget };
    try {
      let best = -Infinity;
      const res = [];
      for (const { t } of [...scored].sort((x, y) => y.s - x.s)) {
        const s = -negamax(t.st, d - 1, -Infinity, -(best - MARGIN - 1), 1, ctx);
        res.push({ t, s });
        if (s > best) best = s;
      }
      scored = res;
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      break;
    }
  }
  const best = Math.max(...scored.map((x) => x.s));
  return pick(scored.filter((x) => x.s >= best - (Math.abs(best) > WIN / 2 ? 0 : MARGIN))).t;
}
// #endregion

const pos = (i) => ({ x: 40 + XY[i][0] * 70, y: 40 + XY[i][1] * 70 });

export default function Game({ onScore, onEnd }) {
  const [st, setSt] = useState(initial);
  const [sel, setSel] = useState(-1);
  const [last, setLast] = useState([]);
  const [cpuRem, setCpuRem] = useState(null); // jogada do computador em duas etapas (mover e depois remover)
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const res = st.removing ? null : status(st);
  const outcome = res ? (res.draw ? 'draw' : res.winner === P ? 'win' : 'lose') : null;

  useEffect(() => {
    if (!outcome) return undefined;
    const pts = outcome === 'win' ? 3 : outcome === 'draw' ? 1 : 0;
    cb.current.onScore?.(pts);
    sfx(outcome === 'win' ? 'win' : outcome === 'lose' ? 'lose' : 'tap');
    const t = setTimeout(() => {
      if (ended.current) return;
      ended.current = true;
      cb.current.onEnd?.(pts);
    }, 1600);
    return () => clearTimeout(t);
  }, [outcome]);

  // Vez do computador: primeiro o passo; se formou moinho, a remoção logo depois.
  useEffect(() => {
    if (st.turn !== C || outcome) return undefined;
    if (st.removing && cpuRem != null) {
      const t = setTimeout(() => {
        sfx('hit');
        setSt(doRemove(st, cpuRem));
        setCpuRem(null);
      }, 650);
      return () => clearTimeout(t);
    }
    if (st.removing) return undefined;
    const t = setTimeout(() => {
      const tr = aiTurn(st);
      const n = doStep(st, tr.s);
      setLast(tr.s.from >= 0 ? [tr.s.from, tr.s.to] : [tr.s.to]);
      if (n.removing) { sfx('point'); setCpuRem(tr.r); } else sfx('move');
      setSt(n);
    }, 450 + rand(300));
    return () => clearTimeout(t);
  }, [st, outcome, cpuRem]);

  const myTurn = st.turn === P && !outcome;
  const mySteps = myTurn && !st.removing ? steps(st) : [];
  const remSet = new Set(myTurn && st.removing ? removable(st.b, P) : []);
  const placing = st.hand[P] > 0;
  const targets = new Set(placing ? mySteps.map((s) => s.to) : mySteps.filter((s) => s.from === sel).map((s) => s.to));
  const movable = new Set(mySteps.map((s) => s.from));

  const tap = (i) => {
    if (!myTurn || ended.current) return;
    if (st.removing) {
      if (!remSet.has(i)) { sfx('error'); return; }
      sfx('hit');
      setLast([]);
      setSt(doRemove(st, i));
      return;
    }
    if (targets.has(i)) {
      const n = doStep(st, { from: placing ? -1 : sel, to: i });
      sfx(n.removing ? 'point' : 'tap');
      setSel(-1);
      setLast([]);
      setSt(n);
      return;
    }
    if (!placing && movable.has(i)) { sfx('tap'); setSel(i); return; }
    if (st.b[i] === P) sfx('error');
    setSel(-1);
  };

  const flyingMe = !placing && onBoard(st.b, P) === 3;
  const msg = outcome
    ? outcome === 'win' ? 'Você venceu!' : outcome === 'lose' ? 'O computador venceu.' : 'Empate: limite de lances.'
    : st.turn === C ? (st.removing ? 'Moinho do computador!' : 'Computador pensando…')
      : st.removing ? 'Moinho! Remova uma peça vermelha.'
        : placing ? 'Coloque uma peça' : flyingMe ? 'Você pode voar: escolha qualquer casa' : 'Mova uma peça';

  const lines = [];
  for (const [a, b, c] of MILLS) { lines.push([a, b], [b, c]); }
  const millSet = new Set();
  for (const m of MILLS) if (st.b[m[0]] && m.every((x) => st.b[x] === st.b[m[0]])) m.forEach((x) => millSet.add(x));

  return (
    <div className="morris">
      <div className={'morris-status' + (outcome ? ' morris-status-' + outcome : st.removing ? ' morris-status-mill' : '')}>{msg}</div>
      <div className="morris-hands">
        <span className="morris-hand"><i className="morris-mini morris-p" /> Você: {st.hand[P]} na mão · {onBoard(st.b, P)} no tabuleiro</span>
        <span className="morris-hand"><i className="morris-mini morris-c" /> CPU: {st.hand[C]} · {onBoard(st.b, C)}</span>
      </div>
      <svg className={'morris-board' + (myTurn ? '' : ' morris-busy')} viewBox="0 0 500 500" role="img" aria-label="Tabuleiro da trilha">
        <rect x="4" y="4" width="492" height="492" rx="22" className="morris-bg" />
        {lines.map(([a, b]) => {
          const p = pos(a); const q = pos(b);
          return <line key={a + '-' + b} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="morris-line" />;
        })}
        {XY.map((_, i) => {
          const { x, y } = pos(i);
          const v = st.b[i];
          const cls = ['morris-pt'];
          if (v) cls.push(v === P ? 'morris-p' : 'morris-c');
          if (millSet.has(i)) cls.push('morris-inmill');
          if (i === sel) cls.push('morris-sel');
          if (remSet.has(i)) cls.push('morris-rem');
          if (st.turn === C && st.removing && i === cpuRem) cls.push('morris-rem');
          if (last.includes(i)) cls.push('morris-last');
          return (
            <g key={i} onClick={() => tap(i)} className="morris-hit">
              <circle cx={x} cy={y} r="30" fill="transparent" />
              {v ? <circle cx={x} cy={y} r="22" className={cls.join(' ')} /> : <circle cx={x} cy={y} r="8" className="morris-dot" />}
              {!v && targets.has(i) && <circle cx={x} cy={y} r="13" className="morris-target" />}
              {!placing && myTurn && !st.removing && sel < 0 && movable.has(i) && <circle cx={x} cy={y} r="27" className="morris-can" />}
            </g>
          );
        })}
      </svg>
      <div className="morris-legend">Jogada {Math.min(MAX_TURNS, st.ply + 1)} de {MAX_TURNS}</div>
    </div>
  );
}
