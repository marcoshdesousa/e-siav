// Link de inscrição de cada clube. Só o administrador (geral ou do distrito) vê, liga e desliga.
// Quem entra pelo link já fica no clube: nome completo, data de nascimento, cargo e unidade.
// Login criado na hora: código de 6 números + ano de nascimento. CPF fica para depois.
import crypto from 'node:crypto';
import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { COOKIE, adminDistrict, loadActor, requireAuth, signToken } from '../auth.js';
import { fail, int, str, validDate, memberKind, newMemberCode, ageFrom } from '../util.js';
import { createMemberLogin, memberPassword } from '../memberStatus.js';

const r = Router();
const admin = requireAuth('admin');

run(`CREATE TABLE IF NOT EXISTS club_signup (
  club_id INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);

const newToken = () => crypto.randomBytes(9).toString('base64url');
function ownClub(req, id) {
  const c = get('SELECT id, district_id FROM clubs WHERE id = ?', id);
  const d = adminDistrict(req.actor);
  if (!c || (d && c.district_id !== d)) fail(404, 'Clube não encontrado');
  return c;
}

r.get('/admin/inscricoes', admin, (req, res) => {
  const d = adminDistrict(req.actor);
  res.json(all(`SELECT c.id, c.name, c.logo, d.name AS district_name, s.token, COALESCE(s.enabled, 0) AS enabled, COALESCE(s.signups, 0) AS signups,
      (SELECT COUNT(*) FROM units u WHERE u.club_id = c.id AND u.is_leadership = 0) AS unit_count
    FROM clubs c JOIN districts d ON d.id = c.district_id LEFT JOIN club_signup s ON s.club_id = c.id
    ${d ? 'WHERE c.district_id = ?' : ''} ORDER BY d.name, c.name`, ...(d ? [d] : [])));
});
r.put('/admin/inscricoes/:clubId', admin, (req, res) => {
  const c = ownClub(req, int(req.params.clubId));
  const on = req.body.enabled ? 1 : 0;
  run(`INSERT INTO club_signup (club_id, token, enabled) VALUES (?, ?, ?)
    ON CONFLICT (club_id) DO UPDATE SET enabled = excluded.enabled, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`, c.id, newToken(), on);
  res.json(get('SELECT token, enabled FROM club_signup WHERE club_id = ?', c.id));
});
r.post('/admin/inscricoes/:clubId/novo-link', admin, (req, res) => {
  const c = ownClub(req, int(req.params.clubId));
  run(`INSERT INTO club_signup (club_id, token, enabled) VALUES (?, ?, 0)
    ON CONFLICT (club_id) DO UPDATE SET token = excluded.token, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`, c.id, newToken());
  res.json(get('SELECT token, enabled FROM club_signup WHERE club_id = ?', c.id));
});

/** Clube do link (só se estiver ligado). */
function clubOf(token) {
  const s = get(`SELECT s.club_id, c.name, c.logo FROM club_signup s JOIN clubs c ON c.id = s.club_id WHERE s.token = ? AND s.enabled = 1`, String(token || ''));
  if (!s) fail(404, 'Este link de inscrição não existe ou está desligado. Peça um novo para a diretoria do clube.');
  return s;
}
const units = (clubId) => all('SELECT id, name, logo, is_leadership FROM units WHERE club_id = ? ORDER BY is_leadership DESC, name', clubId);

r.get('/inscricao/:token', (req, res) => {
  const s = clubOf(req.params.token);
  res.json({ club: { name: s.name, logo: s.logo }, units: units(s.club_id).filter((u) => !u.is_leadership).map(({ id, name, logo }) => ({ id, name, logo })) });
});

// cargo: desbravador (até 15 anos) | diretoria | conselheiro (16 anos ou mais)
r.post('/inscricao/:token', (req, res) => {
  const s = clubOf(req.params.token);
  const name = str(req.body.name, 120).replace(/\s+/g, ' ');
  const birth = req.body.birth_date;
  if (name.split(' ').length < 2) fail(400, 'Escreva o nome completo (nome e sobrenome)');
  if (!validDate(birth) || birth > new Date().toISOString().slice(0, 10)) fail(400, 'Informe a data de nascimento');
  const kind = memberKind(birth);
  if (!kind) fail(400, 'Para entrar no clube é preciso ter pelo menos 10 anos');
  const cargo = String(req.body.cargo || '');
  const list = units(s.club_id);
  const leadership = list.find((u) => u.is_leadership);
  let unitId = null;
  let cargoName;
  if (kind === 'desbravador') {
    if (cargo !== 'desbravador') fail(400, 'Até 15 anos o cargo é Desbravador');
    cargoName = 'Desbravador';
    unitId = list.find((u) => !u.is_leadership && u.id === int(req.body.unit_id))?.id;
    if (!unitId) fail(400, 'Escolha a sua unidade');
  } else if (cargo === 'diretoria') {
    cargoName = 'Diretoria';
    unitId = leadership?.id || null;
  } else if (cargo === 'conselheiro') {
    cargoName = 'Conselheiro';
    unitId = list.find((u) => !u.is_leadership && u.id === int(req.body.unit_id))?.id;
    if (!unitId) fail(400, 'Escolha a unidade em que você é conselheiro');
  } else fail(400, 'Com 16 anos ou mais, escolha Diretoria ou Conselheiro');
  // Evita cadastro repetido (mesmo nome e nascimento no mesmo clube).
  // Nome repetido no mesmo clube é permitido (pode ser coincidência): cada pessoa tem o seu código.
  const out = tx(() => {
    const code = newMemberCode();
    const id = Number(run(
      `INSERT INTO members (club_id, unit_id, name, birth_date, cargo, code, status, approved_at, cleared_year)
       VALUES (?,?,?,?,?,?,'ativo',strftime('%Y-%m-%dT%H:%M:%fZ','now'),?)`,
      s.club_id, unitId, name, birth, cargoName, code, new Date().getFullYear(),
    ).lastInsertRowid);
    createMemberLogin(id, code);
    run('UPDATE club_signup SET signups = signups + 1 WHERE club_id = ?', s.club_id);
    return { id, code };
  });
  // Já entra logado.
  const actor = loadActor('member', out.id);
  res.cookie(COOKIE, signToken('member', out.id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 864e5 });
  res.json({ code: out.code, password: memberPassword(birth), age: ageFrom(birth), actor });
});

export default r;
