// Converte a logo enviada (fundo preto) em PNG transparente e gera os ícones do PWA.
// Uso: node scripts/process-logo.mjs caminho/da/logo.jpg
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const src = process.argv[2];
const pub = path.resolve('client/public');
const b64 = fs.readFileSync(src).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();

const outputs = await page.evaluate(async (dataUrl) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const W = img.width, H = img.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  // Remove o fundo escuro conectado às bordas (flood fill), suavizando a borda.
  const dark = (i) => px[i] + px[i + 1] + px[i + 2] < 150;
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
    if (nb.some((q) => px[q * 4 + 3] === 0)) {
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
    'icons/icon-192.png': render(192, 0.04),
    'icons/icon-512.png': render(512, 0.04),
    'icons/maskable-512.png': render(512, 0.16, '#FFFFFF'),
    'icons/apple-touch-icon.png': render(180, 0.1, '#FFFFFF'),
    'favicon.png': render(64, 0),
  };
}, 'data:image/jpeg;base64,' + b64);

for (const [file, url] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(pub, file), Buffer.from(url.split(',')[1], 'base64'));
  console.log('gerado', file);
}
await browser.close();
