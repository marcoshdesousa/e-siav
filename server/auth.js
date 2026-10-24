import jwt from 'jsonwebtoken';
import { hasAccess, plusOf, plusOpen } from './plus.js';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { get, run, DATA_DIR } from './db.js';
import { fail, memberKind, roleOf, cargoOf } from './util.js';
import { pendingReason, waitingMessage } from './memberStatus.js';

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.jwt-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8');
}
const SECRET = loadSecret();
export const COOKIE = 'dbv_token';

export const hashPassword = (pw) => bcrypt.hashSync(pw, 10);

export function signToken(type, id) {
  return jwt.sign({ t: type, id }, SECRET, { expiresIn: '30d' });
}

/** Monta o "ator" (quem está logado) a partir do token. */
export function actorFromToken(token) {
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return null;
  }
  return loadActor(payload.t, payload.id);
}

export function loadActor(type, id) {
  if (type === 'admin') {
    const a = get('SELECT a.id, a.name, a.district_id, d.name AS district_name, d.is_app FROM admins a LEFT JOIN districts d ON d.id = a.district_id WHERE a.id = ?', id);
    if (!a) return null;
    const { is_app: isApp, ...rest } = a;
    // Administrador do App: cuida do Clube App Brasil (aprovações, anúncios e requisitos de quem não tem clube).
    return { type, ...rest, general: !a.district_id, app: !!isApp };
  }
  if (type === 'club') {
    const c = get('SELECT id, name, district_id, logo, photo, code FROM clubs WHERE id = ?', id);
    return c && { type, ...c, club_id: c.id };
  }
  if (type === 'unit') {
    const u = get(
      `SELECT u.id, u.name, u.logo, u.club_id, u.is_leadership, c.district_id, c.name AS club_name
       FROM units u JOIN clubs c ON c.id = u.club_id WHERE u.id = ?`,
      id,
    );
    return u && { type, ...u };
  }
  if (type === 'member') {
    const m = get(
      `SELECT m.id, m.name, m.photo, m.code, m.handle, m.link_token AS link, m.cargo, m.birth_date, m.unit_id, m.club_id, m.status, m.terms_token, m.approved_at, m.cleared_year,
              c.district_id, c.name AS club_name, c.is_app, u.name AS unit_name
       FROM members m JOIN clubs c ON c.id = m.club_id LEFT JOIN units u ON u.id = m.unit_id
       WHERE m.id = ? AND m.status IN ('ativo', 'pendente')`,
      id,
    );
    if (!m) return null;
    // Pendente entra no app, mas só vê a mensagem de espera (nada de pagamento).
    const waiting = m.status === 'pendente' ? waitingMessage(pendingReason(m)) : null;
    const { status: _s, terms_token: _t, approved_at: _a, cleared_year: _c, is_app: isApp, ...rest } = m;
    const kind = memberKind(m.birth_date);
    const p = plusOf(m.id);
    const plus = p?.active && p.plan !== 'app' ? { plan: p.plan, until: p.until, picks_pending: !!(p.picks_needed && !p.picks) } : null;
    // App Brasil: entra e vê o app, mas só usa depois de assinar (DBV ou DBV+).
    const app = isApp ? { locked: !hasAccess(m.id), until: p?.active ? p.until : null, trial: !!p?.trial, trial_ended: !!p?.trial_ended } : null;
    return { type, ...rest, cargo: cargoOf(kind, rest.cargo), waiting, kind, role: roleOf(kind, m.cargo), plus, plus_open: plusOpen(m.id), app };
  }
  return null;
}

/** Só precisa estar logado (o membro esperando aprovação também passa). */
export const requireLogin = (req, _res, next) => {
  if (!req.actor) fail(401, 'Faça login para continuar');
  next();
};

export function attachActor(req, _res, next) {
  req.actor = actorFromToken(req.cookies?.[COOKIE]);
  next();
}

// Administrador de distrito: só as telas do distrito dele (clubes, links de inscrição, requisitos,
// avaliações e as sequências). O resto do painel é só do administrador geral.
const DISTRICT_ADMIN_OK = /^\/api\/admin\/(overview|districts|clubs|targets|inscricoes|sequencias|app-aprovacoes)(\/|$)/;
export function districtAdminGuard(req, _res, next) {
  const a = req.actor;
  const path = req.originalUrl.split('?')[0];
  if (a?.type === 'admin' && a.district_id
    && path.startsWith('/api/admin/') && !DISTRICT_ADMIN_OK.test(path)) {
    fail(403, 'Só o administrador geral pode fazer isso');
  }
  next();
}
/** Só o administrador geral. */
export const requireGeneral = (req, _res, next) => {
  if (req.actor?.type !== 'admin' || req.actor.district_id) fail(403, 'Só o administrador geral pode fazer isso');
  next();
};
/** Distrito do administrador (null = geral, vê tudo). */
export const adminDistrict = (a) => (a?.type === 'admin' ? a.district_id || null : null);

// Conta do App Brasil sem assinatura: só olha (GET); para fazer qualquer coisa precisa assinar.
const LOCKED_OK = /^\/api\/(plus|payments|pagamentos|auth|me\/conta)(\/|$)/;
export const requireAuth = (...types) => (req, _res, next) => {
  if (!req.actor) fail(401, 'Faça login para continuar');
  if (req.actor.waiting) fail(403, req.actor.waiting);
  if (req.actor.app?.locked && req.method !== 'GET' && !LOCKED_OK.test(req.originalUrl.split('?')[0])) fail(402, 'Assine um plano para usar o app');
  if (types.length && !types.includes(req.actor.type)) fail(403, 'Acesso não permitido para esta conta');
  next();
};

/** Confere a senha da conta (tipo + id). */
export function checkAccountPassword(type, id, password) {
  const row = get('SELECT * FROM logins WHERE account_type = ? AND account_id = ?', type, id);
  return !!row && bcrypt.compareSync(String(password || ''), row.password_hash);
}

export function checkLogin(username, password, allowedTypes) {
  const row = get('SELECT * FROM logins WHERE username = ?', String(username || '').trim());
  if (!row || !allowedTypes.includes(row.account_type) || !bcrypt.compareSync(String(password || ''), row.password_hash)) {
    return null;
  }
  return row;
}

/** Cria ou atualiza o login de uma conta. Usuário é único em toda a plataforma. */
export function setLogin(accountType, accountId, username, password) {
  const existing = get('SELECT * FROM logins WHERE account_type = ? AND account_id = ?', accountType, accountId);
  username = String(username || '').trim();
  if (username) {
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) fail(400, 'Usuário deve ter de 3 a 40 caracteres (letras, números, ponto, hífen ou _)');
    const taken = get('SELECT account_type, account_id FROM logins WHERE username = ?', username);
    if (taken && !(taken.account_type === accountType && taken.account_id === accountId)) fail(409, 'Este usuário já está em uso');
  }
  if (password && String(password).length < 6) fail(400, 'A senha precisa ter pelo menos 6 caracteres');
  if (!existing) {
    if (!username || !password) fail(400, 'Informe usuário e senha');
    run('INSERT INTO logins (username, password_hash, account_type, account_id) VALUES (?,?,?,?)', username, hashPassword(password), accountType, accountId);
    return;
  }
  if (username && username !== existing.username) run('UPDATE logins SET username = ? WHERE id = ?', username, existing.id);
  if (password) run('UPDATE logins SET password_hash = ? WHERE id = ?', hashPassword(password), existing.id);
}

export function getUsername(accountType, accountId) {
  return get('SELECT username FROM logins WHERE account_type = ? AND account_id = ?', accountType, accountId)?.username || null;
}

export function deleteLogin(accountType, accountId) {
  run('DELETE FROM logins WHERE account_type = ? AND account_id = ?', accountType, accountId);
}
