import { all, get, run } from './db.js';
import { memberKind } from './util.js';

/**
 * Leitura bíblica (Ano Bíblico): cada dia concluído pela 1ª vez vale 100 pontos para o membro,
 * 100 para a unidade dele e 25 para o clube. Fica em bible_points (um registro por membro e dia)
 * e soma aos pontos dos requisitos em todos os rankings (distrito e clube).
 */
export const BIBLE_POINTS = { member: 100, unit: 100, club: 25 };

/** Ordena por pontos; no empate fica à frente quem chegou primeiro à pontuação. */
function rank(rows) {
  rows.forEach((r) => {
    r.requirement_points = r.points || 0;
    r.bible_points = r.bible_points || 0;
    r.points = r.requirement_points + r.bible_points;
    const last = [r.last_at, r.bible_last_at].filter(Boolean).sort().pop() || null;
    r.last_at = last;
    delete r.bible_last_at;
  });
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

/** Pontos da Leitura bíblica agrupados por membro, unidade ou clube (opcionalmente só os feitos num clube). */
const bibleJoin = (col, idCol, each, clubId = null) => `
  LEFT JOIN (
    SELECT ${col} AS target_id, COUNT(*) * ${Number(each)} AS points, MAX(created_at) AS last_at
    FROM bible_points WHERE ${col} IS NOT NULL${clubId != null ? ' AND club_id = ' + Number(clubId) : ''}
    GROUP BY ${col}
  ) bp ON bp.target_id = ${idCol}`;
const BIBLE_COLS = 'COALESCE(bp.points, 0) AS bible_points, bp.last_at AS bible_last_at';

/** Ranking de membros do distrito: só desbravadores, requisitos do App (Distrito) + Leitura bíblica. */
export function membersRanking(districtId = null) {
  const rows = all(
    `SELECT m.id, m.name, m.photo, m.code, m.birth_date, c.id AS club_id, c.name AS club_name, d.name AS district_name,
            COALESCE(sc.points, 0) AS points, sc.last_at, ${BIBLE_COLS}
     FROM members m JOIN clubs c ON c.id = m.club_id JOIN districts d ON d.id = c.district_id
     ${scoreJoin('member', 'm.id', "r.creator_type = 'admin' AND r.audience = 'member'")}
     ${bibleJoin('member_id', 'm.id', BIBLE_POINTS.member)}
     WHERE m.status = 'ativo' AND (? IS NULL OR c.district_id = ?)`,
    districtId, districtId,
  ).filter((r) => memberKind(r.birth_date) === 'desbravador');
  rows.forEach((r) => delete r.birth_date);
  return rank(rows);
}

/**
 * Ranking de membros do clube: desbravadores do clube, requisitos criados pelo próprio clube e pelas
 * unidades dele + Leitura bíblica feita enquanto estava no clube.
 */
export function clubMembersRanking(clubId) {
  const rows = all(
    `SELECT m.id, m.name, m.photo, m.code, m.birth_date, c.id AS club_id, u.name AS unit_name,
            COALESCE(sc.points, 0) AS points, sc.last_at, ${BIBLE_COLS}
     FROM members m JOIN clubs c ON c.id = m.club_id LEFT JOIN units u ON u.id = m.unit_id
     ${scoreJoin('member', 'm.id', "r.creator_type IN ('club','unit') AND r.club_id = " + Number(clubId))}
     ${bibleJoin('member_id', 'm.id', BIBLE_POINTS.member, clubId)}
     WHERE m.club_id = ? AND m.status = 'ativo'`,
    clubId,
  ).filter((r) => memberKind(r.birth_date) === 'desbravador');
  rows.forEach((r) => { delete r.birth_date; r.club_name = r.unit_name ? 'Unidade ' + r.unit_name : 'Sem unidade'; });
  return rank(rows);
}

/**
 * Ranking da liderança (16+), separado do dos desbravadores.
 * No distrito: requisitos de membro criados pelo App + Leitura bíblica.
 */
export function leadersRanking(districtId = null) {
  const rows = all(
    `SELECT m.id, m.name, m.photo, m.code, m.cargo, m.birth_date, c.id AS club_id, c.name AS club_name, d.name AS district_name,
            COALESCE(sc.points, 0) AS points, sc.last_at, ${BIBLE_COLS}
     FROM members m JOIN clubs c ON c.id = m.club_id JOIN districts d ON d.id = c.district_id
     ${scoreJoin('member', 'm.id', "r.creator_type = 'admin' AND r.audience = 'member'")}
     ${bibleJoin('member_id', 'm.id', BIBLE_POINTS.member)}
     WHERE m.status = 'ativo' AND (? IS NULL OR c.district_id = ?)`,
    districtId, districtId,
  ).filter((r) => memberKind(r.birth_date) === 'lideranca');
  rows.forEach((r) => delete r.birth_date);
  return rank(rows);
}

/** Melhor da liderança do clube: requisitos de membro criados pelo próprio clube + Leitura bíblica no clube. */
export function clubLeadersRanking(clubId) {
  const rows = all(
    `SELECT m.id, m.name, m.photo, m.code, m.cargo, m.birth_date, c.id AS club_id,
            COALESCE(sc.points, 0) AS points, sc.last_at, ${BIBLE_COLS}
     FROM members m JOIN clubs c ON c.id = m.club_id
     ${scoreJoin('member', 'm.id', "r.creator_type = 'club' AND r.club_id = " + Number(clubId))}
     ${bibleJoin('member_id', 'm.id', BIBLE_POINTS.member, clubId)}
     WHERE m.club_id = ? AND m.status = 'ativo'`,
    clubId,
  ).filter((r) => memberKind(r.birth_date) === 'lideranca');
  rows.forEach((r) => { delete r.birth_date; r.club_name = r.cargo; });
  return rank(rows);
}

/** Ranking de clubes do distrito: requisitos gerais de clube + 25 por dia de Leitura bíblica dos membros. */
export function clubsRanking(districtId = null) {
  return rank(all(
    `SELECT c.id, c.name, c.logo, c.district_id, d.name AS district_name,
            COALESCE(sc.points, 0) AS points, sc.last_at, ${BIBLE_COLS}
     FROM clubs c JOIN districts d ON d.id = c.district_id
     ${scoreJoin('club', 'c.id', "r.creator_type = 'admin' AND r.audience = 'club'")}
     ${bibleJoin('club_id', 'c.id', BIBLE_POINTS.club)}
     WHERE (? IS NULL OR c.district_id = ?)`,
    districtId, districtId,
  ));
}

/** Ranking de unidades do distrito: requisitos gerais de unidade + 100 por dia de Leitura bíblica dos membros. */
export function unitsRanking(districtId = null) {
  return rank(all(
    `SELECT u.id, u.name, u.logo, c.id AS club_id, c.name AS club_name, d.name AS district_name,
            COALESCE(sc.points, 0) AS points, sc.last_at, ${BIBLE_COLS}
     FROM units u JOIN clubs c ON c.id = u.club_id JOIN districts d ON d.id = c.district_id
     ${scoreJoin('unit', 'u.id', "r.creator_type = 'admin' AND r.audience = 'unit'")}
     ${bibleJoin('unit_id', 'u.id', BIBLE_POINTS.unit)}
     WHERE u.is_leadership = 0 AND (? IS NULL OR c.district_id = ?)`,
    districtId, districtId,
  ));
}

/** Ranking de unidades do clube: requisitos criados pelo próprio clube + Leitura bíblica dos membros. */
export function clubUnitsRanking(clubId) {
  return rank(all(
    `SELECT u.id, u.name, u.logo, u.club_id,
            COALESCE(sc.points, 0) AS points, sc.last_at, ${BIBLE_COLS}
     FROM units u
     ${scoreJoin('unit', 'u.id', "r.creator_type = 'club' AND r.club_id = " + Number(clubId))}
     ${bibleJoin('unit_id', 'u.id', BIBLE_POINTS.unit, clubId)}
     WHERE u.club_id = ? AND u.is_leadership = 0`,
    clubId,
  ));
}

/** Pontos de um dia de Leitura bíblica concluído pela 1ª vez. Devolve os pontos ganhos (ou null se já tinha). */
export function awardBibleDay(memberId, day) {
  const m = get('SELECT m.unit_id, m.club_id, u.is_leadership FROM members m LEFT JOIN units u ON u.id = m.unit_id WHERE m.id = ?', memberId);
  if (!m) return null;
  const res = run('INSERT OR IGNORE INTO bible_points (member_id, day, unit_id, club_id) VALUES (?, ?, ?, ?)', memberId, day, m.unit_id, m.club_id);
  if (!res.changes) return null;
  // A unidade Liderança não disputa o ranking de unidades.
  return { member: BIBLE_POINTS.member, unit: m.unit_id && !m.is_leadership ? BIBLE_POINTS.unit : 0, club: BIBLE_POINTS.club };
}

/**
 * Meditação e Escola Sabatina valem como a leitura bíblica (membro 100, unidade 100, clube 25), um
 * registro por dia concluído. A chave do dia fica numa faixa própria de cada estudo (não se misturam).
 */
const STUDY_BASE = { meditacao: 100_000_000, sabatina: 200_000_000 };
export function awardStudyDay(memberId, kind, date) {
  return awardBibleDay(memberId, STUDY_BASE[kind] + Number(String(date).replaceAll('-', '')));
}

/** Distrito do ranking: o do próprio usuário; o Administrador Geral escolhe (padrão: o primeiro). */
export function rankingDistrict(actor, requested) {
  if (actor.type !== 'admin') return actor.district_id;
  return (requested && get('SELECT id FROM districts WHERE id = ?', requested)?.id) || get('SELECT id FROM districts ORDER BY id LIMIT 1')?.id || 0;
}

export const positionOf = (rows, id) => rows.find((r) => r.id === id) || null;
