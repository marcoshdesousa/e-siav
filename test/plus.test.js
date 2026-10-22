// DBV+: assinatura pelo Pix, benefícios, especialidades escolhidas e figurinhas em dobro.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = 4200 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}/api`;
let server;
let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-test-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, JWT_SECRET: 'test', SEED_DEMO: '1', ADMIN_PASSWORD: 'admin123' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => String(d).includes('rodando') && resolve());
    server.on('exit', (c) => reject(new Error('server exited ' + c)));
  });
});

after(() => {
  server?.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function birthYear(username) {
  const db = new DatabaseSync(path.join(dataDir, 'dbv.sqlite'), { readOnly: true });
  try {
    const r = db.prepare(`SELECT m.birth_date FROM members m LEFT JOIN logins l ON l.account_type = 'member' AND l.account_id = m.id
                          WHERE m.code = ? OR l.username = ?`).get(username, username);
    return r?.birth_date?.slice(0, 4);
  } finally {
    db.close();
  }
}

async function login(mode, username, password) {
  if (password === undefined) password = mode === 'membros' ? birthYear(username) : 'dbv123';
  const res = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, username, password }) });
  assert.equal(res.status, 200, `login ${username}`);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const { actor } = await res.json();
  const call = async (method, url, body) => {
    const opts = { method, headers: { cookie } };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch(BASE + url, opts);
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { actor, cookie, get: (u) => call('GET', u), post: (u, b = {}) => call('POST', u, b), put: (u, b = {}) => call('PUT', u, b) };
}

test('DBV+: sem assinatura (modo de teste desligado) fica bloqueado; assinando, libera tudo', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const pedro = await login('membros', '100001');
  await admin.put('/admin/biblia-teste', { on: false });
  await admin.put('/admin/pagamentos-config/pix', { key: 'pix@appdodbv.com', name: 'App do DBV', city: 'Palmares' });
  let plus = (await pedro.get('/plus')).body;
  assert.equal(plus.plans.length, 3);
  assert.equal(plus.open, false);
  assert.ok(plus.benefits.at(-1).soon, 'em breve por último');
  const day = (await pedro.get('/ano-biblico/dia/1')).status;
  assert.equal(day, 403, 'sem modo de teste o dia futuro fica fechado');
  // compra de figurinhas sem DBV+: quantidade normal
  const normal = (await pedro.post('/albuns/biblico/pedidos', { packs: 1 })).body;
  assert.match(normal.title, /^1 pacotinho/);
  // assina o plano de 3 especialidades e a equipe confirma o Pix
  const pay = (await pedro.post('/plus/assinar', { plan: 'plus3' })).body;
  assert.equal(pay.amount_cents, 1990);
  const before = (await pedro.get('/albuns/biblico')).body.packs_unopened;
  assert.equal((await admin.post(`/admin/pagamentos/${pay.id}/confirmar`)).status, 200);
  plus = (await pedro.get('/plus')).body;
  assert.equal(plus.mine.active, true);
  assert.equal((await pedro.post('/plus/assinar', { plan: 'plus' })).status, 409, 'um plano por vez: só assina de novo quando vencer');
  assert.equal(plus.mine.picks_needed, 15);
  assert.equal((await pedro.get('/albuns/biblico')).body.packs_unopened, before + 30, '30 pacotinhos');
  const me = (await pedro.get('/auth/me')).body.actor;
  assert.ok(me.plus && me.plus_open);
  const dbl = (await pedro.post('/albuns/biblico/pedidos', { packs: 1 })).body;
  assert.match(dbl.title, /^2 pacotinhos.*dobro/, 'figurinhas em dobro');
  // escolhe 15 especialidades
  const cat = (await pedro.get('/catalog?type=especialidade')).body;
  assert.equal((await pedro.put('/plus/especialidades', { ids: cat.slice(0, 3).map((c) => c.id) })).status, 400, 'precisa ser 15');
  assert.equal((await pedro.put('/plus/especialidades', { ids: cat.slice(0, 15).map((c) => c.id) })).status, 200);
  const list = (await admin.get('/admin/plus')).body;
  const mine = list.find((x) => x.code === '100001');
  assert.equal(mine.picks.length, 15);
  // selo de verificado no perfil
  assert.equal((await pedro.get('/me/profile')).body.verified, true);
  await admin.put('/admin/biblia-teste', { on: true });
});

test('DBV+: o modo de teste não libera o premium; contas de teste metade premium; admin dá e tira', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const list = (await admin.get('/admin/plus')).body;
  const base = list.filter((x) => x.active && x.code !== '100001');
  assert.ok(base.length > 0, 'algumas contas de teste já são premium');
  const free = await login('membros', '100002');
  const plus = (await free.get('/plus')).body;
  const isBase = base.some((x) => x.code === '100002');
  assert.equal(plus.open, isBase, 'com o modo de teste ligado, só quem tem DBV+ tem o premium');
  assert.equal((await admin.post('/admin/plus/dar', { code: '999999', plan: 'plus' })).status, 404);
  const g = await admin.post('/admin/plus/dar', { code: '100002', plan: 'plus3', days: 10 });
  assert.equal(g.status, 200);
  assert.equal((await free.get('/plus')).body.open, true);
  const id = (await admin.get('/admin/plus')).body.find((x) => x.code === '100002').member_id;
  const del = await fetch(BASE + '/admin/plus/' + id, { method: 'DELETE', headers: { cookie: admin.cookie } });
  assert.equal(del.status, 200);
  assert.equal((await free.get('/plus')).body.open, false);
});
