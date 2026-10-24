// Meditação Diária e Escola Sabatina: quiz, sequência, pontos e pacotinho.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = 4400 + Math.floor(Math.random() * 90);
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
    if (body instanceof FormData) opts.body = body;
    else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch(BASE + url, opts);
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { actor, get: (u) => call('GET', u), post: (u, b = {}) => call('POST', u, b), put: (u, b = {}) => call('PUT', u, b) };
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

test('meditação: abre por data, 2 de 3 acertos conta, dá ponto e pacotinho', async () => {
  const pedro = await login('membros', '100001');
  const list = (await pedro.get('/meditacao')).body;
  assert.ok(list.days.length >= 365, 'um ano de meditações');
  const d = (await pedro.get(`/meditacao/${today}`)).body;
  assert.equal(d.questions.length, 3);
  assert.ok(d.questions.every((q) => q.answer === undefined), 'a resposta não vai para o celular');
  const wrong = (await pedro.post(`/meditacao/${today}/quiz`, { answers: [9, 9, 9] })).body;
  assert.equal(wrong.passed, false);
  const right = (await pedro.post(`/meditacao/${today}/quiz`, { answers: wrong.correct })).body;
  assert.equal(right.passed, true);
  assert.equal(right.on_time, true);
  assert.equal(right.pack, true);
  assert.equal(right.points.member, 100);
  assert.equal(right.streak, 1);
  const again = (await pedro.post(`/meditacao/${today}/quiz`, { answers: wrong.correct })).body;
  assert.equal(again.pack, false, 'só ganha uma vez');
  const sum = (await pedro.get('/aprendizagem')).body;
  assert.equal(sum.meditation.streak, 1);
  assert.ok('sabbath' in sum && 'bible' in sum, 'as 3 sequências');
  assert.equal((await pedro.get('/meditacao/2026-13-40')).status, 404);
});

test('escola sabatina: admin cria a lição do dia; membro estuda e conta na sequência', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const pedro = await login('membros', '100001');
  const bad = await admin.post('/admin/escola-sabatina/licoes', { category: 'juvenis', date: today, title: 'Sem nada', questions: [{ q: 'a', options: ['x', 'y'], answer: 0 }] });
  assert.equal(bad.status, 400, 'precisa de PDF ou vídeo');
  const id = (await admin.post('/admin/escola-sabatina/licoes', {
    category: 'adolescentes', date: today, title: 'Lição de hoje', youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    questions: [{ q: 'Pergunta 1', options: ['certa', 'errada'], answer: 0 }, { q: 'Pergunta 2', options: ['errada', 'certa'], answer: 1 }],
  })).body.id;
  assert.ok(id);
  const hub = (await pedro.get('/escola-sabatina')).body;
  assert.deepEqual(hub.categories.map((c) => c.id), ['juvenis', 'adolescentes', 'jovens'], 'sem lição de adultos');
  assert.ok(hub.lessons.some((l) => l.id === id && l.has_video));
  const l = (await pedro.get(`/escola-sabatina/licao/${id}`)).body;
  assert.equal(l.pass, 2);
  const res = (await pedro.post(`/escola-sabatina/licao/${id}/quiz`, { answers: [0, 1] })).body;
  assert.equal(res.passed, true);
  assert.equal(res.streak, 1);
  assert.equal(res.pack, true);
  const st = (await admin.get('/admin/sequencias')).body;
  const club = st.clubs.find((c) => c.members > 0 && c.sabbath > 0);
  assert.ok(club && club.pct.sabbath > 0, 'porcentagem por clube');
});

test('escola sabatina: trimestre pronto dos jovens aparece mesmo sem PDF; com PDF mostra as páginas', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const pedro = await login('membros', '100001');
  const qt = (await admin.get('/admin/escola-sabatina')).body.quarters.find((q) => q.key === 'jovens-2026-4');
  assert.equal(qt.days, 91);
  assert.equal(qt.pdf, false);
  const before = (await pedro.get('/escola-sabatina')).body.lessons.filter((l) => l.category === 'jovens');
  assert.equal(before.length, 91, 'sem PDF, as lições já aparecem');
  const noPdf = (await pedro.get(`/escola-sabatina/licao/${before.find((l) => l.date === '2026-10-02').id}`)).body;
  assert.equal(noPdf.pdf, null);
  assert.deepEqual([noPdf.lesson, noPdf.lesson_title, noPdf.print_from, noPdf.print_to], [1, 'O Criador fala', 12, 14], 'páginas da revista');
  assert.deepEqual(noPdf.questions.map((q) => q.type), ['nota', 'texto'], 'todo dia: nota de 7 a 10 e o que aprendeu');
  const short = (await pedro.post(`/escola-sabatina/licao/${noPdf.id}/quiz`, { answers: [9, 'ok'] })).body;
  assert.equal(short.passed, false, 'precisa escrever pelo menos uma frase');
  const done = (await pedro.post(`/escola-sabatina/licao/${noPdf.id}/quiz`, { answers: [9, 'Aprendi que Deus continua falando comigo.'] })).body;
  assert.equal(done.passed, true);
  if (noPdf.pages.length) {
    assert.equal(noPdf.pages.length, 2, 'sexta: as páginas do dia, sem a do pequeno grupo');
    const img = await fetch(BASE.replace('/api', '') + noPdf.pages[0]);
    assert.equal(img.status, 401, 'página só para quem entrou');
  }
  const fd = new FormData();
  fd.append('file', new Blob(['%PDF-1.4 teste'], { type: 'application/pdf' }), 'licao.pdf');
  assert.equal((await admin.post('/admin/escola-sabatina/trimestres/jovens-2026-4/pdf', fd)).status, 200);
  const after = (await pedro.get('/escola-sabatina')).body.lessons.filter((l) => l.category === 'jovens');
  assert.equal(after.length, 91);
  const first = after.find((l) => l.date === '2026-09-26');
  const l = (await pedro.get(`/escola-sabatina/licao/${first.id}`)).body;
  assert.equal(l.title, 'O Criador fala');
  assert.equal(l.page_from, 3);
  assert.equal(l.questions.length, 2);
  assert.ok(l.pdf);
  if (l.pages.length) assert.equal(l.pages.length, 3, 'primeiro sábado: capa, apresentação e a lição');
});
