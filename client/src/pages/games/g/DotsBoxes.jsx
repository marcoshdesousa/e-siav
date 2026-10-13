// Pontinhos (5x5 pontos, 16 quadrados) contra o computador. Fechou um quadrado, joga de novo.
import { useEffect, useRef, useState } from 'react';
import { pick, rand } from '../kit.js';
import { sfx } from '../audio.js';
import './DotsBoxes.css';

// #region logic
const N = 4; // quadrados por lado
const NE = 2 * N * (N + 1); // 40 traços
const P = 1; const C = 2;
// Traços 0..19 horizontais (linha r 0..4, coluna c 0..3); 20..39 verticais (linha r 0..3, coluna c 0..4).
const BOX_EDGES = [];
for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    BOX_EDGES.push([r * N + c, (r + 1) * N + c, 20 + r * (N + 1) + c, 20 + r * (N + 1) + c + 1]);
  }
}
const EDGE_BOXES = Array.from({ length: NE }, () => []);
BOX_EDGES.forEach((es, bi) => es.forEach((e) => EDGE_BOXES[e].push(bi)));

const sides = (edges, bi) => BOX_EDGES[bi].reduce((n, e) => n + (edges[e] ? 1 : 0), 0);
const free = (edges) => [...Array(NE).keys()].filter((e) => !edges[e]);

/** Quantos quadrados o adversário fecharia em sequência depois deste traço (para minimizar a entrega). */
function giveaway(edges, e) {
  const ed = edges.slice();
  ed[e] = 1;
  let taken = 0;
  for (;;) {
    let found = -1;
    for (let bi = 0; bi < N * N && found < 0; bi++) {
      if (sides(ed, bi) === 3) found = BOX_EDGES[bi].find((x) => !ed[x]);
    }
    if (found < 0) return taken;
    taken += EDGE_BOXES[found].filter((bi) => sides(ed, bi) === 3).length;
    ed[found] = 1;
  }
}

function aiEdge(edges) {
  const fr = free(edges);
  // 1) Fecha um quadrado se puder.
  const closing = fr.filter((e) => EDGE_BOXES[e].some((bi) => sides(edges, bi) === 3));
  if (closing.length) return pick(closing);
  // 2) Traço seguro: não deixa nenhum quadrado com 3 lados.
  const safe = fr.filter((e) => EDGE_BOXES[e].every((bi) => sides(edges, bi) < 2));
  if (safe.length && Math.random() < 0.92) return pick(safe);
  // 3) Entrega a menor corrente possível.
  let best = Infinity; let list = [];
  for (const e of fr) {
    const g = giveaway(edges, e);
    if (g < best) { best = g; list = [e]; } else if (g === best) list.push(e);
  }
  return pick(list);
}

/** Aplica o traço: retorna as novas listas e quantos quadrados fechou. */
function draw(edges, boxes, e, who) {
  const ed = edges.slice(); ed[e] = who;
  const bx = boxes.slice();
  let made = 0;
  for (const bi of EDGE_BOXES[e]) if (sides(ed, bi) === 4 && !bx[bi]) { bx[bi] = who; made++; }
  return { edges: ed, boxes: bx, made };
}
// #endregion

const GAP = 80; const PAD = 30; const SIZE = PAD * 2 + GAP * N;
function edgeXY(e) {
  if (e < 20) { const r = Math.floor(e / N); const c = e % N; return [PAD + c * GAP, PAD + r * GAP, PAD + (c + 1) * GAP, PAD + r * GAP]; }
  const k = e - 20; const r = Math.floor(k / (N + 1)); const c = k % (N + 1);
  return [PAD + c * GAP, PAD + r * GAP, PAD + c * GAP, PAD + (r + 1) * GAP];
}

export default function Game({ onScore, onEnd }) {
  const [edges, setEdges] = useState(() => Array(NE).fill(0));
  const [boxes, setBoxes] = useState(() => Array(N * N).fill(0));
  const [turn, setTurn] = useState(P);
  const [last, setLast] = useState(-1);
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const mine = boxes.filter((v) => v === P).length;
  const theirs = boxes.filter((v) => v === C).length;
  const over = edges.every(Boolean);
  const outcome = over ? (mine > theirs ? 'win' : mine < theirs ? 'lose' : 'draw') : null;

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
    if (turn !== C || over) return undefined;
    const t = setTimeout(() => {
      const e = aiEdge(edges);
      const r = draw(edges, boxes, e, C);
      sfx(r.made ? 'coin' : 'move');
      setEdges(r.edges); setBoxes(r.boxes); setLast(e);
      if (!r.made) setTurn(P);
    }, 380 + rand(260));
    return () => clearTimeout(t);
  }, [turn, over, edges, boxes]);

  const tap = (e) => {
    if (turn !== P || over || edges[e] || ended.current) return;
    const r = draw(edges, boxes, e, P);
    sfx(r.made ? 'coin' : 'tap');
    setEdges(r.edges); setBoxes(r.boxes); setLast(e);
    if (!r.made) setTurn(C);
  };

  const msg = outcome
    ? outcome === 'win' ? `Você venceu por ${mine} a ${theirs}! 🎉` : outcome === 'lose' ? `O computador venceu por ${theirs} a ${mine}.` : 'Empate: 8 a 8!'
    : turn === P ? 'Sua vez: toque entre dois pontos' : 'Computador pensando…';

  return (
    <div className="dotsboxes">
      <div className={'dotsboxes-status' + (outcome ? ' dotsboxes-status-' + outcome : '')}>{msg}</div>
      <div className="dotsboxes-score">
        <span className="dotsboxes-you">Você: {mine}</span>
        <span className="dotsboxes-cpu">Computador: {theirs}</span>
      </div>
      <svg className={'dotsboxes-board' + (turn === P && !over ? '' : ' dotsboxes-busy')} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Tabuleiro de pontinhos">
        <rect x="0" y="0" width={SIZE} height={SIZE} rx="20" className="dotsboxes-bg" />
        {boxes.map((v, bi) => v ? (
          <g key={bi}>
            <rect x={PAD + (bi % N) * GAP + 6} y={PAD + Math.floor(bi / N) * GAP + 6} width={GAP - 12} height={GAP - 12} rx="8" className={v === P ? 'dotsboxes-box-p' : 'dotsboxes-box-c'} />
            <text x={PAD + (bi % N) * GAP + GAP / 2} y={PAD + Math.floor(bi / N) * GAP + GAP / 2 + 9} className="dotsboxes-mark">{v === P ? 'V' : 'C'}</text>
          </g>
        ) : null)}
        {edges.map((v, e) => {
          const [x1, y1, x2, y2] = edgeXY(e);
          return (
            <g key={e} className={v ? '' : 'dotsboxes-free'} onClick={() => tap(e)}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="dotsboxes-hitline" />
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={'dotsboxes-edge' + (v ? (v === P ? ' dotsboxes-edge-p' : ' dotsboxes-edge-c') : '') + (e === last ? ' dotsboxes-last' : '')} />
            </g>
          );
        })}
        {Array.from({ length: (N + 1) * (N + 1) }, (_, i) => (
          <circle key={i} cx={PAD + (i % (N + 1)) * GAP} cy={PAD + Math.floor(i / (N + 1)) * GAP} r="8" className="dotsboxes-dot" />
        ))}
      </svg>
    </div>
  );
}
