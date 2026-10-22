// Áudios gravados antes (scripts/gravar-audio.mjs) e guardados junto com o app, na pasta audio/.
// O servidor só entrega o arquivo pronto (nada de gerar voz aqui): toca na hora, sem carregar.
// Cada áudio tem um JSON com o "hash" do texto: se o texto mudar, o áudio antigo deixa de valer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioJobs } from './audioJobs.js';

export const AUDIO_ROOT = process.env.AUDIO_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'audio');
const jobs = new Map();
const hashes = (kind) => {
  if (!jobs.has(kind)) {
    try { jobs.set(kind, new Map(audioJobs(kind).map((j) => [j.id, j.hash]))); } catch { jobs.set(kind, new Map()); }
  }
  return jobs.get(kind);
};
const metaCache = new Map();

/** Áudio pronto de um dia/aula: { url, starts, duration } ou null (ainda sem áudio). */
export function audioOf(kind, id) {
  const key = `${kind}/${id}`;
  if (!metaCache.has(key)) {
    let meta = null;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(AUDIO_ROOT, kind, `${id}.json`), 'utf8'));
      if (m.hash === hashes(kind).get(id) && fs.existsSync(path.join(AUDIO_ROOT, kind, `${id}.mp3`))) {
        meta = { url: `/audio/${kind}/${id}.mp3?v=${m.hash}`, starts: m.starts, duration: m.duration };
      }
    } catch { /* sem áudio */ }
    metaCache.set(key, meta);
  }
  return metaCache.get(key);
}

/** Quantos áudios de cada tipo estão prontos (para o painel do admin). */
export function audioSummary() {
  return Object.fromEntries(['ano-biblico', 'meditacao', 'bom-lider'].map((k) => {
    const ids = [...hashes(k).keys()];
    return [k, { done: ids.filter((id) => audioOf(k, id)).length, total: ids.length }];
  }));
}
