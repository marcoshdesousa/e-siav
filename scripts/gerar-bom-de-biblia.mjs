// Gera as fases 201 a 1000 do Bom de Bíblia a partir do texto da Bíblia do app (Almeida, os 66
// livros da Bíblia protestante, a mesma que a Igreja Adventista usa). Toda pergunta sai de um
// versículo de verdade e leva a referência. Sorteio com semente fixa: rodar de novo gera o mesmo.
//   node scripts/gerar-bom-de-biblia.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '..', 'server', 'data');
const OUT = path.join(DATA, 'bom-de-biblia');
const BIBLE = JSON.parse(fs.readFileSync(path.join(DATA, 'biblia-jfaal.json'), 'utf8'));

// ---------- Sorteio com semente ----------
let seed = 20271000;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => { const c = [...a]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; };

// ---------- Livros e grupos (para as alternativas parecidas) ----------
const BOOKS = BIBLE.books.map((b, i) => ({ i, name: b.name, chapters: b.chapters }));
const GROUP = (i) => (i <= 4 ? 'lei' : i <= 16 ? 'historicos' : i <= 21 ? 'poeticos' : i <= 26 ? 'profetas-maiores' : i <= 38 ? 'profetas-menores'
  : i <= 42 ? 'evangelhos' : i === 43 ? 'atos' : i <= 56 ? 'paulo' : i <= 64 ? 'gerais' : 'apocalipse');
const OT = (i) => i <= 38;
const ref = (b, c, v) => `${b === 18 ? 'Salmos' : BOOKS[b].name} ${c}:${v}`;

// ---------- Palavras ----------
const STOP = new Set(('porque quando então sobre entre todos todas aquele aquela aqueles aquelas estes estas esses essas também assim porém contra diante '
  + 'depois antes ainda outro outra outros outras mesmo mesma nosso nossa nossos nossas vosso vossa vossos vossas havia tinha sendo eles elas dele dela '
  + 'deles delas isto isso aquilo cujo cuja tendo seja sejam disse dizer dizendo fazer feito estava estavam serão será seria foram fosse estão nenhum '
  + 'nenhuma qualquer muito muitos muita muitas pois onde como para pelo pela pelos pelas desde enquanto contudo todavia senão segundo conforme '
  + 'naquele naquela daquele daquela neste nesta nesse nessa deste desta desse dessa vosso eram será hoje agora nunca sempre').split(' '));
// Títulos com maiúscula que não são nomes de pessoas ou lugares.
const TITLES = new Set('Deus Senhor SENHOR Espírito Santo Pai Filho Altíssimo Todo-Poderoso Rei Cordeiro Salvador Redentor Criador Amém Aleluia Eis Ai Ó Oh Porque Quando Então E Mas O A Os As Um Uma Eu Tu Ele Ela Nós Vós Eles Elas Não Sim Assim Por Para Pois Que Como Se Bem-aventurado Bem-aventurados Ora Também Depois Disse Vinde Ide'.split(' '));
const clean = (w) => w.replace(/^[«"“'(\[]+|[»"”'),.;:!?\]]+$/g, '');
const wordsOf = (t) => t.split(/\s+/).map(clean).filter(Boolean);
// Nome próprio: com maiúscula e que nunca aparece com minúscula na Bíblia (assim "Hoje", "Esta",
// "Amanhã" no começo de uma frase não contam como nome).
const LOWER = new Set();
for (const b of BIBLE.books) for (const ch of b.chapters) for (const t of ch) for (const w of t.split(/\s+/)) { const c = w.replace(/^[^\p{L}]+|[^\p{L}-]+$/gu, ''); if (/^[a-záéíóúâêôãõçü]/.test(c)) LOWER.add(c); }
const isName = (w, idx) => idx > 0 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçü-]{2,}$/.test(w) && !TITLES.has(w) && !LOWER.has(w.toLowerCase());
const goodWord = (w) => w.length >= 5 && /^[a-záéíóúâêôãõçü-]+$/.test(w) && !STOP.has(w);

// Todos os versículos, com os nomes e as palavras de cada livro (para as alternativas).
const VERSES = [];
const NAMES = BOOKS.map(() => new Set());
const WORDS = BOOKS.map(() => new Set());
BOOKS.forEach((b) => b.chapters.forEach((ch, ci) => ch.forEach((t, vi) => {
  const ws = wordsOf(t);
  ws.forEach((w, k) => { if (isName(w, k)) NAMES[b.i].add(w); else if (goodWord(w)) WORDS[b.i].add(w); });
  VERSES.push({ b: b.i, c: ci + 1, v: vi + 1, t: t.trim(), n: ws.length });
})));
const ALL_NAMES = new Set(NAMES.flatMap((s) => [...s]));
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '');

// Versículos que se repetem quase iguais em outros livros (Reis/Crônicas, Evangelhos): não servem para "em qual livro".
const seen = new Map();
for (const x of VERSES) { const k = norm(x.t).split(' ').slice(0, 7).join(' '); seen.set(k, (seen.get(k) || 0) + 1); }
const unique = (x) => seen.get(norm(x.t).split(' ').slice(0, 7).join(' ')) === 1;

const used = new Set();
const key = (x) => `${x.b}:${x.c}:${x.v}`;
function takeVerse(filter) {
  for (let tries = 0; tries < 4000; tries++) {
    const x = pick(VERSES);
    if (used.has(key(x)) || !filter(x)) continue;
    used.add(key(x));
    return x;
  }
  return null;
}
const options = (right, wrong) => {
  const opts = shuffle([right, ...wrong.slice(0, 3)]);
  return { options: opts, answer: opts.indexOf(right) };
};
/** Quanto dois trechos se parecem (palavras em comum, de 0 a 1). */
function similar(a, b) {
  const A = new Set(norm(a).split(' ').filter((w) => w.length > 2));
  const B = new Set(norm(b).split(' ').filter((w) => w.length > 2));
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(1, Math.min(A.size, B.size));
}
const quote = (t) => `"${t.replace(/\s+/g, ' ').replace(/[“”"]/g, '')}"`;

// ---------- Tipos de pergunta ----------
/** Complete o versículo (nome ou palavra que falta). */
function qComplete(level) {
  const maxWords = level === 'extremo' ? 24 : 20;
  const x = takeVerse((v) => v.n >= 7 && v.n <= maxWords);
  if (!x) return null;
  const raw = x.t.split(/\s+/);
  const inVerse = new Set(wordsOf(x.t).map((w) => w.toLowerCase()));
  const cands = raw.map((r, i) => ({ i, w: clean(r) })).filter(({ w, i }) => isName(w, i) || goodWord(w));
  if (!cands.length) return null;
  // Prefere nomes próprios (mais justos); senão, uma palavra comprida.
  const names = cands.filter(({ w, i }) => isName(w, i) && ALL_NAMES.has(w));
  const target = names.length && rnd() < 0.7 ? pick(names) : pick(cands.filter(({ w }) => w.length >= 6).length ? cands.filter(({ w }) => w.length >= 6) : cands);
  const w = target.w;
  const name = isName(w, target.i);
  let pool;
  if (name) {
    pool = [...NAMES[x.b]].filter((n) => n !== w && !inVerse.has(n.toLowerCase()));
    if (pool.length < 6) pool = [...ALL_NAMES].filter((n) => n !== w && !inVerse.has(n.toLowerCase()));
  } else {
    const end = w.slice(-2);
    pool = [...WORDS[x.b]].filter((o) => o !== w && o.slice(-2) === end && Math.abs(o.length - w.length) <= 2 && !inVerse.has(o));
    if (pool.length < 3) pool = [...WORDS[x.b]].filter((o) => o !== w && Math.abs(o.length - w.length) <= 2 && !inVerse.has(o));
  }
  if (pool.length < 3) return null;
  const wrong = shuffle(pool).slice(0, 3);
  const text = raw.map((r, i) => (i === target.i ? r.replace(w, '_____') : r)).join(' ');
  return { q: `Complete: ${quote(text)} (${ref(x.b, x.c, x.v)})`, ...options(w, wrong), ref: ref(x.b, x.c, x.v) };
}

/** Em qual livro está escrito? (alternativas do mesmo grupo de livros no extremo) */
function qBook(level) {
  const x = takeVerse((v) => v.n >= 8 && v.n <= 22 && unique(v));
  if (!x) return null;
  const sameGroup = BOOKS.filter((b) => b.i !== x.b && GROUP(b.i) === GROUP(x.b));
  const sameTest = BOOKS.filter((b) => b.i !== x.b && OT(b.i) === OT(x.b));
  let pool = level === 'extremo' && sameGroup.length >= 3 ? sameGroup : rnd() < 0.5 && sameGroup.length >= 3 ? sameGroup : sameTest;
  pool = shuffle(pool).slice(0, 3).map((b) => b.name);
  return { q: `Em qual livro da Bíblia está escrito: ${quote(x.t)}`, ...options(BOOKS[x.b].name, pool), ref: ref(x.b, x.c, x.v) };
}

/** Como continua o versículo? */
function qContinue(level) {
  const x = takeVerse((v) => v.n >= 12 && v.n <= (level === 'extremo' ? 26 : 22) && /[,;:]/.test(v.t));
  if (!x) return null;
  const cut = x.t.search(/[,;:]\s/);
  if (cut < 15 || cut > x.t.length - 20) return null;
  const head = x.t.slice(0, cut + 1).trim();
  const tail = x.t.slice(cut + 1).trim().replace(/[.;:,]$/, '');
  // Finais de outros versículos do mesmo livro (no extremo, do mesmo capítulo ou vizinhos).
  const others = VERSES.filter((v) => v.b === x.b && key(v) !== key(x) && /[,;:]\s/.test(v.t)
    && (level !== 'extremo' || Math.abs(v.c - x.c) <= 3));
  // Nada parecido demais com a resposta certa (não pode ter duas certas).
  const tails = shuffle(others).map((v) => v.t.slice(v.t.search(/[,;:]\s/) + 1).trim().replace(/[.;:,]$/, ''))
    .filter((t) => t.length >= 20 && Math.abs(t.length - tail.length) < 40 && t !== tail && similar(t, tail) < 0.35);
  if (tails.length < 3) return null;
  return { q: `Como continua: ${quote(head)} (${ref(x.b, x.c, x.v)})`, ...options(tail, [...new Set(tails)].slice(0, 3)), ref: ref(x.b, x.c, x.v) };
}

/** Em qual capítulo está? (só no extremo) */
function qChapter() {
  const x = takeVerse((v) => v.n >= 8 && v.n <= 22 && BOOKS[v.b].chapters.length >= 5 && unique(v));
  if (!x) return null;
  const total = BOOKS[x.b].chapters.length;
  const near = shuffle([-4, -3, -2, -1, 1, 2, 3, 4, 5, -5].map((d) => x.c + d).filter((c) => c >= 1 && c <= total)).slice(0, 3);
  if (near.length < 3) return null;
  return { q: `Em qual capítulo de ${x.b === 18 ? 'Salmos' : BOOKS[x.b].name} está escrito: ${quote(x.t)}`, ...options(`Capítulo ${x.c}`, near.map((c) => `Capítulo ${c}`)), ref: ref(x.b, x.c, x.v) };
}

/** Perguntas sobre os livros (ordem e quantidade de capítulos). Cada uma uma vez só. */
const bookFacts = [];
BOOKS.forEach((b) => {
  if (b.i < 65) {
    const wrong = shuffle(BOOKS.filter((o) => o.i !== b.i + 1 && Math.abs(o.i - b.i) <= 6 && o.i !== b.i)).slice(0, 3).map((o) => o.name);
    bookFacts.push({ q: `Na ordem da Bíblia, qual livro vem logo depois de ${b.name}?`, ...options(BOOKS[b.i + 1].name, wrong), ref: `${BOOKS[b.i + 1].name} 1:1` });
  }
  if (b.i > 0) {
    const wrong = shuffle(BOOKS.filter((o) => o.i !== b.i - 1 && Math.abs(o.i - b.i) <= 6 && o.i !== b.i)).slice(0, 3).map((o) => o.name);
    bookFacts.push({ q: `Na ordem da Bíblia, qual livro vem logo antes de ${b.name}?`, ...options(BOOKS[b.i - 1].name, wrong), ref: `${BOOKS[b.i - 1].name} 1:1` });
  }
  const n = b.chapters.length;
  const near = shuffle([n - 3, n - 2, n - 1, n + 1, n + 2, n + 3, n + 4].filter((x) => x >= 1)).slice(0, 3);
  bookFacts.push({ q: `Quantos capítulos tem o livro de ${b.name}?`, ...options(String(n), near.map(String)), ref: `${b.name} ${n}:1` });
});
const facts = shuffle(bookFacts);

// ---------- Montagem das fases ----------
const MIX = {
  'muito-dificil': [qComplete, qComplete, qComplete, qComplete, qBook, qBook, qBook, qContinue, qContinue, qContinue],
  extremo: [qComplete, qComplete, qComplete, qBook, qBook, qBook, qContinue, qContinue, qChapter, qChapter],
};
function phase(n, level) {
  const qs = [];
  const asked = new Set();
  // De vez em quando, uma pergunta sobre os livros da Bíblia.
  if (facts.length && n % 4 === 0) qs.push(facts.pop());
  for (const make of shuffle(MIX[level])) {
    if (qs.length >= 10) break;
    let q = null;
    for (let t = 0; t < 30 && !q; t++) { q = make(level); if (q && (asked.has(q.q) || q.options.some((o) => o.length > 140))) q = null; }
    if (q) { asked.add(q.q); qs.push(q); }
  }
  while (qs.length < 10) { const q = qComplete(level); if (q) qs.push(q); }
  return { phase: n, level, questions: shuffle(qs).slice(0, 10) };
}

const RANGES = [[201, 500, 'muito-dificil'], [501, 1000, 'extremo']];
let all = [];
for (const [from, to, level] of RANGES) for (let n = from; n <= to; n++) all.push(phase(n, level));
// Arquivos de 100 fases.
for (const f of fs.readdirSync(OUT)) if (Number(f.match(/^fases-(\d+)-/)?.[1]) >= 201) fs.rmSync(path.join(OUT, f));
for (let i = 0; i < all.length; i += 100) {
  const chunk = all.slice(i, i + 100);
  const name = `fases-${chunk[0].phase}-${chunk.at(-1).phase}.json`;
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(chunk, null, 1) + '\n');
}
const nq = all.reduce((s, p) => s + p.questions.length, 0);
console.log(`${all.length} fases, ${nq} perguntas (versículos usados: ${used.size})`);
all = null;
