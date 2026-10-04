// Gera as imagens das telas do app mostradas no celular da tela de entrada.
// Uso: com o servidor rodando (npm start), node scripts/showcase.mjs [url]
import path from 'node:path';

const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const B = process.argv[2] || 'http://localhost:3000';
const out = path.resolve('client/public/showcase');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage();
await p.goto(B + '/');
await p.locator('input').nth(0).fill('pedro');
await p.locator('input[type=password]').fill('dbv123');
await p.getByRole('button', { name: 'Entrar', exact: true }).click();
await p.waitForURL('**/membro');
for (const [route, name] of [['/membro', 'perfil'], ['/membro/ranking', 'ranking'], ['/membro/chat/1', 'chat'], ['/membro/requisitos', 'requisitos']]) {
  await p.goto(B + route);
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(out, name + '.jpg'), type: 'jpeg', quality: 82 });
}
await browser.close();
console.log('Imagens geradas em client/public/showcase');
