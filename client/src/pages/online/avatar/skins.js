// Skins dos jogos: 10 de menino e 10 de menina (valem para o Surf DBV e o Stumble DBV) e 30 skates
// para o Surf DBV. Os personagens são modelos de verdade (Universal Base Characters, de Quaternius,
// CC0) vestidos com roupas de desbravador montadas peça por peça (ver OUTFITS em build.js):
// gala (com lenço), campo, aventura (colete, com lenço), agasalho e camiseta. Cada skin escolhe a
// roupa, as cores de cada peça, o cabelo e a pele.
//
// hair: curto | raspado | longo | coque | raspado-f
import { api } from '../../../api.js';

const PELE = { clara: '#ffffff', media: '#f1d2b8', morena: '#d9a07a', parda: '#b98059', negra: '#8d5a3b', escura: '#6a4128' };
const CABELO = { preto: '#1b120c', castanho: '#3b2314', castanhoClaro: '#6b3a1f', ruivo: '#9a3b16', loiro: '#c79a3f' };
const M = (id, name, o) => ({ id, name, g: 'm', outfit: 'gala', hair: 'curto', hairColor: CABELO.castanho, skin: PELE.media, ...o });
const F = (id, name, o) => ({ id, name, g: 'f', outfit: 'gala', hair: 'longo', hairColor: CABELO.castanho, skin: PELE.clara, ...o });

export const SKINS = [
  // ───────────── Meninos ─────────────
  M('m01', 'Desbravador de gala', { outfit: 'gala', hairColor: CABELO.castanho, skin: PELE.media }),
  M('m03', 'Uniforme de campo', { outfit: 'campo', hair: 'curto', hairColor: CABELO.ruivo, skin: PELE.clara }),
  M('m07', 'Explorador', { outfit: 'aventura', hair: 'raspado', hairColor: CABELO.preto, skin: PELE.morena }),
  M('m09', 'Agasalho azul', { outfit: 'agasalho', hair: 'raspado', hairColor: CABELO.preto, skin: PELE.negra }),
  M('m13', 'Camiseta do clube', { outfit: 'camiseta', hair: 'curto', hairColor: CABELO.preto, skin: PELE.parda }),
  M('m15', 'Desbravador', { outfit: 'gala', hair: 'curto', hairColor: CABELO.loiro, skin: PELE.clara }),
  M('m17', 'Acampante', { outfit: 'campo', colors: { shirt: '#7a5a3a', pants: '#3f4a33' }, hair: 'curto', hairColor: CABELO.castanho, skin: PELE.media }),
  M('m22', 'Trilheiro', { outfit: 'aventura', colors: { shirt: '#c6a77a', pants: '#2f3b4f' }, hair: 'raspado', hairColor: CABELO.preto, skin: PELE.escura }),
  M('m27', 'Agasalho verde', { outfit: 'agasalho', colors: { shirt: '#2f7d4f', pants: '#1f3d2c' }, hair: 'curto', hairColor: CABELO.castanhoClaro, skin: PELE.media }),
  M('m28', 'Líder DBV', { outfit: 'gala', colors: { shirt: '#e8dcc4', pants: '#1c2238' }, hair: 'curto', hairColor: CABELO.castanho, skin: PELE.morena }),

  // ───────────── Meninas ─────────────
  F('f01', 'Desbravadora de gala', { outfit: 'gala', hair: 'longo', hairColor: CABELO.castanhoClaro, skin: PELE.clara }),
  F('f03', 'Uniforme de campo', { outfit: 'campo', hair: 'coque', hairColor: CABELO.ruivo, skin: PELE.clara }),
  F('f05', 'Exploradora', { outfit: 'aventura', hair: 'coque', hairColor: CABELO.preto, skin: PELE.negra }),
  F('f07', 'Agasalho rosa', { outfit: 'agasalho', colors: { shirt: '#d9668f', pants: '#5b2a43' }, hair: 'longo', hairColor: CABELO.castanho, skin: PELE.morena }),
  F('f12', 'Camiseta do clube', { outfit: 'camiseta', hair: 'coque', hairColor: CABELO.loiro, skin: PELE.clara }),
  F('f15', 'Desbravadora', { outfit: 'gala', hair: 'longo', hairColor: CABELO.loiro, skin: PELE.media }),
  F('f17', 'Acampante', { outfit: 'campo', colors: { shirt: '#8a5a7a', pants: '#3f4a33' }, hair: 'longo', hairColor: CABELO.preto, skin: PELE.parda }),
  F('f24', 'Trilheira', { outfit: 'aventura', colors: { shirt: '#c6a77a', pants: '#2f3b4f' }, hair: 'coque', hairColor: CABELO.castanho, skin: PELE.media }),
  F('f28', 'Líder DBV', { outfit: 'gala', colors: { shirt: '#e8dcc4', pants: '#1c2238' }, hair: 'coque', hairColor: CABELO.preto, skin: PELE.escura }),
  F('f30', 'Agasalho azul', { outfit: 'agasalho', hair: 'raspado-f', hairColor: CABELO.ruivo, skin: PELE.morena }),
];
// Cor que aparece no fundo da foto de cada skin (a cor da camisa)
const SHIRT = { gala: '#d8c49a', campo: '#5f7d3c', aventura: '#c6a77a', agasalho: '#2b4c9b', camiseta: '#f2c94c' };
for (const s of SKINS) s.top = { color: s.colors?.shirt || SHIRT[s.outfit] };

/** O guarda que corre atrás no Surf DBV: camisa azul, calça escura e bota. */
export const GUARD = { id: 'guarda', name: 'Guarda', g: 'm', outfit: 'campo', colors: { shirt: '#3f5fa8', pants: '#1e2433', shoes: '#151515' }, hair: 'raspado', hairColor: CABELO.preto, skin: PELE.morena, top: { color: '#1e3a8a' } };

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

// ───────────── Skates (Surf DBV) ─────────────
const PATTERNS = ['listras', 'chamas', 'estrelas', 'ondas', 'xadrez', 'bolinhas', 'raio', 'logo', 'degrade', 'galaxia'];
const BOARD_COLORS = [
  ['#2563eb', '#facc15', '#38bdf8'], ['#dc2626', '#f97316', '#fb923c'], ['#16a34a', '#a3e635', '#4ade80'], ['#7c3aed', '#f0abfc', '#c084fc'],
  ['#0f172a', '#22d3ee', '#22d3ee'], ['#ec4899', '#ffffff', '#f9a8d4'], ['#f59e0b', '#7c2d12', '#fbbf24'], ['#0d9488', '#ccfbf1', '#2dd4bf'],
  ['#1e3a8a', '#ef4444', '#60a5fa'], ['#111827', '#facc15', '#fde047'], ['#f43f5e', '#1e293b', '#fb7185'], ['#84cc16', '#14532d', '#bef264'],
  ['#0ea5e9', '#f8fafc', '#7dd3fc'], ['#9333ea', '#22d3ee', '#a78bfa'], ['#ea580c', '#fef08a', '#fdba74'],
];
const BOARD_NAMES = [
  'Azulão', 'Fogo DBV', 'Mato', 'Chama Roxa', 'Noturno', 'Algodão-doce', 'Estrelado', 'Menta Galáctica', 'Raio Azul', 'Abelha', 'Rubi', 'Limão DBV', 'Céu Xadrez', 'Neon', 'Pôr do sol',
  'Confete Azul', 'Estrela Vermelha', 'Aurora', 'Relâmpago', 'Onda Neon', 'Doce', 'Desbravador', 'Xadrez Turquesa', 'Cometa', 'Ouro', 'Morango', 'Estrela Verde', 'Galáxia', 'Trovão', 'Lava',
];
export const BOARDS = BOARD_NAMES.map((name, i) => {
  const [c1, c2, glow] = BOARD_COLORS[i % BOARD_COLORS.length];
  return { id: `b${String(i + 1).padStart(2, '0')}`, name, c1, c2, glow, pattern: PATTERNS[(i * 7) % PATTERNS.length], fins: i % 3 };
});
export const boardById = (id) => BOARDS.find((b) => b.id === id) || BOARDS[0];

// ───────────── Escolha salva (aparelho + servidor) ─────────────
export function readChoice() {
  try {
    const v = JSON.parse(window.localStorage.getItem('dbv-skin') || 'null');
    if (v?.skin) return { skin: skinById(v.skin).id, board: boardById(v.board).id };
  } catch { /* sem armazenamento */ }
  // Compatibilidade: escolhas antigas
  let f = false;
  try { f = window.localStorage.getItem('dbv-corrida-menina') === '1'; } catch { /* nada */ }
  return { skin: f ? 'f01' : 'm01', board: 'b01' };
}
export function saveChoice(c) {
  try { window.localStorage.setItem('dbv-skin', JSON.stringify(c)); } catch { /* sem armazenamento */ }
}

/** Lê a escolha salva no servidor (se houver) e guarda no aparelho. */
export async function syncChoice() {
  try {
    const r = await api.get('/jogos/skin');
    if (r?.skin) { const c = { skin: skinById(r.skin).id, board: boardById(r.board).id }; saveChoice(c); return c; }
  } catch { /* sem internet: fica a do aparelho */ }
  return readChoice();
}
