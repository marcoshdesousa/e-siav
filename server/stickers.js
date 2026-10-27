// Álbuns de figurinhas. O Álbum Bíblico funciona com pacotinhos pagos no Pix
// (R$ 1,85 por pacotinho com 4 figurinhas). O Palmares 27 ainda está em breve.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const biblico = JSON.parse(fs.readFileSync(path.join(here, '..', 'client', 'src', 'pages', 'albums', 'biblico.json'), 'utf8'));

export const ALBUMS = {
  biblico: {
    id: 'biblico', name: biblico.name || 'Álbum Bíblico', active: true,
    total: biblico.stickers.length, pack_size: 6, price_cents: 185,
    rarity: Object.fromEntries(biblico.stickers.map((s) => [s.id, s.rarity])),
  },
};
export const PACK_OPTIONS = [1, 10, 20, 50];
export const REPEATS_PER_FREE_PACK = 25;
// Ninguém completa o álbum antes de abrir 300 pacotinhos (a última figurinha só sai do 300º em diante).
export const MIN_PACKS_TO_COMPLETE = 300;

// ---------- Sorteio ----------
// Pacotinho com 6 figurinhas. Os 5 primeiros não têm repetidas. Depois, a chance de vir figurinha
// nova cai conforme o álbum vai ficando completo, e alguns pacotinhos vêm só com repetidas.
// A última figurinha só sai a partir do 300º pacotinho aberto. Em média, completa por volta do
// 310º aberto (~240 ganhos ou comprados; o resto vem das trocas de repetidas). Raras e lendárias saem menos.
export const ODDS = { freshPacks: 5, base: 0.03, extra: 0.45, curve: 1.2, allRepeatsPack: 0.15 };
const WEIGHT = { comum: 10, rara: 4, lendaria: 1.5 };

function randomFloat() { return crypto.randomInt(0, 1_000_000_000) / 1_000_000_000; }
function weightedPick(items) {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = randomFloat() * total;
  for (const [k, w] of items) { r -= w; if (r <= 0) return k; }
  return items[items.length - 1][0];
}

/**
 * Sorteia um pacotinho. owned: Set com as figurinhas que a pessoa já tem (coladas ou não).
 * packsOpened: quantos pacotinhos ela já abriu antes deste.
 */
export function drawPack(album, owned, packsOpened, { repeat = false } = {}) {
  const a = ALBUMS[album];
  const ids = Object.keys(a.rarity).map(Number);
  const fresh = packsOpened < ODDS.freshPacks;
  // Pacotinho do "clube entrou hoje": só repetidas (menos nos primeiros pacotinhos, que nunca repetem).
  const allRepeats = !fresh && owned.size > 0 && (repeat || randomFloat() < ODDS.allRepeatsPack);
  const have = new Set(owned);
  const out = [];
  const thisPack = packsOpened + 1;
  for (let k = 0; k < a.pack_size; k++) {
    const missing = ids.filter((i) => !have.has(i));
    const gated = missing.length === 1 && thisPack < MIN_PACKS_TO_COMPLETE;
    const pNew = fresh ? 1 : allRepeats || gated ? 0 : ODDS.base + ODDS.extra * (missing.length / ids.length) ** ODDS.curve;
    if (missing.length && !gated && (have.size === 0 || randomFloat() < pNew)) {
      const id = weightedPick(missing.map((i) => [i, WEIGHT[a.rarity[i]] || 10]));
      have.add(id);
      out.push({ id, isNew: true });
    } else {
      const pool = [...have];
      out.push({ id: pool[crypto.randomInt(0, pool.length)], isNew: false });
    }
  }
  return out;
}

// ---------- Pix (copia e cola) ----------
function field(id, value) { const v = String(value); return id + String(v.length).padStart(2, '0') + v; }
function crc16(str) {
  let crc = 0xffff;
  for (const b of Buffer.from(str, 'utf8')) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
const plain = (s, n) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .-]/g, '').trim().slice(0, n).toUpperCase();

/** Código Pix "copia e cola" (BR Code estático com valor e identificador do pedido). */
export function pixCode({ key, name, city, amountCents, txid }) {
  const gui = field('00', 'br.gov.bcb.pix') + field('01', key);
  const payload = field('00', '01')
    + field('26', gui)
    + field('52', '0000')
    + field('53', '986')
    + field('54', (amountCents / 100).toFixed(2))
    + field('58', 'BR')
    + field('59', plain(name, 25) || 'APP DO DBV')
    + field('60', plain(city, 15) || 'PALMARES')
    + field('62', field('05', plain(txid, 25).replace(/[^A-Z0-9]/g, '') || '***'))
    + '6304';
  return payload + crc16(payload);
}
