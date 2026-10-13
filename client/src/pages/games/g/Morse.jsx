// Código Morse: decifre a letra (e depois palavras curtas). A tabela ajuda, mas vale metade dos pontos.
import { useEffect, useRef, useState } from 'react';
import { pick, rand, shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './Morse.css';

const CODE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};
const LETTERS = Object.keys(CODE);
const EASY = ['E', 'T', 'A', 'I', 'N', 'M', 'S', 'O', 'H', 'R', 'D', 'U'];
const WORDS = ['SOS', 'DEUS', 'LUZ', 'PAZ', 'AMOR', 'CRUZ', 'VIDA', 'FOGO', 'SOL', 'LUA', 'MAPA', 'RIO', 'NORTE', 'SUL', 'LESTE', 'OESTE',
  'CAMPO', 'TRILHA', 'CLUBE', 'AMIGO', 'ARCA', 'MAR', 'NUVEM', 'SINAL', 'GUIA', 'LEMA', 'VOTO', 'HINO', 'MONTE', 'RUMO', 'CORDA', 'LONA', 'PEIXE'];
const LIVES = 3;
const enc = (w) => w.split('').map((c) => CODE[c]);

function mutate(w) {
  const i = rand(w.length);
  const c = pick(LETTERS.filter((l) => l !== w[i] && CODE[l].length === CODE[w[i]].length));
  return w.slice(0, i) + (c || pick(LETTERS)) + w.slice(i + 1);
}

function makeQ(n) {
  const wordChance = n < 8 ? 0 : n < 16 ? 0.35 : 0.7;
  if (Math.random() < wordChance) {
    const pool = WORDS.filter((w) => (n < 22 ? w.length <= 4 : true));
    const ans = pick(pool);
    const opts = new Set([ans]);
    const same = shuffle(WORDS.filter((w) => w !== ans && w.length === ans.length));
    // Uma opção quase igual (troca uma letra) e as outras do mesmo tamanho.
    for (let g = 0; opts.size < 2 && g < 20; g++) opts.add(mutate(ans));
    for (const w of same) { if (opts.size >= 4) break; opts.add(w); }
    for (let g = 0; opts.size < 4 && g < 50; g++) opts.add(mutate(ans));
    return { ans, code: enc(ans), opts: shuffle([...opts]), word: true, time: Math.max(8, 14 - Math.floor(n / 6)) * 1000 };
  }
  const ans = pick(n < 5 ? EASY : LETTERS);
  const near = shuffle(LETTERS.filter((l) => l !== ans && Math.abs(CODE[l].length - CODE[ans].length) <= 1));
  const opts = shuffle([ans, ...near.slice(0, 3)]);
  return { ans, code: [CODE[ans]], opts, word: false, time: Math.max(4, 9 - Math.floor(n / 4)) * 1000 };
}

function Code({ parts }) {
  return (
    <div className="morse-code" aria-label={parts.join(' / ')}>
      {parts.map((p, i) => (
        <span key={i} className="morse-group">
          {p.split('').map((s, j) => <i key={j} className={s === '.' ? 'morse-dot' : 'morse-dash'} />)}
        </span>
      ))}
    </div>
  );
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [q, setQ] = useState(() => makeQ(0));
  const [left, setLeft] = useState(q.time);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [picked, setPicked] = useState(null); // { i, ok }
  const [table, setTable] = useState(false);
  const [gain, setGain] = useState(null);
  const [over, setOver] = useState(false);
  const st = useRef({ n: 0, left: q.time, last: Date.now(), score: 0, lives: LIVES, lock: false, over: false, peeked: false });
  const timers = useRef([]);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const tableRef = useRef(false);
  const qRef = useRef(q);
  qRef.current = q;

  const resolve = (i) => {
    const s = st.current;
    if (s.lock || s.over) return;
    s.lock = true;
    const cur = qRef.current;
    const ok = i != null && cur.opts[i] === cur.ans;
    if (ok) {
      const base = cur.word ? 10 + cur.ans.length * 5 : 10;
      const bonus = Math.ceil(s.left / 1000);
      const pts = s.peeked ? Math.ceil((base + bonus) / 2) : base + bonus;
      s.score += pts;
      s.n += 1;
      setScore(s.score);
      cb.current.onScore(s.score);
      setGain({ id: Date.now(), text: '+' + pts + (s.peeked ? ' (tabela)' : '') });
      sfx('point');
    } else {
      s.lives -= 1;
      setLives(s.lives);
      setGain({ id: Date.now(), text: i == null ? 'Tempo!' : 'Errou', bad: true });
      sfx(i == null ? 'hit' : 'error');
    }
    setPicked({ i, ok });
    if (s.lives <= 0) {
      s.over = true;
      setOver(true);
      later(() => sfx('lose'), 500);
      later(() => cb.current.onEnd(Math.max(0, s.score)), 2000);
      return;
    }
    later(() => {
      if (st.current.over) return;
      const nq = makeQ(s.n);
      s.left = nq.time; s.last = Date.now(); s.peeked = tableRef.current; s.lock = false;
      setQ(nq);
      setLeft(nq.time);
      setPicked(null);
      setGain(null);
    }, ok ? 700 : 1600);
  };
  const resRef = useRef(resolve);
  resRef.current = resolve;

  useEffect(() => {
    const iv = setInterval(() => {
      const s = st.current;
      const now = Date.now();
      if (!s.lock && !s.over) {
        s.left -= now - s.last;
        if (s.left <= 0) { s.left = 0; setLeft(0); resRef.current(null); } else setLeft(s.left);
      }
      s.last = now;
    }, 100);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.repeat) return;
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0) { e.preventDefault(); resRef.current(i); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const toggleTable = () => {
    const v = !tableRef.current;
    tableRef.current = v;
    setTable(v);
    if (v && !st.current.lock) st.current.peeked = true;
    sfx('flip');
  };

  return (
    <div className="morse">
      <div className="morse-hud">
        <span className="morse-lives">{Array.from({ length: LIVES }, (_, i) => <b key={i} className={i < lives ? '' : 'morse-lost'}>❤</b>)}</span>
        <span className="morse-kind">{q.word ? 'Palavra' : 'Letra'}</span>
        <span className="morse-score">{score} pts</span>
      </div>
      <div className="morse-bar"><i style={{ width: (left / q.time) * 100 + '%' }} /></div>
      <div className={'morse-stage' + (picked ? (picked.ok ? ' morse-ok' : ' morse-bad') : '')}>
        <Code parts={q.code} />
        {picked && !picked.ok && <div className="morse-reveal">Resposta: <b>{q.ans}</b></div>}
        {gain && <span key={gain.id} className={'morse-gain' + (gain.bad ? ' morse-gain-bad' : '')}>{gain.text}</span>}
      </div>
      <div className="morse-opts">
        {q.opts.map((o, i) => {
          let cls = 'morse-opt';
          if (picked) cls += o === q.ans ? ' morse-right' : picked.i === i ? ' morse-wrong' : '';
          return (
            <button key={i} type="button" className={cls} disabled={over}
              onPointerDown={(e) => { e.preventDefault(); resolve(i); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resolve(i); } }}>
              <small>{i + 1}</small>{o}
            </button>
          );
        })}
      </div>
      <button type="button" className={'morse-toggle' + (table ? ' morse-toggle-on' : '')} onClick={toggleTable}>
        {table ? 'Esconder tabela' : 'Ver tabela (vale metade dos pontos)'}
      </button>
      {table && (
        <div className="morse-table">
          {LETTERS.map((l) => <span key={l}><b>{l}</b>{CODE[l].replace(/\./g, '•').replace(/-/g, '−')}</span>)}
        </div>
      )}
      {over && <div className="morse-over">Fim de jogo!</div>}
    </div>
  );
}
