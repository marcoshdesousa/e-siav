// Jogo da velha contra o computador: uma partida por montagem.
import { useEffect, useRef, useState } from 'react';
import { pick, rand } from '../kit.js';
import { sfx } from '../audio.js';
import './TicTacToe.css';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function winner(b) {
  for (const l of LINES) {
    const [a, c, d] = l;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a], line: l };
  }
  if (b.every(Boolean)) return { who: 'draw', line: [] };
  return null;
}

function minimax(b, turn, depth) {
  const w = winner(b);
  if (w) return w.who === 'O' ? 10 - depth : w.who === 'X' ? depth - 10 : 0;
  let best = turn === 'O' ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    const s = minimax(b, turn === 'O' ? 'X' : 'O', depth + 1);
    b[i] = null;
    best = turn === 'O' ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}

function cpuMove(board) {
  const free = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (Math.random() < 0.25) return pick(free);
  let best = -Infinity; let moves = [];
  for (const i of free) {
    const b = [...board]; b[i] = 'O';
    const s = minimax(b, 'X', 1);
    if (s > best) { best = s; moves = [i]; } else if (s === best) moves.push(i);
  }
  return moves[rand(moves.length)];
}

export default function Game({ onScore, onEnd }) {
  const [board, setBoard] = useState(() => Array(9).fill(null));
  const [turn, setTurn] = useState('X');
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const w = winner(board);
  const outcome = w ? w.who : null;
  const result = w;

  // Fim da partida: mostra a mensagem por ~1,2 s e chama onEnd uma vez.
  useEffect(() => {
    if (!outcome) return undefined;
    const pts = outcome === 'X' ? 3 : outcome === 'draw' ? 1 : 0;
    cb.current.onScore?.(pts);
    sfx(outcome === 'X' ? 'win' : outcome === 'O' ? 'lose' : 'tap');
    const t = setTimeout(() => {
      if (ended.current) return;
      ended.current = true;
      cb.current.onEnd?.(pts);
    }, 1200);
    return () => clearTimeout(t);
  }, [outcome]);

  // Vez do computador, com um pequeno atraso.
  useEffect(() => {
    if (turn !== 'O' || outcome) return undefined;
    const t = setTimeout(() => {
      sfx('move');
      setBoard((b) => {
        if (winner(b)) return b;
        const i = cpuMove(b);
        const nb = [...b]; nb[i] = 'O';
        return nb;
      });
      setTurn('X');
    }, 450 + rand(300));
    return () => clearTimeout(t);
  }, [turn, outcome]);

  const play = (i) => {
    if (turn !== 'X' || board[i] || w || ended.current) return;
    const nb = [...board]; nb[i] = 'X';
    sfx('tap');
    setBoard(nb);
    setTurn('O');
  };

  const msg = result
    ? result.who === 'X' ? 'Você venceu! 🎉' : result.who === 'O' ? 'O computador venceu.' : 'Deu velha! Empate.'
    : turn === 'X' ? 'Sua vez (X)' : 'Computador pensando…';

  return (
    <div className="tictactoe">
      <div className={'tictactoe-status' + (result ? ' tictactoe-status-' + (result.who === 'X' ? 'win' : result.who === 'O' ? 'lose' : 'draw') : '')}>{msg}</div>
      <div className={'tictactoe-board' + (turn === 'O' && !w ? ' tictactoe-busy' : '')}>
        {board.map((v, i) => (
          <button
            key={i}
            type="button"
            className={'tictactoe-cell' + (v ? ' tictactoe-' + v.toLowerCase() : '') + (result?.line.includes(i) ? ' tictactoe-hit' : '')}
            onClick={() => play(i)}
            disabled={!!v || turn !== 'X' || !!w}
            aria-label={'Casa ' + (i + 1) + (v ? ': ' + v : '')}
          >
            {v && <span>{v === 'X' ? '✕' : '◯'}</span>}
          </button>
        ))}
      </div>
      <div className="tictactoe-legend">
        <span><b className="tictactoe-x">✕</b> Você</span>
        <span><b className="tictactoe-o">◯</b> Computador</span>
      </div>
    </div>
  );
}
