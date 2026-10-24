// Virada do ano (a partir de 1º de janeiro de 2027): o Ano Bíblico recomeça do zero (o dia 1,
// Gênesis, é 1º de março; até lá não tem leitura) e todos os rankings zeram (requisitos, estudos e mini-jogos). Os dias do ano anterior não ficam mais
// disponíveis. O Bom Líder, as especialidades, as classes, as figurinhas e as medalhas continuam.
// O que existia vai para tabelas de arquivo (com o ano), sem se perder.
import { all, get, run, tx } from './db.js';
import { setSetting } from './fees.js';
import { todayBR } from './bible.js';

const FIRST_YEAR = 2027;
const ARCHIVE = ['bible_progress', 'bible_points', 'game_scores'];

export function yearTurnover(today = todayBR()) {
  const year = Number(today.slice(0, 4));
  if (year < FIRST_YEAR) return false;
  const KEY = `virada-${year}`;
  if (get('SELECT 1 FROM app_flags WHERE key = ?', KEY)) return false;
  tx(() => {
    for (const t of ARCHIVE) {
      run(`CREATE TABLE IF NOT EXISTS ${t}_arquivo AS SELECT 0 AS ano, * FROM ${t} WHERE 0`);
      // Colunas novas da tabela também entram no arquivo.
      const cols = all(`PRAGMA table_info(${t})`).map((c) => c.name);
      const have = new Set(all(`PRAGMA table_info(${t}_arquivo)`).map((c) => c.name));
      for (const c of cols) if (!have.has(c)) run(`ALTER TABLE ${t}_arquivo ADD COLUMN ${c}`);
      run(`INSERT INTO ${t}_arquivo (ano, ${cols.join(', ')}) SELECT ?, ${cols.join(', ')} FROM ${t}`, year - 1);
      run(`DELETE FROM ${t}`);
    }
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
