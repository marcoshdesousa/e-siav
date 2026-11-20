// Molduras da foto de perfil. A conta (membro, unidade ou clube) ganha molduras e escolhe uma para
// usar. Vêm de: álbum completo (exclusiva do App do DBV), mini-jogos do mês (o nome do jogo e o mês,
// ex.: 1.27), ranking finalizado e requisito (personalizadas por quem criou).
import { all, get, run } from './db.js';

run(`CREATE TABLE IF NOT EXISTS frames (
  id INTEGER PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  ref TEXT,
  style TEXT NOT NULL,
  color TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  sub TEXT NOT NULL DEFAULT '',
  place INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
run('CREATE INDEX IF NOT EXISTS idx_frames_target ON frames(target_type, target_id)');
run('CREATE UNIQUE INDEX IF NOT EXISTS idx_frames_ref ON frames(target_type, target_id, source, ref) WHERE ref IS NOT NULL');
for (const t of ['members', 'units', 'clubs']) {
  if (!all(`PRAGMA table_info(${t})`).some((c) => c.name === 'frame_id')) run(`ALTER TABLE ${t} ADD COLUMN frame_id INTEGER`);
}

export const FRAME_STYLES = ['classica', 'louros', 'estrelas', 'joias', 'chamas', 'dbv'];
export const FRAME_COLORS = ['ouro', 'prata', 'bronze', 'azul', 'vermelho', 'verde', 'roxo', 'rosa', 'laranja', 'turquesa', 'noite', 'arco'];
/** Cor da moldura dos jogos em cada mês (cada época tem a sua). */
export const MONTH_COLORS = ['azul', 'vermelho', 'verde', 'roxo', 'laranja', 'turquesa', 'rosa', 'noite', 'ouro', 'arco', 'prata', 'bronze'];
const MONTH_STYLES = ['estrelas', 'chamas', 'joias', 'louros'];
const TABLE = { member: 'members', unit: 'units', club: 'clubs' };

/** Personalização vinda do app: só valores conhecidos e textos curtos. */
export function cleanFrame(f = {}, { title = '', sub = '' } = {}) {
  if (!f || typeof f !== 'object') return null;
  return {
    style: FRAME_STYLES.includes(f.style) && f.style !== 'dbv' ? f.style : 'classica',
    color: FRAME_COLORS.includes(f.color) ? f.color : 'ouro',
    title: String(f.title ?? title).trim().slice(0, 22),
    sub: String(f.sub ?? sub).trim().slice(0, 12),
  };
}

/** Entrega uma moldura (com ref, não repete). Devolve o id ou null. */
export function giveFrame({ target, id, source, ref = null, style, color, title = '', sub = '', place = null, note = null }) {
  if (!TABLE[target] || !id) return null;
  const r = run(`INSERT OR IGNORE INTO frames (target_type, target_id, source, ref, style, color, title, sub, place, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    target, id, source, ref, style, color, title, sub, place, note);
  if (!r.changes) return null;
  return Number(r.lastInsertRowid);
}

const out = (f) => (f ? { id: f.id, source: f.source, style: f.style, color: f.color, title: f.title, sub: f.sub, place: f.place, note: f.note, created_at: f.created_at } : null);

export const framesOf = (target, id) => all('SELECT * FROM frames WHERE target_type = ? AND target_id = ? ORDER BY id DESC', target, id).map(out);

/** A moldura que a conta está usando (ou null). */
export function frameOf(target, id) {
  const t = TABLE[target];
  if (!t || !id) return null;
  return out(get(`SELECT f.* FROM ${t} x JOIN frames f ON f.id = x.frame_id AND f.target_type = ? AND f.target_id = x.id WHERE x.id = ?`, target, id));
}

export function useFrame(target, id, frameId) {
  if (frameId != null && !get('SELECT 1 FROM frames WHERE id = ? AND target_type = ? AND target_id = ?', frameId, target, id)) return false;
  run(`UPDATE ${TABLE[target]} SET frame_id = ? WHERE id = ?`, frameId ?? null, id);
  return true;
}

/** Álbum completo: a moldura exclusiva do App do DBV (já fica em uso se não tiver outra). */
export function albumFrame(memberId, albumName) {
  const fid = giveFrame({ target: 'member', id: memberId, source: 'album', ref: 'album', style: 'dbv', color: 'ouro', title: 'App do DBV', sub: 'Álbum completo', note: albumName });
  if (fid) run('UPDATE members SET frame_id = ? WHERE id = ? AND frame_id IS NULL', fid, memberId);
  return fid;
}

/** Moldura do mês de um mini-jogo: o nome do jogo em cima e o mês embaixo (ex.: 1.27). */
export function gameFrame(memberId, { game, gameName, year, month, place }) {
  const yy = String(year).slice(-2);
  return giveFrame({
    target: 'member', id: memberId, source: 'jogo', ref: `jogo:${game}:${year}-${month}`,
    style: MONTH_STYLES[(month - 1) % MONTH_STYLES.length], color: MONTH_COLORS[month - 1],
    title: gameName, sub: `${month}.${yy}`, place, note: `${place}º lugar no ranking do mês`,
  });
}
