import { Router } from 'express';
import { get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { setHandle } from '../handles.js';
import { removeSubscription, saveSubscription, vapidKeys } from '../push.js';
import { clubEntered, clubPresenceSummary, ping } from '../presence.js';
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

// Lembretes no celular: a chave pública e o cadastro do aparelho do membro.
r.get('/push/chave', (_req, res) => res.json({ key: vapidKeys().publicKey }));
r.post('/me/push', requireAuth('member'), (req, res) => {
  if (!saveSubscription(req.actor.id, req.body.subscription)) fail(400, 'Aparelho inválido');
  res.json({ ok: true });
});
r.post('/me/push/sair', requireAuth('member'), (req, res) => {
  removeSubscription(req.actor.id, req.body.endpoint);
  res.json({ ok: true });
});

// "Estou aqui": a cada minuto com o app aberto (5 minutos no dia = 1 dia na sequência do app).
r.post('/me/presenca', requireAuth('member'), (req, res) => res.json(ping(req.actor.id)));

// O clube entrou hoje: sequência do clube, 100 pontos e um pacotinho para cada membro (uma vez por dia).
r.post('/club/presenca', requireAuth('club'), (req, res) => res.json(clubEntered(req.actor.id)));
r.get('/club/presenca', requireAuth('club'), (req, res) => res.json(clubPresenceSummary(req.actor.id)));

// O membro cria o próprio @ (uma vez só; não dá para trocar depois).
r.post('/me/arroba', requireAuth('member'), (req, res) => res.json({ handle: setHandle(req.actor.id, req.body.handle) }));

export default r;
