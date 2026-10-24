// Administrador geral x administrador de distrito e o link de inscrição de cada clube.
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
  return { actor, get: (u) => call('GET', u), post: (u, b = {}) => call('POST', u, b), put: (u, b = {}) => call('PUT', u, b), del: (u) => call('DELETE', u) };
}

const anon = async (method, url, body) => {
  const r = await fetch(BASE + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null), cookie: r.headers.get('set-cookie') };
};
const yearsAgo = (n) => `${new Date().getFullYear() - n}-01-15`;

test('admin de distrito: só o distrito dele; o geral cria admins com distrito', async () => {
  const geral = await login('membros', 'admin', 'admin123');
  assert.equal(geral.actor.general, true);
  const d2 = (await geral.post('/admin/districts', { name: 'Distrito Teste' })).body.id;
  const outro = (await geral.post('/admin/clubs', { name: 'Outro', district_id: d2, director_name: 'Fulano de Tal' })).body.id;
  assert.equal((await geral.post('/admin/admins', { name: 'Sem distrito', username: 'semd', password: 'senha123' })).status, 400, 'novo admin precisa de distrito');
  const pal = (await geral.get('/admin/districts')).body.find((d) => d.name === 'Distrito Palmares').id;
  assert.equal((await geral.post('/admin/admins', { name: 'Admin Palmares', district_id: pal, username: 'admpal', password: 'senha123' })).status, 200);
  const dist = await login('membros', 'admpal', 'senha123');
  assert.equal(dist.actor.district_id, pal);
  const clubs = (await dist.get('/admin/clubs')).body;
  assert.ok(clubs.length && clubs.every((c) => c.district_id === pal), 'só clubes do distrito');
  assert.equal((await dist.get(`/admin/clubs/${outro}/view`)).status, 404, 'clube de outro distrito não abre');
  const novo = await dist.post('/admin/clubs', { name: 'Novo Distrital', district_id: d2, director_name: 'Maria Souza' });
  assert.equal(novo.status, 200);
  assert.ok((await dist.get('/admin/clubs')).body.some((c) => c.id === novo.body.id), 'clube criado vai para o distrito dele');
  for (const url of ['/admin/admins', '/admin/pagamentos', '/admin/ano-biblico', '/admin/bom-lider']) assert.equal((await dist.get(url)).status, 403, url);
  assert.equal((await dist.post('/admin/districts', { name: 'X' })).status, 403);
  const req = await dist.post('/requirements', { title: 'Requisito do distrito', audience: 'member', scope: 'geral', modes: 'texto', points: 10, late_points: 0, deadline: new Date(Date.now() + 864e5).toISOString() });
  assert.equal(req.status, 200);
  const mine = (await dist.get('/requirements/created')).body;
  assert.ok(mine.some((r) => r.id === req.body.id && r.scope === 'distrito' && r.district_id === pal), 'requisito vira do distrito');
});

test('link de inscrição: desbravador, diretoria e conselheiro entram no clube com login pronto', async () => {
  const club = await login('clube', 'aguias', 'AG2026');
  assert.equal((await anon('GET', '/inscricao/naoexiste')).status, 404);
  const link = (await club.get('/club/inscricao')).body;
  assert.ok(link.token && link.enabled, 'o clube já tem o link ligado');
  const on = (await club.put('/club/inscricao', { enabled: true })).body;
  const info = (await anon('GET', `/inscricao/${on.token}`)).body;
  assert.ok(info.club.name && info.units.length, 'nome do clube e unidades');
  const unit = info.units[0].id;
  const kid = await anon('POST', `/inscricao/${on.token}`, { name: 'Joãozinho Teste', birth_date: yearsAgo(12), cargo: 'desbravador', unit_id: unit });
  assert.equal(kid.status, 200);
  assert.match(kid.body.code, /^\d{6}$/);
  assert.equal(kid.body.password, String(new Date().getFullYear() - 12));
  assert.ok(kid.cookie, 'já entra logado');
  const again = await login('membros', kid.body.code, kid.body.password);
  assert.equal(again.actor.unit_id, unit);
  assert.equal((await anon('POST', `/inscricao/${on.token}`, { name: 'Joãozinho Teste', birth_date: yearsAgo(12), cargo: 'desbravador', unit_id: unit })).status, 200, 'mesmo nome no mesmo clube pode (coincidência)');
  assert.equal((await anon('POST', `/inscricao/${on.token}`, { name: 'Pequeno Demais', birth_date: yearsAgo(8), cargo: 'desbravador', unit_id: unit })).status, 400);
  assert.equal((await anon('POST', `/inscricao/${on.token}`, { name: 'Menino Diretor', birth_date: yearsAgo(13), cargo: 'diretoria' })).status, 400, 'até 15 anos só desbravador');
  const dir = await anon('POST', `/inscricao/${on.token}`, { name: 'Ana Diretoria', birth_date: yearsAgo(30), cargo: 'diretoria' });
  assert.equal(dir.status, 200);
  assert.equal(dir.body.actor.role, 'Diretoria');
  const cons = await anon('POST', `/inscricao/${on.token}`, { name: 'Carlos Conselheiro', birth_date: yearsAgo(20), cargo: 'conselheiro', unit_id: unit });
  assert.equal(cons.status, 200);
  assert.equal(cons.body.actor.unit_id, unit);
  await club.put('/club/inscricao', { enabled: false });
  assert.equal((await anon('GET', `/inscricao/${on.token}`)).status, 404, 'link desligado');
  const novo = (await club.post('/club/inscricao/novo-link')).body;
  assert.notEqual(novo.token, on.token);
});

test('App Brasil: cria conta sem clube, precisa de plano, só ranking Brasil, apaga a conta', async () => {
  const geral = await login('membros', 'admin', 'admin123');
  const kid = await anon('POST', '/criar-conta', { name: 'Bruno Sem Clube', birth_date: yearsAgo(13) });
  assert.equal(kid.status, 200);
  assert.equal(kid.body.actor.club_name, 'Clube App Brasil');
  assert.equal(kid.body.actor.unit_name, 'Unidade App');
  assert.equal(kid.body.actor.app.locked, false, 'entra com 3 dias de DBV');
  const dias = (Date.parse(kid.body.actor.app.until) - Date.now()) / 864e5;
  assert.ok(dias > 2.9 && dias <= 3, '3 dias');
  assert.equal(kid.body.actor.plus, null, 'o DBV não libera o DBV+');
  assert.equal((await geral.del(`/admin/plus/${kid.body.actor.id}`)).status, 200, 'simula o fim dos 3 dias');
  const lider = (await anon('POST', '/criar-conta', { name: 'Carla Sem Clube', birth_date: yearsAgo(25) })).body.actor;
  assert.equal(lider.unit_name, 'Unidade App Liderança');
  const b = await login('membros', kid.body.code, kid.body.password);
  assert.equal((await b.post('/ano-biblico/dia/1/quiz', { answers: [0] })).status, 402, 'bloqueado até assinar');
  const plus = (await b.get('/plus')).body;
  assert.deepEqual(plus.plans.map((p) => [p.id, p.name, p.price_cents]), [['app', 'DBV', 390], ['plus', 'DBV+', 790]]);
  assert.equal((await b.post('/plus/assinar', { plan: 'plus3' })).status, 400, 'sem planos de especialidade');
  assert.equal((await geral.post('/admin/plus/dar', { code: kid.body.code, plan: 'app', days: 30 })).status, 200, 'dar plano');
  const b2 = await login('membros', kid.body.code, kid.body.password);
  assert.equal(b2.actor.app.locked, false);
  assert.equal(b2.actor.plus, null, 'DBV não é DBV+');
  assert.notEqual((await b2.post('/ano-biblico/dia/1/quiz', { answers: [0] })).status, 402);
  // Rankings: só o Brasil.
  const appClub = b2.actor.club_id;
  assert.ok((await b2.get('/rankings/members')).body.some((r) => r.id === b2.actor.id), 'está no ranking Brasil');
  assert.ok(!(await geral.get('/rankings/clubs?escopo=brasil')).body.some((c) => c.id === appClub), 'clube fora do ranking');
  assert.ok(!(await geral.get('/rankings/units?escopo=brasil')).body.some((u) => u.club_id === appClub), 'unidades fora do ranking');
  const sum = (await b2.get('/rankings/summary')).body;
  assert.ok(sum.app && sum.member_brasil && !sum.club && !sum.unit);
  assert.equal((await anon('GET', `/public/clubs/${appClub}`)).status, 404, 'clube não abre perfil');
  assert.ok(!(await anon('GET', '/public/districts')).body.some((d) => d.name.startsWith('App Brasil')));
  assert.equal((await geral.del(`/admin/clubs/${appClub}`)).status, 400, 'não apaga o Clube App Brasil');
  // Apagar a própria conta.
  assert.equal((await b2.post('/me/conta/apagar', { password: '0000' })).status, 400);
  assert.equal((await b2.post('/me/conta/apagar', { password: kid.body.password })).status, 200, 'apagar');
  const gone = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'membros', username: kid.body.code, password: kid.body.password }) });
  assert.notEqual(gone.status, 200, 'conta apagada');
});

test('admin apaga clube (o do distrito só os dele)', async () => {
  const geral = await login('membros', 'admin', 'admin123');
  const d = (await geral.get('/admin/districts')).body[0].id;
  const c = (await geral.post('/admin/clubs', { name: 'Para Apagar', district_id: d, director_name: 'Fulano Silva' })).body;
  assert.equal((await geral.del(`/admin/clubs/${c.id}`)).status, 200);
  assert.ok(!(await geral.get('/admin/clubs')).body.some((x) => x.id === c.id));
});
