import { Router } from 'express';
import { run } from '../db.js';
import { requireAuth } from '../auth.js';
import { imageUpload, fileUrl } from '../uploads.js';
import { memberProfile, unitProfile } from '../profiles.js';
import { fail } from '../util.js';

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

export default r;
