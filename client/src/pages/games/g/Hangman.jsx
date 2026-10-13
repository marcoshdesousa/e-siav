// Forca: palavras da Bíblia, natureza, acampamento e Desbravadores. Perdeu uma palavra, acabou.
import { useEffect, useRef, useState } from 'react';
import { shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './Hangman.css';

const BIB = 'Personagem bíblico';
const LIV = 'Livro da Bíblia';
const NAT = 'Natureza';
const ACA = 'Acampamento';
const DBV = 'Desbravadores';

const WORDS = [
  ...['Abraão', 'Moisés', 'Davi', 'Golias', 'Salomão', 'Elias', 'Eliseu', 'Daniel', 'Jonas', 'Noé', 'Isaque', 'Jacó', 'José', 'Rute', 'Ester', 'Sansão', 'Gideão', 'Samuel', 'Pedro', 'Paulo', 'Lázaro', 'Zaqueu', 'Timóteo', 'Débora', 'Josué', 'Isaías', 'Jeremias', 'Neemias', 'Barnabé', 'Rebeca', 'Raquel', 'Miriã', 'Natanael', 'Estêvão'].map((w) => [w, BIB]),
  ...['Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Salmos', 'Provérbios', 'Eclesiastes', 'Apocalipse', 'Romanos', 'Hebreus', 'Atos', 'Juízes', 'Lamentações', 'Gálatas', 'Filipenses'].map((w) => [w, LIV]),
  ...['Cachoeira', 'Floresta', 'Montanha', 'Orquídea', 'Borboleta', 'Beija-flor', 'Girassol', 'Tucano', 'Jacaré', 'Araucária', 'Cerrado', 'Pantanal', 'Arco-íris', 'Tempestade', 'Vaga-lume', 'Samambaia', 'Jabuticaba', 'Capivara', 'Onça', 'Sabiá', 'Cordilheira', 'Mangue', 'Constelação', 'Ipê', 'Tamanduá'].map((w) => [w, NAT]),
  ...['Barraca', 'Fogueira', 'Lanterna', 'Mochila', 'Canivete', 'Cantil', 'Bússola', 'Saco de dormir', 'Marmita', 'Repelente', 'Estaca', 'Lona', 'Trilha', 'Fósforo', 'Corda', 'Mapa', 'Pioneirismo', 'Lenha', 'Panela', 'Apito'].map((w) => [w, ACA]),
  ...['Lenço', 'Uniforme', 'Especialidade', 'Insígnia', 'Conselheiro', 'Unidade', 'Diretor', 'Investidura', 'Campori', 'Ordem unida', 'Desbravador', 'Bandeirim', 'Amigo', 'Companheiro', 'Pesquisador', 'Pioneiro', 'Excursionista', 'Guia', 'Capelão', 'Secretário', 'Aventureiros', 'Distintivo'].map((w) => [w, DBV]),
];

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const MAX = 6;

function Gallows({ errors }) {
  const show = (n) => (errors >= n ? 'hangman-on' : 'hangman-off');
  return (
    <svg className="hangman-svg" viewBox="0 0 120 130" aria-hidden="true">
      <path d="M10 124 H70 M28 124 V8 H84 V22 M28 30 L48 8" className="hangman-wood" />
      <circle cx="84" cy="32" r="10" className={'hangman-body ' + show(1)} />
      <path d="M84 42 V78" className={'hangman-body ' + show(2)} />
      <path d="M84 52 L70 66" className={'hangman-body ' + show(3)} />
      <path d="M84 52 L98 66" className={'hangman-body ' + show(4)} />
      <path d="M84 78 L72 98" className={'hangman-body ' + show(5)} />
      <path d="M84 78 L96 98" className={'hangman-body ' + show(6)} />
    </svg>
  );
}

export default function Game({ onScore, onEnd }) {
  const [deck] = useState(() => shuffle(WORDS));
  const [idx, setIdx] = useState(0);
  const [guessed, setGuessed] = useState(() => new Set());
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState('play'); // play | won | lost
  const ended = useRef(false);
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };

  const [word, hint] = deck[idx % deck.length];
  const target = norm(word);
  const letters = new Set(target.split('').filter((c) => /[A-Z]/.test(c)));
  const errors = [...guessed].filter((g) => !letters.has(g)).length;
  const solved = [...letters].every((c) => guessed.has(c));
  const lives = MAX - errors;

  useEffect(() => { cb.current.onScore?.(score); }, [score]);

  // Detecta acerto ou derrota da palavra atual.
  useEffect(() => {
    if (phase !== 'play') return;
    if (solved) {
      setPhase('won');
      sfx('win');
      setScore((s) => s + 10 + lives * 5);
    } else if (errors >= MAX) {
      setPhase('lost');
    }
  }, [solved, errors, lives, phase]);

  useEffect(() => {
    if (phase === 'won') {
      const t = setTimeout(() => {
        setIdx((i) => i + 1);
        setGuessed(new Set());
        setPhase('play');
      }, 1300);
      return () => clearTimeout(t);
    }
    if (phase === 'lost') {
      const t = setTimeout(() => {
        if (ended.current) return;
        ended.current = true;
        cb.current.onEnd?.(score);
      }, 2000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, score]);

  const guess = (l) => {
    if (phase !== 'play' || ended.current || guessed.has(l)) return;
    sfx(letters.has(l) ? 'point' : 'error');
    setGuessed((g) => new Set(g).add(l));
  };

  useEffect(() => {
    const k = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const l = norm(e.key);
      if (/^[A-Z]$/.test(l)) { e.preventDefault(); guess(l); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  return (
    <div className="hangman">
      <div className="hangman-head">
        <span className="hangman-hint">{hint}</span>
        <span className="hangman-score">⭐ {score}</span>
      </div>
      <div className="hangman-stage">
        <Gallows errors={errors} />
        <div className="hangman-lives" aria-label={`${lives} vidas`}>
          {[...Array(MAX).keys()].map((i) => <span key={i}>{i < lives ? '❤️' : '🤍'}</span>)}
          <small>Palavra {idx + 1}</small>
        </div>
      </div>

      <div className={'hangman-word hangman-' + phase}>
        {word.split(' ').map((part, wi) => (
          <span key={wi} className="hangman-chunk">
            {part.split('').map((ch, i) => {
              const n = norm(ch);
              const isLetter = /[A-Z]/.test(n);
              const open = !isLetter || guessed.has(n) || phase === 'lost';
              const miss = phase === 'lost' && isLetter && !guessed.has(n);
              return (
                <span key={i} className={'hangman-slot' + (isLetter ? '' : ' hangman-sym') + (miss ? ' hangman-miss' : '')}>
                  {open ? ch.toUpperCase() : ''}
                </span>
              );
            })}
          </span>
        ))}
      </div>

      <div className={'hangman-msg hangman-msg-' + phase}>
        {phase === 'won' ? `Acertou! +${10 + lives * 5}` : phase === 'lost' ? 'Enforcado! Fim de jogo.' : 'Escolha uma letra'}
      </div>

      <div className="hangman-keys">
        {LETTERS.map((l) => {
          const used = guessed.has(l);
          const ok = used && letters.has(l);
          return (
            <button
              key={l}
              type="button"
              className={'hangman-key' + (used ? (ok ? ' hangman-key-ok' : ' hangman-key-bad') : '')}
              onClick={() => guess(l)}
              disabled={used || phase !== 'play'}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
