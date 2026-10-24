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
  assert.equal(setting('ano_biblico_inicio'), '2027-01-01');
  assert.equal(setting('ranking_inicio'), '2027-01-01T03:00:00.000Z');
  if (bl) assert.equal(get(`SELECT COUNT(*) n FROM ${bl}`).n, blCount, 'Bom Líder continua');
  assert.equal(yearTurnover('2028-01-01'), true, 'e no ano seguinte de novo');
});
