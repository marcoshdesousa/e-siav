// Bom Líder (liderança): 50 aulas com leitura e perguntas (de marcar e de escrever).
// O admin envia as páginas do livro (fotos ou PDF); a partir delas o plano de aulas é montado
// e fica em server/data/bom-lider.json. Um link secreto deixa ler as páginas enviadas (para montar
// as aulas) sem precisar da senha do admin; o admin pode trocar o link quando quiser.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { Router } from 'express';
import { all, get, run, PRIVATE_DIR } from '../db.js';
import { requireAuth } from '../auth.js';
import { MAX_UPLOAD_MB } from '../config.js';
import { HttpError, fail, int } from '../util.js';
import { setSetting, setting } from '../fees.js';
import { testMode } from './learning.js';

const r = Router();
const member = requireAuth('member');
const admin = requireAuth('admin');

run(`CREATE TABLE IF NOT EXISTS bom_lider_pages (
  id INTEGER PRIMARY KEY,
  file TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
run(`CREATE TABLE IF NOT EXISTS bom_lider_progress (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  lesson INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  written TEXT,
  completed_at TEXT,
  PRIMARY KEY (member_id, lesson)
)`);

// ───────────── Páginas do livro (admin) ─────────────
const DIR = path.join(PRIVATE_DIR, 'bom-lider');
fs.mkdirSync(DIR, { recursive: true });
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'application/pdf': '.pdf' };
const upload = multer({
  storage: multer.diskStorage({
    destination: DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + (EXT[file.mimetype] || '.bin')),
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, cb) => {
    const ok = !!EXT[file.mimetype];
    cb(ok ? null : new HttpError(400, 'Envie fotos (JPG, PNG, WEBP) ou PDF'), ok);
  },
});

const pages = () => all('SELECT id, name, mime, size, created_at FROM bom_lider_pages ORDER BY id');
const token = () => setting('bom_lider_token');

r.get('/admin/bom-lider', admin, (_req, res) => {
  res.json({ pages: pages(), lessons: LESSONS.length, token: token(), test: testMode() });
});
r.post('/admin/bom-lider/paginas', admin, upload.array('files', 30), (req, res) => {
  for (const f of req.files || []) run('INSERT INTO bom_lider_pages (file, name, mime, size) VALUES (?, ?, ?, ?)', f.filename, String(f.originalname || f.filename).slice(0, 120), f.mimetype, f.size);
  res.json({ pages: pages() });
});
r.delete('/admin/bom-lider/paginas/:id', admin, (req, res) => {
  const p = get('SELECT file FROM bom_lider_pages WHERE id = ?', int(req.params.id));
  if (p) { fs.rm(path.join(DIR, p.file), { force: true }, () => {}); run('DELETE FROM bom_lider_pages WHERE id = ?', int(req.params.id)); }
  res.json({ pages: pages() });
});
function sendPage(res, id) {
  const p = get('SELECT file, mime FROM bom_lider_pages WHERE id = ?', int(id));
  if (!p) fail(404, 'Página não encontrada');
  res.set('Content-Type', p.mime);
  res.set('X-Content-Type-Options', 'nosniff');
  res.sendFile(path.join(DIR, p.file));
}
r.get('/admin/bom-lider/paginas/:id', admin, (req, res) => sendPage(res, req.params.id));
// Link secreto para ler as páginas (gera um novo e o antigo para de funcionar)
r.post('/admin/bom-lider/link', admin, (_req, res) => {
  setSetting('bom_lider_token', crypto.randomBytes(18).toString('base64url'));
  res.json({ token: token() });
});
const checkToken = (t) => { if (!token() || String(t) !== token()) fail(404, 'Link inválido'); };
r.get('/bom-lider/paginas/:token', (req, res) => {
  checkToken(req.params.token);
  res.json({ pages: pages().map((p) => ({ ...p, url: `/api/bom-lider/paginas/${req.params.token}/${p.id}` })) });
});
r.get('/bom-lider/paginas/:token/:id', (req, res) => { checkToken(req.params.token); sendPage(res, req.params.id); });

// ───────────── Aulas (membros) ─────────────
const HERE = path.dirname(fileURLToPath(import.meta.url));
function loadLessons() {
  const f = path.join(HERE, '..', 'data', 'bom-lider.json');
  if (!fs.existsSync(f)) return [];
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8')).filter((l) => l?.title && Array.isArray(l.questions));
  } catch (e) {
    console.error('[bom líder] aulas com erro:', e.message);
    return [];
  }
}
const LESSONS = loadLessons();
const canSee = (actor) => actor.kind === 'lideranca' || testMode();
const lessonRows = (memberId) => new Map(all('SELECT lesson, score, total, completed_at FROM bom_lider_progress WHERE member_id = ?', memberId).map((x) => [x.lesson, x]));

r.get('/bom-lider', member, (req, res) => {
  if (!canSee(req.actor)) fail(403, 'O Bom Líder é para a liderança (16 anos ou mais)');
  const rows = lessonRows(req.actor.id);
  const list = LESSONS.map((l, i) => {
    const row = rows.get(i + 1);
    return { n: i + 1, title: l.title, theme: l.theme || null, done: !!row?.completed_at, score: row?.score || 0, total: row?.total || 0, locked: i > 0 && !rows.get(i)?.completed_at };
  });
  res.json({ lessons: list, done: list.filter((x) => x.done).length, total: LESSONS.length, preparing: LESSONS.length === 0 });
});

function lessonOf(req) {
  if (!canSee(req.actor)) fail(403, 'O Bom Líder é para a liderança');
  const n = int(req.params.n);
  const l = LESSONS[n - 1];
  if (!l) fail(404, 'Aula não encontrada');
  if (n > 1 && !lessonRows(req.actor.id).get(n - 1)?.completed_at && !testMode()) fail(403, 'Termine a aula anterior primeiro');
  return { n, l };
}

r.get('/bom-lider/aula/:n', member, (req, res) => {
  const { n, l } = lessonOf(req);
  const row = get('SELECT score, total, written, completed_at FROM bom_lider_progress WHERE member_id = ? AND lesson = ?', req.actor.id, n);
  res.json({
    n, total: LESSONS.length, title: l.title, theme: l.theme || null, objective: l.objective || null, reading: l.reading || null,
    content: l.content || [], verse: l.verse || null, activity: l.activity || null,
    questions: l.questions.map((q) => (q.type === 'escrita' ? { type: 'escrita', q: q.q, min: q.min || 20 } : { type: 'escolha', q: q.q, options: q.options })),
    done: !!row?.completed_at, score: row?.score || 0, written: row?.written ? JSON.parse(row.written) : null,
  });
});

r.post('/bom-lider/aula/:n', member, (req, res) => {
  const { n, l } = lessonOf(req);
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  let score = 0;
  let total = 0;
  const written = {};
  l.questions.forEach((q, i) => {
    if (q.type === 'escrita') {
      const t = String(answers[i] ?? '').trim().slice(0, 3000);
      if (t.length < (q.min || 20)) fail(400, `Responda a pergunta ${i + 1} com as suas palavras (pelo menos ${q.min || 20} letras).`);
      written[i] = t;
    } else {
      total++;
      if (Number(answers[i]) === q.answer) score++;
    }
  });
  const pass = score >= Math.ceil(total * 0.6);
  run(`INSERT INTO bom_lider_progress (member_id, lesson, score, total, written, completed_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (member_id, lesson) DO UPDATE SET score = max(score, excluded.score), total = excluded.total, written = excluded.written,
      completed_at = COALESCE(completed_at, excluded.completed_at)`,
  req.actor.id, n, score, total, JSON.stringify(written), pass ? new Date().toISOString() : null);
  res.json({ score, total, passed: pass, correct: l.questions.map((q) => (q.type === 'escrita' ? null : q.answer)), next: pass && n < LESSONS.length ? n + 1 : null });
});

export default r;
