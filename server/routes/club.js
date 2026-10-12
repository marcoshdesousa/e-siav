import crypto from 'node:crypto';
import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth, deleteLogin, checkAccountPassword } from '../auth.js';
import { imageUpload, fileUrl } from '../uploads.js';
import { CARGOS, CARGOS_18, CARGO_PADRAO, IDADE_MIN_DIRETOR, MAX_GRUPOS } from '../config.js';
import { createMemberLogin, memberPassword, refreshStatus } from '../memberStatus.js';
import { fail, int, str, memberKind, ageFrom, validDate, newMemberCode, newUnitPin, parseJson } from '../util.js';
import { checkIdentity, cleanFicha, saveFicha, validateSignup } from '../ficha.js';
import { listMembers, listUnits, memberFicha } from '../clubData.js';
import { clubProfile } from '../profiles.js';
import { clubUnitsRanking } from '../rankings.js';

// Sistema do Clã: conta única da secretaria, diretores e diretores associados.
// Toda consulta é filtrada por club_id = clã logado: cada clã só vê e edita os seus.
const r = Router();
r.use('/club', requireAuth('club'));

const leadershipUnit = (clubId) => get('SELECT id FROM units WHERE club_id = ? AND is_leadership = 1', clubId).id;

r.get('/club/overview', (req, res) => {
  const id = req.actor.id;
  const profile = clubProfile(id);
  profile.signup_pending = get(`SELECT COUNT(*) n FROM members WHERE club_id = ? AND status = 'pendente'`, id).n;
  profile.transfers_pending = get(`SELECT COUNT(*) n FROM transfers WHERE (from_club_id = ? AND status = 'pendente_origem') OR (to_club_id = ? AND status = 'pendente_destino')`, id, id).n;
  profile.pending_reviews = get(`SELECT COUNT(*) n FROM submissions s JOIN requirements r ON r.id = s.requirement_id WHERE r.creator_type = 'club' AND r.club_id = ? AND s.status = 'enviado'`, id).n;
  profile.pending_achievements = get(`SELECT COUNT(*) n FROM achievement_requests q JOIN members m ON m.id = q.member_id JOIN content c ON c.id = q.content_id WHERE m.club_id = ? AND q.status = 'pendente' AND c.type = 'especialidade'`, id).n;
  profile.open_reports = get(`SELECT COUNT(*) n FROM reports WHERE status = 'aberta' AND (club_id = ? OR reported_club_id = ?)`, id, id).n;
  profile.desbravadores = 0;
  profile.lideranca = 0;
  for (const m of all(`SELECT birth_date FROM members WHERE club_id = ? AND status = 'ativo'`, id)) {
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
  // História do clã. O nome do diretor só o administrativo muda (todo ano).
  if (req.body.history !== undefined) run('UPDATE clubs SET history = ? WHERE id = ?', str(req.body.history, 5000) || null, req.actor.id);
  res.json({ ok: true });
});

// ---------- Membros ----------
function ownMember(req) {
  const m = get('SELECT * FROM members WHERE id = ? AND club_id = ?', int(req.params.id), req.actor.id);
  if (!m) fail(404, 'Membro não encontrado neste clã');
  return m;
}

r.get('/club/members', (req, res) => res.json(listMembers(req.actor.id)));

r.get('/club/members/:id', (req, res) => {
  const m = ownMember(req);
  m.age = ageFrom(m.birth_date);
  m.kind = memberKind(m.birth_date);
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
  if (CARGOS_18.includes(cargo) && ageFrom(birth) < IDADE_MIN_DIRETOR) {
    if (b.cargo !== undefined) fail(400, `O cargo ${cargo} é só para quem tem ${IDADE_MIN_DIRETOR} anos ou mais`);
    cargo = CARGO_PADRAO[kind];
  }

  let unitId = b.unit_id === undefined ? existing?.unit_id ?? null : int(b.unit_id);
  if (unitId) {
    const u = get('SELECT * FROM units WHERE id = ? AND club_id = ?', unitId, req.actor.id);
    if (!u) fail(400, 'Grupo inválido');
    if (u.is_leadership && kind === 'desbravador') fail(400, 'Exploradores não podem entrar no grupo Tutores');
  }
  // Tutor sem grupo entra automaticamente no grupo "Tutores".
  if (!unitId && kind === 'lideranca') unitId = leadershipUnit(req.actor.id);
  const ids = b.cpf === undefined && b.certidao === undefined && existing
    ? { cpf: existing.cpf, certidao: existing.birth_cert }
    : checkIdentity({ cpf: b.cpf, certidao: b.certidao }, existing?.id);
  return { name, birth, cargo, unitId, cpf: ids.cpf, certidao: ids.certidao };
}

// Cadastro feito pelo clã: todos os dados da ficha. As assinaturas e os termos ficam
// com o responsável, que recebe um link só desse membro. Assinou, o membro fica ativo.
r.post('/club/members', imageUpload.single('photo'), (req, res) => {
  const ficha = cleanFicha(req.body);
  if (ficha.doc_tipo === 'certidao') req.body.cpf = req.body.cpf || '';
  else req.body.certidao = '';
  const f = memberFields(req);
  if (ficha.doc_tipo !== 'certidao' && !f.cpf) fail(400, 'Informe o CPF');
  if (str(req.body.name, 120).split(/\s+/).length < 2) fail(400, 'Informe o nome completo');
  validateSignup(ficha, f.birth, { signed: false });
  for (const k of ['assinatura_nome', 'assinatura_cpf', 'med_assinatura_nome', 'med_assinatura_cpf', 'termo_medico', 'termo_imagem', 'termo_responsabilidade', 'termo_dados']) delete ficha[k];
  ficha.data_inscricao = new Date().toISOString().slice(0, 10);
  ficha.local_inscricao = `${get('SELECT name FROM clubs WHERE id = ?', req.actor.id).name} — cadastro pelo clã`;
  const token = crypto.randomBytes(18).toString('base64url');
  const out = tx(() => {
    const code = newMemberCode();
    const id = Number(run(
      `INSERT INTO members (club_id, unit_id, name, birth_date, photo, cargo, code, cpf, birth_cert, status, terms_token, approved_at) VALUES (?,?,?,?,?,?,?,?,?,'pendente',?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      req.actor.id, f.unitId, f.name, f.birth, fileUrl(req.file), f.cargo, code, f.cpf, f.certidao, token,
    ).lastInsertRowid);
    createMemberLogin(id, code);
    saveFicha(id, ficha);
    return { id, code, password: memberPassword(f.birth), terms_token: token };
  });
  res.json(out);
});

r.put('/club/members/:id', imageUpload.single('photo'), (req, res) => {
  const m = ownMember(req);
  const f = memberFields(req, m);
  tx(() => {
    run('UPDATE members SET name = ?, birth_date = ?, cargo = ?, unit_id = ?, cpf = ?, birth_cert = ? WHERE id = ? AND club_id = ?',
      f.name, f.birth, f.cargo, f.unitId, f.cpf, f.certidao, m.id, req.actor.id);
    if (req.file) run('UPDATE members SET photo = ? WHERE id = ?', fileUrl(req.file), m.id);
  });
  res.json({ ok: true });
});

// Ninguém é apagado: o clã desativa (sai das listas e do ranking) e pode reativar.
r.post('/club/members/:id/desativar', (req, res) => {
  const m = ownMember(req);
  if (m.status !== 'ativo') fail(400, 'Este membro não está ativo');
  run(`UPDATE members SET status = 'inativo' WHERE id = ?`, m.id);
  res.json({ ok: true });
});
r.post('/club/members/:id/reativar', (req, res) => {
  const m = ownMember(req);
  if (m.status !== 'inativo') fail(400, 'Este membro não está desativado');
  run(`UPDATE members SET status = 'ativo' WHERE id = ?`, m.id);
  res.json({ ok: true });
});

// Inscrição feita pelo link do clã: o clã aprova (escolhendo grupo e cargo) ou recusa.
r.post('/club/members/:id/aprovar', (req, res) => {
  const m = ownMember(req);
  if (m.status !== 'pendente' || m.approved_at) fail(400, 'Esta inscrição já foi analisada');
  if (m.terms_token) fail(400, 'O responsável ainda não assinou o termo');
  const f = memberFields(req, m);
  tx(() => {
    run(`UPDATE members SET approved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), unit_id = ?, cargo = ? WHERE id = ?`, f.unitId, f.cargo, m.id);
    refreshStatus(m.id); // fica ativo quando a taxa estiver paga
  });
  res.json({ ok: true });
});
r.post('/club/members/:id/recusar', (req, res) => {
  const m = ownMember(req);
  if (m.status !== 'pendente' || m.approved_at) fail(400, 'Só inscrições esperando aprovação podem ser recusadas');
  tx(() => {
    deleteLogin('member', m.id);
    run('DELETE FROM members WHERE id = ?', m.id);
  });
  res.json({ ok: true });
});

// Ficha de cadastro, ficha médica e termos.
r.get('/club/members/:id/ficha', (req, res) => {
  const m = ownMember(req);
  res.json(memberFicha(req.actor.id, m.id));
});
// A ficha também traz os dados pessoais do membro (nome, nascimento, CPF ou certidão).
// Grupo e cargo ficam no "Editar".
r.put('/club/members/:id/ficha', (req, res) => {
  const m = ownMember(req);
  const ficha = cleanFicha(req.body);
  const b = req.body;
  const personal = b.name !== undefined || b.birth_date !== undefined || b.cpf !== undefined || b.certidao !== undefined;
  const fields = { name: b.name, birth_date: b.birth_date };
  if (b.cpf !== undefined || b.certidao !== undefined) {
    Object.assign(fields, ficha.doc_tipo === 'certidao' ? { cpf: '', certidao: b.certidao ?? '' } : { cpf: b.cpf ?? '', certidao: '' });
  }
  const f = personal ? memberFields({ body: fields, actor: req.actor }, m) : null;
  if (f && ficha.doc_tipo !== 'certidao' && !f.cpf && (b.cpf !== undefined)) fail(400, 'Informe o CPF');
  tx(() => {
    if (f) {
      run('UPDATE members SET name = ?, birth_date = ?, cargo = ?, unit_id = ?, cpf = ?, birth_cert = ? WHERE id = ? AND club_id = ?',
        f.name, f.birth, f.cargo, f.unitId, f.cpf, f.certidao, m.id, req.actor.id);
    }
    saveFicha(m.id, ficha);
  });
  res.json({ ok: true });
});

// Cadernos guia e insígnias concluídas, registradas pelo clã.
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

// Catálogo de classes/especialidades para o clã registrar conclusões.
r.get('/club/catalog', (_req, res) => {
  res.json(all(`SELECT id, type, name, icon, age, leader FROM content WHERE type IN ('classe','especialidade') ORDER BY type, leader, age, name`));
});

// ---------- Grupos ----------
function ownUnit(req) {
  const u = get('SELECT * FROM units WHERE id = ? AND club_id = ?', int(req.params.id), req.actor.id);
  if (!u) fail(404, 'Grupo não encontrado neste clã');
  return u;
}

r.get('/club/units', (req, res) => res.json(listUnits(req.actor.id)));

// O login do grupo é o código do clã + uma senha de 4 números gerada pelo app.
r.post('/club/units', imageUpload.single('logo'), (req, res) => {
  const name = str(req.body.name, 80);
  if (!name) fail(400, 'Informe o nome do grupo');
  // Senha gerada pelo app (não pode ser trocada) e diferente da senha do clã.
  const pin = newUnitPin(req.actor.id, (p) => checkAccountPassword('club', req.actor.id, p));
  // Número do grupo no clã (1 a 10): o menor livre.
  const used = new Set(all('SELECT number FROM units WHERE club_id = ? AND number IS NOT NULL', req.actor.id).map((u) => u.number));
  let number = 1;
  while (used.has(number)) number++;
  if (number > MAX_GRUPOS) fail(400, `O clã pode ter no máximo ${MAX_GRUPOS} grupos`);
  const id = Number(run('INSERT INTO units (club_id, name, logo, pin, number) VALUES (?,?,?,?,?)', req.actor.id, name, fileUrl(req.file), pin, number).lastInsertRowid);
  res.json({ id, pin, number });
});

r.put('/club/units/:id', imageUpload.single('logo'), (req, res) => {
  const u = ownUnit(req);
  tx(() => {
    const name = str(req.body.name, 80);
    if (name && !u.is_leadership) run('UPDATE units SET name = ? WHERE id = ?', name, u.id);
    if (req.file) run('UPDATE units SET logo = ? WHERE id = ?', fileUrl(req.file), u.id);
  });
  res.json({ ok: true });
});

r.delete('/club/units/:id', (req, res) => {
  const u = ownUnit(req);
  if (u.is_leadership) fail(400, 'O grupo Tutores não pode ser removido');
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
