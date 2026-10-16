// Aprendizagem Diária (só membros): Ano Bíblico (leitura do dia + áudio + quiz, sequência e
// pacotinho do Álbum Bíblico por dia concluído) e Bom de Bíblia (200 fases de perguntas).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int, validDate } from '../util.js';
import { setSetting, setting } from '../fees.js';
import {
  PLAN, QUIZZES, TOTAL_DAYS, VOICE_RE, audioStatus, chapterText, chapterTitle, dateOfDay, dayVoiceStatus, planStart,
  rangesLabel, requestDayVoice, startAudioGenerator, todayBR, todayDay, verseNumbers, voiceFile, voiceName, voiceReady,
} from '../bible.js';

const r = Router();
const member = requireAuth('member');
const admin = requireAuth('admin');
const PASS = 3; // acertos (de 5) para concluir o dia
// Modo de teste (ligado até o admin desligar): todos os dias do Ano Bíblico e o Bom Líder ficam
// abertos para testar antes do lançamento.
export const testMode = () => setting('biblia_teste') !== '0';
const openDay = (day, t) => day <= t || testMode();
const BDB_PASS = 7; // acertos (de 10) para passar de fase

// ───────────── Ano Bíblico ─────────────

const doneDays = (memberId) => all('SELECT day, best, attempts, completed_at, on_time FROM bible_progress WHERE member_id = ?', memberId);

/** Sequência: dias seguidos concluídos no próprio dia, até hoje (hoje ainda sem fazer não quebra). */
function streakOf(rows, today = todayDay()) {
  const onTime = new Set(rows.filter((x) => x.on_time).map((x) => x.day));
  let d = Math.min(today, TOTAL_DAYS);
  if (!onTime.has(d)) d--;
  let n = 0;
  while (d >= 1 && onTime.has(d)) { n++; d--; }
  return n;
}
function bestStreakOf(rows) {
  const days = rows.filter((x) => x.on_time).map((x) => x.day).sort((a, b) => a - b);
  let best = 0;
  let cur = 0;
  days.forEach((d, i) => { cur = i && days[i - 1] === d - 1 ? cur + 1 : 1; best = Math.max(best, cur); });
  return best;
}

function bibleSummary(memberId) {
  const rows = doneDays(memberId);
  const t = todayDay();
  const done = rows.filter((x) => x.completed_at);
  const doneSet = new Set(done.map((x) => x.day));
  const missed = [];
  for (let d = 1; d < Math.min(t, TOTAL_DAYS + 1); d++) if (!doneSet.has(d)) missed.push(d);
  const todayPlan = t >= 1 && t <= TOTAL_DAYS ? PLAN.days[t - 1] : null;
  return {
    start: planStart(), end: dateOfDay(TOTAL_DAYS), today: todayBR(), today_day: t, total: TOTAL_DAYS,
    done: done.length, missed: missed.length, streak: streakOf(rows, t), best_streak: bestStreakOf(rows),
    today_label: todayPlan?.label || null, today_done: todayPlan ? doneSet.has(t) : false,
    all_done: done.length >= TOTAL_DAYS, rows, missedDays: missed,
  };
}

const dayStatus = (d, t, row) => {
  if (row?.completed_at) return row.on_time ? 'feito' : 'feito-depois';
  if (d > t) return testMode() ? 'teste' : 'futuro';
  return d === t ? 'hoje' : 'perdido';
};

// Resumo para o card "Sequência" do perfil e para a página da Aprendizagem Diária.
r.get('/aprendizagem', member, (req, res) => {
  const b = bibleSummary(req.actor.id);
  const bdb = get('SELECT COUNT(*) n FROM bdb_progress WHERE member_id = ? AND passed_at IS NOT NULL', req.actor.id).n;
  const { rows: _r, missedDays: _m, ...bible } = b;
  res.json({ bible, bdb: { passed: bdb, total: BDB.length }, leader: req.actor.kind === 'lideranca' || testMode(), test: testMode() });
});

r.get('/ano-biblico', member, (req, res) => {
  const b = bibleSummary(req.actor.id);
  const byDay = new Map(b.rows.map((x) => [x.day, x]));
  const { rows: _r, missedDays: _m, ...summary } = b;
  res.json({
    ...summary,
    test: testMode(),
    days: PLAN.days.map((d) => {
      const row = byDay.get(d.day);
      return { day: d.day, date: dateOfDay(d.day), label: d.label, status: dayStatus(d.day, b.today_day, row), best: row?.best || 0 };
    }),
  });
});

function planDay(n) {
  const d = PLAN.days[int(n) - 1];
  if (!d) fail(404, 'Dia não encontrado');
  return d;
}

r.get('/ano-biblico/dia/:n', member, (req, res) => {
  const d = planDay(req.params.n);
  const t = todayDay();
  if (!openDay(d.day, t)) fail(403, `Este dia ainda não chegou. Libera em ${dateOfDay(d.day).split('-').reverse().join('/')}.`);
  const row = get('SELECT best, attempts, completed_at, on_time FROM bible_progress WHERE member_id = ? AND day = ?', req.actor.id, d.day);
  const quiz = QUIZZES.get(d.day) || null;
  res.json({
    day: d.day, date: dateOfDay(d.day), label: d.label, status: dayStatus(d.day, t, row),
    best: row?.best || 0, attempts: row?.attempts || 0, completed: !!row?.completed_at, pass: PASS,
    // Cada capítulo: só os versículos do dia (nums = número de cada um) e o nome do áudio de cada um.
    chapters: d.chapters.map(([b, c, rg]) => {
      const nums = verseNumbers(b, c, rg);
      const text = chapterText(b, c);
      return {
        book: b, chapter: c, title: chapterTitle(b, c), part: rg ? `versículos ${rangesLabel(rg)}` : null,
        verses: nums.map((n) => text[n - 1]), nums,
        voice: { title: voiceName(b, c, 0), verses: nums.map((n) => voiceName(b, c, n)) },
      };
    }),
    voice: dayVoiceStatus(d.day),
    quiz: quiz ? quiz.map((q) => ({ q: q.q, options: q.options })) : null,
  });
});

r.post('/ano-biblico/dia/:n/quiz', member, async (req, res) => {
  const d = planDay(req.params.n);
  const t = todayDay();
  if (!openDay(d.day, t)) fail(403, 'Este dia ainda não chegou');
  const quiz = QUIZZES.get(d.day);
  if (!quiz) fail(400, 'O quiz deste dia ainda não está pronto');
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const score = quiz.reduce((n, q, i) => n + (Number(answers[i]) === q.answer ? 1 : 0), 0);
  const passed = score >= PASS;
  const before = get('SELECT best, completed_at FROM bible_progress WHERE member_id = ? AND day = ?', req.actor.id, d.day);
  const first = passed && !before?.completed_at;
  const onTime = first && d.day === t ? 1 : 0;
  run(`INSERT INTO bible_progress (member_id, day, best, attempts, completed_at, on_time) VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT (member_id, day) DO UPDATE SET best = max(best, excluded.best), attempts = attempts + 1,
      completed_at = COALESCE(completed_at, excluded.completed_at), on_time = max(on_time, excluded.on_time)`,
  req.actor.id, d.day, score, passed ? new Date().toISOString() : null, onTime);
  // Prêmio: 1 pacotinho do Álbum Bíblico por dia concluído (só na primeira vez).
  if (first) {
    run('INSERT OR IGNORE INTO album_progress (member_id, album) VALUES (?, ?)', req.actor.id, 'biblico');
    run('UPDATE album_progress SET packs_unopened = packs_unopened + 1 WHERE member_id = ? AND album = ?', req.actor.id, 'biblico');
  }
  // Ranking (Leitura bíblica): 100 pontos para o membro, 100 para a unidade e 25 para o clube, só na
  // primeira vez que conclui o dia. Dia futuro aberto no modo de teste não pontua.
  const { awardBibleDay } = await import('../rankings.js');
  const points = first && d.day <= t ? awardBibleDay(req.actor.id, d.day) : null;
  const b = bibleSummary(req.actor.id);
  res.json({
    score, total: quiz.length, passed, pass: PASS, best: Math.max(score, before?.best || 0), first, on_time: !!onTime, pack: first, points,
    correct: quiz.map((q) => q.answer), refs: quiz.map((q) => q.ref || null),
    streak: b.streak, done: b.done, all_done: b.all_done,
  });
});

// Voz do dia: põe os versículos do dia na frente da fila e diz quantos já estão prontos.
r.post('/ano-biblico/dia/:n/voz', member, (req, res) => {
  const d = planDay(req.params.n);
  if (!openDay(d.day, todayDay())) fail(403, 'Este dia ainda não chegou');
  res.json(requestDayVoice(d.day));
});
r.get('/ano-biblico/dia/:n/voz', member, (req, res) => res.json(dayVoiceStatus(planDay(req.params.n).day)));

r.get('/ano-biblico/voz/:name', member, (req, res) => {
  const name = String(req.params.name).replace(/\.mp3$/, '');
  if (!VOICE_RE.test(name) || !voiceReady(name)) fail(404, 'Áudio ainda sendo preparado');
  res.set('Cache-Control', 'private, max-age=2592000, immutable');
  res.type('audio/mpeg');
  res.sendFile(voiceFile(name));
});

// Admin: situação do áudio e dos quizzes, quem concluiu o Ano Bíblico (ganha o arganel) e data de início.
r.get('/admin/ano-biblico', admin, (req, res) => {
  const completers = all(`SELECT m.id, m.name, m.code, c.name AS club_name, u.name AS unit_name, MAX(p.completed_at) AS finished_at
    FROM bible_progress p JOIN members m ON m.id = p.member_id JOIN clubs c ON c.id = m.club_id LEFT JOIN units u ON u.id = m.unit_id
    WHERE p.completed_at IS NOT NULL GROUP BY m.id HAVING COUNT(*) >= ? ORDER BY finished_at`, TOTAL_DAYS);
  const bdbMedals = all(`SELECT m.id, m.name, m.code, c.name AS club_name, u.name AS unit_name, MAX(p.passed_at) AS finished_at
    FROM bdb_progress p JOIN members m ON m.id = p.member_id JOIN clubs c ON c.id = m.club_id LEFT JOIN units u ON u.id = m.unit_id
    WHERE p.passed_at IS NOT NULL GROUP BY m.id HAVING COUNT(*) >= ? ORDER BY finished_at`, BDB.length || 1);
  const readers = get('SELECT COUNT(DISTINCT member_id) n FROM bible_progress WHERE completed_at IS NOT NULL').n;
  res.json({
    start: planStart(), default_start: PLAN.start, end: dateOfDay(TOTAL_DAYS), total: TOTAL_DAYS, quizzes: QUIZZES.size,
    audio: audioStatus(), completers, readers, bdb: { phases: BDB.length, medals: bdbMedals }, test: testMode(),
  });
});

r.put('/admin/ano-biblico/inicio', admin, (req, res) => {
  const date = req.body.date || null;
  if (date && !validDate(date)) fail(400, 'Data inválida');
  setSetting('ano_biblico_inicio', date || '');
  res.json({ start: planStart() });
});

// Modo de teste: libera todos os dias do Ano Bíblico e o Bom Líder para todo mundo testar.
r.put('/admin/biblia-teste', admin, (req, res) => {
  setSetting('biblia_teste', req.body.on ? '1' : '0');
  res.json({ test: testMode() });
});

r.post('/admin/ano-biblico/audio', admin, (req, res) => {
  startAudioGenerator().catch(() => {});
  res.json(audioStatus());
});

// ───────────── Bom de Bíblia ─────────────

const HERE = path.dirname(fileURLToPath(import.meta.url));
function loadBdb() {
  const dir = path.join(HERE, '..', 'data', 'bom-de-biblia');
  const map = new Map();
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      try {
        for (const p of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
          const qs = (p.questions || []).filter((q) => q?.q && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer));
          if (qs.length >= 10) map.set(p.phase, { phase: p.phase, level: p.level, questions: qs.slice(0, 10) });
        }
      } catch (e) {
        console.error(`[bom de bíblia] ${f} com erro:`, e.message);
      }
    }
  }
  // Fases em sequência (1, 2, 3...): se faltar alguma, para ali.
  const out = [];
  for (let i = 1; map.has(i); i++) out.push(map.get(i));
  return out;
}
const BDB = loadBdb();
// 200 fases (antes eram 100): as fases antigas difíceis (51-75) viraram 101-125 e as muito
// difíceis (76-100) viraram 176-200. O progresso de quem já jogava muda junto, uma vez só.
if (BDB.length >= 200 && setting('bdb_v2') !== '1') {
  tx(() => {
    run('UPDATE bdb_progress SET phase = phase + 100 WHERE phase BETWEEN 76 AND 100');
    run('UPDATE bdb_progress SET phase = phase + 50 WHERE phase BETWEEN 51 AND 75');
    setSetting('bdb_v2', '1');
  });
}
export const BDB_SECONDS = 15;

const bdbRows = (memberId) => new Map(all('SELECT phase, best, attempts, passed_at FROM bdb_progress WHERE member_id = ?', memberId).map((x) => [x.phase, x]));
const unlocked = (rows, n) => n === 1 || !!rows.get(n - 1)?.passed_at;

r.get('/bom-de-biblia', member, (req, res) => {
  const rows = bdbRows(req.actor.id);
  const phases = BDB.map((p) => {
    const row = rows.get(p.phase);
    return { phase: p.phase, level: p.level, best: row?.best || 0, passed: !!row?.passed_at, locked: !unlocked(rows, p.phase) };
  });
  res.json({ phases, total: BDB.length, passed: phases.filter((p) => p.passed).length, medal: BDB.length > 0 && phases.every((p) => p.passed), pass: BDB_PASS, seconds: BDB_SECONDS });
});

function bdbPhase(req) {
  const p = BDB[int(req.params.n) - 1];
  if (!p) fail(404, 'Fase não encontrada');
  if (!unlocked(bdbRows(req.actor.id), p.phase)) fail(403, 'Passe a fase anterior primeiro');
  return p;
}

r.get('/bom-de-biblia/fase/:n', member, (req, res) => {
  const p = bdbPhase(req);
  res.json({ phase: p.phase, level: p.level, seconds: BDB_SECONDS, pass: BDB_PASS, questions: p.questions.map((q) => ({ q: q.q, options: q.options })) });
});

// Confere uma resposta (para mostrar na hora se acertou).
r.post('/bom-de-biblia/fase/:n/confere', member, (req, res) => {
  const p = bdbPhase(req);
  const q = p.questions[int(req.body.i)];
  if (!q) fail(400, 'Pergunta inválida');
  res.json({ answer: q.answer, ref: q.ref || null, right: Number(req.body.choice) === q.answer });
});

r.post('/bom-de-biblia/fase/:n', member, (req, res) => {
  const p = bdbPhase(req);
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const score = p.questions.reduce((n, q, i) => n + (Number(answers[i]) === q.answer ? 1 : 0), 0);
  const passed = score >= BDB_PASS;
  run(`INSERT INTO bdb_progress (member_id, phase, best, attempts, passed_at) VALUES (?, ?, ?, 1, ?)
    ON CONFLICT (member_id, phase) DO UPDATE SET best = max(best, excluded.best), attempts = attempts + 1,
      passed_at = COALESCE(passed_at, excluded.passed_at)`, req.actor.id, p.phase, score, passed ? new Date().toISOString() : null);
  const done = get('SELECT COUNT(*) n FROM bdb_progress WHERE member_id = ? AND passed_at IS NOT NULL', req.actor.id).n;
  res.json({ score, total: p.questions.length, passed, pass: BDB_PASS, medal: done >= BDB.length, next: passed && p.phase < BDB.length ? p.phase + 1 : null });
});

export default r;
