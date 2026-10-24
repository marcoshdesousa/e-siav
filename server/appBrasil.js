// Clube App Brasil: quem cria a conta pelo app (sem o link de um clube) entra aqui, na
// "Unidade App" (desbravadores) ou na "Unidade App Liderança" (16 anos ou mais).
// O distrito e o clube ficam escondidos: não aparecem nas listas, não abrem perfil e não
// disputam o ranking de clubes, de unidades nem de distrito. Os membros só disputam o ranking Brasil.
// Para usar o app é preciso uma assinatura (R$ 3,90 ou o DBV+ de R$ 7,90): evita contas falsas.
import { get, run, tx } from './db.js';

export const APP = { district: 'App Brasil', club: 'Clube App Brasil', unit: 'Unidade App', leaders: 'Unidade App Liderança', logo: '/marca/logo.png' };

/** Cria (uma vez) o distrito, o clube e as duas unidades do App Brasil. */
export function ensureAppClub() {
  tx(() => {
    let d = get('SELECT id FROM districts WHERE is_app = 1');
    if (!d) {
      const name = get('SELECT 1 FROM districts WHERE name = ?', APP.district) ? APP.district + ' (app)' : APP.district;
      d = { id: Number(run('INSERT INTO districts (name, is_app) VALUES (?, 1)', name).lastInsertRowid) };
    }
    let c = get('SELECT id FROM clubs WHERE is_app = 1');
    if (!c) c = { id: Number(run('INSERT INTO clubs (district_id, name, logo, number, is_app) VALUES (?, ?, ?, 0, 1)', d.id, APP.club, APP.logo).lastInsertRowid) };
    run('UPDATE clubs SET district_id = ? WHERE id = ?', d.id, c.id);
    if (!get('SELECT 1 FROM units WHERE club_id = ? AND is_leadership = 0', c.id)) run('INSERT INTO units (club_id, name, logo, is_leadership, number) VALUES (?, ?, ?, 0, 1)', c.id, APP.unit, APP.logo);
    if (!get('SELECT 1 FROM units WHERE club_id = ? AND is_leadership = 1', c.id)) run('INSERT INTO units (club_id, name, logo, is_leadership) VALUES (?, ?, ?, 1)', c.id, APP.leaders, APP.logo);
  });
}

export const appClub = () => get('SELECT id, district_id FROM clubs WHERE is_app = 1');
export const isAppClub = (clubId) => !!get('SELECT 1 FROM clubs WHERE id = ? AND is_app = 1', clubId);
/** Unidade de quem entra pelo app: desbravador ou liderança. */
export const appUnit = (clubId, leadership) => get('SELECT id FROM units WHERE club_id = ? AND is_leadership = ?', clubId, leadership ? 1 : 0)?.id || null;
