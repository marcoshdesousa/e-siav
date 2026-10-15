// Uno DBV: regras oficiais do jogo de cartas (108 cartas, 7 na mão, comprar 1, inverter, pular,
// +2, coringa e coringa +4, gritar "UNO" com 1 carta). Ganha quem zerar a mão primeiro.
// Tudo roda no servidor: cada jogador só recebe a própria mão e quantas cartas os outros têm.
import crypto from 'node:crypto';

export const COLORS = ['r', 'y', 'g', 'b'];
export const TURN_SECONDS = 30;
const UNO_PENALTY = 2;

/** Baralho oficial: por cor um 0, dois de 1–9, dois pular, dois inverter, dois +2; 4 coringas e 4 coringas +4. */
export function newDeck() {
  const deck = [];
  let n = 0;
  const add = (color, value) => deck.push({ id: n++, color, value });
  for (const c of COLORS) {
    add(c, '0');
    for (let k = 0; k < 2; k++) {
      for (let v = 1; v <= 9; v++) add(c, String(v));
      add(c, 'skip'); add(c, 'reverse'); add(c, 'draw2');
    }
  }
  for (let k = 0; k < 4; k++) { add('w', 'wild'); add('w', 'wild4'); }
  return shuffle(deck);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isNumber = (c) => /^\d$/.test(c.value);

/** Começa a partida: 7 cartas para cada um e uma carta de número virada na mesa. */
export function start(playerIds) {
  const deck = newDeck();
  const hands = Object.fromEntries(playerIds.map((id) => [id, deck.splice(0, 7)]));
  // A primeira carta da mesa é sempre um número (as especiais voltam para o monte).
  const i = deck.findIndex(isNumber);
  const [first] = deck.splice(i, 1);
  return {
    order: [...playerIds], hands, deck, discard: [first], color: first.color, turn: 0, dir: 1,
    drawn: null, // carta que o jogador da vez acabou de comprar (pode jogar ou passar)
    unoSaid: {}, unoPending: null, // quem ficou com 1 carta sem gritar UNO (pode ser pego)
    turnEndsAt: Date.now() + TURN_SECONDS * 1000, winner: null, log: [], moves: 0, lastPlay: null,
  };
}

const top = (s) => s.discard[s.discard.length - 1];
const current = (s) => s.order[s.turn];

export function canPlay(s, card) {
  const t = top(s);
  return card.color === 'w' || card.color === s.color || card.value === t.value;
}

function draw(s, id, n) {
  const got = [];
  for (let k = 0; k < n; k++) {
    if (!s.deck.length) {
      // Monte acabou: embaralha a mesa (menos a carta de cima) e volta a comprar.
      const keep = s.discard.pop();
      s.deck = shuffle(s.discard.map((c) => (c.color === 'w' || c.wild ? { id: c.id, color: 'w', value: c.value } : c)));
      s.discard = [keep];
      if (!s.deck.length) break;
    }
    const c = s.deck.pop();
    s.hands[id].push(c);
    got.push(c);
  }
  return got;
}

const step = (s, k = 1) => (s.turn + s.dir * k + s.order.length * 4) % s.order.length;

function nextTurn(s, skip = 0) {
  s.turn = step(s, 1 + skip);
  s.drawn = null;
  s.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
}

const say = (s, text) => { s.log.push(text); if (s.log.length > 30) s.log.shift(); };

/**
 * Ação de um jogador. Devolve { ok } ou { error }. Tipos:
 * play {card, color?} · draw · pass · uno · catch {target}
 */
export function act(s, id, a, names = {}) {
  if (s.winner) return { error: 'A partida acabou' };
  const nm = (x) => names[x] || 'Jogador';
  if (a.type === 'uno') {
    const hand = s.hands[id];
    if (!hand) return { error: 'Você não está na partida' };
    // Vale gritar com 2 cartas na sua vez (antes de jogar) ou logo depois de ficar com 1.
    if (hand.length === 1 || (hand.length === 2 && current(s) === id)) {
      s.unoSaid[id] = true;
      if (s.unoPending === id) s.unoPending = null;
      say(s, `${nm(id)} gritou UNO!`);
      s.lastEvent = { type: 'uno', who: id, at: Date.now() };
      return { ok: true };
    }
    return { error: 'Só dá para gritar UNO com 2 cartas na sua vez ou com 1 carta' };
  }
  if (a.type === 'catch') {
    const t = s.unoPending;
    if (!t || t === id || s.hands[t]?.length !== 1 || s.unoSaid[t]) return { error: 'Não dá para pegar ninguém agora' };
    draw(s, t, UNO_PENALTY);
    s.unoPending = null;
    say(s, `${nm(id)} pegou ${nm(t)} sem gritar UNO: +${UNO_PENALTY} cartas!`);
    s.lastEvent = { type: 'caught', who: t, by: id, at: Date.now() };
    return { ok: true };
  }
  if (current(s) !== id) return { error: 'Não é a sua vez' };
  const hand = s.hands[id];
  if (a.type === 'draw') {
    if (s.drawn != null) return { error: 'Você já comprou nesta vez' };
    const [c] = draw(s, id, 1);
    s.unoSaid[id] = false;
    s.moves++;
    if (!c) { nextTurn(s); return { ok: true }; }
    say(s, `${nm(id)} comprou uma carta`);
    // A carta comprada pode ser jogada na hora; se não servir, a vez passa sozinha.
    if (canPlay(s, c)) s.drawn = c.id;
    else nextTurn(s);
    s.lastEvent = { type: 'draw', who: id, n: 1, at: Date.now() };
    return { ok: true };
  }
  if (a.type === 'pass') {
    if (s.drawn == null) return { error: 'Compre uma carta antes de passar' };
    nextTurn(s);
    return { ok: true };
  }
  if (a.type !== 'play') return { error: 'Ação inválida' };
  const idx = hand.findIndex((c) => c.id === a.card);
  if (idx < 0) return { error: 'Carta inválida' };
  const card = hand[idx];
  if (s.drawn != null && card.id !== s.drawn) return { error: 'Depois de comprar, só dá para jogar a carta comprada' };
  if (!canPlay(s, card)) return { error: 'Essa carta não combina com a da mesa' };
  if (card.color === 'w' && !COLORS.includes(a.color)) return { error: 'Escolha a cor' };
  hand.splice(idx, 1);
  s.discard.push(card.color === 'w' ? { ...card, wild: true, chosen: a.color } : card);
  s.color = card.color === 'w' ? a.color : card.color;
  s.moves++;
  s.lastPlay = { who: id, card: card.color === 'w' ? { ...card, chosen: a.color } : card, at: Date.now() };
  // Quem tinha ficado com 1 carta sem gritar e não foi pego até aqui escapou.
  if (s.unoPending && s.unoPending !== id) s.unoPending = null;
  if (hand.length === 1) {
    if (!s.unoSaid[id]) s.unoPending = id;
  } else s.unoSaid[id] = false;
  if (!hand.length) {
    s.winner = id;
    s.done = true;
    say(s, `${nm(id)} venceu!`);
    return { ok: true, win: true };
  }
  const two = s.order.length === 2;
  let skip = 0;
  if (card.value === 'skip') { skip = 1; say(s, `${nm(s.order[step(s, 1)])} foi pulado`); }
  if (card.value === 'reverse') {
    if (two) skip = 1; // com 2 jogadores, inverter = pular
    else { s.dir *= -1; say(s, 'O sentido mudou'); }
  }
  if (card.value === 'draw2' || card.value === 'wild4') {
    const victim = s.order[step(s, 1)];
    const n = card.value === 'draw2' ? 2 : 4;
    draw(s, victim, n);
    s.unoSaid[victim] = false;
    say(s, `${nm(victim)} comprou ${n} e perdeu a vez`);
    s.lastEvent = { type: 'draw', who: victim, n, at: Date.now() };
    skip = 1;
  }
  nextTurn(s, skip);
  return { ok: true };
}

/** Relógio do servidor: passou do tempo da vez, compra e passa sozinho. */
export function tick(s, now, names) {
  if (s.winner || now <= s.turnEndsAt) return false;
  timeout(s, names);
  return true;
}

/** Tempo da vez acabou: compra 1 e, se der, joga; senão passa (a partida nunca trava). */
export function timeout(s, names) {
  const id = current(s);
  if (s.drawn == null) act(s, id, { type: 'draw' }, names);
  if (current(s) === id && s.drawn != null) nextTurn(s);
}

/** Jogador saiu no meio: as cartas dele voltam para o monte e a vez segue. */
export function removePlayer(s, id) {
  const i = s.order.indexOf(id);
  if (i < 0) return;
  s.deck.unshift(...(s.hands[id] || []));
  delete s.hands[id];
  const cur = s.order[s.turn];
  s.order.splice(i, 1);
  if (s.unoPending === id) s.unoPending = null;
  const len = s.order.length;
  if (!len) return;
  if (cur === id) {
    // Era a vez dele: passa para quem vem depois, no sentido do jogo.
    s.turn = s.dir === 1 ? i % len : (i - 1 + len) % len;
    s.drawn = null;
    s.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
  } else s.turn = s.order.indexOf(cur);
}

/** O que cada jogador vê: a própria mão e só a quantidade de cartas dos outros. */
export function view(s, me) {
  const hand = s.hands[me] || [];
  return {
    order: s.order, counts: Object.fromEntries(s.order.map((id) => [id, s.hands[id].length])),
    hand: hand.map((c) => ({ ...c, playable: current(s) === me && (s.drawn == null ? canPlay(s, c) : c.id === s.drawn) })),
    top: top(s), color: s.color, turn: current(s), dir: s.dir, deck: s.deck.length, drawn: current(s) === me ? s.drawn : null,
    turnEndsAt: s.turnEndsAt, winner: s.winner, log: s.log.slice(-4), unoPending: s.unoPending, unoSaid: s.unoSaid,
    lastPlay: s.lastPlay, lastEvent: s.lastEvent || null,
  };
}
