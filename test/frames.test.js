// Molduras e o mês dos mini-jogos (direto nos módulos do servidor, com um banco temporário).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-frames-'));
const { get, run } = await import('../server/db.js');
const { seed } = await import('../server/seed.js');
seed();
const { gamesMonthTick } = await import('../server/rankFinals.js');
const { albumFrame, frameOf, framesOf, useFrame } = await import('../server/frames.js');

test('mês dos jogos: fecha sozinho, troféu e moldura do mês para o pódio e tudo zera', () => {
  const pedro = get(`SELECT id FROM members WHERE name LIKE 'Pedro%'`).id;
  assert.equal(gamesMonthTick(new Date('2027-01-20T15:00:00Z')), null, 'primeira vez só marca o mês');
  run(`INSERT INTO game_scores (member_id, game, best, total, plays) VALUES (?, 'cobrinha', 80, 80, 1)`, pedro);
  assert.equal(gamesMonthTick(new Date('2027-01-31T15:00:00Z')), null, 'mesmo mês');
  const done = gamesMonthTick(new Date('2027-02-01T12:00:00Z'));
  assert.equal(done.label, 'Mini-jogos 1.27');
  const f = framesOf('member', pedro).find((x) => x.source === 'jogo');
  assert.equal(f.title, 'Cobrinha');
  assert.equal(f.sub, '1.27');
  assert.equal(f.place, 1);
  const t = get(`SELECT m.kind FROM medal_awards a JOIN medals m ON m.id = a.medal_id WHERE a.target_type = 'member' AND a.target_id = ? AND m.name = 'Campeão do mês: Cobrinha'`, pedro);
  assert.equal(t.kind, 'trofeu', 'troféu, não medalha');
  assert.equal(get('SELECT COUNT(*) n FROM game_scores').n, 0, 'jogos zeraram');
  assert.equal(gamesMonthTick(new Date('2027-02-02T12:00:00Z')), null, 'não fecha duas vezes');
  // Escolher e tirar a moldura; não dá para usar a de outra pessoa.
  assert.ok(useFrame('member', pedro, f.id));
  assert.equal(frameOf('member', pedro).id, f.id);
  const other = get('SELECT id FROM members WHERE id <> ? LIMIT 1', pedro).id;
  assert.equal(useFrame('member', other, f.id), false);
  assert.ok(useFrame('member', pedro, null));
  assert.equal(frameOf('member', pedro), null);
});

test('álbum completo: moldura exclusiva do App do DBV (uma só vez), já em uso', () => {
  const ana = get(`SELECT id FROM members WHERE name LIKE 'Ana%'`).id;
  assert.ok(albumFrame(ana, 'Álbum Bíblico'));
  assert.equal(albumFrame(ana, 'Álbum Bíblico'), null, 'não repete');
  assert.equal(frameOf('member', ana).style, 'dbv');
});
