// Skins dos jogos: 10 de menino e 10 de menina (valem para o Surf DBV e o Stumble DBV) e 30 skates
// para o Surf DBV. Os personagens são modelos de verdade (Universal Base Characters, de Quaternius,
// CC0): roupa de aventureiro (ranger) ou de camisa e calça (casual). Aqui só se escolhe a roupa,
// o cabelo e as cores (a cor da roupa "tinge" o tecido do modelo).
//
// outfit: ranger | casual · hair: curto | raspado | longo | coque | raspado-f
import { api } from '../../../api.js';

const PELE = { clara: '#ffffff', media: '#f1d2b8', morena: '#d9a07a', parda: '#b98059', negra: '#8d5a3b', escura: '#6a4128' };
const CABELO = { preto: '#1b120c', castanho: '#3b2314', castanhoClaro: '#6b3a1f', ruivo: '#9a3b16', loiro: '#c79a3f' };
const M = (id, name, o) => ({ id, name, g: 'm', outfit: 'ranger', hair: 'curto', hairColor: CABELO.castanho, skin: PELE.media, cloth: '#ffffff', ...o });
const F = (id, name, o) => ({ id, name, g: 'f', outfit: 'ranger', hair: 'longo', hairColor: CABELO.castanho, skin: PELE.clara, cloth: '#ffffff', ...o });

export const SKINS = [
  // ───────────── Meninos ─────────────
  M('m01', 'Desbravador', { outfit: 'ranger', cloth: '#ffffff', hairColor: CABELO.castanho, skin: PELE.media }),
  M('m03', 'Skatista', { outfit: 'casual', cloth: '#ffb28a', hair: 'curto', hairColor: CABELO.ruivo, skin: PELE.clara }),
  M('m07', 'Campista', { outfit: 'ranger', cloth: '#ffd29a', hair: 'raspado', hairColor: CABELO.preto, skin: PELE.morena }),
  M('m09', 'Músico', { outfit: 'casual', cloth: '#c9b6ff', hair: 'raspado', hairColor: CABELO.preto, skin: PELE.negra }),
  M('m13', 'Piloto', { outfit: 'casual', cloth: '#9ec2ff', hair: 'curto', hairColor: CABELO.preto, skin: PELE.parda }),
  M('m15', 'Inverno', { outfit: 'ranger', cloth: '#a8d4ff', hair: 'curto', hairColor: CABELO.loiro, skin: PELE.clara }),
  M('m17', 'Noite de gala', { outfit: 'casual', cloth: '#8a8fa3', hair: 'curto', hairColor: CABELO.castanho, skin: PELE.media }),
  M('m22', 'Robótica', { outfit: 'casual', cloth: '#b6f0ef', hair: 'raspado', hairColor: CABELO.preto, skin: PELE.escura }),
  M('m27', 'Artista', { outfit: 'ranger', cloth: '#ffb7d0', hair: 'curto', hairColor: CABELO.castanhoClaro, skin: PELE.media }),
  M('m28', 'Líder DBV', { outfit: 'casual', cloth: '#fff1a8', hair: 'curto', hairColor: CABELO.castanho, skin: PELE.morena }),

  // ───────────── Meninas ─────────────
  F('f01', 'Desbravadora', { outfit: 'ranger', cloth: '#ffffff', hair: 'longo', hairColor: CABELO.castanhoClaro, skin: PELE.clara }),
  F('f03', 'Skatista', { outfit: 'casual', cloth: '#d6b8ff', hair: 'coque', hairColor: CABELO.ruivo, skin: PELE.clara }),
  F('f05', 'Jogadora de basquete', { outfit: 'casual', cloth: '#ffcf9e', hair: 'coque', hairColor: CABELO.preto, skin: PELE.negra }),
  F('f07', 'Campista', { outfit: 'ranger', cloth: '#ffd29a', hair: 'longo', hairColor: CABELO.castanho, skin: PELE.morena }),
  F('f12', 'Cientista', { outfit: 'casual', cloth: '#ffffff', hair: 'coque', hairColor: CABELO.loiro, skin: PELE.clara }),
  F('f15', 'Inverno', { outfit: 'ranger', cloth: '#ffc3e1', hair: 'longo', hairColor: CABELO.loiro, skin: PELE.media }),
  F('f17', 'Noite de gala', { outfit: 'casual', cloth: '#9fb4ff', hair: 'longo', hairColor: CABELO.preto, skin: PELE.parda }),
  F('f24', 'Florista', { outfit: 'casual', cloth: '#ffb3cf', hair: 'coque', hairColor: CABELO.castanho, skin: PELE.media }),
  F('f28', 'Líder DBV', { outfit: 'ranger', cloth: '#fff1a8', hair: 'coque', hairColor: CABELO.preto, skin: PELE.escura }),
  F('f30', 'Estrela', { outfit: 'casual', cloth: '#ff9e9e', hair: 'raspado-f', hairColor: CABELO.ruivo, skin: PELE.morena }),
];
// Cor que aparece no fundo da foto de cada skin
for (const s of SKINS) s.top = { color: s.cloth === '#ffffff' ? (s.outfit === 'ranger' ? '#86efac' : '#e2e8f0') : s.cloth };

/** O guarda que corre atrás no Surf DBV. */
export const GUARD = { id: 'guarda', name: 'Guarda', g: 'm', outfit: 'casual', cloth: '#5a78c8', hair: 'raspado', hairColor: CABELO.preto, skin: PELE.morena, top: { color: '#1e3a8a' } };

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
