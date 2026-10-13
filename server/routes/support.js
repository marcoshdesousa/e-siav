// Suporte: cada conta (clube, unidade ou membro) conversa com a equipe do app, como um chat.
// Links dos sites que abrem dentro do app: SGC (clube), Cantinho da Unidade (unidade) e Cartão DBV (membro).
import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth, requireLogin } from '../auth.js';
import { fail, int, str } from '../util.js';
import { setting, setSetting } from '../fees.js';

const r = Router();
const admin = requireAuth('admin');
const user = requireAuth('club', 'unit', 'member');

// ---------- Links ----------
const LINKS = { club: 'link_sgc', unit: 'link_cantinho', member: 'link_cartao' };
r.get('/links', requireLogin, (req, res) => {
  const out = {};
  for (const [type, key] of Object.entries(LINKS)) if (req.actor.type === type || req.actor.type === 'admin') out[key] = setting(key) || '';
  res.json(out);
});

// Muitos sites (com login) não deixam ser abertos dentro de outro site. O app confere isso
// pelos cabeçalhos do site e, se for bloqueado, mostra um botão para abrir fora em vez de
// uma tela branca. Guardado por 1 hora.
const frameCache = new Map();
export function blocksFrame(headers) {
  const xfo = String(headers.get('x-frame-options') || '').toLowerCase();
  if (xfo.includes('deny') || xfo.includes('sameorigin')) return true;
  const csp = String(headers.get('content-security-policy') || '');
  const fa = csp.split(';').map((p) => p.trim()).find((p) => p.toLowerCase().startsWith('frame-ancestors'));
  if (!fa) return false;
  const sources = fa.split(/\s+/).slice(1);
  return !sources.includes('*') && !sources.some((x) => /^https?:\*?$|^\*$/.test(x));
}
async function canFrame(url) {
  const hit = frameCache.get(url);
  if (hit && Date.now() - hit.at < 3600e3) return hit.ok;
  let ok = true;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const resp = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (App do DBV)' } });
    clearTimeout(t);
    ok = !blocksFrame(resp.headers);
    resp.body?.cancel?.().catch(() => {});
  } catch { ok = true; /* não deu para conferir: tenta abrir dentro mesmo */ }
  frameCache.set(url, { ok, at: Date.now() });
  return ok;
}
r.get('/links/abre-dentro', requireLogin, async (req, res) => {
  const key = Object.values(LINKS).find((k) => k === req.query.key);
  if (!key) fail(400, 'Link inválido');
  const allowed = req.actor.type === 'admin' || LINKS[req.actor.type] === key;
  if (!allowed) fail(403, 'Sem acesso');
  const url = setting(key) || '';
  res.json({ ok: url ? await canFrame(url) : false });
});
const okUrl = (v) => {
  const s = str(v, 500);
  if (!s) return '';
  if (!/^https?:\/\/[^\s]+$/i.test(s)) fail(400, 'O link precisa começar com https://');
  return s;
};
r.get('/admin/configuracoes', admin, (_req, res) => res.json(Object.fromEntries(Object.values(LINKS).map((k) => [k, setting(k) || '']))));
r.put('/admin/configuracoes', admin, (req, res) => {
  for (const k of Object.values(LINKS)) if (req.body[k] !== undefined) setSetting(k, okUrl(req.body[k]));
  frameCache.clear();
  res.json({ ok: true });
});

// ---------- Suporte ----------
const threadOf = (type, id) => get('SELECT * FROM support_threads WHERE actor_type = ? AND actor_id = ?', type, id);
const messagesOf = (threadId) => all('SELECT id, sender, text, created_at FROM support_messages WHERE thread_id = ? ORDER BY id', threadId);

r.get('/suporte', user, (req, res) => {
  const t = threadOf(req.actor.type, req.actor.id);
  if (t && t.user_unread) run('UPDATE support_threads SET user_unread = 0 WHERE id = ?', t.id);
  res.json({ messages: t ? messagesOf(t.id) : [] });
});
r.get('/suporte/nao-lidas', user, (req, res) => res.json({ count: threadOf(req.actor.type, req.actor.id)?.user_unread || 0 }));
r.post('/suporte', user, (req, res) => {
  const text = str(req.body.text, 2000);
  if (!text) fail(400, 'Escreva a mensagem');
  tx(() => {
    let t = threadOf(req.actor.type, req.actor.id);
    if (!t) t = { id: Number(run('INSERT INTO support_threads (actor_type, actor_id) VALUES (?, ?)', req.actor.type, req.actor.id).lastInsertRowid) };
    run(`INSERT INTO support_messages (thread_id, sender, text) VALUES (?, 'user', ?)`, t.id, text);
    run(`UPDATE support_threads SET admin_unread = admin_unread + 1, last_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, t.id);
  });
  res.json({ ok: true });
});

/** Quem é a conta da conversa (para o admin). */
function whoIs(type, id) {
  if (type === 'club') {
    const c = get('SELECT name, code, logo FROM clubs WHERE id = ?', id);
    return c && { name: c.name, sub: `Código ${c.code}`, photo: c.logo };
  }
  if (type === 'unit') {
    const u = get('SELECT u.name, u.logo, c.name AS club FROM units u JOIN clubs c ON c.id = u.club_id WHERE u.id = ?', id);
    return u && { name: `Unidade ${u.name}`, sub: u.club, photo: u.logo };
  }
  const m = get('SELECT m.name, m.code, m.photo, c.name AS club FROM members m JOIN clubs c ON c.id = m.club_id WHERE m.id = ?', id);
  return m && { name: m.name, sub: `${m.club} · código ${m.code}`, photo: m.photo };
}

r.get('/admin/suporte', admin, (_req, res) => {
  const rows = all('SELECT * FROM support_threads ORDER BY last_at DESC').map((t) => {
    const who = whoIs(t.actor_type, t.actor_id);
    if (!who) return null;
    const last = get('SELECT sender, text, created_at FROM support_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 1', t.id);
    return { id: t.id, type: t.actor_type, ...who, unread: t.admin_unread, last };
  }).filter(Boolean);
  res.json(rows);
});
r.get('/admin/suporte/:id', admin, (req, res) => {
  const t = get('SELECT * FROM support_threads WHERE id = ?', int(req.params.id));
  if (!t) fail(404, 'Conversa não encontrada');
  run('UPDATE support_threads SET admin_unread = 0 WHERE id = ?', t.id);
  res.json({ id: t.id, type: t.actor_type, ...whoIs(t.actor_type, t.actor_id), messages: messagesOf(t.id) });
});
r.post('/admin/suporte/:id', admin, (req, res) => {
  const t = get('SELECT * FROM support_threads WHERE id = ?', int(req.params.id));
  if (!t) fail(404, 'Conversa não encontrada');
  const text = str(req.body.text, 2000);
  if (!text) fail(400, 'Escreva a mensagem');
  run(`INSERT INTO support_messages (thread_id, sender, text) VALUES (?, 'admin', ?)`, t.id, text);
  run(`UPDATE support_threads SET user_unread = user_unread + 1, last_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, t.id);
  res.json({ ok: true });
});
r.get('/admin/suporte-nao-lidas', admin, (_req, res) => res.json({ count: get('SELECT COALESCE(SUM(admin_unread), 0) n FROM support_threads').n }));

export default r;
