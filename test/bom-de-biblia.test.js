// Bom de Bíblia: 1000 fases de 10 perguntas, todas com 4 alternativas diferentes e a resposta certa
// numa delas, e só livros da Bíblia protestante (os 66 livros, a Bíblia que a Igreja Adventista usa).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'server/data/bom-de-biblia';
const phases = fs.readdirSync(DIR).flatMap((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
const BOOKS = JSON.parse(fs.readFileSync('server/data/biblia-jfaal.json', 'utf8')).books.map((b) => b.name);

test('1000 fases em sequência, 10 perguntas cada, 4 alternativas diferentes', () => {
  const nums = phases.map((p) => p.phase).sort((a, b) => a - b);
  assert.equal(nums.length, 1000);
  nums.forEach((n, i) => assert.equal(n, i + 1, `fase ${i + 1}`));
  for (const p of phases) {
    assert.equal(p.questions.length, 10, `fase ${p.phase}`);
    for (const q of p.questions) {
      assert.equal(q.options.length, 4, q.q);
      assert.equal(new Set(q.options).size, 4, `alternativas repetidas: ${q.q}`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, q.q);
    }
  }
  const levels = new Set(phases.filter((p) => p.phase > 200).map((p) => p.level));
  assert.deepEqual([...levels].sort(), ['extremo', 'muito-dificil']);
});

test('só livros da Bíblia protestante (sem Tobias, Judite, Macabeus, Sabedoria, Eclesiástico, Baruque)', () => {
  const apocrifos = /\b(Tobias|Judite|Macabeus|Sabedoria|Eclesiástico|Baruque)\s+\d+:\d+/;
  for (const p of phases.filter((x) => x.phase > 200)) {
    for (const q of p.questions) {
      assert.ok(!apocrifos.test(q.ref || ''), q.ref);
      const book = (q.ref || '').replace(/\s+\d+:\d+$/, '');
      assert.ok(BOOKS.includes(book) || book === 'Salmos', `livro desconhecido: ${q.ref}`);
    }
  }
});
