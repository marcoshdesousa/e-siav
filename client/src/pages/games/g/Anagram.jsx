// Palavra embaralhada: toque nas letras para montar a palavra. 60 s, +5 s a cada acerto.
import { useEffect, useRef, useState } from 'react';
import { shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './Anagram.css';
import { Timer } from 'lucide-react';

const START = 60000;
const BONUS = 5000;
const SKIP = 3000;
const BIB = 'Personagem bíblico';
const LIV = 'Livro da Bíblia';
const NAT = 'Natureza';
const ACA = 'Acampamento';
const DBV = 'Desbravadores';

const WORDS = [
  ...['Abraão', 'Moisés', 'Daniel', 'Jonas', 'Elias', 'José', 'Rute', 'Pedro', 'Paulo', 'Maria', 'Samuel', 'Gideão', 'Sansão', 'Josué', 'Isaque', 'Jacó', 'Lázaro', 'Zaqueu', 'Eliseu', 'Débora', 'Timóteo', 'Golias', 'Salomão', 'Noé', 'Isaías', 'Jeremias', 'Rebeca', 'Raquel', 'Neemias', 'Barnabé', 'Estêvão', 'André', 'Filipe', 'Adão', 'Miriã', 'Ezequiel', 'Natanael'].map((w) => [w, BIB]),
  ...['Gênesis', 'Êxodo', 'Levítico', 'Números', 'Salmos', 'Provérbios', 'Romanos', 'Hebreus', 'Mateus', 'Marcos', 'Lucas', 'Tiago', 'Juízes', 'Gálatas', 'Efésios', 'Apocalipse', 'Colossenses', 'Filipenses'].map((w) => [w, LIV]),
  ...['Árvore', 'Floresta', 'Montanha', 'Cachoeira', 'Pássaro', 'Semente', 'Nuvem', 'Estrela', 'Abelha', 'Formiga', 'Tucano', 'Capivara', 'Girassol', 'Mangue', 'Cerrado', 'Onça', 'Borboleta', 'Jacaré', 'Oceano', 'Vulcão', 'Deserto', 'Raposa', 'Coruja', 'Orquídea', 'Pantanal'].map((w) => [w, NAT]),
  ...['Barraca', 'Fogueira', 'Lanterna', 'Mochila', 'Cantil', 'Bússola', 'Corda', 'Trilha', 'Mapa', 'Canivete', 'Estaca', 'Lenha', 'Panela', 'Lona', 'Fósforo', 'Marmita', 'Repelente', 'Lampião'].map((w) => [w, ACA]),
  ...['Lenço', 'Uniforme', 'Clube', 'Unidade', 'Bandeira', 'Amigo', 'Pioneiro', 'Guia', 'Campori', 'Diretor', 'Distintivo', 'Insígnia', 'Capelão', 'Classe', 'Companheiro', 'Pesquisador', 'Desbravador', 'Conselheiro', 'Investidura', 'Especialidade'].map((w) => [w, DBV]),
];
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

function scramble(key) {
  const letters = key.split('');
  for (let i = 0; i < 30; i++) {
    const s = shuffle(letters);
    if (s.join('') !== key) return s;
  }
  return letters.reverse();
}

function makeRound(solved, used) {
  const maxLen = 5 + Math.floor(solved / 2);
  let pool = WORDS.filter(([w]) => norm(w).length <= maxLen && !used.has(w));
  if (pool.length < 3) pool = WORDS.filter(([w]) => !used.has(w));
  if (!pool.length) { used.clear(); pool = WORDS; }
  // Prefere as palavras mais longas do intervalo atual.
  pool = shuffle(pool).sort((a, b) => norm(b[0]).length - norm(a[0]).length).slice(0, Math.max(6, Math.ceil(pool.length / 2)));
  const [word, hint] = pool[Math.floor(Math.random() * pool.length)];
  used.add(word);
  const key = norm(word);
  return { word, hint, key, tiles: scramble(key).map((ch, id) => ({ ch, id })) };
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const used = useRef(new Set());
  const [round, setRound] = useState(() => makeRound(0, used.current));
  const [picked, setPicked] = useState([]); // ids das peças
  const [left, setLeft] = useState(START);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState(null); // ok | bad | skip | over
  const [delta, setDelta] = useState(null);
  const st = useRef({ left: START, last: Date.now(), score: 0, solved: 0, lock: false, over: false });
  const timers = useRef([]);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const finish = () => {
    const s = st.current;
    if (s.over) return;
    s.over = true; s.lock = true;
    setStatus('over');
    sfx('lose');
    later(() => cb.current.onEnd(Math.max(0, s.score)), 1500);
  };

  useEffect(() => {
    const iv = setInterval(() => {
      const s = st.current;
      const now = Date.now();
      if (!s.over) {
        s.left -= now - s.last;
        if (s.left <= 0) { s.left = 0; setLeft(0); finish(); } else setLeft(s.left);
      }
      s.last = now;
    }, 100);
    return () => clearInterval(iv);
  }, []);

  const next = () => {
    const s = st.current;
    if (s.over) return;
    setRound(makeRound(s.solved, used.current));
    setPicked([]);
    setStatus(null);
    s.lock = false;
  };

  const check = (ids) => {
    const s = st.current;
    const built = ids.map((id) => round.tiles[id].ch).join('');
    if (built === round.key) {
      s.lock = true;
      s.solved += 1;
      s.score += 10 + round.key.length * 3;
      s.left += BONUS;
      setLeft(s.left);
      setScore(s.score);
      cb.current.onScore(s.score);
      setStatus('ok');
      setDelta({ id: Date.now(), text: '+5s', ok: true });
      sfx('point');
      later(next, 900);
    } else {
      s.lock = true;
      setStatus('bad');
      sfx('error');
      later(() => { if (!st.current.over) { setPicked([]); setStatus(null); st.current.lock = false; } }, 500);
    }
  };

  const tapTile = (id) => {
    const s = st.current;
    if (s.lock || picked.includes(id)) return;
    const np = [...picked, id];
    setPicked(np);
    sfx('tap');
    if (np.length === round.tiles.length) check(np);
  };
  const tapSlot = (pos) => {
    if (st.current.lock || pos < 0 || pos >= picked.length) return;
    setPicked(picked.slice(0, pos));
    sfx('move');
  };
  const skip = () => {
    const s = st.current;
    if (s.lock) return;
    s.lock = true;
    s.left -= SKIP;
    setLeft(Math.max(0, s.left));
    setStatus('skip');
    setDelta({ id: Date.now(), text: '−3s', ok: false });
    sfx('flip');
    if (s.left <= 0) { finish(); return; }
    later(next, 1000);
  };

  const keyRef = useRef(null);
  keyRef.current = (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === 'Backspace') { e.preventDefault(); tapSlot(picked.length - 1); return; }
    const k = norm(e.key);
    if (k.length !== 1 || !/[A-Z]/.test(k)) return;
    const t = round.tiles.find((tile) => tile.ch === k && !picked.includes(tile.id));
    if (t) { e.preventDefault(); tapTile(t.id); }
  };
  useEffect(() => {
    const h = (e) => keyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const secs = Math.max(0, left / 1000);
  const reveal = status === 'ok' || status === 'skip' || status === 'over';

  return (
    <div className="anagram">
      <div className="anagram-hud">
        <span className={'anagram-time' + (secs < 10 ? ' anagram-low' : '')}><Timer size={14} style={{ verticalAlign: '-2px' }} /> {secs.toFixed(1)}s</span>
        <span className="anagram-score">{score} pts</span>
      </div>
      <div className="anagram-bar"><i style={{ width: Math.min(100, (left / START) * 100) + '%' }} /></div>
      <div className="anagram-hint">
        Dica: <b>{round.hint}</b>
        {delta && <span key={delta.id} className={'anagram-delta ' + (delta.ok ? 'anagram-good' : 'anagram-bad')}>{delta.text}</span>}
      </div>
      <div className={'anagram-slots' + (status === 'bad' ? ' anagram-shake' : '') + (status === 'ok' ? ' anagram-win' : '')}>
        {round.tiles.map((_, pos) => (
          <button key={pos} type="button" className={'anagram-slot' + (picked[pos] != null ? ' anagram-filled' : '')} onClick={() => tapSlot(pos)}>
            {picked[pos] != null ? round.tiles[picked[pos]].ch : ''}
          </button>
        ))}
      </div>
      <div className="anagram-answer">
        {reveal ? <span className={status === 'ok' ? 'anagram-good' : 'anagram-bad'}>{status === 'ok' ? 'Certo: ' : 'Era: '}{round.word}</span> : ' '}
      </div>
      <div className="anagram-tiles">
        {round.tiles.map((t) => (
          <button key={t.id} type="button" className="anagram-tile" disabled={picked.includes(t.id) || status === 'over'}
            onPointerDown={(e) => { e.preventDefault(); tapTile(t.id); }}>
            {t.ch}
          </button>
        ))}
      </div>
      <div className="anagram-actions">
        <button type="button" className="anagram-btn" onClick={() => { if (!st.current.lock && picked.length) { setPicked([]); sfx('move'); } }}>Limpar</button>
        <button type="button" className="anagram-btn anagram-btn-skip" onClick={skip}>Pular (−3s)</button>
      </div>
      {status === 'over' && <div className="anagram-over">Tempo esgotado!</div>}
    </div>
  );
}
