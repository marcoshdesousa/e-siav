// Apagar contas de verdade: o membro apaga a própria conta; o clube só é apagado pelo
// administrador (geral ou do distrito). As tabelas ligadas por chave somem sozinhas (CASCADE);
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

export function deleteClub(id) {
  tx(() => {
    dropOwned('member', all('SELECT id FROM members WHERE club_id = ?', id).map((m) => m.id));
    dropOwned('unit', all('SELECT id FROM units WHERE club_id = ?', id).map((u) => u.id));
    dropOwned('club', [id]);
    run('DELETE FROM clubs WHERE id = ?', id);
  });
}
