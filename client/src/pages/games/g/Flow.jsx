// Ligue as cores: arraste entre pontos da mesma cor, sem cruzar, até preencher o quadro.
// Cada fase nasce de um caminho que passa por todas as casas (embaralhado com "backbite")
// e é cortado em pedaços; as pontas de cada pedaço viram os pontos. Sempre tem solução.
import { useEffect, useReducer, useRef } from 'react';
import { rand } from '../kit.js';
import { sfx } from '../audio.js';
import './Flow.css';
import { Timer } from 'lucide-react';

const TOTAL_SECS = 180;
const PALETTE = ['#E92A2F', '#F9C71D', '#2F7BFF', '#3CC46E', '#F58A3A', '#A66CE0', '#36D1DC', '#FF6FB5', '#E8E8E8'];
const sizeFor = (level) => (level <= 2 ? 5 : level <= 4 ? 6 : 7);

function hamiltonPath(n) {
  let path = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) path.push(r * n + (r % 2 ? n - 1 - c : c));
  const nbrs = (i) => {
    const r = Math.floor(i / n); const c = i % n; const out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  };
  const steps = n * n * 30;
  for (let s = 0; s < steps; s++) {
    if (Math.random() < 0.5) path.reverse();
    const pos = new Map(path.map((v, k) => [v, k]));
    const end = path[0];
    const cand = nbrs(end).filter((q) => q !== path[1]);
    const q = cand[rand(cand.length)];
    const i = pos.get(q);
    // liga end-q, desfaz p[i-1]-p[i]: novo caminho = reverso(p0..p[i-1]) + p[i..]
    path = [...path.slice(0, i).reverse(), ...path.slice(i)];
  }
  return path;
}

function makeLevel(level) {
  const n = sizeFor(level);
  const k = n === 5 ? 4 + rand(2) : n === 6 ? 5 + rand(2) : 6 + rand(3);
  const path = hamiltonPath(n);
  const L = path.length;
  let cuts;
  for (;;) {
    const set = new Set();
    while (set.size < k - 1) set.add(1 + rand(L - 1));
    cuts = [0, ...[...set].sort((a, b) => a - b), L];
    let ok = true;
    for (let j = 1; j < cuts.length; j++) if (cuts[j] - cuts[j - 1] < 3) ok = false;
    if (ok) break;
  }
  const dots = new Map(); // casa -> cor
  const pairs = [];
  for (let j = 0; j < k; j++) {
    const a = path[cuts[j]]; const b = path[cuts[j + 1] - 1];
    dots.set(a, j); dots.set(b, j);
    pairs.push([a, b]);
  }
  return { n, k, dots, pairs, paths: Array.from({ length: k }, () => []) };
}

const adjacent = (a, b, n) => (Math.abs(a - b) === n) || (Math.abs(a - b) === 1 && Math.floor(a / n) === Math.floor(b / n));

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { level: 1, ...makeLevel(1), total: 0, left: TOTAL_SECS, done: false, over: false, gained: 0, drag: null, levelStart: Date.now() };
  const [, render] = useReducer((x) => x + 1, 0);
  const boardRef = useRef(null);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const endAt = useRef(0);

  const finish = (delay) => {
    const s = st.current;
    if (s.over) return;
    s.over = true;
    s.drag = null;
    render();
    later(() => cbs.current.onEnd(st.current.total), delay);
  };

  useEffect(() => {
    cbs.current.onScore(0);
    endAt.current = Date.now() + TOTAL_SECS * 1000;
    const iv = setInterval(() => {
      const s = st.current;
      if (s.over || s.done) return;
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      if (left !== s.left) {
        s.left = left;
        if (left === 0) { sfx('lose'); finish(1200); }
        render();
      }
    }, 250);
    const t = timers.current;
    return () => { clearInterval(iv); t.forEach(clearTimeout); };
  }, []);

  const complete = (s, c) => {
    const p = s.paths[c];
    if (p.length < 2) return false;
    const [a, b] = s.pairs[c];
    return (p[0] === a && p[p.length - 1] === b) || (p[0] === b && p[p.length - 1] === a);
  };

  const ownerOf = (s, cell) => s.paths.findIndex((p) => p.includes(cell));

  const cellAt = (e) => {
    const el = boardRef.current;
    if (!el) return -1;
    const r = el.getBoundingClientRect();
    const s = st.current;
    const x = Math.floor(((e.clientX - r.left) / r.width) * s.n);
    const y = Math.floor(((e.clientY - r.top) / r.height) * s.n);
    if (x < 0 || y < 0 || x >= s.n || y >= s.n) return -1;
    return y * s.n + x;
  };

  const checkWin = () => {
    const s = st.current;
    const all = s.pairs.every((_, c) => complete(s, c));
    if (!all) return;
    const filled = s.paths.reduce((a, p) => a + p.length, 0) === s.n * s.n;
    if (!filled) { s.hint = true; return; }
    s.done = true;
    s.drag = null;
    const secs = Math.round((Date.now() - s.levelStart) / 1000);
    s.gained = s.n * 20 + Math.max(0, 45 - secs) * 2;
    s.total += s.gained;
    cbs.current.onScore(s.total);
    sfx('win');
    later(() => {
      const cur = st.current;
      if (cur.over) return;
      cur.level += 1;
      Object.assign(cur, makeLevel(cur.level), { done: false, hint: false, levelStart: Date.now() });
      // O tempo da mensagem entre fases não conta.
      endAt.current += 1400;
      render();
    }, 1400);
  };

  const down = (e) => {
    const s = st.current;
    if (s.over || s.done) return;
    const cell = cellAt(e);
    if (cell < 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    s.hint = false;
    if (s.dots.has(cell)) {
      const c = s.dots.get(cell);
      s.paths = s.paths.map((p, j) => (j === c ? [cell] : p));
      s.drag = c;
      sfx('tap');
    } else {
      const c = ownerOf(s, cell);
      if (c < 0) return;
      const p = s.paths[c];
      s.paths = s.paths.map((q, j) => (j === c ? p.slice(0, p.indexOf(cell) + 1) : q));
      s.drag = c;
    }
    render();
  };

  const stepInto = (s, cell) => {
    const c = s.drag;
    const p = s.paths[c];
    const last = p[p.length - 1];
    if (cell === last || !adjacent(last, cell, s.n)) return false;
    const idx = p.indexOf(cell);
    if (idx >= 0) { s.paths = s.paths.map((q, j) => (j === c ? p.slice(0, idx + 1) : q)); return true; }
    if (complete(s, c)) return false;
    if (s.dots.has(cell) && s.dots.get(cell) !== c) return false;
    // Cortar o caminho de outra cor que passe aqui.
    const o = ownerOf(s, cell);
    s.paths = s.paths.map((q, j) => {
      if (j === c) return [...p, cell];
      if (j === o) return q.slice(0, q.indexOf(cell));
      return q;
    });
    if (complete(s, c)) sfx('point'); else sfx('move');
    return true;
  };

  const move = (e) => {
    const s = st.current;
    if (s.drag == null || s.over || s.done) return;
    const target = cellAt(e);
    if (target < 0) return;
    let changed = false;
    for (let guard = 0; guard < 20; guard++) {
      const p = s.paths[s.drag];
      const last = p[p.length - 1];
      if (last === target) break;
      const lr = Math.floor(last / s.n); const lc = last % s.n;
      const tr = Math.floor(target / s.n); const tc = target % s.n;
      const next = Math.abs(tr - lr) >= Math.abs(tc - lc) ? last + Math.sign(tr - lr) * s.n : last + Math.sign(tc - lc);
      if (!stepInto(s, next)) break;
      changed = true;
    }
    if (changed) render();
  };

  const up = () => {
    const s = st.current;
    if (s.drag == null) return;
    s.drag = null;
    checkWin();
    render();
  };

  const s = st.current;
  const U = 100;
  const mm = Math.floor(s.left / 60); const ss = String(s.left % 60).padStart(2, '0');
  const ctr = (i) => [(i % s.n) * U + U / 2, Math.floor(i / s.n) * U + U / 2];
  const doneCount = s.pairs.filter((_, c) => complete(s, c)).length;
  const filled = s.paths.reduce((a, p) => a + p.length, 0);
  return (
    <div className="flow">
      <div className="flow-top">
        <span>Fase <b>{s.level}</b></span>
        <span className={s.left <= 20 ? 'flow-warn' : ''}><Timer size={14} style={{ verticalAlign: '-2px' }} /> <b>{mm}:{ss}</b></span>
        <span>Pontos: <b>{s.total}</b></span>
      </div>
      <div className="flow-wrap">
        <div
          ref={boardRef}
          className={'flow-board' + (s.done ? ' flow-solved' : '')}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <svg viewBox={`0 0 ${s.n * U} ${s.n * U}`} className="flow-svg">
            {s.paths.map((p, c) => p.map((i) => {
              const [x, y] = ctr(i);
              return <rect key={'f' + i} x={x - U / 2} y={y - U / 2} width={U} height={U} fill={PALETTE[c]} opacity="0.22" />;
            }))}
            {Array.from({ length: s.n + 1 }, (_, i) => (
              <g key={'g' + i} stroke="rgba(255,255,255,.14)" strokeWidth="2">
                <line x1={i * U} y1="0" x2={i * U} y2={s.n * U} />
                <line x1="0" y1={i * U} x2={s.n * U} y2={i * U} />
              </g>
            ))}
            {s.paths.map((p, c) => (p.length > 1 ? (
              <polyline key={'p' + c} points={p.map((i) => ctr(i).join(',')).join(' ')} fill="none" stroke={PALETTE[c]} strokeWidth={U * 0.32} strokeLinecap="round" strokeLinejoin="round" />
            ) : null))}
            {s.pairs.map(([a, b], c) => [a, b].map((i) => {
              const [x, y] = ctr(i);
              return <circle key={'d' + i} cx={x} cy={y} r={U * 0.34} fill={PALETTE[c]} stroke={complete(s, c) ? '#fff' : 'rgba(0,0,0,.35)'} strokeWidth="5" />;
            }))}
          </svg>
          {s.done && <div className="flow-msg"><b>Tudo ligado!</b><span>+{s.gained} pontos</span></div>}
          {s.over && !s.done && <div className="flow-msg"><b>O tempo acabou!</b></div>}
        </div>
      </div>
      <div className="flow-foot">
        {s.hint
          ? <span className="flow-hint-on">Ligou tudo! Agora preencha todas as casas.</span>
          : <span>Ligados: <b>{doneCount}</b>/{s.k} · Preenchido: <b>{Math.round((filled / (s.n * s.n)) * 100)}%</b></span>}
      </div>
    </div>
  );
}
