import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int, str } from '../util.js';
import { clubPayments, confirmOrder, feeConfig, payMemberFees, setSetting, toCents } from '../fees.js';
import { currentYear } from '../memberStatus.js';

const r = Router();

// Clã: vê as parcelas, a taxa anual dos membros e a chave Pix.
r.get('/club/pagamentos', requireAuth('club'), (req, res) => res.json(clubPayments(req.actor.id)));

const admin = requireAuth('admin');

r.get('/admin/pagamentos', admin, (_req, res) => {
  const clubs = all('SELECT id, name, number, code FROM clubs ORDER BY number').map((c) => {
    const p = clubPayments(c.id);
    return {
      ...c,
      paid: p.installments.filter((i) => i.paid_at).length, total: p.installments.length,
      overdue: p.installments.filter((i) => i.state === 'vencida').length, next_due: p.next_due,
      members_unpaid: p.member_fee.members.length - p.member_fee.paid_count, members_total: p.member_fee.members.length, open_orders: p.orders.length,
    };
  });
  res.json({ config: feeConfig(), clubs });
});

// Equipe: pedidos de inscrição esperando a confirmação do Pix.
r.get('/admin/pagamentos/inscricoes', admin, (_req, res) => {
  res.json(all(`SELECT o.*, c.name AS club_name, c.code AS club_code FROM fee_orders o JOIN clubs c ON c.id = o.club_id
                WHERE o.confirmed_at IS NULL AND o.canceled_at IS NULL ORDER BY o.id`).map((o) => {
    const ids = JSON.parse(o.member_ids);
    return { ...o, member_ids: ids, members: all(`SELECT id, name, code FROM members WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY name`, ...ids) };
  }));
});
r.get('/admin/pagamentos/:clubId', admin, (req, res) => {
  const c = get('SELECT id, name, number, code FROM clubs WHERE id = ?', int(req.params.clubId));
  if (!c) fail(404, 'Clã não encontrado');
  res.json({ club: c, ...clubPayments(c.id) });
});

// Valores e chave Pix (valem para os clãs criados daqui pra frente).
r.put('/admin/pagamentos/config', admin, (req, res) => {
  const member = toCents(req.body.fee_member_year);
  const month = toCents(req.body.fee_club_month);
  const n = int(req.body.club_installments);
  if (member == null || month == null) fail(400, 'Valor inválido');
  if (!(n >= 1 && n <= 60)) fail(400, 'Número de parcelas inválido');
  setSetting('fee_member_year_cents', member);
  setSetting('fee_club_month_cents', month);
  setSetting('club_installments', n);
  setSetting('pix_key', str(req.body.pix_key, 120));
  if (req.body.support_whatsapp !== undefined) setSetting('support_whatsapp', str(req.body.support_whatsapp, 30));
  res.json(feeConfig());
});

// Muda o valor das parcelas em aberto de um clã.
r.put('/admin/pagamentos/:clubId/valor', admin, (req, res) => {
  const cents = toCents(req.body.amount);
  if (cents == null) fail(400, 'Valor inválido');
  run('UPDATE club_installments SET amount_cents = ? WHERE club_id = ? AND paid_at IS NULL', cents, int(req.params.clubId));
  res.json({ ok: true });
});

r.post('/admin/pagamentos/parcela/:id', admin, (req, res) => {
  const { changes } = run(`UPDATE club_installments SET paid_at = ${req.body.paid ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : 'NULL'} WHERE id = ?`, int(req.params.id));
  if (!changes) fail(404, 'Parcela não encontrada');
  res.json({ ok: true });
});

// Pagou tudo de uma vez (ou as parcelas restantes).
r.post('/admin/pagamentos/:clubId/pagar-tudo', admin, (req, res) => {
  run(`UPDATE club_installments SET paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE club_id = ? AND paid_at IS NULL`, int(req.params.clubId));
  res.json({ ok: true });
});

// Taxa anual do membro: o admin também pode marcar direto (ou desfazer). ids: lista de membros.
r.post('/admin/pagamentos/membros', admin, (req, res) => {
  const year = int(req.body.year, currentYear());
  const ids = (Array.isArray(req.body.member_ids) ? req.body.member_ids : []).map(Number).filter(Boolean);
  tx(() => {
    if (req.body.paid) payMemberFees(ids, year, feeConfig().fee_member_year_cents);
    else {
      for (const id of ids) {
        run('DELETE FROM member_fees WHERE member_id = ? AND year = ?', id, year);
        // Desfez a inscrição do ano: volta a esperar o clã.
        const prev = get('SELECT MAX(year) y FROM member_fees WHERE member_id = ?', id).y;
        run(`UPDATE members SET cleared_year = ?, status = CASE WHEN status = 'ativo' AND (? IS NULL OR ? < ?) THEN 'pendente' ELSE status END
             WHERE id = ? AND cleared_year = ?`, prev, prev, prev, currentYear(), id, year);
      }
    }
  });
  res.json({ ok: true });
});

// Inscrição do ano: o clã escolhe um ou vários membros e paga tudo de uma vez no Pix.
// O pedido fica esperando a equipe confirmar o Pix; aí todos são liberados.
r.post('/club/pagamentos/inscricoes', requireAuth('club'), (req, res) => {
  const year = currentYear();
  const ids = [...new Set((Array.isArray(req.body.member_ids) ? req.body.member_ids : []).map(Number).filter(Boolean))];
  if (!ids.length) fail(400, 'Escolha pelo menos um membro');
  const p = clubPayments(req.actor.id, year);
  const byId = new Map(p.member_fee.members.map((m) => [m.id, m]));
  for (const id of ids) {
    const m = byId.get(id);
    if (!m) fail(400, 'Membro inválido');
    if (m.paid_at) fail(400, `A inscrição de ${m.name} já está paga`);
    if (m.order_id) fail(400, `${m.name} já está em um pagamento esperando confirmação`);
    if (m.needs_approval) fail(400, `Aprove a inscrição de ${m.name} antes de pagar`);
  }
  const amount = ids.length * feeConfig().fee_member_year_cents;
  const id = Number(run('INSERT INTO fee_orders (club_id, year, member_ids, amount_cents) VALUES (?,?,?,?)', req.actor.id, year, JSON.stringify(ids), amount).lastInsertRowid);
  res.json({ id, amount_cents: amount, pix_key: p.pix_key });
});

r.post('/club/pagamentos/inscricoes/:id/cancelar', requireAuth('club'), (req, res) => {
  const { changes } = run(`UPDATE fee_orders SET canceled_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                           WHERE id = ? AND club_id = ? AND confirmed_at IS NULL AND canceled_at IS NULL`, int(req.params.id), req.actor.id);
  if (!changes) fail(404, 'Pagamento não encontrado');
  res.json({ ok: true });
});

r.post('/admin/pagamentos/inscricoes/:id/confirmar', admin, (req, res) => {
  if (!confirmOrder(int(req.params.id))) fail(404, 'Pedido não encontrado');
  res.json({ ok: true });
});
r.post('/admin/pagamentos/inscricoes/:id/recusar', admin, (req, res) => {
  const { changes } = run(`UPDATE fee_orders SET canceled_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND confirmed_at IS NULL AND canceled_at IS NULL`, int(req.params.id));
  if (!changes) fail(404, 'Pedido não encontrado');
  res.json({ ok: true });
});

export default r;
