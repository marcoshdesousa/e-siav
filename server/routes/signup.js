// Link de inscrição de cada clube: o próprio clube vê, compartilha, liga e desliga.
// Quem entra pelo link já fica no clube: nome completo, data de nascimento, cargo e unidade.
// Sem link, a pessoa cria a conta pelo app e entra no Clube App Brasil (precisa assinar um plano).
// Login criado na hora: código de 6 números + ano de nascimento. CPF fica para depois.
import crypto from 'node:crypto';
import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { COOKIE, loadActor, requireAuth, signToken } from '../auth.js';
import { APP, appClub, appUnit } from '../appBrasil.js';
import { fail, int, str, validDate, memberKind, newMemberCode, ageFrom } from '../util.js';
import { createMemberLogin, memberPassword } from '../memberStatus.js';
import { APP_TRIAL_DAYS, grantPlus } from '../plus.js';
import { checkHandle } from '../handles.js';

const r = Router();

run(`CREATE TABLE IF NOT EXISTS club_signup (
  club_id INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);

const newToken = () => crypto.randomBytes(9).toString('base64url');
const club = requireAuth('club');

// O próprio clube cuida do seu link de inscrição: vê, compartilha, liga/desliga e troca.
function linkOf(clubId) {
  if (!get('SELECT 1 FROM club_signup WHERE club_id = ?', clubId)) run('INSERT INTO club_signup (club_id, token, enabled) VALUES (?, ?, 1)', clubId, newToken());
  return get('SELECT token, enabled, signups FROM club_signup WHERE club_id = ?', clubId);
}
r.get('/club/inscricao', club, (req, res) => res.json(linkOf(req.actor.club_id)));
r.put('/club/inscricao', club, (req, res) => {
  linkOf(req.actor.club_id);
  run(`UPDATE club_signup SET enabled = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE club_id = ?`, req.body.enabled ? 1 : 0, req.actor.club_id);
  res.json(linkOf(req.actor.club_id));
});
r.post('/club/inscricao/novo-link', club, (req, res) => {
  linkOf(req.actor.club_id);
  run(`UPDATE club_signup SET token = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE club_id = ?`, newToken(), req.actor.club_id);
  res.json(linkOf(req.actor.club_id));
});

/** Clube do link (só se estiver ligado). */
function clubOf(token) {
  const s = get(`SELECT s.club_id, c.name, c.logo FROM club_signup s JOIN clubs c ON c.id = s.club_id WHERE s.token = ? AND s.enabled = 1 AND c.is_app = 0`, String(token || ''));
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
  const { name, birth, kind, handle } = person(req.body);
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
    if (handle) run('UPDATE members SET handle = ? WHERE id = ?', handle, id);
    run('UPDATE club_signup SET signups = signups + 1 WHERE club_id = ?', s.club_id);
    return { id, code };
  });
  enterNow(res, out, birth);
});

/** Já entra logado depois de criar a conta. */
function enterNow(res, out, birth) {
  const actor = loadActor('member', out.id);
  res.cookie(COOKIE, signToken('member', out.id), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 864e5 });
  res.json({ code: out.code, password: memberPassword(birth), age: ageFrom(birth), actor });
}

/** Nome completo e data de nascimento (pelo menos 10 anos). */
function person(body) {
  const name = str(body.name, 120).replace(/\s+/g, ' ');
  const birth = body.birth_date;
  if (name.split(' ').length < 2) fail(400, 'Escreva o nome completo (nome e sobrenome)');
  if (!validDate(birth) || birth > new Date().toISOString().slice(0, 10)) fail(400, 'Informe a data de nascimento');
  const kind = memberKind(birth);
  if (!kind) fail(400, 'Para criar a conta é preciso ter pelo menos 10 anos');
  // O @ é obrigatório na criação da conta (o código é gerado depois, automático).
  if (!String(body.handle || '').replace(/@/g, '').trim()) fail(400, 'Escolha o seu @');
  const handle = checkHandle(body.handle);
  return { name, birth, kind, handle };
}

// Criar conta pelo app (sem o link de um clube): entra no Clube App Brasil, na Unidade App
// (desbravador, até 15 anos) ou na Unidade App Liderança (16 anos ou mais). Sem cargo e sem
// escolher clube ou unidade. Já entra com 3 dias de DBV para conhecer; depois precisa assinar.
r.post('/criar-conta', (req, res) => {
  const { name, birth, kind, handle } = person(req.body);
  const c = appClub();
  if (!c) fail(503, 'Tente de novo daqui a pouco');
  const leader = kind === 'lideranca';
  const out = tx(() => {
    const code = newMemberCode();
    const id = Number(run(
      `INSERT INTO members (club_id, unit_id, name, birth_date, cargo, code, status, approved_at, cleared_year)
       VALUES (?,?,?,?,?,?,'ativo',strftime('%Y-%m-%dT%H:%M:%fZ','now'),?)`,
      c.id, appUnit(c.id, leader), name, birth, leader ? 'Liderança' : 'Desbravador', code, new Date().getFullYear(),
    ).lastInsertRowid);
    createMemberLogin(id, code);
    if (handle) run('UPDATE members SET handle = ? WHERE id = ?', handle, id);
    grantPlus(id, 'app', APP_TRIAL_DAYS, { trial: true });
    return { id, code };
  });
  enterNow(res, out, birth);
});
r.get('/criar-conta', (_req, res) => res.json({ club: APP.club, units: [APP.unit, APP.leaders] }));

export default r;
