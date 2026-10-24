// Água da rocha (Moisés): gire os canais para a água ir da rocha (esquerda) até o acampamento (direita).
// Cada fase nasce de um caminho aleatório já ligado; depois as peças são giradas ao acaso,
// então sempre há solução.
import { useEffect, useReducer, useRef } from 'react';
import { rand, shuffle, useKeys } from '../kit.js';
import { sfx } from '../audio.js';
import { Mountain, Tent, Timer } from 'lucide-react';
import './Pipes.css';

const START_SECS = 120;
const BONUS_SECS = 20;
// Direções em bits: N=1, L(leste)=2, S=4, O(oeste)=8.
const DIRS = [[1, -1, 0], [2, 0, 1], [4, 1, 0], [8, 0, -1]];
const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
const rot = (m, k) => { let x = m; for (let i = 0; i < ((k % 4) + 4) % 4; i++) x = ((x << 1) | (x >> 3)) & 15; return x; };
const sizeFor = (level) => Math.min(7, 4 + Math.floor((level - 1) / 2));

function randomPath(n, rs, rd) {
  // DFS aleatória (sem desmarcar visitados): linear e sempre devolve um caminho simples.
  const seen = new Uint8Array(n * n);
  const stack = [rs * n];
  seen[rs * n] = 1;
  const target = rd * n + n - 1;
  const order = new Map();
  while (stack.length) {
    const cur = stack[stack.length - 1];
    if (cur === target) return [...stack];
    if (!order.has(cur)) order.set(cur, shuffle(DIRS));
    const opts = order.get(cur);
    let moved = false;
    while (opts.length) {
      const [, dr, dc] = opts.pop();
      const r = Math.floor(cur / n) + dr; const c = (cur % n) + dc;
      if (r < 0 || c < 0 || r >= n || c >= n) continue;
      const j = r * n + c;
      if (seen[j]) continue;
      seen[j] = 1;
      stack.push(j);
      moved = true;
      break;
    }
    if (!moved) stack.pop();
  }
  return null;
}

const dirBetween = (a, b, n) => {
  if (b === a - n) return 1;
  if (b === a + 1) return 2;
  if (b === a + n) return 4;
  return 8;
};

function flow(cells, n, rs) {
  // Água que entra pela esquerda da célula (rs, 0). Devolve distância de cada célula molhada.
  const dist = new Map();
  const start = rs * n;
  if (!(cells[start].mask & 8)) return dist;
  dist.set(start, 0);
  const q = [start];
  while (q.length) {
    const i = q.shift();
    const m = cells[i].mask;
    const r = Math.floor(i / n); const c = i % n;
    DIRS.forEach(([bit, dr, dc]) => {
      if (!(m & bit)) return;
      const rr = r + dr; const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) return;
      const j = rr * n + cc;
      if (dist.has(j) || !(cells[j].mask & OPP[bit])) return;
      dist.set(j, dist.get(i) + 1);
      q.push(j);
    });
  }
  return dist;
}

const solvedBy = (cells, n, rd, dist) => dist.has(rd * n + n - 1) && !!(cells[rd * n + n - 1].mask & 2);

function makeLevel(level) {
  const n = sizeFor(level);
  for (let tries = 0; ; tries++) {
    const rs = rand(n); const rd = rand(n);
    const path = randomPath(n, rs, rd);
    if (!path || (path.length < n + 2 + Math.min(level, 6) && tries < 40)) continue;
    const base = Array(n * n).fill(0);
    path.forEach((cell, k) => {
      const inn = k === 0 ? 8 : OPP[dirBetween(path[k - 1], cell, n)];
      const out = k === path.length - 1 ? 2 : dirBetween(cell, path[k + 1], n);
      base[cell] = inn | out;
    });
    const DECOYS = [5, 3, 3, 7, 3, 5];
    for (let i = 0; i < n * n; i++) if (!base[i]) base[i] = DECOYS[rand(DECOYS.length)];
    const cells = base.map((m) => { const r = rand(4); return { base: m, r, mask: rot(m, r) }; });
    const dist = flow(cells, n, rs);
    if (solvedBy(cells, n, rd, dist)) continue;
    return { n, rs, rd, cells };
  }
}

function PipeSvg({ mask }) {
  const segs = [];
  if (mask & 1) segs.push('M50 50V-2');
  if (mask & 2) segs.push('M50 50H102');
  if (mask & 4) segs.push('M50 50V102');
  if (mask & 8) segs.push('M50 50H-2');
  const d = segs.join('');
  return (
    <svg viewBox="0 0 100 100" className="pipes-svg" aria-hidden="true">
      <path d={d} className="pipes-out" />
      <path d={d} className="pipes-in" />
      <circle cx="50" cy="50" r="15" className="pipes-joint" />
    </svg>
  );
}

const levelScore = (n, secs) => 40 + n * 10 + Math.max(0, 30 - secs) * 3;

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) {
    const lv = makeLevel(1);
    st.current = { level: 1, ...lv, dist: flow(lv.cells, lv.n, lv.rs), total: 0, left: START_SECS, cursor: 0, done: false, over: false, gained: 0, levelStart: Date.now() };
  }
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const endAt = useRef(0);

  const finish = (delay) => {
    const s = st.current;
    if (s.over) return;
    s.over = true;
    render();
    later(() => cbs.current.onEnd(st.current.total), delay);
  };

  useEffect(() => {
    cbs.current.onScore(0);
    endAt.current = Date.now() + START_SECS * 1000;
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

  const turn = (i) => {
    const s = st.current;
    if (s.over || s.done) return;
    s.cursor = i;
    const c = s.cells[i];
    s.cells = s.cells.map((x, k) => (k === i ? { ...c, r: c.r + 1, mask: rot(c.base, c.r + 1) } : x));
    s.dist = flow(s.cells, s.n, s.rs);
    if (solvedBy(s.cells, s.n, s.rd, s.dist)) {
      s.done = true;
      const secs = Math.round((Date.now() - s.levelStart) / 1000);
      s.gained = levelScore(s.n, secs);
      s.total += s.gained;
      endAt.current += BONUS_SECS * 1000;
      s.left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      sfx('win');
      cbs.current.onScore(s.total);
      const maxD = Math.max(...s.dist.values());
      later(() => {
        const cur = st.current;
        if (cur.over) return;
        // O tempo da animação da água não conta.
        endAt.current += 1600 + maxD * 70;
        cur.level += 1;
        const lv = makeLevel(cur.level);
        Object.assign(cur, lv, { dist: flow(lv.cells, lv.n, lv.rs), done: false, cursor: 0, levelStart: Date.now() });
        render();
      }, 1600 + maxD * 70);
    } else {
      sfx('tap');
    }
    render();
  };

  useKeys((k, down) => {
    if (!down) return;
    const s = st.current;
    const r = Math.floor(s.cursor / s.n); const c = s.cursor % s.n;
    if (k === 'up' && r > 0) s.cursor -= s.n;
    else if (k === 'down' && r < s.n - 1) s.cursor += s.n;
    else if (k === 'left' && c > 0) s.cursor -= 1;
    else if (k === 'right' && c < s.n - 1) s.cursor += 1;
    else if (k === 'action') { turn(s.cursor); return; }
    render();
  });

  const s = st.current;
  const mm = Math.floor(s.left / 60); const ss = String(s.left % 60).padStart(2, '0');
  const rowPct = (r) => ((r + 0.5) / s.n) * 100 + '%';
  const drainWet = s.done;
  return (
    <div className="pipes">
      <div className="pipes-top">
        <span>Fase <b>{s.level}</b></span>
        <span className={s.left <= 15 ? 'pipes-warn' : ''}><Timer size={14} style={{ verticalAlign: '-2px' }} /> <b>{mm}:{ss}</b></span>
        <span>Pontos: <b>{s.total}</b></span>
      </div>
      <div className="pipes-wrap">
        <div className="pipes-side">
          <div className="pipes-tap" style={{ top: rowPct(s.rs) }}><span title="Rocha"><Mountain size={20} color="#8A7C66" fill="#B9AE98" /></span><i className="pipes-stub pipes-wet" /></div>
        </div>
        <div className={'pipes-board' + (s.done ? ' pipes-solved' : '')} style={{ gridTemplateColumns: `repeat(${s.n}, 1fr)` }}>
          {s.cells.map((c, i) => {
            const d = s.dist.get(i);
            const wet = d !== undefined;
            return (
              <button
                key={s.level + '-' + i}
                type="button"
                className={'pipes-cell' + (wet ? ' pipes-wet' : '') + (s.cursor === i ? ' pipes-cur' : '')}
                style={{ '--d': (d || 0) * 70 + 'ms' }}
                onClick={() => turn(i)}
                aria-label="Girar cano"
              >
                <div className="pipes-rot" style={{ transform: `rotate(${c.r * 90}deg)` }}>
                  <PipeSvg mask={c.base} />
                </div>
              </button>
            );
          })}
          {s.done && <div className="pipes-msg"><b>A água chegou!</b><span>+{s.gained} pontos · +{BONUS_SECS}s</span></div>}
          {s.over && !s.done && <div className="pipes-msg"><b>O tempo acabou!</b></div>}
        </div>
        <div className="pipes-side">
          <div className="pipes-drain" style={{ top: rowPct(s.rd) }}><i className={'pipes-stub' + (drainWet ? ' pipes-wet' : '')} /><span title="Acampamento"><Tent size={20} color="#F9C71D" /></span></div>
        </div>
      </div>
      <p className="pipes-hint">Toque num cano para girá-lo. No teclado: setas e espaço.</p>
    </div>
  );
}
