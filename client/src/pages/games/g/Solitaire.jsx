// Paciência (Klondike, comprando 1 carta): toque na carta e depois no destino.
// Tocar de novo na carta escolhida manda para a fundação (ou para outra coluna, se der).
import { useEffect, useReducer, useRef, useState } from 'react';
import { shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './Solitaire.css';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const isRed = (c) => c.s === 1 || c.s === 2;

function deal() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ id: s * 13 + r, s, r, up: false });
  const d = shuffle(deck);
  const tab = [];
  for (let i = 0; i < 7; i++) {
    const col = [];
    for (let j = 0; j <= i; j++) { const c = d.pop(); c.up = j === i; col.push(c); }
    tab.push(col);
  }
  return {
    stock: d, waste: [], found: [[], [], [], []], tab, sel: null, score: 0, start: Date.now(), secs: 0,
    state: 'play', noProg: 0, progress: false, msg: '', moved: new Set(), auto: false,
  };
}

const canFound = (s, card, f) => {
  const p = s.found[f];
  if (!p.length) return card.r === 1;
  const t = p[p.length - 1];
  return t.s === card.s && card.r === t.r + 1;
};
const findFound = (s, card) => {
  for (let f = 0; f < 4; f++) if (canFound(s, card, f)) return f;
  return -1;
};
const canTab = (s, card, col) => {
  const p = s.tab[col];
  if (!p.length) return card.r === 13;
  const t = p[p.length - 1];
  return t.up && isRed(t) !== isRed(card) && t.r === card.r + 1;
};

function selCards(s, sel) {
  if (!sel) return [];
  if (sel.type === 'waste') return s.waste.length ? [s.waste[s.waste.length - 1]] : [];
  if (sel.type === 'found') { const p = s.found[sel.f]; return p.length ? [p[p.length - 1]] : []; }
  return s.tab[sel.col].slice(sel.idx);
}

function hasUsefulMove(s) {
  if (s.stock.length || s.waste.length) return true;
  for (let c = 0; c < 7; c++) {
    const col = s.tab[c];
    if (!col.length) continue;
    if (findFound(s, col[col.length - 1]) >= 0) return true;
    for (let i = 0; i < col.length; i++) {
      if (!col[i].up) continue;
      const under = i > 0 ? col[i - 1] : null;
      let useful = false;
      if (!under) useful = col[i].r !== 13;
      else if (!under.up || findFound(s, under) >= 0) useful = true;
      if (!useful) continue;
      for (let d = 0; d < 7; d++) if (d !== c && canTab(s, col[i], d)) return true;
    }
  }
  return false;
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  if (!st.current) st.current = deal();
  const [, render] = useReducer((x) => x + 1, 0);
  const wrap = useRef(null);
  const [W, setW] = useState(360);
  const timers = useRef({ end: null, auto: null });
  const ended = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const upd = () => setW(Math.max(260, Math.floor(el.clientWidth)));
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const s = st.current;
      if (s.state !== 'play') return;
      const secs = Math.floor((Date.now() - s.start) / 1000);
      if (secs !== s.secs) { s.secs = secs; render(); }
    }, 500);
    const tm = timers.current;
    return () => { clearInterval(t); clearTimeout(tm.end); clearInterval(tm.auto); };
  }, []);

  const finish = (s, won) => {
    if (s.state !== 'play') return;
    s.state = won ? 'won' : 'stuck';
    s.secs = Math.floor((Date.now() - s.start) / 1000);
    s.sel = null;
    clearInterval(timers.current.auto);
    let final = s.score;
    if (won) { s.bonus = Math.max(0, 1200 - s.secs * 2); final += s.bonus; }
    s.final = final;
    sfx(won ? 'win' : 'lose');
    cbs.current.onScore(final);
    timers.current.end = setTimeout(() => {
      if (ended.current) return;
      ended.current = true;
      cbs.current.onEnd(final);
    }, won ? 1400 : 1600);
  };

  const startAuto = (s) => {
    if (s.auto) return;
    s.auto = true;
    s.msg = 'Recolhendo as cartas…';
    timers.current.auto = setInterval(() => {
      const t = st.current;
      let best = -1;
      for (let c = 0; c < 7; c++) {
        const col = t.tab[c];
        if (!col.length) continue;
        if (best < 0 || col[col.length - 1].r < t.tab[best][t.tab[best].length - 1].r) best = c;
      }
      if (best < 0) { clearInterval(timers.current.auto); return; }
      const card = t.tab[best][t.tab[best].length - 1];
      const f = findFound(t, card);
      if (f < 0) { clearInterval(timers.current.auto); t.auto = false; return; }
      t.tab[best].pop();
      t.found[f].push(card);
      t.score += 10;
      t.moved = new Set([card.id]);
      sfx('tap');
      cbs.current.onScore(t.score);
      if (t.found.every((p) => p.length === 13)) finish(t, true);
      render();
    }, 110);
  };

  const afterMove = (s) => {
    s.progress = true;
    s.noProg = 0;
    s.msg = '';
    cbs.current.onScore(s.score);
    if (s.found.every((p) => p.length === 13)) { finish(s, true); return; }
    if (!s.stock.length && !s.waste.length && s.tab.every((col) => col.every((c) => c.up))) { startAuto(s); return; }
    if (!hasUsefulMove(s)) { s.msg = 'Sem jogadas'; finish(s, false); }
  };

  // Executa a jogada sel -> dest. Retorna true se deu certo.
  const doMove = (s, sel, dest) => {
    const cards = selCards(s, sel);
    if (!cards.length) return false;
    if (dest.type === 'found') {
      if (cards.length !== 1 || !canFound(s, cards[0], dest.f)) return false;
      if (sel.type === 'found') return false;
    } else {
      if (sel.type === 'tab' && sel.col === dest.col) return false;
      if (!canTab(s, cards[0], dest.col)) return false;
    }
    if (sel.type === 'waste') s.waste.pop();
    else if (sel.type === 'found') { s.found[sel.f].pop(); s.score = Math.max(0, s.score - 10); } else s.tab[sel.col].splice(sel.idx);
    if (dest.type === 'found') { s.found[dest.f].push(cards[0]); s.score += 10; sfx('point'); } else { s.tab[dest.col].push(...cards); sfx('move'); }
    if (sel.type === 'tab') {
      const col = s.tab[sel.col];
      const top = col[col.length - 1];
      if (top && !top.up) { top.up = true; s.score += 5; }
    }
    s.moved = new Set(cards.map((c) => c.id));
    s.sel = null;
    afterMove(s);
    return true;
  };

  const smartMove = (s, sel) => {
    const cards = selCards(s, sel);
    if (!cards.length) return false;
    if (cards.length === 1 && sel.type !== 'found') {
      const f = findFound(s, cards[0]);
      if (f >= 0) return doMove(s, sel, { type: 'found', f });
    }
    const order = [];
    for (let c = 0; c < 7; c++) if (s.tab[c].length) order.push(c);
    for (let c = 0; c < 7; c++) if (!s.tab[c].length) order.push(c);
    for (const c of order) {
      if (sel.type === 'tab' && (sel.col === c || (sel.idx === 0 && !s.tab[c].length))) continue;
      if (canTab(s, cards[0], c)) return doMove(s, sel, { type: 'tab', col: c });
    }
    return false;
  };

  const busy = () => st.current.state !== 'play' || st.current.auto;

  const onStock = () => {
    const s = st.current;
    if (busy()) return;
    s.sel = null;
    if (s.stock.length) {
      const c = s.stock.pop();
      c.up = true;
      s.waste.push(c);
      s.moved = new Set([c.id]);
      sfx('flip');
    } else if (s.waste.length) {
      if (s.progress) s.noProg = 0; else s.noProg += 1;
      s.progress = false;
      s.stock = s.waste.reverse().map((c) => ({ ...c, up: false }));
      s.waste = [];
      s.moved = new Set();
      sfx('move');
      if (s.noProg >= 2) { s.msg = 'Sem jogadas'; finish(s, false); } else if (s.noProg === 1) s.msg = 'Nenhuma jogada nesta volta. Outra volta sem jogar encerra a partida.';
      else s.msg = '';
    } else return;
    render();
  };

  const sameSel = (a, b) => a && b && a.type === b.type && a.col === b.col && a.idx === b.idx && a.f === b.f;

  const onCard = (loc) => {
    const s = st.current;
    if (busy()) return;
    if (loc.type === 'tab' && !s.tab[loc.col][loc.idx].up) {
      if (s.sel && !doMove(s, s.sel, { type: 'tab', col: loc.col })) { s.sel = null; sfx('error'); }
      render();
      return;
    }
    if (s.sel) {
      if (sameSel(s.sel, loc)) {
        if (!smartMove(s, s.sel)) { s.sel = null; sfx('error'); }
        render();
        return;
      }
      const dest = loc.type === 'tab' ? { type: 'tab', col: loc.col } : loc.type === 'found' ? { type: 'found', f: loc.f } : null;
      if (dest && doMove(s, s.sel, dest)) { render(); return; }
      // Não deu para mover: passa a escolher a carta tocada.
      s.sel = loc;
      sfx('tap');
      render();
      return;
    }
    s.sel = loc;
    sfx('tap');
    render();
  };

  const onSlot = (dest) => {
    const s = st.current;
    if (busy() || !s.sel) return;
    if (!doMove(s, s.sel, dest)) { s.sel = null; sfx('error'); }
    render();
  };

  // ---------- layout ----------
  const s = st.current;
  const gap = Math.max(3, Math.round(W * 0.012));
  const cw = Math.floor((W - 6 * gap) / 7);
  const ch = Math.round(cw * 1.42);
  const x = (i) => i * (cw + gap);
  const y0 = ch + gap * 3;
  const tabArea = Math.min(Math.round(ch * 5), 400);
  const H = y0 + tabArea;
  const selIds = new Set(selCards(s, s.sel).map((c) => c.id));

  const items = [];
  const push = (card, left, top, z, loc) => items.push({ card, left, top, z, loc });
  s.stock.forEach((c, i) => push(c, x(0), -Math.min(i, 4) * 0.5, i, { type: 'stock' }));
  s.waste.forEach((c, i) => push(c, x(1), 0, i, { type: 'waste' }));
  s.found.forEach((p, f) => p.forEach((c, i) => push(c, x(3 + f), 0, i, { type: 'found', f })));
  s.tab.forEach((col, ci) => {
    const d = col.filter((c) => !c.up).length;
    const u = col.length - d;
    let offD = ch * 0.14; let offU = ch * 0.3;
    const need = d * offD + Math.max(0, u - 1) * offU;
    if (need > tabArea - ch && need > 0) { const k = (tabArea - ch) / need; offD *= k; offU *= k; }
    let yy = y0;
    col.forEach((c, i) => { push(c, x(ci), yy, i, { type: 'tab', col: ci, idx: i }); yy += c.up ? offU : offD; });
  });
  items.sort((a, b) => a.card.id - b.card.id);

  const fs = Math.max(11, Math.round(cw * 0.3));
  const mm = String(Math.floor(s.secs / 60)).padStart(2, '0');
  const ss = String(s.secs % 60).padStart(2, '0');
  const status = s.state === 'won' ? `Você venceu! Bônus de tempo +${s.bonus}` : s.state === 'stuck' ? 'Sem jogadas' : s.msg;

  return (
    <div className="solitaire" ref={wrap}>
      <div className="solitaire-top">
        <span>⏱ <b>{mm}:{ss}</b></span>
        <span>Pontos <b>{s.state === 'won' ? s.final : s.score}</b></span>
        <span>🂠 <b>{s.stock.length}</b></span>
      </div>
      <div className="solitaire-board" style={{ height: H, '--cw': cw + 'px', '--ch': ch + 'px', fontSize: fs }}>
        <button type="button" className="solitaire-slot solitaire-slot-stock" style={{ left: x(0), top: 0 }} onClick={onStock} aria-label="Monte">
          {!s.stock.length && s.waste.length > 0 ? '↻' : ''}
        </button>
        <div className="solitaire-slot" style={{ left: x(1), top: 0 }} />
        {[0, 1, 2, 3].map((f) => (
          <button key={'f' + f} type="button" className="solitaire-slot solitaire-slot-found" style={{ left: x(3 + f), top: 0 }} onClick={() => onSlot({ type: 'found', f })} aria-label={'Fundação ' + (f + 1)}>A</button>
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((c) => (
          <button key={'t' + c} type="button" className="solitaire-slot solitaire-slot-tab" style={{ left: x(c), top: y0 }} onClick={() => onSlot({ type: 'tab', col: c })} aria-label={'Coluna ' + (c + 1)}>K</button>
        ))}
        {items.map(({ card, left, top, z, loc }) => {
          const cls = 'solitaire-card' + (card.up ? (isRed(card) ? ' solitaire-red' : ' solitaire-black') : ' solitaire-back')
            + (selIds.has(card.id) ? ' solitaire-sel' : '');
          const click = () => (loc.type === 'stock' ? onStock() : onCard(loc));
          return (
            <div
              key={card.id}
              className={cls}
              style={{ left, top, zIndex: z + 10 + (s.moved.has(card.id) || selIds.has(card.id) ? 100 : 0) }}
              onClick={click}
              role="button"
              aria-label={card.up ? RANKS[card.r] + ' de ' + ['espadas', 'copas', 'ouros', 'paus'][card.s] : 'Carta virada'}
            >
              {card.up && (
                <>
                  <span className="solitaire-corner">{RANKS[card.r]}<i>{SUITS[card.s]}</i></span>
                  <span className="solitaire-big">{card.r > 10 ? RANKS[card.r] : SUITS[card.s]}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className={'solitaire-msg' + (s.state === 'won' ? ' solitaire-msg-win' : s.state === 'stuck' ? ' solitaire-msg-lose' : '')}>
        {status || 'Toque duas vezes numa carta para mandá-la à fundação.'}
      </div>
    </div>
  );
}
