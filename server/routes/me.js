import { Router } from 'express';
import { get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { imageUpload, fileUrl } from '../uploads.js';
import { memberProfile, unitProfile } from '../profiles.js';
import { fail, str } from '../util.js';

const r = Router();

r.get('/me/profile', requireAuth('member', 'unit'), (req, res) => {
  res.json(req.actor.type === 'member' ? memberProfile('id', req.actor.id) : unitProfile(req.actor.id));
});

// O membro só altera a própria foto de perfil; nada mais.
r.put('/me/photo', requireAuth('member'), imageUpload.single('photo'), (req, res) => {
  if (!req.file) fail(400, 'Envie uma foto');
  run('UPDATE members SET photo = ? WHERE id = ?', fileUrl(req.file), req.actor.id);
  res.json({ photo: fileUrl(req.file) });
});

// @ do membro: escolhido no primeiro acesso, usado no chat e no link do perfil.
const HANDLE_RE = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/;
const RESERVED = new Set(['admin', 'administrador', 'diretoria', 'clube', 'unidade', 'suporte', 'appdodbv', 'dbv']);

export function checkHandle(raw, memberId) {
  const h = str(raw, 40).replace(/^@/, '').toLowerCase();
  if (!HANDLE_RE.test(h) || h.includes('..')) return { ok: false, handle: h, error: 'Use de 3 a 20 caracteres: letras minúsculas, números, ponto ou _' };
  if (RESERVED.has(h)) return { ok: false, handle: h, error: 'Este @ é reservado' };
  const taken = get('SELECT id FROM members WHERE handle = ? COLLATE NOCASE', h);
  if (taken && taken.id !== memberId) return { ok: false, handle: h, error: 'Este @ já está em uso' };
  return { ok: true, handle: h };
}

r.get('/me/handle/check', requireAuth('member'), (req, res) => res.json(checkHandle(req.query.h, req.actor.id)));

r.put('/me/handle', requireAuth('member'), (req, res) => {
  const c = checkHandle(req.body.handle, req.actor.id);
  if (!c.ok) fail(400, c.error);
  run('UPDATE members SET handle = ? WHERE id = ?', c.handle, req.actor.id);
  res.json({ handle: c.handle });
});

export default r;
