// Álbuns de figurinhas dos membros: comprar pacotinhos no Pix, abrir, colar e trocar repetidas.
// A equipe (admin) confirma os pagamentos e vê quem completou o álbum para entregar o troféu.
import crypto from 'node:crypto';
import { Router } from 'express';
import QRCode from 'qrcode';
import { all, get, run, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { cleanCpf, fail, int, str } from '../util.js';
import { setting, setSetting } from '../fees.js';
import { ALBUMS, PACK_OPTIONS, REPEATS_PER_FREE_PACK, drawPack, pixCode } from '../stickers.js';
import { createPix, fakePay, idsInWebhook, pixStatus, syncpayOn } from '../syncpay.js';

const r = Router();
const member = requireAuth('member');
const admin = requireAuth('admin');

const activeAlbum = (id) => {
  const a = ALBUMS[id];
  if (!a) fail(404, 'Álbum não encontrado');
  if (!a.active) fail(400, 'Este álbum ainda não está disponível');
  return a;
};
function progress(memberId, album) {
  run('INSERT OR IGNORE INTO album_progress (member_id, album) VALUES (?, ?)', memberId, album);
  return get('SELECT * FROM album_progress WHERE member_id = ? AND album = ?', memberId, album);
}
const repeatsOf = (memberId, album) => get('SELECT COALESCE(SUM(qty - 1), 0) n FROM album_stickers WHERE member_id = ? AND album = ? AND qty > 1', memberId, album).n;
const pixConfig = () => ({ key: setting('pix_key') || '', name: setting('pix_name') || '', city: setting('pix_city') || '' });
// Como o Pix é pago: 'syncpay' (automático), 'manual' (chave Pix + equipe confirma) ou 'off'.
const payMode = () => (syncpayOn() ? 'syncpay' : pixConfig().key ? 'manual' : 'off');

/** Pagamento confirmado: libera os pacotinhos uma vez só. */
function creditOrder(o) {
  return tx(() => {
    const changed = run(`UPDATE sticker_orders SET status = 'pago', paid_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status IN ('aberto','aguardando')`, o.id).changes;
    if (changed) {
      progress(o.member_id, o.album);
      run('UPDATE album_progress SET packs_unopened = packs_unopened + ? WHERE member_id = ? AND album = ?', o.packs, o.member_id, o.album);
    }
    return !!changed;
  });
}
/** Confere na SyncPay (no máximo a cada 4 s por pedido) e libera se foi pago. */
async function checkOrder(o, { force = false } = {}) {
  if (!o?.identifier || !['aberto', 'aguardando'].includes(o.status)) return o;
  if (!force && o.checked_at && Date.now() - o.checked_at < 4000) return o;
  run('UPDATE sticker_orders SET checked_at = ? WHERE id = ?', Date.now(), o.id);
  let st;
  try { st = await pixStatus(o.identifier); } catch (e) { console.warn('[syncpay] consulta falhou:', e.message); return o; }
  if (st === 'pago') creditOrder(o);
  else if (st === 'recusado' || st === 'reembolsado') run(`UPDATE sticker_orders SET status = 'recusado' WHERE id = ? AND status IN ('aberto','aguardando')`, o.id);
  return get('SELECT * FROM sticker_orders WHERE id = ?', o.id);
}
/** Varredura (a cada 2 min): pedidos com Pix automático das últimas 48 h. */
export function startPixSweep() {
  const t = setInterval(async () => {
    if (!syncpayOn()) return;
    for (const o of all(`SELECT * FROM sticker_orders WHERE identifier IS NOT NULL AND status IN ('aberto','aguardando') AND created_at >= datetime('now', '-2 days')`)) await checkOrder(o);
  }, 120e3);
  t.unref?.();
}

const orderOut = async (o) => {
  const cfg = pixConfig();
  const code = o.pix_code || (cfg.key ? pixCode({ key: cfg.key, name: cfg.name, city: cfg.city, amountCents: o.amount_cents, txid: o.txid }) : '');
  const qr = code ? await QRCode.toString(code, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) : '';
  const { payer, identifier, pix_code, ...rest } = o;
  void payer; void identifier; void pix_code;
  return { ...rest, auto: !!o.identifier, pix: code, qr: qr ? 'data:image/svg+xml;base64,' + Buffer.from(qr).toString('base64') : '', receiver: o.identifier ? '' : cfg.name };
};

// ---------- Membro ----------
r.get('/albuns', member, (req, res) => {
  res.json(Object.values(ALBUMS).map((a) => {
    if (!a.active) return { id: a.id, name: a.name, active: false };
    const p = get('SELECT * FROM album_progress WHERE member_id = ? AND album = ?', req.actor.id, a.id);
    const c = get('SELECT COUNT(*) owned, COALESCE(SUM(stuck), 0) stuck FROM album_stickers WHERE member_id = ? AND album = ?', req.actor.id, a.id);
    return { id: a.id, name: a.name, active: true, total: a.total, owned: c.owned, stuck: c.stuck, packs_unopened: p?.packs_unopened || 0, completed_at: p?.completed_at || null };
  }));
});

r.get('/albuns/:id', member, (req, res) => {
  const a = activeAlbum(req.params.id);
  const p = progress(req.actor.id, a.id);
  const rows = all('SELECT sticker, qty, stuck FROM album_stickers WHERE member_id = ? AND album = ?', req.actor.id, a.id);
  const orders = all(`SELECT id, packs, amount_cents, status, created_at, paid_at FROM sticker_orders
    WHERE member_id = ? AND album = ? AND (status IN ('aberto','aguardando') OR created_at > datetime('now', '-30 days')) ORDER BY id DESC LIMIT 10`, req.actor.id, a.id);
  res.json({
    id: a.id, name: a.name, total: a.total, price_cents: a.price_cents, pack_size: a.pack_size, options: PACK_OPTIONS,
    repeats_per_free_pack: REPEATS_PER_FREE_PACK, pay_mode: payMode(), pix_ready: payMode() !== 'off',
    last_payer: JSON.parse(get('SELECT payer FROM sticker_orders WHERE member_id = ? AND payer IS NOT NULL ORDER BY id DESC LIMIT 1', req.actor.id)?.payer || 'null'),
    packs_unopened: p.packs_unopened, packs_opened: p.packs_opened, completed_at: p.completed_at,
    stickers: Object.fromEntries(rows.map((x) => [x.sticker, { qty: x.qty, stuck: !!x.stuck }])),
    repeats: repeatsOf(req.actor.id, a.id),
    orders,
  });
});

r.post('/albuns/:id/pedidos', member, async (req, res) => {
  const a = activeAlbum(req.params.id);
  const packs = int(req.body.packs);
  if (!PACK_OPTIONS.includes(packs)) fail(400, 'Escolha 1, 10, 20 ou 50 pacotinhos');
  const mode = payMode();
  if (mode === 'off') fail(400, 'O pagamento por Pix ainda não foi configurado pela equipe. Tente mais tarde.');
  const open = get(`SELECT COUNT(*) n FROM sticker_orders WHERE member_id = ? AND status IN ('aberto','aguardando')`, req.actor.id).n;
  if (open >= 3) fail(400, 'Você já tem pedidos esperando pagamento. Pague ou cancele um deles antes.');
  const txid = 'DBV' + crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 16);
  const amount = packs * a.price_cents;
  let pix = null;
  let payer = null;
  if (mode === 'syncpay') {
    // A SyncPay pede os dados de quem paga (pode ser o responsável).
    const b = req.body.payer || {};
    payer = { name: str(b.name, 80), cpf: cleanCpf(b.cpf), email: str(b.email, 120).toLowerCase(), phone: String(b.phone || '').replace(/\D/g, '') };
    if (payer.name.split(/\s+/).length < 2) fail(400, 'Informe o nome completo de quem vai pagar');
    if (!payer.cpf) fail(400, 'CPF inválido');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer.email)) fail(400, 'E-mail inválido');
    if (!/^\d{10,13}$/.test(payer.phone)) fail(400, 'Celular inválido (com DDD)');
    pix = await createPix({ amountCents: amount, description: `App do DBV - ${packs} pacotinho${packs > 1 ? 's' : ''} de figurinhas`, payer });
  }
  const id = Number(run('INSERT INTO sticker_orders (member_id, album, packs, amount_cents, txid, identifier, pix_code, payer) VALUES (?,?,?,?,?,?,?,?)',
    req.actor.id, a.id, packs, amount, txid, pix?.identifier || null, pix?.pix_code || null, payer ? JSON.stringify(payer) : null).lastInsertRowid);
  res.json(await orderOut(get('SELECT * FROM sticker_orders WHERE id = ?', id)));
});

const myOrder = (req) => {
  const o = get('SELECT * FROM sticker_orders WHERE id = ? AND member_id = ?', int(req.params.oid), req.actor.id);
  if (!o) fail(404, 'Pedido não encontrado');
  return o;
};
r.get('/albuns/pedidos/:oid', member, async (req, res) => res.json(await orderOut(await checkOrder(myOrder(req)))));

// Aviso da SyncPay: responde na hora e só usa o aviso para conferir os pedidos citados.
r.post('/albuns/pix/aviso', (req, res) => {
  res.json({ ok: true });
  (async () => {
    for (const id of idsInWebhook(req.body)) {
      const o = get('SELECT * FROM sticker_orders WHERE lower(identifier) = ?', id);
      if (o) await checkOrder(o, { force: true });
    }
  })().catch((e) => console.warn('[syncpay] aviso:', e.message));
});
// Só nos testes automáticos (SYNCPAY_FAKE=1): marca a cobrança como paga.
if (process.env.SYNCPAY_FAKE === '1') {
  r.post('/albuns/pedidos/:oid/_simular', member, (req, res) => { fakePay(myOrder(req).identifier); res.json({ ok: true }); });
}
r.post('/albuns/pedidos/:oid/paguei', member, (req, res) => {
  const o = myOrder(req);
  if (o.status !== 'aberto') fail(400, 'Este pedido não está esperando pagamento');
  run(`UPDATE sticker_orders SET status = 'aguardando', notified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, o.id);
  res.json({ ok: true });
});
r.post('/albuns/pedidos/:oid/cancelar', member, (req, res) => {
  const o = myOrder(req);
  if (o.status !== 'aberto') fail(400, 'Só dá para cancelar pedidos que ainda não foram pagos');
  run(`UPDATE sticker_orders SET status = 'cancelado' WHERE id = ?`, o.id);
  res.json({ ok: true });
});

// Abre um pacotinho: as novas ficam para colar e as repetidas vão para o monte de repetidas.
r.post('/albuns/:id/abrir', member, (req, res) => {
  const a = activeAlbum(req.params.id);
  const out = tx(() => {
    const p = progress(req.actor.id, a.id);
    if (p.packs_unopened < 1) fail(400, 'Você não tem pacotinhos para abrir');
    const owned = new Set(all('SELECT sticker FROM album_stickers WHERE member_id = ? AND album = ?', req.actor.id, a.id).map((x) => x.sticker));
    const cards = drawPack(a.id, owned, p.packs_opened);
    for (const c of cards) {
      run(`INSERT INTO album_stickers (member_id, album, sticker) VALUES (?,?,?)
        ON CONFLICT (member_id, album, sticker) DO UPDATE SET qty = qty + 1`, req.actor.id, a.id, c.id);
    }
    run('UPDATE album_progress SET packs_unopened = packs_unopened - 1, packs_opened = packs_opened + 1 WHERE member_id = ? AND album = ?', req.actor.id, a.id);
    run('INSERT INTO album_openings (member_id, album, stickers) VALUES (?,?,?)', req.actor.id, a.id, JSON.stringify(cards));
    return cards;
  });
  res.json({ cards: out, packs_unopened: progress(req.actor.id, a.id).packs_unopened, repeats: repeatsOf(req.actor.id, a.id) });
});

// Cola figurinhas no álbum (as escolhidas, ou todas as que estão para colar).
r.post('/albuns/:id/colar', member, (req, res) => {
  const a = activeAlbum(req.params.id);
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : null;
  const result = tx(() => {
    if (ids) for (const s of ids) run('UPDATE album_stickers SET stuck = 1 WHERE member_id = ? AND album = ? AND sticker = ?', req.actor.id, a.id, s);
    else run('UPDATE album_stickers SET stuck = 1 WHERE member_id = ? AND album = ?', req.actor.id, a.id);
    const stuck = get('SELECT COUNT(*) n FROM album_stickers WHERE member_id = ? AND album = ? AND stuck = 1', req.actor.id, a.id).n;
    const p = progress(req.actor.id, a.id);
    let completed = false;
    if (stuck >= a.total && !p.completed_at) {
      run(`UPDATE album_progress SET completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE member_id = ? AND album = ?`, req.actor.id, a.id);
      completed = true;
    }
    return { stuck, completed };
  });
  res.json(result);
});

// Troca 20 repetidas por 1 pacotinho grátis (tira primeiro das que têm mais cópias).
r.post('/albuns/:id/trocar', member, (req, res) => {
  const a = activeAlbum(req.params.id);
  tx(() => {
    if (repeatsOf(req.actor.id, a.id) < REPEATS_PER_FREE_PACK) fail(400, `Junte ${REPEATS_PER_FREE_PACK} repetidas para trocar por um pacotinho`);
    let left = REPEATS_PER_FREE_PACK;
    for (const s of all('SELECT sticker, qty FROM album_stickers WHERE member_id = ? AND album = ? AND qty > 1 ORDER BY qty DESC, sticker', req.actor.id, a.id)) {
      const take = Math.min(left, s.qty - 1);
      run('UPDATE album_stickers SET qty = qty - ? WHERE member_id = ? AND album = ? AND sticker = ?', take, req.actor.id, a.id, s.sticker);
      left -= take;
      if (!left) break;
    }
    progress(req.actor.id, a.id);
    run('UPDATE album_progress SET packs_unopened = packs_unopened + 1, free_packs = free_packs + 1 WHERE member_id = ? AND album = ?', req.actor.id, a.id);
  });
  res.json({ ok: true, repeats: repeatsOf(req.actor.id, a.id), packs_unopened: progress(req.actor.id, a.id).packs_unopened });
});

// ---------- Equipe ----------
const ORDER_SQL = `SELECT o.*, m.name AS member_name, m.code AS member_code, c.name AS club_name, u.name AS unit_name
  FROM sticker_orders o JOIN members m ON m.id = o.member_id JOIN clubs c ON c.id = m.club_id LEFT JOIN units u ON u.id = m.unit_id`;
r.get('/admin/figurinhas/pedidos', admin, (req, res) => {
  const status = ['aberto', 'aguardando', 'pago', 'recusado', 'cancelado'].includes(req.query.status) ? req.query.status : 'aguardando';
  res.json({
    rows: all(`${ORDER_SQL} WHERE o.status = ? ORDER BY o.id DESC LIMIT 200`, status),
    counts: Object.fromEntries(all('SELECT status, COUNT(*) n FROM sticker_orders GROUP BY status').map((x) => [x.status, x.n])),
    total_paid_cents: get(`SELECT COALESCE(SUM(amount_cents), 0) n FROM sticker_orders WHERE status = 'pago'`).n,
  });
});
r.post('/admin/figurinhas/pedidos/:id/:acao', admin, (req, res) => {
  const o = get('SELECT * FROM sticker_orders WHERE id = ?', int(req.params.id));
  if (!o) fail(404, 'Pedido não encontrado');
  if (!['aberto', 'aguardando'].includes(o.status)) fail(400, 'Este pedido já foi resolvido');
  if (req.params.acao === 'confirmar') creditOrder(o);
  else if (req.params.acao === 'recusar') {
    run(`UPDATE sticker_orders SET status = 'recusado' WHERE id = ?`, o.id);
  } else fail(404, 'Ação inválida');
  res.json({ ok: true });
});
// Presente da equipe (promoções e testes): pacotinhos grátis para um membro, pelo código.
r.post('/admin/figurinhas/presente', admin, (req, res) => {
  const a = activeAlbum(String(req.body.album || 'biblico'));
  const packs = int(req.body.packs);
  if (!packs || packs < 1 || packs > 100) fail(400, 'Quantidade inválida (1 a 100)');
  const m = get('SELECT id, name FROM members WHERE code = ?', String(req.body.code || '').trim());
  if (!m) fail(404, 'Membro não encontrado');
  progress(m.id, a.id);
  run('UPDATE album_progress SET packs_unopened = packs_unopened + ? WHERE member_id = ? AND album = ?', packs, m.id, a.id);
  res.json({ ok: true, name: m.name });
});
r.get('/admin/figurinhas/completos', admin, (_req, res) => {
  res.json(all(`SELECT p.album, p.completed_at, p.packs_opened, m.id AS member_id, m.name, m.code, c.name AS club_name, u.name AS unit_name
    FROM album_progress p JOIN members m ON m.id = p.member_id JOIN clubs c ON c.id = m.club_id LEFT JOIN units u ON u.id = m.unit_id
    WHERE p.completed_at IS NOT NULL ORDER BY p.completed_at`).map((x) => ({ ...x, album_name: ALBUMS[x.album]?.name || x.album })));
});
r.get('/admin/figurinhas/pix', admin, (_req, res) => res.json({ ...pixConfig(), syncpay: syncpayOn() }));
r.put('/admin/figurinhas/pix', admin, (req, res) => {
  setSetting('pix_key', str(req.body.key, 120) || '');
  setSetting('pix_name', str(req.body.name, 60) || '');
  setSetting('pix_city', str(req.body.city, 40) || '');
  res.json({ ok: true });
});

export default r;
