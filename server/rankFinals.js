// Finalizar um ranking: os 3 primeiros de cada tabela ganham a medalha (pessoas) ou o troféu
// (unidades e clubes) daquela colocação, com o ano; todos ficam sabendo a sua colocação; e o
// ranking recomeça do zero. Vale para o ranking do clube, do distrito e do Brasil (os mini-jogos não
// são finalizados e não dão prêmio).
import { all, get, run, tx } from './db.js';
import { todayBR } from './bible.js';
import { setScope, membersRanking, leadersRanking, unitsRanking, clubsRanking, clubMembersRanking, clubLeadersRanking, clubUnitsRanking } from './rankings.js';

run(`CREATE TABLE IF NOT EXISTS ranking_finals (
  id INTEGER PRIMARY KEY,
  scope TEXT NOT NULL,
  label TEXT NOT NULL,
  year INTEGER NOT NULL,
  finished_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
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

const METAL = ['Ouro', 'Prata', 'Bronze'];
const PLACE = ['Primeiro', 'Segundo', 'Terceiro'];
const SHINE = [
  'Brilhou como ouro: dedicação, estudo e fidelidade do começo ao fim.',
  'Prata de valor: firmeza e esforço que fizeram a diferença.',
  'Bronze de coragem: perseverança que mereceu o pódio.',
];
/** As tabelas de cada ranking: quem disputa, o tipo do prêmio e o nome de cada colocação. */
const KINDS = {
  membros: { target: 'member', prize: 'medalha', who: 'Desbravador', table: 'Desbravadores' },
  lideranca: { target: 'member', prize: 'medalha', who: 'Líder', table: 'Liderança' },
  unidades: { target: 'unit', prize: 'trofeu', who: 'Unidade', table: 'Unidades' },
  clubes: { target: 'club', prize: 'trofeu', who: 'Clube', table: 'Clubes' },
};
const LEVEL = { club: 'do clube', district: 'do distrito', brasil: 'do Brasil' };

/** Rankings que a finalização deste lugar fecha. */
function tablesOf(scope) {
  const [lv, raw] = scope.split(':');
  const id = Number(raw);
  if (lv === 'club') return { membros: clubMembersRanking(id), lideranca: clubLeadersRanking(id), unidades: clubUnitsRanking(id) };
  const d = lv === 'district' ? id : null;
  return { membros: membersRanking(d), lideranca: leadersRanking(d), unidades: unitsRanking(d), clubes: clubsRanking(d) };
}

export function scopeLabel(scope) {
  const [lv, id] = scope.split(':');
  if (lv === 'club') return get('SELECT name FROM clubs WHERE id = ?', Number(id))?.name || 'Clube';
  if (lv === 'district') return get('SELECT name FROM districts WHERE id = ?', Number(id))?.name || 'Distrito';
  return 'Brasil';
}

/** Medalha/troféu da colocação (a mesma todo ano; o ano vai na entrega). */
function prizeId(kind, level, pos) {
  const k = KINDS[kind];
  const name = `${k.who} de ${METAL[pos - 1]} ${LEVEL[level]}`;
  const icon = `rank:${kind}:${pos}`;
  const m = get('SELECT id FROM medals WHERE kind = ? AND name = ? AND icon = ?', k.prize, name, icon);
  if (m) return m.id;
  const desc = `${PLACE[pos - 1]} lugar no ranking de ${k.table.toLowerCase()} ${LEVEL[level]}. ${SHINE[pos - 1]}`;
  return Number(run('INSERT INTO medals (kind, name, icon, description) VALUES (?,?,?,?)', k.prize, name, icon, desc).lastInsertRowid);
}

/**
 * Finaliza o ranking do lugar (club:ID, district:ID ou brasil): guarda as colocações, entrega os
 * prêmios dos 3 primeiros (só de quem fez pontos) e recomeça do zero.
 */
export function finishRanking(scope, now = new Date()) {
  const level = scope.split(':')[0];
  const year = Number(todayBR(now).slice(0, 4));
  const label = scopeLabel(scope);
  const admin = get('SELECT id FROM admins WHERE district_id IS NULL ORDER BY id LIMIT 1') || get('SELECT id FROM admins ORDER BY id LIMIT 1');
  const tables = tablesOf(scope);
  return tx(() => {
    const finalId = Number(run('INSERT INTO ranking_finals (scope, label, year, finished_at) VALUES (?, ?, ?, ?)', scope, label, year, now.toISOString()).lastInsertRowid);
    let awarded = 0;
    for (const [kind, rows] of Object.entries(tables)) {
      const k = KINDS[kind];
      for (const r of rows) {
        let award = null;
        if (r.position <= 3 && r.points > 0 && admin) {
          award = Number(run(`INSERT INTO medal_awards (medal_id, target_type, target_id, note, awarded_by, year) VALUES (?, ?, ?, ?, ?, ?)`,
            prizeId(kind, level, r.position), k.target, r.id, `${r.position}º lugar · ${label} · ${year}`, admin.id, year).lastInsertRowid);
          awarded++;
        }
        run('INSERT OR IGNORE INTO ranking_final_rows (final_id, kind, target_type, target_id, position, points, award_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          finalId, kind, k.target, r.id, r.position, r.points, award);
      }
    }
    setScope(scope, { start: now.toISOString(), pause: null });
    return { id: finalId, scope, label, year, awarded };
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
  const rows = all(`SELECT f.id, f.scope, f.label, f.year, f.finished_at, r.kind, r.target_type, r.target_id, r.position, r.points,
      m.name AS prize_name, m.kind AS prize_kind, m.icon AS prize_icon, m.description AS prize_description,
      EXISTS (SELECT 1 FROM ranking_final_seen s WHERE s.final_id = f.id AND s.viewer_type = ? AND s.viewer_id = ?) AS seen
    FROM ranking_finals f JOIN ranking_final_rows r ON r.final_id = f.id
    LEFT JOIN medal_awards w ON w.id = r.award_id LEFT JOIN medals m ON m.id = w.medal_id
    WHERE f.finished_at >= ? AND (${cond}) ORDER BY f.finished_at DESC, r.position`,
  a.type, a.id, since, ...targets.flatMap(([t, id]) => [t, id]));
  const byId = new Map();
  for (const r of rows) {
    if (unseenOnly && r.seen) continue;
    if (!byId.has(r.id)) byId.set(r.id, { id: r.id, scope: r.scope.split(':')[0], label: r.label, year: r.year, finished_at: r.finished_at, seen: !!r.seen, places: [] });
    const who = targets.find(([t, id]) => t === r.target_type && id === r.target_id)[2];
    byId.get(r.id).places.push({
      kind: r.kind, table: KINDS[r.kind].table, who, position: r.position, points: r.points,
      prize: r.prize_name ? { name: r.prize_name, kind: r.prize_kind, icon: r.prize_icon, description: r.prize_description, year: r.year } : null,
    });
  }
  // Primeiro a própria pessoa, depois a unidade e o clube.
  const order = { Você: 0, 'Sua unidade': 1, 'Seu clube': 2 };
  for (const f of byId.values()) f.places.sort((x, y) => order[x.who] - order[y.who]);
  return [...byId.values()];
}

export const markFinalSeen = (a, id) => run('INSERT OR IGNORE INTO ranking_final_seen (final_id, viewer_type, viewer_id) VALUES (?, ?, ?)', id, a.type, a.id);
