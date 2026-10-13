// Cartas coloridas: jogue carta da mesma cor ou do mesmo número/símbolo e fique sem cartas
// antes do computador. Com 2 jogadores, "inverter" funciona como "pular".
import { useEffect, useReducer, useRef } from 'react';
import { rand, shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './ColorCards.css';

const COLOR_NAMES = ['vermelho', 'amarelo', 'verde', 'azul'];
const LABEL = { d2: '+2', skip: '⊘', rev: '⇄', w: '★', w4: '+4' };
const NAME = { d2: 'mais dois', skip: 'pular', rev: 'inverter', w: 'coringa', w4: 'coringa mais quatro' };

function makeDeck() {
  const d = [];
  let id = 0;
  for (let c = 0; c < 4; c++) {
    d.push({ id: id++, c, v: 0 });
    for (let k = 0; k < 2; k++) {
      for (let v = 1; v <= 9; v++) d.push({ id: id++, c, v });
      for (const v of ['d2', 'skip', 'rev']) d.push({ id: id++, c, v });
    }
  }
  for (let k = 0; k < 4; k++) { d.push({ id: id++, c: 4, v: 'w' }); d.push({ id: id++, c: 4, v: 'w4' }); }
  return shuffle(d);
}

const playable = (card, top, color) => card.c === 4 || card.c === color || (top.c !== 4 && card.v === top.v);
const order = (a, b) => (a.c - b.c) || (String(a.v).localeCompare(String(b.v), 'pt', { numeric: true }));
const cardName = (k) => (k.c === 4 ? NAME[k.v] : (typeof k.v === 'number' ? k.v : NAME[k.v]) + ' ' + COLOR_NAMES[k.c]);

function bestColor(hand) {
  const n = [0, 0, 0, 0];
  hand.forEach((k) => { if (k.c < 4) n[k.c] += 1 + (typeof k.v === 'number' ? 0 : 0.5); });
  const m = Math.max(...n);
  if (m === 0) return rand(4);
  const opts = [0, 1, 2, 3].filter((c) => n[c] === m);
  return opts[rand(opts.length)];
}

// Escolha do computador: prefere atacar quando você tem poucas cartas e guarda os coringas.
function cpuChoose(hand, top, color, oppCount) {
  const opts = hand.filter((k) => playable(k, top, color));
  if (!opts.length) return null;
  if (Math.random() < 0.22) return opts[rand(opts.length)];
  const colorCount = [0, 0, 0, 0];
  hand.forEach((k) => { if (k.c < 4) colorCount[k.c] += 1; });
  let best = null; let bestS = -Infinity;
  for (const k of opts) {
    let sc = 0;
    const action = typeof k.v !== 'number';
    if (k.c === 4) sc = k.v === 'w4' ? (oppCount <= 2 ? 40 : -20) : (oppCount <= 2 ? 10 : -12);
    else {
      sc = 10 + colorCount[k.c] * 2;
      if (action) sc += oppCount <= 3 ? 25 : 4;
      if (typeof k.v === 'number') sc += k.v * 0.3;
    }
    sc += Math.random() * 6;
    if (sc > bestS) { bestS = sc; best = k; }
  }
  return best;
}

export default function Game({ onScore, onEnd }) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const st = useRef(null);
  const [, render] = useReducer((x) => x + 1, 0);
  const timers = useRef(new Set());
  const ended = useRef(false);

  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms);
    timers.current.add(t);
  };

  if (!st.current) {
    const deck = makeDeck();
    const p = deck.splice(0, 7).sort(order);
    const c = deck.splice(0, 7);
    let i = deck.findIndex((k) => typeof k.v === 'number');
    const top = deck.splice(i, 1)[0];
    st.current = {
      deck, discard: [top], color: top.c, hands: { p, c }, turn: 'p', phase: 'play',
      msg: 'Sua vez! Jogue uma carta ou compre.', drawn: null, pending: null, result: null,
    };
  }

  const drawCards = (s, who, n) => {
    const got = [];
    for (let k = 0; k < n; k++) {
      if (!s.deck.length) {
        const top = s.discard.pop();
        s.deck = shuffle(s.discard);
        s.discard = [top];
      }
      if (!s.deck.length) break;
      const k = s.deck.pop();
      got.push(k);
      s.hands[who].push(k);
    }
    if (who === 'p') s.hands.p.sort(order);
    return got;
  };

  const finish = (s, win) => {
    s.phase = 'over';
    s.result = win ? 'win' : 'lose';
    s.msg = win ? 'Você venceu! 🎉' : 'O computador venceu.';
    const pts = win ? 3 : 0;
    sfx(win ? 'win' : 'lose');
    cbs.current.onScore(pts);
    later(() => {
      if (ended.current) return;
      ended.current = true;
      cbs.current.onEnd(pts);
    }, 1500);
  };

  // Aplica o efeito da carta jogada e decide de quem é a vez.
  const resolve = (s, who, card) => {
    const other = who === 'p' ? 'c' : 'p';
    if (!s.hands[who].length) { finish(s, who === 'p'); render(); return; }
    let again = false;
    if (card.v === 'd2') { drawCards(s, other, 2); again = true; sfx('hit'); } else if (card.v === 'w4') { drawCards(s, other, 4); again = true; sfx('hit'); } else if (card.v === 'skip' || card.v === 'rev') { again = true; sfx('pop'); }
    const next = again ? who : other;
    if (who === 'p') {
      s.msg = card.v === 'd2' ? 'O computador comprou 2. Jogue de novo!' : card.v === 'w4' ? 'O computador comprou 4. Jogue de novo!'
        : again ? 'O computador perdeu a vez. Jogue de novo!' : 'Vez do computador…';
    } else {
      s.msg = 'O computador jogou ' + cardName(card) + (card.c === 4 ? ' e escolheu ' + COLOR_NAMES[s.color] : '') + '. ';
      s.msg += card.v === 'd2' ? 'Você comprou 2 e perdeu a vez.' : card.v === 'w4' ? 'Você comprou 4 e perdeu a vez.'
        : again ? 'Você perdeu a vez.' : 'Sua vez!';
    }
    setTurn(s, next);
  };

  function setTurn(s, who) {
    s.turn = who;
    s.phase = 'play';
    s.drawn = null;
    render();
    if (who === 'c') later(cpuStep, 800 + rand(400));
  }

  const playFor = (s, who, card, color) => {
    s.hands[who] = s.hands[who].filter((k) => k.id !== card.id);
    s.discard.push(card);
    s.color = card.c === 4 ? color : card.c;
    if (card.c !== 4 && typeof card.v === 'number') sfx(who === 'p' ? 'tap' : 'move');
    else if (card.c === 4) sfx('flip');
    resolve(s, who, card);
  };

  function cpuStep() {
    const s = st.current;
    if (s.phase === 'over' || s.turn !== 'c') return;
    const top = s.discard[s.discard.length - 1];
    const card = cpuChoose(s.hands.c, top, s.color, s.hands.p.length);
    if (!card) {
      const got = drawCards(s, 'c', 1)[0];
      sfx('flip');
      if (got && playable(got, top, s.color)) {
        s.msg = 'O computador comprou uma carta…';
        render();
        later(() => {
          const t = st.current;
          if (t.phase === 'over') return;
          t.msg = '';
          playFor(t, 'c', got, got.c === 4 ? bestColor(t.hands.c.filter((k) => k.id !== got.id)) : got.c);
        }, 700);
        return;
      }
      s.msg = 'O computador comprou e passou. Sua vez!';
      setTurn(s, 'p');
      return;
    }
    const color = card.c === 4 ? bestColor(s.hands.c.filter((k) => k.id !== card.id)) : card.c;
    playFor(s, 'c', card, color);
  }

  useEffect(() => {
    const set = timers.current;
    return () => { set.forEach((t) => clearTimeout(t)); set.clear(); };
  }, []);

  const onPlay = (card) => {
    const s = st.current;
    if (s.turn !== 'p' || (s.phase !== 'play' && s.phase !== 'drawn')) return;
    const top = s.discard[s.discard.length - 1];
    if (s.phase === 'drawn' && card.id !== s.drawn) { sfx('error'); s.msg = 'Jogue a carta que você comprou ou passe.'; render(); return; }
    if (!playable(card, top, s.color)) { sfx('error'); s.msg = 'Essa carta não combina. Mesma cor ou mesmo número/símbolo.'; render(); return; }
    if (card.c === 4) { s.phase = 'choose'; s.pending = card; s.msg = 'Escolha a nova cor:'; sfx('tap'); render(); return; }
    playFor(s, 'p', card, card.c);
  };

  const onChoose = (color) => {
    const s = st.current;
    if (s.phase !== 'choose' || !s.pending) return;
    const card = s.pending;
    s.pending = null;
    playFor(s, 'p', card, color);
  };

  const onDraw = () => {
    const s = st.current;
    if (s.turn !== 'p' || s.phase !== 'play') return;
    const fresh = drawCards(s, 'p', 1)[0];
    sfx('flip');
    const top = s.discard[s.discard.length - 1];
    if (fresh && playable(fresh, top, s.color)) {
      s.phase = 'drawn';
      s.drawn = fresh.id;
      s.msg = 'Você pode jogar a carta comprada ou passar.';
      render();
      return;
    }
    s.msg = 'Você comprou e passou a vez.';
    setTurn(s, 'c');
  };

  const onPass = () => {
    const s = st.current;
    if (s.turn !== 'p' || s.phase !== 'drawn') return;
    sfx('tap');
    s.msg = 'Vez do computador…';
    setTurn(s, 'c');
  };

  const s = st.current;
  const top = s.discard[s.discard.length - 1];
  const myTurn = s.turn === 'p' && (s.phase === 'play' || s.phase === 'drawn');

  const face = (k, extra = '') => (
    <span className={'colorcards-card colorcards-c' + k.c + extra}>
      <span className="colorcards-oval">{typeof k.v === 'number' ? k.v : LABEL[k.v]}</span>
      <span className="colorcards-mini">{typeof k.v === 'number' ? k.v : LABEL[k.v]}</span>
    </span>
  );

  return (
    <div className="colorcards">
      <div className="colorcards-cpu">
        <span className="colorcards-who">🤖 Computador <b>{s.hands.c.length}</b></span>
        <div className="colorcards-backs">
          {s.hands.c.map((k) => <span key={k.id} className="colorcards-back" />)}
        </div>
      </div>
      <div className="colorcards-center">
        <button type="button" className="colorcards-pile" onClick={onDraw} disabled={!myTurn || s.phase !== 'play'} aria-label="Comprar carta">
          <span className="colorcards-back colorcards-back-big"><b>Comprar</b></span>
        </button>
        <div className="colorcards-discard" aria-label={'Mesa: ' + cardName(top)}>
          {face(top, ' colorcards-big')}
        </div>
        <div className={'colorcards-color colorcards-bg' + s.color} aria-label={'Cor da vez: ' + COLOR_NAMES[s.color]}>
          <small>cor</small>
          <b>{COLOR_NAMES[s.color]}</b>
        </div>
      </div>
      <div className={'colorcards-msg' + (s.result ? ' colorcards-msg-' + s.result : '')}>{s.msg}</div>
      {s.phase === 'choose' ? (
        <div className="colorcards-choose">
          {[0, 1, 2, 3].map((c) => (
            <button key={c} type="button" className={'colorcards-pick colorcards-bg' + c} onClick={() => onChoose(c)}>{COLOR_NAMES[c]}</button>
          ))}
        </div>
      ) : s.phase === 'drawn' ? (
        <div className="colorcards-choose"><button type="button" className="colorcards-pass" onClick={onPass}>Passar a vez</button></div>
      ) : null}
      <div className={'colorcards-hand' + (myTurn ? '' : ' colorcards-wait')}>
        {s.hands.p.map((k) => {
          const ok = myTurn && playable(k, top, s.color) && (s.phase !== 'drawn' || k.id === s.drawn);
          return (
            <button key={k.id} type="button" className={'colorcards-slot' + (ok ? ' colorcards-ok' : '')} onClick={() => onPlay(k)} aria-label={cardName(k)}>
              {face(k)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
