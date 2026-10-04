import { all } from './db.js';
import { memberKind } from './util.js';

/** Ordena por pontos; no empate fica à frente quem chegou primeiro à pontuação. */
function rank(rows) {
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.last_at && b.last_at && a.last_at !== b.last_at) return a.last_at < b.last_at ? -1 : 1;
    if (!!a.last_at !== !!b.last_at) return a.last_at ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  rows.forEach((r, i) => (r.position = i + 1));
  return rows;
}

const scoreJoin = (type, idCol, reqFilter) => `
  LEFT JOIN (
    SELECT s.submitter_id, SUM(s.points) AS points, MAX(s.submitted_at) AS last_at
    FROM submissions s JOIN requirements r ON r.id = s.requirement_id
    WHERE s.submitter_type = '${type}' AND s.status = 'aprovado' AND s.points > 0 AND ${reqFilter}
    GROUP BY s.submitter_id
  ) sc ON sc.submitter_id = ${idCol}`;

/** Ranking de membros: só desbravadores, requisitos gerais de membro. */
export function membersRanking(districtId = null) {
  const rows = all(
    `SELECT m.id, m.name, m.photo, m.code, m.birth_date, c.id AS club_id, c.name AS club_name,
            COALESCE(sc.points, 0) AS points, sc.last_at
     FROM members m JOIN clubs c ON c.id = m.club_id
     ${scoreJoin('member', 'm.id', "r.creator_type = 'admin' AND r.audience = 'member'")}
     WHERE (? IS NULL OR c.district_id = ?)`,
    districtId, districtId,
  ).filter((r) => memberKind(r.birth_date) === 'desbravador');
  rows.forEach((r) => delete r.birth_date);
  return rank(rows);
}

/** Ranking de clubes: requisitos gerais de clube. */
export function clubsRanking(districtId = null) {
  return rank(all(
    `SELECT c.id, c.name, c.logo, c.district_id, d.name AS district_name,
            COALESCE(sc.points, 0) AS points, sc.last_at
     FROM clubs c JOIN districts d ON d.id = c.district_id
     ${scoreJoin('club', 'c.id', "r.creator_type = 'admin' AND r.audience = 'club'")}
     WHERE (? IS NULL OR c.district_id = ?)`,
    districtId, districtId,
  ));
}

/** Ranking geral de unidades: requisitos gerais de unidade (todas as unidades de todos os clubes). */
export function unitsRanking(districtId = null) {
  return rank(all(
    `SELECT u.id, u.name, u.logo, c.id AS club_id, c.name AS club_name,
            COALESCE(sc.points, 0) AS points, sc.last_at
     FROM units u JOIN clubs c ON c.id = u.club_id
     ${scoreJoin('unit', 'u.id', "r.creator_type = 'admin' AND r.audience = 'unit'")}
     WHERE u.is_leadership = 0 AND (? IS NULL OR c.district_id = ?)`,
    districtId, districtId,
  ));
}

/** Ranking de unidades do clube: requisitos criados pelo próprio clube. */
export function clubUnitsRanking(clubId) {
  return rank(all(
    `SELECT u.id, u.name, u.logo, u.club_id,
            COALESCE(sc.points, 0) AS points, sc.last_at
     FROM units u
     ${scoreJoin('unit', 'u.id', "r.creator_type = 'club' AND r.club_id = " + Number(clubId))}
     WHERE u.club_id = ? AND u.is_leadership = 0`,
    clubId,
  ));
}

export const positionOf = (rows, id) => rows.find((r) => r.id === id) || null;
