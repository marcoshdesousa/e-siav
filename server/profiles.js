import { all, get } from './db.js';
import { ageFrom, memberKind } from './util.js';
import { clubsRanking, unitsRanking, clubUnitsRanking, membersRanking, positionOf } from './rankings.js';

export function medalsOf(type, id) {
  return all(
    `SELECT a.id, m.id AS medal_id, m.kind, m.name, m.icon, m.description, a.note, a.awarded_at
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

const pos = (r) => (r ? { position: r.position, points: r.points } : null);

/** Perfil público do clube: só a QUANTIDADE de membros, nunca os nomes. */
export function clubProfile(id) {
  const c = get(
    `SELECT c.id, c.name, c.photo, c.logo, c.district_id, d.name AS district_name
     FROM clubs c JOIN districts d ON d.id = c.district_id WHERE c.id = ?`,
    id,
  );
  if (!c) return null;
  c.member_count = get('SELECT COUNT(*) AS n FROM members WHERE club_id = ?', id).n;
  c.units = all(
    `SELECT u.id, u.name, u.logo, u.is_leadership, (SELECT COUNT(*) FROM members m WHERE m.unit_id = u.id) AS member_count
     FROM units u WHERE u.club_id = ? ORDER BY u.is_leadership, u.name`,
    id,
  );
  c.unit_count = c.units.length;
  c.ranking = pos(positionOf(clubsRanking(), c.id));
  c.ranking_district = pos(positionOf(clubsRanking(c.district_id), c.id));
  c.events = eventsOf('club', id);
  c.medals = medalsOf('club', id);
  return c;
}

export function unitProfile(id) {
  const u = get(
    `SELECT u.id, u.name, u.logo, u.is_leadership, u.club_id, c.name AS club_name, c.logo AS club_logo, c.district_id
     FROM units u JOIN clubs c ON c.id = u.club_id WHERE u.id = ?`,
    id,
  );
  if (!u) return null;
  u.member_count = get('SELECT COUNT(*) AS n FROM members WHERE unit_id = ?', id).n;
  if (!u.is_leadership) {
    u.ranking_club = pos(positionOf(clubUnitsRanking(u.club_id), u.id));
    u.ranking_general = pos(positionOf(unitsRanking(), u.id));
  }
  u.medals = medalsOf('unit', id);
  return u;
}

export function memberProfile(where, value) {
  const m = get(
    `SELECT m.id, m.name, m.photo, m.code, m.handle, m.cargo, m.birth_date, m.excellence,
            m.club_id, c.name AS club_name, c.logo AS club_logo, m.unit_id, u.name AS unit_name
     FROM members m JOIN clubs c ON c.id = m.club_id LEFT JOIN units u ON u.id = m.unit_id
     WHERE ${where === 'code' ? 'm.code = ?' : where === 'handle' ? 'm.handle = ? COLLATE NOCASE' : 'm.id = ?'}`,
    value,
  );
  if (!m) return null;
  m.age = ageFrom(m.birth_date);
  m.kind = memberKind(m.birth_date);
  delete m.birth_date; // data de nascimento não é exibida no perfil
  const ach = all(
    `SELECT ct.id, ct.type, ct.name, ct.icon, ct.leader, a.source, a.date
     FROM achievements a JOIN content ct ON ct.id = a.content_id WHERE a.member_id = ? ORDER BY ct.age, ct.name`,
    m.id,
  );
  m.classes = ach.filter((a) => a.type === 'classe');
  m.specialties = ach.filter((a) => a.type === 'especialidade');
  m.courses = ach.filter((a) => a.type === 'curso');
  m.ranking = m.kind === 'desbravador' ? pos(positionOf(membersRanking(), m.id)) : null;
  m.events = eventsOf('member', m.id);
  m.medals = medalsOf('member', m.id);
  return m;
}
