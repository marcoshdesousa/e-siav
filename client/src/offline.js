// Modo sem internet: entrar de novo neste aparelho, jogar os mini jogos e colar figurinhas.
// - Login: quando a pessoa entra com internet, guardamos neste aparelho uma "impressão" da senha
//   (PBKDF2, nunca a senha) e os dados da conta. Sem internet, a mesma senha confere aqui.
// - Figurinhas: o álbum fica guardado; o que for colado sem internet vai numa fila e é enviado
//   quando a internet volta.
import { useEffect, useState } from 'react';

const LOGINS = 'dbv-offline-logins';
const ACTOR = 'dbv-offline-actor';
const ALBUM = (id) => 'dbv-offline-album-' + id;
const QUEUE = (id) => 'dbv-offline-paste-' + id;

const read = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const write = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço */ } };

/** true quando o aparelho está sem internet. */
export function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true); const down = () => setOn(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}
export const isOfflineError = (e) => !!e?.offline;

// ---------- Login ----------
const enc = new window.TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function derive(password, salt) {
  const subtle = window.crypto?.subtle;
  if (!subtle) return null;
  const key = await subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}
const keyOf = (mode, username) => `${mode}:${String(username).trim().toLowerCase()}`;

/** Depois de entrar com internet: só membros podem entrar sem internet depois. */
export async function rememberLogin(mode, username, password, actor) {
  if (actor?.type !== 'member') return;
  try {
    const salt = hex(window.crypto.getRandomValues(new Uint8Array(16)));
    const hash = await derive(password, salt);
    if (!hash) return;
    const all = read(LOGINS, {});
    all[keyOf(mode, username)] = { salt, hash, actor, at: Date.now() };
    write(LOGINS, all);
  } catch { /* sem armazenamento */ }
}
/** Sem internet: confere a senha neste aparelho. Devolve a conta (marcada como offline) ou null. */
export async function offlineLogin(mode, username, password) {
  const rec = read(LOGINS, {})[keyOf(mode, username)];
  if (!rec) return null;
  const hash = await derive(password, rec.salt);
  return hash && hash === rec.hash ? { ...rec.actor, offline: true } : null;
}
export const hasOfflineLogins = () => Object.keys(read(LOGINS, {})).length > 0;

/** Última conta de membro aberta neste aparelho (para abrir o app sem internet já logado). */
export const saveActor = (actor) => write(ACTOR, actor?.type === 'member' ? { ...actor, offline: undefined } : null);
export const savedActor = () => { const a = read(ACTOR, null); return a ? { ...a, offline: true } : null; };
export const forgetActor = () => write(ACTOR, null);

// ---------- Figurinhas ----------
export const saveAlbum = (id, data) => write(ALBUM(id), data);
export const savedAlbum = (id) => read(ALBUM(id), null);
export const pasteQueue = (id) => read(QUEUE(id), []);
export function queuePaste(id, sid) {
  const q = pasteQueue(id);
  if (!q.includes(sid)) write(QUEUE(id), [...q, sid]);
  const a = savedAlbum(id);
  if (a?.stickers?.[sid]) { a.stickers[sid] = { ...a.stickers[sid], stuck: true }; saveAlbum(id, a); }
}
export const clearPasteQueue = (id) => write(QUEUE(id), null);
