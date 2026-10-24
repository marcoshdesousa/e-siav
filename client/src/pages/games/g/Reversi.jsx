// Reversi (Othello) 8x8 contra o computador. Você joga com as pretas e começa.
import { useEffect, useRef, useState } from 'react';
import { rand } from '../kit.js';
import { sfx } from '../audio.js';
import './Reversi.css';

// #region logic
const P = 1; const C = 2; // jogador (pretas), computador (brancas)
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
// Pesos de posição: cantos valem muito; casas vizinhas aos cantos são perigosas.
const WEIGHT = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -40, -2, -2, -2, -2, -40, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -40, -2, -2, -2, -2, -40, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];
const CORNER_OF = { 1: 0, 8: 0, 9: 0, 6: 7, 14: 7, 15: 7, 48: 56, 49: 56, 57: 56, 54: 63, 55: 63, 62: 63 };

function initial() {
  const b = Array(64).fill(0);
  b[27] = C; b[36] = C; b[28] = P; b[35] = P;
  return b;
}

function flips(b, sq, who) {
  if (b[sq]) return [];
  const op = who === P ? C : P;
  const r = sq >> 3; const c = sq & 7;
  const out = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let rr = r + dr; let cc = c + dc;
    while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === op) { line.push(rr * 8 + cc); rr += dr; cc += dc; }
    if (line.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === who) out.push(...line);
  }
  return out;
}

function validMoves(b, who) {
  const out = [];
  for (let i = 0; i < 64; i++) if (!b[i] && flips(b, i, who).length) out.push(i);
  return out;
}

function play(b, sq, who) {
  const nb = b.slice();
  for (const x of flips(b, sq, who)) nb[x] = who;
  nb[sq] = who;
  return nb;
}

const weightAt = (b, sq) => (CORNER_OF[sq] != null && b[CORNER_OF[sq]] ? 4 : WEIGHT[sq]);

function aiMove(b) {
  const ms = validMoves(b, C);
  let best = -Infinity; let choice = ms[0];
  for (const m of ms) {
    const nb = play(b, m, C);
    const opp = validMoves(nb, P);
    let oppBest = 0;
    for (const o of opp) oppBest = Math.max(oppBest, weightAt(nb, o) + flips(nb, o, P).length);
    const s = weightAt(b, m) + flips(b, m, C).length * 1.5 - opp.length * 1.2 - oppBest * 0.6 + rand(8);
    if (s > best) { best = s; choice = m; }
  }
  return choice;
}
// #endregion

export default function Game({ onScore, onEnd }) {
  const [board, setBoard] = useState(initial);
  const [turn, setTurn] = useState(P);
  const [last, setLast] = useState(-1);
  const [flipped, setFlipped] = useState([]);
  const [note, setNote] = useState('');
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const myMoves = validMoves(board, P);
  const cpuMoves = validMoves(board, C);
  const over = !myMoves.length && !cpuMoves.length;
  const nP = board.filter((v) => v === P).length;
  const nC = board.filter((v) => v === C).length;
  const outcome = over ? (nP > nC ? 'win' : nP < nC ? 'lose' : 'draw') : null;

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

  // Passar a vez quando não houver lance.
  const stuck = !over && ((turn === P && !myMoves.length) || (turn === C && !cpuMoves.length));
  useEffect(() => {
    if (!stuck) return undefined;
    const t = setTimeout(() => {
      setNote(turn === P ? 'Você não tem lances: passou a vez.' : 'O computador não tem lances: passou a vez.');
      sfx('error');
      setTurn(turn === P ? C : P);
    }, 700);
    return () => clearTimeout(t);
  }, [stuck, turn]);

  useEffect(() => {
    if (turn !== C || over || !cpuMoves.length) return undefined;
    const t = setTimeout(() => {
      const m = aiMove(board);
      setFlipped(flips(board, m, C));
      setBoard(play(board, m, C));
      setLast(m);
      sfx('flip');
      setTurn(P);
    }, 600 + rand(300));
    return () => clearTimeout(t);
  }, [turn, over, board, cpuMoves.length]);

  const tap = (sq) => {
    if (turn !== P || over || ended.current) return;
    if (!myMoves.includes(sq)) { sfx('error'); return; }
    setFlipped(flips(board, sq, P));
    setBoard(play(board, sq, P));
    setLast(sq);
    setNote('');
    sfx('flip');
    setTurn(C);
  };

  const msg = outcome
    ? outcome === 'win' ? `Você venceu por ${nP} a ${nC}!` : outcome === 'lose' ? `O computador venceu por ${nC} a ${nP}.` : 'Empate!'
    : stuck ? (turn === P ? 'Sem lances para você…' : 'Computador sem lances…')
      : turn === P ? 'Sua vez (pretas)' : 'Computador pensando…';
  const showHints = turn === P && !over;

  return (
    <div className="reversi">
      <div className={'reversi-status' + (outcome ? ' reversi-status-' + outcome : '')}>{msg}</div>
      <div className={'reversi-board' + (turn === P && !over ? '' : ' reversi-busy')}>
        {board.map((v, i) => (
          <button key={i} type="button" className={'reversi-sq' + (i === last ? ' reversi-last' : '')} onClick={() => tap(i)} aria-label={'Casa ' + 'abcdefgh'[i & 7] + (8 - (i >> 3))}>
            {v ? <span key={v} className={'reversi-disc ' + (v === P ? 'reversi-p' : 'reversi-c') + (flipped.includes(i) ? ' reversi-flip' : '')} /> : null}
            {!v && showHints && myMoves.includes(i) && <span className="reversi-hint" />}
          </button>
        ))}
      </div>
      <div className="reversi-legend">
        <span><i className="reversi-mini reversi-p" /> Você: {nP}</span>
        <span><i className="reversi-mini reversi-c" /> Computador: {nC}</span>
      </div>
      <div className="reversi-note">{note}</div>
    </div>
  );
}
