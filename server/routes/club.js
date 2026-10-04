import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth, setLogin, getUsername, deleteLogin } from '../auth.js';
import { imageUpload, fileUrl } from '../uploads.js';
import { CARGOS, CARGO_PADRAO } from '../config.js';
import { fail, int, str, bool, memberKind, ageFrom, validDate, newMemberCode, parseJson } from '../util.js';
import { clubProfile } from '../profiles.js';
import { clubUnitsRanking } from '../rankings.js';

// Sistema do Clube: conta única da secretaria, diretores e diretores associados.
// Toda consulta é filtrada por club_id = clube logado: cada clube só vê e edita os seus.
const r = Router();
r.use('/club', requireAuth('club'));

const leadershipUnit = (clubId) => get('SELECT id FROM units WHERE club_id = ? AND is_leadership = 1', clubId).id;

r.get('/club/overview', (req, res) => {
  const id = req.actor.id;
  const profile = clubProfile(id);
  profile.username = getUsername('club', id);
  profile.pending_reviews = get(`SELECT COUNT(*) n FROM submissions s JOIN requirements r ON r.id = s.requirement_id WHERE r.creator_type = 'club' AND r.club_id = ? AND s.status = 'enviado'`, id).n;
  profile.pending_achievements = get(`SELECT COUNT(*) n FROM achievement_requests q JOIN members m ON m.id = q.member_id WHERE m.club_id = ? AND q.status = 'pendente'`, id).n;
  profile.open_reports = get(`SELECT COUNT(*) n FROM reports WHERE status = 'aberta' AND (club_id = ? OR reported_club_id = ?)`, id, id).n;
  profile.desbravadores = 0;
  profile.lideranca = 0;
  for (const m of all('SELECT birth_date FROM members WHERE club_id = ?', id)) {
    memberKind(m.birth_date) === 'desbravador' ? profile.desbravadores++ : profile.lideranca++;
  }
  profile.units_ranking = clubUnitsRanking(id);
  res.json(profile);
});

r.put('/club/profile', imageUpload.fields([{ name: 'photo', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), (req, res) => {
  const photo = req.files?.photo?.[0];
  const logo = req.files?.logo?.[0];
  if (photo) run('UPDATE clubs SET photo = ? WHERE id = ?', fileUrl(photo), req.actor.id);
  if (logo) run('UPDATE clubs SET logo = ? WHERE id = ?', fileUrl(logo), req.actor.id);
  res.json({ ok: true });
});

// ---------- Membros ----------
function ownMember(req) {
  const m = get('SELECT * FROM members WHERE id = ? AND club_id = ?', int(req.params.id), req.actor.id);
  if (!m) fail(404, 'Membro não encontrado neste clube');
  return m;
}

r.get('/club/members', (req, res) => {
  const rows = all(
    `SELECT m.id, m.name, m.photo, m.cargo, m.code, m.handle, m.birth_date, m.excellence, m.unit_id, u.name AS unit_name
     FROM members m LEFT JOIN units u ON u.id = m.unit_id WHERE m.club_id = ? ORDER BY m.name`,
    req.actor.id,
  );
  for (const m of rows) {
    m.age = ageFrom(m.birth_date);
    m.kind = memberKind(m.birth_date);
    m.username = getUsername('member', m.id);
  }
  res.json(rows);
});

r.get('/club/members/:id', (req, res) => {
  const m = ownMember(req);
  m.age = ageFrom(m.birth_date);
  m.kind = memberKind(m.birth_date);
  m.username = getUsername('member', m.id);
  m.achievements = all('SELECT content_id, source FROM achievements WHERE member_id = ?', m.id);
  res.json(m);
});

/** Valida e normaliza os campos do membro. A idade define o tipo de conta. */
function memberFields(req, existing) {
  const b = req.body;
  const name = str(b.name ?? existing?.name, 120);
  const birth = b.birth_date ?? existing?.birth_date;
  if (!name) fail(400, 'Informe o nome');
  if (!validDate(birth)) fail(400, 'Informe a data de nascimento');
  const kind = memberKind(birth);
  if (!kind) fail(400, 'O membro precisa ter pelo menos 10 anos');
  let cargo = str(b.cargo ?? existing?.cargo, 60);
  if (!CARGOS[kind].includes(cargo)) cargo = CARGO_PADRAO[kind];

  let unitId = b.unit_id === undefined ? existing?.unit_id ?? null : int(b.unit_id);
  if (unitId) {
    const u = get('SELECT * FROM units WHERE id = ? AND club_id = ?', unitId, req.actor.id);
    if (!u) fail(400, 'Unidade inválida');
    if (u.is_leadership && kind === 'desbravador') fail(400, 'Desbravadores não podem entrar na unidade Liderança');
  }
  // Liderança sem unidade entra automaticamente na unidade "Liderança".
  if (!unitId && kind === 'lideranca') unitId = leadershipUnit(req.actor.id);
  const excellence = b.excellence === undefined ? existing?.excellence ?? 0 : bool(b.excellence) ? 1 : 0;
  return { name, birth, cargo, unitId, excellence };
}

r.post('/club/members', imageUpload.single('photo'), (req, res) => {
  const f = memberFields(req);
  const id = tx(() => {
    const id = Number(run(
      'INSERT INTO members (club_id, unit_id, name, birth_date, photo, cargo, code, excellence) VALUES (?,?,?,?,?,?,?,?)',
      req.actor.id, f.unitId, f.name, f.birth, fileUrl(req.file), f.cargo, newMemberCode(), f.excellence,
    ).lastInsertRowid);
    setLogin('member', id, req.body.username, req.body.password);
    return id;
  });
  res.json({ id });
});

r.put('/club/members/:id', imageUpload.single('photo'), (req, res) => {
  const m = ownMember(req);
  const f = memberFields(req, m);
  tx(() => {
    run('UPDATE members SET name = ?, birth_date = ?, cargo = ?, unit_id = ?, excellence = ? WHERE id = ? AND club_id = ?',
      f.name, f.birth, f.cargo, f.unitId, f.excellence, m.id, req.actor.id);
    if (req.file) run('UPDATE members SET photo = ? WHERE id = ?', fileUrl(req.file), m.id);
    if (req.body.username || req.body.password) setLogin('member', m.id, req.body.username, req.body.password);
  });
  res.json({ ok: true });
});

r.delete('/club/members/:id', (req, res) => {
  const m = ownMember(req);
  tx(() => {
    deleteLogin('member', m.id);
    run('DELETE FROM members WHERE id = ? AND club_id = ?', m.id, req.actor.id);
  });
  res.json({ ok: true });
});

// Classes e especialidades concluídas, registradas pelo clube.
r.put('/club/members/:id/achievements', (req, res) => {
  const m = ownMember(req);
  const ids = parseJson(req.body.content_ids, []).map(Number).filter(Boolean);
  tx(() => {
    run(`DELETE FROM achievements WHERE member_id = ? AND source = 'clube'`, m.id);
    for (const cid of ids) {
      if (!get(`SELECT 1 FROM content WHERE id = ? AND type IN ('classe','especialidade')`, cid)) continue;
      run(`INSERT OR IGNORE INTO achievements (member_id, content_id, source) VALUES (?, ?, 'clube')`, m.id, cid);
    }
  });
  res.json({ ok: true });
});

// Catálogo de classes/especialidades para o clube registrar conclusões.
r.get('/club/catalog', (_req, res) => {
  res.json(all(`SELECT id, type, name, icon, age, leader FROM content WHERE type IN ('classe','especialidade') ORDER BY type, leader, age, name`));
});

// ---------- Unidades ----------
function ownUnit(req) {
  const u = get('SELECT * FROM units WHERE id = ? AND club_id = ?', int(req.params.id), req.actor.id);
  if (!u) fail(404, 'Unidade não encontrada neste clube');
  return u;
}

r.get('/club/units', (req, res) => {
  const rows = all(
    `SELECT u.*, (SELECT COUNT(*) FROM members m WHERE m.unit_id = u.id) AS member_count
     FROM units u WHERE u.club_id = ? ORDER BY u.is_leadership, u.name`,
    req.actor.id,
  );
  rows.forEach((u) => (u.username = getUsername('unit', u.id)));
  res.json(rows);
});

r.post('/club/units', imageUpload.single('logo'), (req, res) => {
  const name = str(req.body.name, 80);
  if (!name) fail(400, 'Informe o nome da unidade');
  const id = tx(() => {
    const id = Number(run('INSERT INTO units (club_id, name, logo) VALUES (?,?,?)', req.actor.id, name, fileUrl(req.file)).lastInsertRowid);
    setLogin('unit', id, req.body.username, req.body.password);
    return id;
  });
  res.json({ id });
});

r.put('/club/units/:id', imageUpload.single('logo'), (req, res) => {
  const u = ownUnit(req);
  tx(() => {
    const name = str(req.body.name, 80);
    if (name && !u.is_leadership) run('UPDATE units SET name = ? WHERE id = ?', name, u.id);
    if (req.file) run('UPDATE units SET logo = ? WHERE id = ?', fileUrl(req.file), u.id);
    if (req.body.username || req.body.password) setLogin('unit', u.id, req.body.username, req.body.password);
  });
  res.json({ ok: true });
});

r.delete('/club/units/:id', (req, res) => {
  const u = ownUnit(req);
  if (u.is_leadership) fail(400, 'A unidade Liderança não pode ser removida');
  tx(() => {
    const members = all('SELECT id, birth_date FROM members WHERE unit_id = ?', u.id);
    const lid = leadershipUnit(req.actor.id);
    for (const m of members) {
      run('UPDATE members SET unit_id = ? WHERE id = ?', memberKind(m.birth_date) === 'lideranca' ? lid : null, m.id);
    }
    deleteLogin('unit', u.id);
    run('DELETE FROM units WHERE id = ?', u.id);
  });
  res.json({ ok: true });
});

export default r;
