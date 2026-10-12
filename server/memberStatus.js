// Situação do cadastro do membro. Ele só fica ativo (aparece no sistema e entra no app)
// quando o termo está assinado, o clã aprovou a inscrição e a taxa (R$ 2,50) foi paga.
import crypto from 'node:crypto';
import { get, run } from './db.js';
import { setLogin } from './auth.js';

/** Por que o membro ainda está pendente: 'termo', 'aprovacao', 'pagamento' ou null. */
export function pendingReason(m) {
  if (m.status !== 'pendente') return null;
  if (m.terms_token) return 'termo';
  if (!m.approved_at) return 'aprovacao';
  if (!m.fee_cleared_at) return 'pagamento';
  return null;
}

/** Passa o membro para ativo quando não falta mais nada. */
export function refreshStatus(memberId) {
  const m = get('SELECT * FROM members WHERE id = ?', memberId);
  if (m && m.status === 'pendente' && !pendingReason(m)) run(`UPDATE members SET status = 'ativo' WHERE id = ?`, m.id);
}

/** A senha do membro é o ano de nascimento (ex.: 2006). Não dá para trocar. */
export const memberPassword = (birth) => String(birth || '').slice(0, 4);
export const checkMemberPassword = (memberId, password) => {
  const m = get('SELECT birth_date FROM members WHERE id = ?', memberId);
  return !!m?.birth_date && String(password || '').trim() === memberPassword(m.birth_date);
};

/** Login do membro: o código de 6 números. A senha guardada não é usada (vale o ano de nascimento). */
export const createMemberLogin = (memberId, code) => setLogin('member', memberId, code, crypto.randomBytes(18).toString('base64url'));

export const PENDING_MSG = {
  termo: 'Seu cadastro está esperando a assinatura do termo pelo responsável.',
  aprovacao: 'Sua inscrição ainda está esperando a aprovação do clã.',
  pagamento: 'Seu cadastro está esperando o pagamento da taxa de R$ 2,50. Fale com o seu tutor ou com a diretoria do clã.',
};
