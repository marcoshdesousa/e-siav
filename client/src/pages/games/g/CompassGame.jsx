// Bússola: a rosa dos ventos gira; toque na direção pedida antes do tempo acabar. Errou, acabou.
import { useEffect, useRef, useState } from 'react';
import { rand } from '../kit.js';
import { sfx } from '../audio.js';
import './CompassGame.css';

const NAMES = ['NORTE', 'NORDESTE', 'LESTE', 'SUDESTE', 'SUL', 'SUDOESTE', 'OESTE', 'NOROESTE'];
const EIGHT_FROM = 8; // a partir deste acerto aparecem as direções colaterais

function makeQ(n, prev) {
  const eight = n >= EIGHT_FROM;
  let target;
  do { target = eight ? rand(8) : rand(4) * 2; } while (prev && target === prev.target);
  // A rosa gira bastante a cada pergunta (pelo menos 60°), sempre no mesmo sentido para a animação.
  const base = prev ? prev.rot : 0;
  const rot = base + 60 + rand(240);
  const time = Math.max(1.6, 5 - n * 0.14) * 1000;
  return { target, rot, eight, time };
}

function Point({ dir, long, state }) {
  const len = long ? 86 : 58;
  const w = long ? 16 : 11;
  const ang = dir * 45;
  const north = dir === 0;
  return (
    <g transform={`rotate(${ang})`} className={'compassgame-pt' + (state ? ' compassgame-' + state : '')}>
      <polygon points={`0,${-len} ${w},0 0,0`} className={north ? 'compassgame-n1' : 'compassgame-a1'} />
      <polygon points={`0,${-len} ${-w},0 0,0`} className={north ? 'compassgame-n2' : 'compassgame-a2'} />
    </g>
  );
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [q, setQ] = useState(() => makeQ(0, null));
  const [left, setLeft] = useState(q.time);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [mark, setMark] = useState(null); // { tapped, ok }
  const [over, setOver] = useState(false);
  const [gain, setGain] = useState(null);
  const st = useRef({ n: 0, left: q.time, last: Date.now(), score: 0, lock: false, over: false });
  const svgRef = useRef(null);
  const qRef = useRef(q);
  qRef.current = q;
  const timers = useRef([]);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const resolve = (dir) => {
    const s = st.current;
    if (s.lock || s.over) return;
    s.lock = true;
    const cur = qRef.current;
    const ok = dir === cur.target;
    setMark({ tapped: dir, ok });
    if (ok) {
      const pts = 10 + Math.round((s.left / cur.time) * 10) + (cur.eight ? 5 : 0);
      s.score += pts;
      s.n += 1;
      setScore(s.score);
      setStreak(s.n);
      setGain({ id: Date.now(), text: '+' + pts });
      cb.current.onScore(s.score);
      sfx('point');
      later(() => {
        if (st.current.over) return;
        const nq = makeQ(s.n, cur);
        s.left = nq.time; s.last = Date.now(); s.lock = false;
        setQ(nq);
        setLeft(nq.time);
        setMark(null);
      }, 450);
    } else {
      s.over = true;
      setOver(true);
      sfx(dir == null ? 'hit' : 'error');
      later(() => sfx('lose'), 500);
      later(() => cb.current.onEnd(Math.max(0, s.score)), 1900);
    }
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
    }, 50);
    return () => clearInterval(iv);
  }, []);

  const tap = (e) => {
    e.preventDefault();
    const el = svgRef.current;
    if (!el || st.current.lock || st.current.over) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width * 2 - 1;
    const dy = (e.clientY - r.top) / r.height * 2 - 1;
    if (Math.hypot(dx, dy) < 0.12) return;
    const ang = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = para cima, sentido horário
    const local = (((ang - q.rot) % 360) + 360) % 360;
    const dir = q.eight ? Math.round(local / 45) % 8 : (Math.round(local / 90) % 4) * 2;
    resolve(dir);
  };

  const pts = q.eight ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 2, 4, 6];
  const stateOf = (d) => {
    if (!mark) return null;
    if (d === q.target) return 'right';
    if (d === mark.tapped) return 'wrong';
    return null;
  };
  // Desenha primeiro as pontas curtas, depois as longas (por cima).
  const order = [...pts].sort((a, b) => (b % 2) - (a % 2));

  return (
    <div className="compassgame">
      <div className="compassgame-hud">
        <span>Acertos: {streak}</span>
        <span className="compassgame-score">{score} pts</span>
      </div>
      <div className="compassgame-bar"><i style={{ width: (left / q.time) * 100 + '%' }} /></div>
      <div className={'compassgame-ask' + (over ? ' compassgame-ask-bad' : '')}>
        {over ? (mark?.tapped == null ? 'Tempo esgotado!' : 'Errou!') + ' Era o ' + NAMES[q.target].toLowerCase() + '.' : <>Toque no <b>{NAMES[q.target]}</b></>}
        {gain && !over && <span key={gain.id} className="compassgame-gain">{gain.text}</span>}
      </div>
      <svg ref={svgRef} className="compassgame-svg" viewBox="-100 -100 200 200" onPointerDown={tap} onContextMenu={(e) => e.preventDefault()}>
        <circle r="97" className="compassgame-ring" />
        <circle r="90" className="compassgame-ring2" />
        <g className="compassgame-rose" style={{ transform: `rotate(${q.rot}deg)` }}>
          {Array.from({ length: 72 }, (_, i) => (
            <line key={i} x1="0" y1="-90" x2="0" y2={i % 9 === 0 ? -80 : -86} transform={`rotate(${i * 5})`} className="compassgame-tick" />
          ))}
          {order.map((d) => <Point key={d} dir={d} long={d % 2 === 0} state={stateOf(d)} />)}
          <text x="0" y="-70" className="compassgame-nlabel">N</text>
          <circle r="7" className="compassgame-hub" />
        </g>
      </svg>
      <p className="compassgame-help">{q.eight ? 'Agora com as direções colaterais!' : 'A ponta vermelha (N) aponta para o norte.'}</p>
    </div>
  );
}
