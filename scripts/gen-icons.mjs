// Gera os ícones PNG do PWA a partir das logos SVG em client/public.
// Requer o Playwright (npx playwright ou instalação global).
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const dir = path.resolve('client/public');
const browser = await chromium.launch();

async function shot(file, out, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const tmp = path.join(dir, '_tmp.html');
  fs.writeFileSync(tmp, `<html><body style="margin:0"><img src="${file}" style="width:${w}px;height:${h}px;display:block"></body></html>`);
  await page.goto('file://' + tmp);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(dir, out), omitBackground: true });
  fs.rmSync(tmp);
  await page.close();
}

await shot('logo.svg', 'icons/icon-192.png', 192, 192);
await shot('logo.svg', 'icons/icon-512.png', 512, 512);
await shot('logo-maskable.svg', 'icons/maskable-512.png', 512, 512);
await shot('logo-maskable.svg', 'icons/apple-touch-icon.png', 180, 180);
await browser.close();
console.log('Ícones gerados em client/public/icons');
