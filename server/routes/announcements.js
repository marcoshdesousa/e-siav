import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { imageUpload, fileUrl } from '../uploads.js';
import { bool, fail, int, str } from '../util.js';

// Anúncios: aparecem grandes no meio da tela quando a pessoa abre o app.
const r = Router();

const safeLink = (v) => {
  const s = str(v, 500);
  return /^https?:\/\//i.test(s) ? s : null;
};

r.get('/announcements/active', requireAuth(), (_req, res) => {
  res.json(all('SELECT id, title, body, image, link, created_at FROM announcements WHERE active = 1 ORDER BY created_at DESC LIMIT 3'));
});

// Eventos (sempre grátis) aparecem como anúncio na abertura do app até a data do evento.
r.get('/events/upcoming', requireAuth(), (req, res) => {
  const today = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10); // fuso do Brasil
  const district = req.actor.district_id ?? null;
  const rows = all(
    `SELECT id, name, description, date, location, attachments FROM events
     WHERE promote = 1 AND date >= ? AND (district_id IS NULL OR ? IS NULL OR district_id = ?) ORDER BY date LIMIT 3`,
    today, district, district,
  );
  res.json(rows.map((e) => ({ ...e, attachments: JSON.parse(e.attachments || '[]') })));
});

const admin = requireAuth('admin');

r.get('/admin/announcements', admin, (_req, res) => {
  res.json(all('SELECT * FROM announcements ORDER BY created_at DESC'));
});

r.post('/admin/announcements', admin, imageUpload.single('image'), (req, res) => {
  const title = str(req.body.title, 120);
  if (!title) fail(400, 'Informe o título do anúncio');
  const { lastInsertRowid } = run(
    'INSERT INTO announcements (title, body, image, link, active) VALUES (?,?,?,?,?)',
    title, str(req.body.body, 4000), fileUrl(req.file), safeLink(req.body.link), bool(req.body.active ?? true) ? 1 : 0,
  );
  res.json({ id: Number(lastInsertRowid) });
});

r.put('/admin/announcements/:id', admin, imageUpload.single('image'), (req, res) => {
  const a = get('SELECT * FROM announcements WHERE id = ?', int(req.params.id));
  if (!a) fail(404, 'Anúncio não encontrado');
  const title = str(req.body.title ?? a.title, 120);
  if (!title) fail(400, 'Informe o título do anúncio');
  run(
    'UPDATE announcements SET title = ?, body = ?, link = ?, active = ?, image = COALESCE(?, image) WHERE id = ?',
    title, str(req.body.body ?? a.body, 4000), req.body.link === undefined ? a.link : safeLink(req.body.link),
    req.body.active === undefined ? a.active : bool(req.body.active) ? 1 : 0, fileUrl(req.file), a.id,
  );
  res.json({ ok: true });
});

r.delete('/admin/announcements/:id', admin, (req, res) => {
  run('DELETE FROM announcements WHERE id = ?', int(req.params.id));
  res.json({ ok: true });
});

export default r;
