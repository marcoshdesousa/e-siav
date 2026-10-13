// Lig 4 contra o computador (7 colunas x 6 linhas): uma partida por montagem.
import { useEffect, useRef, useState } from 'react';
import { pick, rand } from '../kit.js';
import './Connect4.css';

const W = 7; const H = 6;
const P = 1; const C = 2; // jogador, computador
const empty = () => Array.from({ length: H }, () => Array(W).fill(0));

const dropRow = (b, c) => { for (let r = H - 1; r >= 0; r--) if (!b[r][c]) return r; return -1; };
const validCols = (b) => [...Array(W).keys()].filter((c) => !b[0][c]);

function findWin(b) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const v = b[r][c];
      if (!v) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k; const cc = c + dc * k;
          if (rr < 0 || rr >= H || cc < 0 || cc >= W || b[rr][cc] !== v) break;
          cells.push([rr, cc]);
        }
        if (cells.length === 4) return { who: v, cells };
      }
    }
  }
  return null;
}

const place = (b, c, who) => {
  const r = dropRow(b, c);
  if (r < 0) return null;
  const nb = b.map((row) => [...row]);
  nb[r][c] = who;
  return nb;
};

function scoreWindow(w, me) {
  const op = me === C ? P : C;
  const m = w.filter((v) => v === me).length;
  const o = w.filter((v) => v === op).length;
  const e = w.filter((v) => !v).length;
  if (m === 4) return 1000;
  if (m === 3 && e === 1) return 6;
  if (m === 2 && e === 2) return 2;
  if (o === 3 && e === 1) return -8;
  if (o === 2 && e === 2) return -1;
  return 0;
}

function evaluate(b, me) {
  let s = 0;
  for (let r = 0; r < H; r++) s += (b[r][3] === me ? 3 : 0) - (b[r][3] && b[r][3] !== me ? 3 : 0);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (c + 3 < W) s += scoreWindow([0, 1, 2, 3].map((k) => b[r][c + k]), me);
      if (r + 3 < H) s += scoreWindow([0, 1, 2, 3].map((k) => b[r + k][c]), me);
      if (r + 3 < H && c + 3 < W) s += scoreWindow([0, 1, 2, 3].map((k) => b[r + k][c + k]), me);
      if (r + 3 < H && c - 3 >= 0) s += scoreWindow([0, 1, 2, 3].map((k) => b[r + k][c - k]), me);
    }
  }
  return s;
}

const ORDER = [3, 2, 4, 1, 5, 0, 6];
function negamax(b, depth, alpha, beta, who) {
  const w = findWin(b);
  if (w) return w.who === who ? 100000 + depth : -100000 - depth;
  const cols = ORDER.filter((c) => !b[0][c]);
  if (!cols.length) return 0;
  if (depth === 0) return evaluate(b, who);
  let best = -Infinity;
  for (const c of cols) {
    const s = -negamax(place(b, c, who), depth - 1, -beta, -alpha, who === C ? P : C);
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

function cpuMove(b) {
  const cols = validCols(b);
  // 1) ganhar já
  for (const c of cols) if (findWin(place(b, c, C))?.who === C) return c;
  // 2) bloquear
  for (const c of cols) if (findWin(place(b, c, P))?.who === P) return c;
  // 3) às vezes um lance "humano" entre os que não entregam a vitória
  const safe = cols.filter((c) => {
    const nb = place(b, c, C);
    return !validCols(nb).some((c2) => findWin(place(nb, c2, P))?.who === P);
  });
  if (safe.length && Math.random() < 0.22) return pick(safe);
  // 4) busca curta
  let best = -Infinity; let moves = [];
  for (const c of ORDER.filter((x) => cols.includes(x))) {
    const s = -negamax(place(b, c, C), 3, -Infinity, Infinity, P) + rand(3);
    if (s > best) { best = s; moves = [c]; } else if (s === best) moves.push(c);
  }
  return moves.length ? pick(moves) : pick(cols);
}

export default function Game({ onScore, onEnd }) {
  const [board, setBoard] = useState(empty);
  const [turn, setTurn] = useState(P);
  const [last, setLast] = useState(null); // [r, c] da última peça (para animar)
  const [hover, setHover] = useState(null);
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const win = findWin(board);
  const full = !win && validCols(board).length === 0;
  const outcome = win ? (win.who === P ? 'win' : 'lose') : full ? 'draw' : null;
  const winSet = new Set(win ? win.cells.map(([r, c]) => r * W + c) : []);

  useEffect(() => {
    if (!outcome) return undefined;
    const pts = outcome === 'win' ? 3 : outcome === 'draw' ? 1 : 0;
    cb.current.onScore?.(pts);
    const t = setTimeout(() => {
      if (ended.current) return;
      ended.current = true;
      cb.current.onEnd?.(pts);
    }, 1500);
    return () => clearTimeout(t);
  }, [outcome]);

  useEffect(() => {
    if (turn !== C || outcome) return undefined;
    const t = setTimeout(() => {
      const c = cpuMove(board);
      const r = dropRow(board, c);
      setBoard(place(board, c, C));
      setLast([r, c]);
      setTurn(P);
    }, 550 + rand(300));
    return () => clearTimeout(t);
  }, [turn, outcome, board]);

  const play = (c) => {
    if (turn !== P || outcome || ended.current) return;
    const r = dropRow(board, c);
    if (r < 0) return;
    setBoard(place(board, c, P));
    setLast([r, c]);
    setTurn(C);
  };

  useEffect(() => {
    const k = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 7) play(n - 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const msg = outcome === 'win' ? 'Você venceu! 🎉' : outcome === 'lose' ? 'O computador venceu.' : outcome === 'draw' ? 'Empate!'
    : turn === P ? 'Sua vez: toque em uma coluna' : 'Computador pensando…';
  const canPlay = turn === P && !outcome;

  return (
    <div className="connect4">
      <div className={'connect4-status' + (outcome ? ' connect4-status-' + outcome : '')}>
        <span className={'connect4-mini ' + (turn === P ? 'connect4-p' : 'connect4-c')} />
        {msg}
      </div>
      <div className="connect4-aim">
        {[...Array(W).keys()].map((c) => (
          <span key={c} className={'connect4-aim-dot' + (canPlay && hover === c && !board[0][c] ? ' on' : '')} />
        ))}
      </div>
      <div className={'connect4-board' + (canPlay ? '' : ' connect4-busy')} onPointerLeave={() => setHover(null)}>
        {[...Array(W).keys()].map((c) => (
          <button
            key={c}
            type="button"
            className="connect4-col"
            onClick={() => play(c)}
            onPointerEnter={() => setHover(c)}
            disabled={!canPlay || !!board[0][c]}
            aria-label={'Coluna ' + (c + 1)}
          >
            {board.map((row, r) => {
              const v = row[c];
              const isLast = last && last[0] === r && last[1] === c;
              return (
                <span key={r} className="connect4-hole">
                  {v ? (
                    <span
                      key={isLast ? 'n' : 'o'}
                      className={'connect4-disc ' + (v === P ? 'connect4-p' : 'connect4-c') + (isLast ? ' connect4-drop' : '') + (winSet.has(r * W + c) ? ' connect4-hit' : '')}
                      style={isLast ? { '--rows': r + 1 } : undefined}
                    />
                  ) : null}
                </span>
              );
            })}
          </button>
        ))}
      </div>
      <div className="connect4-legend">
        <span><i className="connect4-mini connect4-p" /> Você</span>
        <span><i className="connect4-mini connect4-c" /> Computador</span>
      </div>
    </div>
  );
}
