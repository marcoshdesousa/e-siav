// Dados internos de um clube (membros, unidades e fichas). Usado pelo Sistema do Clube
// (pode editar) e pelo Administrador Geral (só visualiza).
import { all, get } from './db.js';
import { ageFrom, memberKind, roleOf, cargoOf } from './util.js';
import { getFicha } from './ficha.js';

export function listMembers(clubId) {
  const rows = all(
    `SELECT m.id, m.name, m.photo, m.cargo, m.code, m.link_token AS link, m.cpf, m.birth_cert, m.status, m.terms_token, m.approved_at, m.cleared_year, m.birth_date, m.unit_id, m.created_at, u.name AS unit_name
     FROM members m LEFT JOIN units u ON u.id = m.unit_id WHERE m.club_id = ? ORDER BY m.name`,
    clubId,
  );
  for (const m of rows) {
    m.age = ageFrom(m.birth_date);
    m.kind = memberKind(m.birth_date);
    m.role = roleOf(m.kind, m.cargo);
    m.cargo = cargoOf(m.kind, m.cargo);
    // Sem ficha nem inscrição (o cadastro completo fica no SGC).
    m.pending_reason = null;
    m.outdated = false;
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
