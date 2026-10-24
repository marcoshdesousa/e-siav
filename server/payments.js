// Pagamentos do site todo, no Pix: figurinhas hoje, cursos e outras vendas depois.
// - Com a SyncPay ligada (SYNCPAY_CLIENT_ID/SECRET), o Pix é automático: o app gera a cobrança,
//   confere se caiu e libera sozinho. Sem ela, vale a chave Pix da equipe e a equipe confirma.
// - Cada tipo de compra (purpose) registra o que acontece quando o pagamento é confirmado (onPaid).
// - Nada é pedido ao membro: a cobrança da SyncPay vai com os dados padrão que a equipe cadastrou.
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { all, get, run, tx, nowIso } from './db.js';
import { fail, int } from './util.js';
import { setting } from './fees.js';
import { pixCode } from './stickers.js';
import { createPix, pixStatus, syncpayOn } from './syncpay.js';

export const pixConfig = () => ({ key: setting('pix_key') || '', name: setting('pix_name') || '', city: setting('pix_city') || '' });
/** Dados padrão do "cliente" das cobranças na SyncPay (cadastrados pela equipe). */
export const defaultPayer = () => {
  const p = { name: setting('payer_name') || '', cpf: setting('payer_cpf') || '', email: setting('payer_email') || '', phone: setting('payer_phone') || '' };
  return p.name && p.cpf ? p : null;
};
/** 'syncpay' (automático), 'manual' (chave Pix + equipe confirma) ou 'off'. */
export const payMode = () => (syncpayOn() ? 'syncpay' : pixConfig().key ? 'manual' : 'off');

const handlers = new Map();
/** Registra o que fazer quando um pagamento desse tipo é confirmado: fn(payment, ref). */
export function onPaid(purpose, fn) { handlers.set(purpose, fn); }

/** Cria um pagamento no Pix. ref: detalhes do que foi comprado (vai para o onPaid). */
export async function createPayment({ memberId = null, clubId = null, purpose, ref = {}, title, amountCents }) {
  const mode = payMode();
  if (mode === 'off') fail(400, 'O pagamento por Pix ainda não foi configurado pela equipe. Tente mais tarde.');
  if (!handlers.has(purpose)) fail(500, 'Tipo de pagamento desconhecido');
  const open = get(`SELECT COUNT(*) n FROM payments WHERE ${clubId ? 'club_id' : 'member_id'} = ? AND status IN ('aberto','aguardando')`, clubId || memberId).n;
  if (open >= 3) fail(400, 'Você já tem pagamentos esperando. Pague ou cancele um deles antes.');
  const txid = 'DBV' + crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 16);
  let pix = null;
  if (mode === 'syncpay') {
    const who = clubId ? `clube ${get('SELECT code FROM clubs WHERE id = ?', clubId)?.code || clubId}` : `membro ${get('SELECT code FROM members WHERE id = ?', memberId)?.code || memberId}`;
    pix = await createPix({ amountCents, description: `App do DBV - ${title} (${who})`, payer: defaultPayer() });
  }
  const id = Number(run(`INSERT INTO payments (member_id, club_id, purpose, ref, title, amount_cents, txid, identifier, pix_code) VALUES (?,?,?,?,?,?,?,?,?)`,
    clubId ? null : memberId, clubId, purpose, JSON.stringify(ref), title, amountCents, txid, pix?.identifier || null, pix?.pix_code || null).lastInsertRowid);
  return get('SELECT * FROM payments WHERE id = ?', id);
}

/** Pagamento confirmado: entrega o que foi comprado, uma vez só. */
export function creditPayment(p) {
  return tx(() => {
    const changed = run(`UPDATE payments SET status = 'pago', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status IN ('aberto','aguardando')`, p.id).changes;
    if (changed) handlers.get(p.purpose)?.(p, JSON.parse(p.ref || '{}'));
    return !!changed;
  });
}

/** Confere na SyncPay (no máximo a cada 4 s por pagamento) e entrega se foi pago. */
export async function checkPayment(p, { force = false } = {}) {
  if (!p?.identifier || !['aberto', 'aguardando'].includes(p.status)) return p;
  if (!force && p.checked_at && Date.now() - p.checked_at < 4000) return p;
  run('UPDATE payments SET checked_at = ? WHERE id = ?', Date.now(), p.id);
  let st;
  try { st = await pixStatus(p.identifier); } catch (e) { console.warn('[syncpay] consulta falhou:', e.message); return p; }
  if (st === 'pago') creditPayment(p);
  else if (st === 'recusado' || st === 'reembolsado') run(`UPDATE payments SET status = 'recusado' WHERE id = ? AND status IN ('aberto','aguardando')`, p.id);
  return get('SELECT * FROM payments WHERE id = ?', p.id);
}

/** Varredura a cada 2 min: pagamentos automáticos das últimas 48 h. */
export function startPaymentSweep() {
  const t = setInterval(async () => {
    if (!syncpayOn()) return;
    for (const p of all(`SELECT * FROM payments WHERE identifier IS NOT NULL AND status IN ('aberto','aguardando') AND created_at >= datetime('now', '-2 days')`)) await checkPayment(p);
  }, 120e3);
  t.unref?.();
}

/** O que o membro vê: código Pix (copia e cola), QR Code e situação. */
export async function paymentOut(p) {
  const cfg = pixConfig();
  const code = p.pix_code || (cfg.key ? pixCode({ key: cfg.key, name: cfg.name, city: cfg.city, amountCents: p.amount_cents, txid: p.txid }) : '');
  const qr = code ? await QRCode.toString(code, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) : '';
  return {
    id: p.id, purpose: p.purpose, title: p.title, ref: JSON.parse(p.ref || '{}'), amount_cents: p.amount_cents, status: p.status,
    created_at: p.created_at, paid_at: p.paid_at, auto: !!p.identifier, pix: code,
    qr: qr ? 'data:image/svg+xml;base64,' + Buffer.from(qr).toString('base64') : '', receiver: p.identifier ? '' : cfg.name,
  };
}

// ---------- Cursos ----------
// Venda de cursos: hoje a compra fica "pendente" e a equipe libera. Quando os cursos forem
// vendidos pelo Pix, é só criar o pagamento com createPayment({ purpose: 'curso', ref: { content_id } }):
// ao confirmar, o acesso é liberado sozinho por este onPaid.
export function startCheckout() {
  return {
    status: 'pendente',
    checkout_url: null,
    message: 'Pedido registrado! O pagamento online será liberado em breve. Enquanto isso, a liberação é feita pela administração.',
  };
}
export function confirmPurchase(purchaseId, providerRef = null) {
  const p = get('SELECT * FROM purchases WHERE id = ?', purchaseId);
  if (!p || p.status === 'pago') return p;
  tx(() => {
    run(`UPDATE purchases SET status = 'pago', provider_ref = COALESCE(?, provider_ref), updated_at = ? WHERE id = ?`, providerRef, nowIso(), p.id);
    run(`INSERT OR IGNORE INTO content_access (member_id, content_id, source) VALUES (?, ?, 'compra')`, p.member_id, p.content_id);
  });
  return get('SELECT * FROM purchases WHERE id = ?', purchaseId);
}
onPaid('curso', (p, ref) => {
  run(`INSERT OR IGNORE INTO content_access (member_id, content_id, source) VALUES (?, ?, 'compra')`, p.member_id, int(ref.content_id));
});
