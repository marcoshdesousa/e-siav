import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth, setLogin, getUsername } from '../auth.js';
import { imageUpload, fileUrl, attachmentUpload } from '../uploads.js';
import { NOME_UNIDADE_LIDERANCA } from '../config.js';
import { fail, int, str, validDate, parseJson, memberKind } from '../util.js';

// Painel do Administrador Geral.
// Observação: não existe aqui nenhuma rota que altere nome ou dados de membros —
// isso é exclusivo do clube ao qual o membro pertence.
const r = Router();
r.use('/admin', requireAuth('admin'));

r.get('/admin/overview', (_req, res) => {
  const n = (sql) => get(sql).n;
  res.json({
    districts: n('SELECT COUNT(*) n FROM districts'),
    clubs: n('SELECT COUNT(*) n FROM clubs'),
    units: n('SELECT COUNT(*) n FROM units WHERE is_leadership = 0'),
    members: n('SELECT COUNT(*) n FROM members'),
    pending_reviews: n(`SELECT COUNT(*) n FROM submissions s JOIN requirements r ON r.id = s.requirement_id WHERE r.creator_type = 'admin' AND s.status = 'enviado'`),
    open_reports: n(`SELECT COUNT(*) n FROM reports WHERE status = 'aberta'`),
    pending_purchases: n(`SELECT COUNT(*) n FROM purchases WHERE status = 'pendente'`),
    requirements: n(`SELECT COUNT(*) n FROM requirements WHERE creator_type = 'admin'`),
  });
});

// ---------- Distritos ----------
r.get('/admin/districts', (_req, res) => {
  res.json(all(`SELECT d.*, (SELECT COUNT(*) FROM clubs c WHERE c.district_id = d.id) AS club_count FROM districts d ORDER BY d.name`));
});
r.post('/admin/districts', (req, res) => {
  const name = str(req.body.name, 80);
  if (!name) fail(400, 'Informe o nome do distrito');
  const { lastInsertRowid } = run('INSERT INTO districts (name) VALUES (?)', name);
  res.json({ id: Number(lastInsertRowid) });
});
r.put('/admin/districts/:id', (req, res) => {
  const name = str(req.body.name, 80);
  if (!name) fail(400, 'Informe o nome do distrito');
  run('UPDATE districts SET name = ? WHERE id = ?', name, int(req.params.id));
  res.json({ ok: true });
});

// ---------- Clubes ----------
r.get('/admin/clubs', (_req, res) => {
  const rows = all(
    `SELECT c.id, c.name, c.logo, c.district_id, d.name AS district_name,
            (SELECT COUNT(*) FROM members m WHERE m.club_id = c.id) AS member_count,
            (SELECT COUNT(*) FROM units u WHERE u.club_id = c.id) AS unit_count
     FROM clubs c JOIN districts d ON d.id = c.district_id ORDER BY d.name, c.name`,
  );
  rows.forEach((c) => (c.username = getUsername('club', c.id)));
  res.json(rows);
});

r.post('/admin/clubs', (req, res) => {
  const name = str(req.body.name, 100);
  const districtId = int(req.body.district_id);
  if (!name) fail(400, 'Informe o nome do clube');
  if (!get('SELECT 1 FROM districts WHERE id = ?', districtId)) fail(400, 'Distrito inválido');
  const id = tx(() => {
    const id = Number(run('INSERT INTO clubs (district_id, name) VALUES (?, ?)', districtId, name).lastInsertRowid);
    run('INSERT INTO units (club_id, name, is_leadership) VALUES (?, ?, 1)', id, NOME_UNIDADE_LIDERANCA);
    setLogin('club', id, req.body.username, req.body.password);
    return id;
  });
  res.json({ id });
});

r.put('/admin/clubs/:id', (req, res) => {
  const id = int(req.params.id);
  if (!get('SELECT 1 FROM clubs WHERE id = ?', id)) fail(404, 'Clube não encontrado');
  tx(() => {
    const name = str(req.body.name, 100);
    if (name) run('UPDATE clubs SET name = ? WHERE id = ?', name, id);
    const districtId = int(req.body.district_id);
    if (districtId) {
      if (!get('SELECT 1 FROM districts WHERE id = ?', districtId)) fail(400, 'Distrito inválido');
      run('UPDATE clubs SET district_id = ? WHERE id = ?', districtId, id);
    }
    if (req.body.username || req.body.password) setLogin('club', id, req.body.username, req.body.password);
  });
  res.json({ ok: true });
});

// ---------- Administradores ----------
r.get('/admin/admins', (_req, res) => {
  const rows = all('SELECT id, name, created_at FROM admins ORDER BY id');
  rows.forEach((a) => (a.username = getUsername('admin', a.id)));
  res.json(rows);
});
r.post('/admin/admins', (req, res) => {
  const name = str(req.body.name, 100);
  if (!name) fail(400, 'Informe o nome');
  const id = tx(() => {
    const id = Number(run('INSERT INTO admins (name, created_by) VALUES (?, ?)', name, req.actor.id).lastInsertRowid);
    setLogin('admin', id, req.body.username, req.body.password);
    return id;
  });
  res.json({ id });
});
r.put('/admin/admins/:id', (req, res) => {
  const id = int(req.params.id);
  if (!get('SELECT 1 FROM admins WHERE id = ?', id)) fail(404, 'Administrador não encontrado');
  tx(() => {
    const name = str(req.body.name, 100);
    if (name) run('UPDATE admins SET name = ? WHERE id = ?', name, id);
    if (req.body.username || req.body.password) setLogin('admin', id, req.body.username, req.body.password);
  });
  res.json({ ok: true });
});

// ---------- Busca de destinatários (medalhas/eventos/acesso) ----------
r.get('/admin/targets', (req, res) => {
  const q = '%' + str(req.query.q, 60) + '%';
  const type = req.query.type;
  if (type === 'club') {
    return res.json(all(`SELECT c.id, c.name, c.logo, d.name AS sub FROM clubs c JOIN districts d ON d.id = c.district_id WHERE c.name LIKE ? ORDER BY c.name LIMIT 30`, q));
  }
  if (type === 'unit') {
    return res.json(all(`SELECT u.id, u.name, u.logo, c.name AS sub FROM units u JOIN clubs c ON c.id = u.club_id WHERE u.name LIKE ? OR c.name LIKE ? ORDER BY c.name, u.name LIMIT 30`, q, q));
  }
  if (type === 'member') {
    return res.json(all(`SELECT m.id, m.name, m.photo, m.code, c.name || ' · ' || m.code AS sub FROM members m JOIN clubs c ON c.id = m.club_id WHERE m.name LIKE ? OR m.code LIKE ? ORDER BY m.name LIMIT 30`, q, q));
  }
  fail(400, 'Tipo inválido');
});

// ---------- Medalhas e troféus ----------
r.get('/admin/medals', (_req, res) => {
  res.json(all(`SELECT m.*, (SELECT COUNT(*) FROM medal_awards a WHERE a.medal_id = m.id) AS award_count FROM medals m ORDER BY m.created_at DESC`));
});
r.post('/admin/medals', imageUpload.single('icon_file'), (req, res) => {
  const name = str(req.body.name, 100);
  const kind = req.body.kind === 'trofeu' ? 'trofeu' : 'medalha';
  const icon = req.file ? fileUrl(req.file) : str(req.body.icon, 16) || (kind === 'trofeu' ? 'trophy' : 'medal');
  if (!name) fail(400, 'Informe o nome');
  const { lastInsertRowid } = run('INSERT INTO medals (kind, name, icon, description) VALUES (?,?,?,?)', kind, name, icon, str(req.body.description, 500));
  res.json({ id: Number(lastInsertRowid) });
});
r.delete('/admin/medals/:id', (req, res) => {
  run('DELETE FROM medals WHERE id = ?', int(req.params.id));
  res.json({ ok: true });
});

const targetName = (type, id) => {
  if (type === 'club') return get('SELECT name FROM clubs WHERE id = ?', id)?.name;
  if (type === 'unit') return get(`SELECT u.name || ' (' || c.name || ')' AS name FROM units u JOIN clubs c ON c.id = u.club_id WHERE u.id = ?`, id)?.name;
  if (type === 'member') return get(`SELECT m.name || ' (' || c.name || ')' AS name FROM members m JOIN clubs c ON c.id = m.club_id WHERE m.id = ?`, id)?.name;
};

r.get('/admin/medals/:id/awards', (req, res) => {
  const rows = all('SELECT * FROM medal_awards WHERE medal_id = ? ORDER BY awarded_at DESC', int(req.params.id));
  rows.forEach((a) => (a.target_name = targetName(a.target_type, a.target_id) || '(removido)'));
  res.json(rows);
});

// Entrega manual: o administrador escolhe quem recebe.
r.post('/admin/medals/:id/award', (req, res) => {
  const medalId = int(req.params.id);
  const { target_type: type } = req.body;
  const targetId = int(req.body.target_id);
  if (!['club', 'unit', 'member'].includes(type)) fail(400, 'Destinatário inválido');
  if (!targetName(type, targetId)) fail(404, 'Destinatário não encontrado');
  if (!get('SELECT 1 FROM medals WHERE id = ?', medalId)) fail(404, 'Medalha não encontrada');
  run('INSERT INTO medal_awards (medal_id, target_type, target_id, note, awarded_by) VALUES (?,?,?,?,?)', medalId, type, targetId, str(req.body.note, 200), req.actor.id);
  res.json({ ok: true });
});
r.delete('/admin/awards/:id', (req, res) => {
  run('DELETE FROM medal_awards WHERE id = ?', int(req.params.id));
  res.json({ ok: true });
});

// ---------- Eventos ----------
r.get('/admin/events', (_req, res) => {
  const events = all(`SELECT e.*, d.name AS district_name FROM events e LEFT JOIN districts d ON d.id = e.district_id ORDER BY e.date DESC`);
  for (const e of events) {
    e.attachments = parseJson(e.attachments, []);
    e.participants = all('SELECT target_type, target_id FROM event_participants WHERE event_id = ?', e.id);
    e.participants.forEach((p) => (p.name = targetName(p.target_type, p.target_id) || '(removido)'));
  }
  res.json(events);
});
function eventFields(body) {
  const name = str(body.name, 120);
  if (!name) fail(400, 'Informe o nome do evento');
  if (!validDate(body.date)) fail(400, 'Informe a data do evento');
  return [name, str(body.description, 1000), body.date, str(body.location, 120), int(body.district_id), body.promote === undefined ? 1 : ['1', 'true', 1, true, 'on'].includes(body.promote) ? 1 : 0];
}
/** Anexos do evento (fotos e PDF): mantém os que vieram em "keep" e soma os novos. */
function attachmentsOf(req, current = []) {
  const keepUrls = parseJson(req.body.keep, null);
  const kept = Array.isArray(keepUrls) ? current.filter((a) => keepUrls.includes(a.url)) : current;
  const added = (req.files || []).map((f) => ({
    url: fileUrl(f), name: str(f.originalname, 120) || 'anexo', type: f.mimetype === 'application/pdf' ? 'pdf' : 'image',
  }));
  return JSON.stringify([...kept, ...added].slice(0, 10));
}
r.post('/admin/events', attachmentUpload.array('files', 10), (req, res) => {
  const { lastInsertRowid } = run('INSERT INTO events (name, description, date, location, district_id, promote, attachments) VALUES (?,?,?,?,?,?,?)', ...eventFields(req.body), attachmentsOf(req));
  res.json({ id: Number(lastInsertRowid) });
});
r.put('/admin/events/:id', attachmentUpload.array('files', 10), (req, res) => {
  const ev = get('SELECT * FROM events WHERE id = ?', int(req.params.id));
  if (!ev) fail(404, 'Evento não encontrado');
  run('UPDATE events SET name = ?, description = ?, date = ?, location = ?, district_id = ?, promote = ?, attachments = ? WHERE id = ?',
    ...eventFields(req.body), attachmentsOf(req, parseJson(ev.attachments, [])), ev.id);
  res.json({ ok: true });
});
r.delete('/admin/events/:id', (req, res) => {
  run('DELETE FROM events WHERE id = ?', int(req.params.id));
  res.json({ ok: true });
});
// Marca participantes de uma vez: clubes e/ou membros (lista de ids).
r.post('/admin/events/:id/participants', (req, res) => {
  const eventId = int(req.params.id);
  if (!get('SELECT 1 FROM events WHERE id = ?', eventId)) fail(404, 'Evento não encontrado');
  const list = [];
  if (req.body.target_type) list.push([req.body.target_type, int(req.body.target_id)]);
  for (const id of req.body.clubs || []) list.push(['club', int(id)]);
  for (const id of req.body.members || []) list.push(['member', int(id)]);
  let added = 0;
  tx(() => {
    for (const [type, id] of list) {
      if (!['club', 'member'].includes(type) || !targetName(type, id)) continue;
      added += run('INSERT OR IGNORE INTO event_participants (event_id, target_type, target_id) VALUES (?,?,?)', eventId, type, id).changes;
    }
  });
  res.json({ ok: true, added });
});
r.delete('/admin/events/:id/participants/:type/:tid', (req, res) => {
  run('DELETE FROM event_participants WHERE event_id = ? AND target_type = ? AND target_id = ?', int(req.params.id), req.params.type, int(req.params.tid));
  res.json({ ok: true });
});

// ---------- Diretório: clubes → unidades → pessoas (para escolher destinatários) ----------
r.get('/admin/directory', (_req, res) => {
  const clubs = all('SELECT c.id, c.name, c.logo, c.district_id, d.name AS district_name FROM clubs c JOIN districts d ON d.id = c.district_id ORDER BY d.name, c.name');
  for (const c of clubs) {
    c.units = all('SELECT id, name, logo, is_leadership FROM units WHERE club_id = ? ORDER BY is_leadership, name', c.id);
    const members = all('SELECT id, name, photo, handle, cargo, unit_id, birth_date FROM members WHERE club_id = ? ORDER BY name', c.id);
    for (const m of members) { m.kind = memberKind(m.birth_date); delete m.birth_date; }
    for (const u of c.units) u.members = members.filter((m) => m.unit_id === u.id);
    c.no_unit = members.filter((m) => !m.unit_id);
  }
  res.json(clubs);
});

// ---------- Entregar conteúdo ----------
// Medalha/troféu → clubes, unidades e/ou pessoas. Curso → pessoas
// (liberar o acesso, inclusive de curso pago, ou registrar como concluído).
r.post('/admin/deliver', (req, res) => {
  const b = req.body;
  const ids = (v) => [...new Set((Array.isArray(v) ? v : []).map(Number).filter(Boolean))];
  const clubs = ids(b.clubs), units = ids(b.units), members = ids(b.members);
  if (!clubs.length && !units.length && !members.length) fail(400, 'Escolha pelo menos um destinatário');
  let delivered = 0;
  if (b.item_type === 'medal') {
    const medal = get('SELECT id FROM medals WHERE id = ?', int(b.item_id));
    if (!medal) fail(404, 'Medalha ou troféu não encontrado');
    tx(() => {
      for (const [type, list, table] of [['club', clubs, 'clubs'], ['unit', units, 'units'], ['member', members, 'members']]) {
        for (const id of list) {
          if (!get(`SELECT 1 FROM ${table} WHERE id = ?`, id)) continue;
          run('INSERT INTO medal_awards (medal_id, target_type, target_id, note, awarded_by) VALUES (?,?,?,?,?)', medal.id, type, id, str(b.note, 200) || null, req.actor.id);
          delivered++;
        }
      }
    });
  } else if (b.item_type === 'content') {
    // Classes e especialidades não são entregues pelo admin (quem registra é a diretoria do clube).
    const c = get(`SELECT id, type FROM content WHERE id = ? AND type = 'curso'`, int(b.item_id));
    if (!c) fail(404, 'Curso não encontrado');
    if (!members.length) fail(400, 'Escolha as pessoas que vão receber');
    const action = b.action === 'acesso' ? 'acesso' : 'concluir';
    tx(() => {
      for (const id of members) {
        if (!get('SELECT 1 FROM members WHERE id = ?', id)) continue;
        if (action === 'acesso') run(`INSERT OR REPLACE INTO content_access (member_id, content_id, source) VALUES (?, ?, 'admin')`, id, c.id);
        else run(`INSERT OR IGNORE INTO achievements (member_id, content_id, source) VALUES (?, ?, 'admin')`, id, c.id);
        delivered++;
      }
    });
  } else fail(400, 'Escolha o que vai entregar');
  res.json({ ok: true, delivered });
});

export default r;
