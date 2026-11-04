// Formulários públicos (fora do app, sem login): site/formulario/<link>. A pessoa põe o nome e o
// clube e responde. O administrador geral cria formulários, pega o link e vê as respostas.
import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth, requireGeneral } from '../auth.js';
import { fail, int } from '../util.js';

const r = Router();
const admin = [requireAuth('admin'), requireGeneral];

run(`CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  clubs TEXT NOT NULL DEFAULT '[]',
  questions TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
run(`CREATE TABLE IF NOT EXISTS form_responses (
  id INTEGER PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  club TEXT NOT NULL,
  answers TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
run('CREATE INDEX IF NOT EXISTS idx_form_responses_form ON form_responses(form_id)');
// Editar não muda o link nem mexe nas respostas: cada mudança nas perguntas vira uma versão nova, e
// cada resposta guarda a versão que a pessoa respondeu (quem já estava respondendo ainda consegue enviar).
run(`CREATE TABLE IF NOT EXISTS form_versions (
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  questions TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (form_id, version)
)`);
for (const [t, col, def] of [['forms', 'version', 'INTEGER NOT NULL DEFAULT 1'], ['form_responses', 'version', 'INTEGER NOT NULL DEFAULT 1']]) {
  if (!all(`PRAGMA table_info(${t})`).some((c) => c.name === col)) run(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`);
}

/** Cada pergunta tem um código fixo: mudar o texto mantém o código (e as respostas juntas no resumo). */
const newId = () => 'q' + Math.random().toString(36).slice(2, 8);
const validId = (id) => /^[a-z0-9]{2,12}$/.test(String(id || ''));
/** fresh: pergunta sem código ganha um novo (sorteado); senão (formulário antigo) q1, q2... */
const withIds = (qs, fresh = false) => {
  const seen = new Set();
  const given = new Set(qs.map((q) => q.id).filter(validId));
  return qs.map((q, i) => {
    let id = validId(q.id) && !seen.has(q.id) ? q.id : fresh ? newId() : `q${i + 1}`;
    while (seen.has(id) || (id !== q.id && given.has(id))) id = newId();
    seen.add(id);
    return { ...q, id };
  });
};
/** Formulários antigos: dá código às perguntas e guarda a versão 1. */
function ensureVersions() {
  for (const f of all('SELECT id, version, questions FROM forms')) {
    const qs = JSON.parse(f.questions);
    if (qs.some((q) => !q.id)) run('UPDATE forms SET questions = ? WHERE id = ?', JSON.stringify(withIds(qs)), f.id);
    const cur = get('SELECT questions FROM forms WHERE id = ?', f.id).questions;
    run('INSERT OR IGNORE INTO form_versions (form_id, version, questions) VALUES (?, ?, ?)', f.id, f.version, cur);
  }
}

/** Tipos de pergunta: estrelas (1 a 5), sim ou não, texto e escolha (uma das opções). */
const TYPES = ['estrelas', 'simnao', 'texto', 'escolha'];

// O primeiro formulário (pedido do dono do app): avaliação do Distrito Palmares 2026.
const CLUBS_PALMARES = ['Clube Titânio', 'Clube Alfa', 'Clube Querubins', 'Clube Astro de Luz', 'Clube Estrela Guia', 'Clube Samuel Snow'];
if (!get(`SELECT 1 FROM app_flags WHERE key = 'formulario-avaliacao-2026'`)) {
  run('INSERT OR IGNORE INTO forms (slug, title, description, clubs, questions) VALUES (?, ?, ?, ?, ?)',
    'avaliacao-2026', 'Avaliação do Distrito Palmares 2026',
    'A sua opinião ajuda a deixar o próximo ano ainda melhor. Leva só um minutinho!',
    JSON.stringify(CLUBS_PALMARES),
    JSON.stringify([
      { type: 'estrelas', q: 'Como você avalia a organização do Distrito Palmares em 2026?' },
      { type: 'texto', q: 'O que você espera do Distrito Palmares no ano de 2027?' },
      { type: 'simnao', q: 'Você quer um acampamento distrital ou um pernoite em 2027?' },
      { type: 'simnao', q: 'Você quer um carrossel de especialidades distrital em 2027?' },
      { type: 'simnao', q: 'Você quer uma Olimpíada distrital em 2027?' },
      { type: 'texto', q: 'O que você deseja para o Distrito Palmares?' },
    ]));
  run(`INSERT OR IGNORE INTO app_flags (key) VALUES ('formulario-avaliacao-2026')`);
}
ensureVersions();

const parse = (f) => f && { ...f, clubs: JSON.parse(f.clubs), questions: JSON.parse(f.questions), active: !!f.active };
const bySlug = (slug) => parse(get('SELECT * FROM forms WHERE slug = ?', String(slug)));

// ---------- Público ----------
r.get('/public/formularios/:slug', (req, res) => {
  const f = bySlug(req.params.slug);
  if (!f) fail(404, 'Formulário não encontrado');
  res.json({ slug: f.slug, title: f.title, description: f.description, clubs: f.clubs, questions: f.questions, version: f.version, active: f.active });
});

// Contra envio em massa: no máximo 20 respostas por hora do mesmo aparelho/rede.
const sentBy = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (sentBy.get(ip) || []).filter((t) => now - t < 3600e3);
  list.push(now);
  sentBy.set(ip, list);
  if (sentBy.size > 5000) sentBy.clear();
  return list.length > 20;
}

r.post('/public/formularios/:slug', (req, res) => {
  // Atrás do proxy do Render o IP de quem enviou vem no X-Forwarded-For.
  if (tooMany(String(req.headers['x-forwarded-for'] || req.ip).split(',')[0].trim())) fail(429, 'Muitas respostas daqui. Tente de novo mais tarde.');
  const f = bySlug(req.params.slug);
  if (!f) fail(404, 'Formulário não encontrado');
  if (!f.active) fail(400, 'Este formulário não está mais recebendo respostas');
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (name.length < 3) fail(400, 'Escreva o seu nome');
  let club = String(req.body.club || '').trim().slice(0, 80);
  if (club === 'Outro') club = String(req.body.club_other || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (club.length < 2) fail(400, 'Escolha o seu clube');
  const sent = Array.isArray(req.body.answers) ? req.body.answers : [];
  // Vale a versão que a pessoa abriu (se o formulário foi editado no meio, a resposta continua valendo).
  const v = get('SELECT version, questions FROM form_versions WHERE form_id = ? AND version = ?', f.id, int(req.body.version) || f.version)
    || { version: f.version, questions: JSON.stringify(f.questions) };
  const questions = JSON.parse(v.questions);
  const answers = questions.map((q, i) => {
    const a = sent[i];
    if (q.type === 'estrelas') {
      const n = int(a);
      if (!(n >= 1 && n <= 5)) fail(400, `Responda a pergunta ${i + 1} (de 1 a 5 estrelas)`);
      return n;
    }
    if (q.type === 'simnao') {
      if (a !== 'sim' && a !== 'nao') fail(400, `Responda a pergunta ${i + 1} (sim ou não)`);
      return a;
    }
    if (q.type === 'escolha') {
      if (!q.options?.includes(a)) fail(400, `Responda a pergunta ${i + 1}`);
      return a;
    }
    const t = String(a || '').trim().slice(0, 2000);
    if (!t) fail(400, `Responda a pergunta ${i + 1}`);
    return t;
  });
  run('INSERT INTO form_responses (form_id, name, club, answers, version) VALUES (?, ?, ?, ?, ?)', f.id, name, club, JSON.stringify(answers), v.version);
  res.json({ ok: true });
});

// ---------- Administrador geral ----------
r.get('/admin/formularios', ...admin, (_req, res) => {
  res.json(all(`SELECT f.*, (SELECT COUNT(*) FROM form_responses x WHERE x.form_id = f.id) AS responses,
      (SELECT MAX(created_at) FROM form_responses x WHERE x.form_id = f.id) AS last_at
    FROM forms f ORDER BY f.id DESC`).map(parse));
});

const slugify = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'formulario';

/** Confere o que vem da tela de criar/editar. */
function cleanForm(body) {
  const title = String(body.title || '').trim().slice(0, 100);
  if (title.length < 3) fail(400, 'Dê um título ao formulário');
  const clubs = (Array.isArray(body.clubs) ? body.clubs : []).map((c) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 40);
  const questions = withIds((Array.isArray(body.questions) ? body.questions : []).map((q) => ({
    id: q?.id,
    type: TYPES.includes(q?.type) ? q.type : 'texto',
    q: String(q?.q || '').trim().slice(0, 200),
    ...(q?.type === 'escolha' ? { options: (Array.isArray(q.options) ? q.options : []).map((o) => String(o).trim().slice(0, 80)).filter(Boolean).slice(0, 12) } : {}),
  })).filter((q) => q.q), true);
  if (!questions.length) fail(400, 'Coloque pelo menos uma pergunta');
  if (questions.some((q) => q.type === 'escolha' && q.options.length < 2)) fail(400, 'Pergunta de escolha precisa de pelo menos 2 opções');
  return { title, description: String(body.description || '').trim().slice(0, 400), clubs, questions };
}

r.post('/admin/formularios', ...admin, (req, res) => {
  const f = cleanForm(req.body);
  let slug = slugify(req.body.slug || f.title);
  for (let i = 2; get('SELECT 1 FROM forms WHERE slug = ?', slug); i++) slug = `${slugify(req.body.slug || f.title).slice(0, 36)}-${i}`;
  const id = Number(run('INSERT INTO forms (slug, title, description, clubs, questions) VALUES (?, ?, ?, ?, ?)',
    slug, f.title, f.description, JSON.stringify(f.clubs), JSON.stringify(f.questions)).lastInsertRowid);
  run('INSERT INTO form_versions (form_id, version, questions) VALUES (?, 1, ?)', id, JSON.stringify(f.questions));
  res.json(parse(get('SELECT * FROM forms WHERE id = ?', id)));
});

// Abrir ou fechar para novas respostas.
r.put('/admin/formularios/:id', ...admin, (req, res) => {
  const f = get('SELECT id FROM forms WHERE id = ?', int(req.params.id));
  if (!f) fail(404, 'Formulário não encontrado');
  run('UPDATE forms SET active = ? WHERE id = ?', req.body.active ? 1 : 0, f.id);
  res.json({ ok: true });
});

// Editar (mesmo recebendo respostas): título, texto, clubes e perguntas. O link não muda e as
// respostas que já existem continuam com as perguntas que foram respondidas.
r.put('/admin/formularios/:id/editar', ...admin, (req, res) => {
  const cur = parse(get('SELECT * FROM forms WHERE id = ?', int(req.params.id)));
  if (!cur) fail(404, 'Formulário não encontrado');
  const f = cleanForm(req.body);
  // Pergunta que mudou de tipo vira outra pergunta (as respostas antigas não se misturam).
  const before = new Map(cur.questions.map((q) => [q.id, q.type]));
  f.questions = f.questions.map((q) => (before.has(q.id) && before.get(q.id) !== q.type ? { ...q, id: newId() } : q));
  let { version } = cur;
  if (JSON.stringify(f.questions) !== JSON.stringify(cur.questions)) {
    version++;
    run('INSERT INTO form_versions (form_id, version, questions) VALUES (?, ?, ?)', cur.id, version, JSON.stringify(f.questions));
  }
  run('UPDATE forms SET title = ?, description = ?, clubs = ?, questions = ?, version = ? WHERE id = ?',
    f.title, f.description, JSON.stringify(f.clubs), JSON.stringify(f.questions), version, cur.id);
  res.json(parse(get('SELECT * FROM forms WHERE id = ?', cur.id)));
});

r.delete('/admin/formularios/:id', ...admin, (req, res) => {
  run('DELETE FROM forms WHERE id = ?', int(req.params.id));
  res.json({ ok: true });
});

r.get('/admin/formularios/:id/respostas', ...admin, (req, res) => {
  const f = parse(get('SELECT * FROM forms WHERE id = ?', int(req.params.id)));
  if (!f) fail(404, 'Formulário não encontrado');
  // Cada resposta vem com as perguntas da versão que a pessoa respondeu.
  const versions = new Map(all('SELECT version, questions FROM form_versions WHERE form_id = ?', f.id).map((v) => [v.version, JSON.parse(v.questions)]));
  const rows = all('SELECT id, name, club, answers, version, created_at FROM form_responses WHERE form_id = ? ORDER BY id DESC', f.id)
    .map((x) => ({ ...x, answers: JSON.parse(x.answers), questions: versions.get(x.version) || f.questions }));
  res.json({ form: f, responses: rows });
});

r.delete('/admin/formularios/:id/respostas/:rid', ...admin, (req, res) => {
  run('DELETE FROM form_responses WHERE id = ? AND form_id = ?', int(req.params.rid), int(req.params.id));
  res.json({ ok: true });
});

export default r;
