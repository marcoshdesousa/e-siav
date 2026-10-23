// Álbuns de figurinhas dos membros: comprar pacotinhos no Pix, abrir, colar e trocar repetidas.
// O pagamento é o do site todo (server/payments.js). A equipe vê quem completou o álbum para entregar o trunfo.
import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { fail, int } from '../util.js';
import { ALBUMS, MIN_PACKS_TO_COMPLETE, PACK_OPTIONS, REPEATS_PER_FREE_PACK, drawPack } from '../stickers.js';
import { createPayment, onPaid, payMode, paymentOut } from '../payments.js';
import { PLUS_PACK_MULT, isPlus } from '../plus.js';

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
// Pacotinhos pagos: entram no álbum quando o Pix é confirmado (automático ou pela equipe).
onPaid('figurinhas', (p, ref) => {
  progress(p.member_id, ref.album);
  run('UPDATE album_progress SET packs_unopened = packs_unopened + ? WHERE member_id = ? AND album = ?', int(ref.packs), p.member_id, ref.album);
});

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
  const orders = all(`SELECT id, ref, amount_cents, status, created_at, paid_at FROM payments
    WHERE member_id = ? AND purpose = 'figurinhas' AND json_extract(ref, '$.album') = ? AND (status IN ('aberto','aguardando') OR created_at > datetime('now', '-30 days'))
    ORDER BY id DESC LIMIT 10`, req.actor.id, a.id).map(({ ref, ...o }) => ({ ...o, packs: JSON.parse(ref).packs }));
  res.json({
    id: a.id, name: a.name, total: a.total, price_cents: a.price_cents, pack_size: a.pack_size, options: PACK_OPTIONS,
    repeats_per_free_pack: REPEATS_PER_FREE_PACK, min_packs: MIN_PACKS_TO_COMPLETE, pay_mode: payMode(), pix_ready: payMode() !== 'off',
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
  // DBV+: figurinhas em triplo (3 pacotinhos pelo preço de 1).
  const got = isPlus(req.actor.id) ? packs * PLUS_PACK_MULT : packs;
  const p = await createPayment({
    memberId: req.actor.id, purpose: 'figurinhas', ref: { album: a.id, packs: got },
    title: `${got} pacotinho${got > 1 ? 's' : ''} de figurinhas${got > packs ? ' (triplo DBV+)' : ''}`, amountCents: packs * a.price_cents,
  });
  res.json(await paymentOut(p));
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

// Troca 25 repetidas por 1 pacotinho grátis (tira primeiro das que têm mais cópias).
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
export default r;
