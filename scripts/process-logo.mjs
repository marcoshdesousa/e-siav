// Gera a logo e os ícones do PWA a partir da logo vetorial (SVG, fundo transparente)
// ou de uma imagem com fundo preto (que é removido).
// Uso: node scripts/process-logo.mjs assets/logo.svg
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const src = process.argv[2];
// Os arquivos ficam em /marca/: trocar a pasta (e não só o arquivo) garante que
// navegadores e o app instalado não mostrem uma logo antiga guardada em cache.
const pub = path.resolve('client/public/marca');
fs.mkdirSync(pub, { recursive: true });
const b64 = fs.readFileSync(src).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();

const isSvg = src.endsWith('.svg');
const outputs = await page.evaluate(async ({ dataUrl, isSvg }) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  // SVG é desenhado grande para os ícones saírem nítidos.
  const W = isSvg ? 2048 : img.width, H = isSvg ? 2048 : img.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  // Remove o fundo escuro conectado às bordas (flood fill), suavizando a borda.
  const dark = (i) => !isSvg && px[i] + px[i + 1] + px[i + 2] < 150;
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!dark(p * 4)) continue;
    px[p * 4 + 3] = 0;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }
  // Borda: pixels visíveis vizinhos de transparentes ganham alfa proporcional ao brilho.
  for (let p = 0; p < W * H; p++) {
    if (px[p * 4 + 3] === 0) continue;
    const x = p % W, y = (p / W) | 0;
    const nb = [p - 1, p + 1, p - W, p + W].filter((q) => q >= 0 && q < W * H && Math.abs((q % W) - x) <= 1);
    if (!isSvg && nb.some((q) => px[q * 4 + 3] === 0)) {
      const lum = Math.max(px[p * 4], px[p * 4 + 1], px[p * 4 + 2]);
      px[p * 4 + 3] = Math.min(255, lum * 1.6);
    }
  }
  ctx.putImageData(data, 0, 0);
  // Recorta na área da logo.
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let p = 0; p < W * H; p++) if (px[p * 4 + 3] > 20) {
    const x = p % W, y = (p / W) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const render = (size, pad, bg) => {
    const o = document.createElement('canvas');
    o.width = o.height = size;
    const octx = o.getContext('2d');
    if (bg) { octx.fillStyle = bg; octx.fillRect(0, 0, size, size); }
    const inner = size * (1 - 2 * pad);
    const s = inner / Math.max(bw, bh);
    const dw = bw * s, dh = bh * s;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(c, minX, minY, bw, bh, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return o.toDataURL('image/png');
  };
  return {
    'logo.png': render(512, 0.02),
    'icon-192.png': render(192, 0.04),
    'icon-512.png': render(512, 0.04),
    'maskable-512.png': render(512, 0.16, '#FFFFFF'),
    'apple-touch-icon.png': render(180, 0.1, '#FFFFFF'),
    'favicon-16.png': render(16, 0),
    'favicon-32.png': render(32, 0),
    'favicon-48.png': render(48, 0),
    'favicon.png': render(64, 0),
  };
}, { dataUrl: (isSvg ? 'data:image/svg+xml;base64,' : 'data:image/jpeg;base64,') + b64, isSvg });

for (const [file, url] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(pub, file), Buffer.from(url.split(',')[1], 'base64'));
  console.log('gerado', file);
}
if (isSvg) fs.copyFileSync(src, path.join(pub, 'logo.svg'));

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
