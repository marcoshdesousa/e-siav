import { Router } from 'express';
import { get, run } from '../db.js';
import { COOKIE, requireAuth } from '../auth.js';
import { checkMemberPassword } from '../memberStatus.js';
import { deleteMember } from '../accounts.js';
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

// A unidade escreve a própria biografia (aparece no perfil da unidade).
r.put('/me/bio', requireAuth('unit'), (req, res) => {
  run('UPDATE units SET bio = ? WHERE id = ?', str(req.body.bio, 1000) || null, req.actor.id);
  res.json({ ok: true });
});

// O membro apaga a própria conta (de vez), confirmando com a senha. O clube não se apaga:
// isso é com o administrador do distrito ou o geral.
r.post('/me/conta/apagar', requireAuth('member'), (req, res) => {
  if (!checkMemberPassword(req.actor.id, req.body.password)) fail(400, 'Senha errada');
  deleteMember(req.actor.id);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

export default r;
