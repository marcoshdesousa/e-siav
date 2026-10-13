// Pedido para criar um clube: a pessoa preenche a página pública /criar-clube e a
// equipe do app recebe no painel (não visualizados / visualizados) para chamar no WhatsApp.
import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int, str, cleanCpf } from '../util.js';

const r = Router();

const janela = new Map();
setInterval(() => janela.clear(), 60 * 60 * 1000).unref();

r.post('/public/criar-cla', (req, res) => {
  const n = (janela.get(req.ip) || 0) + 1;
  janela.set(req.ip, n);
  if (n > 5) fail(429, 'Muitos pedidos seguidos. Tente de novo mais tarde.');
  const b = req.body || {};
  const name = str(b.name, 120);
  const cpf = cleanCpf(b.cpf);
  const whatsapp = str(b.whatsapp, 30).replace(/[^\d+]/g, '');
  const uf = str(b.uf, 2).toUpperCase();
  const city = str(b.city, 80);
  const neighborhood = str(b.neighborhood, 120);
  const num = (k) => Math.max(0, Math.min(100000, int(b[k], -1)));
  if (name.split(/\s+/).length < 2) fail(400, 'Informe o nome completo');
  if (!cpf) fail(400, 'Informe um CPF válido');
  if (whatsapp.replace(/\D/g, '').length < 10) fail(400, 'Informe o WhatsApp com DDD');
  if (!/^[A-Z]{2}$/.test(uf) || !city || !neighborhood) fail(400, 'Informe o estado, a cidade e o bairro ou setor');
  for (const k of ['adults', 'teens', 'kids_6_9', 'kids_10_15']) if (int(b[k], -1) < 0) fail(400, 'Preencha todas as quantidades (pode ser zero)');
  run(
    `INSERT INTO clan_applications (name, cpf, whatsapp, uf, city, neighborhood, adults, teens, kids_6_9, kids_10_15, clan_name)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    name, cpf, whatsapp, uf, city, neighborhood, num('adults'), num('teens'), num('kids_6_9'), num('kids_10_15'), str(b.clan_name, 100) || null,
  );
  res.json({ ok: true });
});

const admin = requireAuth('admin');

// As mais antigas em cima, as mais novas embaixo.
r.get('/admin/cla-inscricoes', admin, (req, res) => {
  const viewed = req.query.visualizados === '1';
  res.json({
    items: all(`SELECT * FROM clan_applications WHERE viewed_at IS ${viewed ? 'NOT ' : ''}NULL ORDER BY created_at ASC, id ASC`),
    unviewed: get('SELECT COUNT(*) n FROM clan_applications WHERE viewed_at IS NULL').n,
  });
});

r.post('/admin/cla-inscricoes/:id/visualizar', admin, (req, res) => {
  const { changes } = run(`UPDATE clan_applications SET viewed_at = COALESCE(viewed_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ?`, int(req.params.id));
  if (!changes) fail(404, 'Pedido não encontrado');
  res.json({ ok: true });
});

export default r;
