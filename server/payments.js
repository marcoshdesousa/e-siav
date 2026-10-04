// Ponto de integração com o meio de pagamento (a definir).
// Hoje a compra fica "pendente" até o Administrador Geral confirmar o pagamento
// ou liberar o acesso manualmente. Para plugar um provedor (Pix, cartão, etc.),
// implemente startCheckout() devolvendo a URL de pagamento e chame
// confirmPurchase() no webhook de confirmação do provedor.
import { get, run, tx, nowIso } from './db.js';

export const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || null;

export function startCheckout(purchase) {
  if (!PAYMENT_PROVIDER) {
    return {
      status: 'pendente',
      checkout_url: null,
      message: 'Pedido registrado! O pagamento online será liberado em breve. Enquanto isso, a liberação é feita pela administração.',
    };
  }
  throw new Error(`Provedor de pagamento "${PAYMENT_PROVIDER}" ainda não implementado (compra ${purchase.id})`);
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
