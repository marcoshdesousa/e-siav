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
            (SELECT COUNT(*) FROM members m WHERE m.club_id = c.id AND m.status = 'ativo') AS member_count,
            (SELECT COUNT(*) FROM units u WHERE u.club_id = c.id) AS unit_count
     FROM clubs c WHERE c.district_id = ? ORDER BY c.name`,
    id,
  );
  rows.forEach((c) => (c.position = ranking.find((x) => x.id === c.id)?.position ?? null));
  res.json(rows);
});

// Busca de clã pelo número (1º, 2º...), pelo código (4 números) ou pelo nome.
r.get('/public/clubs/search', (req, res) => {
  const q = String(req.query.q || '').trim().replace(/º/g, '').slice(0, 80);
  if (!q) return res.json([]);
  const rows = /^\d+$/.test(q)
    ? all(`SELECT c.id, c.name, c.number, c.code, c.logo, d.name AS district_name FROM clubs c JOIN districts d ON d.id = c.district_id
           WHERE c.number = ? OR c.code = ? ORDER BY c.number LIMIT 20`, Number(q), q.padStart(4, '0'))
    : all(`SELECT c.id, c.name, c.number, c.code, c.logo, d.name AS district_name FROM clubs c JOIN districts d ON d.id = c.district_id
           WHERE c.name LIKE ? ORDER BY c.number LIMIT 30`, '%' + q + '%');
  res.json(rows);
});

r.get('/public/clubs/:id', (req, res) => {
  const c = clubProfile(int(req.params.id));
  if (!c) fail(404, 'Clã não encontrado');
  res.json(c);
});

r.get('/public/units/:id', (req, res) => {
  const u = unitProfile(int(req.params.id));
  if (!u) fail(404, 'Grupo não encontrado');
  res.json(u);
});

r.get('/public/members/:code', (req, res) => {
  // Link do perfil: /p/membro/123456 (código do membro).
  const m = memberProfile('code', String(req.params.code).trim());
  if (!m) fail(404, 'Membro não encontrado');
  delete m.id;
  res.json(m);
});

export default r;
