// Grava as aulas em vídeo das classes FORA do servidor: cada slide vira uma imagem (Chromium) e a
// narração vem da voz Piper "faber" (pt-BR). Sai um MP4 vertical por aula e um JSON com o momento
// em que cada slide começa.
// Uso: node scripts/gravar-video.mjs <classe> <pasta-saida> [paralelo=2]
// Precisa de: PIPER_BIN, PIPER_MODEL, ffmpeg e Chromium (CHROMIUM_PATH ou o do Playwright).
// Opcional: FONTS_CSS (CSS com @font-face de Poppins e Nunito; os caminhos relativos a ele).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { videoHash } from '../server/classLessons.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [classe, outDir, par = '2'] = process.argv.slice(2);
const BIN = process.env.PIPER_BIN;
const MODEL = process.env.PIPER_MODEL;
if (!classe || !outDir || !BIN || !MODEL) { console.error('uso: PIPER_BIN=.. PIPER_MODEL=.. node scripts/gravar-video.mjs <classe> <saida> [paralelo]'); process.exit(1); }
const ESPEAK = process.env.PIPER_ESPEAK || path.join(path.dirname(BIN), 'espeak-ng-data');
const W = 720, H = 1280;
const DATA = path.join(ROOT, 'server', 'data', 'classes', classe);
const NOME = { guia: 'Guia', amigo: 'Amigo', companheiro: 'Companheiro', pesquisador: 'Pesquisador', pioneiro: 'Pioneiro', excursionista: 'Excursionista' }[classe] || classe;

// ---------- Ícones (lucide) ----------
const ICONS = path.join(ROOT, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons');
const iconCache = {};
async function icon(name, size = 28) {
  if (!iconCache[name]) {
    let file = path.join(ICONS, name + '.mjs');
    let mod = await import(pathToFileURL(file));
    while (!mod.__iconData) { file = path.join(ICONS, fs.readFileSync(file, 'utf8').match(/from '\.\/([^']+\.mjs)'/)[1]); mod = await import(pathToFileURL(file)); }
    iconCache[name] = mod.__iconData.node.map(([t, a]) => `<${t} ${Object.entries(a).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${iconCache[name]}</svg>`;
}
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- Slides ----------
const CSS = `
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:'Nunito',system-ui,sans-serif;color:#fff;background:#0B2259;position:relative}
h1,h2,b.t{font-family:'Poppins','Nunito',sans-serif;letter-spacing:-.01em}
.bg{position:absolute;inset:0;background:radial-gradient(circle at 85% 8%,rgba(249,199,29,.30),transparent 38%),radial-gradient(circle at 0% 100%,rgba(233,42,47,.32),transparent 42%),linear-gradient(165deg,#0B2259,#14347E 55%,#0E2A6B)}
.stripe{position:absolute;top:0;left:0;right:0;height:10px;background:linear-gradient(90deg,#0E2A6B 0 60%,#E92A2F 60% 80%,#F9C71D 80%)}
.top{position:absolute;top:44px;left:44px;right:44px;display:flex;align-items:center;gap:14px}
.top img{width:52px;height:52px}
.top div{line-height:1.1}.top small{display:block;color:#fde68a;font-weight:800;font-size:19px}.top b{font-family:'Poppins';font-size:24px}
.sec{margin-left:auto;padding:8px 16px;border-radius:999px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.22);font-weight:800;font-size:17px;max-width:260px;text-align:center}
.main{position:absolute;left:52px;right:52px;top:160px;bottom:150px;display:flex;flex-direction:column;justify-content:center}
.foot{position:absolute;left:52px;right:52px;bottom:56px;display:flex;align-items:center;gap:8px}
.foot i{flex:1;height:8px;border-radius:8px;background:rgba(255,255,255,.18)}.foot i.on{background:#F9C71D}
h2{font-size:58px;line-height:1.1;margin-bottom:34px}
h2 span{color:#F9C71D}
.items{display:flex;flex-direction:column;gap:20px}
.item{display:flex;gap:18px;align-items:flex-start;padding:26px 28px;border-radius:24px;background:rgba(255,255,255,.09);border:1.5px solid rgba(255,255,255,.16);font-size:35px;line-height:1.3;font-weight:700}
.item em{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#F9C71D;color:#2a1d00;font-style:normal;font-weight:900;font-size:24px;margin-top:-1px}
.cover{align-items:flex-start}
.cover .emb{width:150px;height:150px;border-radius:40px;display:grid;place-items:center;background:linear-gradient(135deg,#F9C71D,#e0a800);color:#0B2259;box-shadow:0 18px 40px rgba(249,199,29,.35);margin-bottom:44px}
.cover .kick{font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:#fde68a;font-size:24px;margin-bottom:16px}
.cover h1{font-size:76px;line-height:1.04}
.cover p{margin-top:28px;font-size:30px;line-height:1.4;color:#dbe4f7}
.verse{background:linear-gradient(180deg,#fffbeb,#fdf1cf);color:#3b2a10;border-radius:30px;padding:56px 50px;box-shadow:0 26px 60px rgba(0,0,0,.4);position:relative}
.verse .q{position:absolute;top:-44px;left:40px;width:84px;height:84px;border-radius:50%;background:#E92A2F;color:#fff;display:grid;place-items:center}
.verse p{font-family:Georgia,'Times New Roman',serif;font-size:40px;line-height:1.42;font-style:italic}
.verse b{display:block;margin-top:28px;font-family:'Poppins';font-size:30px;color:#9a3412}
.grid{display:grid;grid-template-columns:1fr;gap:14px}.grid.two{grid-template-columns:1fr 1fr}
.chip{display:flex;gap:14px;align-items:center;padding:18px 20px;border-radius:20px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.18);font-size:33px;font-weight:800}
.grid.two .chip{font-size:28px;padding:16px 16px}
.chip em{flex:none;min-width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#F9C71D;color:#2a1d00;font-style:normal;font-weight:900;font-size:21px}
.tip{border-radius:30px;padding:48px 44px;background:linear-gradient(135deg,#F9C71D,#f5b400);color:#2a1d00;box-shadow:0 22px 50px rgba(249,199,29,.3)}
.tip .ic{width:84px;height:84px;border-radius:24px;background:rgba(255,255,255,.45);display:grid;place-items:center;margin-bottom:26px}
.tip b.t{display:block;font-size:42px;margin-bottom:16px}
.tip p{font-size:38px;line-height:1.38;font-weight:700}
.task h2{display:flex;align-items:center;gap:16px}
.task .ic{width:70px;height:70px;border-radius:20px;background:#18875A;display:grid;place-items:center;flex:none}
.task .item em{background:#4ade80;color:#052e16}
.end{align-items:center;text-align:center}
.end .ic{width:170px;height:170px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 50% 40%,#fde047,#F9C71D 55%,#e0a800);color:#0B2259;box-shadow:0 0 70px rgba(249,199,29,.55);margin:0 auto 44px}
.end h1{font-size:72px}.end p{margin-top:24px;font-size:34px;line-height:1.4;color:#dbe4f7}
`;
const ICON_OF = { capa: 'book-open', versiculo: 'quote', dica: 'lightbulb', tarefa: 'notebook-pen', fim: 'award' };

async function slideHtml(aula, s, i, total, fontsCss, logo) {
  const dots = Array.from({ length: total }, (_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
  let main = '';
  const items = (s.itens || []).map((t, k) => `<div class="item"><em>${k + 1}</em><span>${esc(t)}</span></div>`).join('');
  if (s.tipo === 'capa') {
    main = `<div class="main cover"><div class="emb">${await icon('book-open', 80)}</div><div class="kick">Classe ${NOME} · Aula ${aula.n}</div><h1>${esc(s.titulo || aula.titulo)}</h1>${s.subtitulo || aula.objetivo ? `<p>${esc(aula.objetivo || s.subtitulo)}</p>` : ''}</div>`;
  } else if (s.tipo === 'versiculo') {
    main = `<div class="main"><div class="verse"><span class="q">${await icon('quote', 44)}</span><p>“${esc(s.texto)}”</p><b>${esc(s.ref)}</b></div></div>`;
  } else if (s.tipo === 'lista') {
    const two = (s.itens || []).length > 6;
    main = `<div class="main"><h2>${esc(s.titulo)}</h2><div class="grid ${two ? 'two' : ''}">${(s.itens || []).map((t, k) => `<div class="chip"><em>${k + 1}</em><span>${esc(t)}</span></div>`).join('')}</div></div>`;
  } else if (s.tipo === 'dica') {
    main = `<div class="main"><div class="tip"><div class="ic">${await icon('lightbulb', 50)}</div><b class="t">${esc(s.titulo || 'Dica')}</b><p>${esc(s.texto)}</p></div></div>`;
  } else if (s.tipo === 'tarefa') {
    main = `<div class="main task"><h2><span class="ic">${await icon('notebook-pen', 40)}</span>${esc(s.titulo || 'No seu caderno')}</h2><div class="items">${items}</div></div>`;
  } else if (s.tipo === 'fim') {
    main = `<div class="main end"><div class="ic">${await icon('award', 90)}</div><h1>${esc(s.titulo || 'Muito bem!')}</h1><p>${esc(s.texto || 'Agora responda o quiz da aula.')}</p></div>`;
  } else {
    main = `<div class="main"><h2>${esc(s.titulo)}</h2>${s.texto ? `<p style="font-size:32px;line-height:1.4;margin-bottom:26px;color:#dbe4f7">${esc(s.texto)}</p>` : ''}<div class="items">${items}</div></div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontsCss}${CSS}</style></head><body><div class="bg"></div><div class="stripe"></div>
<div class="top"><img src="${logo}"><div><small>App do DBV</small><b>Classe ${NOME}</b></div><span class="sec">${esc(aula.secao)}</span></div>
${main}<div class="foot">${dots}</div></body></html>`;
}

// ---------- Áudio ----------
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

async function record(browser, file, fontsCss, logo) {
  const aula = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
  const id = String(aula.n).padStart(2, '0');
  const mp4 = path.join(outDir, `${id}.mp4`);
  const meta = path.join(outDir, `${id}.json`);
  const hash = videoHash(aula);
  if (fs.existsSync(mp4) && fs.existsSync(meta) && JSON.parse(fs.readFileSync(meta, 'utf8')).hash === hash) return 'ok';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-'));
  try {
    // 1) Narração de cada slide
    const lines = aula.slides.map((s, i) => JSON.stringify({ text: s.narracao, output_file: path.join(tmp, `${i}.wav`) })).join('\n') + '\n';
    await run(BIN, ['--model', MODEL, '--json-input', '--espeak_data', ESPEAK, '--length_scale', '1.0', '--sentence_silence', '0.2'], lines);
    let rate = 22050; const parts = []; const durs = []; const starts = []; let at = 0;
    const lead = 0.5, gap = 0.9; // respiro antes da voz e depois dela, em cada slide
    aula.slides.forEach((_, i) => {
      const w = readWav(fs.readFileSync(path.join(tmp, `${i}.wav`))); rate = w.rate;
      const t = trim(w.pcm, rate);
      const a = Math.round(rate * lead), b = Math.round(rate * gap);
      const total = a + t.length / 2 + b;
      starts.push(Math.round((at / rate) * 100) / 100);
      parts.push(Buffer.alloc(a * 2), t, Buffer.alloc(b * 2));
      durs.push(total / rate); at += total;
    });
    const raw = path.join(tmp, 'all.raw'); fs.writeFileSync(raw, Buffer.concat(parts));
    // 2) Imagem de cada slide
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    for (let i = 0; i < aula.slides.length; i++) {
      const html = path.join(tmp, `s${i}.html`);
      fs.writeFileSync(html, await slideHtml(aula, aula.slides[i], i, aula.slides.length, fontsCss, logo));
      await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(tmp, `s${i}.png`) });
    }
    await page.close();
    // 3) Junta: imagens com a duração de cada narração + áudio
    const list = aula.slides.map((_, i) => `file '${path.join(tmp, `s${i}.png`)}'\nduration ${durs[i].toFixed(3)}`).join('\n') + `\nfile '${path.join(tmp, `s${aula.slides.length - 1}.png`)}'\n`;
    fs.writeFileSync(path.join(tmp, 'list.txt'), list);
    await run('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
      '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw,
      '-vf', 'fps=2,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'stillimage', '-crf', '28', '-g', '600', '-bf', '0',
      '-c:a', 'aac', '-b:a', '40k', '-ac', '1', '-shortest', '-movflags', '+faststart', mp4 + '.part.mp4']);
    fs.renameSync(mp4 + '.part.mp4', mp4);
    fs.writeFileSync(meta, JSON.stringify({ hash, duration: Math.round((at / rate) * 10) / 10, starts }));
    return 'novo';
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
fs.mkdirSync(outDir, { recursive: true });
const fontsCss = process.env.FONTS_CSS ? fs.readFileSync(process.env.FONTS_CSS, 'utf8').replace(/url\((?!data:)([^)]+)\)/g, (_, u) => `url(${pathToFileURL(path.resolve(path.dirname(process.env.FONTS_CSS), u.replace(/['"]/g, '')))})`) : '';
const logo = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(ROOT, 'client', 'public', 'marca', 'logo.svg')).toString('base64');
const files = fs.readdirSync(DATA).filter((f) => /^aula-\d+\.json$/.test(f)).sort()
  .filter((f) => !process.env.ONLY || process.env.ONLY.split(',').includes(f.match(/\d+/)[0]));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let next = 0; let done = 0; const t0 = Date.now();
await Promise.all(Array.from({ length: Number(par) }, async () => {
  while (next < files.length) {
    const f = files[next++];
    try { console.log(`${f}: ${await record(browser, f, fontsCss, logo)}`); } catch (e) { console.error(`[${f}] ${e.message}`); }
    done++;
  }
}));
await browser.close();
console.log(`${classe}: ${done}/${files.length} em ${Math.round((Date.now() - t0) / 1000)} s`);
