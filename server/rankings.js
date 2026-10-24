import { all, get, run } from './db.js';
import { memberKind } from './util.js';
import { setting } from './fees.js';

/**
 * Leitura bíblica (Ano Bíblico): cada dia concluído pela 1ª vez vale 100 pontos para o membro,
 * 100 para a unidade dele e 25 para o clube. Fica em bible_points (um registro por membro e dia)
 * e soma aos pontos dos requisitos em todos os rankings (distrito e clube).
 */
export const BIBLE_POINTS = { member: 100, unit: 100, club: 25 };
/** Estudo feito depois do dia certo (atrasado) vale bem menos. */
export const LATE_POINTS = { member: 20, unit: 20, club: 5 };

/**
 * Temporada do ranking: só contam os pontos ganhos a partir do início (zera todo 1º de janeiro).
 * O administrador geral pode pausar o ranking num dia e hora: a partir dali o ranking fica parado
 * (só contam os pontos ganhos até a pausa) para ele conferir quem ganhou; ao retomar, tudo volta a contar.
 */
const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;
const okIso = (v) => (ISO.test(v || '') ? v : null);
export const seasonStart = () => okIso(setting('ranking_inicio'));
export const pausedAt = () => okIso(setting('ranking_pausa'));
export const isPaused = () => { const p = pausedAt(); return !!p && p <= new Date().toISOString(); };
/** Filtro de datas da temporada (e da pausa, se já começou) para uma coluna de data. */
function seasonFilter(col) {
  const parts = [];
  const s = seasonStart();
  if (s) parts.push(`${col} >= '${s}'`);
  if (isPaused()) parts.push(`${col} <= '${pausedAt()}'`);
  return parts.length ? ' AND ' + parts.join(' AND ') : '';
}
export const rankingState = () => ({ start: seasonStart(), paused_at: pausedAt(), paused: isPaused() });

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
    WHERE s.submitter_type = '${type}' AND s.status = 'aprovado' AND s.points > 0 AND ${reqFilter}${seasonFilter('s.submitted_at')}
    GROUP BY s.submitter_id
  ) sc ON sc.submitter_id = ${idCol}`;

/** Pontos da Leitura bíblica agrupados por membro, unidade ou clube (opcionalmente só os feitos num clube). */
const LATE_OF = new Map(Object.keys(BIBLE_POINTS).map((k) => [BIBLE_POINTS[k], LATE_POINTS[k]]));
const bibleJoin = (col, idCol, each, clubId = null) => `
  LEFT JOIN (
    SELECT ${col} AS target_id, SUM(CASE WHEN late = 1 THEN ${Number(LATE_OF.get(each) ?? each)} ELSE ${Number(each)} END) AS points, MAX(created_at) AS last_at
    FROM bible_points WHERE ${col} IS NOT NULL${clubId != null ? ' AND club_id = ' + Number(clubId) : ''}${seasonFilter('created_at')}
    GROUP BY ${col}
  ) bp ON bp.target_id = ${idCol}`;
const BIBLE_COLS = 'COALESCE(bp.points, 0) AS bible_points, bp.last_at AS bible_last_at';

/** Ranking de membros do distrito: só desbravadores, requisitos do App (Distrito) + Leitura bíblica. */
export function membersRanking(districtId = null) {
  const rows = all(
    `SELECT m.id, m.name, m.photo, m.link_token AS link, m.birth_date, c.id AS club_id, c.name AS club_name, d.name AS district_name,
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
    `SELECT m.id, m.name, m.photo, m.link_token AS link, m.birth_date, c.id AS club_id, u.name AS unit_name,
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
    `SELECT m.id, m.name, m.photo, m.link_token AS link, m.cargo, m.birth_date, c.id AS club_id, c.name AS club_name, d.name AS district_name,
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
    `SELECT m.id, m.name, m.photo, m.link_token AS link, m.cargo, m.birth_date, c.id AS club_id,
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
     WHERE c.is_app = 0 AND (? IS NULL OR c.district_id = ?)`,
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
     WHERE u.is_leadership = 0 AND c.is_app = 0 AND (? IS NULL OR c.district_id = ?)`,
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
export function awardBibleDay(memberId, day, late = false) {
  const m = get('SELECT m.unit_id, m.club_id, u.is_leadership FROM members m LEFT JOIN units u ON u.id = m.unit_id WHERE m.id = ?', memberId);
  if (!m) return null;
  const res = run('INSERT OR IGNORE INTO bible_points (member_id, day, unit_id, club_id, late) VALUES (?, ?, ?, ?, ?)', memberId, day, m.unit_id, m.club_id, late ? 1 : 0);
  if (!res.changes) return null;
  // A unidade Liderança não disputa o ranking de unidades. Atrasado vale menos.
  const P = late ? LATE_POINTS : BIBLE_POINTS;
  return { member: P.member, unit: m.unit_id && !m.is_leadership ? P.unit : 0, club: P.club, late: !!late };
}

/**
 * Meditação e Escola Sabatina valem como a leitura bíblica (membro 100, unidade 100, clube 25), um
 * registro por dia concluído. A chave do dia fica numa faixa própria de cada estudo (não se misturam).
 */
const STUDY_BASE = { meditacao: 100_000_000, sabatina: 200_000_000 };
export function awardStudyDay(memberId, kind, date, late = false) {
  return awardBibleDay(memberId, STUDY_BASE[kind] + Number(String(date).replaceAll('-', '')), late);
}

/** Distrito do ranking: o do próprio usuário; o Administrador Geral escolhe (padrão: o primeiro). */
export function rankingDistrict(actor, requested) {
  if (actor.type !== 'admin') return actor.district_id;
  return (requested && get('SELECT id FROM districts WHERE id = ? AND is_app = 0', requested)?.id) || get('SELECT id FROM districts WHERE is_app = 0 ORDER BY id LIMIT 1')?.id || 0;
}

export const positionOf = (rows, id) => rows.find((r) => r.id === id) || null;
