// Mini jogos dos membros: cada partida manda a pontuação; o ranking de cada jogo é geral
// (todos os membros de todos os clubes) e não entra nos rankings do clube nem das unidades.
import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail } from '../util.js';
import { GAMES } from '../games.js';

const r = Router();
const member = requireAuth('member');

const game = (id) => {
  const g = GAMES[id];
  if (!g) fail(404, 'Jogo não encontrado');
  return g;
};
const col = (g) => (g.mode === 'sum' ? 'total' : 'best');
const myPosition = (id, g, value) => (value > 0
  ? get(`SELECT COUNT(*) + 1 n FROM game_scores s JOIN members m ON m.id = s.member_id
      WHERE s.game = ? AND m.status = 'ativo' AND s.${col(g)} > ?`, id, value).n
  : null);

// Meus recordes em todos os jogos.
r.get('/jogos/meus', member, (req, res) => {
  const rows = all('SELECT game, best, total, plays FROM game_scores WHERE member_id = ?', req.actor.id);
  res.json(Object.fromEntries(rows.map((x) => {
    const g = GAMES[x.game];
    if (!g) return [x.game, x];
    const value = x[col(g)];
    return [x.game, { ...x, value, position: myPosition(x.game, g, value) }];
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
  res.json({ ...now, score: pts, value, record: g.mode === 'best' && pts > 0 && pts > (before?.best ?? 0), position: myPosition(req.params.id, g, value) });
});

// Ranking geral de um jogo: os 50 primeiros e a minha posição.
// Skin dos jogos (vale para o Surf DBV e o Stumble DBV).
const SKIN_RE = /^[mf](0[1-9]|[12][0-9]|30)$/;
const BOARD_RE = /^b(0[1-9]|[12][0-9]|30)$/;
r.get('/jogos/skin', member, (req, res) => {
  const m = get('SELECT game_skin, game_board FROM members WHERE id = ?', req.actor.id);
  res.json({ skin: m?.game_skin || null, board: m?.game_board || null });
});
r.put('/jogos/skin', member, (req, res) => {
  const { skin, board } = req.body || {};
  if (!SKIN_RE.test(String(skin)) || !BOARD_RE.test(String(board))) fail(400, 'Skin inválida');
  run('UPDATE members SET game_skin = ?, game_board = ? WHERE id = ?', skin, board, req.actor.id);
  res.json({ ok: true, skin, board });
});

r.get('/jogos/:id/ranking', member, (req, res) => {
  const g = game(req.params.id);
  const c = col(g);
  const rows = all(`SELECT m.id, m.code, m.name, m.photo, c.name AS club_name, s.${c} AS value, s.plays
    FROM game_scores s JOIN members m ON m.id = s.member_id JOIN clubs c ON c.id = m.club_id
    WHERE s.game = ? AND m.status = 'ativo' AND s.${c} > 0
    ORDER BY s.${c} DESC, s.updated_at ASC LIMIT 50`, req.params.id);
  const mine = get(`SELECT ${c} AS value, plays FROM game_scores WHERE member_id = ? AND game = ?`, req.actor.id, req.params.id);
  res.json({
    mode: g.mode,
    rows: rows.map((x, i) => ({ ...x, position: i + 1 })),
    me: mine ? { ...mine, position: myPosition(req.params.id, g, mine.value) } : null,
  });
});

export default r;
