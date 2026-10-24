// Lembretes no celular: horário entre 9h e 21h, espalhados, sem lembrar o que já foi feito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-push-'));
process.env.PUSH_OFF = '1';
const { get, run } = await import('../server/db.js');
const { seed } = await import('../server/seed.js');
seed();
const { pushTick, saveSubscription, slotOf, vapidKeys } = await import('../server/push.js');
const { setSetting } = await import('../server/fees.js');

// Hora de Brasília (UTC-3) num dia fixo.
const at = (hh, mm = 0) => new Date(Date.UTC(2027, 3, 14, hh + 3, mm));
const DATE = '2027-04-14';

test('lembretes: 9h–21h, um por vez, com intervalo, e não lembra o que já fez', async () => {
  assert.ok(vapidKeys().publicKey.length > 40, 'chave VAPID criada');
  setSetting('ano_biblico_inicio', '2027-03-01');
  setSetting('meditacao_inicio', '2027-01-01');
  const m = get("SELECT id FROM members WHERE status = 'ativo' LIMIT 1");
  assert.equal(saveSubscription(m.id, { endpoint: 'http://inseguro', keys: { p256dh: 'a', auth: 'b' } }), false);
  assert.ok(saveSubscription(m.id, { endpoint: 'https://push.exemplo/abc', keys: { p256dh: 'a', auth: 'b' } }));
  const got = [];
  const send = async (id, msg) => { if (id === m.id) got.push(msg.tag); return true; };

  assert.equal(await pushTick(at(8, 59), send), 0, 'antes das 9h nada');
  assert.equal(await pushTick(at(21, 0), send), 0, 'depois das 21h nada');

  // Meditação feita hoje: não lembra.
  run('INSERT INTO meditation_progress (member_id, date, best, attempts, completed_at, on_time) VALUES (?, ?, 5, 1, ?, 1)', m.id, DATE, new Date().toISOString());

  // Um tick por minuto do dia inteiro.
  for (let t = 9 * 60; t < 21 * 60; t++) await pushTick(at(Math.floor(t / 60), t % 60), send);
  assert.ok(got.includes('entrar'), 'lembra de entrar no app');
  assert.ok(got.includes('ano_biblico'), 'lembra do Ano Bíblico');
  assert.ok(!got.includes('meditacao'), 'não lembra da meditação que já fez');
  assert.equal(new Set(got).size, got.length, 'cada lembrete uma vez só');
  const sentAt = get('SELECT GROUP_CONCAT(at) a FROM push_log WHERE member_id = ? AND date = ? AND sent = 1', m.id, DATE).a.split(',').map(Number).sort();
  for (let i = 1; i < sentAt.length; i++) assert.ok(sentAt[i] - sentAt[i - 1] >= 40 * 60e3, 'pelo menos 40 minutos entre lembretes');

  // Horários diferentes para pessoas diferentes.
  const k = { kind: 'ano_biblico', from: 720, to: 810 };
  const slots = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((id) => slotOf(id, DATE, k)));
  assert.ok(slots.size > 3, 'espalha os horários');
  for (const s of slots) assert.ok(s >= 720 && s < 810);
});
