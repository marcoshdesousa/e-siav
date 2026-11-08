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

test('lembrete com horário escolhido: manda na hora (até de madrugada), uma vez, e tira o automático daquele estudo', async () => {
  const { setReminder, remindersOf } = await import('../server/push.js');
  const m = get("SELECT id FROM members WHERE status = 'ativo' ORDER BY id DESC LIMIT 1");
  saveSubscription(m.id, { endpoint: 'https://push.exemplo/hora', keys: { p256dh: 'a', auth: 'b' } });
  assert.equal(setReminder(m.id, 'ano_biblico', '25:00'), false, 'hora inválida');
  assert.equal(setReminder(m.id, 'qualquer', '07:00'), false, 'estudo inválido');
  assert.ok(setReminder(m.id, 'ano_biblico', '06:15'));
  assert.ok(setReminder(m.id, 'bom_de_biblia', '22:40'));
  assert.deepEqual(remindersOf(m.id), { ano_biblico: '06:15', bom_de_biblia: '22:40' });
  const got = [];
  const send = async (id, msg) => { if (id === m.id) got.push(msg.tag); return true; };
  const day = (hh, mm) => new Date(Date.UTC(2027, 3, 15, hh + 3, mm));
  await pushTick(day(6, 14), send);
  assert.deepEqual(got, [], 'antes da hora nada');
  await pushTick(day(6, 15), send);
  await pushTick(day(6, 16), send);
  assert.deepEqual(got, ['hora:ano_biblico'], 'na hora, uma vez só');
  for (let t = 9 * 60; t < 21 * 60; t++) await pushTick(day(Math.floor(t / 60), t % 60), send);
  assert.ok(!got.includes('ano_biblico'), 'sem o lembrete automático do Ano Bíblico');
  await pushTick(day(22, 40), send);
  assert.ok(got.includes('hora:bom_de_biblia'), 'Bom de Bíblia às 22:40');
  assert.ok(setReminder(m.id, 'ano_biblico', ''));
  assert.deepEqual(remindersOf(m.id), { bom_de_biblia: '22:40' }, 'tirou o lembrete');
});
