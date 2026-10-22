// Classes e Agrupadas: aulas em vídeo da classe Guia, quiz e aulas do DBV+.
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


test('classes: lista, aula grátis com quiz e pacotinho, aula do DBV+ trancada', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const pedro = await login('membros', '100001');
  const classes = (await pedro.get('/classes')).body;
  const guia = classes.find((c) => c.id === 'guia');
  assert.ok(guia.available && guia.total >= 4, 'a Guia tem aulas');
  assert.equal(classes.find((c) => c.id === 'amigo').available, false, 'as outras classes ficam em breve');
  const page = (await pedro.get('/classes/guia')).body;
  assert.equal(page.lessons[0].locked, false);
  assert.equal(page.lessons[3].locked, true, 'da 4ª em diante é do DBV+');
  const a1 = (await pedro.get('/classes/guia/aula/1')).body;
  assert.ok(a1.caderno.length && a1.quiz.length === 3 && a1.slides.length);
  assert.ok(a1.quiz.every((q) => q.answer === undefined), 'a resposta certa não vai para o celular');
  assert.ok(a1.paginas.length, 'páginas do caderno usadas na aula');
  const pg = await fetch(BASE.replace('/api', '') + a1.paginas[0].url, { headers: { cookie: pedro.cookie } });
  assert.equal(pg.status, 200);
  assert.match(pg.headers.get('content-type'), /image\/jpeg/);
  assert.equal((await fetch(BASE.replace('/api', '') + a1.paginas[0].url)).status, 401, 'só para quem entrou no app');
  const wrong = (await pedro.post('/classes/guia/aula/1/quiz', { answers: [9, 9, 9] })).body;
  assert.equal(wrong.passed, false);
  const right = (await pedro.post('/classes/guia/aula/1/quiz', { answers: wrong.correct })).body;
  assert.ok(right.passed && right.pack, 'concluiu e ganhou o pacotinho');
  assert.equal((await pedro.post('/classes/guia/aula/1/quiz', { answers: wrong.correct })).body.pack, false, 'pacotinho só uma vez');
  assert.equal((await pedro.get('/classes/guia/aula/4')).body.locked, true);
  assert.equal((await pedro.post('/classes/guia/aula/4/quiz', { answers: [0, 0, 0] })).status, 403);
  await admin.post('/admin/plus/dar', { code: '100001', plan: 'plus', days: 30 });
  assert.equal((await pedro.get('/classes/guia/aula/4')).body.locked, false, 'com DBV+ abre');
  assert.equal((await pedro.get('/classes/guia')).body.done, 1);
});
