// Classes e Agrupadas (Estudo Diário): aulas em vídeo para cumprir o caderno da classe.
// Cada aula: vídeo, o que fazer no caderno e um quiz de 3 perguntas (2 acertos concluem a aula).
// As primeiras aulas de cada classe são grátis; as outras são do DBV+.
import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int } from '../util.js';
import { CLASSES, lessonsOf, pageFile, videoOf } from '../classLessons.js';
import { plusOpen } from '../plus.js';
import { giveBiblePack } from '../streaks.js';

const r = Router();
const member = requireAuth('member');

export const FREE_LESSONS = 3;
const PASS = 2;

run(`CREATE TABLE IF NOT EXISTS class_lesson_progress (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  classe TEXT NOT NULL,
  lesson INTEGER NOT NULL,
  best INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  PRIMARY KEY (member_id, classe, lesson)
)`);

const doneOf = (memberId, classe) => new Map(all('SELECT lesson, best, completed_at FROM class_lesson_progress WHERE member_id = ? AND classe = ?', memberId, classe).map((x) => [x.lesson, x]));
const open = (memberId, n) => n <= FREE_LESSONS || plusOpen(memberId);
const classOf = (id) => CLASSES.find((c) => c.id === id) || fail(404, 'Classe não encontrada');

r.get('/classes', member, (req, res) => {
  res.json(CLASSES.map((c) => {
    const total = lessonsOf(c.id).length;
    const done = total ? [...doneOf(req.actor.id, c.id).values()].filter((x) => x.completed_at).length : 0;
    return { ...c, total, done, available: total > 0 };
  }));
});

r.get('/classes/:id', member, (req, res) => {
  const c = classOf(req.params.id);
  const done = doneOf(req.actor.id, c.id);
  const lessons = lessonsOf(c.id).map((a) => ({
    n: a.n, titulo: a.titulo, secao: a.secao, duration: videoOf(c.id, a)?.duration || null,
    done: !!done.get(a.n)?.completed_at, locked: !open(req.actor.id, a.n), free: a.n <= FREE_LESSONS,
  }));
  res.json({ ...c, lessons, total: lessons.length, done: lessons.filter((l) => l.done).length, plus: plusOpen(req.actor.id), free: FREE_LESSONS });
});

const lessonOf = (classe, n) => lessonsOf(classe).find((a) => a.n === n) || fail(404, 'Aula não encontrada');

r.get('/classes/:id/aula/:n', member, (req, res) => {
  const c = classOf(req.params.id);
  const n = int(req.params.n);
  const a = lessonOf(c.id, n);
  const list = lessonsOf(c.id);
  const idx = list.indexOf(a);
  const base = { classe: c, n, titulo: a.titulo, secao: a.secao, requisito: a.requisito, objetivo: a.objetivo, total: list.length,
    prev: list[idx - 1]?.n ?? null, next: list[idx + 1]?.n ?? null };
  if (!open(req.actor.id, n)) return res.json({ ...base, locked: true });
  const row = get('SELECT best, completed_at FROM class_lesson_progress WHERE member_id = ? AND classe = ? AND lesson = ?', req.actor.id, c.id, n);
  res.json({
    ...base, locked: false, video: videoOf(c.id, a),
    slides: a.slides.map((s) => s.titulo || (s.tipo === 'versiculo' ? s.ref : '')),
    paginas: (a.paginas || []).map((p) => ({ p, url: `/api/classes/${c.id}/pagina/${p}` })),
    caderno: a.caderno, respostas: a.respostas || [], quiz: a.quiz.map((q) => ({ q: q.q, options: q.options })), pass: PASS,
    best: row?.best || 0, completed: !!row?.completed_at,
  });
});

r.post('/classes/:id/aula/:n/quiz', member, (req, res) => {
  const c = classOf(req.params.id);
  const n = int(req.params.n);
  const a = lessonOf(c.id, n);
  if (!open(req.actor.id, n)) fail(403, 'Esta aula é do DBV+');
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const score = a.quiz.reduce((s, q, i) => s + (Number(answers[i]) === q.answer ? 1 : 0), 0);
  const passed = score >= PASS;
  const before = get('SELECT best, completed_at FROM class_lesson_progress WHERE member_id = ? AND classe = ? AND lesson = ?', req.actor.id, c.id, n);
  const first = passed && !before?.completed_at;
  run(`INSERT INTO class_lesson_progress (member_id, classe, lesson, best, completed_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (member_id, classe, lesson) DO UPDATE SET best = MAX(best, excluded.best), completed_at = COALESCE(completed_at, excluded.completed_at)`,
  req.actor.id, c.id, n, score, passed ? new Date().toISOString() : null);
  // Aula concluída pela primeira vez: 1 pacotinho do Álbum Bíblico.
  if (first) giveBiblePack(req.actor.id);
  res.json({ score, total: a.quiz.length, passed, pass: PASS, pack: first, correct: a.quiz.map((q) => q.answer) });
});

// Páginas do caderno usadas nas aulas (só para membros que entraram no app).
r.get('/classes/:id/pagina/:p', member, (req, res) => {
  const c = classOf(req.params.id);
  const f = pageFile(c.id, int(req.params.p));
  if (!f) fail(404, 'Página não encontrada');
  res.set('Cache-Control', 'private, max-age=604800');
  res.sendFile(f);
});

export default r;
