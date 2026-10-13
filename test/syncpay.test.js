// Pix automático pela SyncPay (simulado com SYNCPAY_FAKE=1): gera, confere e libera os pacotinhos sozinho.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}/api`;
let server;
let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-test-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, JWT_SECRET: 'test', SEED_DEMO: '1', SYNCPAY_FAKE: '1' },
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

// A senha do membro é o ano de nascimento: o teste lê do banco (código ou usuário antigo).
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
    if (body instanceof FormData) opts.body = body;
    else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch(BASE + url, opts);
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { actor, cookie, get: (u) => call('GET', u), post: (u, b = {}) => call('POST', u, b), put: (u, b = {}) => call('PUT', u, b), del: (u) => call('DELETE', u) };
}

test('SyncPay: sem pedir dados ao membro, gera o Pix e libera sozinho quando cai', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  assert.equal((await admin.put('/admin/pagamentos-config/pagador', { name: 'App do DBV', cpf: '111' })).status, 400, 'CPF inválido');
  assert.equal((await admin.put('/admin/pagamentos-config/pagador', { name: 'Equipe App do DBV', cpf: '529.982.247-25', email: 'pix@appdodbv.com', phone: '81999990000' })).status, 200);
  assert.equal((await admin.get('/admin/pagamentos-config')).body.payer.cpf, '52998224725');
  const pedro = await login('membros', 'pedro');
  let st = (await pedro.get('/albuns/biblico')).body;
  assert.equal(st.pay_mode, 'syncpay');
  const before = st.packs_unopened;
  const o = (await pedro.post('/albuns/biblico/pedidos', { packs: 10 })).body;
  assert.ok(o.auto && o.pix.startsWith('00020126') && o.qr, 'Pix gerado sem dados do membro');
  assert.equal((await pedro.get(`/pagamentos/${o.id}`)).body.status, 'aberto');
  await pedro.post(`/pagamentos/${o.id}/_simular`);
  await new Promise((r) => setTimeout(r, 4100)); // a consulta é no máximo a cada 4 s
  assert.equal((await pedro.get(`/pagamentos/${o.id}`)).body.status, 'pago');
  assert.equal((await pedro.get('/albuns/biblico')).body.packs_unopened, before + 10, 'liberou os pacotinhos');
  // Conferir de novo não libera de novo
  await new Promise((r) => setTimeout(r, 4100));
  await pedro.get(`/pagamentos/${o.id}`);
  assert.equal((await pedro.get('/albuns/biblico')).body.packs_unopened, before + 10);
  // Aviso (webhook) público só faz conferir
  const r = await fetch(BASE + '/albuns/pix/aviso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { id: 'x' } }) });
  assert.equal(r.status, 200);
});
