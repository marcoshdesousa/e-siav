import { Router } from 'express';
import { get } from '../db.js';
import { requireAuth } from '../auth.js';
import { membersRanking, clubsRanking, unitsRanking, clubUnitsRanking, clubMembersRanking, leadersRanking, clubLeadersRanking, positionOf, rankingDistrict } from '../rankings.js';
import { fail, int } from '../util.js';

const r = Router();
r.use('/rankings', requireAuth());

// Rankings: Brasil (todo mundo do app, ?escopo=brasil), distrito (o do usuário; o Administrador
// Geral escolhe) e clube (rotas /rankings/club/...).
const district = (req) => (req.query.escopo === 'brasil' ? null : rankingDistrict(req.actor, int(req.query.district_id)));

r.get('/rankings/members', (req, res) => res.json(membersRanking(district(req))));
r.get('/rankings/clubs', (req, res) => res.json(clubsRanking(district(req))));
r.get('/rankings/leaders', (req, res) => res.json(leadersRanking(district(req))));
r.get('/rankings/units', (req, res) => res.json(unitsRanking(district(req))));

// Ranking interno de unidades: visível ao próprio clube (e ao Administrador Geral).
r.get('/rankings/club/:clubId/units', (req, res) => {
  const clubId = int(req.params.clubId);
  if (req.actor.type !== 'admin' && req.actor.club_id !== clubId) fail(403, 'Ranking de outro clube');
  const club = get('SELECT id, name FROM clubs WHERE id = ?', clubId);
  if (!club) fail(404, 'Clube não encontrado');
  res.json({ club, rows: clubUnitsRanking(clubId) });
});

// Ranking de desbravadores do clube (requisitos criados pelo clube).
r.get('/rankings/club/:clubId/members', (req, res) => {
  const clubId = int(req.params.clubId);
  if (req.actor.type !== 'admin' && req.actor.club_id !== clubId) fail(403, 'Ranking de outro clube');
  res.json(clubMembersRanking(clubId));
});

// Melhor da liderança do clube (requisitos criados pelo clube).
r.get('/rankings/club/:clubId/leaders', (req, res) => {
  const clubId = int(req.params.clubId);
  if (req.actor.type !== 'admin' && req.actor.club_id !== clubId) fail(403, 'Ranking de outro clube');
  res.json(clubLeadersRanking(clubId));
});

const pick = (row) => (row ? { position: row.position, points: row.points, bible_points: row.bible_points } : null);

// Resumo: a posição do membro, da sua unidade e do seu clube de uma vez (no clube, no distrito e no Brasil).
r.get('/rankings/summary', (req, res) => {
  const a = req.actor;
  if (a.type === 'admin') return res.json({});
  const clubId = a.club_id;
  const unitId = a.type === 'unit' ? a.id : a.unit_id;
  const d = a.district_id;
  const unitRow = unitId ? get('SELECT id, name, is_leadership FROM units WHERE id = ?', unitId) : null;
  res.json({
    district: d ? get('SELECT id, name FROM districts WHERE id = ?', d) : null,
    member: a.type === 'member' && a.kind === 'desbravador' ? pick(positionOf(membersRanking(d), a.id)) : null,
    member_brasil: a.type === 'member' && a.kind === 'desbravador' ? pick(positionOf(membersRanking(null), a.id)) : null,
    member_club: a.type === 'member' && a.kind === 'desbravador' ? pick(positionOf(clubMembersRanking(clubId), a.id)) : null,
    leader: a.type === 'member' && a.kind === 'lideranca' ? pick(positionOf(leadersRanking(d), a.id)) : null,
    leader_brasil: a.type === 'member' && a.kind === 'lideranca' ? pick(positionOf(leadersRanking(null), a.id)) : null,
    leader_club: a.type === 'member' && a.kind === 'lideranca' ? pick(positionOf(clubLeadersRanking(clubId), a.id)) : null,
    unit: unitRow && !unitRow.is_leadership
      ? { name: unitRow.name, id: unitRow.id, club: pick(positionOf(clubUnitsRanking(clubId), unitId)), general: pick(positionOf(unitsRanking(d), unitId)), brasil: pick(positionOf(unitsRanking(null), unitId)) }
      : null,
    club: { id: clubId, name: get('SELECT name FROM clubs WHERE id = ?', clubId).name, ...pick(positionOf(clubsRanking(d), clubId)), brasil: pick(positionOf(clubsRanking(null), clubId)) },
  });
});

export default r;
