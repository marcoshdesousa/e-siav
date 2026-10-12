// Taxas do app: cada clã paga parcelas mensais (12 de R$ 30,85, valor que o admin
// pode mudar) a partir de 30 dias da criação; cada membro paga R$ 2,50 por ano.
// O pagamento é só no Pix; por enquanto o admin marca o que foi pago.
import { all, get, run } from './db.js';

export const setting = (k) => get('SELECT value FROM settings WHERE key = ?', k)?.value ?? null;
export const setSetting = (k, v) => run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, String(v));

export const feeConfig = () => ({
  fee_member_year_cents: Number(setting('fee_member_year_cents')),
  fee_club_month_cents: Number(setting('fee_club_month_cents')),
  club_installments: Number(setting('club_installments')),
  pix_key: setting('pix_key') || '',
});

/** Cria as parcelas do clã (se ainda não existirem): a 1ª vence 30 dias depois da criação. */
export function ensureInstallments(clubId, start) {
  if (get('SELECT 1 FROM club_installments WHERE club_id = ?', clubId)) return;
  const cfg = feeConfig();
  const base = new Date(start || Date.now());
  for (let n = 1; n <= cfg.club_installments; n++) {
    const due = new Date(base.getTime() + n * 30 * 864e5).toISOString().slice(0, 10);
    run('INSERT INTO club_installments (club_id, n, due_date, amount_cents) VALUES (?,?,?,?)', clubId, n, due, cfg.fee_club_month_cents);
  }
}

/** Resumo de pagamentos de um clã (parcelas + taxa anual dos membros). */
export function clubPayments(clubId, year = new Date().getFullYear()) {
  const cfg = feeConfig();
  const today = new Date().toISOString().slice(0, 10);
  const installments = all('SELECT * FROM club_installments WHERE club_id = ? ORDER BY n', clubId)
    .map((i) => ({ ...i, state: i.paid_at ? 'paga' : i.due_date < today ? 'vencida' : 'aberta' }));
  const members = all(
    `SELECT m.id, m.name, m.code, f.paid_at FROM members m LEFT JOIN member_fees f ON f.member_id = m.id AND f.year = ?
     WHERE m.club_id = ? AND m.status <> 'inativo' ORDER BY m.name`,
    year, clubId,
  );
  const open = installments.filter((i) => !i.paid_at);
  const unpaidMembers = members.filter((m) => !m.paid_at).length;
  return {
    pix_key: cfg.pix_key,
    installments,
    installments_open_cents: open.reduce((s, i) => s + i.amount_cents, 0),
    next_due: open[0] || null,
    member_fee: {
      year, amount_cents: cfg.fee_member_year_cents, members,
      paid_count: members.length - unpaidMembers, due_cents: unpaidMembers * cfg.fee_member_year_cents,
    },
  };
}

/** "30,85" ou "30.85" → 3085 centavos. */
export const toCents = (v) => {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
