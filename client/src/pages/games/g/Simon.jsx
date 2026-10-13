import { useEffect, useRef, useState } from 'react';
import { COLORS, rand } from '../kit.js';
import './Simon.css';

const PADS = [
  { name: 'Verde', color: COLORS.green, freq: 392 },
  { name: 'Vermelho', color: COLORS.red, freq: 329.63 },
  { name: 'Amarelo', color: COLORS.yellow, freq: 261.63 },
  { name: 'Azul', color: COLORS.blue, freq: 196 },
];

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [count, setCount] = useState(3);
  const [phase, setPhase] = useState('count'); // count | show | input | wait | over
  const [lit, setLit] = useState(-1);
  const [wrong, setWrong] = useState(-1);
  const [score, setScore] = useState(0);
  const seq = useRef([]);
  const pos = useRef(0);
  const phaseRef = useRef('count');
  const timers = useRef([]);
  const audio = useRef(null);
  const ended = useRef(false);
  const flashId = useRef(0);

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const go = (p) => { phaseRef.current = p; setPhase(p); };

  // Áudio criado só no primeiro toque do jogador (exigência dos navegadores).
  const getAudio = (create) => {
    if (audio.current === false) return null;
    if (!audio.current && create) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        audio.current = AC ? new AC() : false;
      } catch { audio.current = false; }
    }
    const a = audio.current || null;
    if (a && a.state === 'suspended') a.resume().catch(() => {});
    return a;
  };
  const beep = (freq, ms, type = 'sine') => {
    const a = getAudio(false);
    if (!a) return;
    try {
      const o = a.createOscillator(); const g = a.createGain();
      o.type = type; o.frequency.value = freq;
      const t = a.currentTime; const d = ms / 1000;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + d + 0.05);
    } catch { /* sem som */ }
  };

  const playRound = () => {
    seq.current = [...seq.current, rand(4)];
    const n = seq.current.length;
    const step = Math.max(270, 650 - n * 25);
    const on = Math.round(step * 0.62);
    go('show');
    seq.current.forEach((p, i) => {
      later(() => { setLit(p); beep(PADS[p].freq, on); }, 450 + i * step);
      later(() => setLit(-1), 450 + i * step + on);
    });
    later(() => { pos.current = 0; go('input'); }, 450 + (n - 1) * step + on + 60);
  };

  const flash = (p) => {
    const id = ++flashId.current;
    setLit(p);
    later(() => { if (flashId.current === id) setLit(-1); }, 200);
  };

  const press = (p) => {
    getAudio(true);
    if (phaseRef.current !== 'input') return;
    if (p === seq.current[pos.current]) {
      beep(PADS[p].freq, 220);
      flash(p);
      pos.current += 1;
      if (pos.current === seq.current.length) {
        const s = seq.current.length;
        setScore(s);
        cb.current.onScore(s);
        go('wait');
        later(playRound, 750);
      }
    } else {
      beep(110, 600, 'sawtooth');
      clearAll();
      setLit(-1);
      setWrong(p);
      go('over');
      if (!ended.current) {
        ended.current = true;
        cb.current.onEnd(Math.max(0, seq.current.length - 1));
      }
    }
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    if (count <= 0) return undefined;
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    if (count !== 0) return undefined;
    seq.current = [];
    playRound();
    return clearAll;
  }, [count]);

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i < 0 || e.repeat) return;
      e.preventDefault();
      pressRef.current(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => () => {
    clearAll();
    try { if (audio.current) audio.current.close(); } catch { /* ignora */ }
  }, []);

  let center;
  if (count > 0) center = <b className="simon-big">{count}</b>;
  else if (phase === 'over') center = <><b className="simon-big">{score}</b><small>Errou!</small></>;
  else center = <><b className="simon-big">{score}</b><small>{phase === 'input' ? 'Sua vez' : phase === 'wait' ? 'Boa!' : 'Observe'}</small></>;

  return (
    <div className="simon" onPointerDown={() => getAudio(true)}>
      <div className={'simon-board' + (phase === 'input' ? ' simon-active' : '')}>
        {PADS.map((p, i) => (
          <button
            key={p.name}
            type="button"
            aria-label={`${p.name} (tecla ${i + 1})`}
            className={'simon-pad simon-pad' + i + (lit === i ? ' simon-lit' : '') + (wrong === i ? ' simon-wrong' : '')}
            style={{ '--c': p.color }}
            onPointerDown={(e) => { e.preventDefault(); press(i); }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="simon-key">{i + 1}</span>
          </button>
        ))}
        <div className="simon-center">{center}</div>
      </div>
      <p className="simon-tip">Repita a sequência tocando nas cores (ou teclas 1 a 4).</p>
    </div>
  );
}
