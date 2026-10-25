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

test('certificados: classe/especialidade e Ano Bíblico completo aparecem em Downloads', async () => {
  const pedro = await login('membros', 'pedro');
  const list = (await pedro.get('/me/certificados')).body;
  assert.ok(Array.isArray(list));
  const db = new DatabaseSync(path.join(dataDir, 'dbv.sqlite'));
  try {
    const total = JSON.parse(fs.readFileSync('server/data/ano-biblico-2027.json', 'utf8')).days.length;
    const ins = db.prepare(`INSERT OR IGNORE INTO bible_progress (member_id, day, best, attempts, completed_at, on_time) VALUES (?, ?, 5, 1, '2026-10-01T10:00:00Z', 1)`);
    for (let d = 1; d <= total; d++) ins.run(pedro.actor.id, d);
  } finally {
    db.close();
  }
  const after = (await pedro.get('/me/certificados')).body;
  assert.ok(after.some((c) => c.kind === 'ano-biblico'), 'certificado do Ano Bíblico');
  const cert = (await pedro.get('/me/certificados/ano-biblico/1')).body;
  assert.equal(cert.member_name, 'Pedro Henrique Lima');
  assert.match(cert.what, /Ano Bíblico|plano de leitura/);
  assert.equal((await pedro.get('/me/certificados/ano-biblico/2')).status, 404);
});

test('plano do clube: 30 dias ao começar; vencido depois da carência, os membros precisam do DBV; pagando, volta', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const aguias = await login('clube', 'aguias', 'AG2026');
  const st = (await aguias.get('/club/plano')).body;
  assert.ok(['ok', 'gratis'].includes(st.status.state), 'clube começa com o plano em dia');
  assert.deepEqual(st.plans.map((p) => [p.id, p.price_cents]), [['mensal', 1500]], 'só mensal');
  const setUntil = (iso) => {
    const db = new DatabaseSync(path.join(dataDir, 'dbv.sqlite'));
    try { db.prepare('UPDATE clubs SET paid_until = ? WHERE code = ?').run(iso, '4821'); } finally { db.close(); }
  };
  const month = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', month: '2-digit' }).format(new Date()));
  const free = month === 1 || month === 12;
  // Venceu ontem: carência (os membros ainda usam de graça).
  setUntil(new Date(Date.now() - 864e5).toISOString());
  let pedro = await login('membros', 'pedro');
  if (!free) assert.equal(pedro.actor.club_plan?.grace, true, 'carência de 3 dias');
  // Venceu há 10 dias: o membro precisa do DBV (R$ 3,90) ou do DBV+.
  setUntil(new Date(Date.now() - 10 * 864e5).toISOString());
  pedro = await login('membros', 'pedro');
  if (!free) {
    assert.equal(pedro.actor.club_plan?.expired, true);
    const plans = (await pedro.get('/plus')).body.plans.map((p) => p.id);
    assert.deepEqual(plans, ['app', 'plus'], 'aparece o DBV de R$ 3,90');
    if (!pedro.actor.plus) assert.equal((await pedro.post('/ano-biblico/dia/1/quiz', { answers: [0] })).status, 402);
  }
  // O portal do clube continua funcionando; o clube paga e volta para todos.
  await admin.put('/admin/pagamentos-config/pix', { key: 'pix@appdodbv.com', name: 'App do DBV', city: 'Palmares' });
  const pay = (await aguias.post('/club/plano/assinar', { plan: 'mensal' })).body;
  assert.equal(pay.amount_cents, 1500);
  assert.equal((await admin.post(`/admin/pagamentos/${pay.id}/confirmar`)).status, 200);
  assert.equal((await aguias.get('/club/plano')).body.status.state, free ? 'gratis' : 'ok');
  pedro = await login('membros', 'pedro');
  assert.equal(pedro.actor.club_plan, null, 'membros de volta ao grátis');
});

test('ranking por lugar: o clube reinicia e pausa o dele; o distrito não muda', async () => {
  const pedro = await login('membros', 'pedro');
  const aguias = await login('clube', 'aguias', 'AG2026');
  const admin = await login('membros', 'admin', 'admin123');
  const clubId = pedro.actor.club_id;
  const clubPts = async () => find((await pedro.get(`/rankings/club/${clubId}/members`)).body, pedro.actor.id).points;
  const distPts = async () => find((await pedro.get('/rankings/members')).body, pedro.actor.id).points;
  const d0 = await distPts();
  assert.ok((await clubPts()) > 0, 'tem pontos no clube');
  assert.equal((await aguias.put('/ranking/controle', { action: 'reset' })).status, 200);
  assert.equal(await clubPts(), 0, 'o ranking do clube recomeçou');
  assert.equal(await distPts(), d0, 'o do distrito continua igual');
  assert.equal((await aguias.put('/ranking/controle', { action: 'pause' })).body.paused, true);
  const st = (await pedro.get('/rankings/estado')).body.scopes.find((s) => s.key === `club:${clubId}`);
  assert.equal(st.paused, true, 'o membro vê o aviso de pausa do clube');
  await aguias.put('/ranking/controle', { action: 'resume' });
  // O geral pausa um distrito; o membro não mexe.
  assert.equal((await pedro.put('/ranking/controle', { action: 'pause' })).status, 403);
  assert.equal((await admin.put('/ranking/controle', { action: 'pause', district_id: pedro.actor.district_id })).body.paused, true);
  await admin.put('/ranking/controle', { action: 'resume', district_id: pedro.actor.district_id });
});

test('finalizar ranking: os 3 primeiros ganham medalha/troféu com o ano, todos veem a colocação e zera', async () => {
  const pedro = await login('membros', 'pedro');
  const aguias = await login('clube', 'aguias', 'AG2026');
  const admin = await login('membros', 'admin', 'admin123');
  const clubId = pedro.actor.club_id;
  const d = pedro.actor.district_id;
  const distRows = (await pedro.get('/rankings/members')).body;
  const me = find(distRows, pedro.actor.id);
  const units = (await pedro.get('/rankings/units')).body;
  const clubPts = async () => find((await pedro.get(`/rankings/club/${clubId}/members`)).body, pedro.actor.id).points;
  const c0 = await clubPts();
  // O administrador do distrito (aqui o geral) finaliza o distrito.
  const r = (await admin.put('/ranking/controle', { action: 'reset', district_id: d })).body;
  const winners = [...distRows, ...units].filter((x) => x.position <= 3 && x.points > 0).length;
  assert.ok(r.finished.awarded >= winners, 'os 3 primeiros com pontos ganharam');
  assert.ok((await pedro.get('/rankings/members')).body.every((x) => x.points === 0), 'o distrito zerou');
  assert.equal(await clubPts(), c0, 'o ranking do clube continua');
  const finais = (await pedro.get('/rankings/finais?novos=1')).body;
  const f = finais.find((x) => x.id === r.finished.id);
  const mine = f.places.find((p) => p.who === 'Você');
  assert.equal(mine.position, me.position, 'mostra a colocação');
  assert.equal(!!mine.prize, me.position <= 3 && me.points > 0);
  if (mine.prize) assert.match(mine.prize.icon, /^rank:membros:[123]$/);
  assert.equal(f.year, Number(new Date().toISOString().slice(0, 4)));
  // O primeiro do distrito tem a medalha no perfil, com o ano.
  const db = new DatabaseSync(path.join(dataDir, 'dbv.sqlite'), { readOnly: true });
  const top = distRows.find((x) => x.position === 1 && x.points > 0);
  if (top) {
    const aw = db.prepare(`SELECT m.name, a.year FROM medal_awards a JOIN medals m ON m.id = a.medal_id WHERE a.target_type = 'member' AND a.target_id = ? AND m.icon = 'rank:membros:1' AND m.name LIKE '%distrito'`).get(top.id);
    assert.equal(aw.name, 'Desbravador de Ouro do distrito');
    assert.equal(aw.year, f.year);
  }
  db.close();
  await pedro.post(`/rankings/finais/${f.id}/visto`);
  assert.ok(!(await pedro.get('/rankings/finais?novos=1')).body.some((x) => x.id === f.id), 'aparece uma vez');
  // O clube finaliza o dele; o Brasil não zera os outros.
  assert.ok((await aguias.put('/ranking/controle', { action: 'reset' })).body.finished, 'clube finaliza');
  assert.equal(await clubPts(), 0);
  assert.equal((await pedro.put('/ranking/controle', { action: 'reset' })).status, 403, 'membro não finaliza');
});

test('quem paga: clube pago (membros grátis), clube grátis + membros grátis, clube grátis + membros pagam (o clube pode assumir)', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const aguias = await login('clube', 'aguias', 'AG2026');
  const clubId = aguias.actor.id;
  const month = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', month: '2-digit' }).format(new Date()));
  const free = month === 1 || month === 12;
  const plansOf = async () => (await (await login('membros', 'pedro')).get('/plus')).body.plans.map((p) => p.id);
  // Clube grátis + membros grátis: nada para o clube pagar; o membro só vê o DBV+.
  assert.equal((await admin.put(`/admin/clubs/${clubId}`, { club_billing: 'gratis', member_billing: 'gratis' })).status, 200);
  assert.equal((await aguias.get('/club/plano')).body.status.state, 'gratis_sempre');
  assert.equal((await aguias.post('/club/plano/assinar', { plan: 'mensal' })).status, 400, 'clube grátis não tem cobrança');
  assert.deepEqual(await plansOf(), ['plus']);
  // Clube grátis + membros pagam: o membro precisa do DBV (R$ 3,90); o clube pode assumir.
  const db = new DatabaseSync(path.join(dataDir, 'dbv.sqlite'));
  try { db.prepare('UPDATE clubs SET paid_until = NULL WHERE id = ?').run(clubId); } finally { db.close(); }
  await admin.put(`/admin/clubs/${clubId}`, { member_billing: 'pago' });
  const st = (await aguias.get('/club/plano')).body.status;
  assert.equal(st.optional, true);
  if (!free) {
    assert.equal(st.state, 'membros_pagam');
    assert.equal((await login('membros', 'pedro')).actor.club_plan?.reason, 'membro_pago');
    assert.deepEqual(await plansOf(), ['app', 'plus']);
    const pay = (await aguias.post('/club/plano/assinar', { plan: 'mensal' })).body;
    assert.equal((await admin.post(`/admin/pagamentos/${pay.id}/confirmar`)).status, 200);
    assert.equal((await login('membros', 'pedro')).actor.club_plan, null, 'o clube assumiu: membros de graça');
  }
  // Clube pago em dia: o membro não vê a faixa do DBV+ (club_pays); clube grátis + membros grátis: vê.
  await admin.put(`/admin/clubs/${clubId}`, { club_billing: 'gratis', member_billing: 'gratis' });
  assert.equal((await login('membros', 'pedro')).actor.club_pays, false);
  await admin.put(`/admin/clubs/${clubId}`, { club_billing: 'pago' });
  await admin.post(`/admin/clubs/${clubId}/plano`, { days: 30 });
  assert.equal((await login('membros', 'pedro')).actor.club_pays, true);
  // Clube pago: os membros ficam sempre grátis (não dá para os dois pagarem).
  await admin.put(`/admin/clubs/${clubId}`, { club_billing: 'pago', member_billing: 'pago' });
  const list = (await admin.get('/admin/clubs')).body.find((c) => c.id === clubId);
  assert.equal(list.club_billing, 'pago');
  assert.equal(list.member_billing, 'gratis');
});

test('transferência: código + clube atual + motivo; o clube atual aceita; do App Brasil entra na hora', async () => {
  const leoes = await login('clube', 'leoes', 'LE2026');
  const aguias = await login('clube', 'aguias', 'AG2026');
  const db = new DatabaseSync(path.join(dataDir, 'dbv.sqlite'), { readOnly: true });
  let lucas;
  try { lucas = db.prepare(`SELECT m.code FROM members m JOIN clubs c ON c.id = m.club_id WHERE c.code = '4821' AND m.name LIKE 'Lucas%'`).get(); } finally { db.close(); }
  const ask = (b) => leoes.post('/club/transfers', b);
  assert.equal((await ask({ code: lucas.code, club_name: 'Águias', reason: 'x' })).status, 400, 'precisa do motivo');
  assert.equal((await ask({ code: lucas.code, club_name: 'Leões de Judá', reason: 'Mudou de cidade' })).status, 404, 'clube errado');
  const ok = await ask({ code: lucas.code, club_name: 'aguias do vale', reason: 'Mudou de cidade' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.app, false);
  assert.equal((await ask({ code: lucas.code, club_name: 'Águias', reason: 'De novo aqui' })).status, 409, 'um pedido por vez');
  const pend = (await aguias.get('/club/transfers')).body.received.find((t) => t.id === ok.body.id);
  assert.equal(pend.reason, 'Mudou de cidade');
  assert.equal((await aguias.post(`/club/transfers/${ok.body.id}/origem`, { accept: true })).status, 200);
  const moved = await login('membros', lucas.code);
  assert.equal(moved.actor.club_id, leoes.actor.id, 'agora é dos Leões');
  // Conta do App Brasil: quem aceita é o administrador geral (ou o do App).
  const r = await fetch(BASE + '/criar-conta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Nina Sem Clube', birth_date: `${new Date().getFullYear() - 12}-02-02`, handle: 'nina.semclube' }) });
  const app = (await r.json());
  const t = await ask({ code: app.code, club_name: 'Clube App Brasil', reason: 'Entrou no clube' });
  assert.equal(t.body.app, true);
  const admin = await login('membros', 'admin', 'admin123');
  assert.ok((await admin.get('/admin/app-transferencias')).body.some((x) => x.id === t.body.id), 'aparece para o administrador');
  assert.equal((await admin.post(`/admin/app-transferencias/${t.body.id}`, { accept: true })).status, 200);
  assert.equal((await login('membros', app.code)).actor.club_id, leoes.actor.id);
});
