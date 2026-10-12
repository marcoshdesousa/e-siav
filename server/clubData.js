// Dados internos de um clã (membros, grupos e fichas). Usado pelo Sistema do Clã
// (pode editar) e pelo Administrador Geral (só visualiza).
import { all, get } from './db.js';
import { ageFrom, memberKind, roleOf } from './util.js';
import { fichaCompleta, getFicha } from './ficha.js';
import { pendingReason } from './memberStatus.js';

export function listMembers(clubId) {
  const rows = all(
    `SELECT m.id, m.name, m.photo, m.cargo, m.code, m.cpf, m.birth_cert, m.status, m.terms_token, m.approved_at, m.cleared_year, m.birth_date, m.unit_id, m.created_at, u.name AS unit_name
     FROM members m LEFT JOIN units u ON u.id = m.unit_id WHERE m.club_id = ? ORDER BY m.name`,
    clubId,
  );
  for (const m of rows) {
    m.age = ageFrom(m.birth_date);
    m.kind = memberKind(m.birth_date);
    m.role = roleOf(m.kind, m.cargo);
    // Sem a ficha completa (cadastro + saúde) o membro aparece com "dados incompletos".
    m.incomplete = !fichaCompleta(getFicha(m.id), m.birth_date) || !(m.cpf || m.birth_cert);
    // Pendente: esperando a assinatura do termo, a aprovação da inscrição ou com dados faltando.
    m.pending_reason = m.status === 'inativo' ? null : m.status === 'pendente' ? pendingReason(m) || 'aprovacao' : m.incomplete ? 'dados' : null;
  }
  return rows;
}

export const listUnits = (clubId) => all(
  `SELECT u.*, (SELECT COUNT(*) FROM members m WHERE m.unit_id = u.id AND m.status = 'ativo') AS member_count
   FROM units u WHERE u.club_id = ? ORDER BY u.is_leadership, u.number, u.name`,
  clubId,
);

export function memberFicha(clubId, memberId) {
  const m = get('SELECT * FROM members WHERE id = ? AND club_id = ?', memberId, clubId);
  if (!m) return null;
  return { member: { id: m.id, name: m.name, cpf: m.cpf, birth_cert: m.birth_cert, birth_date: m.birth_date, code: m.code, age: ageFrom(m.birth_date) }, ficha: getFicha(m.id) };
}
