// Sequência no app: cada dia em que o membro fica pelo menos 5 minutos no app (ou no site) conta
// um dia de sequência. Entrar várias vezes no mesmo dia conta um dia só. O app manda um "estou aqui"
// a cada minuto enquanto a tela está aberta.
import { all, get, run } from './db.js';
import { todayBR } from './bible.js';
import { bestDateStreak, dateStreak } from './streaks.js';

export const PRESENCE_MINUTES = 5;
run(`CREATE TABLE IF NOT EXISTS app_presence (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  last_ping INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, date)
)`);

/** Um minuto a mais no dia (no máximo um a cada 50 segundos, para não contar em dobro). */
export function ping(memberId, now = Date.now()) {
  const date = todayBR(new Date(now));
  run('INSERT OR IGNORE INTO app_presence (member_id, date) VALUES (?, ?)', memberId, date);
  run('UPDATE app_presence SET minutes = minutes + 1, last_ping = ? WHERE member_id = ? AND date = ? AND last_ping <= ?', now, memberId, date, now - 50e3);
  return presenceSummary(memberId, date);
}

export function presenceSummary(memberId, today = todayBR()) {
  const days = all('SELECT date FROM app_presence WHERE member_id = ? AND minutes >= ? ORDER BY date', memberId, PRESENCE_MINUTES).map((x) => x.date);
  const t = get('SELECT minutes FROM app_presence WHERE member_id = ? AND date = ?', memberId, today);
  return { streak: dateStreak(days, today), best_streak: bestDateStreak(days), today_minutes: t?.minutes || 0, today_done: (t?.minutes || 0) >= PRESENCE_MINUTES, need: PRESENCE_MINUTES };
}
