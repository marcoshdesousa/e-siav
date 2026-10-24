import { Router } from 'express';
import { get } from '../db.js';
import { requireAuth, requireGeneral } from '../auth.js';
import { setSetting } from '../fees.js';
import { membersRanking, clubsRanking, unitsRanking, clubUnitsRanking, clubMembersRanking, leadersRanking, clubLeadersRanking, positionOf, rankingDistrict, rankingState, scopeState, setScope } from '../rankings.js';
import { fail, int } from '../util.js';

const r = Router();
r.use('/rankings', requireAuth());

// Rankings: Brasil (todo mundo do app, ?escopo=brasil), distrito (o do usuário; o Administrador
// Geral escolhe) e clube (rotas /rankings/club/...).
const district = (req) => (req.query.escopo === 'brasil' || req.actor.app ? null : rankingDistrict(req.actor, int(req.query.district_id)));

// Só os 50 primeiros aparecem; quem está abaixo vê apenas a própria linha, com a posição exata.
const TOP = 50;
const top = (rows, mine) => {
  const out = rows.slice(0, TOP);
  const me = mine && rows.slice(TOP).find((r) => r.id === mine);
  return me ? [...out, { ...me, extra: true }] : out;
};
const myUnit = (a) => (a.type === 'unit' ? a.id : a.unit_id);
const me = (a) => (a.type === 'member' ? a.id : null);

r.get('/rankings/members', (req, res) => res.json(top(membersRanking(district(req)), me(req.actor))));
r.get('/rankings/clubs', (req, res) => res.json(top(clubsRanking(district(req)), req.actor.club_id)));
r.get('/rankings/leaders', (req, res) => res.json(top(leadersRanking(district(req)), me(req.actor))));
r.get('/rankings/units', (req, res) => res.json(top(unitsRanking(district(req)), myUnit(req.actor))));

// Ranking interno de unidades: visível ao próprio clube (e ao Administrador Geral).
r.get('/rankings/club/:clubId/units', (req, res) => {
  const clubId = int(req.params.clubId);
  if (req.actor.type !== 'admin' && req.actor.club_id !== clubId) fail(403, 'Ranking de outro clube');
  const club = get('SELECT id, name FROM clubs WHERE id = ?', clubId);
  if (!club) fail(404, 'Clube não encontrado');
  res.json({ club, rows: top(clubUnitsRanking(clubId), myUnit(req.actor)) });
});

// Ranking de desbravadores do clube (requisitos criados pelo clube).
r.get('/rankings/club/:clubId/members', (req, res) => {
  const clubId = int(req.params.clubId);
  if (req.actor.type !== 'admin' && req.actor.club_id !== clubId) fail(403, 'Ranking de outro clube');
  res.json(top(clubMembersRanking(clubId), me(req.actor)));
});

// Melhor da liderança do clube (requisitos criados pelo clube).
r.get('/rankings/club/:clubId/leaders', (req, res) => {
  const clubId = int(req.params.clubId);
  if (req.actor.type !== 'admin' && req.actor.club_id !== clubId) fail(403, 'Ranking de outro clube');
  res.json(top(clubLeadersRanking(clubId), me(req.actor)));
});

// Temporada e pausa do ranking. Cada um cuida do seu: o clube (rankings do clube e das unidades),
// o administrador do distrito (ranking do distrito) e o geral (Brasil e qualquer distrito).
const brState = () => rankingState();
/** Rankings que esta conta vê com aviso de pausa (Brasil, o distrito e o clube dela). */
function scopesFor(a, q = {}) {
  const list = [{ key: 'brasil', label: 'Brasil', ...brState() }];
  const d = a.type === 'admin' && !a.district_id ? int(q.district_id) : null;
  if (d) list.push({ key: `district:${d}`, label: 'Distrito', ...scopeState(`district:${d}`) });
  if (a.district_id) list.push({ key: `district:${a.district_id}`, label: 'Distrito', ...scopeState(`district:${a.district_id}`) });
  if (a.club_id && a.type !== 'admin') list.push({ key: `club:${a.club_id}`, label: 'Clube', ...scopeState(`club:${a.club_id}`) });
  return list;
}
r.get('/rankings/estado', (req, res) => res.json({ ...brState(), scopes: scopesFor(req.actor, req.query) }));

/** Qual ranking esta conta pode pausar/reiniciar. */
function scopeKey(a, body) {
  if (a.type === 'club') return `club:${a.id}`;
  if (a.type === 'admin' && a.district_id) return `district:${a.district_id}`;
  if (a.type === 'admin') {
    if (body.scope === 'brasil') return 'brasil';
    const d = int(body.district_id);
    if (!get('SELECT 1 FROM districts WHERE id = ?', d)) fail(400, 'Escolha o distrito');
    return `district:${d}`;
  }
  fail(403, 'Sem permissão para mexer no ranking');
}
r.put('/ranking/controle', requireAuth('admin', 'club'), (req, res) => {
  const key = scopeKey(req.actor, req.body);
  const action = req.body.action;
  const at = req.body.at ? new Date(req.body.at) : new Date();
  if (Number.isNaN(at.getTime())) fail(400, 'Data inválida');
  if (key === 'brasil') {
    if (action === 'pause') setSetting('ranking_pausa', at.toISOString());
    else if (action === 'resume') setSetting('ranking_pausa', '');
    else if (action === 'reset') { setSetting('ranking_inicio', new Date().toISOString()); setSetting('ranking_pausa', ''); }
    else fail(400, 'Ação inválida');
    return res.json({ key, ...brState() });
  }
  if (action === 'pause') setScope(key, { pause: at.toISOString() });
  else if (action === 'resume') setScope(key, { pause: null });
  else if (action === 'reset') setScope(key, { start: new Date().toISOString(), pause: null });
  else fail(400, 'Ação inválida');
  res.json({ key, ...scopeState(key) });
});
// Endereço antigo (só o Brasil).
r.put('/admin/ranking/pausa', requireAuth('admin'), requireGeneral, (req, res) => {
  const at = req.body.at ? new Date(req.body.at) : null;
  if (at && Number.isNaN(at.getTime())) fail(400, 'Data inválida');
  setSetting('ranking_pausa', at ? at.toISOString() : '');
  res.json(brState());
});

const pick = (row) => (row ? { position: row.position, points: row.points, bible_points: row.bible_points } : null);

// Resumo: a posição do membro, da sua unidade e do seu clube de uma vez (no clube, no distrito e no Brasil).
r.get('/rankings/summary', (req, res) => {
  const a = req.actor;
  if (a.type === 'admin') return res.json({});
  // App Brasil: só o ranking Brasil (sem clube, unidade e distrito).
  if (a.app) {
    return res.json({
      app: true,
      member_brasil: a.kind === 'desbravador' ? pick(positionOf(membersRanking(null), a.id)) : null,
      leader_brasil: a.kind === 'lideranca' ? pick(positionOf(leadersRanking(null), a.id)) : null,
    });
  }
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
