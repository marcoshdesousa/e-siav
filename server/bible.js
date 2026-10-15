// Ano Bíblico: texto (Almeida 1911 Atualizada Livre, licença MIT), plano de leitura por dia,
// quizzes e o áudio de cada capítulo (gerado antes, em segundo plano, com a voz do Piper).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mp3Encoder } from '@breezystack/lamejs';
import { DATA_DIR } from './db.js';
import { setting } from './fees.js';
import { piperSpeak, lastError as piperError } from './piper.js';

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
const spokenTitle = (b, c) => (b === 18 ? `Salmo ${c}.` : `${spokenBook(BIBLE.books[b].name, b)}, capítulo ${c}.`);

export function chapterText(b, c) {
  return BIBLE.books[b]?.chapters[c - 1] || null;
}

// ───────────── Áudio ─────────────

export const AUDIO_DIR = path.join(DATA_DIR, 'biblia-audio');
const MP3_KBPS = 24;
const PAUSE_TITLE = 0.8;
const PAUSE_VERSE = 0.45;
/** Atraso do codificador MP3 no começo (o som começa um pouco depois do zero). */
const ENCODER_DELAY = 0.05;
const audioName = (b, c) => `${String(b + 1).padStart(2, '0')}-${String(c).padStart(3, '0')}`;
export const audioFiles = (b, c) => ({ mp3: path.join(AUDIO_DIR, audioName(b, c) + '.mp3'), json: path.join(AUDIO_DIR, audioName(b, c) + '.json') });
export const audioUrl = (b, c) => `/api/ano-biblico/audio/${audioName(b, c)}.mp3`;
export const hasAudio = (b, c) => fs.existsSync(audioFiles(b, c).json);
export function audioTimes(b, c) {
  try { return readJson(audioFiles(b, c).json); } catch { return null; }
}

function pcmToMp3(pcm, rate) {
  const samples = new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length - (pcm.length % 2)));
  const enc = new Mp3Encoder(1, rate, MP3_KBPS);
  const out = [];
  for (let i = 0; i < samples.length; i += 1152) {
    const b = enc.encodeBuffer(samples.subarray(i, i + 1152));
    if (b.length) out.push(Buffer.from(b.buffer, b.byteOffset, b.length));
  }
  const f = enc.flush();
  out.push(Buffer.from(f.buffer, f.byteOffset, f.length));
  return Buffer.concat(out);
}

/** Corta o silêncio do começo e do fim de cada frase falada (as pausas são postas depois, iguais). */
function trim(pcm, rate) {
  const n = Math.floor(pcm.length / 2);
  const win = Math.max(1, Math.floor(rate * 0.02));
  const loud = (s) => {
    let sum = 0;
    const e = Math.min(n, s + win);
    for (let i = s; i < e; i++) sum += Math.abs(pcm.readInt16LE(i * 2));
    return sum / Math.max(1, e - s) > 500;
  };
  let a = 0;
  while (a < n && !loud(a)) a += win;
  let z = n;
  while (z > a && !loud(Math.max(a, z - win))) z -= win;
  if (z <= a) return pcm;
  a = Math.max(0, a - win);
  z = Math.min(n, z + win * 2);
  return pcm.subarray(a * 2, z * 2);
}

/**
 * Gera o áudio de um capítulo: o título e cada versículo falados separadamente, emendados com
 * pausas. Guarda o MP3 e o momento exato em que cada versículo começa (para a marcação seguir a voz).
 */
export async function generateChapterAudio(b, c) {
  const verses = chapterText(b, c);
  if (!verses) throw new Error('capítulo não existe');
  const lines = [spokenTitle(b, c), ...verses];
  const { rate, pcms } = await piperSpeak(lines);
  const parts = [];
  const times = [];
  let at = 0;
  pcms.forEach((p, i) => {
    const t = trim(p, rate);
    if (i > 0) times.push(Math.round((at / rate + ENCODER_DELAY) * 100) / 100);
    parts.push(t);
    at += t.length / 2;
    const pause = Math.round(rate * (i === 0 ? PAUSE_TITLE : PAUSE_VERSE));
    parts.push(Buffer.alloc(pause * 2));
    at += pause;
  });
  const mp3 = pcmToMp3(Buffer.concat(parts), rate);
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const f = audioFiles(b, c);
  fs.writeFileSync(f.mp3 + '.part', mp3);
  fs.renameSync(f.mp3 + '.part', f.mp3);
  fs.writeFileSync(f.json, JSON.stringify({ times, duration: Math.round((at / rate) * 100) / 100, bytes: mp3.length }));
  return { times, bytes: mp3.length };
}

/** Ordem de preparo: a partir de hoje (o que vai ser lido primeiro), depois o resto. */
function chaptersInOrder() {
  const t = Math.min(Math.max(todayDay(), 1), TOTAL_DAYS);
  const order = [...PLAN.days.slice(t - 1), ...PLAN.days.slice(0, t - 1)];
  return order.flatMap((d) => d.chapters);
}

export const audioState = { running: false, done: 0, total: 0, current: null, error: null, startedAt: null };

/** Prepara, em segundo plano e um por vez, o áudio de todos os capítulos que ainda não têm. */
export async function startAudioGenerator() {
  if (audioState.running) return;
  audioState.running = true;
  audioState.startedAt = new Date().toISOString();
  try {
    const all = chaptersInOrder();
    audioState.total = all.length;
    audioState.done = all.filter(([b, c]) => hasAudio(b, c)).length;
    let fails = 0;
    for (const [b, c] of all) {
      if (hasAudio(b, c)) continue;
      audioState.current = chapterTitle(b, c);
      try {
        await generateChapterAudio(b, c);
        audioState.done++;
        fails = 0;
      } catch (e) {
        audioState.error = `${chapterTitle(b, c)}: ${e.message}`;
        console.error('[ano bíblico] áudio:', audioState.error);
        if (++fails >= 3) break; // a voz não está funcionando: tenta de novo mais tarde
      }
      await new Promise((r) => setTimeout(r, 200)); // respiro para o site
    }
  } finally {
    audioState.running = false;
    audioState.current = null;
  }
  if (audioState.done < audioState.total) setTimeout(() => startAudioGenerator(), 30 * 60_000).unref();
}

export const audioStatus = () => ({ ...audioState, piperError });
