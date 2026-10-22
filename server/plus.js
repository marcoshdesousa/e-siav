// DBV+ (assinatura de 30 dias para membros): ajuda o app e libera benefícios.
//   DBV+          R$ 9,90  — benefícios do app
//   DBV+ 3 Espec. R$ 24,90 — + 3 especialidades físicas (escolhe 15, a equipe compra 3)
//   DBV+ 7 Espec. R$ 39,90 — + 7 especialidades físicas (escolhe 20, a equipe compra 7)
// Todo plano: áudio das leituras, Bom Líder, mini-jogos sem internet e no ranking, 30 pacotinhos a
// cada 30 dias, figurinhas em dobro na compra e o selo de verificado. No modo de teste fica tudo liberado.
import { get, run } from './db.js';
import { setting } from './fees.js';

run(`CREATE TABLE IF NOT EXISTS member_plus (
  member_id INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  until TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  picks TEXT,
  picks_needed INTEGER NOT NULL DEFAULT 0,
  picks_at TEXT,
  renewals INTEGER NOT NULL DEFAULT 0
)`);

export const PLANS = {
  plus: { id: 'plus', name: 'DBV+', price_cents: 990, specialties: 0, pick: 0 },
  plus3: { id: 'plus3', name: 'DBV+ 3 Especialidades', price_cents: 2490, specialties: 3, pick: 15 },
  plus7: { id: 'plus7', name: 'DBV+ 7 Especialidades', price_cents: 3990, specialties: 7, pick: 20 },
};
export const PLUS_DAYS = 30;
export const PLUS_PACKS = 30;

/** Assinatura do membro (ativa ou não). */
export function plusOf(memberId) {
  const p = get('SELECT plan, until, picks, picks_needed, picks_at, started_at FROM member_plus WHERE member_id = ?', memberId);
  if (!p) return null;
  return { ...p, picks: p.picks ? JSON.parse(p.picks) : null, active: p.until > new Date().toISOString(), plan_name: PLANS[p.plan]?.name || 'DBV+' };
}
/** Assinante ativo (sem contar o modo de teste). */
export const isPlus = (memberId) => !!plusOf(memberId)?.active;
/** Benefício liberado: assinante ativo ou modo de teste ligado. */
export const plusOpen = (memberId) => setting('biblia_teste') !== '0' || isPlus(memberId);

/** Áudio só para quem tem o DBV+ (ou no modo de teste): { audio } ou { audio: null, audio_locked: true }. */
/** Áudio da leitura: os primeiros (free) são de graça para todos; os outros são do DBV+. */
export const gatedAudio = (memberId, audio, free = false) => (!audio ? { audio: null } : free || plusOpen(memberId) ? { audio } : { audio: null, audio_locked: true });
/** Quantos áudios do começo do Ano Bíblico e da Meditação são de graça. */
export const FREE_AUDIOS = 5;

/** Pagamento confirmado: +30 dias (somando ao que falta), 30 pacotinhos e, se o plano tiver, a escolha das especialidades. */
export function activatePlus(memberId, planId) {
  const plan = PLANS[planId] || PLANS.plus;
  const cur = get('SELECT until FROM member_plus WHERE member_id = ?', memberId);
  const from = cur && cur.until > new Date().toISOString() ? new Date(cur.until) : new Date();
  const until = new Date(from.getTime() + PLUS_DAYS * 864e5).toISOString();
  run(`INSERT INTO member_plus (member_id, plan, until, picks_needed) VALUES (?, ?, ?, ?)
    ON CONFLICT (member_id) DO UPDATE SET plan = excluded.plan, until = excluded.until, renewals = renewals + 1,
      picks_needed = excluded.picks_needed, picks = CASE WHEN excluded.picks_needed > 0 THEN NULL ELSE picks END,
      picks_at = CASE WHEN excluded.picks_needed > 0 THEN NULL ELSE picks_at END`, memberId, plan.id, until, plan.pick);
  run('INSERT OR IGNORE INTO album_progress (member_id, album) VALUES (?, ?)', memberId, 'biblico');
  run('UPDATE album_progress SET packs_unopened = packs_unopened + ? WHERE member_id = ? AND album = ?', PLUS_PACKS, memberId, 'biblico');
  return until;
}
