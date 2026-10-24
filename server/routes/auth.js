import { Router } from 'express';
import { COOKIE, checkAccountPassword, checkLogin, signToken, loadActor, requireLogin, getUsername } from '../auth.js';
import { memberByHandle } from '../handles.js';
import { CARGOS, CARGOS_18, CARGOS_LIDERANCA, IDADE_MIN_DIRETOR, MODELOS_ENVIO } from '../config.js';
import { all, get } from '../db.js';
import { fail } from '../util.js';
import { checkMemberPassword } from '../memberStatus.js';

const r = Router();

// Limite de tentativas erradas de senha: 8 por usuário e 30 por IP (um clube
// inteiro pode entrar pela mesma rede da igreja) a cada 15 minutos.
const LIMITE = { user: 8, ip: 30 };
const JANELA_MS = 15 * 60 * 1000;
const falhas = new Map();

function bloqueado(key) {
  const f = falhas.get(key);
  if (!f) return false;
  if (Date.now() - f.inicio > JANELA_MS) {
    falhas.delete(key);
    return false;
  }
  return f.n >= LIMITE[key.split(':')[0]];
}
function registrarFalha(key) {
  const f = falhas.get(key);
  if (!f || Date.now() - f.inicio > JANELA_MS) falhas.set(key, { n: 1, inicio: Date.now() });
  else f.n++;
}
setInterval(() => {
  for (const [k, f] of falhas) if (Date.now() - f.inicio > JANELA_MS) falhas.delete(k);
}, JANELA_MS).unref();

/**
 * Descobre a conta pelo que foi digitado:
 * - Login Clube: código do clube (4 números) + senha. A senha do clube abre o Sistema do Clube;
 *   a senha de uma unidade (4 números) abre o Portal daquela unidade.
 * - Login Membros: código do membro (6 números) ou o @ dele + ano de nascimento, ou usuário (administrador e contas antigas).
 */
function findAccount(mode, username, password) {
  const user = String(username || '').trim();
  const pw = String(password || '');
  if (mode === 'clube') {
    if (/^\d{1,4}$/.test(user)) {
      const club = get('SELECT id FROM clubs WHERE code = ?', user.padStart(4, '0'));
      if (!club) return null;
      // Senhas geradas pelo app: 2 letras + 4 números (aceita minúsculas).
      const up = pw.trim().toUpperCase();
      const unit = get('SELECT id FROM units WHERE club_id = ? AND pin = ?', club.id, up);
      if (unit) return { account_type: 'unit', account_id: unit.id };
      const ok = checkAccountPassword('club', club.id, pw) || checkAccountPassword('club', club.id, up);
      return ok ? { account_type: 'club', account_id: club.id } : null;
    }
    return checkLogin(user, pw, ['club', 'unit']);
  }
  // Membro: código de 6 números + ano de nascimento (ex.: 2006).
  if (/^\d{6}$/.test(user)) {
    const m = get('SELECT id FROM members WHERE code = ?', user);
    if (!m || !checkMemberPassword(m.id, pw)) return null;
    return { account_type: 'member', account_id: m.id };
  }
  // @ do membro (com ou sem o @ na frente).
  const byHandle = (user.startsWith('@') || !get('SELECT 1 FROM logins WHERE username = ?', user)) && memberByHandle(user);
  if (byHandle) return checkMemberPassword(byHandle.id, pw) ? { account_type: 'member', account_id: byHandle.id } : null;
  const row = get('SELECT account_type, account_id FROM logins WHERE username = ?', user);
  if (row?.account_type === 'member') return checkMemberPassword(row.account_id, pw) ? row : null;
  return checkLogin(user, pw, ['admin']);
}

// Login Clube: conta do clube e contas de unidade.
// Login Membros: desbravadores, conselheiros e Administrador Geral.
r.post('/auth/login', (req, res) => {
  const { mode, username, password } = req.body || {};
  const keys = ['ip:' + req.ip, 'user:' + String(username || '').trim().toLowerCase()];
  if (keys.some(bloqueado)) fail(429, 'Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.');
  const login = findAccount(mode === 'clube' ? 'clube' : 'membros', username, password);
  if (!login) {
    keys.forEach(registrarFalha);
    fail(401, mode === 'clube' ? 'Código do clube ou senha incorretos' : 'Código ou senha incorretos');
  }
  falhas.delete(keys[1]);
  if (login.account_type === 'member') {
    const m = get('SELECT * FROM members WHERE id = ?', login.account_id);
    if (m.status === 'inativo') fail(403, 'Sua conta está desativada. Fale com a diretoria do seu clube.');
  }
  const actor = loadActor(login.account_type, login.account_id);
  if (!actor) fail(401, 'Conta não encontrada');
  if (actor.type === 'member' && !actor.kind) fail(403, 'Conta de membro com idade abaixo do mínimo');
  res.cookie(COOKIE, signToken(actor.type, actor.id), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 864e5,
  });
  res.json({ actor });
});

r.post('/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

r.get('/auth/me', requireLogin, (req, res) => {
  res.json({ actor: { ...req.actor, username: getUsername(req.actor.type, req.actor.id) } });
});

r.get('/meta', (_req, res) => {
  res.json({ cargos: CARGOS, cargos_lideranca: CARGOS_LIDERANCA, cargos_18: CARGOS_18, idade_min_diretor: IDADE_MIN_DIRETOR, modelos: MODELOS_ENVIO, districts: all('SELECT id, name FROM districts WHERE is_app = 0 ORDER BY name') });
});

export default r;
