import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { get, run, DATA_DIR } from './db.js';
import { fail, memberKind } from './util.js';

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
    const a = get('SELECT id, name FROM admins WHERE id = ?', id);
    return a && { type, ...a };
  }
  if (type === 'club') {
    const c = get('SELECT id, name, district_id, logo, photo FROM clubs WHERE id = ?', id);
    return c && { type, ...c, club_id: c.id };
  }
  if (type === 'unit') {
    const u = get(
      `SELECT u.id, u.name, u.logo, u.club_id, c.district_id, c.name AS club_name
       FROM units u JOIN clubs c ON c.id = u.club_id WHERE u.id = ?`,
      id,
    );
    return u && { type, ...u };
  }
  if (type === 'member') {
    const m = get(
      `SELECT m.id, m.name, m.photo, m.code, m.handle, m.cargo, m.birth_date, m.unit_id, m.club_id,
              c.district_id, c.name AS club_name, u.name AS unit_name
       FROM members m JOIN clubs c ON c.id = m.club_id LEFT JOIN units u ON u.id = m.unit_id
       WHERE m.id = ?`,
      id,
    );
    return m && { type, ...m, kind: memberKind(m.birth_date) };
  }
  return null;
}

export function attachActor(req, _res, next) {
  req.actor = actorFromToken(req.cookies?.[COOKIE]);
  next();
}

export const requireAuth = (...types) => (req, _res, next) => {
  if (!req.actor) fail(401, 'Faça login para continuar');
  if (types.length && !types.includes(req.actor.type)) fail(403, 'Acesso não permitido para esta conta');
  next();
};

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
