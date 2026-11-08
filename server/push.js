// Lembretes no celular (Web Push). Cada membro recebe por dia, entre 9h e 21h (horário de Brasília),
// lembretes espalhados: entrar no app, Meditação, Ano Bíblico, Escola Sabatina, requisito, joguinho e
// figurinhas. Lembrete de algo que ele já fez hoje não é enviado. O horário de cada lembrete muda de
// pessoa para pessoa (e de dia para dia), para não chegar tudo junto, e há pelo menos 40 minutos entre
// um lembrete e outro. Em cada estudo o membro também pode marcar o horário do lembrete (todo dia, na
// hora que ele quiser); aí o lembrete automático daquele estudo não é mandado.
import crypto from 'node:crypto';
import webpush from 'web-push';
import { all, get, run } from './db.js';
import { setSetting, setting } from './fees.js';
import { TOTAL_DAYS, todayBR, todayDay } from './bible.js';
import { PRESENCE_MINUTES } from './presence.js';
import { medStart, ssCategoryFor } from './routes/devotional.js';
import { applies } from './routes/requirements.js';
import { memberKind } from './util.js';
import { siteUrl } from './syncpay.js';

run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
// Um registro por lembrete do dia (enviado ou pulado porque já tinha feito): não repete.
run(`CREATE TABLE IF NOT EXISTS push_log (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL,
  PRIMARY KEY (member_id, date, kind)
)`);

// Lembrete com horário escolhido pelo membro, em cada estudo (todo dia, na hora que ele marcou).
run(`CREATE TABLE IF NOT EXISTS study_reminders (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  time TEXT NOT NULL,
  PRIMARY KEY (member_id, kind)
)`);

export const START_HOUR = 9;
export const END_HOUR = 21;
const GAP_MIN = 40;

/** Chaves VAPID: do ambiente ou criadas uma vez e guardadas no banco. */
export function vapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  let pub = setting('vapid_public');
  let priv = setting('vapid_private');
  if (!pub || !priv) {
    ({ publicKey: pub, privateKey: priv } = webpush.generateVAPIDKeys());
    setSetting('vapid_public', pub);
    setSetting('vapid_private', priv);
  }
  return { publicKey: pub, privateKey: priv };
}

export function saveSubscription(memberId, sub) {
  const endpoint = String(sub?.endpoint || '');
  const { p256dh, auth } = sub?.keys || {};
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return false;
  run(`INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth`, memberId, endpoint, String(p256dh), String(auth));
  return true;
}
export const removeSubscription = (memberId, endpoint) => run('DELETE FROM push_subscriptions WHERE member_id = ? AND endpoint = ?', memberId, String(endpoint || ''));

// ---------- O que falta hoje ----------
const doneBible = (id, today) => {
  const day = todayDay(today);
  if (day < 1 || day > TOTAL_DAYS) return null; // fora do Ano Bíblico: não lembra
  return !!get('SELECT 1 FROM bible_progress WHERE member_id = ? AND day = ? AND completed_at IS NOT NULL', id, day);
};
const doneMeditation = (id, today) => (today < medStart() ? null : !!get('SELECT 1 FROM meditation_progress WHERE member_id = ? AND date = ? AND completed_at IS NOT NULL', id, today));
const doneSabbath = (m, today) => {
  if (!get('SELECT 1 FROM sabbath_lessons WHERE date = ? AND category = ?', today, ssCategoryFor(m.birth_date))) return null;
  return !!get('SELECT 1 FROM sabbath_progress WHERE member_id = ? AND date = ? AND completed_at IS NOT NULL', m.id, today);
};
const enteredToday = (id, today) => (get('SELECT minutes FROM app_presence WHERE member_id = ? AND date = ?', id, today)?.minutes || 0) >= PRESENCE_MINUTES;
// game_scores.updated_at é UTC; Brasília é UTC-3.
const playedToday = (id, today) => !!get("SELECT 1 FROM game_scores WHERE member_id = ? AND date(updated_at, '-3 hours') = ?", id, today);
function openRequirements(m) {
  const actor = { type: 'member', id: m.id, kind: memberKind(m.birth_date), club_id: m.club_id, unit_id: m.unit_id, district_id: m.district_id };
  return all('SELECT * FROM requirements WHERE deadline >= ?', new Date().toISOString())
    .filter((q) => applies(actor, q) && !get(`SELECT 1 FROM submissions WHERE requirement_id = ? AND submitter_type = 'member' AND submitter_id = ? AND status <> 'recusado'`, q.id, m.id)).length;
}
const stickersToDo = (id) => (get('SELECT COALESCE(SUM(packs_unopened), 0) n FROM album_progress WHERE member_id = ?', id).n
  + get('SELECT COUNT(*) n FROM album_stickers WHERE member_id = ? AND stuck = 0', id).n);

/**
 * Os lembretes, na ordem do dia. from/to: janela (em minutos desde 0h) em que o horário de cada um é
 * sorteado. check(m, today): a mensagem, ou null quando não precisa lembrar.
 */
const KINDS = [
  { kind: 'entrar', from: 9 * 60, to: 10 * 60, check: (m, t) => (enteredToday(m.id, t) ? null
    : { title: 'Bom dia, desbravador!', body: 'Passe 5 minutos no App do DBV hoje: ganha 1 pacotinho de figurinhas e 10 pontos.', url: '/membro' }) },
  { kind: 'meditacao', from: 10 * 60 + 20, to: 11 * 60 + 40, check: (m, t) => (doneMeditation(m.id, t) !== false ? null
    : { title: 'Meditação Diária', body: 'A meditação de hoje está esperando você. Leva só alguns minutos!', url: '/membro/aprendizagem/meditacao' }) },
  { kind: 'ano_biblico', from: 12 * 60, to: 13 * 60 + 30, check: (m, t) => (doneBible(m.id, t) !== false ? null
    : { title: 'Ano Bíblico', body: 'A leitura de hoje já liberou. Leia, responda o quiz e mantenha a sua sequência!', url: '/membro/aprendizagem/ano-biblico' }) },
  { kind: 'escola_sabatina', from: 14 * 60, to: 15 * 60 + 30, check: (m, t) => (doneSabbath(m, t) !== false ? null
    : { title: 'Escola Sabatina', body: 'A lição de hoje está pronta para você estudar.', url: '/membro/aprendizagem/escola-sabatina' }) },
  { kind: 'requisito', from: 16 * 60, to: 17 * 60, check: (m) => {
    const n = openRequirements(m);
    return n ? { title: 'Requisito para cumprir', body: n > 1 ? `Você tem ${n} requisitos esperando. Cumpra e some pontos no ranking!` : 'Você tem um requisito esperando. Cumpra e some pontos no ranking!', url: '/membro/requisitos' } : null;
  } },
  { kind: 'jogo', from: 17 * 60 + 40, to: 18 * 60 + 40, check: (m, t) => (playedToday(m.id, t) ? null
    : { title: 'Bora jogar?', body: 'Que tal um joguinho rápido no App do DBV? Tente bater o seu recorde!', url: '/membro/jogos' }) },
  { kind: 'figurinhas', from: 19 * 60, to: 20 * 60, check: (m) => (stickersToDo(m.id) ? { title: 'Figurinhas esperando', body: 'Abra os seus pacotinhos e cole as figurinhas no álbum!', url: '/membro/albuns' } : null) },
  // Último aviso: algum estudo do dia ainda não feito.
  { kind: 'ultimo', from: 20 * 60 + 15, to: 20 * 60 + 50, check: (m, t) => {
    const left = [doneMeditation(m.id, t) === false && 'Meditação', doneBible(m.id, t) === false && 'Ano Bíblico', doneSabbath(m, t) === false && 'Escola Sabatina'].filter(Boolean);
    return left.length ? { title: 'Ainda dá tempo!', body: `Falta hoje: ${left.join(', ')}. Feito no dia, vale a pontuação cheia e a sequência.`, url: '/membro/aprendizagem' } : null;
  } },
];

/**
 * Os estudos que aceitam lembrete com horário. check(m, today): a mensagem, ou null quando não precisa
 * lembrar (já fez hoje, ou o estudo ainda não começou).
 */
const leaderToday = (id, t) => !!get("SELECT 1 FROM bom_lider_progress WHERE member_id = ? AND date(completed_at, '-3 hours') = ?", id, t);
const bdbToday = (id, t) => !!get("SELECT 1 FROM bdb_progress WHERE member_id = ? AND date(passed_at, '-3 hours') = ?", id, t);
const hasTable = (t) => !!get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", t);
export const STUDY_REMINDERS = {
  ano_biblico: { label: 'Ano Bíblico', check: (m, t) => (doneBible(m.id, t) !== false ? null
    : { title: 'Hora do Ano Bíblico', body: 'Você pediu para lembrar: a leitura de hoje está esperando.', url: '/membro/aprendizagem/ano-biblico' }) },
  meditacao: { label: 'Meditação Diária', check: (m, t) => (doneMeditation(m.id, t) !== false ? null
    : { title: 'Hora da Meditação', body: 'Você pediu para lembrar: a meditação de hoje está esperando.', url: '/membro/aprendizagem/meditacao' }) },
  escola_sabatina: { label: 'Escola Sabatina', check: (m, t) => (doneSabbath(m, t) !== false ? null
    : { title: 'Hora da Escola Sabatina', body: 'Você pediu para lembrar: a lição de hoje está esperando.', url: '/membro/aprendizagem/escola-sabatina' }) },
  bom_lider: { label: 'Bom Líder', check: (m, t) => {
    const start = setting('bom_lider_inicio');
    if ((start && t < start) || !hasTable('bom_lider_progress') || leaderToday(m.id, t)) return null;
    return { title: 'Hora do Bom Líder', body: 'Você pediu para lembrar: que tal fazer uma aula hoje?', url: '/membro/aprendizagem/bom-lider' };
  } },
  bom_de_biblia: { label: 'Bom de Bíblia', check: (m, t) => (bdbToday(m.id, t) ? null
    : { title: 'Hora do Bom de Bíblia', body: 'Você pediu para lembrar: passe mais uma fase hoje!', url: '/membro/aprendizagem/bom-de-biblia' }) },
};
// Lembrete automático que o horário escolhido substitui (o mesmo estudo não lembra duas vezes).
const CUSTOM_REPLACES = { ano_biblico: 'ano_biblico', meditacao: 'meditacao', escola_sabatina: 'escola_sabatina' };

export const remindersOf = (memberId) => Object.fromEntries(all('SELECT kind, time FROM study_reminders WHERE member_id = ?', memberId).map((x) => [x.kind, x.time]));
/** Marca (HH:MM) ou tira (time vazio) o lembrete de um estudo. */
export function setReminder(memberId, kind, time) {
  if (!STUDY_REMINDERS[kind]) return false;
  if (!time) { run('DELETE FROM study_reminders WHERE member_id = ? AND kind = ?', memberId, kind); return true; }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  run('INSERT INTO study_reminders (member_id, kind, time) VALUES (?, ?, ?) ON CONFLICT (member_id, kind) DO UPDATE SET time = excluded.time', memberId, kind, time);
  return true;
}

/** Minuto do dia em que este lembrete sai para este membro (muda por pessoa e por dia). */
export function slotOf(memberId, date, k) {
  const h = crypto.createHash('sha1').update(`${memberId}|${date}|${k.kind}`).digest().readUInt32BE(0);
  return k.from + (h % Math.max(1, k.to - k.from));
}

/** Minutos desde 0h em Brasília. */
function minutesBR(now) {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).split(':').map(Number);
  return h * 60 + m;
}

/** Envia para todos os aparelhos do membro; tira os que não existem mais. */
async function deliver(memberId, msg) {
  const { publicKey, privateKey } = vapidKeys();
  let ok = false;
  for (const s of all('SELECT * FROM push_subscriptions WHERE member_id = ?', memberId)) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg),
        { vapidDetails: { subject: process.env.VAPID_SUBJECT || siteUrl(), publicKey, privateKey }, TTL: 3 * 3600, urgency: 'normal' });
      ok = true;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) run('DELETE FROM push_subscriptions WHERE id = ?', s.id);
    }
  }
  return ok;
}

/**
 * Uma rodada (a cada minuto): para cada membro com celular cadastrado, o próximo lembrete cuja hora
 * chegou. No máximo um por rodada e com 40 minutos desde o último enviado.
 */
export async function pushTick(now = new Date(), send = deliver) {
  const min = minutesBR(now);
  const today = todayBR(now);
  const log = (m, kind, ok) => run('INSERT OR IGNORE INTO push_log (member_id, date, kind, sent, at) VALUES (?, ?, ?, ?, ?)', m.id, today, kind, ok ? 1 : 0, now.getTime());
  let sent = 0;
  // 1) Lembretes com o horário que o membro escolheu (a qualquer hora do dia, sem intervalo mínimo).
  const custom = all(`SELECT r.kind, r.time, m.id, m.club_id, m.unit_id, m.birth_date, c.district_id
    FROM study_reminders r JOIN members m ON m.id = r.member_id JOIN clubs c ON c.id = m.club_id
    WHERE m.status = 'ativo' AND r.member_id IN (SELECT member_id FROM push_subscriptions)`);
  for (const r of custom) {
    const [h, mm] = r.time.split(':').map(Number);
    const key = `hora:${r.kind}`;
    // Só na hora marcada (ou até 30 minutos depois, se o servidor estava parado).
    if (min < h * 60 + mm || min > h * 60 + mm + 30) continue;
    if (get('SELECT 1 FROM push_log WHERE member_id = ? AND date = ? AND kind = ?', r.id, today, key)) continue;
    const msg = STUDY_REMINDERS[r.kind]?.check(r, today);
    const ok = msg ? await send(r.id, { ...msg, tag: key }) : false;
    log(r, key, ok);
    if (ok) sent++;
  }
  // 2) Lembretes automáticos, espalhados entre 9h e 21h.
  if (min < START_HOUR * 60 || min >= END_HOUR * 60) return sent;
  const members = all(`SELECT DISTINCT m.id, m.club_id, m.unit_id, m.birth_date, c.district_id
    FROM push_subscriptions s JOIN members m ON m.id = s.member_id JOIN clubs c ON c.id = m.club_id WHERE m.status = 'ativo'`);
  for (const m of members) {
    const done = new Set(all('SELECT kind FROM push_log WHERE member_id = ? AND date = ?', m.id, today).map((x) => x.kind));
    const last = get('SELECT MAX(at) at FROM push_log WHERE member_id = ? AND date = ? AND sent = 1', m.id, today)?.at || 0;
    // O estudo com horário escolhido não ganha também o lembrete automático.
    const own = new Set(Object.keys(remindersOf(m.id)).map((k) => CUSTOM_REPLACES[k]).filter(Boolean));
    for (const k of KINDS) {
      if (done.has(k.kind) || own.has(k.kind) || slotOf(m.id, today, k) > min) continue;
      const msg = k.check(m, today);
      if (msg && now.getTime() - last < GAP_MIN * 60e3) break; // espera o intervalo
      const ok = msg ? await send(m.id, { ...msg, tag: k.kind }) : false;
      log(m, k.kind, ok);
      if (ok) { sent++; break; }
    }
  }
  return sent;
}

export function startPushWatch() {
  if (process.env.NODE_ENV === 'test' || process.env.PUSH_OFF === '1') return;
  vapidKeys();
  const tick = () => pushTick().catch((e) => console.error('lembretes:', e.message));
  setInterval(tick, 60e3).unref();
}
