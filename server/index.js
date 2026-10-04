import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { UPLOAD_DIR, ROOT, get } from './db.js';
import { attachActor } from './auth.js';
import { attachRealtime } from './realtime.js';
import { HttpError } from './util.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import clubRoutes from './routes/club.js';
import requirementRoutes from './routes/requirements.js';
import contentRoutes from './routes/content.js';
import rankingRoutes from './routes/rankings.js';
import chatRoutes from './routes/chat.js';
import meRoutes from './routes/me.js';
import fileRoutes from './routes/files.js';
import { seed } from './seed.js';

if (!get('SELECT 1 FROM admins LIMIT 1')) {
  console.log('Banco vazio: carregando dados de exemplo do Distrito Palmares...');
  seed();
}

const app = express();
app.disable('x-powered-by');
// Atrás de proxy reverso (Nginx, Render, etc.), defina TRUST_PROXY=1 para o IP real do usuário.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachActor);

const api = express.Router();
api.get('/health', (_req, res) => res.json({ ok: true }));
for (const r of [authRoutes, publicRoutes, adminRoutes, clubRoutes, requirementRoutes, contentRoutes, rankingRoutes, chatRoutes, meRoutes, fileRoutes]) api.use(r);
api.use((_req, _res, next) => next(new HttpError(404, 'Rota não encontrada')));
app.use('/api', api);

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }));

// Pasta do site gerada pelo build (vite). Caminho fixo a partir deste arquivo,
// para funcionar qualquer que seja a pasta onde o servidor foi iniciado.
const dist = path.join(ROOT, 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  console.log('Site encontrado em', dist);
  app.use(express.static(dist, { index: false }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  console.error(`ATENÇÃO: site não encontrado em ${dist}. Rode "npm run build" antes de "npm start".`);
  app.get('/{*splat}', (_req, res) =>
    res.status(503).send('<h1>App do DBV</h1><p>O site ainda não foi gerado. Rode <code>npm run build</code> e reinicie o servidor.</p>'));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo muito grande' : 'Erro no envio do arquivo' });
  if (err?.code === 'ERR_SQLITE_ERROR' && /constraint|RAISE|ABORT|unidade|clube|requisito/i.test(err.message)) {
    return res.status(400).json({ error: err.message.replace(/^.*?:\s*/, '') });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

const server = http.createServer(app);
attachRealtime(server);
const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`App do DBV rodando em http://localhost:${PORT}`));
