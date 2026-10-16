// Gera server/data/ano-biblico-2027.json a partir de scripts/plano-ano-biblico.txt (um dia por linha).
// Uso: node scripts/plano-ano-biblico.mjs
import fs from 'node:fs';

const BIBLE = JSON.parse(fs.readFileSync('server/data/biblia-jfaal.json', 'utf8'));
const START = '2027-03-01';
const bookIdx = new Map(BIBLE.books.map((b, i) => [b.name, i]));
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** "Gênesis 31:2-3,17-18" → [0, 31, [[2,3],[17,18]]]; "Gênesis 1" → [0, 1] */
function parseRef(s) {
  const m = s.trim().match(/^(.+?) (\d+)(?::([\d,\s-]+))?$/);
  if (!m) throw new Error(`não entendi "${s}"`);
  const b = bookIdx.get(m[1]);
  if (b == null) throw new Error(`livro "${m[1]}"`);
  const c = +m[2];
  const verses = BIBLE.books[b].chapters[c - 1];
  if (!verses) throw new Error(`${s}: capítulo não existe`);
  if (!m[3]) return [b, c];
  const ranges = m[3].split(',').map((p) => { const [a, z = a] = p.split('-').map(Number); return [a, z]; });
  for (const [a, z] of ranges) if (!(a >= 1 && z >= a && z <= verses.length)) throw new Error(`${s}: versículos fora (${verses.length} no capítulo)`);
  return [b, c, ranges];
}
const bookName = (b, many) => (b === 18 ? (many ? 'Salmos' : 'Salmo') : BIBLE.books[b].name.replace(/^(\d)ª /, '$1 '));
const join = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs.at(-1)}`);
function label(refs) {
  const groups = [];
  for (const r of refs) { const g = groups.at(-1); if (g && g.b === r[0]) g.refs.push(r); else groups.push({ b: r[0], refs: [r] }); }
  return groups.map((g) => `${bookName(g.b, g.refs.length > 1)} ${join(g.refs.map(([, c, rg]) => (rg ? `${c}:${rg.map(([a, z]) => (a === z ? a : `${a}-${z}`)).join(', ')}` : String(c))))}`).join('; ');
}

const lines = fs.readFileSync('scripts/plano-ano-biblico.txt', 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const days = lines.map((l, i) => {
  const chapters = l.split(';').map(parseRef);
  return { day: i + 1, date: addDays(START, i), chapters, label: label(chapters) };
});
const end = days.at(-1).date;
if (days.length !== 275 || end !== '2027-11-30') throw new Error(`plano com ${days.length} dias, termina em ${end}`);
fs.writeFileSync('server/data/ano-biblico-2027.json', JSON.stringify({ start: START, end, days }));
console.log(`${days.length} dias, ${START} a ${end}`);
for (const n of [1, 5, 12, 22, 41, 133, 149, 259, 275]) console.log(n, days[n - 1].date, days[n - 1].label);
