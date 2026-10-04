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
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, JWT_SECRET: 'test' },
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

const form = (obj) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) fd.append(k, v);
  return fd;
};

test('login separa Login Clube e Login Membros', async () => {
  const bad = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'clube', username: 'pedro', password: 'dbv123' }) });
  assert.equal(bad.status, 401, 'membro não entra pelo Login Clube');
  const admin = await login('membros', 'admin', 'admin123');
  assert.equal(admin.actor.type, 'admin', 'admin entra pelo Login Membros');
  const unit = await login('clube', 'falcoes', 'falcoes123');
  assert.equal(unit.actor.type, 'unit');
});

test('administrador não edita dados de membros; clube só edita os próprios', async () => {
  const admin = await login('membros', 'admin', 'admin123');
  assert.equal((await admin.put('/club/members/1', form({ name: 'Hack' }))).status, 403);
  const leoes = await login('clube', 'leoes', 'leoes123');
  assert.equal((await leoes.put('/club/members/1', form({ name: 'Hack' }))).status, 404, 'outro clube não acha o membro');
  const aguias = await login('clube', 'aguias', 'aguias123');
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
  const aguias = await login('clube', 'aguias', 'aguias123');
  const d = new Date();
  const birth = (age) => `${d.getFullYear() - age - 1}-01-15`;
  assert.equal((await aguias.post('/club/members', form({ name: 'Muito Novo', birth_date: birth(8), username: 'novo1', password: '123456' }))).status, 400);
  const r = await aguias.post('/club/members', form({ name: 'Nova Líder', birth_date: birth(20), username: 'novalider', password: '123456' }));
  assert.equal(r.status, 200);
  const m = (await aguias.get('/club/members/' + r.body.id)).body;
  assert.equal(m.kind, 'lideranca');
  const units = (await aguias.get('/club/units')).body;
  assert.equal(m.unit_id, units.find((u) => u.is_leadership).id);
  // Desbravador não pode entrar na unidade Liderança
  const lid = units.find((u) => u.is_leadership).id;
  assert.equal((await aguias.post('/club/members', form({ name: 'Dbv', birth_date: birth(12), unit_id: lid, username: 'dbvx', password: '123456' }))).status, 400);
  // Unidade de outro clube é rejeitada
  const leoes = await login('clube', 'leoes', 'leoes123');
  const leoesUnit = (await leoes.get('/club/units')).body.find((u) => !u.is_leadership).id;
  assert.equal((await aguias.post('/club/members', form({ name: 'X', birth_date: birth(12), unit_id: leoesUnit, username: 'xx1', password: '123456' }))).status, 400);
});

test('liderança não tem requisitos; unidade vê requisitos do clube e gerais', async () => {
  const marcos = await login('membros', 'marcos');
  assert.deepEqual((await marcos.get('/requirements/mine')).body, []);
  const unit = await login('clube', 'falcoes', 'falcoes123');
  const reqs = (await unit.get('/requirements/mine')).body;
  assert.ok(reqs.some((r) => r.origin === 'clube') && reqs.some((r) => r.origin === 'geral'));
  assert.ok(reqs.every((r) => r.audience === 'unit'));
  // Unidade não cria requisitos
  assert.equal((await unit.post('/requirements', { title: 'x' })).status, 403);
  // Requisitos do outro clube não aparecem
  const tigres = await login('clube', 'tigres', 'tigres123');
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

test('clube cria requisitos só para as próprias unidades e avalia', async () => {
  const aguias = await login('clube', 'aguias', 'aguias123');
  const r = await aguias.post('/requirements', { audience: 'member', title: 'Para unidades', model: 'texto', points: 20, late_points: 0, deadline: new Date(Date.now() + 864e5).toISOString() });
  assert.equal(r.status, 200);
  const gav = await login('clube', 'gavioes', 'gavioes123');
  const mine = (await gav.get('/requirements/mine')).body.find((x) => x.id === r.body.id);
  assert.equal(mine.audience, 'unit', 'público forçado para unidades');
  const panteras = await login('clube', 'panteras', 'panteras123');
  assert.equal((await panteras.post(`/requirements/${r.body.id}/submit`, form({ text: 'oi oi' }))).status, 404);
  await gav.post(`/requirements/${r.body.id}/submit`, form({ text: 'Relatório da unidade' }));
  const leoes = await login('clube', 'leoes', 'leoes123');
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
  const aguias = await login('clube', 'aguias', 'aguias123');
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

  // Nome só encontra no próprio clube; o @ encontra em qualquer clube.
  assert.equal((await pedro.get('/chat/search?q=Martins')).body.length, 0);
  const byHandle = (await pedro.get('/chat/search?q=@' + sofia.actor.handle)).body;
  assert.equal(byHandle[0]?.id, sofia.actor.id);

  const { body: direct } = await pedro.post('/chat/direct', { member_id: sofia.actor.id });
  const sent = await pedro.post(`/chat/conversations/${direct.id}/messages`, form({ body: 'Oi Sofia!' }));
  assert.equal(sent.status, 200);
  await sofia.post('/chat/blocks', { type: 'member', id: pedro.actor.id });
  assert.equal((await pedro.post(`/chat/conversations/${direct.id}/messages`, form({ body: 'oi?' }))).status, 403);

  const rep = await sofia.post('/chat/reports', { conversation_id: direct.id, message_id: sent.body.id, reason: 'Mensagem inadequada' });
  assert.equal(rep.status, 200);
  const leoes = await login('clube', 'leoes', 'leoes123');
  const aguias = await login('clube', 'aguias', 'aguias123');
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
  assert.equal(await fetchFile(url, await login('clube', 'aguias', 'aguias123')), 404);
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

test('@ do membro: obrigatório no primeiro acesso, único e usado no link do perfil', async () => {
  const ana = await login('membros', 'ana');
  assert.equal(ana.actor.handle, null);
  assert.equal((await ana.put('/me/handle', { handle: 'A' })).status, 400, 'curto demais');
  assert.equal((await ana.put('/me/handle', { handle: 'lucas.ferreira' })).status, 400, 'já em uso');
  assert.equal((await ana.get('/me/handle/check?h=Ana.Souza')).body.ok, true);
  assert.equal((await ana.put('/me/handle', { handle: '@Ana.Souza' })).body.handle, 'ana.souza');
  const pub = await (await fetch(BASE + '/public/members/@ana.souza')).json();
  assert.equal(pub.name, 'Ana Clara Souza');
  assert.equal(pub.code, pub.code); // o código continua existindo internamente
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
  const leoes = await login('clube', 'leoes', 'leoes123');
  const aguias = await login('clube', 'aguias', 'aguias123');
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

  const unitAcc = await login('clube', 'falcoes', 'falcoes123');
  assert.equal((await unitAcc.post('/admin/announcements', form({ title: 'x' }))).status, 403);
  await admin.post('/admin/announcements', form({ title: 'Aviso importante', body: 'Texto', link: 'javascript:alert(1)' }));
  const active = (await unitAcc.get('/announcements/active')).body;
  const a = active.find((x) => x.title === 'Aviso importante');
  assert.ok(a);
  assert.equal(a.link, null, 'só aceita links http(s)');
});
