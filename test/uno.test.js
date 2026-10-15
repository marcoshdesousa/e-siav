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
    assert.ok(/^\d$/.test(s.discard[0].value), 'começa com número');
    for (const id of players) assert.equal(s.hands[id].length, 7);
    let guard = 0;
    while (!s.winner && guard++ < 5000) {
      const id = s.order[s.turn];
      const card = s.hands[id].find((c) => (s.drawn == null ? uno.canPlay(s, c) : c.id === s.drawn));
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
