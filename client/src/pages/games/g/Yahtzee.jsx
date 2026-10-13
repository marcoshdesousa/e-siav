// General: 5 dados, até 3 jogadas por rodada (segure os dados que quiser) e 13 casas para marcar.
import { useEffect, useReducer, useRef } from 'react';
import { useKeys } from '../kit.js';
import { sfx } from '../audio.js';
import './Yahtzee.css';

const d6 = () => 1 + Math.floor(Math.random() * 6);
const sum = (d) => d.reduce((a, b) => a + b, 0);
const counts = (d) => { const c = [0, 0, 0, 0, 0, 0, 0]; d.forEach((v) => { c[v] += 1; }); return c; };
const hasRun = (d, n) => {
  const set = new Set(d);
  for (let start = 1; start + n - 1 <= 6; start++) {
    let ok = true;
    for (let v = start; v < start + n; v++) if (!set.has(v)) { ok = false; break; }
    if (ok) return true;
  }
  return false;
};

const UPPER = [
  { id: 'u1', name: 'Uns', f: (d) => d.filter((v) => v === 1).length },
  { id: 'u2', name: 'Dois', f: (d) => d.filter((v) => v === 2).length * 2 },
  { id: 'u3', name: 'Três', f: (d) => d.filter((v) => v === 3).length * 3 },
  { id: 'u4', name: 'Quatros', f: (d) => d.filter((v) => v === 4).length * 4 },
  { id: 'u5', name: 'Cincos', f: (d) => d.filter((v) => v === 5).length * 5 },
  { id: 'u6', name: 'Seis', f: (d) => d.filter((v) => v === 6).length * 6 },
];
const LOWER = [
  { id: 'k3', name: 'Trinca', f: (d) => (Math.max(...counts(d)) >= 3 ? sum(d) : 0) },
  { id: 'k4', name: 'Quadra', f: (d) => (Math.max(...counts(d)) >= 4 ? sum(d) : 0) },
  { id: 'fh', name: 'Full house', f: (d) => { const c = counts(d).filter(Boolean).sort(); return c.length === 2 && c[0] === 2 && c[1] === 3 ? 25 : 0; } },
  { id: 'ss', name: 'Sequência baixa', f: (d) => (hasRun(d, 4) ? 30 : 0) },
  { id: 'ls', name: 'Sequência alta', f: (d) => (hasRun(d, 5) ? 40 : 0) },
  { id: 'gn', name: 'General', f: (d) => (Math.max(...counts(d)) === 5 ? 50 : 0) },
  { id: 'ch', name: 'Chance', f: (d) => sum(d) },
];
const ALL = [...UPPER, ...LOWER];
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function totals(sc) {
  const upper = UPPER.reduce((a, c) => a + (sc[c.id] ?? 0), 0);
  const bonus = upper >= 63 ? 35 : 0;
  const lower = LOWER.reduce((a, c) => a + (sc[c.id] ?? 0), 0);
  return { upper, bonus, lower, total: upper + bonus + lower };
}

function Die({ v, held, rolling, onClick, disabled }) {
  return (
    <button type="button" className={'yahtzee-die' + (held ? ' yahtzee-held' : '') + (rolling ? ' yahtzee-rolling' : '')} onClick={onClick} disabled={disabled} aria-label={'Dado ' + v + (held ? ', segurado' : '')}>
      {Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[v].includes(i) ? 'yahtzee-pip' : ''} />)}
      {held && <span className="yahtzee-tag">segurado</span>}
    </button>
  );
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { dice: [1, 2, 3, 4, 5], held: [false, false, false, false, false], rolls: 0, round: 1, scores: {}, rolling: false, over: false, last: null };
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef({ roll: null, end: null });
  const ended = useRef(false);

  useEffect(() => {
    const t = timers.current;
    return () => { clearInterval(t.roll); clearTimeout(t.end); };
  }, []);

  const roll = () => {
    const s = st.current;
    if (s.over || s.rolling || s.rolls >= 3) return;
    if (s.rolls > 0 && s.held.every(Boolean)) { sfx('error'); return; }
    s.rolling = true;
    s.rolls += 1;
    s.last = null;
    sfx('shoot');
    let n = 0;
    timers.current.roll = setInterval(() => {
      const t = st.current;
      n += 1;
      t.dice = t.dice.map((v, i) => (t.held[i] ? v : d6()));
      if (n >= 7) {
        clearInterval(timers.current.roll);
        t.rolling = false;
        sfx('tap');
      }
      render();
    }, 60);
    render();
  };

  const toggle = (i) => {
    const s = st.current;
    if (s.over || s.rolling || s.rolls === 0 || s.rolls >= 3) return;
    s.held[i] = !s.held[i];
    sfx('move');
    render();
  };

  const pickCat = (cat) => {
    const s = st.current;
    if (s.over || s.rolling || s.rolls === 0 || s.scores[cat.id] != null) return;
    const before = totals(s.scores).bonus;
    const pts = cat.f(s.dice);
    s.scores[cat.id] = pts;
    s.last = cat.id;
    const t = totals(s.scores);
    sfx(pts === 0 ? 'error' : cat.id === 'gn' || t.bonus > before ? 'coin' : 'point');
    cbs.current.onScore(t.total);
    if (Object.keys(s.scores).length === ALL.length) {
      s.over = true;
      sfx('win');
      timers.current.end = setTimeout(() => {
        if (ended.current) return;
        ended.current = true;
        cbs.current.onEnd(totals(st.current.scores).total);
      }, 1600);
    } else {
      s.round += 1;
      s.rolls = 0;
      s.held = [false, false, false, false, false];
    }
    render();
  };

  useKeys((k, down) => { if (down && k === 'action') roll(); });

  const s = st.current;
  const t = totals(s.scores);
  const canPick = !s.over && !s.rolling && s.rolls > 0;
  const row = (cat) => {
    const done = s.scores[cat.id] != null;
    const val = done ? s.scores[cat.id] : canPick ? cat.f(s.dice) : null;
    return (
      <button
        key={cat.id}
        type="button"
        className={'yahtzee-row' + (done ? ' yahtzee-done' : '') + (!done && canPick ? ' yahtzee-can' + (val > 0 ? ' yahtzee-good' : '') : '') + (s.last === cat.id ? ' yahtzee-last' : '')}
        onClick={() => pickCat(cat)}
        disabled={done || !canPick}
      >
        <span>{cat.name}</span>
        <b>{val ?? ''}</b>
      </button>
    );
  };

  return (
    <div className="yahtzee">
      <div className="yahtzee-top">
        <span>Rodada <b>{Math.min(s.round, 13)}/13</b></span>
        <span>Total <b>{t.total}</b></span>
      </div>
      <div className="yahtzee-dice">
        {s.dice.map((v, i) => (
          <Die key={i} v={v} held={s.held[i]} rolling={s.rolling && !s.held[i]} onClick={() => toggle(i)} disabled={s.over || s.rolls === 0 || s.rolls >= 3} />
        ))}
      </div>
      <button type="button" className="yahtzee-roll" onClick={roll} disabled={s.over || s.rolling || s.rolls >= 3}>
        {s.over ? 'Fim de jogo!' : s.rolls === 0 ? 'Jogar os dados' : s.rolls >= 3 ? 'Escolha onde marcar' : `Jogar de novo (${3 - s.rolls})`}
      </button>
      <p className="yahtzee-hint">
        {s.over ? `Pontuação final: ${t.total}` : s.rolls === 0 ? 'Jogue os dados para começar a rodada.' : 'Toque nos dados para segurar e escolha uma casa para marcar.'}
      </p>
      <div className="yahtzee-sheet">
        <div className="yahtzee-col">
          {UPPER.map(row)}
          <div className="yahtzee-row yahtzee-sub"><span>Bônus (63+)</span><b>{t.bonus ? '+35' : `${t.upper}/63`}</b></div>
        </div>
        <div className="yahtzee-col">{LOWER.map(row)}</div>
      </div>
    </div>
  );
}
