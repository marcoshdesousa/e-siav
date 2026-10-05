import { Router } from 'express';
import { all, get, run, tx, nowIso } from '../db.js';
import { requireAuth } from '../auth.js';
import { catalog, iconForArea, importSpecialties, norm, AREAS } from '../catalog.js';
import { imageUpload, fileUrl } from '../uploads.js';
import { fail, int, str } from '../util.js';

// Classes e especialidades: o membro informa as que tem; a diretoria do clube aprova.
const r = Router();
const TYPES = ['classe', 'especialidade'];
const typeOf = (v) => (TYPES.includes(v) ? v : 'especialidade');

r.get('/catalog', requireAuth(), (req, res) => res.json(catalog(typeOf(req.query.type))));

// ---------- Membro ----------
r.get('/me/achievements', requireAuth('member'), (req, res) => {
  const type = typeOf(req.query.type);
  const me = req.actor.id;
  res.json({
    approved: all(
      `SELECT c.id, c.name, c.icon, c.image, c.category, c.age, c.leader, a.source, a.date FROM achievements a JOIN content c ON c.id = a.content_id
       WHERE a.member_id = ? AND c.type = ? ORDER BY c.leader, c.age, c.category, c.name`, me, type),
    requests: all(
      `SELECT q.id, q.status, q.note, q.created_at, q.reviewed_at, c.id AS content_id, c.name, c.icon, c.image, c.category
       FROM achievement_requests q JOIN content c ON c.id = q.content_id
       WHERE q.member_id = ? AND c.type = ? AND (q.status <> 'aprovado') ORDER BY q.status = 'pendente' DESC, q.created_at DESC LIMIT 100`, me, type),
  });
});

// Envia para a diretoria as classes/especialidades que o membro diz ter.
r.post('/me/achievement-requests', requireAuth('member'), (req, res) => {
  const ids = [...new Set((Array.isArray(req.body.content_ids) ? req.body.content_ids : []).map(Number).filter(Boolean))].slice(0, 200);
  if (!ids.length) fail(400, 'Escolha pelo menos uma');
  let created = 0;
  tx(() => {
    for (const id of ids) {
      const c = get(`SELECT id, type, leader FROM content WHERE id = ? AND type IN ('classe','especialidade')`, id);
      if (!c) continue;
      if (c.type === 'classe' && c.leader && req.actor.kind !== 'lideranca') continue;
      if (get('SELECT 1 FROM achievements WHERE member_id = ? AND content_id = ?', req.actor.id, id)) continue;
      created += run(`INSERT OR IGNORE INTO achievement_requests (member_id, content_id) VALUES (?, ?)`, req.actor.id, id).changes;
    }
  });
  res.json({ created });
});

r.delete('/me/achievement-requests/:id', requireAuth('member'), (req, res) => {
  run(`DELETE FROM achievement_requests WHERE id = ? AND member_id = ? AND status <> 'aprovado'`, int(req.params.id), req.actor.id);
  res.json({ ok: true });
});

// ---------- Diretoria do clube ----------
r.get('/club/achievement-requests', requireAuth('club'), (req, res) => {
  const status = ['pendente', 'aprovado', 'recusado'].includes(req.query.status) ? req.query.status : 'pendente';
  const rows = all(
    `SELECT q.id, q.status, q.created_at, q.reviewed_at, c.id AS content_id, c.type, c.name, c.icon, c.image, c.category,
            m.id AS member_id, m.name AS member_name, m.photo AS member_photo, m.handle, u.name AS unit_name
     FROM achievement_requests q JOIN content c ON c.id = q.content_id JOIN members m ON m.id = q.member_id
     LEFT JOIN units u ON u.id = m.unit_id
     WHERE m.club_id = ? AND q.status = ? ORDER BY m.name, c.type, c.name LIMIT 500`,
    req.actor.id, status,
  );
  // Agrupado por membro
  const byMember = new Map();
  for (const x of rows) {
    if (!byMember.has(x.member_id)) byMember.set(x.member_id, { member_id: x.member_id, name: x.member_name, photo: x.member_photo, handle: x.handle, unit_name: x.unit_name, items: [] });
    byMember.get(x.member_id).items.push({ id: x.id, status: x.status, created_at: x.created_at, content_id: x.content_id, type: x.type, name: x.name, icon: x.icon, image: x.image, category: x.category });
  }
  res.json([...byMember.values()]);
});

r.get('/club/achievement-requests/count', requireAuth('club'), (req, res) => {
  res.json({ pending: get(`SELECT COUNT(*) n FROM achievement_requests q JOIN members m ON m.id = q.member_id WHERE m.club_id = ? AND q.status = 'pendente'`, req.actor.id).n });
});

// Aprovar ou recusar (um ou vários). Aprovado → aparece no perfil do membro.
r.post('/club/achievement-requests/decide', requireAuth('club'), (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Boolean);
  const decision = req.body.decision === 'aprovado' ? 'aprovado' : 'recusado';
  let done = 0;
  tx(() => {
    for (const id of ids) {
      const q = get(
        `SELECT q.* FROM achievement_requests q JOIN members m ON m.id = q.member_id WHERE q.id = ? AND m.club_id = ? AND q.status = 'pendente'`,
        id, req.actor.id,
      );
      if (!q) continue;
      run('UPDATE achievement_requests SET status = ?, reviewed_at = ? WHERE id = ?', decision, nowIso(), q.id);
      if (decision === 'aprovado') run(`INSERT OR IGNORE INTO achievements (member_id, content_id, source) VALUES (?, ?, 'clube')`, q.member_id, q.content_id);
      done++;
    }
  });
  res.json({ ok: true, done });
});

// A diretoria pode incluir uma especialidade que esteja faltando no catálogo.
r.post('/club/catalog', requireAuth('club'), (req, res) => {
  const name = str(req.body.name, 100);
  const category = str(req.body.category, 60) || 'Outras';
  if (name.length < 3) fail(400, 'Informe o nome da especialidade');
  const existing = get(`SELECT id FROM content WHERE type = 'especialidade' AND name = ? COLLATE NOCASE`, name);
  if (existing) return res.json({ id: existing.id, existed: true });
  const { lastInsertRowid } = run(
    `INSERT INTO content (type, name, icon, category, is_free, price_cents, added_by_club) VALUES ('especialidade', ?, ?, ?, 1, 0, ?)`,
    name, iconForArea(category), category, req.actor.id,
  );
  res.json({ id: Number(lastInsertRowid) });
});

// ---------- Catálogo (Administrador Geral): lista oficial e fotos ----------
// Não é venda nem requisito: só a relação oficial de classes/especialidades com as imagens.
const admin = requireAuth('admin');

r.get('/admin/catalog', admin, (req, res) => {
  const type = typeOf(req.query.type);
  const rows = catalog(type);
  for (const c of rows) c.holders = get('SELECT COUNT(*) n FROM achievements WHERE content_id = ?', c.id).n;
  res.json({ areas: AREAS, items: rows });
});

r.post('/admin/catalog/import', admin, (req, res) => res.json(importSpecialties(req.body.text)));

/**
 * Envio das fotos em lote: cada arquivo é ligado à classe/especialidade pelo nome do
 * arquivo (ex.: "Nós e Amarras.png", "nos-e-amarras.jpg") ou pelo código (ex.: "AR-012.png").
 */
r.post('/admin/catalog/images', admin, imageUpload.array('images', 300), (req, res) => {
  const items = all(`SELECT id, code, name FROM content WHERE type IN ('classe','especialidade')`);
  const byKey = new Map();
  for (const c of items) {
    byKey.set(norm(c.name), c);
    if (c.code) byKey.set(norm(c.code), c);
  }
  const matched = [], unmatched = [];
  for (const f of req.files || []) {
    const base = f.originalname.replace(/\.[a-z0-9]+$/i, '');
    const c = byKey.get(norm(base));
    if (c) {
      run('UPDATE content SET image = ? WHERE id = ?', fileUrl(f), c.id);
      matched.push(c.name);
    } else unmatched.push(f.originalname);
  }
  res.json({ matched, unmatched });
});

r.put('/admin/catalog/:id', admin, imageUpload.single('image'), (req, res) => {
  const c = get(`SELECT * FROM content WHERE id = ? AND type IN ('classe','especialidade')`, int(req.params.id));
  if (!c) fail(404, 'Item não encontrado');
  const name = str(req.body.name ?? c.name, 100);
  const category = c.type === 'especialidade' ? str(req.body.category ?? c.category, 60) : c.category;
  run('UPDATE content SET name = ?, category = ?, code = ?, icon = ? WHERE id = ?', name, category, str(req.body.code ?? c.code ?? '', 20) || null,
    c.type === 'especialidade' ? iconForArea(category) : c.icon, c.id);
  if (req.file) run('UPDATE content SET image = ? WHERE id = ?', fileUrl(req.file), c.id);
  else if (req.body.remove_image === '1' || req.body.remove_image === true) run('UPDATE content SET image = NULL WHERE id = ?', c.id);
  res.json({ ok: true });
});

r.post('/admin/catalog', admin, imageUpload.single('image'), (req, res) => {
  const type = typeOf(req.body.type);
  const name = str(req.body.name, 100);
  if (name.length < 2) fail(400, 'Informe o nome');
  if (get('SELECT 1 FROM content WHERE type = ? AND name = ? COLLATE NOCASE', type, name)) fail(409, 'Já existe no catálogo');
  const category = type === 'especialidade' ? str(req.body.category, 60) || 'Outras' : '';
  const { lastInsertRowid } = run(
    'INSERT INTO content (type, code, name, icon, category, age, leader, is_free, price_cents) VALUES (?,?,?,?,?,?,?,1,0)',
    type, str(req.body.code, 20) || null, name, type === 'especialidade' ? iconForArea(category) : 'compass', category, type === 'classe' ? int(req.body.age) : null, ['1', 'true', 1, true].includes(req.body.leader) ? 1 : 0,
  );
  if (req.file) run('UPDATE content SET image = ? WHERE id = ?', fileUrl(req.file), lastInsertRowid);
  res.json({ id: Number(lastInsertRowid) });
});

r.delete('/admin/catalog/:id', admin, (req, res) => {
  const id = int(req.params.id);
  if (get('SELECT 1 FROM achievements WHERE content_id = ?', id)) fail(409, 'Há membros com este item no perfil; não dá para excluir');
  run(`DELETE FROM content WHERE id = ? AND type IN ('classe','especialidade')`, id);
  res.json({ ok: true });
});

export default r;
