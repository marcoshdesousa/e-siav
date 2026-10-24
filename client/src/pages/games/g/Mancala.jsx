// Mancala (Kalah, 6 casas com 4 sementes) contra o computador. Uma partida por montagem.
import { useEffect, useRef, useState } from 'react';
import { pick, rand } from '../kit.js';
import { sfx } from '../audio.js';
import './Mancala.css';

// #region logic
// Casas 0..5 = jogador (esquerda → direita), 6 = depósito do jogador,
// 7..12 = computador (direita → esquerda, visto de baixo), 13 = depósito do computador.
const P = 0; const C = 1;
const STORE = [6, 13];
const pitsOf = (who) => (who === P ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
const initial = () => [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
const sideSum = (b, who) => pitsOf(who).reduce((s, i) => s + b[i], 0);
const legalPits = (b, who) => pitsOf(who).filter((i) => b[i] > 0);
const isOver = (b) => sideSum(b, P) === 0 || sideSum(b, C) === 0;

/** Semeia a partir de `pit`. Retorna os quadros (para animar), o tabuleiro final e se joga de novo. */
function sow(b0, pit, who) {
  const b = b0.slice();
  const frames = [];
  let n = b[pit];
  b[pit] = 0;
  frames.push({ b: b.slice(), at: pit });
  let i = pit;
  while (n > 0) {
    i = (i + 1) % 14;
    if (i === STORE[1 - who]) continue;
    b[i]++; n--;
    frames.push({ b: b.slice(), at: i });
  }
  let again = i === STORE[who];
  let captured = 0;
  if (!again && pitsOf(who).includes(i) && b[i] === 1 && b[12 - i] > 0) {
    captured = b[12 - i] + 1;
    b[STORE[who]] += captured;
    b[i] = 0; b[12 - i] = 0;
    frames.push({ b: b.slice(), at: STORE[who], cap: [i, 12 - i] });
  }
  if (isOver(b)) {
    for (const w of [P, C]) for (const x of pitsOf(w)) { b[STORE[w]] += b[x]; b[x] = 0; }
    frames.push({ b: b.slice(), at: -1 });
    again = false;
  }
  return { frames, b, again, captured };
}

function search(b, who, depth, alpha, beta) {
  if (isOver(b) || depth === 0) return b[STORE[C]] - b[STORE[P]];
  let best = who === C ? -Infinity : Infinity;
  for (const p of legalPits(b, who)) {
    const r = sow(b, p, who);
    const s = search(r.b, r.again ? who : 1 - who, depth - 1, alpha, beta);
    if (who === C) { best = Math.max(best, s); alpha = Math.max(alpha, s); } else { best = Math.min(best, s); beta = Math.min(beta, s); }
    if (alpha >= beta) break;
  }
  return best;
}

function aiPit(b) {
  const scored = legalPits(b, C).map((p) => {
    const r = sow(b, p, C);
    return { p, s: search(r.b, r.again ? C : P, 4, -Infinity, Infinity) };
  });
  const best = Math.max(...scored.map((x) => x.s));
  // De vez em quando aceita um lance quase tão bom (fica vencível).
  const slack = Math.random() < 0.3 ? 2 : 0;
  return pick(scored.filter((x) => x.s >= best - slack)).p;
}
// #endregion

export default function Game({ onScore, onEnd }) {
  const [board, setBoard] = useState(initial);
  const [turn, setTurn] = useState(P);
  const [anim, setAnim] = useState(null); // { frames, i, next, final }
  const [note, setNote] = useState('');
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const view = anim ? anim.frames[anim.i].b : board;
  const frame = anim ? anim.frames[anim.i] : null;
  const over = !anim && isOver(board);
  const outcome = over ? (board[6] > board[13] ? 'win' : board[6] < board[13] ? 'lose' : 'draw') : null;

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

  // Animação da semeadura.
  useEffect(() => {
    if (!anim) return undefined;
    const t = setTimeout(() => {
      if (anim.i < anim.frames.length - 1) {
        const f = anim.frames[anim.i + 1];
        sfx(f.cap ? 'coin' : f.at === 6 || f.at === 13 ? 'point' : 'move');
        setAnim({ ...anim, i: anim.i + 1 });
      } else {
        setBoard(anim.final);
        setTurn(anim.next);
        setAnim(null);
      }
    }, anim.i === 0 ? 200 : 170);
    return () => clearTimeout(t);
  }, [anim]);

  const start = (pit, who) => {
    const r = sow(board, pit, who);
    const name = who === P ? 'Você' : 'O computador';
    setNote(r.again ? `${name} caiu no depósito: joga de novo!` : r.captured ? `${name} capturou ${r.captured} sementes!` : '');
    setAnim({ frames: r.frames, i: 0, next: r.again ? who : 1 - who, final: r.b });
  };

  useEffect(() => {
    if (turn !== C || anim || isOver(board)) return undefined;
    const t = setTimeout(() => start(aiPit(board), C), 500 + rand(300));
    return () => clearTimeout(t);
  }, [turn, anim, board]);

  const canPlay = turn === P && !anim && !over;
  const tap = (pit) => {
    if (!canPlay || ended.current) return;
    if (!board[pit]) { sfx('error'); return; }
    sfx('tap');
    start(pit, P);
  };

  useEffect(() => {
    const k = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 6) tap(n - 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const seeds = (n) => (
    <span className="mancala-seeds">
      {Array.from({ length: Math.min(n, 12) }, (_, k) => <i key={k} className={'mancala-seed mancala-s' + (k % 4)} />)}
    </span>
  );
  const pitCls = (i) => 'mancala-pit' + (frame?.at === i ? ' mancala-hot' : '') + (frame?.cap?.includes(i) ? ' mancala-cap' : '');

  const msg = outcome
    ? outcome === 'win' ? `Você venceu por ${board[6]} a ${board[13]}!` : outcome === 'lose' ? `O computador venceu por ${board[13]} a ${board[6]}.` : `Empate: ${board[6]} a ${board[13]}!`
    : anim ? (turn === P ? 'Semeando…' : 'Computador jogando…')
      : turn === P ? 'Sua vez: escolha uma casa de baixo' : 'Computador pensando…';

  return (
    <div className="mancala">
      <div className={'mancala-status' + (outcome ? ' mancala-status-' + outcome : '')}>{msg}</div>
      <div className="mancala-board">
        <div className={'mancala-store mancala-store-c' + (frame?.at === 13 ? ' mancala-hot' : '')}>
          <small>CPU</small><b>{view[13]}</b>
        </div>
        <div className="mancala-rows">
          <div className="mancala-row">
            {[12, 11, 10, 9, 8, 7].map((i) => (
              <div key={i} className={pitCls(i) + ' mancala-pit-c'}>
                {seeds(view[i])}<b>{view[i]}</b>
              </div>
            ))}
          </div>
          <div className="mancala-row">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" className={pitCls(i) + ' mancala-pit-p'} onClick={() => tap(i)} disabled={!canPlay || !view[i]} aria-label={'Casa ' + (i + 1) + ': ' + view[i] + ' sementes'}>
                {seeds(view[i])}<b>{view[i]}</b>
              </button>
            ))}
          </div>
        </div>
        <div className={'mancala-store mancala-store-p' + (frame?.at === 6 ? ' mancala-hot' : '')}>
          <small>Você</small><b>{view[6]}</b>
        </div>
      </div>
      <div className="mancala-note">{note || 'As sementes andam no sentido anti-horário →'}</div>
    </div>
  );
}
