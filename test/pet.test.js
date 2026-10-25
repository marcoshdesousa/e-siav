// Meu Bichinho: adotar, necessidades caindo com o tempo, cuidados, roupas por nível e lembrete.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-pet-'));
process.env.PUSH_OFF = '1';
const { get } = await import('../server/db.js');
const { seed } = await import('../server/seed.js');
seed();
const { act, adopt, loadPet, petReminder, view, XP_LEVEL } = await import('../server/pet.js');

const H = 3600e3;

test('bichinho: tempo passa, cuida, sujeira, xixi, dormir, roupas e lembrete', () => {
  const m = get("SELECT id FROM members WHERE status = 'ativo' LIMIT 1");
  const t0 = Date.UTC(2027, 3, 14, 12);
  assert.throws(() => adopt(m.id, { kind: 'dragao', name: 'Rex' }, t0));
  const p0 = adopt(m.id, { kind: 'cachorro', name: 'Rex', color: 'caramelo' }, t0);
  assert.equal(view(p0).mood, 'feliz');

  // 13 horas sem cuidar: fome, sono e bexiga cheia (fez xixi no chão)
  let p = loadPet(m.id, t0 + 13 * H);
  assert.ok(p.fome < 25 && p.energia < 30);
  assert.equal(p.xixi_chao, 1, 'não aguentou e fez no chão');
  assert.ok(petReminder(m.id, t0 + 13 * H), 'manda lembrete');

  // comer; não come de barriga cheia
  let r = act(p, 'comer', 'arroz', t0 + 13 * H); p = r.pet;
  assert.ok(p.fome > 50 && p.next_poop);
  p = act(p, 'comer', 'arroz', t0 + 13 * H).pet;
  p = act(p, 'comer', 'sopa', t0 + 13 * H).pet;
  assert.throws(() => act(p, 'comer', 'bolo', t0 + 13 * H), /barriga cheia/);

  // 3 horas depois sai cocô; limpar
  p = loadPet(m.id, t0 + 16 * H);
  assert.equal(p.cocos, 1);
  p = act(p, 'limpar', null, t0 + 16 * H).pet;
  assert.equal(p.cocos + p.xixi_chao, 0);
  assert.throws(() => act(p, 'limpar', null, t0 + 16 * H), /nada para limpar/);

  // xixi só com vontade
  p = act({ ...p, bexiga: 50 }, 'xixi', null, t0 + 16 * H).pet;
  assert.equal(p.bexiga, 0);
  assert.throws(() => act(p, 'xixi', null, t0 + 16 * H), /vontade/);

  // dormir recupera energia e acorda sozinho
  p = act(p, 'dormir', null, t0 + 16 * H).pet;
  assert.throws(() => act(p, 'banho', null, t0 + 16 * H), /dormindo/);
  p = loadPet(m.id, t0 + 22 * H);
  assert.equal(p.dormindo, 0);
  assert.equal(p.energia, 100);

  // roupa só no nível; nível sobe com cuidado
  assert.throws(() => act(p, 'vestir', 'coroa', t0 + 22 * H), /nível 6/);
  p = act({ ...p, xp: XP_LEVEL * 6 }, 'vestir', 'coroa', t0 + 22 * H).pet;
  assert.equal(view(p).outfit.chapeu, 'coroa');
  p = act(p, 'vestir', 'coroa', t0 + 22 * H).pet;
  assert.equal(view(p).outfit.chapeu, undefined, 'tocar de novo tira');
});
