import { Router } from 'express';
import { get } from '../db.js';
import { requireAuth } from '../auth.js';
import { membersRanking, clubsRanking, unitsRanking, clubUnitsRanking, positionOf } from '../rankings.js';
import { fail, int } from '../util.js';

const r = Router();
r.use('/rankings', requireAuth());

const district = (req) => int(req.query.district_id);

r.get('/rankings/members', (req, res) => res.json(membersRanking(district(req))));
r.get('/rankings/clubs', (req, res) => res.json(clubsRanking(district(req))));
r.get('/rankings/units', (req, res) => res.json(unitsRanking(district(req))));

// Ranking interno de unidades: visível ao próprio clube (e ao Administrador Geral).
r.get('/rankings/club/:clubId/units', (req, res) => {
  const clubId = int(req.params.clubId);
  if (req.actor.type !== 'admin' && req.actor.club_id !== clubId) fail(403, 'Ranking de outro clube');
  const club = get('SELECT id, name FROM clubs WHERE id = ?', clubId);
  if (!club) fail(404, 'Clube não encontrado');
  res.json({ club, rows: clubUnitsRanking(clubId) });
});

const pick = (row) => (row ? { position: row.position, points: row.points } : null);

// Resumo: a posição do membro, da sua unidade e do seu clube de uma vez.
r.get('/rankings/summary', (req, res) => {
  const a = req.actor;
  if (a.type === 'admin') return res.json({});
  const clubId = a.club_id;
  const unitId = a.type === 'unit' ? a.id : a.unit_id;
  const unitRow = unitId ? get('SELECT id, name, is_leadership FROM units WHERE id = ?', unitId) : null;
  res.json({
    member: a.type === 'member' && a.kind === 'desbravador' ? pick(positionOf(membersRanking(), a.id)) : null,
    unit: unitRow && !unitRow.is_leadership
      ? { name: unitRow.name, id: unitRow.id, club: pick(positionOf(clubUnitsRanking(clubId), unitId)), general: pick(positionOf(unitsRanking(), unitId)) }
      : null,
    club: { id: clubId, name: get('SELECT name FROM clubs WHERE id = ?', clubId).name, ...pick(positionOf(clubsRanking(), clubId)) },
  });
});

export default r;
