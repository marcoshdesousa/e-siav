// Dominó contra o computador (duplo-seis, 7 pedras cada, o resto vai para o monte).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { rand, shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './Domino.css';

const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const sum = (h) => h.reduce((s, t) => s + t[0] + t[1], 0);
const isDouble = (t) => t[0] === t[1];

function deal() {
  const all = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) all.push([a, b]);
  const s = shuffle(all);
  const hand = s.slice(0, 7); const cpu = s.slice(7, 14); const monte = s.slice(14);
  // Começa quem tem a maior dupla (ou, sem duplas, a pedra mais alta).
  const rank = (h) => Math.max(...h.map((t) => (isDouble(t) ? 100 + t[0] : t[0] + t[1])));
  const turn = rank(hand) >= rank(cpu) ? 'p' : 'c';
  return { hand, cpu, monte, chain: [], turn, passes: 0, over: null, note: turn === 'p' ? 'Você começa: jogue qualquer pedra.' : 'O computador começa.' };
}

/** Lados em que a pedra encaixa: 'L' e/ou 'R'. Mesa vazia: ['R']. */
function sides(chain, t) {
  if (!chain.length) return ['R'];
  const L = chain[0][0]; const R = chain[chain.length - 1][1];
  const out = [];
  if (t[0] === L || t[1] === L) out.push('L');
  if (t[0] === R || t[1] === R) out.push('R');
  if (out.length === 2 && L === R) return ['R'];
  return out;
}

function put(chain, t, side) {
  if (!chain.length) return [[t[0], t[1]]];
  if (side === 'L') {
    const L = chain[0][0];
    return [t[1] === L ? [t[0], t[1]] : [t[1], t[0]], ...chain];
  }
  const R = chain[chain.length - 1][1];
  return [...chain, t[0] === R ? [t[0], t[1]] : [t[1], t[0]]];
}

const same = (a, b) => a[0] === b[0] && a[1] === b[1];

/** Aplica uma jogada de quem ('p' | 'c') e verifica o fim. */
function applyPlay(s, who, t, side) {
  const key = who === 'p' ? 'hand' : 'cpu';
  const h = s[key].filter((x) => !same(x, t));
  const chain = put(s.chain, t, side);
  const n = { ...s, [key]: h, chain, passes: 0, turn: who === 'p' ? 'c' : 'p', lastSide: side, note: '' };
  if (!h.length) n.over = who === 'p' ? { pts: 3, title: 'Você bateu! 🎉', sub: 'Vitória!' } : { pts: 0, title: 'O computador bateu.', sub: 'Não foi desta vez.' };
  return n;
}

function applyPass(s, who) {
  const n = { ...s, passes: s.passes + 1, turn: who === 'p' ? 'c' : 'p', note: who === 'p' ? 'Você passou.' : 'O computador passou.' };
  if (n.passes >= 2) {
    const a = sum(s.hand); const b = sum(s.cpu);
    const sub = `Jogo trancado: seus pontos ${a} × ${b} do computador.`;
    n.over = a < b ? { pts: 3, title: 'Você venceu! 🎉', sub } : a > b ? { pts: 0, title: 'O computador venceu.', sub } : { pts: 1, title: 'Empate!', sub };
  }
  return n;
}

function Tile({ t, vertical, size = 'm', onClick, className = '', disabled, back }) {
  const half = (v) => (
    <span className="domino-half">
      {[...Array(9).keys()].map((i) => <i key={i} className={PIPS[v].includes(i) ? 'on' : ''} />)}
    </span>
  );
  const cls = 'domino-tile domino-' + size + (vertical ? ' domino-v' : ' domino-h') + (back ? ' domino-back' : '') + (onClick ? ' domino-btn' : '') + ' ' + className;
  const inner = back ? null : <>{half(t[0])}<span className="domino-bar" />{half(t[1])}</>;
  if (onClick) {
    return <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-label={`Pedra ${t[0]} e ${t[1]}`}>{inner}</button>;
  }
  return <span className={cls}>{inner}</span>;
}

export default function Game({ onScore, onEnd }) {
  const [s, setS] = useState(deal);
  const [sel, setSel] = useState(null); // pedra escolhida que encaixa nas duas pontas
  const ended = useRef(false);
  const scroller = useRef(null);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const over = s.over;
  const myTurn = s.turn === 'p' && !over;
  const playable = myTurn ? s.hand.filter((t) => sides(s.chain, t).length) : [];

  // Fim da partida.
  useEffect(() => {
    if (!over) return undefined;
    cb.current.onScore?.(over.pts);
    sfx(over.pts === 3 ? 'win' : over.pts === 0 ? 'lose' : 'tap');
    const t = setTimeout(() => {
      if (ended.current) return;
      ended.current = true;
      cb.current.onEnd?.(over.pts);
    }, 2200);
    return () => clearTimeout(t);
  }, [over]);

  // Som a cada pedra colocada na mesa (jogador ou computador).
  useEffect(() => { if (s.chain.length) sfx('tap'); }, [s.chain.length]);

  // Vez do computador: uma ação por vez (jogar, comprar ou passar).
  useEffect(() => {
    if (s.turn !== 'c' || s.over) return undefined;
    const t = setTimeout(() => {
      setS((st) => {
        if (st.turn !== 'c' || st.over) return st;
        const opts = st.cpu.filter((x) => sides(st.chain, x).length);
        if (opts.length) {
          const scored = opts.map((x) => ({ x, v: x[0] + x[1] + (isDouble(x) ? 4 : 0) + rand(4) }));
          scored.sort((a, b) => b.v - a.v);
          const tile = scored[0].x;
          const sd = sides(st.chain, tile);
          return applyPlay(st, 'c', tile, sd[rand(sd.length)]);
        }
        if (st.monte.length) {
          return { ...st, cpu: [...st.cpu, st.monte[0]], monte: st.monte.slice(1), note: 'O computador comprou do monte.' };
        }
        return applyPass(st, 'c');
      });
    }, 650 + rand(350));
    return () => clearTimeout(t);
  }, [s]);

  // Rola a mesa até a ponta onde a última pedra entrou.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: s.lastSide === 'L' ? 0 : el.scrollWidth, behavior: 'smooth' });
  }, [s.chain.length, s.lastSide]);

  const tapTile = (t) => {
    if (!myTurn || ended.current) return;
    const sd = sides(s.chain, t);
    if (!sd.length) return;
    if (sd.length === 2) { setSel(sel && same(sel, t) ? null : t); return; }
    setSel(null);
    setS((st) => applyPlay(st, 'p', t, sd[0]));
  };
  const toSide = (side) => {
    if (!sel || !myTurn) return;
    const t = sel; setSel(null);
    setS((st) => applyPlay(st, 'p', t, side));
  };
  const buy = () => {
    if (!myTurn || playable.length || !s.monte.length) return;
    sfx('flip');
    setS((st) => ({ ...st, hand: [...st.hand, st.monte[0]], monte: st.monte.slice(1), note: 'Você comprou uma pedra.' }));
  };
  const pass = () => {
    if (!myTurn || playable.length || s.monte.length) return;
    setS((st) => applyPass(st, 'p'));
  };

  const L = s.chain.length ? s.chain[0][0] : null;
  const R = s.chain.length ? s.chain[s.chain.length - 1][1] : null;
  const status = over ? over.title
    : myTurn ? (sel ? 'Escolha a ponta: esquerda ou direita' : playable.length ? 'Sua vez: toque em uma pedra' : s.monte.length ? 'Sem jogada: compre do monte' : 'Sem jogada e sem monte: passe a vez')
      : 'Vez do computador…';

  return (
    <div className="domino">
      <div className="domino-top">
        <div className="domino-cpu">
          <span className="domino-label">🤖 Computador · {s.cpu.length}</span>
          <div className="domino-cpu-hand">
            {s.cpu.map((t, i) => <Tile key={i} t={t} vertical size="xs" back={!over} />)}
          </div>
        </div>
        <div className="domino-monte" title="Pedras no monte">
          <span className="domino-monte-stack" />
          <b>{s.monte.length}</b>
          <small>monte</small>
        </div>
      </div>

      <div className="domino-table">
        <div className="domino-ends">
          <span>Ponta esq.: <b>{L ?? '–'}</b></span>
          <span>Ponta dir.: <b>{R ?? '–'}</b></span>
        </div>
        <div className="domino-chain" ref={scroller}>
          <div className="domino-chain-inner">
            {sel && <button type="button" className="domino-end-btn" onClick={() => toSide('L')}>◀ Aqui</button>}
            {s.chain.length === 0 && <span className="domino-empty">Mesa vazia</span>}
            {s.chain.map((t, i) => (
              <Tile key={t[0] + '-' + t[1]} t={t} vertical={isDouble(t)} size="s" className={(s.lastSide === 'L' ? i === 0 : i === s.chain.length - 1) ? 'domino-new' : ''} />
            ))}
            {sel && <button type="button" className="domino-end-btn" onClick={() => toSide('R')}>Aqui ▶</button>}
          </div>
        </div>
        {s.note && !over && <div className="domino-note">{s.note}</div>}
      </div>

      <div className={'domino-status' + (over ? ' domino-status-' + (over.pts === 3 ? 'win' : over.pts === 1 ? 'draw' : 'lose') : '')}>
        <b>{status}</b>
        {over && <small>{over.sub}</small>}
      </div>

      {myTurn && sel && (
        <div className="domino-actions">
          <button type="button" className="domino-act" onClick={() => toSide('L')}>◀ Esquerda ({L})</button>
          <button type="button" className="domino-act" onClick={() => toSide('R')}>Direita ({R}) ▶</button>
        </div>
      )}
      {myTurn && !playable.length && (
        <div className="domino-actions">
          {s.monte.length
            ? <button type="button" className="domino-act domino-act-y" onClick={buy}>Comprar do monte ({s.monte.length})</button>
            : <button type="button" className="domino-act" onClick={pass}>Passar a vez</button>}
        </div>
      )}

      <div className="domino-hand">
        <span className="domino-label">Suas pedras · {s.hand.length} ({sum(s.hand)} pontos)</span>
        <div className="domino-hand-tiles">
          {s.hand.map((t) => {
            const ok = playable.some((x) => same(x, t));
            return (
              <Tile
                key={t[0] + '-' + t[1]}
                t={t}
                vertical
                size="m"
                onClick={() => tapTile(t)}
                disabled={!myTurn || !ok}
                className={(ok ? 'domino-ok' : '') + (sel && same(sel, t) ? ' domino-sel' : '')}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
