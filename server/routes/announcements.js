import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { imageUpload, fileUrl } from '../uploads.js';
import { bool, fail, int, str } from '../util.js';

// Anúncios: aparecem grandes no meio da tela quando a pessoa abre o app. No máximo 3 por pessoa,
// um de cada: Brasil (só o administrador geral), distrito (o geral ou o administrador daquele
// distrito) e clube (a diretoria do clube). Cada um desses lugares tem um anúncio por vez: para
// trocar, apaga o atual ou espera acabar. Todo anúncio tem duração em dias e some sozinho no fim.
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

const now = () => new Date().toISOString();
const LIVE = `(expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

// Anúncios antigos (sem duração) ficam 30 dias a partir de agora; em cada lugar fica só o mais novo.
if (!get(`SELECT 1 FROM app_flags WHERE key = 'anuncios-um-por-vez-v1'`)) {
  run(`UPDATE announcements SET expires_at = ? WHERE expires_at IS NULL`, new Date(Date.now() + 30 * 864e5).toISOString());
  run(`UPDATE announcements SET target_type = 'club', target_id = club_id WHERE club_id IS NOT NULL`);
  run(`DELETE FROM announcements WHERE id NOT IN (SELECT MAX(id) FROM announcements GROUP BY target_type, COALESCE(target_id, 0))`);
  run(`INSERT OR IGNORE INTO app_flags (key) VALUES ('anuncios-um-por-vez-v1')`);
}

/** Anúncios que esta conta deve ver: Brasil, o do distrito e o do clube (no máximo 3). */
function visibleTo(actor) {
  return all(
    `SELECT id, title, body, image, link, created_at, club_id, target_type FROM announcements
     WHERE active = 1 AND ${LIVE} AND (
       target_type = 'all'
       OR (target_type = 'district' AND target_id IS ?)
       OR (target_type = 'club' AND target_id IS ?)
     ) ORDER BY CASE target_type WHEN 'all' THEN 0 WHEN 'district' THEN 1 ELSE 2 END LIMIT 3`,
    actor.district_id ?? null, actor.club_id ?? null,
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

// ---------- Gestão (administrador geral, administrador do distrito e diretoria do clube) ----------
const manager = requireAuth('admin', 'club');

/** Lugar do anúncio: o geral escolhe Brasil ou um distrito; o do distrito só o dele; o clube, o próprio clube. */
function slotOf(a, b) {
  if (a.type === 'club') return ['club', a.id];
  if (a.district_id) return ['district', a.district_id];
  if (b.target_type !== 'district') return ['all', null];
  const id = int(b.target_id);
  if (!get('SELECT 1 FROM districts WHERE id = ?', id)) fail(400, 'Escolha o distrito');
  return ['district', id];
}
const slotName = (type, id) => (type === 'all' ? 'o Brasil' : type === 'district' ? `o ${get('SELECT name FROM districts WHERE id = ?', id)?.name || 'distrito'}` : 'o seu clube');
/** Um anúncio por lugar: se já tem um que ainda não acabou, não deixa criar outro. */
function checkFree(type, id, exceptId = 0) {
  const busy = get(`SELECT id, expires_at FROM announcements WHERE target_type = ? AND target_id IS ? AND id <> ? AND ${LIVE}`, type, id, exceptId);
  if (busy) fail(409, `Já existe um anúncio para ${slotName(type, id)} até ${new Date(busy.expires_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Para trocar, apague o atual.`);
}
function daysOf(v, required) {
  if (v === undefined || v === '') { if (required) fail(400, 'Informe quantos dias o anúncio fica no ar'); return null; }
  const d = int(v);
  if (!d || d < 1 || d > 365) fail(400, 'A duração precisa ser de 1 a 365 dias');
  return d;
}
/** Os que esta conta cuida: o geral, todos os de administrador; o do distrito, os do distrito dele; o clube, o dele. */
function mine(a) {
  if (a.type === 'club') return ["target_type = 'club' AND target_id = ?", a.id];
  if (a.district_id) return ["target_type = 'district' AND target_id = ?", a.district_id];
  return ["target_type IN ('all','district')"];
}
/** Só mexe no que criou (o do distrito não mexe no anúncio que o geral fez para o distrito dele). */
const canEdit = (a, row) => a.type === 'club' || !a.district_id || row.created_by === a.id;

r.get(['/announcements/manage', '/admin/announcements'], manager, (req, res) => {
  const [w, ...p] = mine(req.actor);
  const rows = all(`SELECT * FROM announcements WHERE ${w} ORDER BY created_at DESC`, ...p);
  const t = now();
  for (const a of rows) {
    a.target_name = a.target_type === 'district' ? get('SELECT name FROM districts WHERE id = ?', a.target_id)?.name : null;
    a.expired = !!a.expires_at && a.expires_at <= t;
    a.can_edit = canEdit(req.actor, a);
  }
  res.json(rows);
});

r.post(['/announcements/manage', '/admin/announcements'], manager, imageUpload.single('image'), (req, res) => {
  const title = str(req.body.title, 120);
  if (!title) fail(400, 'Informe o título do anúncio');
  if (req.body.link && !normalizeLink(req.body.link)) fail(400, 'Link inválido');
  const days = daysOf(req.body.days, true);
  const [type, id] = slotOf(req.actor, req.body);
  checkFree(type, id);
  const { lastInsertRowid } = run(
    'INSERT INTO announcements (title, body, image, link, active, target_type, target_id, club_id, expires_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
    title, str(req.body.body, 4000), fileUrl(req.file), normalizeLink(req.body.link), bool(req.body.active ?? true) ? 1 : 0,
    type, id, req.actor.type === 'club' ? req.actor.id : null, new Date(Date.now() + days * 864e5).toISOString(), req.actor.type === 'admin' ? req.actor.id : null,
  );
  res.json({ id: Number(lastInsertRowid) });
});

r.put(['/announcements/manage/:id', '/admin/announcements/:id'], manager, imageUpload.single('image'), (req, res) => {
  const [w, ...p] = mine(req.actor);
  const a = get(`SELECT * FROM announcements WHERE id = ? AND ${w}`, int(req.params.id), ...p);
  if (!a) fail(404, 'Anúncio não encontrado');
  if (!canEdit(req.actor, a)) fail(403, 'Este anúncio foi criado pelo administrador geral');
  const title = str(req.body.title ?? a.title, 120);
  if (!title) fail(400, 'Informe o título do anúncio');
  if (req.body.link && !normalizeLink(req.body.link)) fail(400, 'Link inválido');
  const [type, id] = req.body.target_type === undefined ? [a.target_type, a.target_id] : slotOf(req.actor, req.body);
  if (type !== a.target_type || id !== a.target_id) checkFree(type, id, a.id);
  const days = daysOf(req.body.days, false);
  const expires = days ? new Date(Date.now() + days * 864e5).toISOString() : a.expires_at;
  if (expires && expires <= now() && !days) {
    // Acabou: para voltar ao ar precisa dizer quantos dias.
    if (req.body.active !== undefined && bool(req.body.active)) fail(400, 'Este anúncio já acabou. Informe quantos dias ele fica no ar de novo.');
  }
  if (days) checkFree(type, id, a.id);
  run(
    'UPDATE announcements SET title = ?, body = ?, link = ?, active = ?, target_type = ?, target_id = ?, expires_at = ?, image = COALESCE(?, image) WHERE id = ?',
    title, str(req.body.body ?? a.body, 4000), req.body.link === undefined ? a.link : normalizeLink(req.body.link),
    req.body.active === undefined ? a.active : bool(req.body.active) ? 1 : 0, type, id, expires, fileUrl(req.file), a.id,
  );
  res.json({ ok: true });
});

r.delete(['/announcements/manage/:id', '/admin/announcements/:id'], manager, (req, res) => {
  const [w, ...p] = mine(req.actor);
  const a = get(`SELECT * FROM announcements WHERE id = ? AND ${w}`, int(req.params.id), ...p);
  if (a && !canEdit(req.actor, a)) fail(403, 'Este anúncio foi criado pelo administrador geral');
  if (a) run('DELETE FROM announcements WHERE id = ?', a.id);
  res.json({ ok: true });
});

export default r;
