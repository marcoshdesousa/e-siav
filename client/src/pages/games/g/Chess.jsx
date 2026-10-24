// Xadrez contra o computador: você joga de brancas. Uma partida por montagem.
import { useEffect, useRef, useState } from 'react';
import { pick, rand } from '../kit.js';
import { sfx } from '../audio.js';
import './Chess.css';
import { ChessPiece } from '../art.jsx';

// #region logic
// Casas 0..63: índice = linha * 8 + coluna, linha 0 = 8ª fileira (lado das pretas).
// Peças: maiúsculas = brancas (PNBRQK), minúsculas = pretas.
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISH = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

const colorOf = (p) => (p ? (p < 'a' ? 'w' : 'b') : null);
const other = (s) => (s === 'w' ? 'b' : 'w');
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

function initial() {
  const b = Array(64).fill(null);
  const back = 'rnbqkbnr';
  for (let c = 0; c < 8; c++) {
    b[c] = back[c]; b[8 + c] = 'p';
    b[48 + c] = 'P'; b[56 + c] = back[c].toUpperCase();
  }
  return { b, turn: 'w', castle: { K: true, Q: true, k: true, q: true }, ep: -1, ply: 0, last: null };
}

function attacked(b, sq, by) {
  const r = sq >> 3; const c = sq & 7;
  const w = by === 'w';
  const pr = w ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (inside(pr, c + dc) && b[pr * 8 + c + dc] === (w ? 'P' : 'p')) return true;
  }
  for (const [dr, dc] of KN) {
    if (inside(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === (w ? 'N' : 'n')) return true;
  }
  for (const [dr, dc] of KG) {
    if (inside(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === (w ? 'K' : 'k')) return true;
  }
  const slide = (dirs, a, q) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr; let cc = c + dc;
      while (inside(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p) { if (p === a || p === q) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  };
  return slide(ROOK, w ? 'R' : 'r', w ? 'Q' : 'q') || slide(BISH, w ? 'B' : 'b', w ? 'Q' : 'q');
}

const kingSq = (b, side) => b.indexOf(side === 'w' ? 'K' : 'k');
const inCheck = (st, side = st.turn) => attacked(st.b, kingSq(st.b, side), other(side));

function pseudo(st) {
  const { b, turn } = st;
  const w = turn === 'w';
  const out = [];
  const add = (from, to, extra) => out.push({ from, to, cap: b[to] || null, ...extra });
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p || colorOf(p) !== turn) continue;
    const t = p.toLowerCase();
    const r = sq >> 3; const c = sq & 7;
    if (t === 'p') {
      const dir = w ? -1 : 1; const start = w ? 6 : 1; const last = w ? 0 : 7;
      const r1 = r + dir;
      if (inside(r1, c) && !b[r1 * 8 + c]) {
        add(sq, r1 * 8 + c, r1 === last ? { promo: true } : undefined);
        const r2 = r + 2 * dir;
        if (r === start && !b[r2 * 8 + c]) add(sq, r2 * 8 + c, { dbl: true });
      }
      for (const dc of [-1, 1]) {
        if (!inside(r1, c + dc)) continue;
        const to = r1 * 8 + c + dc;
        if (b[to] && colorOf(b[to]) !== turn) add(sq, to, r1 === last ? { promo: true } : undefined);
        else if (to === st.ep) add(sq, to, { ep: true, cap: w ? 'p' : 'P' });
      }
    } else if (t === 'n' || t === 'k') {
      for (const [dr, dc] of t === 'n' ? KN : KG) {
        if (!inside(r + dr, c + dc)) continue;
        const to = (r + dr) * 8 + c + dc;
        if (!b[to] || colorOf(b[to]) !== turn) add(sq, to);
      }
      if (t === 'k') {
        const home = w ? 60 : 4; const op = other(turn);
        if (sq === home && !attacked(b, home, op)) {
          const cs = st.castle;
          if ((w ? cs.K : cs.k) && !b[home + 1] && !b[home + 2] && b[home + 3] === (w ? 'R' : 'r')
            && !attacked(b, home + 1, op) && !attacked(b, home + 2, op)) add(sq, home + 2, { castle: true });
          if ((w ? cs.Q : cs.q) && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === (w ? 'R' : 'r')
            && !attacked(b, home - 1, op) && !attacked(b, home - 2, op)) add(sq, home - 2, { castle: true });
        }
      }
    } else {
      const dirs = t === 'r' ? ROOK : t === 'b' ? BISH : [...ROOK, ...BISH];
      for (const [dr, dc] of dirs) {
        let rr = r + dr; let cc = c + dc;
        while (inside(rr, cc)) {
          const to = rr * 8 + cc;
          if (b[to]) { if (colorOf(b[to]) !== turn) add(sq, to); break; }
          add(sq, to);
          rr += dr; cc += dc;
        }
      }
    }
  }
  return out;
}

function makeMove(st, m) {
  const b = st.b.slice();
  const w = st.turn === 'w';
  const p = b[m.from];
  b[m.to] = m.promo ? (w ? 'Q' : 'q') : p;
  b[m.from] = null;
  if (m.ep) b[m.to + (w ? 8 : -8)] = null;
  if (m.castle) {
    if (m.to === m.from + 2) { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = null; }
    else { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = null; }
  }
  const castle = { ...st.castle };
  if (p === 'K') { castle.K = false; castle.Q = false; }
  if (p === 'k') { castle.k = false; castle.q = false; }
  for (const s of [m.from, m.to]) {
    if (s === 63) castle.K = false;
    if (s === 56) castle.Q = false;
    if (s === 7) castle.k = false;
    if (s === 0) castle.q = false;
  }
  return { b, turn: other(st.turn), castle, ep: m.dbl ? (m.from + m.to) >> 1 : -1, ply: st.ply + 1, last: [m.from, m.to] };
}

/** Lances legais: [{ m, st }] com o estado resultante. */
function legal(st, onlyCaps = false) {
  const out = [];
  for (const m of pseudo(st)) {
    if (onlyCaps && !m.cap && !m.promo) continue;
    const n = makeMove(st, m);
    if (!attacked(n.b, kingSq(n.b, st.turn), n.turn)) out.push({ m, st: n });
  }
  return out;
}

function insufficient(b) {
  const rest = b.filter((p) => p && p.toLowerCase() !== 'k');
  if (rest.length === 0) return true;
  return rest.length === 1 && 'nbNB'.includes(rest[0]);
}

/** Situação da partida: null (em andamento) ou { kind, winner }. */
function status(st) {
  const moves = legal(st);
  if (!moves.length) return inCheck(st) ? { kind: 'mate', winner: other(st.turn) } : { kind: 'stalemate' };
  if (insufficient(st.b)) return { kind: 'material' };
  if (st.ply >= 200) return { kind: 'limit' };
  return null;
}

function evaluate(st) {
  let s = 0;
  const { b } = st;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const t = p.toLowerCase();
    if (p < 'a') s += VAL[t] + PST[t][sq];
    else s -= VAL[t] + PST[t][sq ^ 56];
  }
  return st.turn === 'w' ? s : -s;
}

const MATE = 100000;
const order = (list) => list.sort((x, y) => ((y.m.cap ? VAL[y.m.cap.toLowerCase()] * 10 : 0) + (y.m.promo ? 800 : 0))
  - ((x.m.cap ? VAL[x.m.cap.toLowerCase()] * 10 : 0) + (x.m.promo ? 800 : 0)));

class Timeout extends Error {}

function quiesce(st, alpha, beta, qd, ctx) {
  const stand = evaluate(st);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (qd >= 4) return stand;
  for (const { st: n } of order(legal(st, true))) {
    const s = -quiesce(n, -beta, -alpha, qd + 1, ctx);
    if (s >= beta) return s;
    if (s > alpha) alpha = s;
  }
  return alpha;
}

function negamax(st, depth, alpha, beta, ply, ctx) {
  if (++ctx.nodes % 256 === 0 && ctx.deadline && window.performance.now() > ctx.deadline) throw new Timeout();
  const moves = legal(st);
  if (!moves.length) return inCheck(st) ? -MATE + ply : 0;
  if (depth === 0) return quiesce(st, alpha, beta, 0, ctx);
  let best = -Infinity;
  for (const { st: n } of order(moves)) {
    const s = -negamax(n, depth - 1, -beta, -alpha, ply + 1, ctx);
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

const MARGIN = 30;
/** Escolhe o lance do computador (busca alfa-beta com aprofundamento e um pouco de acaso). */
function aiMove(st, budget = 650) {
  const roots = order(legal(st));
  if (roots.length === 1) return roots[0];
  const t0 = window.performance.now();
  let scored = null;
  for (let d = 1; d <= 3; d++) {
    const ctx = { nodes: 0, deadline: d === 1 ? 0 : t0 + budget };
    try {
      let best = -Infinity;
      const res = [];
      // Melhor lance da iteração anterior primeiro (poda mais).
      const list = scored ? [...scored].sort((x, y) => y.s - x.s).map((x) => x.r) : roots;
      for (const r of list) {
        const s = -negamax(r.st, d - 1, -Infinity, -(best - MARGIN - 1), 1, ctx);
        res.push({ r, s });
        if (s > best) best = s;
      }
      scored = res;
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      break;
    }
  }
  const best = Math.max(...scored.map((x) => x.s));
  const near = scored.filter((x) => x.s >= best - (best > MATE / 2 ? 0 : MARGIN));
  return pick(near).r;
}
// #endregion

const FILES = 'abcdefgh';

export default function Game({ onScore, onEnd }) {
  const [g, setG] = useState(initial);
  const [sel, setSel] = useState(-1);
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const [res, setRes] = useState(null);
  const check = !res && inCheck(g);
  const outcome = res ? (res.kind === 'mate' ? (res.winner === 'w' ? 'win' : 'lose') : 'draw') : null;

  // Depois de cada lance: fim de jogo?
  useEffect(() => {
    const s = status(g);
    if (s) setRes(s);
    else if (g.last && inCheck(g)) sfx('error');
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
    }, 1800);
    return () => clearTimeout(t);
  }, [outcome]);

  // Vez do computador.
  useEffect(() => {
    if (g.turn !== 'b' || res || status(g)) return undefined;
    const t = setTimeout(() => {
      const mv = aiMove(g);
      sfx(mv.m.cap ? 'hit' : 'move');
      setG(mv.st);
    }, 300 + rand(250));
    return () => clearTimeout(t);
  }, [g, res]);

  const myTurn = g.turn === 'w' && !res;
  const moves = myTurn ? legal(g) : [];
  const targets = sel >= 0 ? moves.filter((x) => x.m.from === sel) : [];
  const targetSet = new Map(targets.map((x) => [x.m.to, x]));

  const tap = (sq) => {
    if (!myTurn || ended.current) return;
    const mv = targetSet.get(sq);
    if (mv) {
      sfx(mv.m.cap ? 'hit' : 'move');
      setSel(-1);
      setG(mv.st);
      return;
    }
    if (g.b[sq] && colorOf(g.b[sq]) === 'w' && moves.some((x) => x.m.from === sq)) { sfx('tap'); setSel(sq); return; }
    if (g.b[sq] && colorOf(g.b[sq]) === 'w') sfx('error');
    setSel(-1);
  };

  const ksq = check ? kingSq(g.b, g.turn) : -1;
  const msg = res
    ? res.kind === 'mate' ? (res.winner === 'w' ? 'Xeque-mate! Você venceu!' : 'Xeque-mate. O computador venceu.')
      : res.kind === 'stalemate' ? 'Afogamento: empate!'
        : res.kind === 'material' ? 'Empate: material insuficiente.' : 'Empate: limite de 200 lances.'
    : g.turn === 'w' ? (check ? 'Xeque! Proteja seu rei.' : 'Sua vez (brancas)') : 'Computador pensando…';

  return (
    <div className="chess">
      <div className={'chess-status' + (outcome ? ' chess-status-' + outcome : check ? ' chess-status-check' : '')}>{msg}</div>
      <div className={'chess-board' + (myTurn ? '' : ' chess-busy')}>
        {g.b.map((p, sq) => {
          const r = sq >> 3; const c = sq & 7;
          const dark = (r + c) % 2 === 1;
          const tg = targetSet.get(sq);
          const cls = ['chess-sq', dark ? 'chess-dark' : 'chess-light'];
          if (g.last && (g.last[0] === sq || g.last[1] === sq)) cls.push('chess-last');
          if (sq === sel) cls.push('chess-sel');
          if (sq === ksq) cls.push('chess-check');
          if (tg) cls.push(tg.m.cap ? 'chess-cap' : 'chess-dot');
          return (
            <button key={sq} type="button" className={cls.join(' ')} onClick={() => tap(sq)} aria-label={FILES[c] + (8 - r) + (p ? ' ' + p : '')}>
              {p && <span className={'chess-pc ' + (colorOf(p) === 'w' ? 'chess-w' : 'chess-b')}><ChessPiece type={p.toLowerCase()} white={colorOf(p) === 'w'} size="86%" /></span>}
              {c === 0 && <i className="chess-rank">{8 - r}</i>}
              {r === 7 && <i className="chess-file">{FILES[c]}</i>}
            </button>
          );
        })}
      </div>
      <div className="chess-legend">
        <span>Lance {Math.min(100, Math.floor(g.ply / 2) + 1)} de 100</span>
        <span>Promoção vira dama</span>
      </div>
    </div>
  );
}
