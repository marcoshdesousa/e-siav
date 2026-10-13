// Vinte e um contra a banca: chegue perto de 21 sem passar. 3 derrotas encerram o jogo.
import { useEffect, useReducer, useRef } from 'react';
import { shuffle, useKeys } from '../kit.js';
import { sfx } from '../audio.js';
import './Blackjack.css';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const MAX_LOSSES = 3;

let uid = 0;
const newShoe = () => {
  const d = [];
  for (let k = 0; k < 2; k++) for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ s, r });
  return shuffle(d);
};

function handValue(cards) {
  let total = 0; let aces = 0;
  for (const c of cards) {
    if (c.r === 1) { aces += 1; total += 11; } else total += Math.min(10, c.r);
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}
const isNatural = (cards) => cards.length === 2 && handValue(cards) === 21;

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

  useEffect(() => {
    const set = timers.current;
    return () => { set.forEach((t) => clearTimeout(t)); set.clear(); };
  }, []);

  const draw = (s, up = true) => {
    if (s.shoe.length < 12) s.shoe = newShoe();
    const c = s.shoe.pop();
    uid += 1;
    return { ...c, up, id: uid };
  };

  const settle = (s, res) => {
    s.phase = 'done';
    s.dealer.forEach((c) => { c.up = true; });
    const pts = res === 'bj' ? 15 : res === 'win' ? 10 : 0;
    s.score += pts;
    s.last = { res, pts };
    if (res === 'lose') s.losses += 1;
    if (res === 'win' || res === 'bj') s.wins += 1;
    sfx(res === 'bj' ? 'coin' : res === 'win' ? 'point' : res === 'lose' ? 'error' : 'tap');
    cbs.current.onScore(s.score);
    if (s.losses >= MAX_LOSSES) {
      s.phase = 'over';
      later(() => {
        if (ended.current) return;
        ended.current = true;
        cbs.current.onEnd(st.current.score);
      }, 1800);
    }
    render();
  };

  const startRound = (s) => {
    s.player = []; s.dealer = []; s.last = null; s.round += 1;
    s.phase = 'dealing';
    render();
    const seq = [['player', true], ['dealer', true], ['player', true], ['dealer', false]];
    seq.forEach(([who, up], i) => later(() => {
      const t = st.current;
      t[who].push(draw(t, up));
      sfx('flip');
      if (i === seq.length - 1) {
        const pn = isNatural(t.player); const dn = isNatural(t.dealer);
        if (pn || dn) {
          later(() => settle(st.current, pn && dn ? 'push' : pn ? 'bj' : 'lose'), 550);
        } else t.phase = 'player';
      }
      render();
    }, 260 + i * 300));
  };

  if (!st.current) {
    st.current = { shoe: newShoe(), player: [], dealer: [], phase: 'idle', score: 0, losses: 0, wins: 0, round: 0, last: null };
  }

  useEffect(() => {
    const s = st.current;
    // Montagem (o StrictMode monta duas vezes e cancela os timers da primeira).
    if (s.round <= 1 && (s.phase === 'idle' || s.phase === 'dealing')) { s.round = 0; startRound(s); }
  }, []);

  const dealerPlay = () => {
    const s = st.current;
    const v = handValue(s.dealer);
    if (v < 17) {
      s.dealer.push(draw(s, true));
      sfx('flip');
      render();
      later(dealerPlay, 650);
      return;
    }
    const p = handValue(s.player);
    settle(s, v > 21 || p > v ? 'win' : p === v ? 'push' : 'lose');
  };

  const hit = () => {
    const s = st.current;
    if (s.phase !== 'player') return;
    s.player.push(draw(s, true));
    sfx('flip');
    const v = handValue(s.player);
    if (v > 21) { s.phase = 'busy'; render(); later(() => settle(st.current, 'lose'), 500); return; }
    if (v === 21) { stand(); return; }
    render();
  };

  function stand() {
    const s = st.current;
    if (s.phase !== 'player') return;
    s.phase = 'dealer';
    s.dealer.forEach((c) => { c.up = true; });
    sfx('tap');
    render();
    later(dealerPlay, 650);
  }

  const next = () => {
    const s = st.current;
    if (s.phase !== 'done') return;
    sfx('tap');
    startRound(s);
  };

  useKeys((k, down) => {
    if (!down) return;
    if (k === 'up') hit();
    else if (k === 'down') stand();
    else if (k === 'action') { if (st.current.phase === 'done') next(); else hit(); }
  });

  const s = st.current;
  const pv = handValue(s.player);
  const dv = handValue(s.dealer.filter((c) => c.up));
  const hidden = s.dealer.some((c) => !c.up);
  const RES = { bj: 'Vinte e um de cara! +15', win: 'Você venceu a rodada! +10', push: 'Empate. +0', lose: pv > 21 ? 'Passou de 21. Derrota.' : 'A banca venceu.' };

  const hand = (cards) => (
    <div className="blackjack-hand" style={{ '--n': Math.max(cards.length, 1) }}>
      {cards.map((c) => (
        <div key={c.id} className={'blackjack-card' + (c.up ? (c.s === 1 || c.s === 2 ? ' blackjack-red' : '') : ' blackjack-back')}>
          {c.up && (
            <>
              <span className="blackjack-corner">{RANKS[c.r]}<i>{SUITS[c.s]}</i></span>
              <span className="blackjack-mid">{SUITS[c.s]}</span>
              <span className="blackjack-corner blackjack-corner-b">{RANKS[c.r]}<i>{SUITS[c.s]}</i></span>
            </>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="blackjack">
      <div className="blackjack-top">
        <span>Rodada <b>{s.round}</b></span>
        <span>Pontos <b>{s.score}</b></span>
        <span className="blackjack-lives" aria-label={'Derrotas: ' + s.losses}>
          {Array.from({ length: MAX_LOSSES }, (_, i) => <i key={i} className={i < s.losses ? 'blackjack-lost' : ''}>♥</i>)}
        </span>
      </div>
      <div className="blackjack-table">
        <div className="blackjack-side">
          <div className="blackjack-label">Banca <b>{s.dealer.length ? (hidden ? dv + ' + ?' : dv) : ''}</b></div>
          {hand(s.dealer)}
        </div>
        <div className={'blackjack-result' + (s.last ? ' blackjack-result-' + s.last.res : '')}>
          {s.phase === 'over' ? 'Fim de jogo! ' + s.wins + (s.wins === 1 ? ' vitória' : ' vitórias') : s.last ? RES[s.last.res] : s.phase === 'dealer' ? 'A banca está jogando…' : s.phase === 'player' ? 'Pedir ou parar?' : ''}
        </div>
        <div className="blackjack-side">
          {hand(s.player)}
          <div className="blackjack-label">Você <b className={pv > 21 ? 'blackjack-bust' : ''}>{s.player.length ? pv : ''}</b></div>
        </div>
      </div>
      <div className="blackjack-actions">
        {s.phase === 'done' ? (
          <button type="button" className="blackjack-btn blackjack-next" onClick={next}>Próxima rodada</button>
        ) : (
          <>
            <button type="button" className="blackjack-btn blackjack-hit" onClick={hit} disabled={s.phase !== 'player'}>Pedir</button>
            <button type="button" className="blackjack-btn blackjack-stand" onClick={stand} disabled={s.phase !== 'player'}>Parar</button>
          </>
        )}
      </div>
      <p className="blackjack-hint">A banca compra até ter 17 ou mais. Ás vale 1 ou 11.</p>
    </div>
  );
}
