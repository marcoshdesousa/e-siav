// Meditação Diária e Lição da Escola Sabatina (Estudo diário). Cada uma tem a sua sequência:
// o dia conta quando o membro faz no próprio dia e acerta o mínimo das perguntas. Cada dia
// concluído pela 1ª vez dá pontos no ranking (membro, unidade e clube) e 1 pacotinho.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { Router } from 'express';
import { all, get, run, PRIVATE_DIR } from '../db.js';
import { adminDistrict, requireAuth } from '../auth.js';
import { MAX_UPLOAD_MB } from '../config.js';
import { HttpError, ageFrom, fail, int, str, validDate } from '../util.js';
import { setting } from '../fees.js';
import { todayBR, todayDay } from '../bible.js';
import { audioOf } from '../audio.js';
import { awardStudyDay } from '../rankings.js';
import { bestDateStreak, dateStreak, giveBiblePack } from '../streaks.js';
import { testMode } from './learning.js';
import { FREE_AUDIOS, gatedAudio } from '../plus.js';

const r = Router();
const member = requireAuth('member');
const admin = requireAuth('admin');
const HERE = path.dirname(fileURLToPath(import.meta.url));

run(`CREATE TABLE IF NOT EXISTS meditation_progress (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  best INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  on_time INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, date)
)`);
run(`CREATE TABLE IF NOT EXISTS sabbath_pdfs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  file TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
run(`CREATE TABLE IF NOT EXISTS sabbath_lessons (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  pdf_id INTEGER REFERENCES sabbath_pdfs(id) ON DELETE SET NULL,
  page_from INTEGER,
  page_to INTEGER,
  youtube TEXT,
  questions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (category, date)
)`);
run(`CREATE TABLE IF NOT EXISTS sabbath_progress (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES sabbath_lessons(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  best INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  on_time INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, lesson_id)
)`);

const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const openDate = (date, today) => date <= today || testMode();

// ───────────── Meditação Diária ─────────────

/** As meditações (por MM-DD), juntadas dos arquivos da pasta. */
function loadMeditations() {
  const dir = path.join(HERE, '..', 'data', 'meditacao');
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    try {
      for (const m of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
        if (m?.date && m.title && Array.isArray(m.text) && Array.isArray(m.questions)) map.set(m.date, m);
      }
    } catch (e) {
      console.error(`[meditação] ${f} com erro:`, e.message);
    }
  }
  return map;
}
const MEDS = loadMeditations();
export const MED_PASS = 2; // acertos (de 3)
/** Tema do ano da Meditação Diária. */
export const MED_THEME = 'Os Escolhidos';
/** A meditação começa em 1/1/2027 (o admin pode mudar). */
export const medStart = () => setting('meditacao_inicio') || '2027-01-01';
/** Ano mostrado: o do início, ou o ano de hoje depois que começar. */
const medYear = (today) => Math.max(Number(medStart().slice(0, 4)), Number(today.slice(0, 4)));
const medOf = (date) => MEDS.get(date.slice(5));

const medRows = (memberId) => all('SELECT date, best, completed_at, on_time FROM meditation_progress WHERE member_id = ?', memberId);
export function meditationSummary(memberId, today = todayBR()) {
  const rows = medRows(memberId);
  const onTime = rows.filter((x) => x.on_time).map((x) => x.date);
  const todayMed = today >= medStart() ? medOf(today) : null;
  return {
    start: medStart(), today, streak: dateStreak(onTime, today), best_streak: bestDateStreak(onTime),
    done: rows.filter((x) => x.completed_at).length, today_title: todayMed?.title || null,
    today_done: rows.some((x) => x.date === today && x.completed_at), total: MEDS.size,
  };
}

r.get('/meditacao', member, (req, res) => {
  const today = todayBR();
  const year = medYear(today);
  const rows = new Map(medRows(req.actor.id).map((x) => [x.date, x]));
  const days = [];
  for (let d = `${year}-01-01`; d.startsWith(String(year)); d = addDays(d, 1)) {
    const m = medOf(d);
    if (!m || d < medStart()) continue;
    const row = rows.get(d);
    const status = row?.completed_at ? (row.on_time ? 'feito' : 'feito-depois') : d === today ? 'hoje' : d > today ? (testMode() ? 'teste' : 'futuro') : 'perdido';
    days.push({ date: d, title: m.title, personagem: m.personagem || null, status, best: row?.best || 0 });
  }
  res.json({ ...meditationSummary(req.actor.id, today), theme: MED_THEME, test: testMode(), days });
});

r.get('/meditacao/:date', member, (req, res) => {
  const date = String(req.params.date);
  const m = validDate(date) && medOf(date);
  if (!m) fail(404, 'Meditação não encontrada');
  const today = todayBR();
  if (!openDate(date, today) || (date < medStart() && !testMode())) fail(403, `Esta meditação libera no dia ${date.split('-').reverse().join('/')}.`);
  const row = get('SELECT best, completed_at, on_time FROM meditation_progress WHERE member_id = ? AND date = ?', req.actor.id, date);
  res.json({
    date, title: m.title, personagem: m.personagem || null, theme: MED_THEME, verse: m.verse, text: m.text, prayer: m.prayer || null, pass: MED_PASS,
    questions: m.questions.map((q) => ({ q: q.q, options: q.options })),
    best: row?.best || 0, completed: !!row?.completed_at, ...gatedAudio(req.actor.id, audioOf('meditacao', date.slice(5)), date.slice(5) <= `01-${String(FREE_AUDIOS).padStart(2, '0')}`),
  });
});

r.post('/meditacao/:date/quiz', member, (req, res) => {
  const date = String(req.params.date);
  const m = validDate(date) && medOf(date);
  if (!m) fail(404, 'Meditação não encontrada');
  const today = todayBR();
  if (!openDate(date, today)) fail(403, 'Esta meditação ainda não chegou');
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const score = m.questions.reduce((n, q, i) => n + (Number(answers[i]) === q.answer ? 1 : 0), 0);
  const passed = score >= MED_PASS;
  const before = get('SELECT completed_at FROM meditation_progress WHERE member_id = ? AND date = ?', req.actor.id, date);
  const first = passed && !before?.completed_at;
  const onTime = first && date === today ? 1 : 0;
  run(`INSERT INTO meditation_progress (member_id, date, best, attempts, completed_at, on_time) VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT (member_id, date) DO UPDATE SET best = max(best, excluded.best), attempts = attempts + 1,
      completed_at = COALESCE(completed_at, excluded.completed_at), on_time = max(on_time, excluded.on_time)`,
  req.actor.id, date, score, passed ? new Date().toISOString() : null, onTime);
  // Prêmio: só na 1ª vez e só em dia que já chegou (no modo de teste, dia futuro não pontua).
  const reward = first && date <= today;
  if (reward) giveBiblePack(req.actor.id);
  const points = reward ? awardStudyDay(req.actor.id, 'meditacao', date) : null;
  res.json({ score, total: m.questions.length, passed, pass: MED_PASS, first, on_time: !!onTime, pack: reward, points, correct: m.questions.map((q) => q.answer), ...meditationSummary(req.actor.id, today) });
});

r.get('/admin/meditacao', admin, (_req, res) => res.json({ start: medStart(), total: MEDS.size, audio: [...MEDS.keys()].filter((k) => audioOf('meditacao', k)).length }));

// ───────────── Lição da Escola Sabatina ─────────────

export const SS_CATEGORIES = [
  { id: 'juvenis', name: 'Juvenis', ages: '10 a 12 anos' },
  { id: 'adolescentes', name: 'Adolescentes', ages: '13 a 15 anos' },
  { id: 'jovens', name: 'Jovens', ages: '16 anos ou mais' },
];
const SS_IDS = SS_CATEGORIES.map((c) => c.id);
/** Categoria sugerida pela idade (todas ficam abertas para todos). */
export const ssCategoryFor = (birth) => {
  const a = ageFrom(birth);
  return a <= 12 ? 'juvenis' : a <= 15 ? 'adolescentes' : 'jovens';
};

// Trimestres prontos (server/data/escola-sabatina): as lições de cada dia (título, páginas e
// perguntas) já vêm prontas; falta só o administrador enviar o PDF da lição, que não fica no
// repositório. Enquanto o PDF não chega, as lições do trimestre não aparecem para os membros.
try { run('ALTER TABLE sabbath_lessons ADD COLUMN source TEXT'); } catch { /* já existe */ }
try { run('ALTER TABLE sabbath_pdfs ADD COLUMN quarter TEXT'); } catch { /* já existe */ }
const QUARTER_DIR = path.join(HERE, '..', 'data', 'escola-sabatina');
const QUARTERS = fs.existsSync(QUARTER_DIR)
  ? fs.readdirSync(QUARTER_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(QUARTER_DIR, f), 'utf8')))
  : [];
const quarterPdf = (key) => get('SELECT id FROM sabbath_pdfs WHERE quarter = ? ORDER BY id DESC LIMIT 1', key)?.id || null;
/** Cria ou atualiza as lições dos trimestres prontos (as criadas à mão pelo admin ficam como estão). */
function syncQuarters() {
  for (const qt of QUARTERS) {
    const pdf = quarterPdf(qt.key);
    for (const d of qt.days) {
      const row = get('SELECT id, source FROM sabbath_lessons WHERE category = ? AND date = ?', qt.category, d.date);
      const fields = [d.title, pdf, d.page_from, d.page_to, JSON.stringify(d.questions)];
      if (!row) run('INSERT INTO sabbath_lessons (title, pdf_id, page_from, page_to, questions, category, date, source) VALUES (?,?,?,?,?,?,?,?)', ...fields, qt.category, d.date, qt.key);
      else if (row.source === qt.key) run('UPDATE sabbath_lessons SET title = ?, pdf_id = ?, page_from = ?, page_to = ?, questions = ? WHERE id = ?', ...fields, row.id);
    }
  }
}
syncQuarters();
const ssQuestions = (l) => { try { return JSON.parse(l.questions) || []; } catch { return []; } };
const ssPass = (n) => Math.max(1, Math.ceil(n * 0.6));
const ssRows = (memberId) => all('SELECT lesson_id, date, best, completed_at, on_time FROM sabbath_progress WHERE member_id = ?', memberId);
export function sabbathSummary(memberId, today = todayBR()) {
  const rows = ssRows(memberId);
  const onTime = rows.filter((x) => x.on_time).map((x) => x.date);
  const lessons = get('SELECT COUNT(*) n FROM sabbath_lessons').n;
  return {
    today, streak: dateStreak(onTime, today), best_streak: bestDateStreak(onTime), done: rows.filter((x) => x.completed_at).length,
    today_done: rows.some((x) => x.date === today && x.completed_at && x.on_time), lessons,
  };
}

r.get('/escola-sabatina', member, (req, res) => {
  const today = todayBR();
  const rows = new Map(ssRows(req.actor.id).map((x) => [x.lesson_id, x]));
  const list = all(`SELECT id, category, date, title, youtube IS NOT NULL AS has_video FROM sabbath_lessons
    WHERE category IN (${SS_IDS.map(() => '?').join(',')}) AND (pdf_id IS NOT NULL OR youtube IS NOT NULL) ORDER BY date DESC, category`, ...SS_IDS).map((l) => {
    const row = rows.get(l.id);
    return { ...l, has_video: !!l.has_video, locked: !openDate(l.date, today), done: !!row?.completed_at, today: l.date === today };
  });
  res.json({ ...sabbathSummary(req.actor.id, today), test: testMode(), categories: SS_CATEGORIES, mine: ssCategoryFor(req.actor.birth_date), lessons: list });
});

function lessonOf(req) {
  const l = get('SELECT * FROM sabbath_lessons WHERE id = ?', int(req.params.id));
  if (!l || (!l.pdf_id && !l.youtube)) fail(404, 'Lição não encontrada');
  if (!openDate(l.date, todayBR())) fail(403, `Esta lição libera no dia ${l.date.split('-').reverse().join('/')}.`);
  return l;
}
r.get('/escola-sabatina/licao/:id', member, (req, res) => {
  const l = lessonOf(req);
  const row = get('SELECT best, completed_at FROM sabbath_progress WHERE member_id = ? AND lesson_id = ?', req.actor.id, l.id);
  const qs = ssQuestions(l);
  res.json({
    id: l.id, category: l.category, category_name: SS_CATEGORIES.find((c) => c.id === l.category)?.name, date: l.date, title: l.title,
    pdf: l.pdf_id ? `/api/escola-sabatina/pdf/${l.pdf_id}` : null, page_from: l.page_from, page_to: l.page_to, youtube: l.youtube || null,
    questions: qs.map((q) => ({ q: q.q, options: q.options })), pass: ssPass(qs.length), completed: !!row?.completed_at, best: row?.best || 0,
  });
});
r.post('/escola-sabatina/licao/:id/quiz', member, (req, res) => {
  const l = lessonOf(req);
  const today = todayBR();
  const qs = ssQuestions(l);
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const score = qs.reduce((n, q, i) => n + (Number(answers[i]) === q.answer ? 1 : 0), 0);
  const passed = score >= ssPass(qs.length);
  const before = get('SELECT completed_at FROM sabbath_progress WHERE member_id = ? AND lesson_id = ?', req.actor.id, l.id);
  const first = passed && !before?.completed_at;
  // Vale para a sequência a lição do dia de hoje (de qualquer categoria) feita hoje.
  const onTime = first && l.date === today ? 1 : 0;
  run(`INSERT INTO sabbath_progress (member_id, lesson_id, date, best, completed_at, on_time) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (member_id, lesson_id) DO UPDATE SET best = max(best, excluded.best),
      completed_at = COALESCE(completed_at, excluded.completed_at), on_time = max(on_time, excluded.on_time)`,
  req.actor.id, l.id, l.date, score, passed ? new Date().toISOString() : null, onTime);
  // Prêmio: uma vez por dia (mesmo fazendo lições de várias categorias no mesmo dia).
  const reward = first && l.date <= today;
  const points = reward ? awardStudyDay(req.actor.id, 'sabatina', l.date) : null;
  if (points) giveBiblePack(req.actor.id);
  res.json({ score, total: qs.length, passed, pass: ssPass(qs.length), first, on_time: !!onTime, pack: !!points, points, correct: qs.map((q) => q.answer), ...sabbathSummary(req.actor.id, today) });
});
r.get('/escola-sabatina/pdf/:id', requireAuth('member', 'admin'), (req, res) => {
  const p = get('SELECT file FROM sabbath_pdfs WHERE id = ?', int(req.params.id));
  if (!p) fail(404, 'Arquivo não encontrado');
  res.set('Content-Type', 'application/pdf');
  res.set('Cache-Control', 'private, max-age=604800');
  res.sendFile(path.join(PDF_DIR, p.file));
});

// Admin (geral): envia os PDFs e cria as lições de cada dia (categoria, páginas, vídeo e perguntas).
const PDF_DIR = path.join(PRIVATE_DIR, 'escola-sabatina');
fs.mkdirSync(PDF_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: PDF_DIR, filename: (_req, _f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + '.pdf') }),
  limits: { fileSize: Math.max(MAX_UPLOAD_MB, 60) * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => { const ok = file.mimetype === 'application/pdf'; cb(ok ? null : new HttpError(400, 'Envie o arquivo em PDF'), ok); },
});
r.get('/admin/escola-sabatina', admin, (_req, res) => {
  res.json({
    categories: SS_CATEGORIES,
    quarters: QUARTERS.map((qt) => ({ key: qt.key, name: qt.name, category: qt.category, days: qt.days.length, from: qt.days[0]?.date, to: qt.days.at(-1)?.date, pdf: !!quarterPdf(qt.key) })),
    pdfs: all('SELECT id, name, size, created_at FROM sabbath_pdfs ORDER BY id DESC'),
    lessons: all('SELECT l.*, p.name AS pdf_name, (SELECT COUNT(*) FROM sabbath_progress s WHERE s.lesson_id = l.id AND s.completed_at IS NOT NULL) AS done FROM sabbath_lessons l LEFT JOIN sabbath_pdfs p ON p.id = l.pdf_id ORDER BY l.date DESC, l.category')
      .map((l) => ({ ...l, questions: ssQuestions(l) })),
  });
});
r.post('/admin/escola-sabatina/pdfs', admin, upload.array('files', 10), (req, res) => {
  for (const f of req.files || []) run('INSERT INTO sabbath_pdfs (name, file, size) VALUES (?, ?, ?)', String(f.originalname || 'licao.pdf').slice(0, 120), f.filename, f.size);
  res.json({ ok: true });
});
// PDF de um trimestre pronto: liga o PDF a todas as lições do trimestre.
r.post('/admin/escola-sabatina/trimestres/:key/pdf', admin, upload.single('file'), (req, res) => {
  const qt = QUARTERS.find((x) => x.key === req.params.key);
  if (!qt) { if (req.file) fs.rm(req.file.path, { force: true }, () => {}); fail(404, 'Trimestre não encontrado'); }
  if (!req.file) fail(400, 'Envie o PDF da lição');
  run('INSERT INTO sabbath_pdfs (name, file, size, quarter) VALUES (?, ?, ?, ?)', qt.name.slice(0, 120), req.file.filename, req.file.size, qt.key);
  syncQuarters();
  res.json({ ok: true });
});
r.delete('/admin/escola-sabatina/pdfs/:id', admin, (req, res) => {
  const p = get('SELECT file FROM sabbath_pdfs WHERE id = ?', int(req.params.id));
  if (p) { fs.rm(path.join(PDF_DIR, p.file), { force: true }, () => {}); run('DELETE FROM sabbath_pdfs WHERE id = ?', int(req.params.id)); }
  res.json({ ok: true });
});
function lessonFields(b) {
  const category = SS_CATEGORIES.some((c) => c.id === b.category) ? b.category : fail(400, 'Escolha a categoria');
  if (!validDate(b.date)) fail(400, 'Informe o dia da lição');
  const title = str(b.title, 160) || fail(400, 'Informe o título');
  const pdf = b.pdf_id ? int(b.pdf_id) : null;
  if (pdf && !get('SELECT 1 FROM sabbath_pdfs WHERE id = ?', pdf)) fail(400, 'PDF inválido');
  const from = b.page_from ? int(b.page_from) : null;
  const to = b.page_to ? int(b.page_to) : from;
  if (from && to < from) fail(400, 'A página final vem depois da inicial');
  const yt = str(b.youtube, 300) || null;
  if (yt && !/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(yt)) fail(400, 'Link do YouTube inválido');
  const qs = (Array.isArray(b.questions) ? b.questions : []).map((q) => ({ q: str(q.q, 300), options: (q.options || []).map((o) => str(o, 200)).filter(Boolean), answer: int(q.answer) }));
  if (qs.length < 1 || qs.length > 5) fail(400, 'Crie de 1 a 5 perguntas');
  for (const q of qs) if (!q.q || q.options.length < 2 || q.answer < 0 || q.answer >= q.options.length) fail(400, 'Cada pergunta precisa de enunciado, opções e a resposta certa');
  if (!pdf && !yt) fail(400, 'A lição precisa do PDF ou do vídeo');
  return [category, b.date, title, pdf, from, to, yt, JSON.stringify(qs)];
}
r.post('/admin/escola-sabatina/licoes', admin, (req, res) => {
  const f = lessonFields(req.body);
  if (get('SELECT 1 FROM sabbath_lessons WHERE category = ? AND date = ?', f[0], f[1])) fail(400, 'Já existe lição dessa categoria nesse dia');
  const id = Number(run('INSERT INTO sabbath_lessons (category, date, title, pdf_id, page_from, page_to, youtube, questions) VALUES (?,?,?,?,?,?,?,?)', ...f).lastInsertRowid);
  res.json({ id });
});
r.put('/admin/escola-sabatina/licoes/:id', admin, (req, res) => {
  const f = lessonFields(req.body);
  run('UPDATE sabbath_lessons SET category = ?, date = ?, title = ?, pdf_id = ?, page_from = ?, page_to = ?, youtube = ?, questions = ? WHERE id = ?', ...f, int(req.params.id));
  res.json({ ok: true });
});
r.delete('/admin/escola-sabatina/licoes/:id', admin, (req, res) => {
  run('DELETE FROM sabbath_lessons WHERE id = ?', int(req.params.id));
  res.json({ ok: true });
});

// ───────────── Sequências: porcentagem de membros com a sequência em dia ─────────────
// "Em dia" = fez no próprio dia hoje ou ontem (a sequência ainda está valendo). O administrador
// geral vê todos os distritos; o de distrito, só os clubes dele.
r.get('/admin/sequencias', admin, (req, res) => {
  const d = adminDistrict(req.actor);
  const today = todayBR();
  const yesterday = addDays(today, -1);
  const t = todayDay();
  const members = all(`SELECT m.id, m.club_id, c.name AS club_name, c.district_id, di.name AS district_name
    FROM members m JOIN clubs c ON c.id = m.club_id JOIN districts di ON di.id = c.district_id
    WHERE m.status = 'ativo' ${d ? 'AND c.district_id = ?' : ''}`, ...(d ? [d] : []));
  const set = (rows) => new Set(rows.map((x) => x.member_id));
  const bible = set(all('SELECT DISTINCT member_id FROM bible_progress WHERE on_time = 1 AND day IN (?, ?)', t, t - 1));
  const med = set(all('SELECT DISTINCT member_id FROM meditation_progress WHERE on_time = 1 AND date IN (?, ?)', today, yesterday));
  const ss = set(all('SELECT DISTINCT member_id FROM sabbath_progress WHERE on_time = 1 AND date IN (?, ?)', today, yesterday));
  const groups = new Map();
  const add = (key, base, m) => {
    if (!groups.has(key)) groups.set(key, { ...base, members: 0, bible: 0, meditation: 0, sabbath: 0 });
    const g = groups.get(key);
    g.members++;
    if (bible.has(m.id)) g.bible++;
    if (med.has(m.id)) g.meditation++;
    if (ss.has(m.id)) g.sabbath++;
  };
  for (const m of members) {
    add(`c${m.club_id}`, { type: 'club', id: m.club_id, name: m.club_name, district_id: m.district_id, district_name: m.district_name }, m);
    add(`d${m.district_id}`, { type: 'district', id: m.district_id, name: m.district_name }, m);
  }
  const pct = (g) => ({ ...g, pct: { bible: g.members ? Math.round((g.bible / g.members) * 100) : 0, meditation: g.members ? Math.round((g.meditation / g.members) * 100) : 0, sabbath: g.members ? Math.round((g.sabbath / g.members) * 100) : 0 } });
  const list = [...groups.values()].map(pct);
  res.json({
    today, districts: list.filter((g) => g.type === 'district').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    clubs: list.filter((g) => g.type === 'club').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  });
});

export default r;
