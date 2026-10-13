import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { imageUpload, fileUrl } from '../uploads.js';
import { bool, fail, int, str } from '../util.js';

// Anúncios: aparecem grandes no meio da tela quando a pessoa abre o app.
// Administrador Geral escolhe o público (todos, um distrito ou um clube).
// A diretoria de um clube publica só para os membros e unidades do próprio clube.
const r = Router();

/** Aceita "www.site.com" e completa com https://. Só links web. */
export function normalizeLink(v) {
  let s = str(v, 500);
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Anúncios que esta conta deve ver. */
function visibleTo(actor) {
  return all(
    `SELECT id, title, body, image, link, created_at, club_id FROM announcements
     WHERE active = 1 AND (
       (club_id IS NULL AND (target_type = 'all'
         OR (target_type = 'district' AND target_id IS ?)
         OR (target_type = 'club' AND target_id IS ?)))
       OR (club_id IS NOT NULL AND club_id IS ?)
     ) ORDER BY created_at DESC LIMIT 5`,
    actor.district_id ?? null, actor.club_id ?? null, actor.club_id ?? null,
  );
}

r.get('/announcements/active', requireAuth(), (req, res) => res.json(visibleTo(req.actor)));

// Eventos (sempre grátis) aparecem como anúncio na abertura do app até a data do evento.
// Evento de clube aparece só para aquele clube.
r.get('/events/upcoming', requireAuth(), (req, res) => {
  const today = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10); // fuso do Brasil
  const district = req.actor.district_id ?? null;
  const club = req.actor.club_id ?? null;
  const rows = all(
    `SELECT id, name, description, date, location, attachments, club_id FROM events
     WHERE promote = 1 AND date >= ?
       AND ((club_id IS NULL AND (district_id IS NULL OR ? IS NULL OR district_id = ?)) OR (club_id IS NOT NULL AND club_id IS ?))
     ORDER BY date LIMIT 3`,
    today, district, district, club,
  );
  res.json(rows.map((e) => ({ ...e, attachments: JSON.parse(e.attachments || '[]') })));
});

// ---------- Gestão (Administrador Geral e diretoria do clube) ----------
const manager = requireAuth('admin', 'club');
const own = (a) => (a.type === 'admin' ? ['club_id IS NULL'] : ['club_id = ?', a.id]);

function targetOf(a, b) {
  if (a.type === 'club') return ['club', a.id];
  const type = ['all', 'district', 'club'].includes(b.target_type) ? b.target_type : 'all';
  if (type === 'all') return ['all', null];
  const id = int(b.target_id);
  const table = type === 'district' ? 'districts' : 'clubs';
  if (!get(`SELECT 1 FROM ${table} WHERE id = ?`, id)) fail(400, type === 'district' ? 'Escolha o distrito' : 'Escolha o clube');
  return [type, id];
}

r.get(['/announcements/manage', '/admin/announcements'], manager, (req, res) => {
  const [w, ...p] = own(req.actor);
  const rows = all(`SELECT * FROM announcements WHERE ${w} ORDER BY created_at DESC`, ...p);
  for (const a of rows) {
    a.target_name = a.target_type === 'district' ? get('SELECT name FROM districts WHERE id = ?', a.target_id)?.name
      : a.target_type === 'club' ? get('SELECT name FROM clubs WHERE id = ?', a.target_id)?.name : null;
  }
  res.json(rows);
});

r.post(['/announcements/manage', '/admin/announcements'], manager, imageUpload.single('image'), (req, res) => {
  const title = str(req.body.title, 120);
  if (!title) fail(400, 'Informe o título do anúncio');
  if (req.body.link && !normalizeLink(req.body.link)) fail(400, 'Link inválido');
  const [type, id] = targetOf(req.actor, req.body);
  const { lastInsertRowid } = run(
    'INSERT INTO announcements (title, body, image, link, active, target_type, target_id, club_id) VALUES (?,?,?,?,?,?,?,?)',
    title, str(req.body.body, 4000), fileUrl(req.file), normalizeLink(req.body.link), bool(req.body.active ?? true) ? 1 : 0,
    type, id, req.actor.type === 'club' ? req.actor.id : null,
  );
  res.json({ id: Number(lastInsertRowid) });
});

r.put(['/announcements/manage/:id', '/admin/announcements/:id'], manager, imageUpload.single('image'), (req, res) => {
  const [w, ...p] = own(req.actor);
  const a = get(`SELECT * FROM announcements WHERE id = ? AND ${w}`, int(req.params.id), ...p);
  if (!a) fail(404, 'Anúncio não encontrado');
  const title = str(req.body.title ?? a.title, 120);
  if (!title) fail(400, 'Informe o título do anúncio');
  if (req.body.link && !normalizeLink(req.body.link)) fail(400, 'Link inválido');
  const [type, id] = req.body.target_type === undefined && req.actor.type === 'admin' ? [a.target_type, a.target_id] : targetOf(req.actor, req.body);
  run(
    'UPDATE announcements SET title = ?, body = ?, link = ?, active = ?, target_type = ?, target_id = ?, image = COALESCE(?, image) WHERE id = ?',
    title, str(req.body.body ?? a.body, 4000), req.body.link === undefined ? a.link : normalizeLink(req.body.link),
    req.body.active === undefined ? a.active : bool(req.body.active) ? 1 : 0, type, id, fileUrl(req.file), a.id,
  );
  res.json({ ok: true });
});

r.delete(['/announcements/manage/:id', '/admin/announcements/:id'], manager, (req, res) => {
  const [w, ...p] = own(req.actor);
  run(`DELETE FROM announcements WHERE id = ? AND ${w}`, int(req.params.id), ...p);
  res.json({ ok: true });
});

export default r;
