import { useEffect, useRef, useState } from 'react';
import { pick } from '../kit.js';
import { sfx } from '../audio.js';
import './Whack.css';

const DUR = 45000;
const LIVES = 3;
// Teclas 1-9 no formato do teclado numérico (7 8 9 em cima).
const KEYMAP = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };

const snap = (e) => ({ holes: [...e.holes], left: Math.max(0, DUR - (Date.now() - e.start)), score: e.score, lives: e.lives, combo: e.combo });

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [count, setCount] = useState(3);
  const [over, setOver] = useState(false);
  const [view, setView] = useState({ holes: Array(9).fill(null), left: DUR, score: 0, lives: LIVES, combo: 0 });
  const eng = useRef(null);
  const iv = useRef(null);
  const ended = useRef(false);

  const finish = () => {
    const e = eng.current;
    if (!e || ended.current) return;
    ended.current = true;
    e.over = true;
    clearInterval(iv.current);
    setOver(true);
    setView({ ...snap(e), left: e.lives <= 0 ? snap(e).left : 0 });
    cb.current.onEnd(Math.max(0, e.score));
  };

  useEffect(() => {
    if (count <= 0) return undefined;
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    if (count !== 0 || ended.current) return undefined;
    eng.current = { start: Date.now(), holes: Array(9).fill(null), next: 0, score: 0, combo: 0, lives: LIVES, id: 0, over: false };
    const spawn = (e, now, p) => {
      const free = e.holes.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
      if (!free.length) return;
      const i = pick(free);
      const bomb = Math.random() < 0.1 + 0.14 * p;
      const stay = (1300 - 760 * p) * (0.85 + Math.random() * 0.3);
      e.holes[i] = { type: bomb ? 'bomb' : 'mole', state: 'up', until: now + stay, id: ++e.id };
    };
    const tick = () => {
      const e = eng.current;
      if (!e || e.over) return;
      const now = Date.now();
      const t = now - e.start;
      const p = Math.min(1, t / DUR);
      e.holes.forEach((h, i) => {
        if (h && now >= h.until) {
          if (h.state === 'up' && h.type === 'mole') e.combo = 0;
          e.holes[i] = null;
        }
      });
      if (now >= e.next) {
        spawn(e, now, p);
        if (p > 0.45 && Math.random() < 0.35 * p) spawn(e, now, p);
        e.next = now + (850 - 480 * p) * (0.7 + Math.random() * 0.6);
      }
      if (t >= DUR) { finish(); return; }
      setView(snap(e));
    };
    tick();
    iv.current = setInterval(tick, 50);
    return () => clearInterval(iv.current);
  }, [count]);

  const hit = (i) => {
    const e = eng.current;
    if (!e || e.over) return;
    const h = e.holes[i];
    const now = Date.now();
    if (!h || h.state !== 'up') {
      e.combo = 0;
    } else if (h.type === 'mole') {
      const pts = 10 + Math.min(e.combo, 10) * 2;
      e.combo += 1;
      e.score += pts;
      sfx('pop');
      h.state = 'hit'; h.pts = pts; h.until = now + 320;
      cb.current.onScore(e.score);
    } else {
      h.state = 'boom'; h.until = now + 550;
      sfx('hit');
      e.combo = 0;
      e.lives -= 1;
      if (e.lives <= 0) { finish(); return; }
    }
    setView(snap(e));
  };
  const hitRef = useRef(hit);
  hitRef.current = hit;

  useEffect(() => {
    const onKey = (ev) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(ev.target.tagName)) return;
      const i = KEYMAP[ev.key];
      if (i === undefined || ev.repeat) return;
      ev.preventDefault();
      hitRef.current(i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const secs = Math.ceil(view.left / 1000);
  const face = (h) => {
    if (h.type === 'bomb') return h.state === 'boom' ? '💥' : '💣';
    return h.state === 'hit' ? '😵' : '🐹';
  };

  return (
    <div className="whack">
      <div className="whack-hud">
        <span className="whack-stat">⏱ <b>{secs}s</b></span>
        <span className="whack-stat">⭐ <b>{view.score}</b></span>
        <span className="whack-stat" aria-label={`${view.lives} vidas`}>
          {Array.from({ length: LIVES }, (_, k) => (k < view.lives ? '❤️' : '🖤')).join('')}
        </span>
      </div>
      <div className="whack-bar"><i style={{ width: (view.left / DUR) * 100 + '%' }} /></div>
      <div className="whack-combo">{view.combo >= 2 ? `Combo x${view.combo}!` : ' '}</div>
      <div className="whack-grid">
        {view.holes.map((h, i) => (
          <button
            key={i}
            type="button"
            className="whack-hole"
            aria-label={`Buraco ${i + 1}`}
            onPointerDown={(ev) => { ev.preventDefault(); hit(i); }}
            onContextMenu={(ev) => ev.preventDefault()}
          >
            <span className="whack-pit" />
            {h && <span key={h.id} className={'whack-pop whack-' + h.state}>{face(h)}</span>}
            {h && h.state === 'hit' && <span key={'p' + h.id} className="whack-pts">+{h.pts}</span>}
            <span className="whack-dirt" />
          </button>
        ))}
        {count > 0 && <div className="whack-overlay"><b>{count}</b></div>}
        {over && <div className="whack-overlay"><b>{view.lives <= 0 ? 'Boom!' : 'Tempo!'}</b></div>}
      </div>
    </div>
  );
}
