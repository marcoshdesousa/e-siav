// Finalizar um ranking. Cada tabela (desbravadores, liderança, unidades, clubes) de cada lugar (clube,
// distrito, Brasil) é finalizada sozinha: quem finaliza personaliza o troféu (modelo, cor, base,
// emblema, título e ano), os 3 primeiros ganham o troféu e o certificado (Downloads), todos ficam
// sabendo a sua colocação e a tabela fecha até ser criada de novo (a do Brasil reabre na hora).
// Os mini-jogos são finalizados só pelo administrador geral, todos de uma vez: os 3 primeiros de cada
// jogo (ranking do Brasil) ganham uma medalha (sem certificado) e os jogos recomeçam do zero.
import { all, get, run, tx } from './db.js';
import { todayBR } from './bible.js';
import { GAMES } from './games.js';
import { closeTable, TABLES, membersRanking, leadersRanking, unitsRanking, clubsRanking, clubMembersRanking, clubLeadersRanking, clubUnitsRanking } from './rankings.js';
import { fail } from './util.js';

run(`CREATE TABLE IF NOT EXISTS ranking_finals (
  id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL,
  label TEXT NOT NULL,
  year INTEGER NOT NULL,
  finished_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
for (const [col, def] of [['kind', 'TEXT'], ['design', 'TEXT']]) {
  if (!all('PRAGMA table_info(ranking_finals)').some((c) => c.name === col)) run(`ALTER TABLE ranking_finals ADD COLUMN ${col} ${def}`);
}
run(`CREATE TABLE IF NOT EXISTS ranking_final_rows (
  final_id INTEGER NOT NULL REFERENCES ranking_finals(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  points INTEGER NOT NULL,
  award_id INTEGER,
  PRIMARY KEY (final_id, kind, target_type, target_id)
)`);
run('CREATE INDEX IF NOT EXISTS idx_final_rows_target ON ranking_final_rows(target_type, target_id)');
run(`CREATE TABLE IF NOT EXISTS ranking_final_seen (
  final_id INTEGER NOT NULL REFERENCES ranking_finals(id) ON DELETE CASCADE,
  viewer_type TEXT NOT NULL,
  viewer_id INTEGER NOT NULL,
  PRIMARY KEY (final_id, viewer_type, viewer_id)
)`);

/** As tabelas: quem disputa e o título padrão do troféu. */
export const KINDS = {
  membros: { target: 'member', table: 'Desbravadores', title: 'Melhor Desbravador' },
  lideranca: { target: 'member', table: 'Liderança', title: 'Melhor Líder' },
  unidades: { target: 'unit', table: 'Unidades', title: 'Melhor Unidade' },
  clubes: { target: 'club', table: 'Clubes', title: 'Melhor Clube' },
};
const LEVEL = { club: 'do clube', district: 'do distrito', brasil: 'do Brasil' };

function rowsOf(scope, kind) {
  const [lv, raw] = scope.split(':');
  const id = Number(raw);
  const d = lv === 'district' ? id : null;
  if (lv === 'club') return { membros: clubMembersRanking, lideranca: clubLeadersRanking, unidades: clubUnitsRanking }[kind](id);
  return { membros: membersRanking, lideranca: leadersRanking, unidades: unitsRanking, clubes: clubsRanking }[kind](d);
}

export function scopeLabel(scope) {
  const [lv, id] = scope.split(':');
  if (lv === 'club') return get('SELECT name FROM clubs WHERE id = ?', Number(id))?.name || 'Clube';
  if (lv === 'district') return get('SELECT name FROM districts WHERE id = ?', Number(id))?.name || 'Distrito';
  if (lv === 'jogos') return 'Mini-jogos';
  return 'Brasil';
}

/** Personalização do troféu/medalha: só valores simples (os desenhos ficam no app). */
export function cleanDesign(d = {}, { title, year }) {
  const key = (v, def) => (/^[a-z0-9-]{1,24}$/.test(String(v || '')) ? String(v) : def);
  const y = Math.trunc(Number(d.year));
  return {
    model: key(d.model, 'classica'),
    color: key(d.color, 'podio'),
    base: key(d.base, 'madeira'),
    emblem: key(d.emblem, 'estrela'),
    ribbon: key(d.ribbon, 'dbv'),
    year: y >= 2000 && y <= 2100 ? y : year,
    title: String(d.title || '').trim().slice(0, 32) || title,
  };
}

const awarder = () => get('SELECT id FROM admins WHERE district_id IS NULL ORDER BY id LIMIT 1') || get('SELECT id FROM admins ORDER BY id LIMIT 1');

/** Prêmio do catálogo (um por tipo e título; o desenho e o ano vão na entrega). */
function prizeId(kind, name, description) {
  const m = get(`SELECT id FROM medals WHERE kind = ? AND name = ? AND icon = 'custom'`, kind, name);
  if (m) return m.id;
  return Number(run(`INSERT INTO medals (kind, name, icon, description) VALUES (?, ?, 'custom', ?)`, kind, name, description).lastInsertRowid);
}

function giveAward({ prize, name, description, target, id, position, note, design, admin }) {
  return Number(run(`INSERT INTO medal_awards (medal_id, target_type, target_id, note, awarded_by, year, place, design) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    prizeId(prize, name, description), target, id, note, admin.id, design.year, position, JSON.stringify(design)).lastInsertRowid);
}

const SHINE = ['Brilhou como ouro: dedicação, estudo e fidelidade do começo ao fim.', 'Prata de valor: firmeza e esforço que fizeram a diferença.', 'Bronze de coragem: perseverança que mereceu o pódio.'];

/**
 * Finaliza uma tabela de um lugar (club:ID, district:ID ou brasil): guarda as colocações, entrega o
 * troféu personalizado aos 3 primeiros (só de quem fez pontos) e fecha a tabela.
 */
export function finishRanking(scope, kind, design = {}, now = new Date()) {
  const level = scope.split(':')[0];
  if (!TABLES[level]?.includes(kind)) fail(400, 'Escolha o ranking');
  const k = KINDS[kind];
  const year = Number(todayBR(now).slice(0, 4));
  const label = scopeLabel(scope);
  const look = cleanDesign(design, { title: k.title, year });
  const admin = awarder();
  const rows = rowsOf(scope, kind);
  if (!rows.length) fail(400, 'Este ranking não está aberto');
  return tx(() => {
    const finalId = Number(run('INSERT INTO ranking_finals (scope, label, year, finished_at, kind, design) VALUES (?, ?, ?, ?, ?, ?)',
      scope, label, look.year, now.toISOString(), kind, JSON.stringify(look)).lastInsertRowid);
    let awarded = 0;
    for (const r of rows) {
      let award = null;
      if (r.position <= 3 && r.points > 0 && admin) {
        award = giveAward({
          prize: 'trofeu', name: look.title, admin, target: k.target, id: r.id, position: r.position, design: look,
          description: `${r.position}º lugar no ranking de ${k.table.toLowerCase()} ${LEVEL[level]}. ${SHINE[r.position - 1]}`,
          note: `${r.position}º lugar · ${label} · ${look.year}`,
        });
        awarded++;
      }
      run('INSERT OR IGNORE INTO ranking_final_rows (final_id, kind, target_type, target_id, position, points, award_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        finalId, kind, k.target, r.id, r.position, r.points, award);
    }
    closeTable(scope, kind, now.toISOString());
    return { id: finalId, scope, kind, label, year: look.year, awarded, reopened: scope === 'brasil' };
  });
}

// Mesmo filtro do ranking dos jogos: só quem tem o DBV+.
const PLUS_SQL = `m.id IN (SELECT member_id FROM member_plus WHERE plan <> 'app' AND until > strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** Finaliza todos os mini-jogos (ranking do Brasil): medalha para os 3 primeiros de cada e tudo zera. */
export function finishGames(design = {}, now = new Date()) {
  const year = Number(todayBR(now).slice(0, 4));
  const look = cleanDesign(design, { title: 'Campeão dos Jogos', year });
  const admin = awarder();
  return tx(() => {
    const finalId = Number(run(`INSERT INTO ranking_finals (scope, label, year, finished_at, kind, design) VALUES ('jogos', 'Mini-jogos', ?, ?, 'jogos', ?)`,
      look.year, now.toISOString(), JSON.stringify(look)).lastInsertRowid);
    let awarded = 0;
    for (const [game, g] of Object.entries(GAMES)) {
      const col = g.mode === 'sum' ? 'total' : 'best';
      const rows = all(`SELECT s.member_id AS id, s.${col} AS points FROM game_scores s JOIN members m ON m.id = s.member_id
        WHERE s.game = ? AND m.status = 'ativo' AND ${PLUS_SQL} AND s.${col} > 0 ORDER BY s.${col} DESC, s.updated_at ASC`, game);
      rows.forEach((r, i) => {
        const position = i + 1;
        let award = null;
        if (position <= 3 && admin) {
          award = giveAward({
            prize: 'medalha', name: `${look.title}`, admin, target: 'member', id: r.id, position, design: { ...look, game },
            description: `${position}º lugar no ranking do Brasil de um mini-jogo. ${SHINE[i]}`,
            note: `${position}º lugar · Mini-jogos · ${look.year}`,
          });
          awarded++;
        }
        run('INSERT OR IGNORE INTO ranking_final_rows (final_id, kind, target_type, target_id, position, points, award_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          finalId, game, 'member', r.id, position, r.points, award);
      });
    }
    // Os jogos recomeçam do zero (as pontuações antigas vão para o arquivo, com o ano).
    run('CREATE TABLE IF NOT EXISTS game_scores_arquivo AS SELECT 0 AS ano, * FROM game_scores WHERE 0');
    const cols = all('PRAGMA table_info(game_scores)').map((c) => c.name);
    const have = new Set(all('PRAGMA table_info(game_scores_arquivo)').map((c) => c.name));
    for (const c of cols) if (!have.has(c)) run(`ALTER TABLE game_scores_arquivo ADD COLUMN ${c}`);
    run(`INSERT INTO game_scores_arquivo (ano, ${cols.join(', ')}) SELECT ?, ${cols.join(', ')} FROM game_scores`, look.year);
    run('DELETE FROM game_scores');
    return { id: finalId, scope: 'jogos', kind: 'jogos', label: 'Mini-jogos', year: look.year, awarded };
  });
}

/** Quem a conta representa: ela mesma e, para o membro, também a unidade e o clube dele. */
function targetsOf(a) {
  if (a.type === 'member') return [['member', a.id, 'Você'], ...(a.unit_id ? [['unit', a.unit_id, 'Sua unidade']] : []), ...(a.club_id && !a.app ? [['club', a.club_id, 'Seu clube']] : [])];
  if (a.type === 'unit') return [['unit', a.id, 'Sua unidade'], ['club', a.club_id, 'Seu clube']];
  if (a.type === 'club') return [['club', a.id, 'Seu clube']];
  return [];
}

/** Rankings finalizados (dos últimos 60 dias) em que esta conta aparece, com a colocação e o prêmio. */
export function finalsFor(a, { unseenOnly = false } = {}) {
  const targets = targetsOf(a);
  if (!targets.length) return [];
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const cond = targets.map(() => '(r.target_type = ? AND r.target_id = ?)').join(' OR ');
  const rows = all(`SELECT f.id, f.scope, f.label, f.year, f.finished_at, f.kind AS final_kind, r.kind, r.target_type, r.target_id, r.position, r.points,
      m.name AS prize_name, m.kind AS prize_kind, w.design, w.id AS award_id,
      EXISTS (SELECT 1 FROM ranking_final_seen s WHERE s.final_id = f.id AND s.viewer_type = ? AND s.viewer_id = ?) AS seen
    FROM ranking_finals f JOIN ranking_final_rows r ON r.final_id = f.id
    LEFT JOIN medal_awards w ON w.id = r.award_id LEFT JOIN medals m ON m.id = w.medal_id
    WHERE f.finished_at >= ? AND (${cond}) ORDER BY f.finished_at DESC, r.position`,
  a.type, a.id, since, ...targets.flatMap(([t, id]) => [t, id]));
  const byId = new Map();
  for (const r of rows) {
    if (unseenOnly && r.seen) continue;
    if (!byId.has(r.id)) byId.set(r.id, { id: r.id, scope: r.scope.split(':')[0], kind: r.final_kind, label: r.label, year: r.year, finished_at: r.finished_at, seen: !!r.seen, places: [] });
    const who = targets.find(([t, id]) => t === r.target_type && id === r.target_id)[2];
    byId.get(r.id).places.push({
      kind: r.kind, table: KINDS[r.kind]?.table || null, game: KINDS[r.kind] ? null : r.kind, who, position: r.position, points: r.points,
      prize: r.prize_name ? { id: r.award_id, name: r.prize_name, kind: r.prize_kind, design: JSON.parse(r.design || 'null'), place: r.position } : null,
    });
  }
  const order = { Você: 0, 'Sua unidade': 1, 'Seu clube': 2 };
  for (const f of byId.values()) {
    f.places.sort((x, y) => order[x.who] - order[y.who] || x.position - y.position);
    // Nos jogos aparecem só os 10 em que a pessoa foi melhor.
    if (f.kind === 'jogos') f.places = f.places.slice(0, 10);
  }
  return [...byId.values()];
}

export const markFinalSeen = (a, id) => run('INSERT OR IGNORE INTO ranking_final_seen (final_id, viewer_type, viewer_id) VALUES (?, ?, ?)', id, a.type, a.id);

/** O último resultado de uma tabela (o pódio que aparece enquanto o novo ranking não é criado). */
export function lastFinal(scope, kind) {
  const f = get('SELECT id, year, finished_at, design FROM ranking_finals WHERE scope = ? AND kind = ? ORDER BY id DESC LIMIT 1', scope, kind);
  if (!f) return null;
  const k = KINDS[kind];
  const name = { member: 'SELECT name, photo FROM members WHERE id = ?', unit: 'SELECT name, logo AS photo FROM units WHERE id = ?', club: 'SELECT name, logo AS photo FROM clubs WHERE id = ?' }[k.target];
  const podium = all('SELECT target_id, position, points FROM ranking_final_rows WHERE final_id = ? AND position <= 3 AND points > 0 ORDER BY position', f.id)
    .map((r) => ({ id: r.target_id, position: r.position, points: r.points, ...(get(name, r.target_id) || { name: '—' }) }));
  return { id: f.id, year: f.year, finished_at: f.finished_at, design: JSON.parse(f.design || 'null'), podium };
}

/** Certificado do troféu (público: mostra só nomes). Medalha de jogo não tem certificado. */
export function trophyCertificate(awardId) {
  const a = get(`SELECT a.id, a.target_type, a.target_id, a.year, a.place, a.design, a.note, a.awarded_at, m.name, m.kind, m.description
    FROM medal_awards a JOIN medals m ON m.id = a.medal_id WHERE a.id = ? AND a.design IS NOT NULL`, awardId);
  if (!a || a.kind !== 'trofeu') return null;
  const row = get('SELECT r.kind, f.scope, f.label FROM ranking_final_rows r JOIN ranking_finals f ON f.id = r.final_id WHERE r.award_id = ?', a.id);
  let who;
  let club;
  if (a.target_type === 'member') {
    who = get('SELECT m.name, m.club_id FROM members m WHERE m.id = ?', a.target_id);
    club = who && get('SELECT name, logo, director_name, is_app FROM clubs WHERE id = ?', who.club_id);
  } else if (a.target_type === 'unit') {
    const u = get('SELECT u.name, u.club_id FROM units u WHERE u.id = ?', a.target_id);
    who = u && { name: `Unidade ${u.name}` };
    club = u && get('SELECT name, logo, director_name, is_app FROM clubs WHERE id = ?', u.club_id);
  } else {
    club = get('SELECT name, logo, director_name, is_app FROM clubs WHERE id = ?', a.target_id);
    who = club && { name: club.name };
  }
  if (!who) return null;
  const level = row ? row.scope.split(':')[0] : 'brasil';
  const k = KINDS[row?.kind] || KINDS.membros;
  return {
    id: a.id, kind: 'trofeu', place: a.place, year: a.year, design: JSON.parse(a.design), date: a.awarded_at,
    member_name: who.name, title: `${a.place}º lugar · ${a.name}`,
    what: `conquistou o ${a.place}º lugar no ranking de ${k.table.toLowerCase()} ${LEVEL[level]}${level !== 'brasil' && row ? ` (${row.label})` : ''} na temporada ${a.year}, recebendo o troféu`,
    club_name: club && !club.is_app ? club.name : null, club_logo: club && !club.is_app ? club.logo : null,
    director_name: level === 'club' && club && !club.is_app ? club.director_name : null,
  };
}

/** Certificados de troféu do membro (para a área Downloads). */
export const memberTrophies = (memberId) => all(`SELECT a.id, a.place, a.year, a.awarded_at, m.name FROM medal_awards a JOIN medals m ON m.id = a.medal_id
  WHERE a.target_type = 'member' AND a.target_id = ? AND a.design IS NOT NULL AND m.kind = 'trofeu' ORDER BY a.id DESC`, memberId);
