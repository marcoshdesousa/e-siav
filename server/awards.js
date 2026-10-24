// Prêmios automáticos (digitais): medalhas e troféus que o app entrega sozinho quando o membro
// conclui algo (álbum completo, Ano Bíblico, Bom Líder...). Ficam no perfil, como os entregues pela equipe.
import { get, run } from './db.js';

/** Medalha/troféu do catálogo (cria uma vez, pelo nome). */
function medalId(kind, name, icon, description) {
  const m = get('SELECT id FROM medals WHERE kind = ? AND name = ?', kind, name);
  if (m) return m.id;
  return Number(run('INSERT INTO medals (kind, name, icon, description) VALUES (?,?,?,?)', kind, name, icon, description).lastInsertRowid);
}

/** Entrega para o membro (uma vez só). Quem "entrega" é o administrador geral. */
export function autoAward(memberId, { kind, name, icon, description, note = null }) {
  const id = medalId(kind, name, icon, description);
  if (get(`SELECT 1 FROM medal_awards WHERE medal_id = ? AND target_type = 'member' AND target_id = ?`, id, memberId)) return false;
  const admin = get('SELECT id FROM admins WHERE district_id IS NULL ORDER BY id LIMIT 1') || get('SELECT id FROM admins ORDER BY id LIMIT 1');
  if (!admin) return false;
  run(`INSERT INTO medal_awards (medal_id, target_type, target_id, note, awarded_by) VALUES (?, 'member', ?, ?, ?)`, id, memberId, note, admin.id);
  return true;
}

/** Álbum completo: medalha e troféu (no lugar do trunfo físico). */
export function awardAlbum(memberId, albumName) {
  autoAward(memberId, { kind: 'medalha', name: `${albumName} completo`, icon: 'medal', description: `Completou o ${albumName}.` });
  autoAward(memberId, { kind: 'trofeu', name: `Colecionador: ${albumName}`, icon: 'trophy', description: `Troféu por completar o ${albumName}.` });
}
