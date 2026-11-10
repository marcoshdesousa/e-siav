// Plano do clube: o clube paga R$ 15 a cada 30 dias (só mensal) pelo portal do clube; o administrador
// pode deixar o clube grátis. Os membros NÃO dependem do plano do clube: o desbravador usa o app de
// graça e a liderança (16 anos ou mais) assina o DBV (R$ 1,90) ou o DBV+ (R$ 3,90), com 7 dias grátis
// (server/plus.js). Janeiro e dezembro são grátis para todos os clubes (férias) e não gastam os dias
// pagos. Ao ser cadastrado, o clube já ganha os primeiros 30 dias. Se o plano vence, o clube tem 3 dias
// de carência.
import { get, run } from './db.js';

export const CLUB_PLANS = {
  mensal: { id: 'mensal', name: 'Plano do clube (30 dias)', price_cents: 1500, days: 30 },
};
export const GRACE_DAYS = 3;
export const FIRST_DAYS = 30;

const brMonth = (d) => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', month: '2-digit' }).format(d));
/** Janeiro e dezembro: grátis para todos os clubes. */
export const isFreeMonth = (d = new Date()) => [1, 12].includes(brMonth(d));

/** Soma dias "cobráveis" (pula janeiro e dezembro, que já são grátis). */
export function addBillableDays(fromIso, days) {
  let t = new Date(Math.max(Date.parse(fromIso || 0) || 0, Date.now()));
  let left = days;
  while (left > 0) {
    t = new Date(t.getTime() + 864e5);
    if (!isFreeMonth(t)) left--;
  }
  return t.toISOString();
}

/** Situação do plano do clube: ok | gratis (jan/dez) | carencia (venceu há até 3 dias) | vencido. */
export function clubStatus(clubId, now = new Date()) {
  const c = get('SELECT paid_until, is_app, club_billing, member_billing FROM clubs WHERE id = ?', clubId);
  if (!c || c.is_app) return null;
  const billing = { club_billing: c.club_billing, member_billing: c.member_billing };
  if (c.club_billing === 'gratis' && c.member_billing !== 'pago') return { state: 'gratis_sempre', paid_until: null, grace_until: null, free_month: isFreeMonth(now), ...billing };
  if (c.club_billing === 'gratis') {
    // Os membros pagam, mas o clube pode assumir: em dia, todos usam de graça (sem carência nem cobrança).
    const iso = now.toISOString();
    const state = c.paid_until && c.paid_until > iso ? 'ok' : isFreeMonth(now) ? 'gratis' : 'membros_pagam';
    return { state, optional: true, paid_until: c.paid_until, grace_until: null, free_month: isFreeMonth(now), ...billing };
  }
  const until = c.paid_until;
  const graceUntil = until ? new Date(Date.parse(until) + GRACE_DAYS * 864e5).toISOString() : null;
  const iso = now.toISOString();
  let state = 'vencido';
  if (until && until > iso) state = 'ok';
  else if (isFreeMonth(now)) state = 'gratis';
  else if (graceUntil && graceUntil > iso) state = 'carencia';
  return { state, paid_until: until, grace_until: graceUntil, free_month: isFreeMonth(now), ...billing };
}
/** O clube está pagando pelos membros (clube pago em dia, ou clube grátis que assumiu a cobrança)? */
export function clubPaysForMembers(clubId) {
  const st = clubStatus(clubId);
  if (!st) return false;
  if (st.optional) return st.state === 'ok';
  return st.club_billing === 'pago' && ['ok', 'gratis', 'carencia'].includes(st.state);
}

/**
 * Os membros precisam assinar o DBV para usar o app? 'membro_pago' (o clube foi criado assim),
 * 'clube_vencido' (o clube paga pelos membros e não pagou) ou null (usam de graça).
 */
export function membersMustPay(clubId) {
  const st = clubStatus(clubId);
  if (!st) return null;
  if (st.state === 'membros_pagam') return { reason: 'membro_pago' };
  if (st.state === 'vencido') return { reason: 'clube_vencido' };
  if (st.state === 'carencia') return { grace: true, grace_until: st.grace_until };
  return null;
}

/** Pagamento confirmado: soma os dias (a partir de hoje ou do fim do plano atual). */
export function extendClub(clubId, planId) {
  const plan = CLUB_PLANS[planId] || CLUB_PLANS.mensal;
  const c = get('SELECT paid_until FROM clubs WHERE id = ?', clubId);
  const until = addBillableDays(c?.paid_until, plan.days);
  run('UPDATE clubs SET paid_until = ? WHERE id = ?', until, clubId);
  return until;
}
/** Na inicialização: clube que ainda não tem plano ganha os primeiros 30 dias. */
export function initClubPlans() {
  run(`UPDATE clubs SET paid_until = ? WHERE paid_until IS NULL AND is_app = 0 AND club_billing = 'pago'`, addBillableDays(null, FIRST_DAYS));
}
/** Clube novo (ou que ainda não tinha plano): os primeiros 30 dias. */
export function startClubPlan(clubId) {
  run(`UPDATE clubs SET paid_until = ? WHERE id = ? AND paid_until IS NULL AND club_billing = 'pago'`, addBillableDays(null, FIRST_DAYS), clubId);
}
