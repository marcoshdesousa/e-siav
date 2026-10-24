// Transferência de membro entre clubes:
// 1) O clube novo pede, informando o código do membro (6 números), o nome do clube em que ele está e o motivo.
// 2) O clube atual aceita (o membro muda de clube levando todo o histórico) ou recusa.
// Quem está no Clube App Brasil (conta criada pelo app, sem clube): quem aceita é o administrador
// geral ou o administrador do App.
import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int, str, memberKind } from '../util.js';
import { norm } from '../catalog.js';
import { appClub } from '../appBrasil.js';

const r = Router();
r.use('/club/transfers', requireAuth('club'));

const LIST_SQL = `SELECT t.id, t.status, t.reason, t.created_at, t.updated_at, t.from_club_id, t.to_club_id,
    m.name AS member_name, m.code AS member_code, m.photo AS member_photo,
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

/** "Clube Águias do Vale", "águias do vale" e "Aguias" valem para o mesmo clube. */
const clubKey = (v) => norm(String(v || '').replace(/^\s*(\d+º\s*)?clube?\s+/i, ''));

const setStatus = (t, status) => run(`UPDATE transfers SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, status, t.id);
function move(t) {
  tx(() => {
    setStatus(t, 'concluida');
    // No clube novo, o desbravador fica sem unidade (o clube escolhe) e a liderança vai para a unidade Liderança.
    // Tudo o que o membro conquistou continua com ele.
    const m = get('SELECT birth_date FROM members WHERE id = ?', t.member_id);
    const unit = memberKind(m.birth_date) === 'lideranca' ? get('SELECT id FROM units WHERE club_id = ? AND is_leadership = 1', t.to_club_id)?.id ?? null : null;
    run(`UPDATE members SET club_id = ?, unit_id = ?, status = 'ativo' WHERE id = ?`, t.to_club_id, unit, t.member_id);
    run(`DELETE FROM achievement_requests WHERE member_id = ? AND status = 'pendente'`, t.member_id);
  });
}

r.post('/club/transfers', (req, res) => {
  const code = String(req.body.code || '').replace(/\D/g, '');
  const clubName = str(req.body.club_name, 120);
  const reason = str(req.body.reason, 500);
  if (!/^\d{6}$/.test(code)) fail(400, 'Informe o código do membro (6 números)');
  if (!clubName) fail(400, 'Informe o nome do clube em que ele está agora');
  if (reason.length < 5) fail(400, 'Conte o motivo da transferência');
  const m = get(`SELECT m.id, m.name, m.club_id, c.name AS club_name, c.is_app FROM members m JOIN clubs c ON c.id = m.club_id WHERE m.code = ? AND m.status <> 'inativo'`, code);
  // O código e o clube atual precisam bater (sem diferenciar acentos e maiúsculas).
  const sameClub = m && (m.is_app ? ['app brasil', 'app'].some((k) => clubKey(clubName).includes(k)) || clubKey(clubName) === clubKey(m.club_name) : clubKey(m.club_name).includes(clubKey(clubName)) && clubKey(clubName).length >= 3);
  if (!m || !sameClub) fail(404, 'Não achamos esse código nesse clube. Confira o código do membro e o nome do clube dele.');
  if (m.club_id === req.actor.id) fail(400, 'Esta pessoa já é do seu clube');
  if (get(`SELECT 1 FROM transfers WHERE member_id = ? AND status IN ('pendente_origem','pendente_destino')`, m.id)) fail(409, 'Já existe um pedido de transferência em andamento para esta pessoa');
  const id = Number(run('INSERT INTO transfers (member_id, from_club_id, to_club_id, reason) VALUES (?,?,?,?)', m.id, m.club_id, req.actor.id, reason).lastInsertRowid);
  res.json({ id, member_name: m.name, from_club_name: m.club_name, app: !!m.is_app });
});

function load(req) {
  const t = get('SELECT * FROM transfers WHERE id = ?', int(req.params.id));
  if (!t || (t.from_club_id !== req.actor.id && t.to_club_id !== req.actor.id)) fail(404, 'Pedido não encontrado');
  return t;
}

// Clube atual: aceita (o membro muda de clube) ou recusa.
r.post('/club/transfers/:id/origem', (req, res) => {
  const t = load(req);
  if (t.from_club_id !== req.actor.id || t.status !== 'pendente_origem') fail(400, 'Este pedido não está esperando o seu clube');
  if (req.body.accept) move(t);
  else setStatus(t, 'recusada');
  res.json({ ok: true });
});

// Administrador geral ou do App: pedidos para tirar alguém do Clube App Brasil.
const appAdmin = (req, _res, next) => {
  if (!(req.actor.district_id === null || req.actor.district_id === undefined) && !req.actor.app) fail(403, 'Só o administrador geral ou o do App');
  next();
};
r.get('/admin/app-transferencias', requireAuth('admin'), appAdmin, (_req, res) => {
  const c = appClub();
  res.json(c ? all(`${LIST_SQL} WHERE t.from_club_id = ? AND t.status = 'pendente_origem' ORDER BY t.id DESC`, c.id) : []);
});
r.post('/admin/app-transferencias/:id', requireAuth('admin'), appAdmin, (req, res) => {
  const c = appClub();
  const t = get(`SELECT * FROM transfers WHERE id = ? AND from_club_id = ? AND status = 'pendente_origem'`, int(req.params.id), c?.id ?? 0);
  if (!t) fail(404, 'Pedido não encontrado');
  if (req.body.accept) move(t);
  else setStatus(t, 'recusada');
  res.json({ ok: true });
});

// Clube novo: desiste do pedido.
r.post('/club/transfers/:id/cancelar', (req, res) => {
  const t = load(req);
  if (t.to_club_id !== req.actor.id) fail(403, 'Só o clube que pediu pode cancelar');
  if (t.status !== 'pendente_origem') fail(400, 'Este pedido já foi encerrado');
  setStatus(t, 'cancelada');
  res.json({ ok: true });
});

export default r;
