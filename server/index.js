import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { UPLOAD_DIR, ROOT, all, get } from './db.js';
import { attachActor } from './auth.js';
import { HttpError } from './util.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import clubRoutes from './routes/club.js';
import requirementRoutes from './routes/requirements.js';
import contentRoutes from './routes/content.js';
import rankingRoutes from './routes/rankings.js';
import meRoutes from './routes/me.js';
import fileRoutes from './routes/files.js';
import announcementRoutes from './routes/announcements.js';
import achievementRoutes from './routes/achievements.js';
import clubEventRoutes from './routes/clubEvents.js';
import signupRoutes from './routes/signup.js';
import transferRoutes from './routes/transfers.js';
import clanApplicationRoutes from './routes/clanApplications.js';
import termRoutes from './routes/terms.js';
import feeRoutes from './routes/fees.js';
import clubToolRoutes from './routes/clubTools.js';
import { ensureInstallments } from './fees.js';
import { expireYear } from './memberStatus.js';
import { syncCatalog } from './catalog.js';
import { createInitialAdmin, resetToDemoClubsOnce, seed } from './seed.js';

// Banco vazio: cria só o administrador. Os dados de exemplo completos só entram com
// SEED_DEMO=1 (testes e desenvolvimento). Nada que já existe é apagado na inicialização,
// a não ser a troca única dos clãs antigos pelos clãs de teste (resetToDemoClubsOnce).
let justSeeded = false;
if (!get('SELECT 1 FROM admins LIMIT 1')) {
  if (process.env.SEED_DEMO === '1') {
    console.log('Banco vazio: carregando dados de exemplo do Distrito Palmares...');
    seed();
    justSeeded = true;
  } else {
    createInitialAdmin();
  }
}
resetToDemoClubsOnce({ justSeeded });
// Todo clã tem as suas parcelas (criadas a partir da data de criação do clã).
for (const c of all('SELECT id, created_at FROM clubs')) ensureInstallments(c.id, c.created_at);
// Virada do ano: quem não teve a inscrição renovada pelo clã fica esperando (confere de hora em hora).
expireYear();
setInterval(expireYear, 60 * 60 * 1000).unref();

syncCatalog();

const app = express();
app.disable('x-powered-by');
// Atrás de proxy reverso (Nginx, Render, etc.), defina TRUST_PROXY=1 para o IP real do usuário.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachActor);

// Modo manutenção: com MANUTENCAO=1 no Render, todo mundo vê "Sistema em atualização".
const MANUTENCAO = process.env.MANUTENCAO === '1';
if (MANUTENCAO) {
  console.log('Modo manutenção ligado (MANUTENCAO=1)');
  const page = path.join(ROOT, 'dist', 'atualizando.html');
  app.use((req, res, next) => {
    // A página de atualização e a logo continuam abrindo.
    if (req.path === '/atualizando.html' || req.path.startsWith('/marca/') || req.path === '/favicon.ico' || req.path === '/sw.js') return next();
    res.set('Retry-After', '600');
    if (req.path.startsWith('/api/')) return res.status(503).json({ error: 'Sistema em atualização. Volte em alguns minutos.' });
    res.status(503).sendFile(page);
  });
}

const api = express.Router();
api.get('/health', (_req, res) => res.json({ ok: true }));
for (const r of [authRoutes, publicRoutes, adminRoutes, clubRoutes, requirementRoutes, contentRoutes, rankingRoutes, meRoutes, fileRoutes, announcementRoutes, achievementRoutes, clubEventRoutes, signupRoutes, transferRoutes, clanApplicationRoutes, termRoutes, feeRoutes, clubToolRoutes]) api.use(r);
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
    res.status(503).send('<h1>Exploradores do Brasil</h1><p>O site ainda não foi gerado. Rode <code>npm run build</code> e reinicie o servidor.</p>'));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo muito grande' : 'Erro no envio do arquivo' });
  if (err?.code === 'ERR_SQLITE_ERROR' && /constraint|RAISE|ABORT|grupo|clã|unidade|clube|requisito/i.test(err.message)) {
    return res.status(400).json({ error: err.message.replace(/^.*?:\s*/, '') });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Exploradores do Brasil rodando em http://localhost:${PORT}`));
