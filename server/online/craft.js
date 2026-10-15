// DesbravaCraft online: mundos que ficam salvos no servidor. Qualquer membro com o código entra
// (até 10 ao mesmo tempo), mesmo sem o dono. O servidor guarda os blocos alterados e o estado de
// cada jogador, e repassa blocos e posições para quem está no mesmo mundo.
import crypto from 'node:crypto';
import { all, get, run } from '../db.js';

export const MAX_PLAYERS = 10;
const CS = 16;
const CH = 64;
const sessions = new Map(); // world_id -> Map(member -> { name, outfit })
const memberWorld = new Map(); // member -> world_id
const pending = new Map(); // world_id -> Map(chunk -> {idx: id}) ainda não gravado

function newCode() {
  for (;;) {
    const c = String(crypto.randomInt(1000, 10000));
    if (!get('SELECT 1 FROM craft_worlds WHERE code = ?', c)) return c;
  }
}

export function createWorld(memberId, name) {
  const clean = String(name || '').trim().slice(0, 40) || 'Meu mundo';
  const code = newCode();
  const seed = crypto.randomInt(1, 2 ** 31 - 1);
  const r = run('INSERT INTO craft_worlds (code, name, seed, owner_id) VALUES (?, ?, ?, ?)', code, clean, seed, memberId);
  run('INSERT OR IGNORE INTO craft_players (world_id, member_id) VALUES (?, ?)', r.lastInsertRowid, memberId);
  return { id: Number(r.lastInsertRowid), code, name: clean, seed };
}

export function myWorlds(memberId) {
  return all(`SELECT w.code, w.name, w.owner_id = ? AS mine, w.updated_at, m.name AS owner_name
    FROM craft_players p JOIN craft_worlds w ON w.id = p.world_id LEFT JOIN members m ON m.id = w.owner_id
    WHERE p.member_id = ? ORDER BY p.last_at DESC LIMIT 30`, memberId, memberId)
    .map((w) => ({ ...w, mine: !!w.mine, online: sessions.get(get('SELECT id FROM craft_worlds WHERE code = ?', w.code)?.id)?.size || 0 }));
}

function flush(worldId) {
  const p = pending.get(worldId);
  if (!p || !p.size) return;
  for (const [chunk, changes] of p) {
    const row = get('SELECT data FROM craft_chunks WHERE world_id = ? AND chunk = ?', worldId, chunk);
    const data = row ? JSON.parse(row.data) : {};
    Object.assign(data, changes);
    run(`INSERT INTO craft_chunks (world_id, chunk, data) VALUES (?, ?, ?)
      ON CONFLICT (world_id, chunk) DO UPDATE SET data = excluded.data`, worldId, chunk, JSON.stringify(data));
  }
  p.clear();
  run("UPDATE craft_worlds SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?", worldId);
}
setInterval(() => { for (const id of pending.keys()) flush(id); }, 5000).unref();

/** Entrar no mundo: devolve tudo o que o celular precisa para montar o mundo. */
export function join(memberId, code, info) {
  const w = get('SELECT id, code, name, seed, time, owner_id FROM craft_worlds WHERE code = ?', String(code || '').trim());
  if (!w) return { error: 'Mundo não encontrado. Confira o código.' };
  const s = sessions.get(w.id) || new Map();
  if (!s.has(memberId) && s.size >= MAX_PLAYERS) return { error: `O mundo está cheio (${MAX_PLAYERS} jogadores).` };
  leave(memberId);
  flush(w.id);
  s.set(memberId, info);
  sessions.set(w.id, s);
  memberWorld.set(memberId, w.id);
  run(`INSERT INTO craft_players (world_id, member_id) VALUES (?, ?)
    ON CONFLICT (world_id, member_id) DO UPDATE SET last_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`, w.id, memberId);
  const changes = Object.fromEntries(all('SELECT chunk, data FROM craft_chunks WHERE world_id = ?', w.id).map((r) => [r.chunk, JSON.parse(r.data)]));
  const me = get('SELECT state FROM craft_players WHERE world_id = ? AND member_id = ?', w.id, memberId);
  return { world: { code: w.code, name: w.name, seed: w.seed, time: w.time, mine: w.owner_id === memberId }, changes, player: me?.state ? JSON.parse(me.state) : null, worldId: w.id };
}

export function leave(memberId) {
  const id = memberWorld.get(memberId);
  if (id == null) return null;
  memberWorld.delete(memberId);
  const s = sessions.get(id);
  s?.delete(memberId);
  if (s && !s.size) { sessions.delete(id); flush(id); }
  return id;
}

export const worldOf = (memberId) => memberWorld.get(memberId);
export const playersIn = (worldId) => [...(sessions.get(worldId) || new Map()).entries()].map(([id, i]) => ({ id, ...i }));

/** Bloco alterado: confere e guarda (gravado no banco a cada 5 s). */
export function setBlock(memberId, x, y, z, id) {
  const wid = memberWorld.get(memberId);
  if (wid == null) return null;
  if (![x, y, z, id].every(Number.isInteger) || y < 1 || y >= CH || id < 0 || id > 99 || Math.abs(x) > 1e6 || Math.abs(z) > 1e6) return null;
  const cx = Math.floor(x / CS);
  const cz = Math.floor(z / CS);
  const idx = (y * CS + (z - cz * CS)) * CS + (x - cx * CS);
  if (!pending.has(wid)) pending.set(wid, new Map());
  const p = pending.get(wid);
  const k = `${cx},${cz}`;
  if (!p.has(k)) p.set(k, {});
  p.get(k)[idx] = id;
  return wid;
}

export function savePlayer(memberId, state, time) {
  const wid = memberWorld.get(memberId);
  if (wid == null) return;
  const json = JSON.stringify(state || {});
  if (json.length > 20000) return;
  run(`UPDATE craft_players SET state = ?, last_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE world_id = ? AND member_id = ?`, json, wid, memberId);
  if (Number.isFinite(time)) run('UPDATE craft_worlds SET time = ? WHERE id = ?', time, wid);
}
