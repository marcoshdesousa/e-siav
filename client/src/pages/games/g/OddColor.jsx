// Cor diferente: ache o quadrado com um tom levemente diferente. A grade cresce de 2x2 até 8x8
// e a diferença diminui a cada acerto. 60 segundos no total; errar tira 3 segundos.
import { useEffect, useRef, useState } from 'react';
import { rand } from '../kit.js';
import { sfx } from '../audio.js';
import './OddColor.css';
import { Timer } from 'lucide-react';

const TOTAL = 60000;
const PENALTY = 3000;

const sizeFor = (lv) => Math.min(8, 2 + Math.floor((lv + 1) / 2));
const deltaFor = (lv) => Math.max(3.2, 24 * 0.92 ** lv);

function makeRound(lv) {
  const n = sizeFor(lv);
  const hue = rand(360);
  const sat = 45 + rand(35);
  const light = 38 + rand(22);
  const d = deltaFor(lv);
  const odd = rand(n * n);
  const oddLight = light + (Math.random() < 0.5 ? -d : d);
  return { lv, n, odd, base: `hsl(${hue}, ${sat}%, ${light}%)`, alt: `hsl(${hue}, ${sat}%, ${oddLight.toFixed(1)}%)` };
}

const now = () => window.performance.now();

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [round, setRound] = useState(() => makeRound(0));
  const [left, setLeft] = useState(TOTAL);
  const [over, setOver] = useState(false);
  const [wrong, setWrong] = useState(null); // { i, k }
  const [pen, setPen] = useState(0); // contador para animar o "-3s"
  const [flash, setFlash] = useState(0);
  const [level, setLevel] = useState(0);
  const st = useRef({ deadline: 0, level: 0, over: false });
  const endTimer = useRef(null);

  useEffect(() => {
    cb.current.onScore?.(0);
    st.current.deadline = now() + TOTAL;
    const t = setInterval(() => {
      const s = st.current;
      if (s.over) return;
      const rem = Math.max(0, s.deadline - now());
      setLeft(rem);
      if (rem <= 0) {
        s.over = true;
        setOver(true);
        sfx('lose');
        endTimer.current = setTimeout(() => cb.current.onEnd?.(s.level), 1300);
      }
    }, 100);
    return () => { clearInterval(t); clearTimeout(endTimer.current); };
  }, []);

  const tap = (i) => {
    const s = st.current;
    if (s.over) return;
    if (i === round.odd) {
      s.level += 1;
      sfx(s.level % 5 === 0 ? 'coin' : 'point');
      cb.current.onScore?.(s.level);
      setFlash((f) => f + 1);
      setLevel(s.level);
      setWrong(null);
      setRound(makeRound(s.level));
    } else {
      s.deadline -= PENALTY;
      sfx('error');
      setWrong({ i, k: now() });
      setPen((p) => p + 1);
      setLeft(Math.max(0, s.deadline - now()));
    }
  };

  const secs = Math.ceil(left / 1000);
  const frac = left / TOTAL;
  const { n } = round;

  return (
    <div className="oddcolor">
      <div className="oddcolor-hud">
        <span>Nível <b>{level + 1}</b></span>
        <span className={secs <= 10 ? 'oddcolor-low' : ''}><Timer size={14} style={{ verticalAlign: '-2px' }} /> <b>{secs}s</b>
          {pen > 0 && !over && <em key={pen} className="oddcolor-pen">−3s</em>}
        </span>
        <span>Acertos <b>{level}</b></span>
      </div>
      <div className="oddcolor-bar"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, frac))})` }} /></div>
      <div
        key={flash}
        className={'oddcolor-grid' + (flash ? ' oddcolor-ok' : '')}
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)`, gap: n >= 7 ? 4 : n >= 5 ? 5 : 7 }}
      >
        {Array.from({ length: n * n }, (_, i) => {
          const isOdd = i === round.odd;
          const cls = ['oddcolor-cell'];
          if (wrong && wrong.i === i) cls.push('oddcolor-wrong');
          if (over && isOdd) cls.push('oddcolor-reveal');
          return (
            <button
              type="button"
              key={(wrong && wrong.i === i ? wrong.k : 0) + '-' + i}
              className={cls.join(' ')}
              style={{ background: isOdd ? round.alt : round.base, borderRadius: n >= 7 ? 6 : n >= 5 ? 9 : 14 }}
              onClick={() => tap(i)}
              disabled={over}
              aria-label={`Quadrado ${i + 1}`}
            />
          );
        })}
      </div>
      <p className="oddcolor-tip">
        {over ? (level === 1 ? 'Tempo esgotado! 1 nível.' : `Tempo esgotado! ${level} níveis.`) : 'Toque no quadrado de cor diferente. Errar tira 3 segundos.'}
      </p>
    </div>
  );
}
