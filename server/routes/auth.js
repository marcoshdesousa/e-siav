import { Router } from 'express';
import { COOKIE, checkLogin, signToken, loadActor, requireAuth, getUsername } from '../auth.js';
import { CARGOS, MODELOS_ENVIO } from '../config.js';
import { all } from '../db.js';
import { fail } from '../util.js';

const r = Router();

// Login Clube: conta do clube e contas de unidade.
// Login Membros: desbravadores, liderança e Administrador Geral.
r.post('/auth/login', (req, res) => {
  const { mode, username, password } = req.body || {};
  const allowed = mode === 'clube' ? ['club', 'unit'] : ['member', 'admin'];
  const login = checkLogin(username, password, allowed);
  if (!login) fail(401, 'Usuário ou senha incorretos');
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
