// Plano do clube: o clube vê até quando está pago e paga no Pix (30 dias ou o ano todo).
// O administrador geral vê a situação de cada clube e pode dar dias sem cobrança.
import { Router } from 'express';
import { all, run } from '../db.js';
import { requireAuth, requireGeneral } from '../auth.js';
import { fail, int } from '../util.js';
import { createPayment, onPaid, paymentOut } from '../payments.js';
import { CLUB_PLANS, GRACE_DAYS, addBillableDays, clubStatus, extendClub } from '../clubPlan.js';

const r = Router();
const club = requireAuth('club');

onPaid('clube', (p, ref) => extendClub(p.club_id, ref.plan));

r.get('/club/plano', club, (req, res) => {
  res.json({
    status: clubStatus(req.actor.id), plans: Object.values(CLUB_PLANS), grace_days: GRACE_DAYS,
    history: all(`SELECT id, title, amount_cents, status, created_at, paid_at FROM payments WHERE club_id = ? ORDER BY id DESC LIMIT 20`, req.actor.id),
  });
});

r.post('/club/plano/assinar', club, async (req, res) => {
  if (clubStatus(req.actor.id)?.state === 'gratis_sempre') fail(400, 'O seu clube é grátis: não tem cobrança');
  const plan = CLUB_PLANS[req.body.plan];
  if (!plan) fail(400, 'Escolha o plano');
  const pay = await createPayment({ clubId: req.actor.id, purpose: 'clube', ref: { plan: plan.id }, title: plan.name, amountCents: plan.price_cents });
  res.json(await paymentOut(pay));
});

// Administrador geral: dar dias de plano (cortesia, pagamento por fora).
r.post('/admin/clubs/:id/plano', requireAuth('admin'), requireGeneral, (req, res) => {
  const id = int(req.params.id);
  const days = Math.min(Math.max(int(req.body.days) || 0, 1), 3650);
  const st = clubStatus(id);
  if (!st) fail(404, 'Clube não encontrado');
  const until = addBillableDays(st.paid_until, days);
  run('UPDATE clubs SET paid_until = ? WHERE id = ?', until, id);
  res.json({ status: clubStatus(id) });
});

export default r;
