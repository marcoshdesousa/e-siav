// Grava os áudios (voz Piper "faber", pt-BR) FORA do servidor: um MP3 por dia/aula e um JSON com o
// momento em que cada trecho começa (para marcar o versículo/parágrafo que está sendo lido).
// Uso: node scripts/gravar-audio.mjs <ano-biblico|meditacao|bom-lider> <pasta-saida> [paralelo=4]
// Precisa de: PIPER_BIN (programa piper), PIPER_MODEL (.onnx da voz), ffmpeg.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { audioJobs } from '../server/audioJobs.js';

const [kind, outDir, par = '4'] = process.argv.slice(2);
const BIN = process.env.PIPER_BIN;
const MODEL = process.env.PIPER_MODEL;
if (!kind || !outDir || !BIN || !MODEL) { console.error('uso: PIPER_BIN=.. PIPER_MODEL=.. node scripts/gravar-audio.mjs <tipo> <saida> [paralelo]'); process.exit(1); }
const ESPEAK = process.env.PIPER_ESPEAK || path.join(path.dirname(BIN), 'espeak-ng-data');
const KBPS = process.env.MP3_KBPS || '24';

function readWav(buf) {
  let rate = 22050; let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4); const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') rate = buf.readUInt32LE(off + 12);
    if (id === 'data') return { pcm: buf.subarray(off + 8, Math.min(buf.length, off + 8 + size)), rate };
    off += 8 + size + (size % 2);
  }
  throw new Error('WAV sem áudio');
}
/** Corta o silêncio do começo e do fim (a pausa entre os trechos é posta depois, sempre igual). */
function trim(pcm, rate) {
  const n = Math.floor(pcm.length / 2); const win = Math.max(1, Math.floor(rate * 0.02));
  const loud = (s) => { let sum = 0; const e = Math.min(n, s + win); for (let i = s; i < e; i++) sum += Math.abs(pcm.readInt16LE(i * 2)); return sum / Math.max(1, e - s) > 500; };
  let a = 0; while (a < n && !loud(a)) a += win;
  let z = n; while (z > a && !loud(Math.max(a, z - win))) z -= win;
  if (z <= a) return pcm;
  return pcm.subarray(Math.max(0, a - win) * 2, Math.min(n, z + win * 2) * 2);
}
function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, LD_LIBRARY_PATH: path.dirname(BIN) }, stdio: ['pipe', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', (d) => { err = (err + d).slice(-1500); });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} ${c}: ${err}`))));
    if (input) p.stdin.end(input); else p.stdin.end();
  });
}

async function record(job) {
  const mp3 = path.join(outDir, `${job.id}.mp3`);
  const meta = path.join(outDir, `${job.id}.json`);
  if (fs.existsSync(mp3) && fs.existsSync(meta) && JSON.parse(fs.readFileSync(meta, 'utf8')).hash === job.hash) return 'ok';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grav-'));
  try {
    const lines = job.segments.map((s, i) => JSON.stringify({ text: s.text, output_file: path.join(tmp, `${i}.wav`) })).join('\n') + '\n';
    await run(BIN, ['--model', MODEL, '--json-input', '--espeak_data', ESPEAK, '--length_scale', '1.0', '--sentence_silence', '0.15'], lines);
    let rate = 22050; const parts = []; const starts = []; let at = 0;
    job.segments.forEach((s, i) => {
      const w = readWav(fs.readFileSync(path.join(tmp, `${i}.wav`))); rate = w.rate;
      const t = trim(w.pcm, rate);
      starts.push(Math.round((at / rate) * 100) / 100);
      parts.push(t); at += t.length / 2;
      const pause = Math.round(rate * (s.pause ?? 0.4)); parts.push(Buffer.alloc(pause * 2)); at += pause;
    });
    const raw = path.join(tmp, 'all.raw'); fs.writeFileSync(raw, Buffer.concat(parts));
    await run('ffmpeg', ['-loglevel', 'error', '-y', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw, '-c:a', 'libmp3lame', '-b:a', `${KBPS}k`, mp3 + '.part.mp3']);
    fs.renameSync(mp3 + '.part.mp3', mp3);
    fs.writeFileSync(meta, JSON.stringify({ hash: job.hash, duration: Math.round((at / rate) * 100) / 100, starts }));
    return 'novo';
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

fs.mkdirSync(outDir, { recursive: true });
const jobs = audioJobs(kind).filter((j) => !process.env.ONLY || process.env.ONLY.split(',').includes(j.id));
let next = 0; let done = 0; const t0 = Date.now();
await Promise.all(Array.from({ length: Number(par) }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    try { await record(job); } catch (e) { console.error(`[${job.id}] ${e.message}`); }
    done++;
    if (done % 10 === 0 || done === jobs.length) console.log(`${kind}: ${done}/${jobs.length} em ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}));
