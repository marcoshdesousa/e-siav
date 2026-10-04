import { Router } from 'express';
import { COOKIE, checkLogin, signToken, loadActor, requireAuth, getUsername } from '../auth.js';
import { CARGOS, MODELOS_ENVIO } from '../config.js';
import { all } from '../db.js';
import { fail } from '../util.js';

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

// Login Clube: conta do clube e contas de unidade.
// Login Membros: desbravadores, liderança e Administrador Geral.
r.post('/auth/login', (req, res) => {
  const { mode, username, password } = req.body || {};
  const allowed = mode === 'clube' ? ['club', 'unit'] : ['member', 'admin'];
  const keys = ['ip:' + req.ip, 'user:' + String(username || '').trim().toLowerCase()];
  if (keys.some(bloqueado)) fail(429, 'Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.');
  const login = checkLogin(username, password, allowed);
  if (!login) {
    keys.forEach(registrarFalha);
    fail(401, 'Usuário ou senha incorretos');
  }
  falhas.delete(keys[1]);
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

r.get('/auth/me', requireAuth(), (req, res) => {
  res.json({ actor: { ...req.actor, username: getUsername(req.actor.type, req.actor.id) } });
});

r.get('/meta', (_req, res) => {
  res.json({ cargos: CARGOS, modelos: MODELOS_ENVIO, districts: all('SELECT id, name FROM districts ORDER BY name') });
});

export default r;
