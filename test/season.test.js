// Virada do ano: a partir de 2027, todo 1º de janeiro o Ano Bíblico recomeça e os rankings zeram.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dbv-season-'));
const { run, get } = await import('../server/db.js');
const { yearTurnover } = await import('../server/season.js');
const { setting } = await import('../server/fees.js');

test('virada: arquiva e zera Ano Bíblico, pontos e jogos; o Bom Líder continua', () => {
  const d = Number(run(`INSERT INTO districts (name) VALUES ('D')`).lastInsertRowid);
  const c = Number(run('INSERT INTO clubs (district_id, name) VALUES (?, ?)', d, 'C').lastInsertRowid);
  const m = Number(run(`INSERT INTO members (club_id, name, birth_date, cargo, code) VALUES (?, 'A B', '2013-01-01', 'Desbravador', '999001')`, c).lastInsertRowid);
  run('INSERT INTO bible_progress (member_id, day, best, attempts, completed_at, on_time) VALUES (?, 5, 5, 1, ?, 1)', m, new Date().toISOString());
  run('INSERT INTO bible_points (member_id, day, club_id) VALUES (?, 5, ?)', m, c);
  run(`INSERT INTO game_scores (member_id, game, best) VALUES (?, 'x', 10)`, m);
  const bl = get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'bom_lider%'`)?.name;
  const blCount = bl ? get(`SELECT COUNT(*) n FROM ${bl}`).n : 0;

  assert.equal(yearTurnover('2026-12-31'), false, 'antes de 2027 não faz nada');
  assert.equal(yearTurnover('2027-01-01'), true);
  assert.equal(yearTurnover('2027-01-02'), false, 'só uma vez por ano');
  for (const t of ['bible_progress', 'bible_points', 'game_scores']) {
    assert.equal(get(`SELECT COUNT(*) n FROM ${t}`).n, 0, t + ' zerado');
    assert.equal(get(`SELECT COUNT(*) n FROM ${t}_arquivo WHERE ano = 2026`).n, 1, t + ' arquivado');
  }
  assert.equal(setting('ano_biblico_inicio'), '2027-03-01');
  assert.equal(setting('ranking_inicio'), '2027-01-01T03:00:00.000Z');
  if (bl) assert.equal(get(`SELECT COUNT(*) n FROM ${bl}`).n, blCount, 'Bom Líder continua');
  assert.equal(yearTurnover('2028-01-01'), true, 'e no ano seguinte de novo');
});

test('sequência no app: 5 minutos no dia contam 1 dia; várias entradas no mesmo dia contam 1', async () => {
  const { ping, presenceSummary } = await import('../server/presence.js');
  const d = Number(run(`INSERT INTO districts (name) VALUES ('D2')`).lastInsertRowid);
  const c = Number(run('INSERT INTO clubs (district_id, name) VALUES (?, ?)', d, 'C2').lastInsertRowid);
  const m = Number(run(`INSERT INTO members (club_id, name, birth_date, cargo, code) VALUES (?, 'P Q', '2013-01-01', 'Desbravador', '999002')`, c).lastInsertRowid);
  const t0 = Date.now() - 10 * 60e3;
  for (let i = 0; i < 4; i++) ping(m, t0 + i * 60e3);
  assert.equal(ping(m, t0 + 4 * 1e3).today_minutes, 4, 'ping em menos de 50 s não conta');
  assert.equal(presenceSummary(m).streak, 0, '4 minutos ainda não contam');
  const s = ping(m, t0 + 5 * 60e3);
  assert.equal(s.today_done, true);
  assert.equal(s.streak, 1);
});

test('usar o app: membro ganha pacotinho e 10 pontos; clube que entra ganha 100 pontos e um pacotinho (repetido) para cada membro', async () => {
  const { ping, clubEntered } = await import('../server/presence.js');
  const { clubsRanking, membersRanking, openTable } = await import('../server/rankings.js');
  const { setSetting } = await import('../server/fees.js');
  setSetting('ranking_inicio', ''); // o teste da virada deixou a temporada em 2028
  const d = Number(run(`INSERT INTO districts (name) VALUES ('D3')`).lastInsertRowid);
  const c = Number(run('INSERT INTO clubs (district_id, name) VALUES (?, ?)', d, 'C3').lastInsertRowid);
  for (const k of ['membros', 'clubes']) openTable(`district:${d}`, k); // distrito novo: cria os rankings
  const m = Number(run(`INSERT INTO members (club_id, name, birth_date, cargo, code, status) VALUES (?, 'R S', '2013-01-01', 'Desbravador', '999003', 'ativo')`, c).lastInsertRowid);
  const packs = () => ({ ...(get(`SELECT packs_unopened, repeat_packs FROM album_progress WHERE member_id = ? AND album = 'biblico'`, m) || { packs_unopened: 0, repeat_packs: 0 }) });
  const t0 = Date.now() - 10 * 60e3;
  let last;
  for (let i = 0; i < 5; i++) last = ping(m, t0 + i * 60e3);
  assert.equal(last.rewarded_now, true);
  assert.equal(packs().packs_unopened, 1, '1 pacotinho por usar o app');
  assert.equal(ping(m, t0 + 6 * 60e3).rewarded_now, false, 'só uma vez por dia');
  assert.equal(membersRanking(d).find((r) => r.id === m).points, 10, '10 pontos');
  const e1 = clubEntered(c);
  assert.equal(e1.first, true);
  assert.equal(e1.streak, 1);
  assert.deepEqual(packs(), { packs_unopened: 2, repeat_packs: 1 }, 'pacotinho do clube (repetido)');
  assert.equal(clubEntered(c).first, false, 'entrar de novo no mesmo dia não conta');
  assert.equal(packs().packs_unopened, 2);
  assert.equal(clubsRanking(d).find((r) => r.id === c).points, 100, '100 pontos para o clube');
});

test('zerar estudos (uma vez): Ano Bíblico e Bom de Bíblia vão para o arquivo; Meditação continua; tudo abre em 2027', async () => {
  const { resetStudiesOnce } = await import('../server/season.js');
  const d = Number(run(`INSERT INTO districts (name) VALUES ('D9')`).lastInsertRowid);
  const c = Number(run('INSERT INTO clubs (district_id, name) VALUES (?, ?)', d, 'C9').lastInsertRowid);
  const m = Number(run(`INSERT INTO members (club_id, name, birth_date, cargo, code) VALUES (?, 'Z Z', '2013-01-01', 'Desbravador', '999009')`, c).lastInsertRowid);
  run('INSERT INTO bible_progress (member_id, day, best, attempts, completed_at, on_time) VALUES (?, 3, 5, 1, ?, 1)', m, new Date().toISOString());
  run('INSERT INTO bible_points (member_id, day, club_id) VALUES (?, 3, ?)', m, c);
  run('INSERT INTO bible_points (member_id, day, club_id) VALUES (?, 120261001, ?)', m, c); // Meditação
  run('INSERT INTO bdb_progress (member_id, phase, best, attempts, passed_at) VALUES (?, 1, 8, 1, ?)', m, new Date().toISOString());
  assert.equal(resetStudiesOnce(), true);
  assert.equal(resetStudiesOnce(), false, 'só uma vez');
  assert.equal(get('SELECT COUNT(*) n FROM bible_progress WHERE member_id = ?', m).n, 0);
  assert.equal(get('SELECT COUNT(*) n FROM bdb_progress WHERE member_id = ?', m).n, 0);
  assert.equal(get('SELECT COUNT(*) n FROM bdb_progress_arquivo WHERE member_id = ?', m).n, 1, 'guardado no arquivo');
  assert.deepEqual(get('SELECT GROUP_CONCAT(day) d FROM bible_points WHERE member_id = ?', m).d, '120261001', 'a Meditação continua');
  assert.equal(setting('ano_biblico_inicio'), '2027-03-01');
  assert.equal(setting('bom_lider_inicio'), '2027-01-01');
});
