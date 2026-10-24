// Apagar contas de verdade: o membro só é apagado pelo administrador geral; o clube pelo
// administrador (geral ou do distrito); distritos e administradores só pelo geral. As tabelas ligadas por chave somem sozinhas (CASCADE);
// aqui saem as que guardam o dono por tipo + id (envios, medalhas, eventos, suporte e login).
import { all, run, tx } from './db.js';

const POLY = [['submissions', 'submitter_type', 'submitter_id'], ['medal_awards', 'target_type', 'target_id'],
  ['event_participants', 'target_type', 'target_id'], ['support_threads', 'actor_type', 'actor_id'], ['logins', 'account_type', 'account_id']];

function dropOwned(type, ids) {
  if (!ids.length) return;
  const q = ids.map(() => '?').join(',');
  for (const [t, tc, ic] of POLY) run(`DELETE FROM ${t} WHERE ${tc} = ? AND ${ic} IN (${q})`, type, ...ids);
}

export function deleteMember(id) {
  tx(() => {
    dropOwned('member', [id]);
    run('DELETE FROM members WHERE id = ?', id);
  });
}

function dropClub(id) {
  dropOwned('member', all('SELECT id FROM members WHERE club_id = ?', id).map((m) => m.id));
  dropOwned('unit', all('SELECT id FROM units WHERE club_id = ?', id).map((u) => u.id));
  dropOwned('club', [id]);
  run('DELETE FROM clubs WHERE id = ?', id);
}
export const deleteClub = (id) => tx(() => dropClub(id));

/** Administrador de distrito: as medalhas que ele deu ficam no nome de quem apagou. */
function dropAdmin(id, byAdminId) {
  run('UPDATE medal_awards SET awarded_by = ? WHERE awarded_by = ?', byAdminId, id);
  run('UPDATE admins SET created_by = NULL WHERE created_by = ?', id);
  dropOwned('admin', [id]);
  run('DELETE FROM admins WHERE id = ?', id);
}
export const deleteAdmin = (id, byAdminId) => tx(() => dropAdmin(id, byAdminId));

/** Distrito: some com os clubes (e tudo deles), os administradores e o que foi feito só para ele. */
export function deleteDistrict(id, byAdminId) {
  tx(() => {
    for (const c of all('SELECT id FROM clubs WHERE district_id = ?', id)) dropClub(c.id);
    for (const a of all('SELECT id FROM admins WHERE district_id = ?', id)) dropAdmin(a.id, byAdminId);
    run('DELETE FROM requirements WHERE district_id = ?', id);
    run('DELETE FROM events WHERE district_id = ?', id);
    run("DELETE FROM announcements WHERE target_type = 'district' AND target_id = ?", id);
    run('DELETE FROM districts WHERE id = ?', id);
  });
}
