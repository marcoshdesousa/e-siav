import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as uno from '../server/online/uno.js';

const total = (s) => s.deck.length + s.discard.length + Object.values(s.hands).reduce((n, h) => n + h.length, 0);

test('uno: baralho oficial de 108 cartas e partidas completas sem perder carta', () => {
  const deck = uno.newDeck();
  assert.equal(deck.length, 108);
  assert.equal(deck.filter((c) => c.value === 'wild4').length, 4);
  assert.equal(deck.filter((c) => c.color === 'r' && c.value === '0').length, 1);
  for (let game = 0; game < 30; game++) {
    const players = [1, 2, 3, 4].slice(0, 2 + (game % 3));
    const s = uno.start(players);
    assert.notEqual(s.discard[0].color, 'w', 'não começa com coringa');
    for (const id of players) assert.equal(s.hands[id].length, id === players[0] && s.discard[0].value === 'draw2' ? 9 : 7, 'primeira carta +2: o primeiro compra 2');
    let guard = 0;
    while (!s.winner && guard++ < 5000) {
      const id = s.order[s.turn];
      const card = s.hands[id].find((c) => (s.drawn == null ? uno.canPlay(s, c, s.hands[id]) : c.id === s.drawn));
      if (s.hands[id].length === 2 && card) uno.act(s, id, { type: 'uno' });
      const r = card ? uno.act(s, id, { type: 'play', card: card.id, color: 'g' })
        : s.drawn != null ? uno.act(s, id, { type: 'pass' }) : uno.act(s, id, { type: 'draw' });
      assert.ok(!r.error, r.error);
      assert.equal(total(s), 108);
    }
    assert.ok(s.winner, 'alguém venceu');
    assert.equal(s.hands[s.winner].length, 0);
  }
});

test('uno: vez errada, carta que não combina, inverter com 2 = pular, UNO esquecido = +2', () => {
  const s = uno.start([1, 2]);
  s.hands[1] = [{ id: 900, color: 'r', value: 'reverse' }, { id: 901, color: 'r', value: '5' }, { id: 902, color: 'b', value: '1' }];
  s.discard = [{ id: 903, color: 'r', value: '2' }];
  s.color = 'r';
  s.turn = 0;
  assert.ok(uno.act(s, 2, { type: 'draw' }).error, 'não é a vez');
  assert.ok(uno.act(s, 1, { type: 'play', card: 902 }).error, 'não combina');
  uno.act(s, 1, { type: 'play', card: 900 });
  assert.equal(s.order[s.turn], 1, 'com 2 jogadores, inverter pula o outro');
  uno.act(s, 1, { type: 'play', card: 901 }); // fica com 1 carta sem gritar
  assert.equal(s.unoPending, 1);
  assert.equal(uno.act(s, 2, { type: 'catch' }).ok, true);
  assert.equal(s.hands[1].length, 3, 'pegou: +2');
  const v = uno.view(s, 2);
  assert.equal(v.hand.length, s.hands[2].length);
  assert.equal(v.counts[1], 3);
  assert.equal(JSON.stringify(v).includes('"hands"'), false, 'não mostra a mão dos outros');
});

const setup = (players, hands, topCard) => {
  const s = uno.start(players);
  for (const [id, h] of Object.entries(hands)) s.hands[id] = h;
  s.discard = [topCard];
  s.color = topCard.color;
  s.turn = 0; s.dir = 1; s.drawn = null;
  return s;
};

test('uno: pular, inverter com 3, +2, coringa +4 só sem a cor da mesa', () => {
  const s = setup([1, 2, 3], {
    1: [{ id: 900, color: 'r', value: 'skip' }, { id: 901, color: 'r', value: 'reverse' }, { id: 902, color: 'w', value: 'wild4' }, { id: 903, color: 'b', value: '7' }],
    2: [{ id: 910, color: 'g', value: '1' }, { id: 911, color: 'g', value: '2' }],
    3: [{ id: 920, color: 'r', value: 'draw2' }, { id: 921, color: 'y', value: '3' }],
  }, { id: 999, color: 'r', value: '4' });
  assert.match(uno.act(s, 1, { type: 'play', card: 902, color: 'b' }).error, /\+4/, '+4 tendo vermelho não vale');
  uno.act(s, 1, { type: 'play', card: 900 });
  assert.equal(s.order[s.turn], 3, 'pular: a vez vai para o 3');
  uno.act(s, 3, { type: 'play', card: 920 });
  assert.equal(s.hands[1].length, 5, '+2: o 1 comprou 2');
  assert.equal(s.order[s.turn], 2, '+2: o 1 perdeu a vez');
  s.turn = 0; s.color = 'r';
  uno.act(s, 1, { type: 'play', card: 901 });
  assert.equal(s.dir, -1);
  assert.equal(s.order[s.turn], 3, 'inverter com 3: volta para o 3');
  s.turn = 0; s.color = 'g'; s.hands[1] = s.hands[1].filter((c) => c.color !== 'g' && c.color !== 'r');
  s.hands[1] = s.hands[1].filter((c) => c.color !== 'g');
  const r = uno.act(s, 1, { type: 'play', card: 902, color: 'y' });
  assert.ok(r.ok, r.error);
  assert.equal(s.color, 'y', 'coringa escolhe a cor');
  assert.ok(s.events.some((e) => e.type === 'reverse') && s.events.some((e) => e.type === 'skip'));
});

test('uno: comprar sem jogar, monte vazio embaralha a mesa, UNO esquecido escapa quando o próximo age', () => {
  const s = setup([1, 2], {
    1: [{ id: 900, color: 'b', value: '1' }, { id: 901, color: 'b', value: '2' }],
    2: [{ id: 910, color: 'y', value: '1' }, { id: 911, color: 'y', value: '2' }, { id: 912, color: 'y', value: '3' }],
  }, { id: 999, color: 'r', value: '4' });
  s.deck = [{ id: 950, color: 'g', value: '8' }];
  s.discard = [{ id: 960, color: 'g', value: '5' }, { id: 961, color: 'w', value: 'wild', wild: true, chosen: 'r' }, { id: 999, color: 'r', value: '4' }];
  assert.ok(uno.act(s, 1, { type: 'pass' }).error, 'precisa comprar antes de passar');
  uno.act(s, 1, { type: 'draw' });
  assert.equal(s.order[s.turn], 2, 'a comprada não serve: passa sozinho');
  uno.act(s, 2, { type: 'draw' });
  assert.ok(s.events.some((e) => e.type === 'shuffle'), 'embaralhou a mesa');
  assert.equal(s.discard.length, 1);
  assert.ok(s.hands[2].length === 4);
  // Fica com 1 carta sem gritar e o próximo compra antes de alguém pegar: escapou.
  const t = setup([1, 2], { 1: [{ id: 1, color: 'r', value: '1' }, { id: 2, color: 'r', value: '2' }], 2: [{ id: 3, color: 'b', value: '1' }, { id: 4, color: 'b', value: '9' }] }, { id: 5, color: 'r', value: '7' });
  uno.act(t, 1, { type: 'play', card: 1 });
  assert.equal(t.unoPending, 1);
  uno.act(t, 2, { type: 'draw' });
  assert.equal(t.unoPending, null);
  assert.ok(uno.act(t, 2, { type: 'catch' }).error);
  // Gritou antes: não pode ser pego.
  const u = setup([1, 2], { 1: [{ id: 1, color: 'r', value: '1' }, { id: 2, color: 'r', value: '2' }], 2: [{ id: 3, color: 'b', value: '1' }] }, { id: 5, color: 'r', value: '7' });
  assert.ok(uno.act(u, 1, { type: 'uno' }).ok);
  uno.act(u, 1, { type: 'play', card: 1 });
  assert.equal(u.unoPending, null);
  assert.ok(uno.act(u, 2, { type: 'catch' }).error);
});

test('uno: robôs jogam partidas inteiras só com jogadas válidas', () => {
  for (let game = 0; game < 15; game++) {
    const s = uno.start([-1, -2, -3, -4].slice(0, 2 + (game % 3)));
    let now = Date.now();
    for (let k = 0; k < 20000 && !s.winner; k++) { now += 3000; uno.bot(s, now, {}); assert.equal(total(s), 108); }
    assert.ok(s.winner, 'robô venceu');
    assert.equal(total(s), 108);
  }
});
