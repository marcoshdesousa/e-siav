import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { all, get, run, tx, nowIso, PRIVATE_DIR } from '../db.js';
import { requireAuth } from '../auth.js';
import { privateMediaUpload, privateUrl } from '../uploads.js';
import { pushTo } from '../realtime.js';
import { fail, int, str } from '../util.js';

// Chat: Unidade (grupo), Diretoria (membro ↔ conta do clube) e Direta (membro ↔ membro).
const r = Router();
const chatUser = requireAuth('member', 'club');

const key = (type, id) => `${type}:${id}`;

function ensureMemberConversations(m) {
  if (m.unit_id) run(`INSERT OR IGNORE INTO conversations (type, unit_id, club_id) VALUES ('unidade', ?, ?)`, m.unit_id, m.club_id);
  run(`INSERT OR IGNORE INTO conversations (type, club_id, member_a) VALUES ('diretoria', ?, ?)`, m.club_id, m.id);
}

function participants(c) {
  if (c.type === 'unidade') return all('SELECT id FROM members WHERE unit_id = ?', c.unit_id).map((m) => ({ type: 'member', id: m.id }));
  if (c.type === 'diretoria') return [{ type: 'member', id: c.member_a }, { type: 'club', id: c.club_id }];
  return [{ type: 'member', id: c.member_a }, { type: 'member', id: c.member_b }];
}

export function canAccess(a, c) {
  if (!c) return false;
  if (a.type === 'club') return c.type === 'diretoria' && c.club_id === a.id;
  if (c.type === 'unidade') return c.unit_id === a.unit_id;
  if (c.type === 'diretoria') return c.member_a === a.id;
  return c.member_a === a.id || c.member_b === a.id;
}

function loadConv(req) {
  const c = get('SELECT * FROM conversations WHERE id = ?', int(req.params.id));
  if (!canAccess(req.actor, c)) fail(404, 'Conversa não encontrada');
  return c;
}

/** Estado da conversa para o usuário: limpa até (cleared_id), arquivada, apagada da lista. */
function userState(c, a) {
  return get('SELECT cleared_id, archived, hidden FROM conversation_user WHERE conversation_id = ? AND user_type = ? AND user_id = ?', c.id, a.type, a.id)
    || { cleared_id: 0, archived: 0, hidden: 0 };
}
function setUserState(c, a, fields) {
  run('INSERT OR IGNORE INTO conversation_user (conversation_id, user_type, user_id) VALUES (?,?,?)', c.id, a.type, a.id);
  for (const [k, v] of Object.entries(fields)) {
    run(`UPDATE conversation_user SET ${k} = ? WHERE conversation_id = ? AND user_type = ? AND user_id = ?`, v, c.id, a.type, a.id);
  }
}

/** Mensagens que o usuário pode ver: depois do "limpar" e sem as que ele apagou para si. */
const VISIBLE = `conversation_id = ? AND id > ? AND id NOT IN (SELECT message_id FROM message_hidden WHERE user_type = ? AND user_id = ?)`;
const visibleArgs = (c, a, st) => [c.id, st.cleared_id, a.type, a.id];

const blocked = (byType, byId, tType, tId) => !!get('SELECT 1 FROM blocks WHERE blocker_type = ? AND blocker_id = ? AND blocked_type = ? AND blocked_id = ?', byType, byId, tType, tId);

/** Remetentes que o usuário bloqueou (mensagens deles ficam ocultas). */
function blockedSet(a) {
  return new Set(all('SELECT blocked_type, blocked_id FROM blocks WHERE blocker_type = ? AND blocker_id = ?', a.type, a.id).map((b) => key(b.blocked_type, b.blocked_id)));
}

const senderCache = () => {
  const cache = new Map();
  return (type, id) => {
    const k = key(type, id);
    if (!cache.has(k)) {
      cache.set(k, type === 'club'
        ? (({ name, logo }) => ({ name: 'Diretoria · ' + name, photo: logo }))(get('SELECT name, logo FROM clubs WHERE id = ?', id) || { name: '?' })
        : get('SELECT name, photo, handle FROM members WHERE id = ?', id) || { name: '(removido)' });
    }
    return cache.get(k);
  };
};

function header(a, c) {
  if (c.type === 'unidade') {
    const u = get('SELECT name, logo FROM units WHERE id = ?', c.unit_id);
    const n = get('SELECT COUNT(*) n FROM members WHERE unit_id = ?', c.unit_id).n;
    return { title: 'Unidade ' + u.name, photo: u.logo, subtitle: `Grupo da unidade · ${n} membros` };
  }
  if (c.type === 'diretoria') {
    if (a.type === 'member') {
      const cl = get('SELECT name, logo FROM clubs WHERE id = ?', c.club_id);
      return { title: 'Diretoria', photo: cl.logo, subtitle: cl.name, peer: { type: 'club', id: c.club_id } };
    }
    const m = get('SELECT m.name, m.photo, m.handle, u.name AS unit FROM members m LEFT JOIN units u ON u.id = m.unit_id WHERE m.id = ?', c.member_a);
    return { title: m.name, photo: m.photo, subtitle: (m.unit ? 'Unidade ' + m.unit : 'Sem unidade') + (m.handle ? ' · @' + m.handle : ''), peer: { type: 'member', id: c.member_a } };
  }
  const otherId = c.member_a === a.id ? c.member_b : c.member_a;
  const o = get('SELECT m.name, m.photo, m.handle, cl.name AS club FROM members m JOIN clubs cl ON cl.id = m.club_id WHERE m.id = ?', otherId);
  return { title: o.name, photo: o.photo, subtitle: (o.handle ? '@' + o.handle + ' · ' : '') + o.club, peer: { type: 'member', id: otherId } };
}

function lastRead(c, type, id) {
  return get('SELECT last_read_id FROM conversation_reads WHERE conversation_id = ? AND reader_type = ? AND reader_id = ?', c.id, type, id)?.last_read_id || 0;
}

/** Maior mensagem lida pelos OUTROS participantes (para o ✓✓). */
function othersRead(a, c) {
  return get('SELECT MAX(last_read_id) AS m FROM conversation_reads WHERE conversation_id = ? AND NOT (reader_type = ? AND reader_id = ?)', c.id, a.type, a.id)?.m || 0;
}

function unreadCount(a, c, st) {
  const lr = Math.max(lastRead(c, a.type, a.id), st.cleared_id);
  return get(
    `SELECT COUNT(*) n FROM messages WHERE ${VISIBLE} AND id > ? AND deleted = 0 AND NOT (sender_type = ? AND sender_id = ?)`,
    ...visibleArgs(c, a, st), lr, a.type, a.id,
  ).n;
}

function summarize(a, c, blockedKeys, sender) {
  const st = userState(c, a);
  const msgs = all(`SELECT * FROM messages WHERE ${VISIBLE} ORDER BY id DESC LIMIT 30`, ...visibleArgs(c, a, st)).filter((m) => !blockedKeys.has(key(m.sender_type, m.sender_id)));
  const last = msgs[0] || null;
  return {
    id: c.id, type: c.type, ...header(a, c), unread: unreadCount(a, c, st), archived: !!st.archived, hidden: !!st.hidden,
    last: last && { ...last, sender_name: sender(last.sender_type, last.sender_id).name, mine: last.sender_type === a.type && last.sender_id === a.id },
    last_at: last?.created_at || c.created_at,
  };
}

r.get('/chat/conversations', chatUser, (req, res) => {
  const a = req.actor;
  let convs;
  if (a.type === 'member') {
    ensureMemberConversations(a);
    convs = all(
      `SELECT * FROM conversations WHERE (type = 'unidade' AND unit_id IS ?) OR (type = 'diretoria' AND member_a = ?)
       OR (type = 'direta' AND (member_a = ? OR member_b = ?))`,
      a.unit_id, a.id, a.id, a.id,
    );
  } else {
    convs = all(`SELECT * FROM conversations WHERE type = 'diretoria' AND club_id = ? AND last_message_at IS NOT NULL`, a.id);
  }
  const bl = blockedSet(a);
  const sender = senderCache();
  // Conversa apagada da lista só volta quando chega mensagem nova.
  const out = convs.map((c) => summarize(a, c, bl, sender)).filter((c) => !c.hidden).sort((x, y) => (x.last_at < y.last_at ? 1 : -1));
  res.json(out);
});

r.get('/chat/unread', chatUser, (req, res) => {
  const a = req.actor;
  let ids;
  if (a.type === 'member') {
    ensureMemberConversations(a);
    ids = all(`SELECT id FROM conversations WHERE (type='unidade' AND unit_id IS ?) OR (type='diretoria' AND member_a = ?) OR (type='direta' AND (member_a = ? OR member_b = ?))`, a.unit_id, a.id, a.id, a.id);
  } else ids = all(`SELECT id FROM conversations WHERE type = 'diretoria' AND club_id = ?`, a.id);
  let total = 0;
  for (const { id } of ids) {
    const c = { id };
    const st = userState(c, a);
    if (!st.hidden) total += unreadCount(a, c, st);
  }
  res.json({ total });
});

r.get('/chat/conversations/:id', chatUser, (req, res) => {
  const c = loadConv(req);
  const out = { id: c.id, type: c.type, ...header(req.actor, c) };
  if (c.type === 'unidade') {
    // Membros do mesmo grupo (mesmo clube) — usado para denunciar ou bloquear alguém.
    out.members = all('SELECT id, name, photo, cargo FROM members WHERE unit_id = ? AND id <> ? ORDER BY name', c.unit_id, req.actor.id);
  }
  if (out.peer) {
    out.i_blocked = blocked(req.actor.type, req.actor.id, out.peer.type, out.peer.id);
    out.blocked_me = blocked(out.peer.type, out.peer.id, req.actor.type, req.actor.id);
  }
  res.json(out);
});

r.get('/chat/conversations/:id/messages', chatUser, (req, res) => {
  const c = loadConv(req);
  const before = int(req.query.before) || 1e15;
  const bl = blockedSet(req.actor);
  const sender = senderCache();
  const st = userState(c, req.actor);
  const rows = all(`SELECT * FROM messages WHERE ${VISIBLE} AND id < ? ORDER BY id DESC LIMIT 60`, ...visibleArgs(c, req.actor, st), before)
    .filter((m) => !bl.has(key(m.sender_type, m.sender_id)))
    .reverse()
    .map((m) => ({ ...m, sender: sender(m.sender_type, m.sender_id) }));
  res.json({ messages: rows, others_read_id: othersRead(req.actor, c) });
});

r.post('/chat/conversations/:id/messages', chatUser, privateMediaUpload.single('media'), (req, res) => {
  const a = req.actor;
  const c = loadConv(req);
  for (const p of participants(c)) {
    if (c.type === 'unidade' || (p.type === a.type && p.id === a.id)) continue;
    if (blocked(a.type, a.id, p.type, p.id)) fail(403, 'Você bloqueou esta conversa. Desbloqueie para enviar mensagens.');
    if (blocked(p.type, p.id, a.type, a.id)) fail(403, 'Não é possível enviar mensagens nesta conversa.');
  }
  const file = req.file;
  const kind = !file ? 'texto' : file.mimetype.startsWith('audio/') ? 'audio' : 'foto';
  const body = str(req.body.body, 4000);
  if (kind === 'texto' && !body) fail(400, 'Mensagem vazia');
  const now = nowIso();
  const msg = tx(() => {
    const id = Number(run('INSERT INTO messages (conversation_id, sender_type, sender_id, kind, body, media, created_at) VALUES (?,?,?,?,?,?,?)', c.id, a.type, a.id, kind, body || null, privateUrl('chat', file), now).lastInsertRowid);
    run('UPDATE conversations SET last_message_at = ? WHERE id = ?', now, c.id);
    run('UPDATE conversation_user SET hidden = 0 WHERE conversation_id = ?', c.id); // reaparece para quem tinha apagado
    run(`INSERT INTO conversation_reads (conversation_id, reader_type, reader_id, last_read_id) VALUES (?,?,?,?)
         ON CONFLICT (conversation_id, reader_type, reader_id) DO UPDATE SET last_read_id = excluded.last_read_id`, c.id, a.type, a.id, id);
    return get('SELECT * FROM messages WHERE id = ?', id);
  });
  msg.sender = senderCache()(a.type, a.id);
  const targets = participants(c).filter((p) => !blocked(p.type, p.id, a.type, a.id)).map((p) => key(p.type, p.id));
  pushTo(targets, { type: 'message', conversation_id: c.id, conversation_type: c.type, message: msg });
  res.json(msg);
});

r.post('/chat/conversations/:id/read', chatUser, (req, res) => {
  const a = req.actor;
  const c = loadConv(req);
  const maxId = get('SELECT MAX(id) AS m FROM messages WHERE conversation_id = ?', c.id).m || 0;
  const lastId = Math.min(int(req.body.last_id, maxId), maxId);
  run(`INSERT INTO conversation_reads (conversation_id, reader_type, reader_id, last_read_id) VALUES (?,?,?,?)
       ON CONFLICT (conversation_id, reader_type, reader_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`, c.id, a.type, a.id, lastId);
  pushTo(participants(c).map((p) => key(p.type, p.id)), { type: 'read', conversation_id: c.id, reader: key(a.type, a.id), last_read_id: lastId });
  res.json({ ok: true });
});

// Busca para conversa direta: pelo @ (qualquer clube) ou pelo nome (apenas no próprio clube).
r.get('/chat/search', requireAuth('member'), (req, res) => {
  const raw = str(req.query.q, 60);
  const q = raw.replace(/^@/, '');
  if (q.length < 2) return res.json([]);
  const rows = all(
    `SELECT m.id, m.name, m.photo, m.handle, c.name AS club_name FROM members m JOIN clubs c ON c.id = m.club_id
     WHERE m.id <> ? AND ((m.handle IS NOT NULL AND m.handle LIKE ? ESCAPE '\\') OR (? = 0 AND m.club_id = ? AND m.name LIKE ?))
     ORDER BY (m.handle = ?) DESC, m.name LIMIT 20`,
    req.actor.id, q.replace(/[%_\\]/g, '\\$&') + '%', raw.startsWith('@') ? 1 : 0, req.actor.club_id, '%' + q + '%', q,
  );
  res.json(rows);
});

// ---------- Limpar, arquivar e apagar ----------
// Limpar: some só para quem limpou.
r.post('/chat/conversations/:id/clear', chatUser, (req, res) => {
  const c = loadConv(req);
  const maxId = get('SELECT MAX(id) AS m FROM messages WHERE conversation_id = ?', c.id).m || 0;
  setUserState(c, req.actor, { cleared_id: maxId });
  res.json({ ok: true });
});

r.post('/chat/conversations/:id/archive', chatUser, (req, res) => {
  const c = loadConv(req);
  if (c.type !== 'direta') fail(400, 'Só conversas diretas podem ser arquivadas');
  setUserState(c, req.actor, { archived: req.body.archived === false ? 0 : 1 });
  res.json({ ok: true });
});

/** Apaga uma mensagem para todos (só quem enviou). O conteúdo some; fica "Mensagem apagada". */
function deleteForAll(m, c) {
  const reported = !!get('SELECT 1 FROM reports WHERE message_id = ?', m.id);
  if (m.media && !reported) {
    // Mantém o arquivo se a mensagem foi denunciada (a análise continua possível).
    fs.rm(path.join(PRIVATE_DIR, path.basename(m.media)), { force: true }, () => {});
  }
  run(`UPDATE messages SET deleted = 1, kind = 'texto', body = NULL, media = NULL WHERE id = ?`, m.id);
  pushTo(participants(c).map((p) => key(p.type, p.id)), { type: 'deleted', conversation_id: c.id, message_id: m.id });
}

// Apagar conversa direta: sai da sua lista e é limpa para você. Com for_all, as SUAS mensagens são apagadas para todos.
r.post('/chat/conversations/:id/delete', chatUser, (req, res) => {
  const a = req.actor;
  const c = loadConv(req);
  if (c.type !== 'direta') fail(400, 'Só conversas diretas podem ser apagadas. Use "Limpar conversa".');
  tx(() => {
    if (req.body.for_all) {
      for (const m of all('SELECT * FROM messages WHERE conversation_id = ? AND sender_type = ? AND sender_id = ? AND deleted = 0', c.id, a.type, a.id)) deleteForAll(m, c);
    }
    const maxId = get('SELECT MAX(id) AS m FROM messages WHERE conversation_id = ?', c.id).m || 0;
    setUserState(c, a, { cleared_id: maxId, hidden: 1, archived: 0 });
  });
  res.json({ ok: true });
});

function loadMessage(req) {
  const m = get('SELECT * FROM messages WHERE id = ?', int(req.params.id));
  const c = m && get('SELECT * FROM conversations WHERE id = ?', m.conversation_id);
  if (!m || !canAccess(req.actor, c)) fail(404, 'Mensagem não encontrada');
  return [m, c];
}

// Apagar para mim
r.post('/chat/messages/:id/hide', chatUser, (req, res) => {
  const [m] = loadMessage(req);
  run('INSERT OR IGNORE INTO message_hidden (message_id, user_type, user_id) VALUES (?,?,?)', m.id, req.actor.type, req.actor.id);
  res.json({ ok: true });
});

// Apagar para todos (só a própria mensagem)
r.post('/chat/messages/:id/delete', chatUser, (req, res) => {
  const [m, c] = loadMessage(req);
  if (m.sender_type !== req.actor.type || m.sender_id !== req.actor.id) fail(403, 'Você só pode apagar para todos as suas mensagens');
  if (!m.deleted) deleteForAll(m, c);
  res.json({ ok: true });
});

r.post('/chat/direct', requireAuth('member'), (req, res) => {
  const other = get('SELECT id FROM members WHERE id = ?', int(req.body.member_id));
  if (!other || other.id === req.actor.id) fail(400, 'Membro inválido');
  const [a, b] = [req.actor.id, other.id].sort((x, y) => x - y);
  run(`INSERT OR IGNORE INTO conversations (type, member_a, member_b) VALUES ('direta', ?, ?)`, a, b);
  res.json({ id: get(`SELECT id FROM conversations WHERE type = 'direta' AND member_a = ? AND member_b = ?`, a, b).id });
});

// ---------- Bloquear ----------
r.get('/chat/blocks', chatUser, (req, res) => {
  const rows = all('SELECT blocked_type, blocked_id, created_at FROM blocks WHERE blocker_type = ? AND blocker_id = ?', req.actor.type, req.actor.id);
  const sender = senderCache();
  rows.forEach((b) => (b.name = sender(b.blocked_type, b.blocked_id).name));
  res.json(rows);
});
r.post('/chat/blocks', chatUser, (req, res) => {
  const type = req.body.type === 'club' ? 'club' : 'member';
  const id = int(req.body.id);
  if (type === req.actor.type && id === req.actor.id) fail(400, 'Você não pode bloquear a si mesmo');
  if (!get(`SELECT 1 FROM ${type === 'club' ? 'clubs' : 'members'} WHERE id = ?`, id)) fail(404, 'Não encontrado');
  run('INSERT OR IGNORE INTO blocks (blocker_type, blocker_id, blocked_type, blocked_id) VALUES (?,?,?,?)', req.actor.type, req.actor.id, type, id);
  res.json({ ok: true });
});
r.delete('/chat/blocks/:type/:id', chatUser, (req, res) => {
  run('DELETE FROM blocks WHERE blocker_type = ? AND blocker_id = ? AND blocked_type = ? AND blocked_id = ?', req.actor.type, req.actor.id, req.params.type, int(req.params.id));
  res.json({ ok: true });
});

// ---------- Denunciar ----------
// A denúncia chega à diretoria do clube e ao Administrador Geral.
r.post('/chat/reports', chatUser, (req, res) => {
  const a = req.actor;
  const c = get('SELECT * FROM conversations WHERE id = ?', int(req.body.conversation_id));
  if (!canAccess(a, c)) fail(404, 'Conversa não encontrada');
  const reason = str(req.body.reason, 1000);
  if (reason.length < 3) fail(400, 'Descreva o motivo da denúncia');
  let messageId = int(req.body.message_id);
  if (messageId && !get('SELECT 1 FROM messages WHERE id = ? AND conversation_id = ?', messageId, c.id)) messageId = null;
  let reportedType = ['member', 'club'].includes(req.body.reported_type) ? req.body.reported_type : null;
  let reportedId = int(req.body.reported_id);
  if (!reportedType) {
    const peer = header(a, c).peer;
    if (peer) [reportedType, reportedId] = [peer.type, peer.id];
  }
  if (reportedType === 'member' && !participants(c).some((p) => p.type === 'member' && p.id === reportedId)) [reportedType, reportedId] = [null, null];
  const msg = messageId ? get('SELECT sender_type, sender_id, kind, body, media, created_at FROM messages WHERE id = ?', messageId) : null;
  const snapshot = msg ? JSON.stringify({ ...msg, sender: senderCache()(msg.sender_type, msg.sender_id).name }) : null;
  const reportedClub = reportedType === 'member' ? get('SELECT club_id FROM members WHERE id = ?', reportedId)?.club_id : reportedType === 'club' ? reportedId : null;
  run(
    `INSERT INTO reports (reporter_type, reporter_id, club_id, reported_club_id, conversation_id, message_id, reported_type, reported_id, reason, snapshot)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    a.type, a.id, a.club_id, reportedClub ?? null, c.id, messageId, reportedType, reportedId, reason, snapshot,
  );
  res.json({ ok: true });
});

r.get('/reports', requireAuth('club', 'admin'), (req, res) => {
  const a = req.actor;
  const rows = a.type === 'admin'
    ? all('SELECT * FROM reports ORDER BY status, created_at DESC LIMIT 200')
    : all('SELECT * FROM reports WHERE club_id = ? OR reported_club_id = ? ORDER BY status, created_at DESC LIMIT 200', a.id, a.id);
  const sender = senderCache();
  for (const r0 of rows) {
    r0.reporter = sender(r0.reporter_type, r0.reporter_id);
    r0.reported = r0.reported_type ? sender(r0.reported_type, r0.reported_id) : null;
    r0.reporter_club = get('SELECT name FROM clubs WHERE id = ?', r0.club_id)?.name;
    r0.conversation_type = get('SELECT type FROM conversations WHERE id = ?', r0.conversation_id)?.type;
    // Usa a cópia feita na denúncia (a mensagem pode ter sido apagada depois).
    r0.message = r0.snapshot ? JSON.parse(r0.snapshot) : r0.message_id ? get('SELECT kind, body, media, created_at FROM messages WHERE id = ?', r0.message_id) : null;
    delete r0.snapshot;
  }
  res.json(rows);
});

r.post('/reports/:id/resolve', requireAuth('club', 'admin'), (req, res) => {
  const a = req.actor;
  const { changes } = a.type === 'admin'
    ? run(`UPDATE reports SET status = 'resolvida' WHERE id = ?`, int(req.params.id))
    : run(`UPDATE reports SET status = 'resolvida' WHERE id = ? AND (club_id = ? OR reported_club_id = ?)`, int(req.params.id), a.id, a.id);
  if (!changes) fail(404, 'Denúncia não encontrada');
  res.json({ ok: true });
});

export default r;
