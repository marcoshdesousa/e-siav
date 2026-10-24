// Grade da memória: alguns quadrados acendem por um instante; toque neles depois.
// A grade e a quantidade crescem a cada nível. Três erros encerram o jogo.
import { useEffect, useReducer, useRef } from 'react';
import { shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './GridMemory.css';
import { Hearts } from '../art.jsx';

const MAX_LIVES = 3;
const sizeFor = (lv) => Math.min(7, 3 + Math.floor((lv - 1) / 2));
const countFor = (lv) => Math.min(sizeFor(lv) ** 2 - 3, 2 + lv);

function makeLevel(lv) {
  const n = sizeFor(lv);
  const k = countFor(lv);
  const cells = shuffle(Array.from({ length: n * n }, (_, i) => i)).slice(0, k);
  return { lv, n, targets: new Set(cells), found: new Set(), wrong: new Set() };
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { level: makeLevel(1), phase: 'ready', score: 0, lives: MAX_LIVES, over: false };
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

  const startLevel = (lv) => {
    const s = st.current;
    s.level = makeLevel(lv);
    s.phase = 'ready';
    render();
    later(() => { s.phase = 'show'; sfx('flip'); render(); }, 500);
    later(() => { s.phase = 'input'; render(); }, 500 + 900 + s.level.targets.size * 130);
  };

  useEffect(() => {
    cb.current.onScore(0);
    startLevel(1);
    const list = timers.current;
    return () => { list.forEach(clearTimeout); list.length = 0; };
  }, []);

  const tapCell = (i) => {
    const s = st.current;
    const L = s.level;
    if (s.over || s.phase !== 'input' || L.found.has(i) || L.wrong.has(i)) return;
    if (L.targets.has(i)) {
      L.found.add(i);
      s.score += 10;
      if (L.found.size === L.targets.size) {
        s.score += L.lv * 5;
        s.phase = 'done';
        sfx('point');
        later(() => startLevel(L.lv + 1), 800);
      } else sfx('tap');
      cb.current.onScore(s.score);
    } else {
      L.wrong.add(i);
      s.lives -= 1;
      if (s.lives <= 0) {
        s.over = true;
        s.phase = 'over';
        sfx('lose');
        const final = s.score;
        later(() => cb.current.onEnd(final), 1400);
      } else sfx('error');
    }
    render();
  };

  const s = st.current;
  const L = s.level;
  const showTargets = s.phase === 'show' || s.phase === 'over';
  const msg = {
    ready: 'Prepare-se…', show: 'Memorize!', input: `Toque nos ${L.targets.size} quadrados`,
    done: 'Muito bem!', over: 'Fim de jogo',
  }[s.phase];

  return (
    <div className="gridmemory">
      <div className="gridmemory-top">
        <span>Nível <b>{L.lv}</b></span>
        <span className="gridmemory-lives" aria-label={`${s.lives} vidas`}>
          <Hearts n={s.lives} max={MAX_LIVES} />
        </span>
        <span>Pontos <b>{s.score}</b></span>
      </div>
      <div
        className={'gridmemory-board gridmemory-' + s.phase}
        style={{ gridTemplateColumns: `repeat(${L.n}, 1fr)` }}
      >
        {Array.from({ length: L.n * L.n }, (_, i) => {
          let cls = 'gridmemory-cell';
          if (L.found.has(i)) cls += ' gridmemory-found';
          else if (L.wrong.has(i)) cls += ' gridmemory-wrong';
          else if (showTargets && L.targets.has(i)) cls += s.phase === 'over' ? ' gridmemory-missed' : ' gridmemory-lit';
          return (
            <button
              key={`${L.lv}-${i}`}
              type="button"
              className={cls}
              aria-label={`Quadrado ${i + 1}`}
              onPointerDown={(e) => { e.preventDefault(); tapCell(i); }}
              onContextMenu={(e) => e.preventDefault()}
            />
          );
        })}
      </div>
      <p className="gridmemory-msg">{msg}</p>
    </div>
  );
}
