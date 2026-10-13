import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Depois do build: coloca no service worker a lista de TODOS os arquivos do app (inclusive
// os 77 jogos), para o app abrir e os jogos funcionarem sem internet. A versão muda sozinha a
// cada build, então o app atualiza sem precisar mexer no sw.js.
function offlinePrecache() {
  return {
    name: 'offline-precache',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist');
      const files = [];
      const walk = (dir) => {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, f.name);
          if (f.isDirectory()) walk(full);
          else files.push('/' + path.relative(dist, full).split(path.sep).join('/'));
        }
      };
      walk(dist);
      const list = files.filter((f) => /^\/(assets|img|marca)\//.test(f) && !f.endsWith('.map'));
      const version = crypto.createHash('sha1').update(list.join('|')).digest('hex').slice(0, 10);
      const sw = path.join(dist, 'sw.js');
      const src = fs.readFileSync(sw, 'utf8')
        .replace('self.__PRECACHE__ || []', JSON.stringify(list))
        .replace("'__BUILD__'", JSON.stringify(version));
      fs.writeFileSync(sw, src);
    },
  };
}

export default defineConfig({
  root: 'client',
  plugins: [react(), offlinePrecache()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
