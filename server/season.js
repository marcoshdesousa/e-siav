// Virada do ano (a partir de 1º de janeiro de 2027): o Ano Bíblico recomeça do zero (o dia 1,
// Gênesis, é 1º de março; até lá não tem leitura) e todos os rankings zeram (requisitos, estudos e mini-jogos). Os dias do ano anterior não ficam mais
// disponíveis. O Bom Líder, as especialidades, as classes, as figurinhas e as medalhas continuam.
// O que existia vai para tabelas de arquivo (com o ano), sem se perder.
import { all, get, run, tx } from './db.js';
import { setSetting } from './fees.js';
import { todayBR } from './bible.js';

// Chaves de dia dos outros estudos em bible_points (Meditação, Escola Sabatina) começam aqui.
const STUDY_KEYS_FROM = 100_000_000;

const FIRST_YEAR = 2027;
const ARCHIVE = ['bible_progress', 'bible_points', 'game_scores'];

/** Guarda as linhas (todas ou só as do filtro) na tabela de arquivo, com o ano, e tira da tabela. */
export function archiveRows(table, ano, where = '1 = 1') {
  run(`CREATE TABLE IF NOT EXISTS ${table}_arquivo AS SELECT 0 AS ano, * FROM ${table} WHERE 0`);
  // Colunas novas da tabela também entram no arquivo.
  const cols = all(`PRAGMA table_info(${table})`).map((c) => c.name);
  const have = new Set(all(`PRAGMA table_info(${table}_arquivo)`).map((c) => c.name));
  for (const c of cols) if (!have.has(c)) run(`ALTER TABLE ${table}_arquivo ADD COLUMN ${c}`);
  run(`INSERT INTO ${table}_arquivo (ano, ${cols.join(', ')}) SELECT ?, ${cols.join(', ')} FROM ${table} WHERE ${where}`, ano);
  run(`DELETE FROM ${table} WHERE ${where}`);
}

export function yearTurnover(today = todayBR()) {
  const year = Number(today.slice(0, 4));
  if (year < FIRST_YEAR) return false;
  const KEY = `virada-${year}`;
  if (get('SELECT 1 FROM app_flags WHERE key = ?', KEY)) return false;
  tx(() => {
    for (const t of ARCHIVE) archiveRows(t, year - 1);
    setSetting('ano_biblico_inicio', `${year}-03-01`);
    // Meia-noite de Brasília (UTC-3).
    setSetting('ranking_inicio', `${year}-01-01T03:00:00.000Z`);
    setSetting('ranking_pausa', '');
    run('INSERT OR IGNORE INTO app_flags (key) VALUES (?)', KEY);
  });
  console.log(`Virada de ${year}: Ano Bíblico recomeçou e os rankings zeraram.`);
  return true;
}

/** Confere na inicialização e depois a cada 10 minutos (o servidor fica ligado na virada). */
export function startYearWatch() {
  yearTurnover();
  setInterval(() => { try { yearTurnover(); } catch (e) { console.error('virada do ano', e); } }, 10 * 60e3).unref();
}

/**
 * Uma vez (pedido do dono do app): o Ano Bíblico, o Bom Líder e o Bom de Bíblia recomeçam do zero
 * para todo mundo. O que foi feito vai para o arquivo (não se perde). O Ano Bíblico só começa em
 * 1º de março de 2027 e o Bom Líder em 1º de janeiro de 2027; até lá ficam trancados.
 * Com os dados de exemplo recém-criados (SEED_DEMO=1), só marca como feito.
 */
export function resetStudiesOnce({ justSeeded = false } = {}) {
  const KEY = 'estudos-zerados-2027-v1';
  if (get('SELECT 1 FROM app_flags WHERE key = ?', KEY)) return false;
  tx(() => {
    if (!justSeeded) {
      const ano = Number(todayBR().slice(0, 4));
      archiveRows('bible_progress', ano);
      // Só os pontos dos dias do Ano Bíblico (os da Meditação, da Escola Sabatina e do app continuam).
      archiveRows('bible_points', ano, `kind = 'estudo' AND day < ${STUDY_KEYS_FROM}`);
      for (const t of ['bom_lider_progress', 'bdb_progress']) {
        if (get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", t)) archiveRows(t, ano);
      }
      setSetting('ano_biblico_inicio', '2027-03-01');
      setSetting('bom_lider_inicio', '2027-01-01');
    }
    run('INSERT OR IGNORE INTO app_flags (key) VALUES (?)', KEY);
  });
  if (!justSeeded) console.log('Ano Bíblico, Bom Líder e Bom de Bíblia recomeçaram do zero (abrem em 2027).');
  return true;
}
