// Skins dos jogos: 10 de menino e 10 de menina (valem para o Surf DBV e o Stumble DBV) e 30 skates
// para o Surf DBV. Roupas comportadas: saias e vestidos no joelho ou abaixo, sem brincos nem colares.
//
// hair: curto | espetado | lateral | cacheado | black | raspado | topete | longo | rabo | coque | trancas | chanel | maria | ondulado
// top: camiseta | manga | moletom | jaqueta | uniforme | polo | colete | vestido | regata-sem (não usado) ...
// bottom: calca | bermuda | saia | saia-longa | (vestido usa a cor do top)
// hat: bone | bone-tras | gorro | faixa | chapeu | boina | capacete | null
// acc: mochila | oculos | lenco | fone | cachecol | null
import { api } from '../../../api.js';

const TONES = ['#f8d5b8', '#efc39e', '#d9a07a', '#b97a52', '#8d5a3b', '#5e3a24'];
const M = (id, name, o) => ({ id, name, g: 'm', skin: TONES[1], hair: 'curto', hairColor: '#2b1a10', eyes: '#3b2a1a', shoes: '#f8fafc', shoes2: '#ef4444', bottom: { type: 'calca', color: '#1e3a8a' }, ...o });
const F = (id, name, o) => ({ id, name, g: 'f', skin: TONES[0], hair: 'longo', hairColor: '#3b2314', eyes: '#3b2a1a', shoes: '#f8fafc', shoes2: '#ec4899', bottom: { type: 'saia', color: '#1e3a8a' }, ...o });
const top = (type, color, color2 = '#ffffff', extra = {}) => ({ type, color, color2, ...extra });

export const SKINS = [
  // ───────────── Meninos ─────────────
  M('m01', 'Desbravador de gala', { top: top('uniforme', '#c9a66b', '#facc15'), bottom: { type: 'calca', color: '#1f4d33' }, hat: { type: 'chapeu', color: '#8b6b3d' }, acc: { type: 'lenco', color: '#facc15' }, shoes: '#111827', shoes2: '#111827' }),
  M('m03', 'Skatista', { top: top('moletom', '#f97316', '#1f2937'), bottom: { type: 'calca', color: '#334155' }, hat: { type: 'bone-tras', color: '#0ea5e9' }, hair: 'espetado', hairColor: '#7c2d12' }),
  M('m07', 'Campista', { top: top('jaqueta', '#ea580c', '#fde68a'), bottom: { type: 'calca', color: '#78350f' }, hat: { type: 'gorro', color: '#dc2626' }, acc: { type: 'mochila', color: '#166534' } }),
  M('m09', 'Músico', { top: top('jaqueta', '#7c3aed', '#111827'), bottom: { type: 'calca', color: '#111827' }, acc: { type: 'fone', color: '#e11d48' }, hair: 'cacheado', skin: TONES[4] }),
  M('m13', 'Piloto', { top: top('jaqueta', '#1e3a8a', '#facc15'), bottom: { type: 'calca', color: '#1e293b' }, hat: { type: 'bone', color: '#1e3a8a' }, acc: { type: 'oculos', color: '#0f172a' } }),
  M('m15', 'Inverno', { top: top('moletom', '#2563eb', '#ffffff'), bottom: { type: 'calca', color: '#1e293b' }, hat: { type: 'gorro', color: '#ffffff' }, acc: { type: 'cachecol', color: '#dc2626' } }),
  M('m17', 'Noite de gala', { top: top('terno', '#111827', '#ffffff'), bottom: { type: 'calca', color: '#111827' }, shoes: '#111827', shoes2: '#111827', hair: 'lateral' }),
  M('m22', 'Robótica', { top: top('camiseta', '#475569', '#22d3ee', { logo: true }), bottom: { type: 'calca', color: '#1e293b' }, acc: { type: 'oculos', color: '#22d3ee' }, hair: 'espetado', hairColor: '#111827', skin: TONES[5] }),
  M('m27', 'Artista', { top: top('camiseta', '#ffffff', '#ec4899', { paint: true }), bottom: { type: 'calca', color: '#3b82f6' }, hat: { type: 'boina', color: '#dc2626' }, hair: 'cacheado', hairColor: '#111827' }),
  M('m28', 'Líder DBV', { top: top('polo', '#1e3a8a', '#facc15', { logo: true }), bottom: { type: 'calca', color: '#334155' }, acc: { type: 'lenco', color: '#facc15' }, hair: 'lateral', skin: TONES[2] }),

  // ───────────── Meninas ─────────────
  F('f01', 'Desbravadora de gala', { legs: '#e7e5e4', top: top('uniforme', '#c9a66b', '#facc15'), bottom: { type: 'saia', color: '#1f4d33' }, hat: { type: 'boina', color: '#14532d' }, acc: { type: 'lenco', color: '#facc15' }, hair: 'coque', shoes: '#111827', shoes2: '#111827' }),
  F('f03', 'Skatista', { top: top('moletom', '#a855f7', '#fdf4ff'), bottom: { type: 'calca', color: '#334155' }, hat: { type: 'bone-tras', color: '#ec4899' }, hair: 'rabo', hairColor: '#7c2d12' }),
  F('f05', 'Jogadora de basquete', { top: top('camiseta', '#7c3aed', '#ffffff', { number: '23' }), bottom: { type: 'calca', color: '#7c3aed' }, hat: { type: 'faixa', color: '#ffffff' }, hair: 'trancas', hairColor: '#111827', skin: TONES[4] }),
  F('f07', 'Campista', { top: top('jaqueta', '#f97316', '#fde68a'), bottom: { type: 'calca', color: '#78350f' }, hat: { type: 'gorro', color: '#ec4899' }, acc: { type: 'mochila', color: '#166534' }, hair: 'trancas' }),
  F('f12', 'Cientista', { top: top('jaleco', '#ffffff', '#a855f7'), bottom: { type: 'calca', color: '#334155' }, acc: { type: 'oculos', color: '#0f172a' }, hair: 'rabo', hairColor: '#ea580c' }),
  F('f15', 'Inverno', { top: top('moletom', '#f472b6', '#ffffff'), bottom: { type: 'calca', color: '#1e293b' }, hat: { type: 'gorro', color: '#ffffff' }, acc: { type: 'cachecol', color: '#7c3aed' }, hair: 'longo' }),
  F('f17', 'Noite de gala', { top: top('vestido', '#1e3a8a', '#93c5fd'), bottom: { type: 'saia-longa', color: '#1e3a8a' }, hair: 'coque', hairColor: '#111827', shoes: '#111827', shoes2: '#111827' }),
  F('f24', 'Florista', { legs: '#fecdd3', top: top('vestido', '#fda4af', '#fff1f2', { flower: true }), bottom: { type: 'vestido', color: '#fda4af' }, hair: 'maria', hairColor: '#7c2d12' }),
  F('f28', 'Líder DBV', { legs: '#1f2937', top: top('polo', '#1e3a8a', '#facc15', { logo: true }), bottom: { type: 'saia', color: '#334155' }, acc: { type: 'lenco', color: '#facc15' }, hair: 'coque', skin: TONES[2] }),
  F('f30', 'Estrela', { top: top('jaqueta', '#e11d48', '#fde047'), bottom: { type: 'calca', color: '#1f2937' }, hair: 'longo', hairColor: '#b91c1c', acc: { type: 'oculos', color: '#fde047' } }),
];

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
