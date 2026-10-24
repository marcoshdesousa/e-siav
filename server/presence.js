// Sequência no app: cada dia em que o membro fica pelo menos 5 minutos no app (ou no site) conta
// um dia de sequência. Entrar várias vezes no mesmo dia conta um dia só. O app manda um "estou aqui"
// a cada minuto enquanto a tela está aberta.
import { all, get, run } from './db.js';
import { todayBR } from './bible.js';
import { bestDateStreak, dateStreak, giveBiblePack } from './streaks.js';

export const PRESENCE_MINUTES = 5;
run(`CREATE TABLE IF NOT EXISTS app_presence (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  last_ping INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, date)
)`);
try { run('ALTER TABLE app_presence ADD COLUMN rewarded INTEGER NOT NULL DEFAULT 0'); } catch { /* já existe */ }
/** Chave do dia nos pontos (faixa própria, não mistura com os dias de estudo). */
const APP_DAY_BASE = 300_000_000;

/** Um minuto a mais no dia (no máximo um a cada 50 segundos, para não contar em dobro). */
export function ping(memberId, now = Date.now()) {
  const date = todayBR(new Date(now));
  run('INSERT OR IGNORE INTO app_presence (member_id, date) VALUES (?, ?)', memberId, date);
  run('UPDATE app_presence SET minutes = minutes + 1, last_ping = ? WHERE member_id = ? AND date = ? AND last_ping <= ?', now, memberId, date, now - 50e3);
  // Completou os 5 minutos do dia: 1 pacotinho de figurinhas e 10 pontos no ranking (uma vez por dia).
  const reward = run('UPDATE app_presence SET rewarded = 1 WHERE member_id = ? AND date = ? AND minutes >= ? AND rewarded = 0', memberId, date, PRESENCE_MINUTES).changes > 0;
  if (reward) {
    giveBiblePack(memberId, 1);
    const m = get('SELECT club_id FROM members WHERE id = ?', memberId);
    run(`INSERT OR IGNORE INTO bible_points (member_id, day, unit_id, club_id, kind) VALUES (?, ?, NULL, ?, 'app')`, memberId, APP_DAY_BASE + Number(date.replaceAll('-', '')), m?.club_id ?? null);
  }
  return { ...presenceSummary(memberId, date), rewarded_now: reward };
}

export function presenceSummary(memberId, today = todayBR()) {
  const days = all('SELECT date FROM app_presence WHERE member_id = ? AND minutes >= ? ORDER BY date', memberId, PRESENCE_MINUTES).map((x) => x.date);
  const t = get('SELECT minutes FROM app_presence WHERE member_id = ? AND date = ?', memberId, today);
  return { streak: dateStreak(days, today), best_streak: bestDateStreak(days), today_minutes: t?.minutes || 0, today_done: (t?.minutes || 0) >= PRESENCE_MINUTES, need: PRESENCE_MINUTES };
}

// ---------- Clube: entrar no portal uma vez por dia ----------
run(`CREATE TABLE IF NOT EXISTS club_presence (
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (club_id, date)
)`);

/**
 * O clube entrou hoje (vale uma vez por dia): o clube ganha a sequência e 100 pontos no ranking de
 * clubes, e cada membro ativo ganha um pacotinho de figurinhas (que sai com repetidas, menos nos
 * primeiros pacotinhos de quem está começando).
 */
export function clubEntered(clubId, now = new Date()) {
  const date = todayBR(now);
  const first = run('INSERT OR IGNORE INTO club_presence (club_id, date) VALUES (?, ?)', clubId, date).changes > 0;
  let packs = 0;
  if (first) {
    for (const m of all(`SELECT id FROM members WHERE club_id = ? AND status = 'ativo'`, clubId)) { giveBiblePack(m.id, 1, { repeat: true }); packs++; }
  }
  return { first, packs, ...clubPresenceSummary(clubId, date) };
}
export function clubPresenceSummary(clubId, today = todayBR()) {
  const days = all('SELECT date FROM club_presence WHERE club_id = ? ORDER BY date', clubId).map((x) => x.date);
  return { streak: dateStreak(days, today), best_streak: bestDateStreak(days), today_done: days.includes(today) };
}
