import { Router } from 'express';
import { all, get, run, tx, nowIso } from '../db.js';
import { requireAuth } from '../auth.js';
import { imageUpload, fileUrl, privateImageUpload, privateUrl } from '../uploads.js';
import { fail, int, str, bool, ageFrom, parseJson } from '../util.js';
import { parseModes } from '../modes.js';
import { startCheckout, confirmPurchase } from '../payments.js';
import { MAX_FOTOS_ENVIO } from '../config.js';

// Cursos (grátis ou pagos). Cada aula pode pedir relatório, foto e/ou quiz; o Administrador
// Geral avalia. Aula sem forma de envio é só "marcar como concluída".
// Classes e especialidades NÃO passam por aqui: não são vendidas nem feitas online
// (o membro informa as que tem e a diretoria aprova — ver routes/achievements.js).
const r = Router();
const TYPES = ['curso'];

function hasAccess(memberId, c) {
  return !!c.is_free || !!get('SELECT 1 FROM content_access WHERE member_id = ? AND content_id = ?', memberId, c.id);
}

/** Desbravador não vê classes de líder; liderança vê regulares e de líder. */
const visibleTo = (actor, c) => !(c.type === 'classe' && c.leader && actor.kind !== 'lideranca');

const approvedCount = (contentId, memberId) =>
  get(`SELECT COUNT(*) n FROM content_progress p JOIN content_items i ON i.id = p.item_id WHERE i.content_id = ? AND p.member_id = ? AND p.status = 'aprovado'`, contentId, memberId).n;

function summary(actor, c) {
  return {
    ...c,
    items_count: get('SELECT COUNT(*) n FROM content_items WHERE content_id = ?', c.id).n,
    done_count: approvedCount(c.id, actor.id),
    has_access: hasAccess(actor.id, c),
    completed: !!get('SELECT 1 FROM achievements WHERE member_id = ? AND content_id = ?', actor.id, c.id),
    purchase_pending: !!get(`SELECT 1 FROM purchases WHERE member_id = ? AND content_id = ? AND status = 'pendente'`, actor.id, c.id),
    is_my_class: c.type === 'classe' && !c.leader && c.age === ageFrom(actor.birth_date),
  };
}

/** Todos os requisitos aprovados → conclusão vai para o perfil. */
function checkCompletion(contentId, memberId) {
  const total = get('SELECT COUNT(*) n FROM content_items WHERE content_id = ?', contentId).n;
  if (total > 0 && approvedCount(contentId, memberId) >= total) {
    run(`INSERT OR IGNORE INTO achievements (member_id, content_id, source) VALUES (?, ?, 'online')`, memberId, contentId);
    return true;
  }
  return false;
}

const questionsOf = (itemId, withAnswers = false) =>
  all('SELECT id, question, options, correct FROM content_item_questions WHERE item_id = ? ORDER BY ord, id', itemId).map((q) => {
    const out = { id: q.id, question: q.question, options: JSON.parse(q.options) };
    if (withAnswers) out.correct = q.correct;
    return out;
  });

function progressOut(p) {
  if (!p) return null;
  return {
    status: p.status, text: p.text, photos: parseJson(p.photos, []), answers: parseJson(p.answers, null),
    quiz_correct: p.quiz_correct, quiz_total: p.quiz_total, feedback: p.feedback, submitted_at: p.submitted_at || p.done_at, reviewed_at: p.reviewed_at,
  };
}

function itemsFor(contentId, memberId, { withAnswers = false } = {}) {
  return all('SELECT * FROM content_items WHERE content_id = ? ORDER BY ord, id', contentId).map((i) => {
    const modes = parseModes(i.modes);
    return {
      id: i.id, ord: i.ord, title: i.title, body: i.body, modes, images: parseJson(i.images, []),
      questions: modes.includes('quiz') ? questionsOf(i.id, withAnswers) : [],
      submission: progressOut(get('SELECT * FROM content_progress WHERE member_id = ? AND item_id = ?', memberId, i.id)),
    };
  });
}

r.get('/content', requireAuth('member'), (req, res) => {
  const rows = all(`SELECT * FROM content WHERE type = 'curso' ORDER BY name`);
  res.json(rows.map((c) => summary(req.actor, c)));
});

function loadVisible(req) {
  const c = get(`SELECT * FROM content WHERE id = ? AND type = 'curso'`, int(req.params.id));
  if (!c || !visibleTo(req.actor, c)) fail(404, 'Conteúdo não encontrado');
  return c;
}

r.get('/content/:id', requireAuth('member'), (req, res) => {
  const c = loadVisible(req);
  const s = summary(req.actor, c);
  s.items = itemsFor(c.id, req.actor.id);
  // Conteúdo pago bloqueado: mostra só os títulos.
  if (!s.has_access) s.items.forEach((i) => { i.body = null; i.images = []; i.questions = []; });
  res.json(s);
});

/** Envio de um requisito da classe/especialidade/curso. */
r.post('/content/:id/items/:itemId/submit', requireAuth('member'), privateImageUpload.array('photos', MAX_FOTOS_ENVIO), (req, res) => {
  const c = loadVisible(req);
  const me = req.actor.id;
  if (!hasAccess(me, c)) fail(402, 'Adquira este conteúdo para continuar');
  const item = get('SELECT * FROM content_items WHERE id = ? AND content_id = ?', int(req.params.itemId), c.id);
  if (!item) fail(404, 'Requisito não encontrado');
  const existing = get('SELECT * FROM content_progress WHERE member_id = ? AND item_id = ?', me, item.id);

  if (bool(req.body.undo)) {
    if (existing?.status === 'aprovado' && parseModes(item.modes).length) fail(409, 'Requisito já aprovado');
    run('DELETE FROM content_progress WHERE member_id = ? AND item_id = ?', me, item.id);
    run(`DELETE FROM achievements WHERE member_id = ? AND content_id = ? AND source = 'online'`, me, c.id);
    return res.json({ ok: true, completed: false });
  }
  if (existing && existing.status !== 'recusado') fail(409, 'Você já enviou este requisito');

  const modes = parseModes(item.modes);
  const text = str(req.body.text, 5000);
  const photos = (req.files || []).map((f) => privateUrl('item', f));
  if (modes.includes('texto') && text.length < 3) fail(400, 'Escreva o relatório');
  if (modes.includes('foto') && !photos.length) fail(400, 'Envie pelo menos uma foto');
  let answers = null, correct = null, total = null;
  if (modes.includes('quiz')) {
    const qs = all('SELECT correct FROM content_item_questions WHERE item_id = ? ORDER BY ord, id', item.id);
    answers = parseJson(req.body.answers, []);
    if (!Array.isArray(answers) || answers.length !== qs.length) fail(400, 'Responda todas as perguntas');
    total = qs.length;
    correct = qs.filter((q, i) => Number(answers[i]) === q.correct).length;
  }
  const now = nowIso();
  // Sem forma de envio: é só marcar como feito.
  const status = modes.length ? 'enviado' : 'aprovado';
  run(
    `INSERT OR REPLACE INTO content_progress (member_id, item_id, answer, done_at, status, text, photos, answers, quiz_correct, quiz_total, feedback, submitted_at, reviewed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,?)`,
    me, item.id, null, now, status, text || null, JSON.stringify(photos), answers ? JSON.stringify(answers) : null, correct, total, now, status === 'aprovado' ? now : null,
  );
  res.json({ ok: true, status, completed: status === 'aprovado' ? checkCompletion(c.id, me) : false, quiz_correct: correct, quiz_total: total });
});

r.post('/content/:id/buy', requireAuth('member'), (req, res) => {
  const c = loadVisible(req);
  if (hasAccess(req.actor.id, c)) fail(409, 'Você já tem acesso a este conteúdo');
  let p = get(`SELECT * FROM purchases WHERE member_id = ? AND content_id = ? AND status = 'pendente'`, req.actor.id, c.id);
  if (!p) {
    const id = run(`INSERT INTO purchases (member_id, content_id, price_cents, status) VALUES (?,?,?,'pendente')`, req.actor.id, c.id, c.price_cents).lastInsertRowid;
    p = get('SELECT * FROM purchases WHERE id = ?', id);
  }
  res.json({ purchase: p, ...startCheckout(p) });
});

// ---------- Administração do conteúdo (só Administrador Geral) ----------
const admin = requireAuth('admin');

r.get('/admin/content', admin, (req, res) => {
  const rows = all(
    `SELECT c.*, (SELECT COUNT(*) FROM content_items i WHERE i.content_id = c.id) AS items_count
     FROM content c WHERE c.type = 'curso' ORDER BY c.name`,
  );
  res.json(rows);
});

r.get('/admin/content/:id', admin, (req, res) => {
  const c = get(`SELECT * FROM content WHERE id = ? AND type = 'curso'`, int(req.params.id));
  if (!c) fail(404, 'Conteúdo não encontrado');
  c.items = all('SELECT * FROM content_items WHERE content_id = ? ORDER BY ord, id', c.id).map((i) => {
    const modes = parseModes(i.modes);
    return { ...i, modes, images: parseJson(i.images, []), questions: modes.includes('quiz') ? questionsOf(i.id, true) : [] };
  });
  res.json(c);
});

function contentFields(b) {
  const type = b.type || 'curso';
  if (!TYPES.includes(type)) fail(400, 'Classes e especialidades não são criadas nem vendidas aqui. Use o catálogo.');
  const name = str(b.name, 120);
  if (!name) fail(400, 'Informe o nome');
  const isFree = bool(b.is_free) ? 1 : 0;
  const price = isFree ? 0 : Math.round(Number(String(b.price ?? '0').replace(',', '.')) * 100);
  if (!isFree && !(price > 0)) fail(400, 'Informe o preço do item pago');
  const age = type === 'classe' && !bool(b.leader) ? int(b.age) : null;
  return [type, name, str(b.description, 3000), str(b.icon, 16) || 'book', str(b.category, 60), age, type === 'classe' && bool(b.leader) ? 1 : 0, isFree, price];
}

function cleanQuestions(qs) {
  const out = (Array.isArray(qs) ? qs : []).map((q) => ({
    question: str(q.question, 300),
    options: (q.options || []).map((o) => str(o, 200)).filter(Boolean),
    correct: int(q.correct, 0),
  }));
  for (const q of out) {
    if (!q.question || q.options.length < 2) fail(400, 'Cada pergunta do quiz precisa de enunciado e pelo menos duas opções');
    if (q.correct < 0 || q.correct >= q.options.length) fail(400, 'Marque a resposta correta de cada pergunta');
  }
  return out;
}

/** Salva os requisitos (itens). files: imagens novas por item, no campo "item_<índice>". */
function saveItems(contentId, items, files) {
  const keep = [];
  (Array.isArray(items) ? items : []).forEach((it, i) => {
    const title = str(it.title, 200);
    if (!title) return;
    const modes = parseModes(it.modes);
    const questions = modes.includes('quiz') ? cleanQuestions(it.questions) : [];
    if (modes.includes('quiz') && !questions.length) fail(400, `Crie as perguntas do quiz em "${title}"`);
    const kept = (Array.isArray(it.images) ? it.images : []).filter((u) => typeof u === 'string' && u.startsWith('/uploads/'));
    const images = [...kept, ...files.filter((f) => f.fieldname === `item_${i}`).map(fileUrl)].slice(0, 6);
    let id = int(it.id);
    if (id && get('SELECT 1 FROM content_items WHERE id = ? AND content_id = ?', id, contentId)) {
      run('UPDATE content_items SET ord = ?, title = ?, body = ?, modes = ?, images = ? WHERE id = ?', i, title, str(it.body, 5000), modes.join(','), JSON.stringify(images), id);
    } else {
      id = Number(run('INSERT INTO content_items (content_id, ord, title, body, modes, images) VALUES (?,?,?,?,?,?)', contentId, i, title, str(it.body, 5000), modes.join(','), JSON.stringify(images)).lastInsertRowid);
    }
    run('DELETE FROM content_item_questions WHERE item_id = ?', id);
    questions.forEach((q, k) => run('INSERT INTO content_item_questions (item_id, ord, question, options, correct) VALUES (?,?,?,?,?)', id, k, q.question, JSON.stringify(q.options), q.correct));
    keep.push(id);
  });
  const existing = all('SELECT id FROM content_items WHERE content_id = ?', contentId).map((x) => x.id);
  for (const id of existing) if (!keep.includes(id)) run('DELETE FROM content_items WHERE id = ?', id);
}

/** Aceita JSON puro ou multipart com o campo "data" (JSON) + imagens. */
const bodyOf = (req) => (req.body?.data ? parseJson(req.body.data, {}) : req.body);

r.post('/admin/content', admin, imageUpload.any(), (req, res) => {
  const b = bodyOf(req);
  const f = contentFields(b);
  const files = req.files || [];
  const image = files.find((x) => x.fieldname === 'image');
  const id = tx(() => {
    const id = Number(run('INSERT INTO content (type, name, description, icon, category, age, leader, is_free, price_cents, image) VALUES (?,?,?,?,?,?,?,?,?,?)', ...f, fileUrl(image)).lastInsertRowid);
    saveItems(id, b.items, files);
    return id;
  });
  res.json({ id });
});

r.put('/admin/content/:id', admin, imageUpload.any(), (req, res) => {
  const id = int(req.params.id);
  if (!get(`SELECT 1 FROM content WHERE id = ? AND type = 'curso'`, id)) fail(404, 'Conteúdo não encontrado');
  const b = bodyOf(req);
  const f = contentFields(b);
  const files = req.files || [];
  const image = files.find((x) => x.fieldname === 'image');
  tx(() => {
    run('UPDATE content SET type = ?, name = ?, description = ?, icon = ?, category = ?, age = ?, leader = ?, is_free = ?, price_cents = ? WHERE id = ?', ...f, id);
    if (image) run('UPDATE content SET image = ? WHERE id = ?', fileUrl(image), id);
    else if (b.remove_image) run('UPDATE content SET image = NULL WHERE id = ?', id);
    saveItems(id, b.items, files);
  });
  res.json({ ok: true });
});

r.delete('/admin/content/:id', admin, (req, res) => {
  run(`DELETE FROM content WHERE id = ? AND type = 'curso'`, int(req.params.id));
  res.json({ ok: true });
});

// ---------- Análise de classes e especialidades ----------
r.get('/admin/content-review', admin, (req, res) => {
  const type = 'curso';
  const rows = all(
    `SELECT c.id, c.name, c.icon, c.image, c.age, c.leader,
            (SELECT COUNT(*) FROM content_items i WHERE i.content_id = c.id) AS items_count,
            (SELECT COUNT(DISTINCT p.member_id) FROM content_progress p JOIN content_items i ON i.id = p.item_id WHERE i.content_id = c.id) AS members,
            (SELECT COUNT(*) FROM content_progress p JOIN content_items i ON i.id = p.item_id WHERE i.content_id = c.id AND p.status = 'enviado') AS pending
     FROM content c WHERE c.type = ? ORDER BY c.leader, c.age, c.name`,
    type,
  );
  res.json(rows);
});

r.get('/admin/content-review/:id', admin, (req, res) => {
  const c = get('SELECT id, type, name, icon, image FROM content WHERE id = ?', int(req.params.id));
  if (!c) fail(404, 'Conteúdo não encontrado');
  c.items_count = get('SELECT COUNT(*) n FROM content_items WHERE content_id = ?', c.id).n;
  c.members = all(
    `SELECT m.id, m.name, m.photo, m.handle, cl.name AS club_name, u.name AS unit_name,
            SUM(p.status = 'aprovado') AS approved, SUM(p.status = 'enviado') AS pending, MAX(p.submitted_at) AS last_at,
            EXISTS (SELECT 1 FROM achievements a WHERE a.member_id = m.id AND a.content_id = ?) AS completed
     FROM content_progress p JOIN content_items i ON i.id = p.item_id JOIN members m ON m.id = p.member_id
     JOIN clubs cl ON cl.id = m.club_id LEFT JOIN units u ON u.id = m.unit_id
     WHERE i.content_id = ? GROUP BY m.id ORDER BY pending DESC, last_at DESC`,
    c.id, c.id,
  );
  res.json(c);
});

r.get('/admin/content-review/:id/members/:memberId', admin, (req, res) => {
  const c = get('SELECT id, type, name, icon, image FROM content WHERE id = ?', int(req.params.id));
  const m = get('SELECT m.id, m.name, m.photo, m.handle, cl.name AS club_name FROM members m JOIN clubs cl ON cl.id = m.club_id WHERE m.id = ?', int(req.params.memberId));
  if (!c || !m) fail(404, 'Não encontrado');
  res.json({ content: c, member: m, completed: !!get('SELECT 1 FROM achievements WHERE member_id = ? AND content_id = ?', m.id, c.id), items: itemsFor(c.id, m.id, { withAnswers: true }) });
});

r.post('/admin/content-review/:id/members/:memberId/items/:itemId', admin, (req, res) => {
  const contentId = int(req.params.id);
  const memberId = int(req.params.memberId);
  const p = get(
    `SELECT p.* FROM content_progress p JOIN content_items i ON i.id = p.item_id WHERE p.member_id = ? AND p.item_id = ? AND i.content_id = ?`,
    memberId, int(req.params.itemId), contentId,
  );
  if (!p) fail(404, 'Envio não encontrado');
  const decision = req.body.decision === 'aprovado' ? 'aprovado' : 'recusado';
  run('UPDATE content_progress SET status = ?, feedback = ?, reviewed_at = ? WHERE member_id = ? AND item_id = ?', decision, str(req.body.feedback, 500) || null, nowIso(), memberId, p.item_id);
  if (decision === 'recusado') run(`DELETE FROM achievements WHERE member_id = ? AND content_id = ? AND source = 'online'`, memberId, contentId);
  res.json({ ok: true, completed: decision === 'aprovado' ? checkCompletion(contentId, memberId) : false });
});

// ---------- Compras ----------
r.get('/admin/purchases', admin, (_req, res) => {
  res.json(all(
    `SELECT p.*, m.name AS member_name, m.handle AS member_handle, cl.name AS club_name, c.name AS content_name, c.type AS content_type, c.icon, c.image
     FROM purchases p JOIN members m ON m.id = p.member_id JOIN clubs cl ON cl.id = m.club_id JOIN content c ON c.id = p.content_id
     ORDER BY p.status = 'pendente' DESC, p.created_at DESC LIMIT 200`,
  ));
});

// Aprovar (pagamento confirmado). Com pagamento automático, a confirmação chega sozinha (payments.js).
r.post('/admin/purchases/:id/confirm', admin, (req, res) => {
  const p = confirmPurchase(int(req.params.id), 'manual-admin-' + req.actor.id);
  if (!p) fail(404, 'Compra não encontrada');
  res.json({ ok: true });
});

// Recusar
r.post('/admin/purchases/:id/cancel', admin, (req, res) => {
  run(`UPDATE purchases SET status = 'cancelado', updated_at = ? WHERE id = ? AND status = 'pendente'`, nowIso(), int(req.params.id));
  res.json({ ok: true });
});

// Acessos liberados (por compra ou pelo "Entregar conteúdo").
r.get('/admin/access', admin, (_req, res) => {
  res.json(all(
    `SELECT a.*, m.name AS member_name, m.handle AS member_handle, c.name AS content_name, c.icon, c.image FROM content_access a
     JOIN members m ON m.id = a.member_id JOIN content c ON c.id = a.content_id ORDER BY a.granted_at DESC LIMIT 200`,
  ));
});
r.delete('/admin/access/:memberId/:contentId', admin, (req, res) => {
  run('DELETE FROM content_access WHERE member_id = ? AND content_id = ?', int(req.params.memberId), int(req.params.contentId));
  res.json({ ok: true });
});

export default r;
