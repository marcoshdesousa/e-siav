import { Router } from 'express';
import { all, get, run, tx, nowIso } from '../db.js';
import { requireAuth } from '../auth.js';
import { imageUpload, fileUrl, privateImageUpload, privateUrl } from '../uploads.js';
import { modesOf, parseModes, legacyModel } from '../modes.js';
import { MAX_FOTOS_ENVIO } from '../config.js';
import { fail, int, str, parseJson } from '../util.js';

const r = Router();


/** Este requisito vale para esta conta? */
function applies(actor, req) {
  const audience = { club: 'club', unit: 'unit', member: 'member' }[actor.type];
  if (req.audience !== audience) return false;
  if (actor.type === 'member' && actor.kind !== 'desbravador') return false; // liderança não tem requisitos
  // Requisitos do clube: só para as unidades e os desbravadores daquele clube.
  if (req.creator_type === 'club') return req.club_id === actor.club_id && actor.type !== 'club';
  return req.scope === 'geral' || req.district_id === actor.district_id;
}

function stateOf(req, sub) {
  if (sub) return sub.status;
  return Date.parse(req.deadline) < Date.now() ? 'fora_do_prazo' : 'pendente';
}

const publicQuestions = (reqId) =>
  all('SELECT id, question, options FROM quiz_questions WHERE requirement_id = ? ORDER BY ord, id', reqId).map((q) => ({ ...q, options: JSON.parse(q.options) }));

function decorate(req, sub) {
  const modes = modesOf(req);
  return {
    ...req,
    modes,
    images: parseJson(req.images, []),
    origin: req.creator_type === 'admin' ? 'geral' : 'clube',
    questions: modes.includes('quiz') ? publicQuestions(req.id) : [],
    state: stateOf(req, sub),
    submission: sub ? { ...sub, photos: JSON.parse(sub.photos), answers: parseJson(sub.answers, null) } : null,
  };
}

// Requisitos que a conta logada precisa cumprir (clube, unidade ou desbravador).
r.get('/requirements/mine', requireAuth('club', 'unit', 'member'), (req, res) => {
  const a = req.actor;
  const rows = all('SELECT * FROM requirements ORDER BY deadline').filter((q) => applies(a, q));
  const out = rows.map((q) =>
    decorate(q, get('SELECT * FROM submissions WHERE requirement_id = ? AND submitter_type = ? AND submitter_id = ?', q.id, a.type, a.id)),
  );
  res.json(out);
});

r.post('/requirements/:id/submit', requireAuth('club', 'unit', 'member'), privateImageUpload.array('photos', MAX_FOTOS_ENVIO), (req, res) => {
  const a = req.actor;
  const q = get('SELECT * FROM requirements WHERE id = ?', int(req.params.id));
  if (!q || !applies(a, q)) fail(404, 'Requisito não encontrado');
  const existing = get('SELECT * FROM submissions WHERE requirement_id = ? AND submitter_type = ? AND submitter_id = ?', q.id, a.type, a.id);
  if (existing && existing.status !== 'recusado') fail(409, 'Este requisito já foi enviado');

  const text = str(req.body.text, 5000);
  const photos = (req.files || []).map((f) => privateUrl('envio', f));
  const modes = modesOf(q);
  if (modes.includes('texto') && text.length < 3) fail(400, 'Escreva o relatório');
  if (modes.includes('foto') && !photos.length) fail(400, 'Envie pelo menos uma foto');

  let correct = null, total = null, answers = null;
  if (modes.includes('quiz')) {
    const questions = all('SELECT id, correct FROM quiz_questions WHERE requirement_id = ? ORDER BY ord, id', q.id);
    answers = parseJson(req.body.answers, []);
    if (!Array.isArray(answers) || answers.length !== questions.length) fail(400, 'Responda todas as perguntas');
    total = questions.length;
    correct = questions.filter((qq, i) => Number(answers[i]) === qq.correct).length;
  }

  const now = nowIso();
  const late = Date.parse(q.deadline) < Date.now() ? 1 : 0;
  const base = late ? q.late_points : q.points;
  // Só quiz: nota proporcional calculada na hora. Com relatório ou foto: aguarda avaliação.
  const onlyQuiz = modes.length === 1 && modes[0] === 'quiz';
  const status = onlyQuiz ? 'aprovado' : 'enviado';
  const points = onlyQuiz ? Math.round((base * correct) / total) : 0;

  tx(() => {
    if (existing) run('DELETE FROM submissions WHERE id = ?', existing.id);
    run(
      `INSERT INTO submissions (requirement_id, submitter_type, submitter_id, text, photos, answers, quiz_correct, quiz_total, status, late, points, submitted_at, reviewed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      q.id, a.type, a.id, text || null, JSON.stringify(photos), answers ? JSON.stringify(answers) : null, correct, total, status, late, points, now,
      status === 'aprovado' ? now : null,
    );
  });
  res.json({ status, points, late: !!late, quiz_correct: correct, quiz_total: total });
});

// ---------- Criação (Administrador Geral e Clube) ----------
r.post('/requirements', requireAuth('admin', 'club'), imageUpload.array('images', 6), (req, res) => {
  const a = req.actor;
  const b = req.body;
  const title = str(b.title, 150);
  // Aceita "modes" (combinação livre) ou o antigo "model".
  const modes = parseModes(b.modes).length ? parseModes(b.modes) : modesOf({ model: b.model });
  const points = int(b.points, -1);
  const latePoints = int(b.late_points, 0);
  if (!title) fail(400, 'Informe o título');
  if (!modes.length) fail(400, 'Escolha pelo menos uma forma de envio: relatório, foto ou quiz');
  if (points < 0) fail(400, 'Informe os pontos');
  if (latePoints < 0 || latePoints > points) fail(400, 'Pontos fora do prazo devem ser entre zero e os pontos no prazo');
  if (!b.deadline || Number.isNaN(Date.parse(b.deadline))) fail(400, 'Informe o prazo');

  let audience, scope, districtId = null, clubId = null;
  if (a.type === 'admin') {
    audience = b.audience;
    if (!['club', 'unit', 'member'].includes(audience)) fail(400, 'Escolha o público');
    scope = b.scope === 'distrito' ? 'distrito' : 'geral';
    if (scope === 'distrito') {
      districtId = int(b.district_id);
      if (!get('SELECT 1 FROM districts WHERE id = ?', districtId)) fail(400, 'Escolha o distrito');
    }
  } else {
    // Clube cria para as próprias unidades ou para os próprios desbravadores.
    audience = b.audience === 'member' ? 'member' : 'unit';
    scope = 'clube';
    clubId = a.id;
  }

  let questions = [];
  if (modes.includes('quiz')) {
    const qs = parseJson(b.questions, []);
    questions = (Array.isArray(qs) ? qs : []).map((qq) => ({
      question: str(qq.question, 300),
      options: (qq.options || []).map((o) => str(o, 200)).filter(Boolean),
      correct: int(qq.correct, 0),
    }));
    if (!questions.length) fail(400, 'Crie pelo menos uma pergunta no quiz');
    for (const qq of questions) {
      if (!qq.question || qq.options.length < 2) fail(400, 'Cada pergunta precisa de enunciado e pelo menos duas opções');
      if (qq.correct < 0 || qq.correct >= qq.options.length) fail(400, 'Marque a resposta correta de cada pergunta');
    }
  }

  const id = tx(() => {
    const id = Number(run(
      `INSERT INTO requirements (creator_type, club_id, audience, scope, district_id, title, description, model, modes, images, points, late_points, deadline)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      a.type, clubId, audience, scope, districtId, title, str(b.description, 3000), legacyModel(modes), modes.join(','),
      JSON.stringify((req.files || []).map(fileUrl)), points, latePoints, new Date(b.deadline).toISOString(),
    ).lastInsertRowid);
    questions.forEach((qq, i) => run('INSERT INTO quiz_questions (requirement_id, ord, question, options, correct) VALUES (?,?,?,?,?)', id, i, qq.question, JSON.stringify(qq.options), qq.correct));
    return id;
  });
  res.json({ id });
});

/** Filtro SQL dos requisitos criados pela conta logada (t = alias da tabela). */
const ownedFilter = (a, t = '') =>
  a.type === 'admin' ? [`${t}creator_type = 'admin'`] : [`${t}creator_type = 'club' AND ${t}club_id = ?`, a.id];

r.get('/requirements/created', requireAuth('admin', 'club'), (req, res) => {
  const [where, ...p] = ownedFilter(req.actor);
  const rows = all(
    `SELECT r.*, d.name AS district_name,
            (SELECT COUNT(*) FROM submissions s WHERE s.requirement_id = r.id) AS submission_count,
            (SELECT COUNT(*) FROM submissions s WHERE s.requirement_id = r.id AND s.status = 'enviado') AS pending_count
     FROM requirements r LEFT JOIN districts d ON d.id = r.district_id WHERE ${where} ORDER BY r.deadline DESC`,
    ...p,
  );
  rows.forEach((r0) => { r0.modes = modesOf(r0); r0.images = parseJson(r0.images, []); });
  res.json(rows);
});

r.delete('/requirements/:id', requireAuth('admin', 'club'), (req, res) => {
  const [where, ...p] = ownedFilter(req.actor);
  const { changes } = run(`DELETE FROM requirements WHERE id = ? AND ${where}`, int(req.params.id), ...p);
  if (!changes) fail(404, 'Requisito não encontrado');
  res.json({ ok: true });
});

function submitterInfo(type, id) {
  if (type === 'club') return get('SELECT name, logo AS photo FROM clubs WHERE id = ?', id);
  if (type === 'unit') return get(`SELECT u.name, u.logo AS photo, c.name AS sub FROM units u JOIN clubs c ON c.id = u.club_id WHERE u.id = ?`, id);
  return get(`SELECT m.name, m.photo, c.name AS sub FROM members m JOIN clubs c ON c.id = m.club_id WHERE m.id = ?`, id);
}

// Envios para avaliar: quem criou o requisito avalia.
r.get('/reviews', requireAuth('admin', 'club'), (req, res) => {
  const [where, ...p] = ownedFilter(req.actor, 'r.');
  const status = ['enviado', 'aprovado', 'recusado'].includes(req.query.status) ? req.query.status : 'enviado';
  const extra = [];
  const extraArgs = [];
  if (['club', 'unit', 'member'].includes(req.query.submitter_type)) { extra.push('s.submitter_type = ?'); extraArgs.push(req.query.submitter_type); }
  if (req.query.submitter_id) { extra.push('s.submitter_id = ?'); extraArgs.push(int(req.query.submitter_id)); }
  const rows = all(
    `SELECT s.*, r.title, r.model, r.modes, r.points AS req_points, r.late_points AS req_late_points, r.audience, r.deadline
     FROM submissions s JOIN requirements r ON r.id = s.requirement_id
     WHERE ${where} AND s.status = ? ${extra.map((e) => 'AND ' + e).join(' ')}
     ORDER BY s.submitted_at ${status === 'enviado' ? 'ASC' : 'DESC'} LIMIT 200`,
    ...p, status, ...extraArgs,
  );
  for (const s of rows) {
    s.modes = modesOf(s);
    s.photos = JSON.parse(s.photos);
    s.submitter = submitterInfo(s.submitter_type, s.submitter_id) || { name: '(removido)' };
  }
  res.json(rows);
});

// Avaliação organizada por pessoa: quem tem envios (por público e situação).
r.get('/reviews/people', requireAuth('admin', 'club'), (req, res) => {
  const [where, ...p] = ownedFilter(req.actor, 'r.');
  const status = ['enviado', 'aprovado', 'recusado'].includes(req.query.status) ? req.query.status : 'enviado';
  const type = ['club', 'unit', 'member'].includes(req.query.submitter_type) ? req.query.submitter_type : null;
  const rows = all(
    `SELECT s.submitter_type, s.submitter_id, COUNT(*) AS count, MIN(s.submitted_at) AS first_at
     FROM submissions s JOIN requirements r ON r.id = s.requirement_id
     WHERE ${where} AND s.status = ? AND (? IS NULL OR s.submitter_type = ?)
     GROUP BY s.submitter_type, s.submitter_id ORDER BY first_at`,
    ...p, status, type, type,
  );
  rows.forEach((x) => (x.submitter = submitterInfo(x.submitter_type, x.submitter_id) || { name: '(removido)' }));
  const counts = Object.fromEntries(all(
    `SELECT s.submitter_type AS t, COUNT(*) AS n FROM submissions s JOIN requirements r ON r.id = s.requirement_id
     WHERE ${where} AND s.status = 'enviado' GROUP BY s.submitter_type`, ...p,
  ).map((x) => [x.t, x.n]));
  res.json({ people: rows, pending_by_type: counts });
});

r.post('/reviews/:id', requireAuth('admin', 'club'), (req, res) => {
  const [where, ...p] = ownedFilter(req.actor, 'r.');
  const s = get(
    `SELECT s.*, r.points AS rp, r.late_points AS rlp FROM submissions s JOIN requirements r ON r.id = s.requirement_id
     WHERE s.id = ? AND ${where}`,
    int(req.params.id), ...p,
  );
  if (!s) fail(404, 'Envio não encontrado');
  const decision = req.body.decision === 'aprovado' ? 'aprovado' : 'recusado';
  let points = 0;
  if (decision === 'aprovado') {
    const base = s.late ? s.rlp : s.rp;
    points = s.quiz_total ? Math.round((base * s.quiz_correct) / s.quiz_total) : base;
  }
  run('UPDATE submissions SET status = ?, points = ?, feedback = ?, reviewed_at = ? WHERE id = ?', decision, points, str(req.body.feedback, 500) || null, nowIso(), s.id);
  res.json({ ok: true, points });
});

// Quiz completo (com gabarito) só para quem criou.
r.get('/requirements/:id/quiz', requireAuth('admin', 'club'), (req, res) => {
  const [where, ...p] = ownedFilter(req.actor);
  if (!get(`SELECT 1 FROM requirements WHERE id = ? AND ${where}`, int(req.params.id), ...p)) fail(404, 'Requisito não encontrado');
  res.json(all('SELECT * FROM quiz_questions WHERE requirement_id = ? ORDER BY ord', int(req.params.id)).map((q) => ({ ...q, options: JSON.parse(q.options) })));
});

export default r;
