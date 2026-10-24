// @ do membro: escolhido por ele (na criação da conta ou depois, em Minha conta), único em todo o app
// e sem troca depois de criado. Serve para entrar (no lugar do código) e aparece no perfil, mas
// ninguém pesquisa pelo @ (igual ao código).
import { get, run } from './db.js';
import { fail } from './util.js';

/** "@Joao.Silva" → "joao.silva". 3 a 20 letras, números, ponto ou _ (não pode ser só números). */
export function normalizeHandle(v) {
  return String(v || '').trim().replace(/^@+/, '').toLowerCase();
}
export function checkHandle(v) {
  const h = normalizeHandle(v);
  if (!/^[a-z0-9._]{3,20}$/.test(h)) fail(400, 'O @ precisa ter de 3 a 20 letras, números, ponto ou _ (sem espaço e sem acento)');
  if (/^[\d.]+$/.test(h)) fail(400, 'O @ não pode ser só números');
  if (h.startsWith('.') || h.endsWith('.') || h.includes('..')) fail(400, 'O @ não pode começar ou terminar com ponto');
  if (get('SELECT 1 FROM members WHERE handle = ? COLLATE NOCASE', h) || get('SELECT 1 FROM logins WHERE username = ? COLLATE NOCASE', h)) fail(409, `O @${h} já é de outra pessoa. Escolha outro.`);
  return h;
}
/** Grava o @ do membro (só se ainda não tiver). */
export function setHandle(memberId, v) {
  const h = checkHandle(v);
  if (get('SELECT handle FROM members WHERE id = ?', memberId)?.handle) fail(409, 'Você já tem o seu @ e ele não pode ser trocado');
  run('UPDATE members SET handle = ? WHERE id = ?', h, memberId);
  return h;
}
export const memberByHandle = (v) => get('SELECT id FROM members WHERE handle = ? COLLATE NOCASE', normalizeHandle(v));
