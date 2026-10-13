// Pix automático pela SyncPay (mesmo jeito da Acolia e da Eduvia).
//   1. O app gera o Pix na SyncPay (POST /api/partner/v1/cash-in) e mostra o QR Code e o copia e cola.
//   2. Para saber se foi pago, o app PERGUNTA para a SyncPay (GET /api/partner/v2/transactions/{id}):
//      a cada 4 s com a tela do Pix aberta e numa varredura a cada 2 min. O aviso deles (webhook)
//      só serve de "cutucada" para conferir na hora — o conteúdo do aviso nunca vale como pagamento.
// Configuração (Render → Environment): SYNCPAY_CLIENT_ID e SYNCPAY_CLIENT_SECRET (opcional SITE_URL).
// SYNCPAY_FAKE=1: pagamento simulado, só para os testes automáticos (nunca em produção).
import crypto from 'node:crypto';
import { HttpError } from './util.js';

const BASE = () => (process.env.SYNCPAY_BASE_URL || 'https://api.syncpayments.com.br').replace(/\/+$/, '');
const fake = () => process.env.SYNCPAY_FAKE === '1';
export const syncpayOn = () => fake() || (!!process.env.SYNCPAY_CLIENT_ID?.trim() && !!process.env.SYNCPAY_CLIENT_SECRET?.trim());
export const siteUrl = () => (process.env.SITE_URL || 'https://appdodbv.onrender.com').replace(/\/+$/, '');
const unavailable = () => new HttpError(502, 'Não foi possível gerar o Pix agora. Tente de novo em alguns minutos.');

let tok = null; // o token vale ~1 hora: só pede outro quando vencer
async function token() {
  if (tok && tok.until > Date.now() + 60e3) return tok.value;
  const r = await fetch(`${BASE()}/api/partner/v1/auth-token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: process.env.SYNCPAY_CLIENT_ID?.trim(), client_secret: process.env.SYNCPAY_CLIENT_SECRET?.trim() }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) { console.warn('[syncpay] token recusado', r.status, d?.message); throw unavailable(); }
  tok = { value: d.access_token, until: Date.parse(d.expires_at) || Date.now() + (Number(d.expires_in) || 3600) * 1000 };
  return tok.value;
}
async function call(method, path, body) {
  const t = await token();
  const r = await fetch(`${BASE()}${path}`, {
    method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) tok = null;
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

// Simulado (testes): cobranças na memória
const FAKE = new Map();
export const fakePay = (identifier, status = 'completed') => { if (FAKE.has(identifier)) FAKE.get(identifier).status = status; };

/** Cria a cobrança Pix. payer (opcional): { name, cpf, email, phone }. Retorna { identifier, pix_code }. */
export async function createPix({ amountCents, description, payer }) {
  if (fake()) {
    const identifier = crypto.randomUUID();
    FAKE.set(identifier, { status: 'pending' });
    return { identifier, pix_code: `00020126FAKEPIX${identifier.replace(/-/g, '').slice(0, 20)}` };
  }
  const body = { amount: Math.round(amountCents) / 100, description, webhook_url: `${siteUrl()}/api/albuns/pix/aviso` };
  if (payer) {
    const phone = String(payer.phone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
    body.client = { name: payer.name, cpf: String(payer.cpf).replace(/\D/g, ''), email: payer.email, phone };
  }
  const r = await call('POST', '/api/partner/v1/cash-in', body);
  if (r.status >= 300 || !r.data.pix_code || !r.data.identifier) {
    console.warn('[syncpay] cash-in recusado', r.status, r.data?.message);
    throw unavailable();
  }
  return { identifier: String(r.data.identifier), pix_code: String(r.data.pix_code) };
}

/** Situação na SyncPay: 'pago' | 'reembolsado' | 'recusado' | 'pendente'. */
export async function pixStatus(identifier) {
  if (fake()) {
    const s = FAKE.get(identifier)?.status;
    return s === 'completed' ? 'pago' : s === 'refunded' ? 'reembolsado' : 'pendente';
  }
  const r = await call('GET', `/api/partner/v2/transactions/${encodeURIComponent(identifier)}`);
  if (r.status !== 200) return 'pendente';
  const t = r.data?.data?.transaction || {};
  const s = String(t.status || '').toLowerCase();
  if (t.refunded_at || s === 'refunded') return 'reembolsado';
  if (t.paid_at || ['completed', 'paid', 'approved'].includes(s)) return 'pago';
  if (['refused', 'canceled', 'cancelled', 'expired', 'failed'].includes(s)) return 'recusado';
  return 'pendente';
}

/** Identificadores (UUID) citados num aviso da SyncPay. */
export function idsInWebhook(body) {
  const ids = new Set();
  const walk = (v, depth = 0) => {
    if (depth > 5 || v == null) return;
    if (typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) ids.add(v.toLowerCase());
    else if (typeof v === 'object') Object.values(v).slice(0, 50).forEach((x) => walk(x, depth + 1));
  };
  walk(body);
  return [...ids].slice(0, 10);
}
