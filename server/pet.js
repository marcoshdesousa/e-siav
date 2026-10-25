// Meu Bichinho: o membro adota um bichinho (cachorro, gato ou ovelha) e cuida dele: dá comida
// (feita na cozinha), põe para dormir, dá banho, leva ao banheiro, limpa o cocô e faz carinho.
// As necessidades caem com o tempo, calculadas na hora em que a pessoa abre (não precisa de
// relógio rodando). Cuidar dá experiência; cada nível libera roupinhas novas. O bichinho não morre:
// só fica triste quando é esquecido.
import { get, run } from './db.js';

run(`CREATE TABLE IF NOT EXISTS pets (
  member_id INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  fome REAL NOT NULL DEFAULT 80,
  energia REAL NOT NULL DEFAULT 80,
  limpeza REAL NOT NULL DEFAULT 90,
  bexiga REAL NOT NULL DEFAULT 10,
  alegria REAL NOT NULL DEFAULT 80,
  cocos INTEGER NOT NULL DEFAULT 0,
  xixi_chao INTEGER NOT NULL DEFAULT 0,
  dormindo INTEGER NOT NULL DEFAULT 0,
  next_poop INTEGER,
  xp INTEGER NOT NULL DEFAULT 0,
  outfit TEXT NOT NULL DEFAULT '{}',
  last_ts INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`);
// Masculino (m) ou feminino (f): muda o rosto e as roupas que aparecem no closet.
try { run("ALTER TABLE pets ADD COLUMN gender TEXT NOT NULL DEFAULT 'm'"); } catch { /* já existe */ }

export const KINDS = ['cachorro', 'gato', 'ovelha'];
export const COLORS = {
  cachorro: ['caramelo', 'chocolate', 'branco', 'cinza'],
  gato: ['laranja', 'cinza', 'preto', 'branco'],
  ovelha: ['branca', 'creme', 'cinza', 'rosa'],
};

/** Comidas da cozinha: quanto enche (fome), alegria e a vontade de fazer xixi que dá. */
export const RECIPES = {
  frutas: { name: 'Salada de frutas', fome: 18, alegria: 6, bexiga: 8 },
  sopa: { name: 'Sopa de legumes', fome: 30, alegria: 4, bexiga: 14 },
  arroz: { name: 'Arroz com feijão', fome: 38, alegria: 5, bexiga: 6 },
  panqueca: { name: 'Panqueca', fome: 26, alegria: 8, bexiga: 4 },
  pao: { name: 'Pão caseiro', fome: 20, alegria: 5, bexiga: 3 },
  bolo: { name: 'Bolo de cenoura', fome: 14, alegria: 14, bexiga: 3 },
  suco: { name: 'Suco de laranja', fome: 6, alegria: 6, bexiga: 22 },
};

/** Roupinhas por parte do corpo: [id, nome, nível, gênero] (gênero '' = para todos). */
export const WARDROBE = {
  chapeu: [['bone', 'Boné', 1, 'm'], ['laco', 'Laço', 1, 'f'], ['chapeu-dbv', 'Chapéu de desbravador', 2, ''], ['flor', 'Flor no cabelo', 2, 'f'],
    ['gorro', 'Gorro de lã', 3, ''], ['tiara', 'Tiara de estrela', 4, 'f'], ['bone-tras', 'Boné para trás', 4, 'm'], ['coroa', 'Coroa', 6, '']],
  oculos: [['redondo', 'Óculos redondos', 2, ''], ['sol', 'Óculos de sol', 3, ''], ['coracao', 'Óculos de coração', 5, 'f'], ['aviador', 'Óculos aviador', 5, 'm']],
  rosto: [['blush', 'Bochechas rosadas', 1, 'f'], ['batom', 'Batom rosa', 2, 'f'], ['batom-vermelho', 'Batom vermelho', 4, 'f'], ['sardas', 'Sardinhas', 2, '']],
  pescoco: [['lenco', 'Lenço de desbravador', 1, ''], ['gravata', 'Gravata borboleta', 2, 'm'], ['colar', 'Colar de pérolas', 3, 'f'], ['cachecol', 'Cachecol', 4, '']],
  roupa: [['camiseta', 'Camiseta azul', 1, 'm'], ['blusa', 'Blusa rosa', 1, 'f'], ['pijama', 'Pijama de estrelas', 2, ''], ['uniforme', 'Uniforme de desbravador', 3, ''],
    ['vestido', 'Vestido de bolinhas', 3, 'f'], ['moletom', 'Moletom vermelho', 4, 'm'], ['macacao', 'Macacão de bichinho', 5, ''], ['capa', 'Capa de herói', 7, '']],
};
const ITEM = new Map(Object.entries(WARDROBE).flatMap(([slot, items]) => items.map(([id, , lvl, g]) => [id, { slot, lvl, g }])));
/** O closet de cada gênero. */
export const wardrobeFor = (gender) => Object.fromEntries(Object.entries(WARDROBE).map(([slot, items]) => [slot, items.filter((x) => !x[3] || x[3] === gender)]).filter(([, items]) => items.length));

export const XP_LEVEL = 120;
export const levelOf = (xp) => Math.floor(xp / XP_LEVEL) + 1;
const H = 3600e3;
const clamp = (v) => Math.max(0, Math.min(100, v));

/** Avança o tempo: a fome, o sono, a limpeza e a alegria caem; a bexiga enche; sai cocô. */
export function tick(p, now = Date.now()) {
  const hours = Math.min(96, Math.max(0, (now - p.last_ts) / H));
  if (hours <= 0) return p;
  const q = { ...p };
  q.fome = clamp(q.fome - hours * (q.dormindo ? 2.5 : 5));
  q.energia = clamp(q.dormindo ? q.energia + hours * 16 : q.energia - hours * 4.5);
  q.limpeza = clamp(q.limpeza - hours * (2.5 + q.cocos * 2 + q.xixi_chao * 2));
  const sad = (q.fome < 25) + (q.energia < 20) + (q.limpeza < 25) + (q.cocos > 0);
  q.alegria = clamp(q.alegria - hours * (3 + sad * 2));
  q.bexiga += hours * (q.dormindo ? 3 : 7);
  if (q.bexiga >= 100) { q.bexiga = 0; q.xixi_chao = 1; q.limpeza = clamp(q.limpeza - 20); } // não aguentou
  if (q.next_poop && now >= q.next_poop) { q.cocos = Math.min(3, q.cocos + 1); q.next_poop = null; }
  if (q.dormindo && q.energia >= 100) q.dormindo = 0; // acorda sozinho descansado
  q.last_ts = now;
  return q;
}

/** O que ele está sentindo agora (a necessidade mais forte). */
export function moodOf(p) {
  if (p.dormindo) return 'dormindo';
  if (p.bexiga >= 75) return 'apertado';
  if (p.fome < 25) return 'fome';
  if (p.energia < 20) return 'sono';
  if (p.cocos > 0 || p.xixi_chao || p.limpeza < 30) return 'sujo';
  if (p.alegria < 35) return 'triste';
  return 'feliz';
}

const SAVE_COLS = ['fome', 'energia', 'limpeza', 'bexiga', 'alegria', 'cocos', 'xixi_chao', 'dormindo', 'next_poop', 'xp', 'outfit', 'last_ts'];
function save(p) {
  run(`UPDATE pets SET ${SAVE_COLS.map((c) => `${c} = ?`).join(', ')} WHERE member_id = ?`, ...SAVE_COLS.map((c) => p[c]), p.member_id);
}

export function loadPet(memberId, now = Date.now()) {
  const row = get('SELECT * FROM pets WHERE member_id = ?', memberId);
  if (!row) return null;
  const p = tick(row, now);
  save(p);
  return p;
}

export function adopt(memberId, { kind, name, color, gender }, now = Date.now()) {
  if (!KINDS.includes(kind)) throw new Error('Escolha o bichinho');
  const n = String(name || '').trim().slice(0, 16);
  if (n.length < 2) throw new Error('Dê um nome com pelo menos 2 letras');
  const c = COLORS[kind].includes(color) ? color : COLORS[kind][0];
  const g = gender === 'f' ? 'f' : 'm';
  run('INSERT INTO pets (member_id, kind, name, color, gender, last_ts, outfit) VALUES (?, ?, ?, ?, ?, ?, ?)', memberId, kind, n, c, g, now, JSON.stringify({ pescoco: 'lenco' }));
  return loadPet(memberId, now);
}

/** Uma ação de cuidado. Devolve { pet, msg } ou lança Error com a frase do bichinho. */
export function act(p, action, arg, now = Date.now()) {
  const q = { ...p };
  const gain = (n) => { q.xp += n; };
  const awake = () => { if (q.dormindo) throw new Error(`${q.name} está dormindo. Acorde ele primeiro.`); };
  let msg;
  switch (action) {
    case 'comer': {
      awake();
      const r = RECIPES[arg];
      if (!r) throw new Error('Escolha uma comida');
      if (q.fome >= 95) throw new Error(`${q.name} está de barriga cheia!`);
      q.fome = clamp(q.fome + r.fome); q.alegria = clamp(q.alegria + r.alegria); q.bexiga = Math.min(99, q.bexiga + r.bexiga);
      if (!q.next_poop) q.next_poop = now + 3 * H;
      gain(10); msg = `Hum! ${r.name}! ${q.name} adorou.`;
      break;
    }
    case 'dormir':
      if (q.dormindo) { q.dormindo = 0; msg = `${q.name} acordou.`; break; }
      if (q.energia >= 90) throw new Error(`${q.name} está sem sono agora.`);
      q.dormindo = 1; gain(8); msg = `Boa noite, ${q.name}!`;
      break;
    case 'banho':
      awake();
      if (q.limpeza >= 95) throw new Error(`${q.name} já está limpinho.`);
      q.limpeza = 100; q.alegria = clamp(q.alegria + 5); gain(8); msg = `${q.name} está cheiroso!`;
      break;
    case 'xixi':
      awake();
      if (q.bexiga < 20) throw new Error(`${q.name} não está com vontade agora.`);
      q.bexiga = 0; gain(8); msg = `Ufa! ${q.name} fez xixi no banheiro.`;
      break;
    case 'limpar':
      if (!q.cocos && !q.xixi_chao) throw new Error('Não tem nada para limpar.');
      q.cocos = 0; q.xixi_chao = 0; q.limpeza = clamp(q.limpeza + 10); gain(8); msg = 'Tudo limpinho!';
      break;
    case 'carinho':
      awake();
      if (q.alegria < 100) gain(3);
      q.alegria = clamp(q.alegria + 12); msg = `${q.name} gostou do carinho!`;
      break;
    case 'vestir': {
      const outfit = JSON.parse(q.outfit || '{}');
      const it = ITEM.get(arg);
      if (it) {
        if (it.g && it.g !== q.gender) throw new Error('Essa roupa não é deste closet.');
        if (levelOf(q.xp) < it.lvl) throw new Error(`Essa libera no nível ${it.lvl}.`);
        if (outfit[it.slot] === arg) delete outfit[it.slot]; else outfit[it.slot] = arg; // tocar de novo tira
      } else if (WARDROBE[arg]) delete outfit[arg];
      else throw new Error('Roupa não encontrada');
      q.outfit = JSON.stringify(outfit); msg = null;
      break;
    }
    default:
      throw new Error('Ação inválida');
  }
  q.last_ts = now;
  save(q);
  return { pet: q, msg, levelUp: levelOf(q.xp) > levelOf(p.xp) };
}

export function view(p) {
  return {
    kind: p.kind, name: p.name, color: p.color, gender: p.gender || 'm', mood: moodOf(p), dormindo: !!p.dormindo,
    fome: Math.round(p.fome), energia: Math.round(p.energia), limpeza: Math.round(p.limpeza), bexiga: Math.round(p.bexiga), alegria: Math.round(p.alegria),
    cocos: p.cocos, xixi_chao: !!p.xixi_chao, outfit: JSON.parse(p.outfit || '{}'),
    level: levelOf(p.xp), xp: p.xp % XP_LEVEL, xp_next: XP_LEVEL,
  };
}

/** Lembrete do celular quando o bichinho precisa de algo (ou null). */
export function petReminder(memberId, now = Date.now()) {
  const p = loadPet(memberId, now);
  if (!p) return null;
  const n = p.name;
  const url = '/membro/jogos?aba=bichinho';
  if (p.cocos > 0 || p.xixi_chao) return { title: `${n} fez sujeira!`, body: `Venha limpar a bagunça do(a) ${n}.`, url };
  if (!p.dormindo && p.bexiga >= 70) return { title: `${n} está apertado!`, body: `Leve o(a) ${n} ao banheiro para fazer xixi.`, url };
  if (p.fome < 35) return { title: `${n} está com fome!`, body: `Faça uma comidinha na cozinha para o(a) ${n}.`, url };
  if (!p.dormindo && p.energia < 25) return { title: `${n} está com sono`, body: `Coloque o(a) ${n} para dormir.`, url };
  if (p.limpeza < 35) return { title: `${n} precisa de banho`, body: `Hora do banho do(a) ${n}!`, url };
  if (p.alegria < 35) return { title: `${n} está com saudade`, body: `Faça um carinho no(a) ${n}.`, url };
  return null;
}
