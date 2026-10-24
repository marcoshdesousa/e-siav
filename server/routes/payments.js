// Pagamentos (Pix) do site todo: o membro acompanha o pagamento; a SyncPay avisa; a equipe
// configura o Pix, vê todos os pagamentos e confirma os manuais.
import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { cleanCpf, fail, int, str } from '../util.js';
import { setSetting } from '../fees.js';
import { checkPayment, creditPayment, defaultPayer, paymentOut, pixConfig } from '../payments.js';
import { fakePay, idsInWebhook, syncpayOn } from '../syncpay.js';

const r = Router();
const member = requireAuth('member', 'club');
const admin = requireAuth('admin');

const mine = (req) => {
  const p = get(`SELECT * FROM payments WHERE id = ? AND ${req.actor.type === 'club' ? 'club_id' : 'member_id'} = ?`, int(req.params.id), req.actor.id);
  if (!p) fail(404, 'Pagamento não encontrado');
  return p;
};
r.get('/pagamentos/:id', member, async (req, res) => res.json(await paymentOut(await checkPayment(mine(req)))));
r.post('/pagamentos/:id/paguei', member, (req, res) => {
  const p = mine(req);
  if (p.status !== 'aberto') fail(400, 'Este pagamento não está esperando');
  run(`UPDATE payments SET status = 'aguardando', notified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, p.id);
  res.json({ ok: true });
});
r.post('/pagamentos/:id/cancelar', member, (req, res) => {
  const p = mine(req);
  if (p.status !== 'aberto') fail(400, 'Só dá para cancelar o que ainda não foi pago');
  run(`UPDATE payments SET status = 'cancelado' WHERE id = ?`, p.id);
  res.json({ ok: true });
});
if (process.env.SYNCPAY_FAKE === '1') {
  r.post('/pagamentos/:id/_simular', member, (req, res) => { fakePay(mine(req).identifier); res.json({ ok: true }); });
}

// Aviso da SyncPay: responde na hora e só usa o aviso para conferir os pagamentos citados.
const webhook = (req, res) => {
  res.json({ ok: true });
  (async () => {
    for (const id of idsInWebhook(req.body)) {
      const p = get('SELECT * FROM payments WHERE lower(identifier) = ?', id);
      if (p) await checkPayment(p, { force: true });
    }
  })().catch((e) => console.warn('[syncpay] aviso:', e.message));
};
r.post('/pagamentos/aviso', webhook);
r.post('/albuns/pix/aviso', webhook); // endereço antigo

// ---------- Equipe ----------
const LIST_SQL = `SELECT p.id, p.purpose, p.title, p.amount_cents, p.txid, p.identifier, p.status, p.created_at, p.notified_at, p.paid_at,
    COALESCE(m.name, 'Clube (plano do clube)') AS member_name, m.code AS member_code, c.name AS club_name, u.name AS unit_name
  FROM payments p LEFT JOIN members m ON m.id = p.member_id JOIN clubs c ON c.id = COALESCE(p.club_id, m.club_id) LEFT JOIN units u ON u.id = m.unit_id`;
r.get('/admin/pagamentos', admin, (req, res) => {
  const status = ['aberto', 'aguardando', 'pago', 'recusado', 'cancelado'].includes(req.query.status) ? req.query.status : 'aguardando';
  res.json({
    rows: all(`${LIST_SQL} WHERE p.status = ? ORDER BY p.id DESC LIMIT 200`, status),
    counts: Object.fromEntries(all('SELECT status, COUNT(*) n FROM payments GROUP BY status').map((x) => [x.status, x.n])),
    total_paid_cents: get(`SELECT COALESCE(SUM(amount_cents), 0) n FROM payments WHERE status = 'pago'`).n,
  });
});
r.post('/admin/pagamentos/:id/:acao', admin, (req, res) => {
  const p = get('SELECT * FROM payments WHERE id = ?', int(req.params.id));
  if (!p) fail(404, 'Pagamento não encontrado');
  if (!['aberto', 'aguardando'].includes(p.status)) fail(400, 'Este pagamento já foi resolvido');
  if (req.params.acao === 'confirmar') creditPayment(p);
  else if (req.params.acao === 'recusar') run(`UPDATE payments SET status = 'recusado' WHERE id = ?`, p.id);
  else fail(404, 'Ação inválida');
  res.json({ ok: true });
});
r.get('/admin/pagamentos-config', admin, (_req, res) => res.json({ ...pixConfig(), syncpay: syncpayOn(), payer: defaultPayer() || { name: '', cpf: '', email: '', phone: '' } }));
r.put('/admin/pagamentos-config/pix', admin, (req, res) => {
  setSetting('pix_key', str(req.body.key, 120) || '');
  setSetting('pix_name', str(req.body.name, 60) || '');
  setSetting('pix_city', str(req.body.city, 40) || '');
  res.json({ ok: true });
});
r.put('/admin/pagamentos-config/pagador', admin, (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 80);
  const cpf = b.cpf ? cleanCpf(b.cpf) : '';
  const email = str(b.email, 120).toLowerCase();
  const phone = String(b.phone || '').replace(/\D/g, '');
  if (b.cpf && !cpf) fail(400, 'CPF inválido');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'E-mail inválido');
  if (phone && !/^\d{10,13}$/.test(phone)) fail(400, 'Celular inválido (com DDD)');
  setSetting('payer_name', name); setSetting('payer_cpf', cpf || ''); setSetting('payer_email', email); setSetting('payer_phone', phone);
  res.json({ ok: true });
});

export default r;
