// Ano Bíblico: texto (Almeida 1911 Atualizada Livre, licença MIT), plano de leitura por dia,
// quizzes. O áudio de cada dia vem gravado (server/audio.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setSetting, setting } from './fees.js';
import { get, run } from './db.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'data');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

export const BIBLE = readJson(path.join(DATA, 'biblia-jfaal.json'));
export const PLAN = readJson(path.join(DATA, 'ano-biblico-2027.json'));
export const TOTAL_DAYS = PLAN.days.length;

/** Quizzes (5 perguntas por dia), juntados dos arquivos da pasta. */
function loadQuizzes() {
  const dir = path.join(DATA, 'quiz-ano-biblico');
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    try {
      for (const d of readJson(path.join(dir, f))) {
        const qs = (d.questions || []).filter((q) => q?.q && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
        if (qs.length >= 5) map.set(d.day, qs.slice(0, 5));
      }
    } catch (e) {
      console.error(`[ano bíblico] quiz ${f} com erro:`, e.message);
    }
  }
  return map;
}
export const QUIZZES = loadQuizzes();

// ───────────── Datas ─────────────

/** Hoje no horário de Brasília (AAAA-MM-DD). */
export function todayBR(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diffDays = (a, b) => Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 86400000);

/** Início do plano: 1/3/2027. O admin pode mudar (por exemplo, para testar antes). */
export const planStart = () => setting('ano_biblico_inicio') || PLAN.start;
/**
 * Uma vez (pedido do dono do app): o Ano Bíblico segue o calendário, de 1º de março (Gênesis) a
 * 30 de novembro (Apocalipse) do ano atual. Hoje é o dia do calendário; os dias antes ficam atrasados.
 */
export function bibleStartTodayOnce({ justSeeded = false } = {}) {
  const KEY = 'ano-biblico-1-marco-v1';
  if (get('SELECT 1 FROM app_flags WHERE key = ?', KEY)) return;
  if (!justSeeded) setSetting('ano_biblico_inicio', `${todayBR().slice(0, 4)}-03-01`);
  run('INSERT OR IGNORE INTO app_flags (key) VALUES (?)', KEY);
}

/** Data do dia N do plano. */
export const dateOfDay = (n) => addDays(planStart(), n - 1);
/** Dia do plano que é hoje (0 = ainda não começou; > TOTAL = já terminou). */
export const todayDay = (today = todayBR()) => diffDays(today, planStart()) + 1;

// ───────────── Texto ─────────────

const ORD = { 1: ['Primeiro', 'Primeira'], 2: ['Segundo', 'Segunda'], 3: ['Terceiro', 'Terceira'] };
/** Nome do livro para falar: "1ª Samuel" → "Primeiro Samuel"; cartas: "Primeira Coríntios". */
export function spokenBook(name, bookIdx) {
  const m = name.match(/^(\d)ª (.+)$/);
  if (!m) return name;
  return `${ORD[m[1]][bookIdx >= 39 ? 1 : 0]} ${m[2]}`;
}
export const chapterTitle = (b, c) => (b === 18 ? `Salmo ${c}` : `${BIBLE.books[b].name} ${c}`);
/** Trechos: [[1, 19]] → "1–19"; [[2, 3], [17, 18]] → "2–3, 17–18" */
export const rangesLabel = (rg) => rg.map(([a, z]) => (a === z ? a : `${a}–${z}`)).join(', ');
/** Números dos versículos lidos no dia (capítulo inteiro ou só os trechos). */
export function verseNumbers(b, c, rg) {
  const n = chapterText(b, c)?.length || 0;
  const all = Array.from({ length: n }, (_, i) => i + 1);
  return rg ? all.filter((v) => rg.some(([a, z]) => v >= a && v <= z)) : all;
}
const spokenTitle = (b, c) => (b === 18 ? `Salmo ${c}.` : `${spokenBook(BIBLE.books[b].name, b)}, capítulo ${c}.`);

export function chapterText(b, c) {
  return BIBLE.books[b]?.chapters[c - 1] || null;
}
