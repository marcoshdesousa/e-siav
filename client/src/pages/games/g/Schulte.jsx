// Números em ordem (tabela de Schulte): toque de 1 até o fim o mais rápido possível. Dois tabuleiros.
import { useEffect, useRef, useState } from 'react';
import { shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './Schulte.css';

const BOARDS = [5, 6];
const boardScore = (secs, errors) => Math.max(50, Math.round(1500 - secs * 20 - errors * 30));
const makeCells = (n) => shuffle(Array.from({ length: n * n }, (_, i) => i + 1));

export default function Game({ onScore, onEnd }) {
  const [round, setRound] = useState(0);
  const [cells, setCells] = useState(() => makeCells(BOARDS[0]));
  const [next, setNext] = useState(1);
  const [errors, setErrors] = useState(0);
  const [wrong, setWrong] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const startRef = useRef(window.performance.now());
  const busy = useRef(false);
  const ended = useRef(false);
  const timers = useRef([]);

  const n = BOARDS[round];
  const max = n * n;

  useEffect(() => { onScore?.(0); }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (done || busy.current) return undefined;
    const t = setInterval(() => setElapsed((window.performance.now() - startRef.current) / 1000), 100);
    return () => clearInterval(t);
  }, [done, round, msg]);

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

  const tapCell = (v) => {
    if (busy.current || ended.current || v < next) return;
    if (v !== next) {
      sfx('error');
      setErrors((e) => e + 1);
      setWrong(v);
      later(() => setWrong(null), 300);
      return;
    }
    if (v < max) { sfx('tap'); setNext(v + 1); return; }
    // tabuleiro completo
    const secs = (window.performance.now() - startRef.current) / 1000;
    setElapsed(secs);
    const pts = boardScore(secs, errors);
    const newTotal = total + pts;
    setTotal(newTotal);
    setNext(v + 1);
    onScore?.(newTotal);
    busy.current = true;
    sfx('win');
    setMsg(`+${pts} pontos (${secs.toFixed(1)} s, ${errors} erro${errors === 1 ? '' : 's'})`);
    if (round + 1 < BOARDS.length) {
      later(() => {
        const r = round + 1;
        setRound(r);
        setCells(makeCells(BOARDS[r]));
        setNext(1);
        setErrors(0);
        setElapsed(0);
        setMsg('');
        startRef.current = window.performance.now();
        busy.current = false;
      }, 1600);
    } else {
      setDone(true);
      later(() => {
        if (ended.current) return;
        ended.current = true;
        onEnd?.(newTotal);
      }, 1400);
    }
  };

  return (
    <div className="schulte">
      <div className="schulte-hud">
        <span className="schulte-stat">Tabuleiro <b>{round + 1}/{BOARDS.length}</b></span>
        <span className="schulte-stat">⏱ <b>{elapsed.toFixed(1)} s</b></span>
        <span className="schulte-stat">Erros <b>{errors}</b></span>
      </div>
      <div className="schulte-next">
        {msg || <>Próximo: <b>{next}</b></>}
      </div>
      <div className="schulte-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {cells.map((v) => (
          <button
            key={`${round}-${v}`}
            type="button"
            className={'schulte-cell' + (v < next ? ' schulte-done' : '') + (wrong === v ? ' schulte-wrong' : '')}
            style={{ fontSize: n > 5 ? '1.15rem' : '1.35rem' }}
            onPointerDown={(e) => { e.preventDefault(); tapCell(v); }}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="schulte-total">Total: <b>{total}</b></div>
    </div>
  );
}
