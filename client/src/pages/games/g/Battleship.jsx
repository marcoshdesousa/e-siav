// Batalha naval 8x8 contra o computador. Tiros alternados; menos tiros = mais pontos.
import { useEffect, useRef, useState } from 'react';
import { pick, rand } from '../kit.js';
import { sfx } from '../audio.js';
import './Battleship.css';

// #region logic
const S = 8;
const SIZES = [4, 3, 3, 2, 2];
const NAMES = { 4: 'Encouraçado', 3: 'Cruzador', 2: 'Submarino' };
const rc = (i) => [Math.floor(i / S), i % S];
const near = (i, diag) => {
  const [r, c] = rc(i);
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      if (!diag && dr && dc) continue;
      const rr = r + dr; const cc = c + dc;
      if (rr >= 0 && rr < S && cc >= 0 && cc < S) out.push(rr * S + cc);
    }
  }
  return out;
};

/** Frota aleatória sem navios encostados (nem na diagonal). */
function randomFleet() {
  for (;;) {
    const occ = Array(S * S).fill(-1);
    const ships = [];
    let ok = true;
    for (const len of SIZES) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const hor = Math.random() < 0.5;
        const r = rand(hor ? S : S - len + 1); const c = rand(hor ? S - len + 1 : S);
        const cells = Array.from({ length: len }, (_, k) => (hor ? r * S + c + k : (r + k) * S + c));
        if (cells.every((x) => occ[x] < 0 && near(x, true).every((y) => occ[y] < 0))) {
          cells.forEach((x) => { occ[x] = ships.length; });
          ships.push(cells);
          placed = true;
        }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return { occ, ships };
  }
}

const sunkShips = (fleet, shots) => fleet.ships.map((cells) => cells.every((x) => shots[x])).map((v, i) => (v ? i : -1)).filter((i) => i >= 0);

/** Tiro do computador: caça em volta dos acertos; sem pistas, atira em xadrez. */
function aiShot(fleet, shots) {
  const sunk = new Set(sunkShips(fleet, shots));
  const blocked = new Set();
  sunk.forEach((si) => fleet.ships[si].forEach((x) => near(x, true).forEach((y) => blocked.add(y))));
  const open = [];
  for (let i = 0; i < S * S; i++) if (shots[i] && fleet.occ[i] >= 0 && !sunk.has(fleet.occ[i])) open.push(i);
  const can = (i) => !shots[i] && !blocked.has(i);
  if (open.length) {
    if (open.length >= 2) {
      const [r0, c0] = rc(open[0]);
      const sameRow = open.every((i) => rc(i)[0] === r0);
      const sameCol = open.every((i) => rc(i)[1] === c0);
      const ends = [];
      if (sameRow) {
        const cs = open.map((i) => rc(i)[1]);
        const lo = Math.min(...cs) - 1; const hi = Math.max(...cs) + 1;
        if (lo >= 0) ends.push(r0 * S + lo);
        if (hi < S) ends.push(r0 * S + hi);
      } else if (sameCol) {
        const rs = open.map((i) => rc(i)[0]);
        const lo = Math.min(...rs) - 1; const hi = Math.max(...rs) + 1;
        if (lo >= 0) ends.push(lo * S + c0);
        if (hi < S) ends.push(hi * S + c0);
      }
      const e = ends.filter(can);
      if (e.length) return pick(e);
    }
    const cand = [...new Set(open.flatMap((i) => near(i, false)))].filter(can);
    if (cand.length) return pick(cand);
  }
  // Na procura, às vezes esquece a regra de não encostar (fica mais humano).
  const smart = Math.random() < 0.5;
  const all = [...Array(S * S).keys()].filter((i) => (smart ? can(i) : !shots[i]));
  const parity = all.filter((i) => (rc(i)[0] + rc(i)[1]) % 2 === 0);
  // Às vezes erra o padrão, para não ficar perfeito demais.
  return pick(parity.length && Math.random() < 0.35 ? parity : all);
}
// #endregion

const LETTERS = 'ABCDEFGH';
const allSunk = (fleet, shots) => fleet.ships.every((cells) => cells.every((x) => shots[x]));

export default function Game({ onScore, onEnd }) {
  const [mine, setMine] = useState(randomFleet);
  const [enemy] = useState(randomFleet);
  const [myShots, setMyShots] = useState(() => Array(S * S).fill(false)); // meus tiros no inimigo
  const [cpuShots, setCpuShots] = useState(() => Array(S * S).fill(false));
  const [turn, setTurn] = useState('me');
  const [lastMe, setLastMe] = useState(-1);
  const [lastCpu, setLastCpu] = useState(-1);
  const [note, setNote] = useState('');
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const shots = myShots.filter(Boolean).length;
  const hits = myShots.filter((v, i) => v && enemy.occ[i] >= 0).length;
  const won = allSunk(enemy, myShots);
  const lost = !won && allSunk(mine, cpuShots);
  const outcome = won ? 'win' : lost ? 'lose' : null;
  const enemySunk = new Set(sunkShips(enemy, myShots));
  const mySunk = new Set(sunkShips(mine, cpuShots));

  useEffect(() => { cb.current.onScore?.(hits * 5); }, [hits]);

  useEffect(() => {
    if (!outcome) return undefined;
    const pts = outcome === 'win' ? Math.max(100, 1000 - shots * 10) : hits * 5;
    cb.current.onScore?.(pts);
    sfx(outcome === 'win' ? 'win' : 'lose');
    const t = setTimeout(() => {
      if (ended.current) return;
      ended.current = true;
      cb.current.onEnd?.(pts);
    }, 1800);
    return () => clearTimeout(t);
  }, [outcome]);

  useEffect(() => {
    if (turn !== 'cpu' || outcome) return undefined;
    const t = setTimeout(() => {
      const i = aiShot(mine, cpuShots);
      const ns = cpuShots.slice(); ns[i] = true;
      const hit = mine.occ[i] >= 0;
      const sunkNow = hit && mine.ships[mine.occ[i]].every((x) => ns[x]);
      sfx(hit ? 'hit' : 'pop');
      setCpuShots(ns);
      setLastCpu(i);
      setNote(sunkNow ? `O computador afundou seu ${NAMES[mine.ships[mine.occ[i]].length].toLowerCase()}!` : hit ? `O computador acertou ${LETTERS[rc(i)[0]]}${rc(i)[1] + 1}!` : `O computador errou (${LETTERS[rc(i)[0]]}${rc(i)[1] + 1}).`);
      setTurn('me');
    }, 650 + rand(350));
    return () => clearTimeout(t);
  }, [turn, outcome, mine, cpuShots]);

  const fire = (i) => {
    if (turn !== 'me' || outcome || ended.current) return;
    if (myShots[i]) { sfx('error'); return; }
    const ns = myShots.slice(); ns[i] = true;
    const hit = enemy.occ[i] >= 0;
    const sunkNow = hit && enemy.ships[enemy.occ[i]].every((x) => ns[x]);
    sfx(sunkNow ? 'coin' : hit ? 'hit' : 'shoot');
    setMyShots(ns);
    setLastMe(i);
    setNote(sunkNow ? `Você afundou um ${NAMES[enemy.ships[enemy.occ[i]].length].toLowerCase()}!` : hit ? 'Acertou! 💥' : 'Água…');
    if (!allSunk(enemy, ns)) setTurn('cpu');
  };

  const reroll = () => {
    if (shots > 0) return;
    sfx('flip');
    setMine(randomFleet());
  };

  const potential = Math.max(100, 1000 - shots * 10);
  const msg = outcome === 'win' ? `Vitória em ${shots} tiros! 🎉` : outcome === 'lose' ? 'Sua frota afundou.'
    : turn === 'me' ? 'Sua vez: atire no mar inimigo' : 'O computador está mirando…';

  const shipsLeft = (sunk) => SIZES.map((len, k) => ({ len, sunk: sunk.has(k) }));

  return (
    <div className="battleship">
      <div className={'battleship-status' + (outcome ? ' battleship-status-' + outcome : '')}>{msg}</div>
      <div className="battleship-info">
        <span>Tiros: <b>{shots}</b></span>
        <span>Vale: <b>{potential}</b></span>
        <span>Acertos: <b>{hits}</b>/14</span>
      </div>
      <div className={'battleship-grid battleship-enemy' + (turn === 'me' && !outcome ? '' : ' battleship-busy')}>
        {myShots.map((shot, i) => {
          const ship = enemy.occ[i];
          const cls = ['battleship-cell'];
          if (shot) cls.push(ship >= 0 ? 'battleship-hit' : 'battleship-miss');
          if (ship >= 0 && enemySunk.has(ship)) cls.push('battleship-sunk');
          if (outcome === 'lose' && ship >= 0 && !shot) cls.push('battleship-reveal');
          if (i === lastMe) cls.push('battleship-lastshot');
          return (
            <button key={i} type="button" className={cls.join(' ')} onClick={() => fire(i)} aria-label={LETTERS[rc(i)[0]] + (rc(i)[1] + 1)}>
              {shot ? (ship >= 0 ? '✹' : '•') : ''}
            </button>
          );
        })}
      </div>
      <div className="battleship-note">{note || 'Navios não se encostam, nem na diagonal.'}</div>
      <div className="battleship-bottom">
        <div className="battleship-grid battleship-mine">
          {cpuShots.map((shot, i) => {
            const ship = mine.occ[i];
            const cls = ['battleship-cell'];
            if (ship >= 0) cls.push('battleship-ship');
            if (shot) cls.push(ship >= 0 ? 'battleship-hit' : 'battleship-miss');
            if (ship >= 0 && mySunk.has(ship)) cls.push('battleship-sunk');
            if (i === lastCpu) cls.push('battleship-lastshot');
            return <span key={i} className={cls.join(' ')}>{shot ? (ship >= 0 ? '✹' : '•') : ''}</span>;
          })}
        </div>
        <div className="battleship-side">
          <div className="battleship-fleet">
            <small>Inimigo</small>
            {shipsLeft(enemySunk).map((s, k) => <i key={k} className={'battleship-pill' + (s.sunk ? ' battleship-pill-sunk' : '')} style={{ width: s.len * 12 }} />)}
          </div>
          <div className="battleship-fleet">
            <small>Sua frota</small>
            {shipsLeft(mySunk).map((s, k) => <i key={k} className={'battleship-pill battleship-pill-me' + (s.sunk ? ' battleship-pill-sunk' : '')} style={{ width: s.len * 12 }} />)}
          </div>
          {shots === 0 && !outcome && (
            <button type="button" className="battleship-reroll" onClick={reroll}>🎲 Sortear de novo</button>
          )}
        </div>
      </div>
    </div>
  );
}
