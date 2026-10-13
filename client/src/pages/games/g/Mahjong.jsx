// Mahjong paciência: 72 pedras em 3 camadas. Junte pares iguais que estejam livres
// (nada por cima e um dos lados livre). O tabuleiro é gerado de trás para a frente, então sempre tem solução.
import { useEffect, useReducer, useRef, useState } from 'react';
import { shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './Mahjong.css';

const SYMBOLS = ['🌲', '🍀', '🌻', '🍎', '🐟', '🐦', '🦋', '🐞', '⭐', '🌙', '☀️', '⛺', '🔥', '🧭', '🎒', '🐝', '🌈', '🍇'];
const COLS = 8; const ROWS = 6;

function layout() {
  const pos = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x === 0 || x === 7) && (y === 0 || y === 5)) continue;
      pos.push({ x, y, z: 0 });
    }
  }
  for (let y = 1; y < 5; y++) for (let x = 1; x < 7; x++) pos.push({ x, y, z: 1 });
  for (let y = 2; y < 4; y++) for (let x = 3; x < 5; x++) pos.push({ x, y, z: 2 });
  return pos.map((p, i) => ({ ...p, id: i }));
}

// Livre: nada em cima e (esquerda livre ou direita livre).
function isFree(t, alive) {
  let left = false; let right = false;
  for (const o of alive) {
    if (o === t) continue;
    if (o.z === t.z + 1 && Math.abs(o.x - t.x) < 1 && Math.abs(o.y - t.y) < 1) return false;
    if (o.z === t.z && Math.abs(o.y - t.y) < 1) {
      if (o.x === t.x - 1) left = true;
      if (o.x === t.x + 1) right = true;
    }
  }
  return !(left && right);
}

// Sequência de retirada válida (pares de pedras livres ao mesmo tempo) para as posições dadas.
function removalOrder(tiles) {
  for (let attempt = 0; attempt < 300; attempt++) {
    let alive = [...tiles];
    const pairs = [];
    let ok = true;
    while (alive.length) {
      const free = shuffle(alive.filter((t) => isFree(t, alive)));
      if (free.length < 2) { ok = false; break; }
      // Prefere tirar das camadas de cima, o que evita becos sem saída.
      free.sort((a, b) => b.z - a.z + (Math.random() - 0.5) * 1.5);
      const a = free[0]; const b = free[1];
      pairs.push([a, b]);
      alive = alive.filter((t) => t !== a && t !== b);
    }
    if (ok) return pairs;
  }
  return null;
}

// Distribui os símbolos (em pares) seguindo a sequência de retirada: assim sempre há solução.
function assign(tiles, symbolPairs) {
  const order = removalOrder(tiles);
  const syms = shuffle(symbolPairs);
  if (!order) {
    const flat = shuffle(syms.flatMap((sy) => [sy, sy]));
    tiles.forEach((t, i) => { t.sym = flat[i]; });
    return;
  }
  order.forEach(([a, b], i) => { a.sym = syms[i]; b.sym = syms[i]; });
}

function newBoard() {
  const tiles = layout();
  const pairs = [];
  for (let i = 0; i < tiles.length / 2; i++) pairs.push(SYMBOLS[i % SYMBOLS.length]);
  assign(tiles, pairs);
  return tiles;
}

function hasMove(alive) {
  const free = alive.filter((t) => isFree(t, alive));
  const seen = new Set();
  for (const t of free) { if (seen.has(t.sym)) return true; seen.add(t.sym); }
  return false;
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { tiles: newBoard(), sel: null, pairs: 0, penalty: 0, start: Date.now(), secs: 0, over: false, stuck: false, bad: null, final: 0 };
  const [, render] = useReducer((x) => x + 1, 0);
  const wrap = useRef(null);
  const [W, setW] = useState(360);
  const timers = useRef({ end: null, bad: null });
  const ended = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const upd = () => setW(Math.max(260, Math.floor(el.clientWidth)));
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const s = st.current;
      if (s.over) return;
      const secs = Math.floor((Date.now() - s.start) / 1000);
      if (secs !== s.secs) { s.secs = secs; render(); }
    }, 500);
    const tm = timers.current;
    return () => { clearInterval(t); clearTimeout(tm.end); clearTimeout(tm.bad); };
  }, []);

  const scoreOf = (s) => Math.max(0, s.pairs * 10 - s.penalty);

  const tap = (t) => {
    const s = st.current;
    if (s.over) return;
    if (!isFree(t, s.tiles)) {
      sfx('error');
      s.bad = t.id;
      clearTimeout(timers.current.bad);
      timers.current.bad = setTimeout(() => { st.current.bad = null; render(); }, 350);
      render();
      return;
    }
    if (s.sel == null) { s.sel = t.id; sfx('tap'); render(); return; }
    if (s.sel === t.id) { s.sel = null; sfx('move'); render(); return; }
    const other = s.tiles.find((o) => o.id === s.sel);
    if (other && other.sym === t.sym) {
      s.tiles = s.tiles.filter((o) => o !== t && o !== other);
      s.sel = null;
      s.pairs += 1;
      sfx('pop');
      if (!s.tiles.length) {
        s.over = true;
        s.secs = Math.floor((Date.now() - s.start) / 1000);
        s.bonus = Math.max(0, 900 - s.secs * 3);
        s.final = scoreOf(s) + s.bonus;
        cbs.current.onScore(s.final);
        sfx('win');
        timers.current.end = setTimeout(() => {
          if (ended.current) return;
          ended.current = true;
          cbs.current.onEnd(st.current.final);
        }, 1400);
      } else {
        cbs.current.onScore(scoreOf(s));
        s.stuck = !hasMove(s.tiles);
      }
      render();
      return;
    }
    s.sel = t.id;
    sfx('tap');
    render();
  };

  const reshuffle = () => {
    const s = st.current;
    if (s.over || !s.tiles.length) return;
    const syms = s.tiles.map((t) => t.sym).sort();
    const pairs = [];
    for (let i = 0; i < syms.length; i += 2) pairs.push(syms[i]);
    let tries = 0;
    do { assign(s.tiles, pairs); tries += 1; } while (!hasMove(s.tiles) && tries < 20);
    s.penalty += 50;
    s.sel = null;
    s.stuck = !hasMove(s.tiles);
    sfx('flip');
    cbs.current.onScore(scoreOf(s));
    render();
  };

  const s = st.current;
  const tw = (W - 10) / (COLS + 0.3);
  const th = tw * 1.28;
  const depth = Math.max(3, Math.round(tw * 0.1));
  const H = ROWS * th + depth * 3 + 6;
  const mm = String(Math.floor(s.secs / 60)).padStart(2, '0');
  const ss = String(s.secs % 60).padStart(2, '0');
  const sorted = [...s.tiles].sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);

  return (
    <div className="mahjong" ref={wrap}>
      <div className="mahjong-top">
        <span>⏱ <b>{mm}:{ss}</b></span>
        <span>Pedras <b>{s.tiles.length}</b></span>
        <span>Pontos <b>{s.over ? s.final : scoreOf(s)}</b></span>
      </div>
      <div className="mahjong-board" style={{ height: H, fontSize: tw * 0.62 }}>
        {sorted.map((t, i) => {
          const free = isFree(t, s.tiles);
          return (
            <button
              key={t.id}
              type="button"
              className={'mahjong-tile' + (free ? '' : ' mahjong-blocked') + (s.sel === t.id ? ' mahjong-sel' : '') + (s.bad === t.id ? ' mahjong-bad' : '')}
              style={{
                left: 4 + t.x * tw + depth * 3 - t.z * depth,
                top: 2 + t.y * th + depth * 3 - t.z * depth,
                width: tw, height: th, zIndex: i + 1, '--d': depth + 'px',
              }}
              onClick={() => tap(t)}
              aria-label={t.sym + (free ? '' : ' (presa)')}
            >
              <span>{t.sym}</span>
            </button>
          );
        })}
        {s.over && <div className="mahjong-done">Tabuleiro limpo! 🎉<small>Bônus de tempo +{s.bonus}</small></div>}
      </div>
      <div className="mahjong-bar">
        <span className={'mahjong-msg' + (s.stuck ? ' mahjong-msg-stuck' : '')}>
          {s.stuck ? 'Sem pares livres! Embaralhe.' : 'Toque em duas pedras livres iguais.'}
        </span>
        <button type="button" className={'mahjong-shuffle' + (s.stuck ? ' mahjong-shuffle-hot' : '')} onClick={reshuffle} disabled={s.over}>
          Embaralhar (−50)
        </button>
      </div>
    </div>
  );
}
