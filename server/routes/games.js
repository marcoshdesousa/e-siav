// Mini jogos dos membros: cada partida manda a pontuação; cada jogo tem ranking do clube, do distrito
// e do Brasil (todos do app). Não entra nos rankings de requisitos, não é finalizado e não dá prêmio.
import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail } from '../util.js';
import { GAMES } from '../games.js';
import { isPlus } from '../plus.js';

// Só quem tem o DBV+ entra no ranking dos mini-jogos (no modo de teste, todos).
const PLUS_SQL = `m.id IN (SELECT member_id FROM member_plus WHERE plan <> 'app' AND until > strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

const r = Router();
const member = requireAuth('member');

const game = (id) => {
  const g = GAMES[id];
  if (!g) fail(404, 'Jogo não encontrado');
  return g;
};
const col = (g) => (g.mode === 'sum' ? 'total' : 'best');
/** Ranking do clube, do distrito ou do Brasil (a conta do App Brasil só tem o Brasil). */
const scopeOf = (a, q) => (a.app ? 'brasil' : ['clube', 'distrito', 'brasil'].includes(q) ? q : 'brasil');
const scopeSql = (a, scope) => (scope === 'clube' ? ` AND m.club_id = ${Number(a.club_id)}`
  : scope === 'distrito' ? ` AND m.club_id IN (SELECT id FROM clubs WHERE district_id = ${Number(a.district_id)})` : '');
// Quem não é DBV+ não aparece no ranking, então também não tem posição.
const myPosition = (id, g, value, memberId, where = '') => (value > 0 && isPlus(memberId)
  ? get(`SELECT COUNT(*) + 1 n FROM game_scores s JOIN members m ON m.id = s.member_id
      WHERE s.game = ? AND m.status = 'ativo' AND ${PLUS_SQL}${where} AND s.${col(g)} > ?`, id, value).n
  : null);

// Meus recordes em todos os jogos.
r.get('/jogos/meus', member, (req, res) => {
  const rows = all('SELECT game, best, total, plays FROM game_scores WHERE member_id = ?', req.actor.id);
  res.json(Object.fromEntries(rows.map((x) => {
    const g = GAMES[x.game];
    if (!g) return [x.game, x];
    const value = x[col(g)];
    return [x.game, { ...x, value, position: myPosition(x.game, g, value, req.actor.id) }];
  })));
});

r.post('/jogos/:id/pontos', member, (req, res) => {
  const g = game(req.params.id);
  if (g.server) fail(400, 'Os pontos deste jogo são marcados pelo servidor');
  const score = Math.floor(Number(req.body.score));
  if (!Number.isFinite(score) || score < 0) fail(400, 'Pontuação inválida');
  const pts = Math.min(score, g.max);
  const before = get('SELECT best, total FROM game_scores WHERE member_id = ? AND game = ?', req.actor.id, req.params.id);
  run(`INSERT INTO game_scores (member_id, game, best, total, plays) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (member_id, game) DO UPDATE SET best = max(best, excluded.best), total = total + excluded.total,
      plays = plays + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`, req.actor.id, req.params.id, pts, pts);
  const now = get('SELECT best, total, plays FROM game_scores WHERE member_id = ? AND game = ?', req.actor.id, req.params.id);
  const value = now[col(g)];
  res.json({ ...now, score: pts, value, record: g.mode === 'best' && pts > 0 && pts > (before?.best ?? 0), position: myPosition(req.params.id, g, value, req.actor.id), in_ranking: isPlus(req.actor.id) });
});

// Resumo de todos os jogos num lugar: o 1º colocado, quantos jogam e a minha posição.
r.get('/jogos/ranking/resumo', member, (req, res) => {
  const scope = scopeOf(req.actor, req.query.escopo);
  const sums = Object.entries(GAMES).filter(([, g]) => g.mode === 'sum').map(([id]) => `'${id.replace(/'/g, "''")}'`).join(',');
  const value = `CASE WHEN s.game IN (${sums || "''"}) THEN s.total ELSE s.best END`;
  const rows = all(`SELECT * FROM (
      SELECT s.game, m.id, m.name, m.photo, ${value} AS value,
        ROW_NUMBER() OVER (PARTITION BY s.game ORDER BY ${value} DESC, s.updated_at ASC) AS position,
        COUNT(*) OVER (PARTITION BY s.game) AS players
      FROM game_scores s JOIN members m ON m.id = s.member_id
      WHERE m.status = 'ativo' AND ${PLUS_SQL}${scopeSql(req.actor, scope)} AND ${value} > 0
    ) WHERE position = 1 OR id = ?`, req.actor.id);
  const out = {};
  for (const x of rows) {
    if (!GAMES[x.game]) continue;
    const o = (out[x.game] ||= { players: x.players, leader: null, me: null });
    if (x.position === 1) o.leader = { name: x.name, photo: x.photo, value: x.value, me: x.id === req.actor.id };
    if (x.id === req.actor.id) o.me = { position: x.position, value: x.value };
  }
  res.json({ scope, in_ranking: isPlus(req.actor.id), games: out });
});

// Ranking de um jogo (do clube, do distrito ou do Brasil): os 50 primeiros e a minha posição.
r.get('/jogos/:id/ranking', member, (req, res) => {
  const g = game(req.params.id);
  const c = col(g);
  const scope = scopeOf(req.actor, req.query.escopo);
  const where = scopeSql(req.actor, scope);
  const rows = all(`SELECT m.id, m.link_token AS link, m.name, m.photo, c.name AS club_name, d.name AS district_name, s.${c} AS value, s.plays
    FROM game_scores s JOIN members m ON m.id = s.member_id JOIN clubs c ON c.id = m.club_id JOIN districts d ON d.id = c.district_id
    WHERE s.game = ? AND m.status = 'ativo' AND ${PLUS_SQL}${where} AND s.${c} > 0
    ORDER BY s.${c} DESC, s.updated_at ASC LIMIT 50`, req.params.id);
  const mine = get(`SELECT ${c} AS value, plays FROM game_scores WHERE member_id = ? AND game = ?`, req.actor.id, req.params.id);
  res.json({
    mode: g.mode,
    scope,
    in_ranking: isPlus(req.actor.id),
    rows: rows.map((x, i) => ({ ...x, position: i + 1 })),
    me: mine ? { ...mine, position: myPosition(req.params.id, g, mine.value, req.actor.id, where) } : null,
  });
});

export default r;
