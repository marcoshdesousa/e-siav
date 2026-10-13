import { useEffect, useRef, useState } from 'react';
import { pick, shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './MathRush.css';

const START = 30000;
const BONUS = 3000;
const PENALTY = 5000;
const r = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

function makeQ(level) {
  const L = Math.min(level, 8) - 1;
  const ops = level <= 1 ? ['+'] : level <= 2 ? ['+', '−'] : level <= 3 ? ['+', '−', '×'] : ['+', '−', '×', '÷'];
  const op = pick(ops);
  let a; let b; let ans;
  if (op === '+') { const m = [9, 20, 50, 60, 99, 199, 499, 999][L]; a = r(1, m); b = r(1, m); ans = a + b; }
  else if (op === '−') { const m = [9, 20, 50, 60, 99, 199, 499, 999][L]; a = r(2, m); b = r(1, a); ans = a - b; }
  else if (op === '×') { const m = [5, 5, 6, 9, 10, 12, 15, 25][L]; a = r(2, m); b = r(2, Math.min(m, level >= 7 ? 12 : 10)); ans = a * b; }
  else { const m = [5, 5, 6, 9, 10, 12, 12, 15][L]; b = r(2, m); ans = r(2, m); a = b * ans; }
  const opts = new Set([ans]);
  const near = [1, 2, 10, -1, -2, -10, 3, -3, 5, -5, 4, -4];
  if (op === '×') near.push(a, -a, b, -b);
  let guard = 0;
  while (opts.size < 4 && guard++ < 100) {
    const v = ans + (guard < 40 ? pick(near) : r(-20, 20));
    if (v >= 0) opts.add(v);
  }
  return { text: `${a} ${op} ${b}`, ans, opts: shuffle([...opts]), level };
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [count, setCount] = useState(3);
  const [q, setQ] = useState(() => makeQ(1));
  const [left, setLeft] = useState(START);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null); // { i, ok }
  const [delta, setDelta] = useState(null); // { id, text, ok }
  const [over, setOver] = useState(false);
  const st = useRef({ left: START, last: 0, correct: 0, score: 0, lock: false, over: false });
  const iv = useRef(null);
  const nextT = useRef(null);

  const finish = () => {
    const s = st.current;
    if (s.over) return;
    s.over = true; s.left = 0;
    clearInterval(iv.current);
    clearTimeout(nextT.current);
    setLeft(0);
    setOver(true);
    cb.current.onEnd(Math.max(0, s.score));
  };

  useEffect(() => {
    if (count <= 0) return undefined;
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    if (count !== 0 || st.current.over) return undefined;
    st.current.last = Date.now();
    iv.current = setInterval(() => {
      const s = st.current;
      const now = Date.now();
      s.left -= now - s.last;
      s.last = now;
      if (s.left <= 0) finish();
      else setLeft(s.left);
    }, 100);
    return () => clearInterval(iv.current);
  }, [count]);

  useEffect(() => () => clearTimeout(nextT.current), []);

  const answer = (i) => {
    const s = st.current;
    if (count > 0 || s.over || s.lock) return;
    const ok = q.opts[i] === q.ans;
    s.lock = true;
    if (ok) {
      s.correct += 1;
      sfx('point');
      s.score += 10 + (q.level - 1) * 2;
      s.left += BONUS;
      setScore(s.score);
      cb.current.onScore(s.score);
      setDelta({ id: Date.now(), text: '+3s', ok: true });
    } else {
      s.left -= PENALTY;
      sfx('error');
      setDelta({ id: Date.now(), text: '−5s', ok: false });
    }
    setLeft(Math.max(0, s.left));
    setPicked({ i, ok });
    if (s.left <= 0) { finish(); return; }
    nextT.current = setTimeout(() => {
      s.lock = false;
      setPicked(null);
      setQ(makeQ(1 + Math.floor(s.correct / 4)));
    }, ok ? 220 : 650);
  };
  const ansRef = useRef(answer);
  ansRef.current = answer;

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i < 0 || e.repeat) return;
      e.preventDefault();
      ansRef.current(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const secs = Math.max(0, left / 1000);
  const pct = Math.min(100, (left / START) * 100);

  return (
    <div className="mathrush">
      <div className="mathrush-hud">
        <span className={'mathrush-time' + (secs < 6 ? ' mathrush-low' : '')}>⏱ {secs.toFixed(1)}s</span>
        <span className="mathrush-level">Nível {q.level}</span>
        <span className="mathrush-score">{score} pts</span>
      </div>
      <div className="mathrush-bar"><i style={{ width: pct + '%' }} /></div>
      <div className="mathrush-q">
        {count > 0 ? <b className="mathrush-count">{count}</b> : over ? <b>Tempo!</b> : <b>{q.text} = ?</b>}
        {delta && !over && <span key={delta.id} className={'mathrush-delta ' + (delta.ok ? 'mathrush-good' : 'mathrush-bad')}>{delta.text}</span>}
      </div>
      <div className="mathrush-opts">
        {q.opts.map((v, i) => {
          let cls = 'mathrush-opt';
          if (picked) {
            if (v === q.ans) cls += ' mathrush-right';
            else if (picked.i === i) cls += ' mathrush-wrong';
          }
          return (
            <button key={i} type="button" className={cls} disabled={count > 0 || over}
              onPointerDown={(e) => { e.preventDefault(); answer(i); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); answer(i); } }}
            >
              <small>{i + 1}</small>{count > 0 ? '?' : v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
