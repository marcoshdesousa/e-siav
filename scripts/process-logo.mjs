// Gera a logo e os ícones do app a partir da arte quadrada da marca.
// Uso: node scripts/process-logo.mjs assets/logo-exploradores.jpg
// A arte já é um quadrado com fundo: os ícones usam a imagem inteira; o favicon
// e a logo do app ganham cantos arredondados.
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const src = process.argv[2];
// Pasta /marca/: navegadores e o app instalado buscam sempre a versão mais nova.
const pub = path.resolve('client/public/marca');
fs.mkdirSync(pub, { recursive: true });
const mime = src.endsWith('.png') ? 'image/png' : 'image/jpeg';
const dataUrl = `data:${mime};base64,` + fs.readFileSync(src).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();

const outputs = await page.evaluate(async (url) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
  const render = (size, radius = 0) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (radius) {
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, size * radius);
      ctx.clip();
    }
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return c.toDataURL('image/png');
  };
  return {
    'logo.png': render(512, 0.22),
    'icon-192.png': render(192),
    'icon-512.png': render(512),
    'maskable-512.png': render(512),
    'apple-touch-icon.png': render(180),
    'favicon.png': render(64, 0.22),
    'favicon-16.png': render(16, 0.2),
    'favicon-32.png': render(32, 0.22),
    'favicon-48.png': render(48, 0.22),
  };
}, dataUrl);

for (const [file, url] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(pub, file), Buffer.from(url.split(',')[1], 'base64'));
  console.log('gerado', file);
}

// favicon.ico (16, 32 e 48 px) para navegadores que pedem /favicon.ico direto.
const sizes = [16, 32, 48];
const pngs = sizes.map((n) => fs.readFileSync(path.join(pub, `favicon-${n}.png`)));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((n, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(n, e); head.writeUInt8(n, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
fs.writeFileSync(path.resolve('client/public/favicon.ico'), Buffer.concat([head, ...pngs]));
for (const n of sizes) fs.rmSync(path.join(pub, `favicon-${n}.png`));
console.log('gerado favicon.ico');
await browser.close();
