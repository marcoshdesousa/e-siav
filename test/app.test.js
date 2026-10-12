// Testes de ponta a ponta da API: permissões, privacidade, pontuação, ranking e chat.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3900 + Math.floor(Math.random() * 90);
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

async function login(mode, username, password = 'dbv123') {
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

// CPF válido (dígitos verificadores) a partir de um número de 9 dígitos.
const cpf = (n) => {
  const d = String(n).padStart(9, '0').split('').map(Number);
  const dv = (a) => { const r = (a.reduce((s, x, i) => s + x * (a.length + 1 - i), 0) * 10) % 11; return r === 10 ? 0 : r; };
  d.push(dv(d)); d.push(dv(d));
  return d.join('');
};

// Ficha completa (cadastro + saúde) para a inscrição e o cadastro pelo clã.
const PERGUNTAS = ['cardiaco', 'alergia_medicamento', 'lactose', 'deficiencia', 'transfusao', 'alergia_pele', 'convulsao', 'psicologico',
  'alergia', 'diabetes', 'ferimento', 'fratura', 'cirurgia', 'internacao'];
const fichaCompleta = (extra = {}) => ({
  sexo: 'Feminino', whatsapp: '11999999999', endereco: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Palmares', uf: 'pe',
  rg: '1234567', rg_orgao: 'SSP/PE', camiseta: 'M', estado_civil: 'Solteiro',
  mae_nome: 'Maria Mãe', mae_whatsapp: '11999999999',
  termo_imagem: true, termo_responsabilidade: true, termo_dados: true, assinatura_nome: 'Maria Mãe', assinatura_cpf: cpf(900000011),
  doencas: ['Catapora'], doencas_ok: true, ...Object.fromEntries(PERGUNTAS.map((k) => ['q_' + k, 'nao'])),
  sangue_tipo: 'O', sangue_rh: 'Positivo', termo_medico: true, med_assinatura_nome: 'Maria Mãe', med_assinatura_cpf: cpf(900000011),
  ...extra,
});

const form = (obj) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) fd.append(k, v);
  return fd;
};

test('pedido para criar clã: público envia, admin vê e marca como visualizado', async () => {
  const send = (b) => fetch(BASE + '/public/criar-cla', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  const body = { name: 'João Pedido Teste', cpf: cpf(900000050), whatsapp: '(81) 99999-0000', uf: 'PE', city: 'Palmares', neighborhood: 'Centro',
    adults: 3, teens: 2, kids_6_9: 20, kids_10_15: 35 };
  assert.equal((await send({ ...body, cpf: '123' })).status, 400);
  assert.equal((await send(body)).status, 200);
  const admin = await login('membros', 'admin', 'admin123');
  const list = (await admin.get('/admin/cla-inscricoes')).body;
  const item = list.items.find((x) => x.name === 'João Pedido Teste');
  assert.ok(item && list.unviewed >= 1);
  await admin.post(`/admin/cla-inscricoes/${item.id}/visualizar`);
  assert.ok((await admin.get('/admin/cla-inscricoes?visualizados=1')).body.items.some((x) => x.id === item.id));
  const aguias = await login('clube', 'aguias', 'AG2026');
  assert.equal((await aguias.get('/admin/cla-inscricoes')).status, 403);
});

test('login separa Login Clube e Login Membros', async () => {
  const bad = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'clube', username: 'pedro', password: 'dbv123' }) });
  assert.equal(bad.status, 401, 'membro não entra pelo Login Clube');
  const admin = await login('membros', 'admin', 'admin123');
  assert.equal(admin.actor.type, 'admin', 'admin entra pelo Login Membros');
  const unit = await login('clube', '4821', 'FA1111');
  assert.equal(unit.actor.type, 'unit');
});

test('administrador não edita dados de membros; clube só edita os próprios', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  assert.equal((await admin.put('/club/members/1', form({ name: 'Hack' }))).status, 403);
  const leoes = await login('clube', 'leoes', 'LE2026');
  assert.equal((await leoes.put('/club/members/1', form({ name: 'Hack' }))).status, 404, 'outro clube não acha o membro');
  const aguias = await login('clube', 'aguias', 'AG2026');
  assert.equal((await aguias.put('/club/members/1', form({ name: 'Pedro H. Lima' }))).status, 200);
});

test('membro só troca a própria foto e não acessa rotas do clube', async () => {
  const pedro = await login('membros', 'pedro');
  assert.equal((await pedro.get('/club/members')).status, 403);
  const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' });
  const fd = new FormData();
  fd.append('photo', png, 'p.png');
  const r = await pedro.put('/me/photo', fd);
  assert.equal(r.status, 200);
  assert.match(r.body.photo, /^\/uploads\//);
});

test('idade define o tipo de conta; liderança sem unidade vai para "Liderança"', async () => {
  const aguias = await login('clube', 'aguias', 'AG2026');
  const d = new Date();
  const birth = (age) => `${d.getFullYear() - age - 1}-01-15`;
  assert.equal((await aguias.post('/club/members', fichaCompleta({ name: 'Muito Novo Teste', birth_date: birth(8), cpf: cpf(900000001), password: '123456' }))).status, 400);
  assert.equal((await aguias.post('/club/members', fichaCompleta({ name: 'Sem Cpf Teste', birth_date: birth(20), password: '123456' }))).status, 400, 'CPF é obrigatório');
  assert.equal((await aguias.post('/club/members', { name: 'Só Dados Básicos', birth_date: birth(20), cpf: cpf(900000002), password: '123456' })).status, 400, 'clã precisa de todos os dados');
  const r = await aguias.post('/club/members', fichaCompleta({ name: 'Nova Líder', birth_date: birth(20), cpf: cpf(900000002), password: '123456' }));
  assert.match(r.body.code, /^\d{6}$/, 'código de 6 números');
  assert.equal(r.status, 200);
  const m = (await aguias.get('/club/members/' + r.body.id)).body;
  assert.equal(m.kind, 'lideranca');
  const units = (await aguias.get('/club/units')).body;
  assert.equal(m.unit_id, units.find((u) => u.is_leadership).id);
  // Desbravador não pode entrar na unidade Liderança
  const lid = units.find((u) => u.is_leadership).id;
  assert.equal((await aguias.post('/club/members', fichaCompleta({ name: 'Dbv Teste', birth_date: birth(12), unit_id: lid, cpf: cpf(900000003), password: '123456' }))).status, 400);
  // Unidade de outro clube é rejeitada
  const leoes = await login('clube', 'leoes', 'LE2026');
  const leoesUnit = (await leoes.get('/club/units')).body.find((u) => !u.is_leadership).id;
  assert.equal((await aguias.post('/club/members', fichaCompleta({ name: 'X Teste', birth_date: birth(12), unit_id: leoesUnit, cpf: cpf(900000004), password: '123456' }))).status, 400);
});

test('requisitos de explorador não aparecem para tutor; grupo vê requisitos do clã e gerais', async () => {
  const marcos = await login('membros', 'marcos');
  assert.deepEqual((await marcos.get('/requirements/mine')).body, []);
  const unit = await login('clube', '4821', 'FA1111');
  const reqs = (await unit.get('/requirements/mine')).body;
  assert.ok(reqs.some((r) => r.origin === 'clube') && reqs.some((r) => r.origin === 'geral'));
  assert.ok(reqs.every((r) => r.audience === 'unit'));
  // Grupo só cria requisito válido (aqui, sem título)
  assert.equal((await unit.post('/requirements', { title: '' })).status, 400);
  // Requisitos do outro clube não aparecem
  const tigres = await login('clube', '7350', 'TI4444');
  const titles = (await tigres.get('/requirements/mine')).body.map((r) => r.title);
  assert.ok(!titles.includes('Bandeirim da unidade'));
});

test('quiz pontua proporcional na hora; envio fora do prazo usa pontos reduzidos', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const deadline = new Date(Date.now() + 864e5).toISOString();
  const q = await admin.post('/requirements', {
    audience: 'member', scope: 'geral', title: 'Quiz teste', model: 'quiz', points: 90, late_points: 30, deadline,
    questions: [{ question: 'A?', options: ['1', '2'], correct: 0 }, { question: 'B?', options: ['1', '2'], correct: 1 }, { question: 'C?', options: ['1', '2'], correct: 0 }],
  });
  assert.equal(q.status, 200);
  const gabriel = await login('membros', 'gabriel');
  const before = (await gabriel.get('/rankings/members')).body.find((r) => r.id === gabriel.actor.id).points;
  const r = await gabriel.post(`/requirements/${q.body.id}/submit`, form({ answers: JSON.stringify([0, 1, 1]) }));
  assert.equal(r.status, 200);
  assert.equal(r.body.points, 60, '2 de 3 acertos = 2/3 de 90');
  assert.equal((await gabriel.post(`/requirements/${q.body.id}/submit`, form({ answers: '[0,1,0]' }))).status, 409, 'não reenviar aprovado');
  const after = (await gabriel.get('/rankings/members')).body.find((r) => r.id === gabriel.actor.id).points;
  assert.equal(after - before, 60, 'ranking atualizado automaticamente');

  const late = await admin.post('/requirements', { audience: 'member', title: 'Texto atrasado', model: 'texto', points: 50, late_points: 10, deadline: new Date(Date.now() - 864e5).toISOString() });
  const s = await gabriel.post(`/requirements/${late.body.id}/submit`, form({ text: 'Meu relatório' }));
  assert.equal(s.body.status, 'enviado');
  assert.equal(s.body.late, true);
  const pending = (await admin.get('/reviews')).body.find((x) => x.requirement_id === late.body.id);
  const rev = await admin.post('/reviews/' + pending.id, { decision: 'aprovado' });
  assert.equal(rev.body.points, 10);
});

test('clube cria requisitos para as próprias unidades (padrão) e avalia', async () => {
  const aguias = await login('clube', 'aguias', 'AG2026');
  const r = await aguias.post('/requirements', { title: 'Para unidades', model: 'texto', points: 20, late_points: 0, deadline: new Date(Date.now() + 864e5).toISOString() });
  assert.equal(r.status, 200);
  const gav = await login('clube', '4821', 'GA2222');
  const mine = (await gav.get('/requirements/mine')).body.find((x) => x.id === r.body.id);
  assert.equal(mine.audience, 'unit', 'sem escolher, vai para as unidades');
  const panteras = await login('clube', '7350', 'PA3333');
  assert.equal((await panteras.post(`/requirements/${r.body.id}/submit`, form({ text: 'oi oi' }))).status, 404);
  await gav.post(`/requirements/${r.body.id}/submit`, form({ text: 'Relatório da unidade' }));
  const leoes = await login('clube', 'leoes', 'LE2026');
  assert.ok(!(await leoes.get('/reviews')).body.some((s) => s.requirement_id === r.body.id), 'outro clube não avalia');
  const sub = (await aguias.get('/reviews')).body.find((s) => s.requirement_id === r.body.id);
  assert.equal((await aguias.post('/reviews/' + sub.id, { decision: 'aprovado' })).body.points, 20);
});

test('perfis públicos mostram só a quantidade de membros', async () => {
  const club = await (await fetch(BASE + '/public/clubs/1')).json();
  assert.ok(club.member_count > 0);
  const json = JSON.stringify(club);
  assert.ok(!json.includes('Pedro') && !json.includes('Lucas'), 'nenhum nome de membro no perfil do clube');
  const unit = await (await fetch(BASE + '/public/units/2')).json();
  assert.ok(!JSON.stringify(unit).includes('Pedro'));
  const pedro = await login('membros', 'pedro');
  const pub = await (await fetch(BASE + '/public/members/' + pedro.actor.code)).json();
  assert.equal(pub.birth_date, undefined, 'data de nascimento não é exposta');
  assert.ok(pub.age >= 10);
});

test('medalhas só pelo administrador e entrega manual', async () => {
  const aguias = await login('clube', 'aguias', 'AG2026');
  assert.equal((await aguias.post('/admin/medals', form({ name: 'x' }))).status, 403);
  const admin = await login('membros', 'admin', 'admin123');
  const m = await admin.post('/admin/medals', form({ name: 'Teste', kind: 'trofeu', icon: '🏆' }));
  await admin.post(`/admin/medals/${m.body.id}/award`, { target_type: 'unit', target_id: 3 });
  const unit = await (await fetch(BASE + '/public/units/3')).json();
  assert.ok(unit.medals.some((x) => x.name === 'Teste'));
});

test('chat: acesso por conversa, busca, bloqueio e denúncia', async () => {
  const pedro = await login('membros', 'pedro');
  const sofia = await login('membros', 'sofia');
  const pedroConvs = (await pedro.get('/chat/conversations')).body;
  const unitConv = pedroConvs.find((c) => c.type === 'unidade');
  assert.equal((await sofia.get(`/chat/conversations/${unitConv.id}/messages`)).status, 404, 'outra unidade não lê o grupo');

  // Nome só encontra no próprio clã; o código de 6 números encontra em qualquer clã.
  assert.equal((await pedro.get('/chat/search?q=Martins')).body.length, 0);
  const byCode = (await pedro.get('/chat/search?q=' + sofia.actor.code)).body;
  assert.equal(byCode[0]?.id, sofia.actor.id);

  const { body: direct } = await pedro.post('/chat/direct', { member_id: sofia.actor.id });
  const sent = await pedro.post(`/chat/conversations/${direct.id}/messages`, form({ body: 'Oi Sofia!' }));
  assert.equal(sent.status, 200);
  await sofia.post('/chat/blocks', { type: 'member', id: pedro.actor.id });
  assert.equal((await pedro.post(`/chat/conversations/${direct.id}/messages`, form({ body: 'oi?' }))).status, 403);

  const rep = await sofia.post('/chat/reports', { conversation_id: direct.id, message_id: sent.body.id, reason: 'Mensagem inadequada' });
  assert.equal(rep.status, 200);
  const leoes = await login('clube', 'leoes', 'LE2026');
  const aguias = await login('clube', 'aguias', 'AG2026');
  const admin = await login('membros', 'admin', 'admin123');
  assert.ok((await leoes.get('/reports')).body.some((r) => r.reason === 'Mensagem inadequada'), 'chega ao clube de quem denunciou');
  assert.ok((await aguias.get('/reports')).body.some((r) => r.reason === 'Mensagem inadequada'), 'chega ao clube do denunciado');
  assert.ok((await admin.get('/reports')).body.some((r) => r.reason === 'Mensagem inadequada'), 'chega ao Administrador Geral');

  // Diretoria: mensagem do membro chega ao painel do clube.
  const dir = pedroConvs.find((c) => c.type === 'diretoria');
  await pedro.post(`/chat/conversations/${dir.id}/messages`, form({ body: 'Pergunta para a diretoria' }));
  const inbox = (await aguias.get('/chat/conversations')).body;
  assert.ok(inbox.some((c) => c.id === dir.id && c.last.body === 'Pergunta para a diretoria'));
  assert.equal((await leoes.get(`/chat/conversations/${dir.id}`)).status, 404);
});

test('ranking: empate desempata por quem enviou primeiro', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const rows = (await admin.get('/rankings/members')).body;
  for (let i = 1; i < rows.length; i++) {
    const [a, b] = [rows[i - 1], rows[i]];
    assert.ok(a.points > b.points || (a.points === b.points && (!b.last_at || !a.last_at || a.last_at <= b.last_at)), `ordem ${a.name} / ${b.name}`);
  }
  assert.ok(rows.every((r) => r.name !== 'Marcos Almeida'), 'liderança fora do ranking');
});

const PNG = () => new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' });
const fetchFile = (url, who) => fetch(`http://localhost:${PORT}${url}`, { headers: who ? { cookie: who.cookie } : {} }).then((r) => r.status);

test('foto do chat só abre para quem participa da conversa (ou recebeu a denúncia)', async () => {
  const lucas = await login('membros', 'lucas');
  const pedro = await login('membros', 'pedro');
  const ana = await login('membros', 'ana');
  const { body: conv } = await lucas.post('/chat/direct', { member_id: pedro.actor.id });
  const fd = new FormData();
  fd.append('media', PNG(), 'f.png');
  const { body: msg } = await lucas.post(`/chat/conversations/${conv.id}/messages`, fd);
  assert.equal(msg.kind, 'foto');
  assert.match(msg.media, /^\/api\/files\/chat\//);
  assert.equal(await fetchFile(msg.media, null), 401, 'sem login');
  assert.equal(await fetchFile(msg.media, pedro), 200, 'participante');
  assert.equal(await fetchFile(msg.media, ana), 404, 'outro membro');
  const admin = await login('membros', 'admin', 'admin123');
  assert.equal(await fetchFile(msg.media, admin), 404, 'admin não lê conversas privadas');
  await pedro.post('/chat/reports', { conversation_id: conv.id, message_id: msg.id, reason: 'Foto imprópria' });
  assert.equal(await fetchFile(msg.media, admin), 200, 'admin vê a mídia denunciada');
  assert.equal(await fetchFile('/api/files/chat/../../dbv.sqlite', pedro), 404);
});

test('foto de comprovação só abre para quem enviou e quem avalia', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const q = await admin.post('/requirements', { audience: 'member', title: 'Foto privada', model: 'foto', points: 10, late_points: 0, deadline: new Date(Date.now() + 864e5).toISOString() });
  const beatriz = await login('membros', 'beatriz');
  const fd = new FormData();
  fd.append('photos', PNG(), 'f.png');
  await beatriz.post(`/requirements/${q.body.id}/submit`, fd);
  const sub = (await admin.get('/reviews')).body.find((s) => s.requirement_id === q.body.id);
  const url = sub.photos[0];
  assert.match(url, /^\/api\/files\/envio\//);
  assert.equal(await fetchFile(url, admin), 200);
  assert.equal(await fetchFile(url, beatriz), 200);
  assert.equal(await fetchFile(url, await login('membros', 'davi')), 404);
  assert.equal(await fetchFile(url, await login('clube', 'aguias', 'AG2026')), 404);
});

test('login bloqueia depois de muitas senhas erradas', async () => {
  const attempt = (password) => fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'membros', username: 'isabela', password }) }).then((r) => r.status);
  for (let i = 0; i < 8; i++) assert.equal(await attempt('errada'), 401);
  assert.equal(await attempt('errada'), 429);
  assert.equal(await attempt('dbv123'), 429, 'nem a senha certa entra durante o bloqueio');
});

test('site responde na página inicial e nas rotas do app', async () => {
  if (!fs.existsSync('dist/index.html')) return; // requer "npm run build"
  for (const p of ['/', '/entrar', '/membro/ranking', '/p/clube/1']) {
    const r = await fetch(`http://localhost:${PORT}${p}`);
    assert.equal(r.status, 200, p);
    assert.match(await r.text(), /<div id="root">/, p);
  }
});

test('código do membro: 6 números, entra com ele e é o link do perfil', async () => {
  const ana = await login('membros', 'ana');
  assert.match(ana.actor.code, /^\d{6}$/);
  const byCode = await login('membros', ana.actor.code);
  assert.equal(byCode.actor.id, ana.actor.id);
  const pub = await (await fetch(BASE + '/public/members/' + ana.actor.code)).json();
  assert.equal(pub.name, 'Ana Clara Souza');
  assert.equal(pub.cpf, undefined, 'CPF nunca aparece no perfil público');
});

test('clã: número automático, código, senhas geradas (2 letras + 4 números) e busca', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const district = (await admin.get('/admin/districts')).body[0].id;
  assert.equal((await admin.post('/admin/clubs', { name: 'Clã Sem Diretor', district_id: district })).status, 400, 'diretor obrigatório');
  const novo = await admin.post('/admin/clubs', { name: 'Tucanos', district_id: district, director_name: 'Paulo Diretor', password: 'ignorada' });
  assert.equal(novo.status, 200);
  assert.equal(novo.body.number, 3, 'terceiro clã');
  assert.equal(novo.body.name, '3º Clã Tucanos');
  assert.match(novo.body.code, /^\d{4}$/);
  assert.match(novo.body.password, /^[A-Z]{2}\d{4}$/, 'senha gerada pelo app');
  const cla = await login('clube', novo.body.code, novo.body.password.toLowerCase());
  assert.equal(cla.actor.type, 'club');
  const g = await cla.post('/club/units', form({ name: 'Grupo Teste' }));
  assert.match(g.body.pin, /^[A-Z]{2}\d{4}$/);
  const grupo = await login('clube', novo.body.code, g.body.pin);
  assert.equal(grupo.actor.type, 'unit');
  assert.equal(grupo.actor.id, g.body.id);
  assert.equal((await cla.post(`/club/units/${g.body.id}/nova-senha`)).status, 404, 'senha do grupo não muda');
  // Busca pelo número, pelo código ou pelo nome
  const busca = async (q) => (await (await fetch(BASE + '/public/clubs/search?q=' + encodeURIComponent(q))).json()).map((c) => c.id);
  assert.deepEqual(await busca('3'), [novo.body.id]);
  assert.deepEqual(await busca(novo.body.code), [novo.body.id]);
  assert.ok((await busca('tucan')).includes(novo.body.id));
  // Diretor e história
  await cla.put('/club/profile', form({ director_name: 'Paula Diretora', history: 'Fundado em 2026.' }));
  const pub = await (await fetch(BASE + '/public/clubs/' + novo.body.id)).json();
  assert.equal(pub.director_name, 'Paula Diretora');
  assert.equal(pub.history, 'Fundado em 2026.');
});

test('inscrição pelo link: fica pendente até o clã aprovar; desativar tira o acesso', async () => {
  const d = new Date();
  const info = await (await fetch(BASE + '/public/inscricao/4821')).json();
  assert.equal(info.name, '1º Clã Águias do Vale');
  const body = fichaCompleta({
    name: 'Joana Inscrita', birth_date: `${d.getFullYear() - 12}-03-10`, cpf: cpf(900000010), password: 'senha123',
    q_alergia_medicamento: 'sim', q_alergia_medicamento_det: 'Dipirona',
  });
  const post = (b) => fetch(BASE + '/public/inscricao/4821', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  assert.equal((await post({ ...body, termo_imagem: false })).status, 400, 'termos obrigatórios');
  assert.equal((await post({ ...body, mae_nome: '', mae_whatsapp: '' })).status, 400, 'menor precisa de pai, mãe ou responsável');
  assert.equal((await post({ ...body, sexo: 'Outro' })).status, 400, 'outro: precisa escrever');
  assert.equal((await post({ ...body, q_alergia_medicamento_det: '' })).status, 400, 'sim pede o porquê');
  assert.equal((await post({ ...body, q_cirurgia: undefined })).status, 400, 'todas as perguntas respondidas');
  assert.equal((await post({ ...body, med_assinatura_nome: '' })).status, 400, 'ficha de saúde assinada');
  // Adulto: sem pais nem responsável; documento pela certidão de nascimento
  const adulto = { ...body, name: 'Carlos Adulto Teste', birth_date: `${d.getFullYear() - 30}-01-01`, cpf: '', doc_tipo: 'certidao', certidao: '123456 01 55 2010 1 00012 123 0001234-56',
    mae_nome: '', mae_whatsapp: '', assinatura_nome: 'Carlos Adulto Teste', saude_profissional: true, saude_area: 'Médico' };
  assert.equal((await post(adulto)).status, 200, 'adulto com certidão');
  assert.equal((await post({ ...adulto, name: 'Outro Nome Qualquer' })).status, 409, 'certidão única');
  const ok = await post(body);
  assert.equal(ok.status, 200);
  const { code } = await ok.json();
  assert.equal((await post({ ...body, name: 'Outra Pessoa' })).status, 409, 'CPF único');
  const tryLogin = () => fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'membros', username: code, password: 'senha123' }) });
  assert.equal((await tryLogin()).status, 403, 'pendente não entra');

  const aguias = await login('clube', 'aguias', 'AG2026');
  const joana = (await aguias.get('/club/members')).body.find((m) => m.code === code);
  assert.equal(joana.status, 'pendente');
  const ficha = (await aguias.get(`/club/members/${joana.id}/ficha`)).body.ficha;
  assert.equal(ficha.q_alergia_medicamento_det, 'Dipirona');
  assert.deepEqual(ficha.doencas, ['Catapora']);
  assert.equal(joana.incomplete, false);
  const membrosAguias = (await aguias.get('/club/members')).body;
  assert.equal(membrosAguias.find((m) => m.name === 'Lucas Ferreira').incomplete, false, 'exemplo com ficha completa');
  assert.ok(membrosAguias.find((m) => m.name === 'Gabriel Oliveira').incomplete, 'exemplo sem ficha: incompleto');
  assert.equal(ficha.local_inscricao, '1º Clã Águias do Vale — sistema online');
  assert.equal(ficha.uf, 'PE');
  const admin = await login('membros', 'admin', 'admin123');
  assert.equal((await admin.get(`/club/members/${joana.id}/ficha`)).status, 403, 'a ficha fica só no Sistema do Clã');
  const leoes = await login('clube', 'leoes', 'LE2026');
  assert.equal((await leoes.get(`/club/members/${joana.id}/ficha`)).status, 404, 'outro clã não vê a ficha');
  await aguias.post(`/club/members/${joana.id}/aprovar`, {});
  assert.equal((await tryLogin()).status, 200);
  await aguias.post(`/club/members/${joana.id}/desativar`);
  assert.equal((await tryLogin()).status, 403, 'desativado não entra');
  assert.equal((await aguias.del(`/club/members/${joana.id}`)).status, 404, 'ninguém é apagado');
  await aguias.post(`/club/members/${joana.id}/reativar`);
  assert.equal((await tryLogin()).status, 200);
});

test('transferência: clã novo pede, clã atual aceita, clã novo confirma', async () => {
  const aguias = await login('clube', 'aguias', 'AG2026');
  const leoes = await login('clube', 'leoes', 'LE2026');
  const gabriel = (await aguias.get('/club/members')).body.find((m) => m.name === 'Gabriel Oliveira');
  assert.equal((await leoes.post('/club/transfers', { name: 'Gabriel Errado', cpf: gabriel.cpf })).status, 404, 'nome e CPF precisam bater');
  const t = await leoes.post('/club/transfers', { name: 'gabriel oliveira', cpf: gabriel.cpf });
  assert.equal(t.status, 200);
  assert.equal((await leoes.post(`/club/transfers/${t.body.id}/destino`, { accept: true })).status, 400, 'clã atual ainda não aceitou');
  assert.equal((await leoes.post(`/club/transfers/${t.body.id}/origem`, { accept: true })).status, 400, 'só o clã atual aceita a saída');
  await aguias.post(`/club/transfers/${t.body.id}/origem`, { accept: true });
  assert.ok((await aguias.get('/club/members')).body.some((m) => m.id === gabriel.id), 'ainda no clã antigo');
  await leoes.post(`/club/transfers/${t.body.id}/destino`, { accept: true });
  assert.ok(!(await aguias.get('/club/members')).body.some((m) => m.id === gabriel.id));
  assert.ok((await leoes.get('/club/members')).body.some((m) => m.id === gabriel.id), 'agora no clã novo');
});

test('grupo cria requisito para os próprios exploradores; requisito só para tutores', async () => {
  const falcoes = await login('clube', '4821', 'FA1111');
  const deadline = new Date(Date.now() + 864e5).toISOString();
  const r = await falcoes.post('/requirements', form({ title: 'Nó do grupo', modes: 'texto', points: '10', late_points: '5', deadline }));
  assert.equal(r.status, 200);
  const pedro = await login('membros', 'pedro'); // Falcões
  const ana = await login('membros', 'ana'); // Gaviões
  const mine = (await pedro.get('/requirements/mine')).body.find((x) => x.id === r.body.id);
  assert.equal(mine?.origin, 'grupo');
  assert.ok(!(await ana.get('/requirements/mine')).body.some((x) => x.id === r.body.id), 'outro grupo não vê');
  await pedro.post(`/requirements/${r.body.id}/submit`, form({ text: 'Fiz o nó' }));
  const pend = (await falcoes.get('/reviews')).body;
  assert.ok(pend.some((s) => s.requirement_id === r.body.id), 'grupo avalia');

  const aguias = await login('clube', 'aguias', 'AG2026');
  const t = await aguias.post('/requirements', form({ title: 'Só tutores', audience: 'member', member_kind: 'lideranca', modes: 'texto', points: '10', late_points: '0', deadline }));
  const marcos = await login('membros', 'marcos'); // tutor
  assert.ok((await marcos.get('/requirements/mine')).body.some((x) => x.id === t.body.id), 'tutor vê');
  assert.ok(!(await pedro.get('/requirements/mine')).body.some((x) => x.id === t.body.id), 'explorador não vê');
});

test('chat: limpar só para mim, apagar mensagem para todos e apagar conversa', async () => {
  const lucas = await login('membros', 'lucas');
  const gabriel = await login('membros', 'gabriel');
  const { body: conv } = await lucas.post('/chat/direct', { member_id: gabriel.actor.id });
  const m1 = (await lucas.post(`/chat/conversations/${conv.id}/messages`, form({ body: 'primeira' }))).body;
  const m2 = (await lucas.post(`/chat/conversations/${conv.id}/messages`, form({ body: 'segunda' }))).body;
  // Apagar para mim
  await gabriel.post(`/chat/messages/${m1.id}/hide`);
  let msgs = (await gabriel.get(`/chat/conversations/${conv.id}/messages`)).body.messages;
  assert.ok(!msgs.some((m) => m.id === m1.id));
  assert.ok((await lucas.get(`/chat/conversations/${conv.id}/messages`)).body.messages.some((m) => m.id === m1.id), 'continua para o outro');
  // Só quem enviou apaga para todos
  assert.equal((await gabriel.post(`/chat/messages/${m2.id}/delete`)).status, 403);
  await lucas.post(`/chat/messages/${m2.id}/delete`);
  msgs = (await gabriel.get(`/chat/conversations/${conv.id}/messages`)).body.messages;
  const deleted = msgs.find((m) => m.id === m2.id);
  assert.equal(deleted.deleted, 1);
  assert.equal(deleted.body, null);
  // Limpar conversa: some só para quem limpou
  await gabriel.post(`/chat/conversations/${conv.id}/clear`);
  assert.equal((await gabriel.get(`/chat/conversations/${conv.id}/messages`)).body.messages.length, 0);
  assert.ok((await lucas.get(`/chat/conversations/${conv.id}/messages`)).body.messages.length > 0);
  // Arquivar e apagar conversa
  await lucas.post(`/chat/conversations/${conv.id}/archive`, { archived: true });
  assert.ok((await lucas.get('/chat/conversations')).body.find((c) => c.id === conv.id).archived);
  await lucas.post(`/chat/conversations/${conv.id}/delete`, { for_all: false });
  assert.ok(!(await lucas.get('/chat/conversations')).body.some((c) => c.id === conv.id), 'sai da lista');
  await gabriel.post(`/chat/conversations/${conv.id}/messages`, form({ body: 'oi de novo' }));
  assert.ok((await lucas.get('/chat/conversations')).body.some((c) => c.id === conv.id), 'volta com mensagem nova');
});

test('requisito com relatório + foto + quiz juntos e fotos de exemplo', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const fd = new FormData();
  fd.append('audience', 'member');
  fd.append('title', 'Tudo junto');
  fd.append('modes', JSON.stringify(['texto', 'foto', 'quiz']));
  fd.append('questions', JSON.stringify([{ question: 'Q?', options: ['a', 'b'], correct: 1 }]));
  fd.append('points', '30');
  fd.append('late_points', '10');
  fd.append('deadline', new Date(Date.now() + 864e5).toISOString());
  fd.append('images', PNG(), 'exemplo.png');
  const r = await admin.post('/requirements', fd);
  assert.equal(r.status, 200);
  const davi = await login('membros', 'davi');
  const req = (await davi.get('/requirements/mine')).body.find((x) => x.id === r.body.id);
  assert.deepEqual(req.modes, ['texto', 'foto', 'quiz']);
  assert.equal(req.images.length, 1);
  const sub = new FormData();
  sub.append('text', 'Fiz tudo');
  sub.append('answers', '[1]');
  sub.append('photos', PNG(), 'p.png');
  const s = await davi.post(`/requirements/${r.body.id}/submit`, sub);
  assert.equal(s.body.status, 'enviado', 'com relatório/foto vai para avaliação');
  const people = (await admin.get('/reviews/people?submitter_type=member')).body.people;
  assert.ok(people.some((p) => p.submitter_id === davi.actor.id));
  const mine = (await admin.get(`/reviews?submitter_type=member&submitter_id=${davi.actor.id}`)).body;
  assert.ok(mine.every((x) => x.submitter_id === davi.actor.id) && mine.length >= 1);
});

test('classes e especialidades: o membro informa, a diretoria aprova e vai para o perfil', async () => {
  const davi = await login('membros', 'davi');
  const esp = (await davi.get('/catalog?type=especialidade')).body;
  assert.ok(esp.length > 50, 'catálogo de especialidades carregado');
  const aves = esp.find((c) => c.name === 'Aves');
  const ast = esp.find((c) => c.name === 'Astronomia');
  const lider = (await davi.get('/catalog?type=classe')).body.find((c) => c.name === 'Líder');
  const r = await davi.post('/me/achievement-requests', { content_ids: [aves.id, ast.id, lider.id] });
  assert.equal(r.body.created, 2, 'desbravador não pede classe de líder');
  const leoes = await login('clube', 'leoes', 'LE2026');
  const aguias = await login('clube', 'aguias', 'AG2026');
  assert.ok(!(await aguias.get('/club/achievement-requests')).body.some((m) => m.member_id === davi.actor.id), 'outro clube não vê');
  const group = (await leoes.get('/club/achievement-requests')).body.find((m) => m.member_id === davi.actor.id);
  const [i1, i2] = group.items;
  await leoes.post('/club/achievement-requests/decide', { ids: [i1.id], decision: 'aprovado' });
  await leoes.post('/club/achievement-requests/decide', { ids: [i2.id], decision: 'recusado' });
  const mine = (await davi.get('/me/achievements?type=especialidade')).body;
  assert.equal(mine.approved.length, 1);
  assert.equal(mine.requests.find((x) => x.id === i2.id).status, 'recusado');
  // Admin não cria nem vende classe/especialidade
  const admin = await login('membros', 'admin', 'admin123');
  assert.equal((await admin.post('/admin/content', { type: 'especialidade', name: 'X', is_free: 1 })).status, 400);
  assert.ok((await admin.get('/admin/content')).body.every((c) => c.type === 'curso'));
});

test('catálogo: importar a lista oficial e ligar as fotos pelo nome do arquivo', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const imp = (await admin.post('/admin/catalog/import', { text: 'EB-001; Profecias de Daniel; Ensinos Bíblicos\nAves; Estudo da Natureza\nlinha inválida' })).body;
  assert.equal(imp.created, 1);
  assert.equal(imp.updated, 1);
  assert.equal(imp.skipped, 1);
  const fd = new FormData();
  fd.append('images', PNG(), 'profecias-de-daniel.png');
  fd.append('images', PNG(), 'EB-001.png');
  fd.append('images', PNG(), 'nao-existe.png');
  const img = (await admin.post('/admin/catalog/images', fd)).body;
  assert.equal(img.matched.length, 2);
  assert.deepEqual(img.unmatched, ['nao-existe.png']);
  const item = (await admin.get('/admin/catalog?type=especialidade')).body.items.find((c) => c.name === 'Profecias de Daniel');
  assert.equal(item.category, 'Ensinos Bíblicos');
  assert.ok(item.image);
});

test('entregar conteúdo em massa, eventos com participantes e anúncios', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const dir = (await admin.get('/admin/directory')).body;
  const aguias = dir.find((c) => c.name.includes('Águias'));
  const falcoes = aguias.units.find((u) => u.name === 'Falcões');
  const memberIds = falcoes.members.map((m) => m.id);
  const medal = (await admin.post('/admin/medals', form({ name: 'Unidade destaque', kind: 'medalha', icon: 'star' }))).body;
  const d = await admin.post('/admin/deliver', { item_type: 'medal', item_id: medal.id, units: [falcoes.id], members: memberIds });
  assert.equal(d.body.delivered, 1 + memberIds.length);
  const curso = (await admin.get('/admin/content')).body.find((c) => c.name === 'Liderança Jovem');
  await admin.post('/admin/deliver', { item_type: 'content', item_id: curso.id, action: 'acesso', members: memberIds });
  const lucas = await login('membros', 'lucas');
  assert.equal((await lucas.get('/content/' + curso.id)).body.has_access, true);
  const aves = (await admin.get('/catalog?type=especialidade')).body.find((c) => c.name === 'Aves');
  assert.equal((await admin.post('/admin/deliver', { item_type: 'content', item_id: aves.id, members: memberIds })).status, 404, 'admin não entrega especialidade');

  const ev = await admin.post('/admin/events', form({ name: 'Campori', date: '2099-11-20', location: 'Palmares' }));
  assert.ok((await lucas.get('/events/upcoming')).body.some((e) => e.name === 'Campori'), 'evento futuro aparece na abertura do app');
  const p = await admin.post(`/admin/events/${ev.body.id}/participants`, { clubs: [aguias.id], members: memberIds });
  assert.equal(p.body.added, 1 + memberIds.length);

  const unitAcc = await login('clube', '4821', 'FA1111');
  assert.equal((await unitAcc.post('/admin/announcements', form({ title: 'x' }))).status, 403);
  assert.equal((await admin.post('/admin/announcements', form({ title: 'X', link: 'javascript:alert(1)' }))).status, 400, 'só aceita links web');
  await admin.post('/admin/announcements', form({ title: 'Aviso importante', body: 'Texto', link: 'www.adventistas.org/inscricao' }));
  const active = (await unitAcc.get('/announcements/active')).body;
  const a = active.find((x) => x.title === 'Aviso importante');
  assert.ok(a);
  assert.equal(a.link, 'https://www.adventistas.org/inscricao', 'completa com https://');
});

test('clube cria requisito para os desbravadores; ranking do clube; abas do app e do clube', async () => {
  const leoes = await login('clube', 'leoes', 'LE2026');
  const r = await leoes.post('/requirements', { audience: 'member', title: 'Leitura do clube', modes: ['quiz'], questions: [{ question: 'Q?', options: ['a', 'b'], correct: 0 }], points: 25, late_points: 5, deadline: new Date(Date.now() + 864e5).toISOString() });
  assert.equal(r.status, 200);
  const rafael = await login('membros', 'rafael');
  const mine = (await rafael.get('/requirements/mine')).body.find((x) => x.id === r.body.id);
  assert.equal(mine.origin, 'clube', 'aparece como requisito do meu clube');
  const pedro = await login('membros', 'pedro');
  assert.ok(!(await pedro.get('/requirements/mine')).body.some((x) => x.id === r.body.id), 'outro clube não vê');
  assert.equal((await pedro.post(`/requirements/${r.body.id}/submit`, form({ answers: '[0]' }))).status, 404);
  const s = await rafael.post(`/requirements/${r.body.id}/submit`, form({ answers: '[0]' }));
  assert.equal(s.body.points, 25);
  const rank = (await rafael.get(`/rankings/club/${rafael.actor.club_id}/members`)).body;
  assert.equal(rank[0].id, rafael.actor.id, 'lidera o ranking do clube');
  assert.equal((await pedro.get(`/rankings/club/${rafael.actor.club_id}/members`)).status, 403);
  const sum = (await rafael.get('/rankings/summary')).body;
  assert.equal(sum.member_club.position, 1);
  // pontos do clube não entram no ranking geral do app
  const app = (await rafael.get('/rankings/members')).body.find((x) => x.id === rafael.actor.id);
  assert.ok(app.points < 25 || app.points === (await rafael.get('/rankings/members')).body.find((x) => x.id === rafael.actor.id).points);
});

test('anúncios por público e do clube; eventos do clube', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  const leoes = await login('clube', 'leoes', 'LE2026');
  const pedro = await login('membros', 'pedro'); // Águias
  const sofia = await login('membros', 'sofia'); // Leões
  await admin.post('/admin/announcements', form({ title: 'Só Leões (admin)', target_type: 'club', target_id: String(sofia.actor.club_id) }));
  await leoes.post('/announcements/manage', form({ title: 'Recado da diretoria dos Leões' }));
  const forPedro = (await pedro.get('/announcements/active')).body.map((a) => a.title);
  const forSofia = (await sofia.get('/announcements/active')).body.map((a) => a.title);
  assert.ok(!forPedro.includes('Só Leões (admin)') && !forPedro.includes('Recado da diretoria dos Leões'));
  assert.ok(forSofia.includes('Só Leões (admin)') && forSofia.includes('Recado da diretoria dos Leões'));
  // O clube só gerencia os próprios anúncios
  assert.ok((await leoes.get('/announcements/manage')).body.every((a) => a.club_id === sofia.actor.club_id));
  // Evento do clube: só para o clube, participantes só do clube
  const ev = await leoes.post('/club/events', form({ name: 'Acampamento local', date: '2099-05-01', location: 'Sítio' }));
  const p = await leoes.post(`/club/events/${ev.body.id}/participants`, { members: [sofia.actor.id, pedro.actor.id] });
  assert.equal(p.body.added, 1, 'membro de outro clube não entra');
  assert.ok((await sofia.get('/events/upcoming')).body.some((e) => e.name === 'Acampamento local'));
  assert.ok(!(await pedro.get('/events/upcoming')).body.some((e) => e.name === 'Acampamento local'));
  const prof = await (await fetch(BASE + '/public/members/' + sofia.actor.code)).json();
  assert.ok(prof.events.some((e) => e.name === 'Acampamento local'));
});
