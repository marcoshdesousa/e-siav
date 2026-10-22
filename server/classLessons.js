// Aulas em vídeo das classes (server/data/classes/<classe>/aula-NN.json). Os vídeos são gravados antes
// (scripts/gravar-video.mjs) e ficam na pasta video/<classe>/NN.mp4 com um JSON do "hash" dos slides:
// se a aula mudar, o vídeo antigo deixa de valer até ser gravado de novo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VIDEO_ROOT = process.env.VIDEO_DIR || path.join(HERE, '..', 'video');
const DATA = path.join(HERE, 'data', 'classes');

/** Classes regulares e agrupadas (só as que têm aulas ficam abertas). */
export const CLASSES = [
  { id: 'amigo', name: 'Amigo', age: 10, kind: 'regular' },
  { id: 'companheiro', name: 'Companheiro', age: 11, kind: 'regular' },
  { id: 'pesquisador', name: 'Pesquisador', age: 12, kind: 'regular' },
  { id: 'pioneiro', name: 'Pioneiro', age: 13, kind: 'regular' },
  { id: 'excursionista', name: 'Excursionista', age: 14, kind: 'regular' },
  { id: 'guia', name: 'Guia', age: 15, kind: 'regular' },
  { id: 'agrupada-1', name: 'Amigo e Companheiro', kind: 'agrupada' },
  { id: 'agrupada-2', name: 'Pesquisador e Pioneiro', kind: 'agrupada' },
  { id: 'agrupada-3', name: 'Excursionista e Guia', kind: 'agrupada' },
];

/** Hash do que muda o vídeo: os slides e as narrações. */
export const videoHash = (aula) => crypto.createHash('sha1').update(JSON.stringify(aula.slides)).digest('hex').slice(0, 12);

const cache = new Map();
/** Aulas de uma classe, em ordem (lista vazia se ainda não tem). */
export function lessonsOf(classe) {
  if (!cache.has(classe)) {
    let list = [];
    try {
      const dir = path.join(DATA, classe);
      list = fs.readdirSync(dir).filter((f) => /^aula-\d+\.json$/.test(f)).sort()
        .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    } catch { /* sem aulas */ }
    cache.set(classe, list);
  }
  return cache.get(classe);
}

const videoCache = new Map();
/** Vídeo pronto de uma aula: { url, duration, starts } ou null. */
export function videoOf(classe, aula) {
  const id = String(aula.n).padStart(2, '0');
  const key = `${classe}/${id}`;
  if (!videoCache.has(key)) {
    let v = null;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(VIDEO_ROOT, classe, `${id}.json`), 'utf8'));
      if (m.hash === videoHash(aula) && fs.existsSync(path.join(VIDEO_ROOT, classe, `${id}.mp4`))) {
        v = { url: `/video/${classe}/${id}.mp4?v=${m.hash}`, poster: fs.existsSync(path.join(VIDEO_ROOT, classe, `${id}.jpg`)) ? `/video/${classe}/${id}.jpg?v=${m.hash}` : null, duration: m.duration, starts: m.starts };
      }
    } catch { /* sem vídeo */ }
    videoCache.set(key, v);
  }
  return videoCache.get(key);
}
