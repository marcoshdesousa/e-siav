import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int, str } from '../util.js';
import { clubPayments, feeConfig, setSetting, toCents } from '../fees.js';

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
      members_unpaid: p.member_fee.members.length - p.member_fee.paid_count, members_total: p.member_fee.members.length,
    };
  });
  res.json({ config: feeConfig(), clubs });
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

// Taxa anual do membro: marcar como paga (ou desfazer). ids: lista de membros.
r.post('/admin/pagamentos/membros', admin, (req, res) => {
  const year = int(req.body.year, new Date().getFullYear());
  const ids = (Array.isArray(req.body.member_ids) ? req.body.member_ids : []).map(Number).filter(Boolean);
  const cents = feeConfig().fee_member_year_cents;
  tx(() => {
    for (const id of ids) {
      if (req.body.paid) run(`INSERT OR IGNORE INTO member_fees (member_id, year, amount_cents, paid_at) VALUES (?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`, id, year, cents);
      else run('DELETE FROM member_fees WHERE member_id = ? AND year = ?', id, year);
    }
  });
  res.json({ ok: true });
});

export default r;
