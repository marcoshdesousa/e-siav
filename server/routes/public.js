import { Router } from 'express';
import { all } from '../db.js';
import { clubProfile, unitProfile, memberProfile } from '../profiles.js';
import { clubsRanking } from '../rankings.js';
import { fail, int } from '../util.js';

const r = Router();

r.get('/public/districts', (_req, res) => {
  res.json(all(`SELECT d.id, d.name, (SELECT COUNT(*) FROM clubs c WHERE c.district_id = d.id) AS club_count FROM districts d ORDER BY d.name`));
});

r.get('/public/districts/:id/clubs', (req, res) => {
  const id = int(req.params.id);
  const ranking = clubsRanking(id);
  const rows = all(
    `SELECT c.id, c.name, c.logo, c.photo,
            (SELECT COUNT(*) FROM members m WHERE m.club_id = c.id) AS member_count,
            (SELECT COUNT(*) FROM units u WHERE u.club_id = c.id) AS unit_count
     FROM clubs c WHERE c.district_id = ? ORDER BY c.name`,
    id,
  );
  rows.forEach((c) => (c.position = ranking.find((x) => x.id === c.id)?.position ?? null));
  res.json(rows);
});

r.get('/public/clubs/:id', (req, res) => {
  const c = clubProfile(int(req.params.id));
  if (!c) fail(404, 'Clube não encontrado');
  res.json(c);
});

r.get('/public/units/:id', (req, res) => {
  const u = unitProfile(int(req.params.id));
  if (!u) fail(404, 'Unidade não encontrada');
  res.json(u);
});

r.get('/public/members/:code', (req, res) => {
  const m = memberProfile('code', String(req.params.code).toUpperCase());
  if (!m) fail(404, 'Membro não encontrado');
  delete m.id;
  res.json(m);
});

export default r;
