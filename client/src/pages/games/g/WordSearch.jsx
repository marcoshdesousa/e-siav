// Caça-palavras: tabuleiros 10x10 com palavras temáticas em 8 direções. 2 minutos por tabuleiro.
import { useEffect, useRef, useState } from 'react';
import { pick, rand, shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './WordSearch.css';
import { Timer } from 'lucide-react';

const N = 10;
const TIME = 120000;
const THEMES = [
  { name: 'Personagens da Bíblia', words: ['Abraão', 'Moisés', 'Davi', 'Daniel', 'Jonas', 'Noé', 'Elias', 'José', 'Rute', 'Ester', 'Pedro', 'Paulo', 'Maria', 'Samuel', 'Gideão', 'Sansão', 'Josué', 'Isaque', 'Jacó', 'Lázaro', 'Zaqueu', 'Eliseu', 'Débora', 'Timóteo'] },
  { name: 'Livros da Bíblia', words: ['Gênesis', 'Êxodo', 'Salmos', 'Atos', 'Romanos', 'Hebreus', 'Mateus', 'Marcos', 'Lucas', 'João', 'Rute', 'Ester', 'Jó', 'Daniel', 'Jonas', 'Juízes', 'Números', 'Tiago', 'Judas', 'Amós', 'Miqueias', 'Gálatas', 'Efésios', 'Isaías'] },
  { name: 'Natureza', words: ['Árvore', 'Floresta', 'Rio', 'Montanha', 'Cachoeira', 'Pássaro', 'Flor', 'Semente', 'Folha', 'Pedra', 'Lago', 'Nuvem', 'Estrela', 'Sol', 'Lua', 'Abelha', 'Formiga', 'Tucano', 'Capivara', 'Ipê', 'Girassol', 'Mangue', 'Cerrado', 'Onça'] },
  { name: 'Acampamento', words: ['Barraca', 'Fogueira', 'Lanterna', 'Mochila', 'Cantil', 'Bússola', 'Corda', 'Trilha', 'Mapa', 'Canivete', 'Estaca', 'Lenha', 'Panela', 'Apito', 'Lona', 'Fósforo', 'Marmita', 'Repelente', 'Fogo', 'Tenda'] },
  { name: 'Desbravadores', words: ['Lenço', 'Uniforme', 'Clube', 'Unidade', 'Bandeira', 'Amigo', 'Pioneiro', 'Guia', 'Campori', 'Diretor', 'Distintivo', 'Insígnia', 'Capelão', 'Classe', 'Lema', 'Voto', 'Hino', 'Desafio', 'Investidura', 'Conselheiro'] },
];
const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
const PALETTE = ['#2B54B0', '#18875A', '#E92A2F', '#C98A00', '#7A3FB0', '#0E8C9C', '#D35400', '#B0306A'];
const ABC = 'ABCDEFGHIJLMNOPRSTUV';
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

function tryBuild(level) {
  const theme = pick(THEMES);
  const count = Math.min(8, 6 + Math.floor(level / 2));
  const dirs = level === 0 ? DIRS.slice(0, 3) : level === 1 ? DIRS.slice(0, 4) : DIRS;
  const pool = shuffle(theme.words.filter((w) => norm(w).length <= N && norm(w).length >= 3));
  const grid = Array(N * N).fill('');
  const placed = [];
  const seen = new Set();
  for (const word of pool) {
    if (placed.length >= count) break;
    const key = norm(word);
    if (seen.has(key) || placed.some((p) => p.key.includes(key) || key.includes(p.key))) continue;
    let ok = false;
    for (let t = 0; t < 150 && !ok; t++) {
      const [dr, dc] = pick(dirs);
      const r0 = rand(N); const c0 = rand(N);
      const r1 = r0 + dr * (key.length - 1); const c1 = c0 + dc * (key.length - 1);
      if (r1 < 0 || r1 >= N || c1 < 0 || c1 >= N) continue;
      const cells = [];
      let fits = true;
      for (let i = 0; i < key.length; i++) {
        const idx = (r0 + dr * i) * N + c0 + dc * i;
        if (grid[idx] && grid[idx] !== key[i]) { fits = false; break; }
        cells.push(idx);
      }
      if (!fits) continue;
      cells.forEach((idx, i) => { grid[idx] = key[i]; });
      placed.push({ word, key, cells });
      seen.add(key);
      ok = true;
    }
  }
  if (placed.length < 6) return null;
  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = ABC[rand(ABC.length)];
  // Garante que nenhuma palavra apareça duas vezes (o que confundiria a seleção).
  for (const p of placed) {
    let n = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of DIRS) {
      let s = '';
      for (let i = 0; i < p.key.length; i++) {
        const rr = r + dr * i; const cc = c + dc * i;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) break;
        s += grid[rr * N + cc];
      }
      if (s === p.key) n++;
    }
    const pal = p.key === [...p.key].reverse().join('');
    if (n > (pal ? 2 : 1)) return null;
  }
  return { theme: theme.name, grid, words: placed.sort((a, b) => a.key.localeCompare(b.key)) };
}

function buildBoard(level) {
  for (let i = 0; i < 200; i++) { const b = tryBuild(level); if (b) return b; }
  return tryBuild(0) || buildBoard(0);
}

function lineCells(a, b) {
  const r0 = Math.floor(a / N); const c0 = a % N;
  const r1 = Math.floor(b / N); const c1 = b % N;
  let dr = r1 - r0; let dc = c1 - c0;
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  if (len === 0) return [a];
  // Ajusta para a direção (das 8) mais próxima do arraste.
  const ang = Math.atan2(dr, dc);
  const oct = Math.round(ang / (Math.PI / 4));
  dr = Math.round(Math.sin(oct * Math.PI / 4)); dc = Math.round(Math.cos(oct * Math.PI / 4));
  const out = [];
  for (let i = 0; i <= len; i++) {
    const r = r0 + dr * i; const c = c0 + dc * i;
    if (r < 0 || r >= N || c < 0 || c >= N) break;
    out.push(r * N + c);
  }
  return out;
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [level, setLevel] = useState(0);
  const [board, setBoard] = useState(() => buildBoard(0));
  const [found, setFound] = useState({}); // key -> índice da cor
  const [sel, setSel] = useState([]);
  const [left, setLeft] = useState(TIME);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState('play'); // play | clear | over
  const [flash, setFlash] = useState(null);
  const st = useRef({ left: TIME, last: Date.now(), score: 0, over: false, phase: 'play' });
  const drag = useRef(null);
  const gridRef = useRef(null);
  const timers = useRef([]);

  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const finish = () => {
    const s = st.current;
    if (s.over) return;
    s.over = true; s.phase = 'over';
    setPhase('over');
    sfx('lose');
    later(() => cb.current.onEnd(Math.max(0, Math.round(s.score))), 1800);
  };

  useEffect(() => {
    const iv = setInterval(() => {
      const s = st.current;
      const now = Date.now();
      if (s.phase === 'play') {
        s.left -= now - s.last;
        if (s.left <= 0) { s.left = 0; setLeft(0); finish(); } else setLeft(s.left);
      }
      s.last = now;
    }, 200);
    return () => clearInterval(iv);
  }, []);

  const cellAt = (e) => {
    const el = gridRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
    return Math.floor(y * N) * N + Math.floor(x * N);
  };

  const down = (e) => {
    if (st.current.phase !== 'play') return;
    const c = cellAt(e);
    if (c == null) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ok */ }
    drag.current = { start: c, last: c };
    setSel([c]);
    sfx('tap');
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const c = cellAt(e);
    if (c == null || c === d.last) return;
    d.last = c;
    setSel(lineCells(d.start, c));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const cells = lineCells(d.start, d.last);
    setSel([]);
    if (cells.length < 2 || st.current.phase !== 'play') return;
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const hit = board.words.find((w) => !(w.key in found) && (same(w.cells, cells) || same([...w.cells].reverse(), cells)));
    if (!hit) { sfx('error'); return; }
    const nf = { ...found, [hit.key]: Object.keys(found).length % PALETTE.length };
    setFound(nf);
    const s = st.current;
    let gain = 10 + hit.key.length * 2;
    const done = Object.keys(nf).length === board.words.length;
    if (done) {
      const bonus = Math.ceil(s.left / 1000) * 2;
      gain += bonus;
      s.phase = 'clear';
      setPhase('clear');
      setFlash('Tabuleiro completo! +' + bonus + ' de bônus de tempo');
      sfx('win');
      later(() => {
        const nl = level + 1;
        setLevel(nl);
        setBoard(buildBoard(nl));
        setFound({});
        setFlash(null);
        s.left = TIME; s.last = Date.now(); s.phase = 'play';
        setLeft(TIME);
        setPhase('play');
      }, 1600);
    } else sfx('point');
    s.score += gain;
    setScore(s.score);
    cb.current.onScore(s.score);
  };

  const cellColor = {};
  board.words.forEach((w) => {
    if (w.key in found) w.cells.forEach((c) => { cellColor[c] = PALETTE[found[w.key]]; });
  });
  const missing = new Set(phase === 'over' ? board.words.filter((w) => !(w.key in found)).flatMap((w) => w.cells) : []);
  const selSet = new Set(sel);
  const secs = Math.ceil(left / 1000);

  return (
    <div className="wordsearch">
      <div className="wordsearch-hud">
        <span className={'wordsearch-time' + (secs <= 15 ? ' wordsearch-low' : '')}><Timer size={14} style={{ verticalAlign: '-2px' }} /> {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
        <span className="wordsearch-theme">{board.theme}</span>
        <span className="wordsearch-score">{score} pts</span>
      </div>
      <div className="wordsearch-bar"><i style={{ width: (left / TIME) * 100 + '%' }} /></div>
      <div
        ref={gridRef}
        className="wordsearch-grid"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={(e) => e.preventDefault()}
      >
        {board.grid.map((ch, i) => (
          <div
            key={i}
            className={'wordsearch-cell' + (selSet.has(i) ? ' wordsearch-sel' : '') + (cellColor[i] ? ' wordsearch-found' : '') + (missing.has(i) ? ' wordsearch-miss' : '')}
            style={cellColor[i] && !selSet.has(i) ? { background: cellColor[i] } : undefined}
          >
            {ch}
          </div>
        ))}
        {flash && <div className="wordsearch-flash">{flash}</div>}
        {phase === 'over' && <div className="wordsearch-flash wordsearch-flash-bad">Tempo esgotado!</div>}
      </div>
      <div className="wordsearch-words">
        {board.words.map((w) => (
          <span key={w.key} className={'wordsearch-word' + (w.key in found ? ' wordsearch-done' : '')}
            style={w.key in found ? { borderColor: PALETTE[found[w.key]], color: PALETTE[found[w.key]] } : undefined}>
            {w.word}
          </span>
        ))}
      </div>
    </div>
  );
}
