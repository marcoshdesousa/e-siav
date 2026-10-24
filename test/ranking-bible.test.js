// Pontos da Leitura bíblica (Ano Bíblico) no ranking e ranking por distrito.
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
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, JWT_SECRET: 'test', SEED_DEMO: '1' },
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
  return { actor, get: (u) => call('GET', u), post: (u, b = {}) => call('POST', u, b), put: (u, b = {}) => call('PUT', u, b) };
}

const find = (rows, id) => rows.find((r) => r.id === id);

test('leitura bíblica: 100 membro, 100 unidade, 25 clube; só na 1ª vez; soma a cada dia', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const pedro = await login('membros', 'pedro');
  const { club_id: clubId, unit_id: unitId } = pedro.actor;
  assert.ok(unitId, 'pedro tem unidade');
  const start = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() - 2 * 86400000));
  assert.equal((await admin.put('/admin/ano-biblico/inicio', { date: start })).status, 200);

  const snap = async () => ({
    member: find((await pedro.get('/rankings/members')).body, pedro.actor.id),
    memberClub: find((await pedro.get(`/rankings/club/${clubId}/members`)).body, pedro.actor.id),
    unit: find((await pedro.get('/rankings/units')).body, unitId),
    unitClub: find((await pedro.get(`/rankings/club/${clubId}/units`)).body.rows, unitId),
    club: find((await pedro.get('/rankings/clubs')).body, clubId),
  });
  const s0 = await snap();
  assert.equal(s0.member.bible_points, 0);

  const wrong = (await pedro.post('/ano-biblico/dia/3/quiz', { answers: [9, 9, 9, 9, 9] })).body;
  assert.equal(wrong.passed, false);
  assert.equal(wrong.points, null, 'reprovar não pontua');
  const ok = (await pedro.post('/ano-biblico/dia/3/quiz', { answers: wrong.correct })).body;
  assert.ok(ok.passed && ok.first);
  assert.deepEqual(ok.points, { member: 100, unit: 100, club: 25, late: false });
  const again = (await pedro.post('/ano-biblico/dia/3/quiz', { answers: wrong.correct })).body;
  assert.equal(again.points, null, 'refazer o mesmo dia não pontua de novo');

  const s1 = await snap();
  assert.equal(s1.member.points - s0.member.points, 100);
  assert.equal(s1.member.bible_points, 100);
  assert.equal(s1.member.requirement_points, s0.member.requirement_points);
  assert.equal(s1.memberClub.points - s0.memberClub.points, 100, 'conta no ranking do clube também');
  assert.equal(s1.unit.points - s0.unit.points, 100);
  assert.equal(s1.unitClub.points - s0.unitClub.points, 100);
  assert.equal(s1.club.points - s0.club.points, 25);

  // Outro dia (atrasado) soma de novo, mas vale menos.
  const late = (await pedro.post('/ano-biblico/dia/1/quiz', { answers: [9] })).body;
  assert.deepEqual((await pedro.post('/ano-biblico/dia/1/quiz', { answers: late.correct })).body.points, { member: 20, unit: 20, club: 5, late: true });
  const s2 = await snap();
  assert.equal(s2.member.bible_points, 120);
  assert.equal(s2.unit.bible_points, 120);
  assert.equal(s2.club.bible_points, 30);
  assert.equal(s2.club.points - s0.club.points, 30);

  const sum = (await pedro.get('/rankings/summary')).body;
  assert.equal(sum.member.bible_points, 120);

  // Pausa do ranking: os pontos depois da pausa só aparecem quando o ranking volta.
  assert.equal((await pedro.put('/admin/ranking/pausa', { at: new Date().toISOString() })).status, 403);
  await new Promise((ok) => setTimeout(ok, 20));
  assert.equal((await admin.put('/admin/ranking/pausa', { at: new Date().toISOString() })).body.paused, true);
  await new Promise((ok) => setTimeout(ok, 20));
  const d2 = (await pedro.post('/ano-biblico/dia/2/quiz', { answers: [9] })).body;
  await pedro.post('/ano-biblico/dia/2/quiz', { answers: d2.correct });
  assert.equal(find((await pedro.get('/rankings/members')).body, pedro.actor.id).bible_points, 120, 'pausado não muda');
  assert.equal((await pedro.get('/rankings/estado')).body.paused, true);
  await admin.put('/admin/ranking/pausa', { at: null });
  assert.equal(find((await pedro.get('/rankings/members')).body, pedro.actor.id).bible_points, 140, 'voltou com os pontos');
  assert.equal(sum.district.id, pedro.actor.district_id);
  await admin.put('/admin/ano-biblico/inicio', { date: '' });
});

test('ranking por distrito: sem ranking geral; o administrador escolhe o distrito', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const pedro = await login('membros', 'pedro');
  const home = pedro.actor.district_id;
  const other = (await admin.post('/admin/districts', { name: 'Distrito Teste' })).body.id;
  const novo = (await admin.post('/admin/clubs', { name: 'Gaviões', district_id: other, director_name: 'Paulo Diretor' })).body;
  const gav = await login('clube', novo.code, novo.password);
  assert.equal(gav.actor.district_id, other);

  // Pedro só vê o próprio distrito, mesmo pedindo outro.
  const clubsHome = (await pedro.get(`/rankings/clubs?district_id=${other}`)).body;
  assert.ok(clubsHome.length && clubsHome.every((c) => c.district_id === home));
  assert.ok(!clubsHome.some((c) => c.id === novo.id));
  // O clube novo só vê o distrito dele (e não os desbravadores de Palmares).
  const clubsOther = (await gav.get('/rankings/clubs')).body;
  assert.deepEqual(clubsOther.map((c) => c.id), [novo.id]);
  assert.ok(!(await gav.get(`/rankings/members?district_id=${home}`)).body.some((m) => m.id === pedro.actor.id));
  // O administrador vê qualquer distrito.
  assert.deepEqual((await admin.get(`/rankings/clubs?district_id=${other}`)).body.map((c) => c.id), [novo.id]);
  assert.ok((await admin.get(`/rankings/members?district_id=${home}`)).body.some((m) => m.id === pedro.actor.id));
  // Perfil: posição no distrito.
  const prof = (await gav.get(`/rankings/summary`)).body;
  assert.equal(prof.club.position, 1);
});

test('ranking: só os 50 primeiros; quem está abaixo vê a própria posição exata', async () => {
  const pedro = await login('membros', 'pedro');
  const db = new DatabaseSync(path.join(dataDir, 'dbv.sqlite'));
  try {
    const ins = db.prepare("INSERT INTO members (club_id, unit_id, name, birth_date, cargo, code) VALUES (?, ?, ?, '2013-05-05', 'desbravador', ?)");
    const pts = db.prepare('INSERT INTO bible_points (member_id, day, unit_id, club_id) VALUES (?, ?, NULL, ?)');
    for (let i = 0; i < 60; i++) {
      const id = Number(ins.run(pedro.actor.club_id, null, `Teste ${i}`, String(900000 + i)).lastInsertRowid);
      for (let d = 1; d <= 9; d++) pts.run(id, d, pedro.actor.club_id);
    }
  } finally {
    db.close();
  }
  const rows = (await pedro.get('/rankings/members')).body;
  assert.equal(rows.length, 51);
  const mine = rows[50];
  assert.equal(mine.id, pedro.actor.id);
  assert.ok(mine.extra && mine.position > 60, 'posição exata de quem está fora do top 50');
  assert.equal(rows.filter((r) => r.position > 50).length, 1, 'não mostra o 51º, 52º...');
  assert.equal((await pedro.get('/rankings/summary')).body.member.position, mine.position);
});
