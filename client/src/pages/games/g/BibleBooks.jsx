// Livros da Bíblia: qual dos dois vem primeiro? 60 s; +2 s no acerto e −5 s no erro.
import { useEffect, useRef, useState } from 'react';
import { rand } from '../kit.js';
import { sfx } from '../audio.js';
import './BibleBooks.css';

const BOOKS = [
  'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute', '1 Samuel', '2 Samuel',
  '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester', 'Jó', 'Salmos', 'Provérbios',
  'Eclesiastes', 'Cantares', 'Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel', 'Oseias', 'Joel', 'Amós',
  'Obadias', 'Jonas', 'Miqueias', 'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias', 'Malaquias',
  'Mateus', 'Marcos', 'Lucas', 'João', 'Atos', 'Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas', 'Efésios',
  'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses', '1 Timóteo', '2 Timóteo', 'Tito', 'Filemom',
  'Hebreus', 'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João', '3 João', 'Judas', 'Apocalipse',
];
const START = 60000;
const BONUS = 2000;
const PENALTY = 5000;

function makeQ(level, prev) {
  // Distância entre os livros diminui com o nível (fica mais difícil).
  const maxD = Math.max(3, 40 - level * 4);
  const minD = Math.max(1, Math.min(maxD, 14 - level * 2));
  for (let t = 0; t < 100; t++) {
    const d = minD + rand(maxD - minD + 1);
    const a = rand(BOOKS.length - d);
    const b = a + d;
    if (prev && (prev.includes(a) || prev.includes(b)) && t < 50) continue;
    return Math.random() < 0.5 ? [a, b] : [b, a];
  }
  return [0, 1];
}

const ord = (i) => (i + 1) + 'º';

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [q, setQ] = useState(() => makeQ(0));
  const [left, setLeft] = useState(START);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null); // { i, ok }
  const [delta, setDelta] = useState(null);
  const [over, setOver] = useState(false);
  const [streak, setStreak] = useState(0);
  const st = useRef({ left: START, last: Date.now(), score: 0, correct: 0, streak: 0, lock: false, over: false });
  const timers = useRef([]);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const finish = () => {
    const s = st.current;
    if (s.over) return;
    s.over = true; s.lock = true; s.left = 0;
    setLeft(0);
    setOver(true);
    sfx('lose');
    later(() => cb.current.onEnd(Math.max(0, s.score)), 1300);
  };

  useEffect(() => {
    const iv = setInterval(() => {
      const s = st.current;
      const now = Date.now();
      if (!s.over) {
        s.left -= now - s.last;
        if (s.left <= 0) finish(); else setLeft(s.left);
      }
      s.last = now;
    }, 100);
    return () => clearInterval(iv);
  }, []);

  const answer = (i) => {
    const s = st.current;
    if (s.lock || s.over) return;
    s.lock = true;
    const ok = q[i] === Math.min(q[0], q[1]);
    if (ok) {
      s.correct += 1; s.streak += 1;
      s.score += 10 + Math.min(10, Math.floor(s.correct / 3)) + (s.streak >= 5 ? 5 : 0);
      s.left += BONUS;
      setScore(s.score);
      cb.current.onScore(s.score);
      setDelta({ id: Date.now(), text: '+2s', ok: true });
      sfx('point');
    } else {
      s.streak = 0;
      s.left -= PENALTY;
      setDelta({ id: Date.now(), text: '−5s', ok: false });
      sfx('error');
    }
    setStreak(s.streak);
    setLeft(Math.max(0, s.left));
    setPicked({ i, ok });
    if (s.left <= 0) { finish(); return; }
    later(() => {
      if (st.current.over) return;
      setPicked(null);
      setQ(makeQ(Math.floor(s.correct / 4), q));
      s.lock = false;
    }, ok ? 450 : 1300);
  };
  const ansRef = useRef(answer);
  ansRef.current = answer;
  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.repeat) return;
      const i = { ArrowLeft: 0, ArrowUp: 0, 1: 0, ArrowRight: 1, ArrowDown: 1, 2: 1 }[e.key];
      if (i == null) return;
      e.preventDefault();
      ansRef.current(i);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const secs = Math.max(0, left / 1000);
  const first = Math.min(q[0], q[1]);

  return (
    <div className="biblebooks">
      <div className="biblebooks-hud">
        <span className={'biblebooks-time' + (secs < 10 ? ' biblebooks-low' : '')}>⏱ {secs.toFixed(1)}s</span>
        {streak >= 3 && <span className="biblebooks-streak">🔥 {streak}</span>}
        <span className="biblebooks-score">{score} pts</span>
      </div>
      <div className="biblebooks-bar"><i style={{ width: Math.min(100, (left / START) * 100) + '%' }} /></div>
      <div className="biblebooks-q">
        {over ? <b className="biblebooks-bad">Tempo esgotado!</b> : <>Qual vem <b>primeiro</b> na Bíblia?</>}
        {delta && !over && <span key={delta.id} className={'biblebooks-delta ' + (delta.ok ? 'biblebooks-good' : 'biblebooks-bad')}>{delta.text}</span>}
      </div>
      <div className="biblebooks-opts">
        {q.map((b, i) => {
          let cls = 'biblebooks-opt';
          if (picked) cls += b === first ? ' biblebooks-right' : picked.i === i ? ' biblebooks-wrong' : ' biblebooks-dim';
          return (
            <button key={i} type="button" className={cls} disabled={over}
              onPointerDown={(e) => { e.preventDefault(); answer(i); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); answer(i); } }}>
              <span className="biblebooks-name">{BOOKS[b]}</span>
              <small>{picked ? ord(b) + ' livro · ' + (b < 39 ? 'AT' : 'NT') : b < 39 ? 'Antigo Testamento' : 'Novo Testamento'}</small>
            </button>
          );
        })}
      </div>
      <p className="biblebooks-help">Dica: no teclado, use ← e →.</p>
    </div>
  );
}
