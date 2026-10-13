// Transferência de membro entre clubes.
// Cada membro fica no sistema para sempre; se ele trocar de clube:
// 1) O clube novo pede, informando o nome completo e o código do membro.
// 2) O clube atual aceita (o membro já muda de clube, levando todo o histórico) ou recusa.
import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int, str, cleanCpf, memberKind } from '../util.js';
import { norm } from '../catalog.js';

const r = Router();
r.use('/club/transfers', requireAuth('club'));

const LIST_SQL = `SELECT t.id, t.status, t.created_at, t.updated_at, t.from_club_id, t.to_club_id,
    m.name AS member_name, m.code AS member_code, m.photo AS member_photo, m.status AS member_status,
    fc.name AS from_club_name, tc.name AS to_club_name
  FROM transfers t JOIN members m ON m.id = t.member_id
  JOIN clubs fc ON fc.id = t.from_club_id JOIN clubs tc ON tc.id = t.to_club_id`;

r.get('/club/transfers', (req, res) => {
  const id = req.actor.id;
  res.json({
    received: all(`${LIST_SQL} WHERE t.from_club_id = ? ORDER BY t.id DESC LIMIT 100`, id),
    sent: all(`${LIST_SQL} WHERE t.to_club_id = ? ORDER BY t.id DESC LIMIT 100`, id),
  });
});

r.post('/club/transfers', (req, res) => {
  // Nome completo + código do membro (6 números). Também aceita CPF ou certidão, se o membro tiver.
  const doc = String(req.body.doc ?? req.body.code ?? req.body.cpf ?? '').trim();
  const name = str(req.body.name, 120);
  if (!name) fail(400, 'Informe o nome completo');
  const digits = doc.replace(/\D/g, '');
  let m = null;
  if (/^\d{6}$/.test(digits) && digits === doc.replace(/\s/g, '')) m = get('SELECT id, name, club_id FROM members WHERE code = ?', digits);
  if (!m && cleanCpf(doc)) m = get('SELECT id, name, club_id FROM members WHERE cpf = ?', cleanCpf(doc));
  if (!m && doc.replace(/[^\dA-Za-z]/g, '').length >= 6) m = get('SELECT id, name, club_id FROM members WHERE birth_cert = ?', doc.replace(/[^\dA-Za-z]/g, ''));
  if (!doc) fail(400, 'Informe o código do membro (6 números)');
  // Nome e código precisam bater (sem diferenciar acentos e maiúsculas).
  if (!m || norm(m.name) !== norm(name)) fail(404, 'Não achamos ninguém com esse nome e código');
  if (m.club_id === req.actor.id) fail(400, 'Esta pessoa já é do seu clube');
  if (get(`SELECT 1 FROM transfers WHERE member_id = ? AND status IN ('pendente_origem','pendente_destino')`, m.id)) {
    fail(409, 'Já existe um pedido de transferência em andamento para esta pessoa');
  }
  const id = Number(run('INSERT INTO transfers (member_id, from_club_id, to_club_id) VALUES (?,?,?)', m.id, m.club_id, req.actor.id).lastInsertRowid);
  res.json({ id, member_name: m.name, from_club_name: get('SELECT name FROM clubs WHERE id = ?', m.club_id).name });
});

function load(req) {
  const t = get('SELECT * FROM transfers WHERE id = ?', int(req.params.id));
  if (!t || (t.from_club_id !== req.actor.id && t.to_club_id !== req.actor.id)) fail(404, 'Pedido não encontrado');
  return t;
}
const setStatus = (t, status) => run(`UPDATE transfers SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, status, t.id);

function move(t) {
  tx(() => {
    setStatus(t, 'concluida');
    // No clube novo, desbravador fica sem unidade e a liderança vai para a unidade "Liderança".
    // Tudo o que o membro conquistou continua com ele.
    const m = get('SELECT birth_date FROM members WHERE id = ?', t.member_id);
    const unit = memberKind(m.birth_date) === 'lideranca' ? get('SELECT id FROM units WHERE club_id = ? AND is_leadership = 1', t.to_club_id)?.id ?? null : null;
    run(`UPDATE members SET club_id = ?, unit_id = ?, status = 'ativo' WHERE id = ?`, t.to_club_id, unit, t.member_id);
    run(`DELETE FROM achievement_requests WHERE member_id = ? AND status = 'pendente'`, t.member_id);
  });
}

// Clube atual: aceita (pronto, o membro muda de clube) ou recusa.
r.post('/club/transfers/:id/origem', (req, res) => {
  const t = load(req);
  if (t.from_club_id !== req.actor.id || t.status !== 'pendente_origem') fail(400, 'Este pedido não está esperando o seu clube');
  if (req.body.accept) move(t);
  else setStatus(t, 'recusada');
  res.json({ ok: true });
});

// Clube novo: desiste do pedido. Pedidos antigos que já tinham sido aceitos também concluem aqui.
r.post('/club/transfers/:id/destino', (req, res) => {
  const t = load(req);
  if (t.to_club_id !== req.actor.id) fail(403, 'Só o clube que pediu pode mexer neste pedido');
  if (!['pendente_origem', 'pendente_destino'].includes(t.status)) fail(400, 'Este pedido já foi encerrado');
  if (req.body.accept && t.status === 'pendente_destino') move(t);
  else if (req.body.accept) fail(400, 'O clube atual ainda não aceitou');
  else setStatus(t, 'cancelada');
  res.json({ ok: true });
});

export default r;
