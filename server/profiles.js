import { all, get } from './db.js';
import { ageFrom, memberKind, roleOf, cargoOf } from './util.js';
import { isPlus } from './plus.js';
import { clubsRanking, unitsRanking, clubUnitsRanking, membersRanking, leadersRanking, clubMembersRanking, clubLeadersRanking, positionOf } from './rankings.js';

export function medalsOf(type, id) {
  return all(
    `SELECT a.id, m.id AS medal_id, m.kind, m.name, m.icon, m.description, a.note, a.year, a.awarded_at
     FROM medal_awards a JOIN medals m ON m.id = a.medal_id
     WHERE a.target_type = ? AND a.target_id = ? ORDER BY a.awarded_at DESC`,
    type, id,
  );
}

export function eventsOf(type, id) {
  return all(
    `SELECT e.id, e.name, e.description, e.date, e.location, e.attachments
     FROM events e JOIN event_participants p ON p.event_id = e.id
     WHERE p.target_type = ? AND p.target_id = ? ORDER BY e.date DESC`,
    type, id,
  ).map((e) => ({ ...e, attachments: JSON.parse(e.attachments || '[]') }));
}

const pos = (r) => (r ? { position: r.position, points: r.points, bible_points: r.bible_points } : null);

/** Perfil público do clube: só a QUANTIDADE de membros, nunca os nomes. */
export function clubProfile(id, { withApp = false } = {}) {
  const c = get(
    `SELECT c.id, c.name, c.number, c.logo, c.code, c.director_name, c.associate_directors, c.history, c.district_id, d.name AS district_name
     FROM clubs c JOIN districts d ON d.id = c.district_id WHERE c.id = ? AND (c.is_app = 0 OR ?)`,
    id, withApp ? 1 : 0,
  );
  if (!c) return null;
  c.member_count = get(`SELECT COUNT(*) AS n FROM members WHERE club_id = ? AND status = 'ativo'`, id).n;
  c.units = all(
    `SELECT u.id, u.name, u.logo, u.is_leadership, u.number, (SELECT COUNT(*) FROM members m WHERE m.unit_id = u.id AND m.status = 'ativo') AS member_count
     FROM units u WHERE u.club_id = ? ORDER BY u.is_leadership, u.number, u.name`,
    id,
  );
  c.unit_count = c.units.length;
  // Sem ranking geral de todos os distritos: a posição é no distrito do clube.
  c.ranking = pos(positionOf(clubsRanking(c.district_id), c.id));
  c.ranking_district = c.ranking;
  c.events = eventsOf('club', id);
  c.medals = medalsOf('club', id);
  return c;
}

export function unitProfile(id) {
  const u = get(
    `SELECT u.id, u.name, u.logo, u.bio, u.is_leadership, u.number, u.club_id, c.code AS club_code, c.name AS club_name, c.logo AS club_logo, c.district_id
     FROM units u JOIN clubs c ON c.id = u.club_id WHERE u.id = ? AND c.is_app = 0`,
    id,
  );
  if (!u) return null;
  u.member_count = get(`SELECT COUNT(*) AS n FROM members WHERE unit_id = ? AND status = 'ativo'`, id).n;
  if (!u.is_leadership) {
    u.ranking_club = pos(positionOf(clubUnitsRanking(u.club_id), u.id));
    u.ranking_general = pos(positionOf(unitsRanking(u.district_id), u.id)); // no distrito
  }
  u.medals = medalsOf('unit', id);
  return u;
}

export function memberProfile(where, value) {
  const m = get(
    `SELECT m.id, m.name, m.photo, m.code, m.handle, m.link_token AS link, m.cargo, m.birth_date, c.district_id,
            m.club_id, c.code AS club_code, c.name AS club_name, c.logo AS club_logo, c.is_app AS club_is_app, m.unit_id, u.name AS unit_name, u.number AS unit_number, u.is_leadership AS unit_is_leadership
     FROM members m JOIN clubs c ON c.id = m.club_id LEFT JOIN units u ON u.id = m.unit_id
     WHERE m.status = 'ativo' AND ${where === 'code' ? 'm.code = ?' : where === 'link' ? 'm.link_token = ?' : 'm.id = ?'}`,
    value,
  );
  if (!m) return null;
  m.age = ageFrom(m.birth_date);
  m.kind = memberKind(m.birth_date);
  m.role = roleOf(m.kind, m.cargo);
  m.cargo = cargoOf(m.kind, m.cargo);
  delete m.birth_date; // data de nascimento não é exibida no perfil
  const ach = all(
    `SELECT ct.id, ct.type, ct.name, ct.icon, ct.image, ct.category, ct.leader, a.source, a.date
     FROM achievements a JOIN content ct ON ct.id = a.content_id WHERE a.member_id = ? ORDER BY ct.leader, ct.id`,
    m.id,
  );
  m.classes = ach.filter((a) => a.type === 'classe');
  m.specialties = ach.filter((a) => a.type === 'especialidade');
  m.courses = ach.filter((a) => a.type === 'curso');
  m.club_is_app = !!m.club_is_app;
  // Desbravadores e liderança têm rankings separados.
  if (m.club_is_app) {
    // App Brasil: sem clube, unidade e distrito de verdade; só o ranking Brasil.
    const brasil = m.kind === 'desbravador' ? membersRanking(null) : leadersRanking(null);
    m.ranking = null;
    const r = pos(positionOf(brasil, m.id));
    m.ranks = { member_brasil: r ? { ...r, total: brasil.length } : null };
    m.verified = isPlus(m.id);
    m.events = eventsOf('member', m.id);
    m.medals = medalsOf('member', m.id);
    return m;
  }
  const districtRows = m.kind === 'desbravador' ? membersRanking(m.district_id) : leadersRanking(m.district_id);
  m.ranking = pos(positionOf(districtRows, m.id)); // no distrito
  // Os 5 rankings do perfil: o membro no clube e no distrito, a unidade no clube e no distrito e o clube no distrito.
  const withTotal = (rows, id) => { const r = pos(positionOf(rows, id)); return r ? { ...r, total: rows.length } : null; };
  const clubRows = m.kind === 'desbravador' ? clubMembersRanking(m.club_id) : clubLeadersRanking(m.club_id);
  const unitRanks = m.unit_id && !m.unit_is_leadership;
  m.ranks = {
    member_club: withTotal(clubRows, m.id),
    member_district: withTotal(districtRows, m.id),
    unit_club: unitRanks ? withTotal(clubUnitsRanking(m.club_id), m.unit_id) : null,
    unit_district: unitRanks ? withTotal(unitsRanking(m.district_id), m.unit_id) : null,
    club_district: withTotal(clubsRanking(m.district_id), m.club_id),
  };
  m.verified = isPlus(m.id); // selo de verificado do DBV+
  m.events = eventsOf('member', m.id);
  m.medals = medalsOf('member', m.id);
  return m;
}
