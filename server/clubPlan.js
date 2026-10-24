// Plano do clube: o clube paga R$ 15 a cada 30 dias (ou o ano todo de uma vez) para que os membros
// usem o app de graça. Janeiro e dezembro são grátis para todos os clubes (férias) e não gastam os
// dias pagos. Ao ser cadastrado, o clube já ganha os primeiros 30 dias.
// Se o plano vence, o clube tem 3 dias de carência; depois disso o portal do clube e o login das
// unidades continuam funcionando, mas os membros precisam assinar o DBV (R$ 3,90) ou o DBV+ para usar
// o app. O que o membro pagou nesse tempo não é devolvido quando o clube volta a pagar.
import { get, run } from './db.js';

export const CLUB_PLANS = {
  mensal: { id: 'mensal', name: 'Plano do clube (30 dias)', price_cents: 1500, days: 30 },
  anual: { id: 'anual', name: 'Plano do clube (ano todo)', price_cents: 15000, days: 300 },
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
  const c = get('SELECT paid_until, is_app FROM clubs WHERE id = ?', clubId);
  if (!c || c.is_app) return null;
  const until = c.paid_until;
  const graceUntil = until ? new Date(Date.parse(until) + GRACE_DAYS * 864e5).toISOString() : null;
  const iso = now.toISOString();
  let state = 'vencido';
  if (until && until > iso) state = 'ok';
  else if (isFreeMonth(now)) state = 'gratis';
  else if (graceUntil && graceUntil > iso) state = 'carencia';
  return { state, paid_until: until, grace_until: graceUntil, free_month: isFreeMonth(now) };
}
/** Os membros do clube usam o app de graça? */
export const clubCovers = (clubId) => ['ok', 'gratis', 'carencia'].includes(clubStatus(clubId)?.state);

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
  run('UPDATE clubs SET paid_until = ? WHERE paid_until IS NULL AND is_app = 0', addBillableDays(null, FIRST_DAYS));
}
/** Clube novo (ou que ainda não tinha plano): os primeiros 30 dias. */
export function startClubPlan(clubId) {
  run('UPDATE clubs SET paid_until = ? WHERE id = ? AND paid_until IS NULL', addBillableDays(null, FIRST_DAYS), clubId);
}
