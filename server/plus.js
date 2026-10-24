// DBV+ (assinatura de 30 dias para membros): ajuda o app e libera benefícios.
//   DBV          R$ 3,90  — só para quem criou a conta pelo app (sem clube): libera o app, como o plano grátis.
//                            A conta nova já entra com 3 dias de DBV para conhecer o app.
//   DBV+          R$ 7,90  — benefícios do app
//   DBV+ 3 Espec. R$ 19,90 — + 3 especialidades físicas (escolhe 15, a equipe compra 3)
//   DBV+ 7 Espec. R$ 34,90 — + 7 especialidades físicas (escolhe 20, a equipe compra 7)
// Todo plano: Bom Líder, ranking dos jogos, jogos sem internet, 40 pacotinhos a cada 30 dias,
// figurinhas em triplo na compra e o selo de verificado. Os áudios das leituras são de graça para todos. Só para quem assina (ou ganhou do
// administrador geral); o modo de teste não libera o DBV+.
import { all, get, run, tx } from './db.js';

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

// Teste grátis (conta nova do App Brasil): marcado para mostrar "Você está no teste grátis".
if (!all('PRAGMA table_info(member_plus)').some((c) => c.name === 'trial')) run('ALTER TABLE member_plus ADD COLUMN trial INTEGER NOT NULL DEFAULT 0');

export const PLANS = {
  app: { id: 'app', name: 'DBV', price_cents: 390, specialties: 0, pick: 0, access_only: true },
  plus: { id: 'plus', name: 'DBV+', price_cents: 790, specialties: 0, pick: 0 },
  plus3: { id: 'plus3', name: 'DBV+ 3 Especialidades', price_cents: 1990, specialties: 3, pick: 15 },
  plus7: { id: 'plus7', name: 'DBV+ 7 Especialidades', price_cents: 3490, specialties: 7, pick: 20 },
};
export const PLUS_DAYS = 30;
/** Conta nova do App Brasil: dias de DBV para conhecer o app antes de assinar. */
export const APP_TRIAL_DAYS = 3;
export const PLUS_PACKS = 40;
/** Compra de pacotinhos: o assinante leva 3 pelo preço de 1. */
export const PLUS_PACK_MULT = 3;

/** Assinatura do membro (ativa ou não). */
export function plusOf(memberId) {
  const p = get('SELECT plan, until, picks, picks_needed, picks_at, started_at, trial FROM member_plus WHERE member_id = ?', memberId);
  if (!p) return null;
  const active = p.until > new Date().toISOString();
  return { ...p, trial: !!p.trial && active, trial_ended: !!p.trial && !active, picks: p.picks ? JSON.parse(p.picks) : null, active, plan_name: p.trial && active ? 'Teste grátis' : PLANS[p.plan]?.name || 'DBV+' };
}
/** Assinante ativo do DBV+ (o DBV só libera o acesso, sem os benefícios). */
export const isPlus = (memberId) => { const p = plusOf(memberId); return !!p?.active && p.plan !== 'app'; };
/** Algum plano ativo (o DBV também conta): libera o app para quem entrou pelo App Brasil. */
export const hasAccess = (memberId) => !!plusOf(memberId)?.active;
/** Planos que cada conta pode assinar: quem é do App Brasil só tem o DBV e o DBV+ (sem especialidades). */
export const plansFor = (isApp) => Object.values(PLANS).filter((p) => (isApp ? ['app', 'plus'].includes(p.id) : p.id !== 'app'));
/** Benefício do DBV+ liberado (assinante ativo). */
export const plusOpen = (memberId) => isPlus(memberId);

/** Áudio das leituras: liberado para todos (plano grátis também). */
export const gatedAudio = (_memberId, audio) => ({ audio: audio || null });

/** Pagamento confirmado: +30 dias (somando ao que falta), 40 pacotinhos e, se o plano tiver, a escolha das especialidades. */
export function activatePlus(memberId, planId) {
  const plan = PLANS[planId] || PLANS.plus;
  const cur = get('SELECT until FROM member_plus WHERE member_id = ?', memberId);
  const from = cur && cur.until > new Date().toISOString() ? new Date(cur.until) : new Date();
  const until = new Date(from.getTime() + PLUS_DAYS * 864e5).toISOString();
  run(`INSERT INTO member_plus (member_id, plan, until, picks_needed) VALUES (?, ?, ?, ?)
    ON CONFLICT (member_id) DO UPDATE SET plan = excluded.plan, until = excluded.until, renewals = renewals + 1, trial = 0,
      picks_needed = excluded.picks_needed, picks = CASE WHEN excluded.picks_needed > 0 THEN NULL ELSE picks END,
      picks_at = CASE WHEN excluded.picks_needed > 0 THEN NULL ELSE picks_at END`, memberId, plan.id, until, plan.pick);
  if (plan.access_only) return until;
  run('INSERT OR IGNORE INTO album_progress (member_id, album) VALUES (?, ?)', memberId, 'biblico');
  run('UPDATE album_progress SET packs_unopened = packs_unopened + ? WHERE member_id = ? AND album = ?', PLUS_PACKS, memberId, 'biblico');
  return until;
}

/** Administrador geral dá (ou tira) o DBV+ de um membro, sem pagamento: dias de validade a partir de hoje. */
export function grantPlus(memberId, planId, days, { trial = false } = {}) {
  const plan = PLANS[planId] || PLANS.plus;
  const until = new Date(Date.now() + days * 864e5).toISOString();
  run(`INSERT INTO member_plus (member_id, plan, until, picks_needed, trial) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (member_id) DO UPDATE SET plan = excluded.plan, until = excluded.until, picks_needed = excluded.picks_needed, trial = excluded.trial,
      picks = CASE WHEN excluded.plan = member_plus.plan THEN picks ELSE NULL END,
      picks_at = CASE WHEN excluded.plan = member_plus.plan THEN picks_at ELSE NULL END`, memberId, plan.id, until, plan.pick, trial ? 1 : 0);
  return until;
}
export const removePlus = (memberId) => run('DELETE FROM member_plus WHERE member_id = ?', memberId);

/**
 * Base de teste (uma vez): nos clubes de teste, um membro sim, outro não ganha o DBV+ por 1 ano,
 * revezando os 3 planos; os outros ficam no plano grátis.
 */
export function testPlusOnce() {
  const KEY = 'dbvplus-teste-v1';
  if (get('SELECT 1 FROM app_flags WHERE key = ?', KEY)) return;
  const members = all(`SELECT m.id FROM members m JOIN clubs c ON c.id = m.club_id
    WHERE c.code IN ('4821','7350') AND m.status = 'ativo' ORDER BY c.code, m.id`);
  if (!members.length) return;
  const plans = ['plus', 'plus3', 'plus7'];
  tx(() => {
    members.forEach((m, i) => { if (i % 2 === 1) grantPlus(m.id, plans[((i - 1) / 2) % 3], 365); });
    run('INSERT OR IGNORE INTO app_flags (key) VALUES (?)', KEY);
  });
}
