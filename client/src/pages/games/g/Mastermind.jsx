// Senha: descubra o código de 4 cores (6 cores, pode repetir) em até 10 tentativas.
import { useEffect, useReducer, useRef } from 'react';
import { rand } from '../kit.js';
import { sfx } from '../audio.js';
import './Mastermind.css';

const PEGS = [
  { c: '#E92A2F', n: 'vermelho' }, { c: '#F9C71D', n: 'amarelo' }, { c: '#18875A', n: 'verde' },
  { c: '#2B54B0', n: 'azul' }, { c: '#F28C28', n: 'laranja' }, { c: '#9B59D0', n: 'roxo' },
];
const LEN = 4;
const TRIES = 10;

const newCode = () => Array.from({ length: LEN }, () => rand(PEGS.length));

export function grade(code, guess) {
  let black = 0;
  const cc = Array(PEGS.length).fill(0);
  const cg = Array(PEGS.length).fill(0);
  for (let i = 0; i < LEN; i++) {
    if (code[i] === guess[i]) black++;
    else { cc[code[i]]++; cg[guess[i]]++; }
  }
  let white = 0;
  for (let k = 0; k < PEGS.length; k++) white += Math.min(cc[k], cg[k]);
  return { black, white };
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = { code: newCode(), rows: [], cur: [], score: 0, level: 1, over: false, reveal: false, busy: false, msg: '' };
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const listRef = useRef(null);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  const s = st.current;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  const add = (k) => {
    if (s.over || s.busy || s.cur.length >= LEN) return;
    s.cur = [...s.cur, k];
    sfx('tap');
    render();
  };
  const removeAt = (i) => {
    if (s.over || s.busy || i >= s.cur.length) return;
    s.cur = s.cur.filter((_, j) => j !== i);
    sfx('move');
    render();
  };
  const back = () => { if (s.cur.length) removeAt(s.cur.length - 1); };

  const submit = () => {
    if (s.over || s.busy) return;
    if (s.cur.length < LEN) { sfx('error'); s.msg = 'Escolha 4 cores.'; render(); return; }
    const g = grade(s.code, s.cur);
    s.rows = [...s.rows, { guess: s.cur, ...g }];
    s.cur = [];
    s.msg = '';
    if (g.black === LEN) {
      const used = s.rows.length;
      const pts = (11 - used) * 20;
      s.score += pts;
      cbs.current.onScore(s.score);
      sfx('win');
      s.busy = true; s.reveal = true;
      s.msg = `Acertou em ${used} ${used === 1 ? 'tentativa' : 'tentativas'}! +${pts}`;
      later(() => {
        s.code = newCode(); s.rows = []; s.level += 1; s.busy = false; s.reveal = false; s.msg = '';
        render();
      }, 1600);
    } else if (s.rows.length >= TRIES) {
      sfx('lose');
      s.over = true; s.reveal = true;
      s.msg = 'Acabaram as tentativas. A senha era esta:';
      later(() => cbs.current.onEnd(s.score), 1800);
    } else {
      sfx(g.black || g.white ? 'flip' : 'move');
    }
    render();
  };

  const left = TRIES - s.rows.length;
  return (
    <div className="mastermind">
      <div className="mastermind-top">
        <span>Senha <b>{s.level}</b></span>
        <span>Tentativas: <b>{left}</b></span>
        <span>Pontos: <b>{s.score}</b></span>
      </div>

      <div className="mastermind-secret" aria-label="Senha secreta">
        {s.code.map((k, i) => (
          <span key={i} className={'mastermind-peg' + (s.reveal ? '' : ' mastermind-hidden')} style={s.reveal ? { background: PEGS[k].c } : undefined}>
            {s.reveal ? '' : '?'}
          </span>
        ))}
      </div>

      <div className="mastermind-rows" ref={listRef}>
        {s.rows.length === 0 && <p className="mastermind-empty">Monte uma senha com as cores abaixo e toque em Testar.</p>}
        {s.rows.map((r, i) => (
          <div key={i} className="mastermind-row">
            <span className="mastermind-n">{i + 1}</span>
            <div className="mastermind-guess">
              {r.guess.map((k, j) => <span key={j} className="mastermind-peg mastermind-small" style={{ background: PEGS[k].c }} />)}
            </div>
            <div className="mastermind-fb" aria-label={`${r.black} certas no lugar, ${r.white} cores em outro lugar`}>
              {Array.from({ length: LEN }, (_, j) => (
                <span key={j} className={'mastermind-dot' + (j < r.black ? ' mastermind-black' : j < r.black + r.white ? ' mastermind-white' : '')} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mastermind-current">
        {Array.from({ length: LEN }, (_, i) => (
          <button key={i} type="button" className="mastermind-slot" onClick={() => removeAt(i)} aria-label={s.cur[i] != null ? 'Tirar ' + PEGS[s.cur[i]].n : 'Vazio'}>
            {s.cur[i] != null && <span className="mastermind-peg" style={{ background: PEGS[s.cur[i]].c }} />}
          </button>
        ))}
      </div>
      <div className="mastermind-msg">{s.msg || ' '}</div>

      <div className="mastermind-palette">
        {PEGS.map((p, k) => (
          <button key={k} type="button" className="mastermind-color" style={{ background: p.c }} onClick={() => add(k)} aria-label={p.n} disabled={s.over || s.busy} />
        ))}
      </div>
      <div className="mastermind-actions">
        <button type="button" className="mastermind-btn" onClick={back} disabled={s.over || s.busy || !s.cur.length}>Apagar</button>
        <button type="button" className="mastermind-btn mastermind-go" onClick={submit} disabled={s.over || s.busy}>Testar</button>
      </div>
      <p className="mastermind-legend"><span className="mastermind-dot mastermind-black" /> cor certa no lugar certo · <span className="mastermind-dot mastermind-white" /> cor certa em outro lugar</p>
    </div>
  );
}
