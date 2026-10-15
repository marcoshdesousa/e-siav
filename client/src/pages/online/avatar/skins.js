// Skins dos jogos: 30 de menino e 30 de menina (valem para o Surf DBV e o Stumble DBV) e 30 skates
// para o Surf DBV. Roupas comportadas: saias e vestidos no joelho ou abaixo, sem brincos nem colares.
//
// hair: curto | espetado | lateral | cacheado | black | raspado | topete | longo | rabo | coque | trancas | chanel | maria | ondulado
// top: camiseta | manga | moletom | jaqueta | uniforme | polo | colete | vestido | regata-sem (não usado) ...
// bottom: calca | bermuda | saia | saia-longa | (vestido usa a cor do top)
// hat: bone | bone-tras | gorro | faixa | chapeu | boina | capacete | null
// acc: mochila | oculos | lenco | fone | cachecol | null
const TONES = ['#f8d5b8', '#efc39e', '#d9a07a', '#b97a52', '#8d5a3b', '#5e3a24'];
const M = (id, name, o) => ({ id, name, g: 'm', skin: TONES[1], hair: 'curto', hairColor: '#2b1a10', eyes: '#3b2a1a', shoes: '#f8fafc', shoes2: '#ef4444', bottom: { type: 'calca', color: '#1e3a8a' }, ...o });
const F = (id, name, o) => ({ id, name, g: 'f', skin: TONES[0], hair: 'longo', hairColor: '#3b2314', eyes: '#3b2a1a', shoes: '#f8fafc', shoes2: '#ec4899', bottom: { type: 'saia', color: '#1e3a8a' }, ...o });
const top = (type, color, color2 = '#ffffff', extra = {}) => ({ type, color, color2, ...extra });

export const SKINS = [
  // ───────────── Meninos ─────────────
  M('m01', 'Desbravador de gala', { top: top('uniforme', '#c9a66b', '#facc15'), bottom: { type: 'calca', color: '#1f4d33' }, hat: { type: 'chapeu', color: '#8b6b3d' }, acc: { type: 'lenco', color: '#facc15' }, shoes: '#111827', shoes2: '#111827' }),
  M('m02', 'Desbravador de campo', { top: top('uniforme', '#c9a66b', '#facc15'), bottom: { type: 'bermuda', color: '#1f4d33' }, hat: { type: 'bone', color: '#15803d' }, acc: { type: 'mochila', color: '#b45309' }, skin: TONES[2] }),
  M('m03', 'Skatista', { top: top('moletom', '#f97316', '#1f2937'), bottom: { type: 'calca', color: '#334155' }, hat: { type: 'bone-tras', color: '#0ea5e9' }, hair: 'espetado', hairColor: '#7c2d12' }),
  M('m04', 'Surfista', { top: top('camiseta', '#06b6d4', '#ffffff', { stripe: true }), bottom: { type: 'bermuda', color: '#f59e0b' }, hair: 'lateral', hairColor: '#ca8a04', skin: TONES[2] }),
  M('m05', 'Jogador de basquete', { top: top('regata', '#dc2626', '#ffffff', { number: '10' }), bottom: { type: 'bermuda', color: '#dc2626' }, hat: { type: 'faixa', color: '#ffffff' }, hair: 'black', skin: TONES[4] }),
  M('m06', 'Jogador de futebol', { top: top('camiseta', '#16a34a', '#facc15', { number: '9' }), bottom: { type: 'bermuda', color: '#1d4ed8' }, hair: 'topete', skin: TONES[3] }),
  M('m07', 'Campista', { top: top('jaqueta', '#ea580c', '#fde68a'), bottom: { type: 'calca', color: '#78350f' }, hat: { type: 'gorro', color: '#dc2626' }, acc: { type: 'mochila', color: '#166534' } }),
  M('m08', 'Explorador', { top: top('colete', '#a16207', '#f5f5f4'), bottom: { type: 'bermuda', color: '#57534e' }, hat: { type: 'chapeu', color: '#a16207' }, acc: { type: 'oculos', color: '#111827' }, skin: TONES[1] }),
  M('m09', 'Músico', { top: top('jaqueta', '#7c3aed', '#111827'), bottom: { type: 'calca', color: '#111827' }, acc: { type: 'fone', color: '#e11d48' }, hair: 'cacheado', skin: TONES[4] }),
  M('m10', 'Astronauta', { top: top('manga', '#f1f5f9', '#2563eb', { logo: true }), bottom: { type: 'calca', color: '#e2e8f0' }, hat: { type: 'capacete', color: '#f8fafc' }, shoes: '#94a3b8', shoes2: '#475569' }),
  M('m11', 'Chef', { top: top('manga', '#ffffff', '#ef4444'), bottom: { type: 'calca', color: '#1f2937' }, hat: { type: 'chef', color: '#ffffff' }, skin: TONES[3] }),
  M('m12', 'Cientista', { top: top('jaleco', '#ffffff', '#0ea5e9'), bottom: { type: 'calca', color: '#334155' }, acc: { type: 'oculos', color: '#0f172a' }, hair: 'cacheado', hairColor: '#57534e' }),
  M('m13', 'Piloto', { top: top('jaqueta', '#1e3a8a', '#facc15'), bottom: { type: 'calca', color: '#1e293b' }, hat: { type: 'bone', color: '#1e3a8a' }, acc: { type: 'oculos', color: '#0f172a' } }),
  M('m14', 'Ciclista', { top: top('camiseta', '#facc15', '#111827', { stripe: true }), bottom: { type: 'bermuda', color: '#111827' }, hat: { type: 'capacete', color: '#f97316' }, skin: TONES[2] }),
  M('m15', 'Inverno', { top: top('moletom', '#2563eb', '#ffffff'), bottom: { type: 'calca', color: '#1e293b' }, hat: { type: 'gorro', color: '#ffffff' }, acc: { type: 'cachecol', color: '#dc2626' } }),
  M('m16', 'Praia', { top: top('camisa-aberta', '#fb7185', '#fef3c7'), bottom: { type: 'bermuda', color: '#0ea5e9' }, acc: { type: 'oculos', color: '#111827' }, hair: 'raspado', skin: TONES[3] }),
  M('m17', 'Noite de gala', { top: top('terno', '#111827', '#ffffff'), bottom: { type: 'calca', color: '#111827' }, shoes: '#111827', shoes2: '#111827', hair: 'lateral' }),
  M('m18', 'Fotógrafo', { top: top('polo', '#0d9488', '#f8fafc'), bottom: { type: 'calca', color: '#78716c' }, hat: { type: 'boina', color: '#1f2937' }, acc: { type: 'mochila', color: '#334155' } }),
  M('m19', 'Montanhista', { top: top('jaqueta', '#16a34a', '#facc15'), bottom: { type: 'calca', color: '#44403c' }, hat: { type: 'gorro', color: '#f97316' }, acc: { type: 'mochila', color: '#dc2626' }, skin: TONES[4] }),
  M('m20', 'Bombeiro mirim', { top: top('jaqueta', '#dc2626', '#facc15'), bottom: { type: 'calca', color: '#991b1b' }, hat: { type: 'capacete', color: '#dc2626' }, shoes: '#111827', shoes2: '#facc15' }),
  M('m21', 'Arqueiro', { top: top('colete', '#166534', '#a16207'), bottom: { type: 'calca', color: '#3f3f46' }, hat: { type: 'chapeu', color: '#14532d' }, hair: 'longo-m', hairColor: '#a16207' }),
  M('m22', 'Robótica', { top: top('camiseta', '#475569', '#22d3ee', { logo: true }), bottom: { type: 'calca', color: '#1e293b' }, acc: { type: 'oculos', color: '#22d3ee' }, hair: 'espetado', hairColor: '#111827', skin: TONES[5] }),
  M('m23', 'Fazendeiro', { top: top('xadrez', '#dc2626', '#7f1d1d'), bottom: { type: 'calca', color: '#1d4ed8' }, hat: { type: 'chapeu', color: '#d6b26e' }, skin: TONES[2] }),
  M('m24', 'Pescador', { top: top('colete', '#facc15', '#0f766e'), bottom: { type: 'bermuda', color: '#0f766e' }, hat: { type: 'bone', color: '#facc15' }, skin: TONES[3] }),
  M('m25', 'Médico', { top: top('jaleco', '#ffffff', '#16a34a'), bottom: { type: 'calca', color: '#0ea5e9' }, hair: 'raspado', skin: TONES[5] }),
  M('m26', 'Corredor', { top: top('regata', '#22c55e', '#ffffff', { number: '7' }), bottom: { type: 'bermuda', color: '#111827' }, hat: { type: 'faixa', color: '#22c55e' }, shoes2: '#22c55e', skin: TONES[4] }),
  M('m27', 'Artista', { top: top('camiseta', '#ffffff', '#ec4899', { paint: true }), bottom: { type: 'calca', color: '#3b82f6' }, hat: { type: 'boina', color: '#dc2626' }, hair: 'cacheado', hairColor: '#111827' }),
  M('m28', 'Líder DBV', { top: top('polo', '#1e3a8a', '#facc15', { logo: true }), bottom: { type: 'calca', color: '#334155' }, acc: { type: 'lenco', color: '#facc15' }, hair: 'lateral', skin: TONES[2] }),
  M('m29', 'Hip-hop', { top: top('moletom', '#111827', '#facc15', { logo: true }), bottom: { type: 'calca', color: '#475569' }, hat: { type: 'bone-tras', color: '#facc15' }, acc: { type: 'fone', color: '#111827' }, hair: 'black', skin: TONES[5] }),
  M('m30', 'Ciclone', { top: top('jaqueta', '#0ea5e9', '#e0f2fe'), bottom: { type: 'calca', color: '#0c4a6e' }, hair: 'topete', hairColor: '#fbbf24', acc: { type: 'oculos', color: '#f97316' } }),

  // ───────────── Meninas ─────────────
  F('f01', 'Desbravadora de gala', { top: top('uniforme', '#c9a66b', '#facc15'), bottom: { type: 'saia', color: '#1f4d33' }, hat: { type: 'boina', color: '#14532d' }, acc: { type: 'lenco', color: '#facc15' }, hair: 'coque', shoes: '#111827', shoes2: '#111827' }),
  F('f02', 'Desbravadora de campo', { top: top('uniforme', '#c9a66b', '#facc15'), bottom: { type: 'saia', color: '#1f4d33' }, hat: { type: 'bone', color: '#15803d' }, acc: { type: 'mochila', color: '#b45309' }, hair: 'rabo', skin: TONES[2] }),
  F('f03', 'Skatista', { top: top('moletom', '#a855f7', '#fdf4ff'), bottom: { type: 'calca', color: '#334155' }, hat: { type: 'bone-tras', color: '#ec4899' }, hair: 'rabo', hairColor: '#7c2d12' }),
  F('f04', 'Surfista', { top: top('camiseta', '#f472b6', '#ffffff', { stripe: true }), bottom: { type: 'saia', color: '#06b6d4' }, hair: 'ondulado', hairColor: '#ca8a04', skin: TONES[2] }),
  F('f05', 'Jogadora de basquete', { top: top('camiseta', '#7c3aed', '#ffffff', { number: '23' }), bottom: { type: 'calca', color: '#7c3aed' }, hat: { type: 'faixa', color: '#ffffff' }, hair: 'trancas', hairColor: '#111827', skin: TONES[4] }),
  F('f06', 'Jogadora de futebol', { top: top('camiseta', '#16a34a', '#facc15', { number: '10' }), bottom: { type: 'calca', color: '#1d4ed8' }, hair: 'rabo', skin: TONES[3] }),
  F('f07', 'Campista', { top: top('jaqueta', '#f97316', '#fde68a'), bottom: { type: 'calca', color: '#78350f' }, hat: { type: 'gorro', color: '#ec4899' }, acc: { type: 'mochila', color: '#166534' }, hair: 'trancas' }),
  F('f08', 'Exploradora', { top: top('colete', '#a16207', '#f5f5f4'), bottom: { type: 'saia', color: '#57534e' }, hat: { type: 'chapeu', color: '#a16207' }, hair: 'rabo', hairColor: '#7c2d12' }),
  F('f09', 'Musicista', { top: top('vestido', '#7c3aed', '#c4b5fd'), bottom: { type: 'vestido', color: '#7c3aed' }, acc: { type: 'fone', color: '#f472b6' }, hair: 'cacheado', hairColor: '#111827', skin: TONES[4] }),
  F('f10', 'Astronauta', { top: top('manga', '#f1f5f9', '#ec4899', { logo: true }), bottom: { type: 'calca', color: '#e2e8f0' }, hat: { type: 'capacete', color: '#f8fafc' }, shoes: '#94a3b8', shoes2: '#475569', hair: 'chanel' }),
  F('f11', 'Chef', { top: top('manga', '#ffffff', '#ef4444'), bottom: { type: 'saia', color: '#1f2937' }, hat: { type: 'chef', color: '#ffffff' }, hair: 'coque', skin: TONES[3] }),
  F('f12', 'Cientista', { top: top('jaleco', '#ffffff', '#a855f7'), bottom: { type: 'calca', color: '#334155' }, acc: { type: 'oculos', color: '#0f172a' }, hair: 'rabo', hairColor: '#ea580c' }),
  F('f13', 'Piloto', { top: top('jaqueta', '#1e3a8a', '#facc15'), bottom: { type: 'calca', color: '#1e293b' }, hat: { type: 'bone', color: '#1e3a8a' }, hair: 'rabo', acc: { type: 'oculos', color: '#0f172a' } }),
  F('f14', 'Ciclista', { top: top('camiseta', '#facc15', '#111827', { stripe: true }), bottom: { type: 'calca', color: '#111827' }, hat: { type: 'capacete', color: '#ec4899' }, hair: 'trancas', skin: TONES[2] }),
  F('f15', 'Inverno', { top: top('moletom', '#f472b6', '#ffffff'), bottom: { type: 'calca', color: '#1e293b' }, hat: { type: 'gorro', color: '#ffffff' }, acc: { type: 'cachecol', color: '#7c3aed' }, hair: 'longo' }),
  F('f16', 'Praia', { top: top('vestido', '#fb923c', '#fef3c7', { flower: true }), bottom: { type: 'vestido', color: '#fb923c' }, acc: { type: 'oculos', color: '#111827' }, hat: { type: 'chapeu', color: '#fde68a' }, hair: 'ondulado', skin: TONES[3] }),
  F('f17', 'Noite de gala', { top: top('vestido', '#1e3a8a', '#93c5fd'), bottom: { type: 'saia-longa', color: '#1e3a8a' }, hair: 'coque', hairColor: '#111827', shoes: '#111827', shoes2: '#111827' }),
  F('f18', 'Fotógrafa', { top: top('polo', '#0d9488', '#f8fafc'), bottom: { type: 'saia', color: '#78716c' }, hat: { type: 'boina', color: '#ec4899' }, acc: { type: 'mochila', color: '#334155' }, hair: 'chanel' }),
  F('f19', 'Montanhista', { top: top('jaqueta', '#16a34a', '#facc15'), bottom: { type: 'calca', color: '#44403c' }, hat: { type: 'gorro', color: '#f97316' }, acc: { type: 'mochila', color: '#dc2626' }, hair: 'trancas', skin: TONES[4] }),
  F('f20', 'Bombeira mirim', { top: top('jaqueta', '#dc2626', '#facc15'), bottom: { type: 'calca', color: '#991b1b' }, hat: { type: 'capacete', color: '#dc2626' }, hair: 'rabo', shoes: '#111827', shoes2: '#facc15' }),
  F('f21', 'Arqueira', { top: top('colete', '#166534', '#a16207'), bottom: { type: 'calca', color: '#3f3f46' }, hair: 'trancas', hairColor: '#a16207' }),
  F('f22', 'Robótica', { top: top('camiseta', '#475569', '#22d3ee', { logo: true }), bottom: { type: 'calca', color: '#1e293b' }, acc: { type: 'oculos', color: '#22d3ee' }, hair: 'chanel', hairColor: '#111827', skin: TONES[5] }),
  F('f23', 'Fazendeira', { top: top('xadrez', '#2563eb', '#1e3a8a'), bottom: { type: 'saia', color: '#78350f' }, hat: { type: 'chapeu', color: '#d6b26e' }, hair: 'trancas', skin: TONES[2] }),
  F('f24', 'Florista', { top: top('vestido', '#fda4af', '#fff1f2', { flower: true }), bottom: { type: 'vestido', color: '#fda4af' }, hair: 'maria', hairColor: '#7c2d12' }),
  F('f25', 'Médica', { top: top('jaleco', '#ffffff', '#16a34a'), bottom: { type: 'calca', color: '#0ea5e9' }, hair: 'coque', skin: TONES[5], hairColor: '#111827' }),
  F('f26', 'Corredora', { top: top('camiseta', '#22c55e', '#ffffff', { number: '7' }), bottom: { type: 'calca', color: '#111827' }, hat: { type: 'faixa', color: '#22c55e' }, hair: 'rabo', shoes2: '#22c55e', skin: TONES[4] }),
  F('f27', 'Artista', { top: top('camiseta', '#ffffff', '#ec4899', { paint: true }), bottom: { type: 'saia', color: '#3b82f6' }, hat: { type: 'boina', color: '#dc2626' }, hair: 'ondulado', hairColor: '#111827' }),
  F('f28', 'Líder DBV', { top: top('polo', '#1e3a8a', '#facc15', { logo: true }), bottom: { type: 'saia', color: '#334155' }, acc: { type: 'lenco', color: '#facc15' }, hair: 'coque', skin: TONES[2] }),
  F('f29', 'Patinadora', { top: top('moletom', '#06b6d4', '#ffffff'), bottom: { type: 'saia', color: '#ec4899' }, acc: { type: 'fone', color: '#ffffff' }, hair: 'maria', hairColor: '#fbbf24' }),
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
