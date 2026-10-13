// Resta um (tabuleiro inglês, 33 casas): pule uma peça por cima da vizinha até uma casa vazia.
import { useEffect, useReducer, useRef } from 'react';
import { sfx } from '../audio.js';
import './PegSolitaire.css';

const N = 7;
const CENTER = 24;
const valid = (r, c) => r >= 0 && c >= 0 && r < N && c < N && ((r >= 2 && r <= 4) || (c >= 2 && c <= 4));
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function movesFrom(b, i) {
  if (!b[i]) return [];
  const r = Math.floor(i / N); const c = i % N; const out = [];
  for (const [dr, dc] of DIRS) {
    const r1 = r + dr; const c1 = c + dc; const r2 = r + 2 * dr; const c2 = c + 2 * dc;
    if (valid(r2, c2) && b[r1 * N + c1] && b[r2 * N + c2] === false) out.push({ to: r2 * N + c2, over: r1 * N + c1 });
  }
  return out;
}
const anyMove = (b) => b.some((v, i) => v && movesFrom(b, i).length > 0);

function initial() {
  const b = Array(N * N).fill(null);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (valid(r, c)) b[r * N + c] = true;
  b[CENTER] = false;
  return b;
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { b: initial(), sel: null, removed: 0, over: false, final: 0, bonus: 0, last: null };
  const [, render] = useReducer((x) => x + 1, 0);
  const endT = useRef(null);
  const ended = useRef(false);

  useEffect(() => () => clearTimeout(endT.current), []);

  const tap = (i) => {
    const s = st.current;
    if (s.over || s.b[i] == null) return;
    if (s.b[i]) {
      if (s.sel === i) { s.sel = null; sfx('move'); } else if (movesFrom(s.b, i).length) { s.sel = i; sfx('tap'); } else { s.sel = null; sfx('error'); }
      render();
      return;
    }
    if (s.sel == null) return;
    const mv = movesFrom(s.b, s.sel).find((m) => m.to === i);
    if (!mv) { sfx('error'); s.sel = null; render(); return; }
    s.b[s.sel] = false;
    s.b[mv.over] = false;
    s.b[i] = true;
    s.last = { over: mv.over, to: i };
    s.sel = null;
    s.removed += 1;
    sfx('pop');
    // Se a peça que pulou pode pular de novo, já fica escolhida.
    if (movesFrom(s.b, i).length) s.sel = i;
    if (!anyMove(s.b)) {
      s.over = true;
      s.sel = null;
      const left = 32 - s.removed;
      s.bonus = left === 1 ? (s.b[CENTER] ? 1000 : 500) : 0;
      s.final = s.removed * 10 + s.bonus;
      sfx(left === 1 ? 'win' : 'lose');
      cbs.current.onScore(s.final);
      endT.current = setTimeout(() => {
        if (ended.current) return;
        ended.current = true;
        cbs.current.onEnd(st.current.final);
      }, 1600);
    } else cbs.current.onScore(s.removed * 10);
    render();
  };

  const s = st.current;
  const targets = new Set(s.sel != null ? movesFrom(s.b, s.sel).map((m) => m.to) : []);
  const left = 32 - s.removed;
  const msg = s.over
    ? left === 1 ? (s.bonus === 1000 ? 'Perfeito! Resta um no centro! +1000' : 'Resta um! +500') : `Sem jogadas. Sobraram ${left} peças.`
    : s.sel != null ? 'Agora toque na casa vazia de destino.' : 'Toque numa peça que possa pular.';

  return (
    <div className="pegsolitaire">
      <div className="pegsolitaire-top">
        <span>Peças <b>{left}</b></span>
        <span>Pontos <b>{s.over ? s.final : s.removed * 10}</b></span>
      </div>
      <div className="pegsolitaire-board">
        {s.b.map((v, i) => (v == null ? <span key={i} className="pegsolitaire-void" /> : (
          <button
            key={i}
            type="button"
            className={'pegsolitaire-hole' + (v ? ' pegsolitaire-peg' : '') + (s.sel === i ? ' pegsolitaire-sel' : '') + (targets.has(i) ? ' pegsolitaire-target' : '')
              + (i === CENTER ? ' pegsolitaire-center' : '') + (s.last && s.last.to === i ? ' pegsolitaire-landed' : '')}
            onClick={() => tap(i)}
            aria-label={(v ? 'Peça' : 'Casa vazia') + ' linha ' + (Math.floor(i / N) + 1) + ', coluna ' + ((i % N) + 1)}
          >
            {v && <i />}
          </button>
        )))}
      </div>
      <div className={'pegsolitaire-msg' + (s.over ? (left === 1 ? ' pegsolitaire-msg-win' : ' pegsolitaire-msg-lose') : '')}>{msg}</div>
    </div>
  );
}
