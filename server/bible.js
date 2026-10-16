// Ano Bíblico: texto (Almeida 1911 Atualizada Livre, licença MIT), plano de leitura por dia,
// quizzes e a voz (Piper), preparada versículo por versículo: primeiro o dia que alguém abriu,
// depois, em segundo plano, os próximos dias.
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

// ───────────── Voz (um arquivo por versículo) ─────────────
// Cada versículo vira um MP3 pequeno (com a pausa no fim). Quando alguém abre um dia, os versículos
// dele passam para a frente da fila; o celular toca um atrás do outro e já começa assim que os
// primeiros ficam prontos. Sem nada pedido, a fila vai preparando os próximos dias do plano.

export const VOICE_DIR = path.join(DATA_DIR, 'biblia-voz');
const MP3_KBPS = 24;
const PAUSE_TITLE = 0.7;
const PAUSE_VERSE = 0.35;
const pad = (n, k) => String(n).padStart(k, '0');
export const voiceName = (b, c, v) => `${pad(b + 1, 2)}-${pad(c, 3)}-${pad(v, 3)}`;
export const voiceFile = (name) => path.join(VOICE_DIR, `${name}.mp3`);
export const VOICE_RE = /^\d{2}-\d{3}-\d{3}$/;

const ready = new Set();
try { for (const f of fs.readdirSync(VOICE_DIR)) if (f.endsWith('.mp3')) ready.add(f.slice(0, -4)); } catch { /* ainda sem pasta */ }
export const voiceReady = (name) => ready.has(name);

/** O que é falado no dia, em ordem: o título de cada capítulo (v = 0) e os versículos. */
export function dayVoiceItems(day) {
  const d = PLAN.days[day - 1];
  if (!d) return [];
  return d.chapters.flatMap(([b, c, rg]) => [0, ...verseNumbers(b, c, rg)].map((v) => ({ name: voiceName(b, c, v), b, c, v })));
}
const textOf = ({ b, c, v }) => (v === 0 ? spokenTitle(b, c) : chapterText(b, c)[v - 1]);

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

/** Corta o silêncio do começo e do fim da frase falada (a pausa é posta depois, sempre igual). */
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

/** Fala um item (título ou versículo) e guarda o MP3. */
export async function generateVoice(item) {
  const { rate, pcms } = await piperSpeak([textOf(item)]);
  const pause = Buffer.alloc(Math.round(rate * (item.v === 0 ? PAUSE_TITLE : PAUSE_VERSE)) * 2);
  const mp3 = pcmToMp3(Buffer.concat([trim(pcms[0], rate), pause]), rate);
  fs.mkdirSync(VOICE_DIR, { recursive: true });
  const f = voiceFile(item.name);
  fs.writeFileSync(f + '.part', mp3);
  fs.renameSync(f + '.part', f);
  ready.add(item.name);
}

// Fila: os dias pedidos (na frente) e, quando ela esvazia, o próximo dia do plano ainda sem voz.
const queue = [];
const queued = new Map();
export const audioState = { running: false, done: 0, current: null, error: null, failing: false };
let fails = 0;
let failedAt = 0;
let bgDay = 0;

function enqueue(items, front) {
  const missing = items.filter((it) => !ready.has(it.name));
  for (const it of missing) {
    if (!queued.has(it.name)) { queued.set(it.name, it); if (!front) queue.push(it.name); }
  }
  if (front) {
    const set = new Set(missing.map((it) => it.name));
    const rest = queue.filter((n) => !set.has(n));
    queue.length = 0;
    queue.push(...missing.map((it) => it.name), ...rest);
  }
}

/** Próximo dia (a partir de hoje) que ainda tem versículo sem voz. */
function nextBackgroundDay() {
  const start = Math.min(Math.max(todayDay(), 1), TOTAL_DAYS);
  for (let k = 0; k < TOTAL_DAYS; k++) {
    const day = ((start - 1 + bgDay + k) % TOTAL_DAYS) + 1;
    if (dayVoiceItems(day).some((it) => !ready.has(it.name))) { bgDay = day - start + 1; return day; }
  }
  return 0;
}

let working = false;
let background = false;
async function work() {
  if (working) return;
  working = true;
  audioState.running = true;
  try {
    for (;;) {
      if (!queue.length) {
        const day = background ? nextBackgroundDay() : 0;
        if (!day) break;
        enqueue(dayVoiceItems(day), false);
        if (!queue.length) break;
      }
      const name = queue.shift();
      const item = queued.get(name);
      queued.delete(name);
      if (!item || ready.has(name)) continue;
      audioState.current = `${chapterTitle(item.b, item.c)}${item.v ? `:${item.v}` : ''}`;
      try {
        await generateVoice(item);
        audioState.done++;
        fails = 0;
        audioState.failing = false;
      } catch (e) {
        audioState.error = `${audioState.current}: ${e.message}`;
        console.error('[ano bíblico] voz:', audioState.error);
        if (++fails >= 3) {
          // A voz não está funcionando: avisa quem está lendo (usa a voz do aparelho) e tenta mais tarde.
          audioState.failing = true;
          failedAt = Date.now();
          queue.length = 0;
          queued.clear();
          break;
        }
      }
    }
  } finally {
    working = false;
    audioState.running = false;
    audioState.current = null;
  }
}

/** Alguém abriu o dia: os versículos dele vão para a frente da fila. Devolve como está a voz do dia. */
export function requestDayVoice(day) {
  if (audioState.failing && Date.now() - failedAt > 2 * 60_000) { audioState.failing = false; fails = 0; }
  const items = dayVoiceItems(day);
  if (!audioState.failing) {
    enqueue(items, true);
    work().catch(() => {});
  }
  return dayVoiceStatus(day, items);
}
export function dayVoiceStatus(day, items = dayVoiceItems(day)) {
  const bits = items.map((it) => (ready.has(it.name) ? '1' : '0')).join('');
  const done = bits.split('1').length - 1;
  return { total: items.length, done, ready: bits, failing: audioState.failing, error: audioState.failing ? audioState.error || piperError : null };
}

/** Em segundo plano (no ar): vai preparando os próximos dias, um versículo por vez. */
export async function startAudioGenerator() {
  background = true;
  if (audioState.failing) { audioState.failing = false; fails = 0; }
  await work();
  // parou (sem nada para fazer ou com erro): tenta de novo mais tarde
  setTimeout(() => startAudioGenerator().catch(() => {}), 30 * 60_000).unref();
}

export const audioStatus = () => {
  const total = PLAN.days.reduce((n, d) => n + dayVoiceItems(d.day).length, 0);
  const done = PLAN.days.reduce((n, d) => n + dayVoiceItems(d.day).filter((it) => ready.has(it.name)).length, 0);
  return { ...audioState, done, total, queue: queue.length, piperError };
};
