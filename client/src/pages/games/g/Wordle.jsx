// Palavra secreta (estilo Termo): 6 tentativas por palavra; acertou, vem outra. Errou uma, acabou.
import { useEffect, useRef, useState } from 'react';
import { shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './Wordle.css';

const ANSWERS = [
  'amigo banco barco beijo bicho bolsa braço bravo breve campo canto carta carro certo chuva cinco',
  'claro cobra corda corpo culpa dente digno feliz festa filho folha forte fruta fundo garfo gente',
  'graça grama grupo honra horta ideia igual jovem justo lápis leite limão lindo livro longe louco',
  'lugar macio manga marca menor mesmo metal milho monte moral mundo navio ninho nobre noite norte',
  'nuvem olhar ontem ordem outro palco papel parte passo pátio pedra peixe perto piano plano ponte',
  'porco porta praia prato prazo preto primo prova pular queda ramos reino relva ritmo roupa sabor',
  'salto santo sábio selva senha sinal sobre sonho sorte suave tarde tempo terra tigre torta trevo',
  'trigo troca turma único valor vapor velho vento verde vidro viola virar vista zebra águia areia',
  'abrir acaso acima adeus agora ainda aluno andar apoio arroz astro atrás avião baile balde banho',
  'brisa burro caixa calma calor canoa capim carne casal causa cedro chave chefe cheio coisa coral',
  'coroa couve creme criar curso curto drama dupla época farol fatia feira ferro ficar final fogão',
  'folga forno força frase freio galho ganso girar grito hotel humor jeito junto lagoa largo legal',
  'lento letra limpo linha lista lutar malha manso meigo moeda molho morro mosca motor nadar noiva',
  'nosso ouvir palha pardo pasta pente perna pista pluma pobre poder pomba poste prado prata pulga',
  'puxar quase raiva regra resto risco rolha saída saúde secar serra sopro susto tecla telha tenda',
  'texto tinta tocar total traço trono vazio verso viver volta vozes',
].join(' ').split(' ');
const ROWS = 6;
const LEN = 5;
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const KB = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const RANK = { absent: 1, present: 2, correct: 3 };

function grade(guess, key) {
  const res = Array(LEN).fill('absent');
  const left = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === key[i]) res[i] = 'correct';
    else left[key[i]] = (left[key[i]] || 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (res[i] !== 'correct' && left[guess[i]]) { res[i] = 'present'; left[guess[i]] -= 1; }
  }
  return res;
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [deck] = useState(() => shuffle(ANSWERS));
  const [idx, setIdx] = useState(0);
  const [rows, setRows] = useState([]); // { g, res }
  const [cur, setCur] = useState('');
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState('play'); // play | won | lost
  const [msg, setMsg] = useState(null);
  const [shake, setShake] = useState(false);
  const st = useRef({ score: 0, over: false, lock: false });
  const timers = useRef([]);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const word = deck[idx % deck.length];
  const key = norm(word);

  const keyState = {};
  rows.forEach(({ g, res }) => g.split('').forEach((ch, i) => {
    if ((RANK[res[i]] || 0) > (RANK[keyState[ch]] || 0)) keyState[ch] = res[i];
  }));

  const submit = () => {
    const s = st.current;
    if (s.lock || phase !== 'play') return;
    if (cur.length < LEN) { setShake(true); setMsg('Faltam letras'); sfx('error'); later(() => { setMsg(null); setShake(false); }, 700); return; }
    const res = grade(cur, key);
    const nr = [...rows, { g: cur, res }];
    setRows(nr);
    setCur('');
    s.lock = true;
    const won = cur === key;
    const reveal = 5 * 120 + 250;
    if (won) {
      const pts = (7 - nr.length) * 20;
      later(() => {
        s.score += pts;
        setScore(s.score);
        cb.current.onScore(s.score);
        setPhase('won');
        setMsg('Acertou: ' + word.toUpperCase() + ' (+' + pts + ')');
        sfx('win');
      }, reveal);
      later(() => {
        setIdx((i) => i + 1);
        setRows([]);
        setPhase('play');
        setMsg(null);
        s.lock = false;
      }, reveal + 1800);
    } else if (nr.length >= ROWS) {
      later(() => {
        s.over = true;
        setPhase('lost');
        setMsg('A palavra era ' + word.toUpperCase());
        sfx('lose');
      }, reveal);
      later(() => cb.current.onEnd(Math.max(0, s.score)), reveal + 2200);
    } else {
      later(() => { s.lock = false; sfx(res.some((r) => r !== 'absent') ? 'flip' : 'tap'); }, reveal);
    }
  };

  const press = (k) => {
    if (st.current.lock || st.current.over || phase !== 'play') return;
    if (k === 'ENTER') { submit(); return; }
    if (k === 'BACK') { if (cur) { setCur(cur.slice(0, -1)); sfx('move'); } return; }
    if (cur.length < LEN) { setCur(cur + k); sfx('tap'); }
  };

  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); pressRef.current('ENTER'); return; }
      if (e.key === 'Backspace') { e.preventDefault(); pressRef.current('BACK'); return; }
      const k = norm(e.key);
      if (k.length === 1 && k >= 'A' && k <= 'Z') { e.preventDefault(); pressRef.current(k); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = rows[r];
    const isCur = !row && r === rows.length && phase === 'play';
    const letters = row ? row.g : isCur ? cur : '';
    grid.push(
      <div key={r} className={'wordle-row' + (isCur && shake ? ' wordle-shake' : '')}>
        {Array.from({ length: LEN }, (_, i) => {
          const ch = letters[i] || '';
          const cls = row ? ' wordle-' + row.res[i] + ' wordle-rev' : ch ? ' wordle-typed' : '';
          return <div key={i} className={'wordle-cell' + cls} style={row ? { animationDelay: i * 120 + 'ms' } : undefined}>{ch}</div>;
        })}
      </div>,
    );
  }

  return (
    <div className="wordle">
      <div className="wordle-hud">
        <span>Palavra {idx + 1}</span>
        <span className="wordle-score">{score} pts</span>
      </div>
      <div className="wordle-board">
        {grid}
        {msg && <div className={'wordle-msg' + (phase === 'won' ? ' wordle-msg-ok' : phase === 'lost' ? ' wordle-msg-bad' : '')}>{msg}</div>}
      </div>
      <div className="wordle-kb">
        {KB.map((line, li) => (
          <div key={li} className="wordle-kbrow">
            {li === 2 && <button type="button" className="wordle-key wordle-wide" onPointerDown={(e) => { e.preventDefault(); press('ENTER'); }}>ENTRA</button>}
            {line.split('').map((k) => (
              <button key={k} type="button" className={'wordle-key' + (keyState[k] ? ' wordle-' + keyState[k] : '')}
                onPointerDown={(e) => { e.preventDefault(); press(k); }}>{k}</button>
            ))}
            {li === 2 && <button type="button" className="wordle-key wordle-wide" aria-label="Apagar" onPointerDown={(e) => { e.preventDefault(); press('BACK'); }}>⌫</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
