// Pedras do muro (Neemias): leve todas as pedras até os lugares marcados. Fases feitas à mão e
// conferidas por um resolvedor (busca em largura), então todas têm solução.
import { useEffect, useReducer, useRef } from 'react';
import { useKeys, useSwipe } from '../kit.js';
import DPad from '../DPad.jsx';
import { sfx } from '../audio.js';
import './Sokoban.css';

// # parede · . alvo · $ caixa · * caixa no alvo · @ jogador · + jogador no alvo
const LEVELS = [
  ['######', '#@ $.#', '######'],
  ['######', '#.   #', '#.$$@#', '#    #', '######'],
  ['  ####', '###  #', '#    #', '# $*@#', '#  . #', '######'],
  ['  #### ', '###  ##', '#  $  #', '# #.# #', '# .$  #', '##  @ #', ' ######'],
  ['#####  ', '#   ###', '# $   #', '## .# #', ' #.$ @#', ' ######'],
  ['######', '#    #', '# #@ #', '# $* #', '# .* #', '#    #', '######'],
  ['########', '#  .   #', '# $##$ #', '#  @#. #', '########'],
  [' #####', ' #@  #', ' # $ #', '## # ##', '#.$  .#', '#     #', '#######'],
  ['  #####', '###  @#', '# $ $ #', '#.  . #', '#######'],
  ['#######', '#.  # #', '# $   #', '# #$# #', '#. @  #', '#######'],
  ['########', '#      #', '# #$$# #', '# .  . #', '##  ## #', ' #@    #', ' ######'],
  ['####', '# .#', '#  ###', '#*@  #', '#  $ #', '#  ###', '####'],
  ['  ######', '  #    #', '### $# #', '#  .  .#', '# $ #$ #', '#  .# @#', '########'],
  ['#######', '#     #', '# $.$ #', '# .@. #', '# $.$ #', '#     #', '#######'],
  ['#######', '#.   .#', '# $ $ #', '## @ ##', '# $ $ #', '#.   .#', '#######'],
  ['#######', '#  .  #', '# $#$ #', '#. @ .#', '# $#$ #', '#  .  #', '#######'],
  [' ####### ', '##  .  ##', '#  $#$  #', '#.  @  .#', '#  $#$  #', '##  .  ##', ' ####### '],
  ['  #####', '###   #', '#.@$  #', '### $.#', '#.##$ #', '# # . ##', '#$ *$$.#', '#   .  #', '########'],
];

const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function parse(rows) {
  const H = rows.length; const W = Math.max(...rows.map((r) => r.length));
  const tiles = []; const boxes = []; let player = null;
  rows.forEach((row, y) => {
    [...row.padEnd(W)].forEach((ch, x) => {
      tiles.push(ch === '#' ? 'wall' : '.*+'.includes(ch) ? 'goal' : ch === ' ' ? 'void' : 'floor');
      if ('$*'.includes(ch)) boxes.push({ id: boxes.length, x, y });
      if ('@+'.includes(ch)) player = { x, y };
    });
  });
  // Espaços fora das paredes ficam vazios; os de dentro (alcançáveis pelo jogador) viram chão.
  const inside = new Set();
  const stack = [player];
  while (stack.length) {
    const p = stack.pop();
    const k = p.y * W + p.x;
    if (inside.has(k) || p.x < 0 || p.y < 0 || p.x >= W || p.y >= H || tiles[k] === 'wall') continue;
    inside.add(k);
    Object.values(VEC).forEach(([dx, dy]) => stack.push({ x: p.x + dx, y: p.y + dy }));
  }
  inside.forEach((k) => { if (tiles[k] === 'void') tiles[k] = 'floor'; });
  // Paredes que não encostam no interior ficam invisíveis.
  const near = (k) => {
    const x = k % W; const y = Math.floor(k / W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside.has((y + dy) * W + x + dx) && x + dx >= 0 && x + dx < W) return true;
    return false;
  };
  tiles.forEach((t, k) => { if (t === 'wall' && !near(k)) tiles[k] = 'void'; });
  return { W, H, tiles, boxes, player, goals: tiles.reduce((a, t, k) => (t === 'goal' ? a + 1 : a), 0) };
}

const levelState = (i) => { const p = parse(LEVELS[i]); return { ...p, start: { player: p.player, boxes: p.boxes }, history: [], dir: 'down' }; };
const solved = (s) => s.boxes.every((b) => s.tiles[b.y * s.W + b.x] === 'goal');

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { idx: 0, ...levelState(0), total: 0, done: false, over: false, gained: 0 };
  const [, render] = useReducer((x) => x + 1, 0);
  const boardRef = useRef(null);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

  useEffect(() => {
    cbs.current.onScore(0);
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const move = (d) => {
    const s = st.current;
    if (s.over || s.done || !VEC[d]) return;
    const [dx, dy] = VEC[d];
    const nx = s.player.x + dx; const ny = s.player.y + dy;
    s.dir = d;
    const at = (x, y) => s.tiles[y * s.W + x];
    if (at(nx, ny) === 'wall' || at(nx, ny) === 'void') { render(); return; }
    const box = s.boxes.find((b) => b.x === nx && b.y === ny);
    let boxes = s.boxes;
    if (box) {
      const bx = nx + dx; const by = ny + dy;
      if (['wall', 'void'].includes(at(bx, by)) || s.boxes.some((b) => b.x === bx && b.y === by)) { sfx('error'); render(); return; }
      boxes = s.boxes.map((b) => (b === box ? { ...b, x: bx, y: by } : b));
    }
    s.history.push({ player: s.player, boxes: s.boxes });
    s.player = { x: nx, y: ny };
    s.boxes = boxes;
    if (box) sfx(at(box.x + dx, box.y + dy) === 'goal' ? 'coin' : 'tap'); else sfx('move');
    if (solved(s)) {
      s.done = true;
      s.gained = Math.max(20, 200 - s.history.length);
      s.total += s.gained;
      cbs.current.onScore(s.total);
      later(() => sfx('win'), 150);
      if (s.idx >= LEVELS.length - 1) {
        s.over = true;
        later(() => cbs.current.onEnd(st.current.total), 1800);
      } else {
        later(() => {
          const cur = st.current;
          if (cur.idx >= LEVELS.length - 1) return;
          cur.idx += 1;
          Object.assign(cur, levelState(cur.idx), { done: false });
          render();
        }, 1500);
      }
    }
    render();
  };

  const undo = () => {
    const s = st.current;
    if (s.over || s.done || !s.history.length) return;
    const h = s.history.pop();
    s.player = h.player; s.boxes = h.boxes;
    sfx('flip');
    render();
  };

  const restart = () => {
    const s = st.current;
    if (s.over || s.done || !s.history.length) return;
    s.player = s.start.player; s.boxes = s.start.boxes; s.history = [];
    sfx('flip');
    render();
  };

  useKeys((k, down) => { if (down && k !== 'action') move(k); });
  useSwipe(boardRef, move);
  useEffect(() => {
    const kd = (e) => {
      if (e.code === 'KeyZ' || e.code === 'Backspace' || e.code === 'KeyU') { e.preventDefault(); undo(); }
      if (e.code === 'KeyR') { e.preventDefault(); restart(); }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, []);

  const s = st.current;
  const dim = Math.max(s.W, s.H, 7);
  const cw = 100 / s.W; const ch = 100 / s.H;
  const onGoal = s.boxes.filter((b) => s.tiles[b.y * s.W + b.x] === 'goal').length;
  return (
    <div className="sokoban">
      <div className="sokoban-top">
        <span>Fase <b>{s.idx + 1}</b>/{LEVELS.length}</span>
        <span>Passos: <b>{s.history.length}</b></span>
        <span>Pontos: <b>{s.total}</b></span>
      </div>
      <div className="sokoban-stage" ref={boardRef}>
        <div className="sokoban-board" style={{ width: (s.W / dim) * 100 + '%', aspectRatio: `${s.W} / ${s.H}` }}>
          {s.tiles.map((t, k) => (
            <div key={s.idx + '-' + k} className={'sokoban-t sokoban-' + t} style={{ left: (k % s.W) * cw + '%', top: Math.floor(k / s.W) * ch + '%', width: cw + '%', height: ch + '%' }} />
          ))}
          {s.boxes.map((b) => {
            const ok = s.tiles[b.y * s.W + b.x] === 'goal';
            return (
              <div key={s.idx + '-b' + b.id} className="sokoban-obj" style={{ left: b.x * cw + '%', top: b.y * ch + '%', width: cw + '%', height: ch + '%' }}>
                <div className={'sokoban-box' + (ok ? ' sokoban-ok' : '')} />
              </div>
            );
          })}
          <div className="sokoban-obj sokoban-me" style={{ left: s.player.x * cw + '%', top: s.player.y * ch + '%', width: cw + '%', height: ch + '%' }}>
            <svg className={'sokoban-builder sokoban-face-' + s.dir} viewBox="0 0 40 40" aria-hidden="true">
              <ellipse cx="20" cy="36" rx="11" ry="3" fill="rgba(0,0,0,.25)" />
              <path d="M10 36 L13 20 Q20 15 27 20 L30 36 Z" fill="#2B54B0" />
              <path d="M17 20 L20 30 L23 20 Z" fill="#F9C71D" />
              <circle cx="20" cy="13" r="7" fill="#E8B98C" />
              <path d="M12.5 13 Q13 4.5 20 4.5 Q27 4.5 27.5 13 Q27 9 20 8.5 Q13 9 12.5 13 Z" fill="#F2EBDD" />
              <path d="M12.5 12.5 Q11 18 12 22 L14 21 Q13.5 17 14 13 Z M27.5 12.5 Q29 18 28 22 L26 21 Q26.5 17 26 13 Z" fill="#F2EBDD" />
              <circle cx="17.5" cy="13.5" r="1.1" fill="#1B1F2A" /><circle cx="22.5" cy="13.5" r="1.1" fill="#1B1F2A" />
            </svg>
          </div>
        </div>
        {s.done && (
          <div className="sokoban-msg">
            <b>{s.over ? 'Você venceu todas as fases!' : 'Fase concluída!'}</b>
            <span>+{s.gained} pontos</span>
          </div>
        )}
      </div>
      <div className="sokoban-bar">
        <span className="sokoban-count">Pedras no lugar: {onGoal}/{s.boxes.length}</span>
        <button type="button" className="sokoban-btn" onClick={undo} disabled={s.done || !s.history.length}>↶ Desfazer</button>
        <button type="button" className="sokoban-btn" onClick={restart} disabled={s.done || !s.history.length}>↺ Recomeçar</button>
      </div>
      <DPad onDir={(d, down) => { if (down) move(d); }} />
    </div>
  );
}
