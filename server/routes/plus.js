// DBV+: planos, assinatura pelo Pix, escolha das especialidades e a lista do administrador geral.
import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth, requireGeneral } from '../auth.js';
import { fail, int } from '../util.js';
import { createPayment, onPaid, paymentOut } from '../payments.js';
import { PLANS, PLUS_DAYS, PLUS_PACKS, activatePlus, grantPlus, plusOf, plusOpen, removePlus } from '../plus.js';

const r = Router();
const member = requireAuth('member');
const admin = requireAuth('admin');

onPaid('dbvplus', (p, ref) => activatePlus(p.member_id, ref.plan));

/** Benefícios (os que ainda não estão prontos aparecem por último, como "em breve"). */
// O que todos têm de graça, sem pagar nada.
export const FREE = [
  'Ano Bíblico, Meditação Diária e Escola Sabatina com as sequências',
  'Áudio dos 5 primeiros dias do Ano Bíblico e da Meditação',
  'Jogos, álbuns de figurinhas e pacotinhos ganhos nos estudos',
  'Perfil, especialidades, classes e rankings do distrito',
];

export const BENEFITS = [
  { text: 'Áudio de todos os dias do Ano Bíblico e da Meditação, e do Bom Líder' },
  { text: 'Bom Líder: Manual Administrativo e Nisto Cremos' },
  { text: `${PLUS_PACKS} pacotinhos de figurinhas a cada ${PLUS_DAYS} dias` },
  { text: 'Figurinhas em dobro: 2 pacotinhos pelo preço de 1' },
  { text: 'Participa do ranking dos jogos' },
  { text: 'Jogos sem internet (modo offline)' },
  { text: 'Selo de verificado (logo dourada) no perfil' },
  { text: 'Especialidades físicas entregues pela equipe (planos de R$ 19,90 e R$ 34,90)' },
  { text: 'Livro do Ano', soon: true },
  { text: 'Estudo das Classes e Agrupadas', soon: true },
];

r.get('/plus', member, (req, res) => {
  const p = plusOf(req.actor.id);
  res.json({
    plans: Object.values(PLANS), benefits: BENEFITS, free: FREE, days: PLUS_DAYS, packs: PLUS_PACKS,
    mine: p, open: plusOpen(req.actor.id),
    picks_names: p?.picks ? all(`SELECT id, name, category FROM content WHERE id IN (${p.picks.map(() => '?').join(',')})`, ...p.picks) : [],
  });
});

r.post('/plus/assinar', member, async (req, res) => {
  const plan = PLANS[req.body.plan];
  if (!plan) fail(400, 'Escolha um plano');
  // Um plano por vez: só dá para assinar de novo quando o atual vencer.
  const cur = plusOf(req.actor.id);
  if (cur?.active) fail(409, `Você já tem o ${cur.plan_name}. Um novo plano fica disponível em ${new Date(cur.until).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`);
  const pay = await createPayment({ memberId: req.actor.id, purpose: 'dbvplus', ref: { plan: plan.id }, title: `${plan.name} (${PLUS_DAYS} dias)`, amountCents: plan.price_cents });
  res.json(await paymentOut(pay));
});

// Escolha das especialidades do plano (15 ou 20); a equipe compra 3 ou 7 delas e entrega (surpresa).
r.put('/plus/especialidades', member, (req, res) => {
  const p = plusOf(req.actor.id);
  if (!p?.active || !p.picks_needed) fail(400, 'O seu plano não tem especialidades para escolher');
  const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(int))];
  if (ids.length !== p.picks_needed) fail(400, `Escolha exatamente ${p.picks_needed} especialidades`);
  const ok = get(`SELECT COUNT(*) n FROM content WHERE type = 'especialidade' AND id IN (${ids.map(() => '?').join(',')})`, ...ids).n;
  if (ok !== ids.length) fail(400, 'Especialidade inválida');
  run(`UPDATE member_plus SET picks = ?, picks_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE member_id = ?`, JSON.stringify(ids), req.actor.id);
  res.json({ ok: true });
});

// Administrador geral: assinantes, plano, validade e as especialidades escolhidas (para copiar).
r.get('/admin/plus', admin, requireGeneral, (_req, res) => {
  const rows = all(`SELECT p.*, m.name, m.code, c.name AS club_name, d.name AS district_name
    FROM member_plus p JOIN members m ON m.id = p.member_id JOIN clubs c ON c.id = m.club_id JOIN districts d ON d.id = c.district_id
    ORDER BY p.until DESC`);
  const names = new Map(all(`SELECT id, name FROM content WHERE type = 'especialidade'`).map((x) => [x.id, x.name]));
  const now = new Date().toISOString();
  res.json(rows.map((x) => ({
    member_id: x.member_id, name: x.name, code: x.code, club_name: x.club_name, district_name: x.district_name,
    plan: x.plan, plan_name: PLANS[x.plan]?.name || x.plan, until: x.until, active: x.until > now, started_at: x.started_at, renewals: x.renewals,
    picks_needed: x.picks_needed, picks_at: x.picks_at, picks: x.picks ? JSON.parse(x.picks).map((id) => names.get(id) || `#${id}`) : [],
  })));
});

// Administrador geral: dar o DBV+ sem pagamento (contas de teste, cortesia) ou tirar.
r.post('/admin/plus/dar', admin, requireGeneral, (req, res) => {
  const m = get('SELECT id, name FROM members WHERE code = ?', String(req.body.code || '').trim());
  if (!m) fail(404, 'Membro não encontrado');
  if (!PLANS[req.body.plan]) fail(400, 'Escolha um plano');
  const days = Math.min(Math.max(int(req.body.days) || PLUS_DAYS, 1), 3650);
  res.json({ ok: true, name: m.name, until: grantPlus(m.id, req.body.plan, days) });
});
r.delete('/admin/plus/:memberId', admin, requireGeneral, (req, res) => {
  removePlus(int(req.params.memberId));
  res.json({ ok: true });
});

export default r;
