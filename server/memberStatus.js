// Situação do cadastro do membro. Ele fica ativo (aparece no sistema e usa o app) quando
// o termo está assinado, o clã aprovou e a inscrição do ano foi paga pelo clã.
// O membro nunca vê nada de pagamento: só "Esperando a aprovação do clã" ou, na virada
// do ano, "Esperando o seu clã atualizar o sistema".
import crypto from 'node:crypto';
import { get, run } from './db.js';
import { setLogin } from './auth.js';

export const currentYear = () => new Date().getFullYear();

/**
 * Por que o membro está pendente:
 * - 'termo': esperando a assinatura do termo pelo link
 * - 'aprovacao': inscrição pelo link esperando o clã aprovar (grupo e cargo)
 * - 'inscricao': aprovado, falta o clã pagar a inscrição do ano
 * - 'renovacao': já era do clã, falta o clã renovar a inscrição do ano novo
 */
export function pendingReason(m) {
  if (m.status !== 'pendente') return null;
  if (m.terms_token) return 'termo';
  if (!m.approved_at) return 'aprovacao';
  if (!(m.cleared_year >= currentYear())) return m.cleared_year ? 'renovacao' : 'inscricao';
  return null;
}

/** O que o membro vê em todas as abas enquanto espera. */
export const waitingMessage = (reason) => (reason === 'renovacao' ? 'Esperando o seu clã atualizar o sistema' : 'Esperando a aprovação do clã');

/** Passa o membro para ativo quando não falta mais nada. */
export function refreshStatus(memberId) {
  const m = get('SELECT * FROM members WHERE id = ?', memberId);
  if (m && m.status === 'pendente' && !pendingReason(m)) run(`UPDATE members SET status = 'ativo' WHERE id = ?`, m.id);
}

/** Inscrição do ano paga: libera o membro (se não faltar mais nada). */
export function clearYear(memberId, year) {
  run('UPDATE members SET cleared_year = ? WHERE id = ? AND (cleared_year IS NULL OR cleared_year < ?)', year, memberId, year);
  refreshStatus(memberId);
}

/** Virada do ano: quem não teve a inscrição renovada volta a esperar o clã atualizar. */
export function expireYear() {
  run(`UPDATE members SET status = 'pendente' WHERE status = 'ativo' AND (cleared_year IS NULL OR cleared_year < ?)`, currentYear());
}

/** A senha do membro é o ano de nascimento (ex.: 2006). Não dá para trocar. */
export const memberPassword = (birth) => String(birth || '').slice(0, 4);
export const checkMemberPassword = (memberId, password) => {
  const m = get('SELECT birth_date FROM members WHERE id = ?', memberId);
  return !!m?.birth_date && String(password || '').trim() === memberPassword(m.birth_date);
};

/** Login do membro: o código de 6 números. A senha guardada não é usada (vale o ano de nascimento). */
export const createMemberLogin = (memberId, code) => setLogin('member', memberId, code, crypto.randomBytes(18).toString('base64url'));
