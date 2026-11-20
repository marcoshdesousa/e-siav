import { Router } from 'express';
import { get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { setHandle } from '../handles.js';
import { STUDY_REMINDERS, remindersOf, removeSubscription, saveSubscription, setReminder, vapidKeys } from '../push.js';
import { clubEntered, clubPresenceSummary, ping } from '../presence.js';
import { imageUpload, fileUrl } from '../uploads.js';
import { memberProfile, unitProfile } from '../profiles.js';
import { fail, str } from '../util.js';
import { frameOf, framesOf, useFrame } from '../frames.js';

const r = Router();

// Molduras da foto de perfil: as que a conta ganhou e a que está usando.
const FRAME_TARGET = { member: 'member', unit: 'unit', club: 'club' };
r.get('/me/molduras', requireAuth('member', 'unit', 'club'), (req, res) => {
  const t = FRAME_TARGET[req.actor.type];
  res.json({ current: frameOf(t, req.actor.id), frames: framesOf(t, req.actor.id) });
});
r.put('/me/moldura', requireAuth('member', 'unit', 'club'), (req, res) => {
  const t = FRAME_TARGET[req.actor.type];
  const id = req.body.id == null ? null : Number(req.body.id);
  if (!useFrame(t, req.actor.id, id)) fail(404, 'Moldura não encontrada');
  res.json({ current: frameOf(t, req.actor.id) });
});

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

// Lembrete com horário em cada estudo (Ano Bíblico, Meditação, Escola Sabatina, Bom Líder, Bom de Bíblia).
r.get('/me/lembretes', requireAuth('member'), (req, res) => res.json({
  reminders: remindersOf(req.actor.id),
  kinds: Object.fromEntries(Object.entries(STUDY_REMINDERS).map(([k, v]) => [k, v.label])),
  device: !!get('SELECT 1 FROM push_subscriptions WHERE member_id = ?', req.actor.id),
}));
r.put('/me/lembretes', requireAuth('member'), (req, res) => {
  if (!setReminder(req.actor.id, String(req.body.kind || ''), String(req.body.time || ''))) fail(400, 'Escolha um horário válido');
  res.json({ reminders: remindersOf(req.actor.id) });
});

// "Estou aqui": a cada minuto com o app aberto (5 minutos no dia = 1 dia na sequência do app).
r.post('/me/presenca', requireAuth('member'), (req, res) => res.json(ping(req.actor.id)));

// O clube entrou hoje: sequência do clube, 100 pontos e um pacotinho para cada membro (uma vez por dia).
r.post('/club/presenca', requireAuth('club'), (req, res) => res.json(clubEntered(req.actor.id)));
r.get('/club/presenca', requireAuth('club'), (req, res) => res.json(clubPresenceSummary(req.actor.id)));

// O membro cria o próprio @ (uma vez só; não dá para trocar depois).
r.post('/me/arroba', requireAuth('member'), (req, res) => res.json({ handle: setHandle(req.actor.id, req.body.handle) }));

export default r;
