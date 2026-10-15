// Voz da leitura: Piper (código aberto, grátis), rodando no próprio servidor, em português do Brasil.
// O programa e a voz são baixados uma vez para o disco (DATA_DIR/piper). O Piper fica ligado
// (um processo só, com a voz carregada) e fala uma frase de cada vez.
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DATA_DIR } from './db.js';

const PIPER_URL = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz';
/** Vozes em português do Brasil, da melhor para a mais simples (se a melhor não baixar, usa a próxima). */
const VOICES = [
  {
    id: 'pt_BR-faber-medium',
    files: [
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx',
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json',
    ],
  },
  { id: 'pt-br-edresson-low', tarball: 'https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-pt-br-edresson-low.tar.gz' },
];
/** Um pouco mais devagar que o normal: leitura pausada, fácil de acompanhar. */
const LENGTH_SCALE = process.env.PIPER_LENGTH_SCALE || '1.1';
const LINE_TIMEOUT_MS = 60_000;

export const piperDir = () => process.env.PIPER_DIR || path.join(DATA_DIR, 'piper');

async function download(url, to) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok || !res.body) throw new Error(`download ${res.status} ${url}`);
  const tmp = `${to}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  await rename(tmp, to);
}

function sh(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} saiu com ${code}: ${err}`))));
  });
}

/** Instala o programa e uma voz (só na primeira vez; depois fica no disco). */
async function installPiper(dir) {
  await mkdir(dir, { recursive: true });
  const bin = path.join(dir, 'piper', 'piper');
  if (!existsSync(bin)) {
    const tgz = path.join(dir, 'piper.tar.gz');
    await download(PIPER_URL, tgz);
    await sh('tar', ['xzf', tgz, '-C', dir]);
    await rm(tgz, { force: true });
    await chmod(bin, 0o755);
  }
  const errors = [];
  for (const v of VOICES) {
    const vdir = path.join(dir, 'voices', v.id);
    const model = path.join(vdir, `${v.id}.onnx`);
    if (existsSync(path.join(vdir, 'ok'))) return { bin, model, voice: v.id };
    try {
      await mkdir(vdir, { recursive: true });
      if (v.tarball) {
        const tgz = path.join(vdir, 'voice.tar.gz');
        await download(v.tarball, tgz);
        await sh('tar', ['xzf', tgz, '-C', vdir]);
        await rm(tgz, { force: true });
      } else {
        for (const url of v.files) await download(url, path.join(vdir, path.basename(url)));
      }
      if (!existsSync(model) || !existsSync(`${model}.json`)) throw new Error('arquivos da voz incompletos');
      await writeFile(path.join(vdir, 'ok'), new Date().toISOString());
      console.log(`[voz] Piper pronto com a voz ${v.id}`);
      return { bin, model, voice: v.id };
    } catch (e) {
      errors.push(`${v.id}: ${e.message}`);
    }
  }
  throw new Error(`nenhuma voz do Piper baixou: ${errors.join(' | ')}`);
}

let installing = null;
export function ensurePiper() {
  installing ??= installPiper(piperDir()).catch((e) => { installing = null; throw e; });
  return installing;
}

/** WAV (PCM 16 bits mono) → amostras e taxa. */
export function readWav(buf) {
  let rate = 22050;
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') rate = buf.readUInt32LE(off + 12);
    if (id === 'data') return { pcm: buf.subarray(off + 8, Math.min(buf.length, off + 8 + size)), rate };
    off += 8 + size + (size % 2);
  }
  throw new Error('WAV sem áudio');
}

// ───────────── Piper ligado (um processo só) ─────────────
let proc = null;
let starting = null;
const waiting = [];
export let lastError = null;

function stop(reason) {
  lastError = reason;
  const p = proc;
  proc = null;
  starting = null;
  for (const w of waiting.splice(0)) { clearTimeout(w.timer); w.reject(new Error(reason)); }
  p?.kill('SIGKILL');
}

async function start() {
  if (proc) return proc;
  starting ??= (async () => {
    const { bin, model } = await ensurePiper();
    const pdir = path.dirname(bin);
    const env = { ...process.env, LD_LIBRARY_PATH: [pdir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') };
    const args = ['--model', model, '--json-input', '--length_scale', LENGTH_SCALE, '--espeak_data', path.join(pdir, 'espeak-ng-data')];
    // nice: o site responde primeiro; stdbuf: o Piper avisa (uma linha) assim que cada frase fica pronta
    const tries = [['nice', ['-n', '15', 'stdbuf', '-oL', bin, ...args]], ['stdbuf', ['-oL', bin, ...args]], [bin, args]];
    let child = null;
    for (const [cmd, a] of tries) {
      const c = spawn(cmd, a, { env });
      const ok = await new Promise((res) => { c.once('error', () => res(false)); c.once('spawn', () => res(true)); });
      if (ok) { child = c; break; }
    }
    if (!child) throw new Error('não foi possível iniciar o Piper');
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        const k = waiting.findIndex((w) => w.file === line);
        if (k >= 0) { const [w] = waiting.splice(k, 1); clearTimeout(w.timer); w.resolve(); }
      }
    });
    let err = '';
    child.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    child.on('close', (code) => { if (proc === child) stop(`Piper parou (código ${code}): ${err.slice(-300)}`); });
    child.stdin.on('error', () => {});
    proc = child;
    return child;
  })().catch((e) => { starting = null; lastError = e.message; throw e; });
  return starting;
}

async function speakLine(text, file) {
  const p = await start();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => stop('Piper demorou demais numa frase; reiniciando'), LINE_TIMEOUT_MS);
    waiting.push({ file, resolve, reject, timer });
    p.stdin.write(JSON.stringify({ text, output_file: file }) + '\n');
  });
}

/** Fala cada linha separadamente e devolve o PCM de cada uma (uma linha = um versículo). */
export async function piperSpeak(lines) {
  const out = await mkdtemp(path.join(tmpdir(), 'voz-'));
  try {
    let rate = 22050;
    const pcms = [];
    for (const [i, line] of lines.entries()) {
      const file = path.join(out, `${i}.wav`);
      try { await speakLine(line, file); } catch { await speakLine(line, file); }
      const wav = readWav(await readFile(file));
      rate = wav.rate;
      pcms.push(Buffer.from(wav.pcm));
    }
    return { rate, pcms };
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

export function stopPiper() { if (proc) stop('parado'); }
