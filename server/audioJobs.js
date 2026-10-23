// O que cada áudio gravado fala, em ordem (um "trecho" por versículo ou parágrafo). Usado pelo
// gravador (scripts/gravar-audio.mjs) e pelo servidor, que confere se o áudio bate com o texto (hash).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const hashOf = (segs) => crypto.createHash('sha1').update(segs.map((s) => s.text).join('\n')).digest('hex').slice(0, 12);
const pad = (n, k = 3) => String(n).padStart(k, '0');

const ORD = { 1: ['Primeiro', 'Primeira'], 2: ['Segundo', 'Segunda'], 3: ['Terceiro', 'Terceira'] };
export function spokenBook(name, bookIdx) {
  const m = name.match(/^(\d)ª (.+)$/);
  return m ? `${ORD[m[1]][bookIdx >= 39 ? 1 : 0]} ${m[2]}` : name;
}
const rangesSpoken = (rg) => rg.map(([a, z]) => (a === z ? `${a}` : `${a} a ${z}`)).join(' e ');

/** Ano Bíblico: por capítulo, o título e depois cada versículo do dia. */
export function bibleDaySegments(BIBLE, d) {
  const out = [];
  for (const [b, c, rg] of d.chapters) {
    const verses = BIBLE.books[b].chapters[c - 1];
    const book = b === 18 ? 'Salmo' : `${spokenBook(BIBLE.books[b].name, b)}, capítulo`;
    out.push({ text: `${book} ${c}${rg ? `, versículos ${rangesSpoken(rg)}` : ''}.`, pause: 0.8 });
    verses.forEach((v, i) => { if (!rg || rg.some(([a, z]) => i + 1 >= a && i + 1 <= z)) out.push({ text: v, pause: 0.45 }); });
  }
  return out;
}

/** Meditação: título, versículo, parágrafos e a oração. */
export function meditationSegments(m) {
  return [
    { text: `${m.title}.`, pause: 0.8 },
    { text: m.verse.replace(/\(([^)]+)\)\s*$/, '. $1.'), pause: 0.8 },
    ...m.text.map((p) => ({ text: p, pause: 0.6 })),
    ...(m.prayer ? [{ text: `Oração: ${m.prayer}`, pause: 0.6 }] : []),
  ];
}

/** Bom Líder: abertura, versículo, parágrafos e atividade (mesma ordem das páginas). */
export function lessonSegments(n, l) {
  return [
    { text: `Aula ${n}. ${l.title}.${l.objective ? ` Objetivo: ${l.objective}` : ''}`, pause: 0.8 },
    ...(l.verse ? [{ text: l.verse.replace(/\(([^)]+)\)\s*$/, '. $1.'), pause: 0.8 }] : []),
    ...(l.content || []).map((p) => ({ text: p, pause: 0.6 })),
    ...(l.activity ? [{ text: `Atividade: ${l.activity}`, pause: 0.6 }] : []),
  ];
}

const loadDir = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().flatMap((f) => readJson(path.join(dir, f))) : []);

/** Todos os áudios de um tipo: [{ id, hash, segments }]. */
export function audioJobs(kind) {
  if (kind === 'ano-biblico') {
    const BIBLE = readJson(path.join(DATA, 'biblia-jfaal.json'));
    return readJson(path.join(DATA, 'ano-biblico-2027.json')).days.map((d) => {
      const segments = bibleDaySegments(BIBLE, d);
      return { id: pad(d.day), hash: hashOf(segments), segments };
    });
  }
  if (kind === 'meditacao') {
    // Um dia pode aparecer em mais de um arquivo: vale o último (o mesmo que o servidor usa).
    const byDate = new Map(loadDir(path.join(DATA, 'meditacao')).map((m) => [m.date, m]));
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((m) => {
      const segments = meditationSegments(m);
      return { id: m.date, hash: hashOf(segments), segments };
    });
  }
  if (kind === 'bom-lider') {
    return loadDir(path.join(DATA, 'bom-lider')).sort((a, b) => a.n - b.n).map((l) => {
      const segments = lessonSegments(l.n, l);
      return { id: pad(l.n, 2), hash: hashOf(segments), segments };
    });
  }
  if (kind === 'escola-sabatina') {
    // Lições da Escola Sabatina: o texto de cada dia fica em content/escola-sabatina/<trimestre>/texto.json.
    const dir = path.join(DATA, '..', '..', 'content', 'escola-sabatina');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).sort().flatMap((key) => {
      const f = path.join(dir, key, 'texto.json');
      if (!fs.existsSync(f)) return [];
      return Object.entries(readJson(f)).sort(([a], [b]) => a.localeCompare(b)).map(([date, segs]) => {
        const segments = segs.map((text, i) => ({ text, pause: i === 0 ? 0.8 : 0.6 }));
        return { id: `${key}_${date}`, hash: hashOf(segments), segments };
      });
    });
  }
  throw new Error('tipo de áudio desconhecido: ' + kind);
}
export const segmentHash = hashOf;
