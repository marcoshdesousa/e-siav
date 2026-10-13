// Damas (regras brasileiras, 8x8) contra o computador. Você joga de brancas e começa.
import { useEffect, useRef, useState } from 'react';
import { pick, rand } from '../kit.js';
import { sfx } from '../audio.js';
import './Checkers.css';

// #region logic
// Casas 0..63 (linha * 8 + coluna; linha 0 no topo). Só as casas escuras ((l + c) ímpar) são usadas.
// Peças: 'w' pedra branca, 'W' dama branca, 'b' pedra preta, 'B' dama preta.
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const sideOf = (p) => (p ? p.toLowerCase() : null);
const isKing = (p) => p === 'W' || p === 'B';
const other = (s) => (s === 'w' ? 'b' : 'w');

function initial() {
  const b = Array(64).fill(null);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue;
      if (r < 3) b[r * 8 + c] = 'b';
      else if (r > 4) b[r * 8 + c] = 'w';
    }
  }
  return { b, turn: 'w', ply: 0, quiet: 0, last: null };
}

// Sequências de captura a partir de sq (as peças capturadas só saem no fim do lance).
function captures(b, sq, piece) {
  const side = sideOf(piece);
  const king = isKing(piece);
  const out = [];
  const rec = (at, path, caps) => {
    let more = false;
    const r = at >> 3; const c = at & 7;
    for (const [dr, dc] of DIRS) {
      let rr = r + dr; let cc = c + dc;
      if (king) while (inside(rr, cc) && !b[rr * 8 + cc]) { rr += dr; cc += dc; }
      if (!inside(rr, cc)) continue;
      const mid = rr * 8 + cc;
      const p = b[mid];
      if (!p || sideOf(p) === side || caps.includes(mid)) continue;
      let lr = rr + dr; let lc = cc + dc;
      while (inside(lr, lc) && !b[lr * 8 + lc]) {
        const land = lr * 8 + lc;
        more = true;
        rec(land, [...path, land], [...caps, mid]);
        if (!king) break;
        lr += dr; lc += dc;
      }
    }
    if (!more && caps.length) out.push({ from: sq, path, caps });
  };
  const saved = b[sq];
  b[sq] = null; // a peça que captura deixa a casa de origem livre
  rec(sq, [], []);
  b[sq] = saved;
  return out;
}

/** Lances legais (captura obrigatória e pela maioria). */
function moves(st) {
  const { b, turn } = st;
  let caps = [];
  for (let sq = 0; sq < 64; sq++) if (sideOf(b[sq]) === turn) caps.push(...captures(b, sq, b[sq]));
  if (caps.length) {
    const max = Math.max(...caps.map((m) => m.caps.length));
    caps = caps.filter((m) => m.caps.length === max);
    return caps;
  }
  const out = [];
  const fwd = turn === 'w' ? -1 : 1;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (sideOf(p) !== turn) continue;
    const r = sq >> 3; const c = sq & 7;
    for (const [dr, dc] of DIRS) {
      if (!isKing(p) && dr !== fwd) continue;
      let rr = r + dr; let cc = c + dc;
      while (inside(rr, cc) && !b[rr * 8 + cc]) {
        out.push({ from: sq, path: [rr * 8 + cc], caps: [] });
        if (!isKing(p)) break;
        rr += dr; cc += dc;
      }
    }
  }
  return out;
}

function apply(st, m) {
  const b = st.b.slice();
  const p = b[m.from];
  const to = m.path[m.path.length - 1];
  b[m.from] = null;
  for (const x of m.caps) b[x] = null;
  const row = to >> 3;
  b[to] = p === 'w' && row === 0 ? 'W' : p === 'b' && row === 7 ? 'B' : p;
  const quiet = m.caps.length || !isKing(p) ? 0 : st.quiet + 1;
  return { b, turn: other(st.turn), ply: st.ply + 1, quiet, last: [m.from, ...m.path] };
}

/** null = em andamento; senão { winner } ou { draw: true }. */
function status(st) {
  if (!moves(st).length) return { winner: other(st.turn) };
  if (st.quiet >= 40 || st.ply >= 200) return { draw: true };
  return null;
}

function evaluate(st) {
  let s = 0;
  const { b } = st;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const r = sq >> 3; const c = sq & 7;
    let v;
    if (isKing(p)) v = 320;
    else {
      const adv = p === 'w' ? 7 - r : r;
      v = 100 + adv * 4 + (adv === 0 ? 6 : 0) + (c >= 2 && c <= 5 ? 3 : 0);
    }
    s += sideOf(p) === 'w' ? v : -v;
  }
  return st.turn === 'w' ? s : -s;
}

const WIN = 100000;
class Timeout extends Error {}

function negamax(st, depth, alpha, beta, ply, ctx) {
  if (++ctx.nodes % 256 === 0 && ctx.deadline && window.performance.now() > ctx.deadline) throw new Timeout();
  const ms = moves(st);
  if (!ms.length) return -WIN + ply;
  // Capturas obrigatórias não contam profundidade (evita o efeito horizonte).
  if (depth <= 0 && !ms[0].caps.length) return evaluate(st);
  if (depth <= -6) return evaluate(st);
  let best = -Infinity;
  for (const m of ms) {
    const s = -negamax(apply(st, m), depth - 1, -beta, -alpha, ply + 1, ctx);
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

const MARGIN = 15;
function aiMove(st, budget = 500, maxDepth = 4) {
  const roots = moves(st);
  if (roots.length === 1) return roots[0];
  const t0 = window.performance.now();
  let scored = roots.map((m) => ({ m, s: 0 }));
  for (let d = 1; d <= maxDepth; d++) {
    const ctx = { nodes: 0, deadline: d === 1 ? 0 : t0 + budget };
    try {
      let best = -Infinity;
      const res = [];
      for (const { m } of [...scored].sort((x, y) => y.s - x.s)) {
        const s = -negamax(apply(st, m), d - 1, -Infinity, -(best - MARGIN - 1), 1, ctx);
        res.push({ m, s });
        if (s > best) best = s;
      }
      scored = res;
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      break;
    }
  }
  const best = Math.max(...scored.map((x) => x.s));
  return pick(scored.filter((x) => x.s >= best - (Math.abs(best) > WIN / 2 ? 0 : MARGIN))).m;
}
// #endregion

export default function Game({ onScore, onEnd }) {
  const [g, setG] = useState(initial);
  const [sel, setSel] = useState(-1);
  const [steps, setSteps] = useState([]); // casas já escolhidas numa captura múltipla
  const [res, setRes] = useState(null);
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const outcome = res ? (res.draw ? 'draw' : res.winner === 'w' ? 'win' : 'lose') : null;

  useEffect(() => {
    const s = status(g);
    if (s) setRes(s);
  }, [g]);

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

  useEffect(() => {
    if (g.turn !== 'b' || res || status(g)) return undefined;
    const t = setTimeout(() => {
      const m = aiMove(g);
      sfx(m.caps.length ? 'hit' : 'move');
      setG(apply(g, m));
    }, 450 + rand(250));
    return () => clearTimeout(t);
  }, [g, res]);

  const myTurn = g.turn === 'w' && !res;
  const all = myTurn ? moves(g) : [];
  const mustCap = all.length > 0 && all[0].caps.length > 0;
  const movable = new Set(all.map((m) => m.from));
  const cand = sel >= 0 ? all.filter((m) => m.from === sel && steps.every((s, i) => m.path[i] === s)) : [];
  const nextSet = new Set(cand.map((m) => m.path[steps.length]).filter((x) => x != null));

  // Tabuleiro mostrado (com a captura em andamento aplicada só visualmente).
  const view = g.b.slice();
  const ghost = new Set();
  if (sel >= 0 && steps.length) {
    view[steps[steps.length - 1]] = view[sel];
    if (steps[steps.length - 1] !== sel) view[sel] = null;
    cand[0]?.caps.slice(0, steps.length).forEach((x) => ghost.add(x));
  }
  const curPos = sel >= 0 && steps.length ? steps[steps.length - 1] : sel;

  const tap = (sq) => {
    if (!myTurn || ended.current) return;
    if (sel >= 0 && nextSet.has(sq)) {
      const ns = [...steps, sq];
      const left = cand.filter((m) => m.path[steps.length] === sq);
      const done = left.find((m) => m.path.length === ns.length);
      if (done) {
        sfx(done.caps.length ? 'hit' : 'move');
        setSel(-1); setSteps([]);
        setG(apply(g, done));
      } else {
        sfx('pop');
        setSteps(ns);
      }
      return;
    }
    if (steps.length) return; // no meio de uma captura: continue pulando
    if (movable.has(sq)) { sfx('tap'); setSel(sq); setSteps([]); return; }
    if (sideOf(g.b[sq]) === 'w') sfx('error');
    setSel(-1);
  };

  const count = (s) => g.b.filter((p) => sideOf(p) === s).length;
  const msg = res
    ? outcome === 'win' ? 'Você venceu! 🎉' : outcome === 'lose' ? 'O computador venceu.' : 'Empate!'
    : g.turn === 'w' ? (steps.length ? 'Continue capturando!' : mustCap ? 'Captura obrigatória!' : 'Sua vez (brancas)') : 'Computador pensando…';

  return (
    <div className="checkers">
      <div className={'checkers-status' + (outcome ? ' checkers-status-' + outcome : mustCap ? ' checkers-status-cap' : '')}>{msg}</div>
      <div className={'checkers-board' + (myTurn ? '' : ' checkers-busy')}>
        {view.map((p, sq) => {
          const r = sq >> 3; const c = sq & 7;
          if ((r + c) % 2 === 0) return <span key={sq} className="checkers-sq checkers-light" />;
          const cls = ['checkers-sq', 'checkers-dark'];
          if (sel < 0 && g.last?.includes(sq)) cls.push('checkers-last');
          if (sq === curPos) cls.push('checkers-sel');
          if (nextSet.has(sq)) cls.push('checkers-target');
          if (sel < 0 && myTurn && mustCap && movable.has(sq)) cls.push('checkers-must');
          return (
            <button key={sq} type="button" className={cls.join(' ')} onClick={() => tap(sq)} aria-label={'Casa ' + 'abcdefgh'[c] + (8 - r)}>
              {p && (
                <span className={'checkers-pc ' + (sideOf(p) === 'w' ? 'checkers-w' : 'checkers-b') + (ghost.has(sq) ? ' checkers-ghost' : '')}>
                  {isKing(p) && <b>♛{'︎'}</b>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="checkers-legend">
        <span><i className="checkers-mini checkers-w" /> Você: {count('w')}</span>
        <span><i className="checkers-mini checkers-b" /> Computador: {count('b')}</span>
      </div>
    </div>
  );
}
