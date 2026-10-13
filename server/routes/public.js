import { Router } from 'express';
import { all, get } from '../db.js';
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

// Busca de clube pelo número (1º, 2º...), pelo código (4 números) ou pelo nome.
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
  if (!c) fail(404, 'Clube não encontrado');
  res.json(c);
});

// Links bonitos: /clube/4821 (clube) e /clube/4821/2 (unidade nº 2 do clube; "lideranca" para a unidade Liderança).
r.get('/public/cla/:code', (req, res) => {
  const c = get('SELECT id FROM clubs WHERE code = ?', String(req.params.code).trim());
  const p = c && clubProfile(c.id);
  if (!p) fail(404, 'Clube não encontrado');
  res.json(p);
});
r.get('/public/cla/:code/:n', (req, res) => {
  const n = String(req.params.n).toLowerCase();
  const u = get(
    `SELECT u.id FROM units u JOIN clubs c ON c.id = u.club_id WHERE c.code = ? AND ${['lideranca', 'tutores'].includes(n) ? 'u.is_leadership = 1' : 'u.number = ?'}`,
    ...[String(req.params.code).trim(), ...(['lideranca', 'tutores'].includes(n) ? [] : [int(n)])],
  );
  const p = u && unitProfile(u.id);
  if (!p) fail(404, 'Unidade não encontrada');
  res.json(p);
});

r.get('/public/units/:id', (req, res) => {
  const u = unitProfile(int(req.params.id));
  if (!u) fail(404, 'Unidade não encontrada');
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
