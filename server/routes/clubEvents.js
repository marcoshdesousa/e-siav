import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { attachmentUpload } from '../uploads.js';
import { fail, int, parseJson, memberKind } from '../util.js';
import { eventFields, attachmentsOf } from './admin.js';

// Eventos do clube (ex.: acampamento local): só a diretoria daquele clube cria,
// marca participantes do próprio clube e o aviso aparece só para os membros dele.
const r = Router();
r.use('/club/events', requireAuth('club'));

function ownEvent(req) {
  const e = get('SELECT * FROM events WHERE id = ? AND club_id = ?', int(req.params.id), req.actor.id);
  if (!e) fail(404, 'Evento não encontrado');
  return e;
}

r.get('/club/events', (req, res) => {
  const events = all('SELECT * FROM events WHERE club_id = ? ORDER BY date DESC', req.actor.id);
  for (const e of events) {
    e.attachments = parseJson(e.attachments, []);
    e.participants = all(
      `SELECT p.target_type, p.target_id, COALESCE(m.name, c.name) AS name FROM event_participants p
       LEFT JOIN members m ON p.target_type = 'member' AND m.id = p.target_id
       LEFT JOIN clubs c ON p.target_type = 'club' AND c.id = p.target_id
       WHERE p.event_id = ?`, e.id,
    );
  }
  res.json(events);
});

r.post('/club/events', attachmentUpload.array('files', 10), (req, res) => {
  const f = eventFields(req.body);
  f[4] = get('SELECT district_id FROM clubs WHERE id = ?', req.actor.id).district_id; // distrito do próprio clube
  const id = tx(() => {
    const id = Number(run('INSERT INTO events (name, description, date, location, district_id, promote, attachments, club_id) VALUES (?,?,?,?,?,?,?,?)', ...f, attachmentsOf(req), req.actor.id).lastInsertRowid);
    run(`INSERT INTO event_participants (event_id, target_type, target_id) VALUES (?, 'club', ?)`, id, req.actor.id);
    return id;
  });
  res.json({ id });
});

r.put('/club/events/:id', attachmentUpload.array('files', 10), (req, res) => {
  const e = ownEvent(req);
  const f = eventFields(req.body);
  f[4] = e.district_id;
  run('UPDATE events SET name = ?, description = ?, date = ?, location = ?, district_id = ?, promote = ?, attachments = ? WHERE id = ?',
    ...f, attachmentsOf(req, parseJson(e.attachments, [])), e.id);
  res.json({ ok: true });
});

r.delete('/club/events/:id', (req, res) => {
  const e = ownEvent(req);
  run('DELETE FROM events WHERE id = ?', e.id);
  res.json({ ok: true });
});

// Participantes: só membros do próprio clube (e o próprio clube).
r.post('/club/events/:id/participants', (req, res) => {
  const e = ownEvent(req);
  let added = 0;
  tx(() => {
    for (const id of (req.body.members || []).map(Number)) {
      if (!get('SELECT 1 FROM members WHERE id = ? AND club_id = ?', id, req.actor.id)) continue;
      added += run(`INSERT OR IGNORE INTO event_participants (event_id, target_type, target_id) VALUES (?, 'member', ?)`, e.id, id).changes;
    }
    if ((req.body.clubs || []).map(Number).includes(req.actor.id)) {
      added += run(`INSERT OR IGNORE INTO event_participants (event_id, target_type, target_id) VALUES (?, 'club', ?)`, e.id, req.actor.id).changes;
    }
  });
  res.json({ ok: true, added });
});

r.delete('/club/events/:id/participants/:type/:tid', (req, res) => {
  const e = ownEvent(req);
  run('DELETE FROM event_participants WHERE event_id = ? AND target_type = ? AND target_id = ?', e.id, req.params.type, int(req.params.tid));
  res.json({ ok: true });
});

// Diretório do próprio clube (unidades → pessoas), no mesmo formato do admin.
r.get('/club/directory', requireAuth('club'), (req, res) => {
  const c = get('SELECT c.id, c.name, c.logo, c.district_id, d.name AS district_name FROM clubs c JOIN districts d ON d.id = c.district_id WHERE c.id = ?', req.actor.id);
  c.units = all('SELECT id, name, logo, is_leadership FROM units WHERE club_id = ? ORDER BY is_leadership, name', c.id);
  const members = all('SELECT id, name, photo, handle, cargo, unit_id, birth_date FROM members WHERE club_id = ? ORDER BY name', c.id);
  for (const m of members) { m.kind = memberKind(m.birth_date); delete m.birth_date; }
  for (const u of c.units) u.members = members.filter((m) => m.unit_id === u.id);
  c.no_unit = members.filter((m) => !m.unit_id);
  res.json([c]);
});

export default r;
