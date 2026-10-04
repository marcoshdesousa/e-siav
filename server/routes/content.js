import { Router } from 'express';
import { all, get, run, tx, nowIso } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int, str, bool, ageFrom } from '../util.js';
import { startCheckout, confirmPurchase } from '../payments.js';

// Especialidades, classes e cursos.
const r = Router();
const TYPES = ['especialidade', 'classe', 'curso'];

function hasAccess(memberId, c) {
  return !!c.is_free || !!get('SELECT 1 FROM content_access WHERE member_id = ? AND content_id = ?', memberId, c.id);
}

/** Desbravador não vê classes de líder; liderança vê regulares e de líder. */
const visibleTo = (actor, c) => !(c.type === 'classe' && c.leader && actor.kind !== 'lideranca');

function summary(actor, c) {
  const items = get('SELECT COUNT(*) n FROM content_items WHERE content_id = ?', c.id).n;
  const done = get('SELECT COUNT(*) n FROM content_progress p JOIN content_items i ON i.id = p.item_id WHERE i.content_id = ? AND p.member_id = ?', c.id, actor.id).n;
  return {
    ...c,
    items_count: items,
    done_count: done,
    has_access: hasAccess(actor.id, c),
    completed: !!get('SELECT 1 FROM achievements WHERE member_id = ? AND content_id = ?', actor.id, c.id),
    purchase_pending: !!get(`SELECT 1 FROM purchases WHERE member_id = ? AND content_id = ? AND status = 'pendente'`, actor.id, c.id),
    is_my_class: c.type === 'classe' && !c.leader && c.age === ageFrom(actor.birth_date),
  };
}

r.get('/content', requireAuth('member'), (req, res) => {
  const type = TYPES.includes(req.query.type) ? req.query.type : 'especialidade';
  const rows = all('SELECT * FROM content WHERE type = ? ORDER BY leader, age, category, name', type).filter((c) => visibleTo(req.actor, c));
  res.json(rows.map((c) => summary(req.actor, c)));
});

function loadVisible(req) {
  const c = get('SELECT * FROM content WHERE id = ?', int(req.params.id));
  if (!c || !visibleTo(req.actor, c)) fail(404, 'Conteúdo não encontrado');
  return c;
}

r.get('/content/:id', requireAuth('member'), (req, res) => {
  const c = loadVisible(req);
  const s = summary(req.actor, c);
  s.items = all(
    `SELECT i.id, i.ord, i.title, i.body, p.done_at, p.answer FROM content_items i
     LEFT JOIN content_progress p ON p.item_id = i.id AND p.member_id = ? WHERE i.content_id = ? ORDER BY i.ord, i.id`,
    req.actor.id, c.id,
  );
  // Conteúdo pago bloqueado: mostra só os títulos.
  if (!s.has_access) s.items.forEach((i) => (i.body = null));
  res.json(s);
});

r.post('/content/:id/items/:itemId/done', requireAuth('member'), (req, res) => {
  const c = loadVisible(req);
  if (!hasAccess(req.actor.id, c)) fail(402, 'Adquira este conteúdo para continuar');
  const item = get('SELECT id FROM content_items WHERE id = ? AND content_id = ?', int(req.params.itemId), c.id);
  if (!item) fail(404, 'Atividade não encontrada');
  if (bool(req.body.undo)) {
    run('DELETE FROM content_progress WHERE member_id = ? AND item_id = ?', req.actor.id, item.id);
    run(`DELETE FROM achievements WHERE member_id = ? AND content_id = ? AND source = 'online'`, req.actor.id, c.id);
    return res.json({ ok: true, completed: false });
  }
  run('INSERT OR REPLACE INTO content_progress (member_id, item_id, answer, done_at) VALUES (?,?,?,?)', req.actor.id, item.id, str(req.body.answer, 3000) || null, nowIso());
  const total = get('SELECT COUNT(*) n FROM content_items WHERE content_id = ?', c.id).n;
  const done = get('SELECT COUNT(*) n FROM content_progress p JOIN content_items i ON i.id = p.item_id WHERE i.content_id = ? AND p.member_id = ?', c.id, req.actor.id).n;
  let completed = false;
  if (total > 0 && done >= total) {
    // Concluída online: passa a aparecer no perfil do membro.
    run(`INSERT OR IGNORE INTO achievements (member_id, content_id, source) VALUES (?, ?, 'online')`, req.actor.id, c.id);
    completed = true;
  }
  res.json({ ok: true, completed });
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
  const type = TYPES.includes(req.query.type) ? req.query.type : null;
  const rows = all(
    `SELECT c.*, (SELECT COUNT(*) FROM content_items i WHERE i.content_id = c.id) AS items_count
     FROM content c WHERE (? IS NULL OR c.type = ?) ORDER BY c.type, c.leader, c.age, c.name`,
    type, type,
  );
  res.json(rows);
});

r.get('/admin/content/:id', admin, (req, res) => {
  const c = get('SELECT * FROM content WHERE id = ?', int(req.params.id));
  if (!c) fail(404, 'Conteúdo não encontrado');
  c.items = all('SELECT * FROM content_items WHERE content_id = ? ORDER BY ord, id', c.id);
  res.json(c);
});

function contentFields(b) {
  const type = b.type;
  if (!TYPES.includes(type)) fail(400, 'Tipo inválido');
  const name = str(b.name, 120);
  if (!name) fail(400, 'Informe o nome');
  const isFree = bool(b.is_free) ? 1 : 0;
  const price = isFree ? 0 : Math.round(Number(String(b.price ?? '0').replace(',', '.')) * 100);
  if (!isFree && !(price > 0)) fail(400, 'Informe o preço do item pago');
  const age = type === 'classe' && !bool(b.leader) ? int(b.age) : null;
  return [type, name, str(b.description, 3000), str(b.icon, 16) || '📘', str(b.category, 60), age, type === 'classe' && bool(b.leader) ? 1 : 0, isFree, price];
}

function saveItems(contentId, items) {
  const keep = [];
  (Array.isArray(items) ? items : []).forEach((it, i) => {
    const title = str(it.title, 200);
    if (!title) return;
    const id = int(it.id);
    if (id && get('SELECT 1 FROM content_items WHERE id = ? AND content_id = ?', id, contentId)) {
      run('UPDATE content_items SET ord = ?, title = ?, body = ? WHERE id = ?', i, title, str(it.body, 5000), id);
      keep.push(id);
    } else {
      keep.push(Number(run('INSERT INTO content_items (content_id, ord, title, body) VALUES (?,?,?,?)', contentId, i, title, str(it.body, 5000)).lastInsertRowid));
    }
  });
  const existing = all('SELECT id FROM content_items WHERE content_id = ?', contentId).map((x) => x.id);
  for (const id of existing) if (!keep.includes(id)) run('DELETE FROM content_items WHERE id = ?', id);
}

r.post('/admin/content', admin, (req, res) => {
  const f = contentFields(req.body);
  const id = tx(() => {
    const id = Number(run('INSERT INTO content (type, name, description, icon, category, age, leader, is_free, price_cents) VALUES (?,?,?,?,?,?,?,?,?)', ...f).lastInsertRowid);
    saveItems(id, req.body.items);
    return id;
  });
  res.json({ id });
});

r.put('/admin/content/:id', admin, (req, res) => {
  const id = int(req.params.id);
  if (!get('SELECT 1 FROM content WHERE id = ?', id)) fail(404, 'Conteúdo não encontrado');
  const f = contentFields(req.body);
  tx(() => {
    run('UPDATE content SET type = ?, name = ?, description = ?, icon = ?, category = ?, age = ?, leader = ?, is_free = ?, price_cents = ? WHERE id = ?', ...f, id);
    saveItems(id, req.body.items);
  });
  res.json({ ok: true });
});

r.delete('/admin/content/:id', admin, (req, res) => {
  run('DELETE FROM content WHERE id = ?', int(req.params.id));
  res.json({ ok: true });
});

r.get('/admin/purchases', admin, (_req, res) => {
  res.json(all(
    `SELECT p.*, m.name AS member_name, m.code AS member_code, cl.name AS club_name, c.name AS content_name, c.type AS content_type, c.icon
     FROM purchases p JOIN members m ON m.id = p.member_id JOIN clubs cl ON cl.id = m.club_id JOIN content c ON c.id = p.content_id
     ORDER BY p.status = 'pendente' DESC, p.created_at DESC LIMIT 200`,
  ));
});

r.post('/admin/purchases/:id/confirm', admin, (req, res) => {
  const p = confirmPurchase(int(req.params.id), 'manual-admin-' + req.actor.id);
  if (!p) fail(404, 'Compra não encontrada');
  res.json({ ok: true });
});

r.post('/admin/purchases/:id/cancel', admin, (req, res) => {
  run(`UPDATE purchases SET status = 'cancelado', updated_at = ? WHERE id = ? AND status = 'pendente'`, nowIso(), int(req.params.id));
  res.json({ ok: true });
});

// Liberação manual de um item pago para um membro.
r.get('/admin/access', admin, (_req, res) => {
  res.json(all(
    `SELECT a.*, m.name AS member_name, m.code AS member_code, c.name AS content_name, c.icon FROM content_access a
     JOIN members m ON m.id = a.member_id JOIN content c ON c.id = a.content_id ORDER BY a.granted_at DESC LIMIT 200`,
  ));
});
r.post('/admin/access', admin, (req, res) => {
  const m = get('SELECT id FROM members WHERE code = ?', str(req.body.member_code, 20).toUpperCase());
  if (!m) fail(404, 'Membro não encontrado (confira o código)');
  const c = get('SELECT id FROM content WHERE id = ?', int(req.body.content_id));
  if (!c) fail(404, 'Conteúdo não encontrado');
  run(`INSERT OR REPLACE INTO content_access (member_id, content_id, source) VALUES (?, ?, 'admin')`, m.id, c.id);
  res.json({ ok: true });
});
r.delete('/admin/access/:memberId/:contentId', admin, (req, res) => {
  run('DELETE FROM content_access WHERE member_id = ? AND content_id = ?', int(req.params.memberId), int(req.params.contentId));
  res.json({ ok: true });
});

export default r;
