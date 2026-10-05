// Catálogo de classes e especialidades dos Desbravadores.
// Classes e especialidades não são vendidas nem feitas online: o membro informa
// as que já tem e a diretoria do clube aprova. As classes são sincronizadas ao
// iniciar o servidor; as especialidades são cadastradas pelo administrador
// (uma a uma, com foto) dentro das áreas oficiais abaixo.
import { all, get, run } from './db.js';

export const CLASSES = [
  // Classes regulares (idade) e avançadas
  ['Amigo', 10, 0, 'compass'], ['Amigo da Natureza', 10, 0, 'leaf'],
  ['Companheiro', 11, 0, 'handshake'], ['Companheiro de Excursionismo', 11, 0, 'boots'],
  ['Pesquisador', 12, 0, 'search'], ['Pesquisador de Campo e Bosque', 12, 0, 'trees'],
  ['Pioneiro', 13, 0, 'tent'], ['Pioneiro de Novas Fronteiras', 13, 0, 'map'],
  ['Excursionista', 14, 0, 'boots'], ['Excursionista na Mata', 14, 0, 'trees'],
  ['Guia', 15, 0, 'map'], ['Guia de Exploração', 15, 0, 'compass'],
  // Classes de liderança
  ['Líder', null, 1, 'award'], ['Líder Master', null, 1, 'medal'], ['Líder Master Avançado', null, 1, 'trophy'],
];

/** Áreas oficiais das especialidades (Manual de Especialidades). */
export const AREAS = [
  'ADRA', 'Artes e Habilidades Manuais', 'Atividades Agrícolas', 'Atividades Missionárias e Comunitárias', 'Atividades Profissionais',
  'Atividades Recreativas', 'Ciência e Saúde', 'Ensinos Bíblicos', 'Estudo da Natureza', 'Habilidades Domésticas', 'Mestrados',
];

const AREA_ICON = {
  ADRA: 'handshake',
  'Ensinos Bíblicos': 'book',
  Mestrados: 'crown',
  'Artes e Habilidades Manuais': 'music',
  'Atividades Agrícolas': 'leaf',
  'Atividades Missionárias e Comunitárias': 'users',
  'Atividades Profissionais': 'target',
  'Atividades Recreativas': 'tent',
  'Ciência e Saúde': 'health',
  'Estudo da Natureza': 'trees',
  'Habilidades Domésticas': 'flame',
};

/** Especialidades usadas só nos dados de exemplo (SEED_DEMO=1). */
export const DEMO_SPECIALTIES = {
  'Artes e Habilidades Manuais': ['Arte de Contar Histórias Cristãs', 'Caligrafia', 'Cerâmica', 'Cestaria', 'Crochê', 'Desenho e Pintura', 'Escultura', 'Fotografia', 'Marcenaria', 'Música', 'Tricô'],
  'Atividades Agrícolas': ['Agricultura', 'Apicultura', 'Avicultura', 'Fruticultura', 'Horticultura', 'Jardinagem'],
  'Atividades Missionárias e Comunitárias': ['Cidadania Cristã', 'Evangelismo Pessoal', 'Liderança Juvenil', 'Serviço Comunitário', 'Temperança', 'Testemunho Juvenil', 'Vida Familiar'],
  'Atividades Profissionais': ['Carpintaria', 'Contabilidade', 'Eletricidade', 'Informática', 'Mecânica Automotiva', 'Radioamadorismo'],
  'Atividades Recreativas': ['Acampamento I', 'Acampamento II', 'Acampamento III', 'Acampamento IV', 'Canoagem', 'Ciclismo', 'Escalada', 'Excursionismo Pedestre com Mochila', 'Fogueiras e Cozinha ao Ar Livre', 'Natação Principiante I', 'Natação Principiante II', 'Nós e Amarras', 'Ordem Unida', 'Orientação', 'Pioneiria'],
  'Ciência e Saúde': ['Nutrição', 'Primeiros Socorros', 'Primeiros Socorros Básico', 'Química'],
  'Estudo da Natureza': ['Árvores', 'Astronomia', 'Aves', 'Cactos', 'Cães', 'Climatologia', 'Ecologia', 'Flores', 'Fungos', 'Gatos', 'Insetos', 'Mamíferos', 'Répteis', 'Rochas e Minerais', 'Samambaias', 'Sementes'],
  'Habilidades Domésticas': ['Costura', 'Culinária', 'Lavanderia', 'Panificação'],
};

export const iconForArea = (area) => AREA_ICON[area] || 'award';

/**
 * Garante que as classes existem no banco (inclui o que faltar).
 * demo: também inclui as especialidades de exemplo.
 */
export function syncCatalog({ demo = false } = {}) {
  for (const [name, age, leader, icon] of CLASSES) {
    if (!get(`SELECT 1 FROM content WHERE type = 'classe' AND name = ?`, name)) {
      run(`INSERT INTO content (type, name, icon, age, leader, is_free, price_cents) VALUES ('classe', ?, ?, ?, ?, 1, 0)`, name, icon, age, leader);
    }
  }
  for (const [area, names] of Object.entries(demo ? DEMO_SPECIALTIES : {})) {
    for (const name of names) {
      if (!get(`SELECT 1 FROM content WHERE type = 'especialidade' AND name = ?`, name)) {
        run(`INSERT INTO content (type, name, icon, category, is_free, price_cents) VALUES ('especialidade', ?, ?, ?, 1, 0)`, name, iconForArea(area), area);
      }
    }
  }
  // Classes e especialidades nunca são pagas.
  run(`UPDATE content SET is_free = 1, price_cents = 0 WHERE type IN ('classe','especialidade')`);
  if (demo) setFlag('specialties-cleanup');
  else removeOldSpecialties();
}

const hasFlag = (key) => !!get('SELECT 1 FROM app_flags WHERE key = ?', key);
const setFlag = (key) => run('INSERT OR IGNORE INTO app_flags (key) VALUES (?)', key);

/**
 * Uma única vez: tira as especialidades que o app cadastrava sozinho, para o
 * administrador cadastrar as oficiais manualmente. Não mexe nas que alguém já tem
 * no perfil ou pediu, nem nas que forem cadastradas depois.
 */
function removeOldSpecialties() {
  if (hasFlag('specialties-cleanup')) return;
  const names = new Set(Object.values(DEMO_SPECIALTIES).flat());
  for (const c of all(`SELECT id, name FROM content WHERE type = 'especialidade'`)) {
    if (!names.has(c.name)) continue;
    if (get('SELECT 1 FROM achievements WHERE content_id = ? UNION ALL SELECT 1 FROM achievement_requests WHERE content_id = ?', c.id, c.id)) continue;
    run('DELETE FROM content WHERE id = ?', c.id);
  }
  setFlag('specialties-cleanup');
}

export const catalog = (type) =>
  all(`SELECT id, type, code, name, icon, image, category, age, leader FROM content WHERE type = ? ORDER BY ${type === 'classe' ? 'leader, age IS NULL, age, name' : 'category, name'}`, type);

/** Nome "normalizado" para comparar (sem acento, minúsculo, só letras e números). */
export const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Importa uma lista colada (uma por linha): "código; nome; área" ou "nome; área".
 * Aceita ; ou tab ou | como separador. Atualiza as que já existem pelo nome.
 */
export function importSpecialties(text) {
  let created = 0, updated = 0, skipped = 0;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\s*[;\t|]\s*/).map((x) => x.trim()).filter(Boolean);
    let code = null, name, area;
    if (parts.length >= 3) [code, name, area] = parts;
    else if (parts.length === 2) [name, area] = parts;
    else { skipped++; continue; }
    if (!name || name.length > 100) { skipped++; continue; }
    area = AREAS.find((a) => norm(a) === norm(area)) || area?.slice(0, 60) || 'Outras';
    const ex = all(`SELECT id, name FROM content WHERE type = 'especialidade'`).find((c) => norm(c.name) === norm(name));
    if (ex) {
      run('UPDATE content SET category = ?, code = COALESCE(?, code), icon = ? WHERE id = ?', area, code, iconForArea(area), ex.id);
      updated++;
    } else {
      run(`INSERT INTO content (type, code, name, icon, category, is_free, price_cents) VALUES ('especialidade', ?, ?, ?, ?, 1, 0)`, code, name, iconForArea(area), area);
      created++;
    }
  }
  return { created, updated, skipped };
}
