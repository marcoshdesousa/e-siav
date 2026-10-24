// Sequências (Ano Bíblico, Meditação e Escola Sabatina) e o prêmio de cada dia concluído:
// pontos no ranking (membro, unidade e clube) e 1 pacotinho do Álbum Bíblico.
import { run } from './db.js';

/** Dias seguidos (AAAA-MM-DD) feitos no próprio dia até hoje; hoje ainda sem fazer não quebra. */
export function dateStreak(dates, today) {
  const set = new Set(dates);
  const d = new Date(today + 'T12:00:00Z');
  if (!set.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (set.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}
export function bestDateStreak(dates) {
  const days = [...new Set(dates)].sort();
  let best = 0;
  let cur = 0;
  days.forEach((x, i) => {
    const prev = i && new Date(new Date(x + 'T12:00:00Z').getTime() - 864e5).toISOString().slice(0, 10) === days[i - 1];
    cur = prev ? cur + 1 : 1;
    best = Math.max(best, cur);
  });
  return best;
}

/** 1 pacotinho do Álbum Bíblico. */
export function giveBiblePack(memberId, packs = 1, { repeat = false } = {}) {
  run('INSERT OR IGNORE INTO album_progress (member_id, album) VALUES (?, ?)', memberId, 'biblico');
  run('UPDATE album_progress SET packs_unopened = packs_unopened + ?, repeat_packs = repeat_packs + ? WHERE member_id = ? AND album = ?', packs, repeat ? packs : 0, memberId, 'biblico');
}
