import { Router } from 'express';
import { get, PRIVATE_DIR } from '../db.js';
import { requireAuth } from '../auth.js';
import { canAccess } from './chat.js';
import { fail } from '../util.js';

// Arquivos privados: fotos e áudios do chat e fotos de comprovação dos requisitos.
// Só quem participa da conversa (ou avalia o envio) consegue abrir — o link sozinho não basta.
const r = Router();

const NAME = /^[a-f0-9]{24,32}\.[a-z0-9]{2,4}$/;

/** Clube ou administrador pode ver a mídia de uma mensagem que foi denunciada a ele. */
function reportedTo(actor, messageId) {
  if (actor.type === 'admin') return !!get('SELECT 1 FROM reports WHERE message_id = ?', messageId);
  if (actor.type === 'club') return !!get('SELECT 1 FROM reports WHERE message_id = ? AND (club_id = ? OR reported_club_id = ?)', messageId, actor.id, actor.id);
  return false;
}

function canSeeChat(actor, url) {
  const m = get('SELECT id, conversation_id FROM messages WHERE media = ?', url);
  if (!m) {
    // Mensagem apagada para todos: a mídia só fica disponível pela denúncia.
    const rep = get('SELECT message_id FROM reports WHERE snapshot LIKE ?', `%"${url}"%`);
    return !!rep && reportedTo(actor, rep.message_id);
  }
  const c = get('SELECT * FROM conversations WHERE id = ?', m.conversation_id);
  return (['member', 'club'].includes(actor.type) && canAccess(actor, c)) || reportedTo(actor, m.id);
}

function canSeeSubmission(actor, url) {
  const s = get(
    `SELECT s.submitter_type, s.submitter_id, r.creator_type, r.club_id FROM submissions s JOIN requirements r ON r.id = s.requirement_id
     WHERE s.photos LIKE ?`,
    `%"${url}"%`,
  );
  if (!s) return false;
  if (s.submitter_type === actor.type && s.submitter_id === actor.id) return true; // quem enviou
  if (s.creator_type === 'admin') return actor.type === 'admin'; // quem avalia
  return actor.type === 'club' && s.club_id === actor.id;
}

// Fotos enviadas nos requisitos de classes/especialidades: o próprio membro e o Administrador Geral.
function canSeeItem(actor, url) {
  const p = get('SELECT member_id FROM content_progress WHERE photos LIKE ?', `%"${url}"%`);
  if (!p) return false;
  return actor.type === 'admin' || (actor.type === 'member' && actor.id === p.member_id);
}

r.get('/files/:kind/:name', requireAuth(), (req, res) => {
  const { kind, name } = req.params;
  if (!NAME.test(name)) fail(404, 'Arquivo não encontrado');
  const url = `/api/files/${kind}/${name}`;
  const ok = kind === 'chat' ? canSeeChat(req.actor, url) : kind === 'envio' ? canSeeSubmission(req.actor, url) : kind === 'item' ? canSeeItem(req.actor, url) : false;
  if (!ok) fail(404, 'Arquivo não encontrado');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(name, { root: PRIVATE_DIR }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Arquivo não encontrado' });
  });
});

export default r;
