// Reflexo: espere a tela ficar verde e toque o mais rápido possível. 5 rodadas.
// Pontos por rodada = 600 − tempo em ms (mínimo 0). Tocar antes do verde zera a rodada.
import { useEffect, useReducer, useRef } from 'react';
import { useKeys } from '../kit.js';
import { sfx } from '../audio.js';
import './Reaction.css';

const ROUNDS = 5;
const TIMEOUT = 1500;
const pts = (ms) => Math.max(0, 600 - ms);

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { phase: 'wait', round: 1, results: [], score: 0, goAt: 0, over: false };
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const startRound = () => {
    const s = st.current;
    s.phase = 'wait';
    render();
    later(() => {
      s.phase = 'go';
      s.goAt = window.performance.now();
      sfx('pop');
      render();
      later(() => { if (s.phase === 'go') finishRound({ ms: null, label: 'Lento', points: 0 }); }, TIMEOUT);
    }, 1300 + Math.random() * 2400);
  };

  const finishRound = (res) => {
    const s = st.current;
    clearAll();
    s.results.push(res);
    s.score += res.points;
    cb.current.onScore(s.score);
    s.phase = res.early ? 'early' : 'result';
    if (s.results.length >= ROUNDS) {
      s.over = true;
      later(() => { s.phase = 'end'; sfx('win'); render(); }, 1100);
      later(() => cb.current.onEnd(s.score), 2300);
    } else {
      later(() => { s.round += 1; startRound(); }, 1300);
    }
    render();
  };

  const press = () => {
    const s = st.current;
    if (s.over) return;
    if (s.phase === 'wait') {
      sfx('error');
      finishRound({ ms: null, label: 'Cedo!', points: 0, early: true });
    } else if (s.phase === 'go') {
      const ms = Math.round(window.performance.now() - s.goAt);
      const p = pts(ms);
      sfx(p > 300 ? 'point' : 'tap');
      finishRound({ ms, label: `${ms} ms`, points: p });
    }
  };

  useKeys((k, down) => { if (down && k === 'action') press(); });

  useEffect(() => {
    cb.current.onScore(0);
    startRound();
    return clearAll;
  }, []);

  const s = st.current;
  const last = s.results[s.results.length - 1];
  let title; let sub;
  if (s.phase === 'wait') { title = 'Espere…'; sub = 'Toque quando ficar verde'; }
  else if (s.phase === 'go') { title = 'TOQUE!'; sub = ''; }
  else if (s.phase === 'early') { title = 'Cedo demais!'; sub = 'Rodada sem pontos'; }
  else if (s.phase === 'result') { title = last?.ms != null ? `${last.ms} ms` : 'Muito lento!'; sub = `+${last?.points ?? 0} pontos`; }
  else {
    const valid = s.results.filter((r) => r.ms != null);
    const best = valid.length ? Math.min(...valid.map((r) => r.ms)) : null;
    title = `${s.score} pontos`;
    sub = best != null ? `Melhor tempo: ${best} ms` : 'Nenhum toque válido';
  }

  return (
    <div className="reaction">
      <button
        type="button"
        className={'reaction-pad reaction-' + s.phase}
        onPointerDown={(e) => { e.preventDefault(); press(); }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="reaction-round">{s.phase === 'end' ? 'Resultado' : `Rodada ${Math.min(s.round, ROUNDS)} de ${ROUNDS}`}</span>
        <b className="reaction-title">{title}</b>
        {sub && <span className="reaction-sub">{sub}</span>}
      </button>
      <ol className="reaction-list">
        {Array.from({ length: ROUNDS }, (_, i) => {
          const r = s.results[i];
          return (
            <li key={i} className={r ? (r.points > 0 ? 'reaction-ok' : 'reaction-bad') : ''}>
              <small>{i + 1}ª</small>
              <b>{r ? r.label : '—'}</b>
              {r && <em>+{r.points}</em>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
