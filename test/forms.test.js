// Formulários públicos: responder sem login (nome + clube) e o administrador geral vê as respostas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4700 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}/api`;
let server;
let dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-forms-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, JWT_SECRET: 'test', SEED_DEMO: '1', ADMIN_PASSWORD: 'admin123' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => String(d).includes('rodando') && resolve());
    server.on('exit', (c) => reject(new Error('server exited ' + c)));
  });
});
after(() => { server?.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const call = async (method, url, body, cookie) => {
  const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

test('formulário da avaliação 2026: responde sem login e o geral vê as respostas', async () => {
  const f = (await call('GET', '/public/formularios/avaliacao-2026')).body;
  assert.equal(f.questions.length, 6);
  assert.ok(f.clubs.includes('Clube Samuel Snow'));
  const ok = ['sim', 'nao', 'sim'];
  const answers = [5, 'Mais eventos', ...ok, 'Paz e união'];
  assert.equal((await call('POST', '/public/formularios/avaliacao-2026', { name: 'Maria Souza', club: '', answers })).status, 400, 'precisa do clube');
  assert.equal((await call('POST', '/public/formularios/avaliacao-2026', { name: 'Maria Souza', club: 'Clube Alfa', answers: [9, ...answers.slice(1)] })).status, 400, 'estrelas de 1 a 5');
  assert.equal((await call('POST', '/public/formularios/avaliacao-2026', { name: 'Maria Souza', club: 'Clube Alfa', answers })).status, 200);
  assert.equal((await call('POST', '/public/formularios/avaliacao-2026', { name: 'João Silva', club: 'Outro', club_other: 'Clube Pioneiros', answers })).status, 200);
  const login = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'membros', username: 'admin', password: 'admin123' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const list = (await call('GET', '/admin/formularios', null, cookie)).body;
  const form = list.find((x) => x.slug === 'avaliacao-2026');
  assert.equal(form.responses, 2);
  const res = (await call('GET', `/admin/formularios/${form.id}/respostas`, null, cookie)).body;
  assert.deepEqual(res.responses.map((r) => r.club).sort(), ['Clube Alfa', 'Clube Pioneiros']);
  // Encerrado: não recebe mais.
  await call('PUT', `/admin/formularios/${form.id}`, { active: false }, cookie);
  assert.equal((await call('POST', '/public/formularios/avaliacao-2026', { name: 'Ana Lima', club: 'Clube Alfa', answers })).status, 400);
  // Criar outro.
  const novo = (await call('POST', '/admin/formularios', { title: 'Campori 2027', clubs: ['Clube Alfa'], questions: [{ type: 'escolha', q: 'Qual dia?', options: ['Sexta', 'Sábado'] }] }, cookie)).body;
  assert.equal(novo.slug, 'campori-2027');
  assert.equal((await call('GET', '/admin/formularios')).status, 401, 'só o administrador');
});
