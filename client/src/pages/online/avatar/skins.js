// Personagem dos jogos (vale para o Stumble DBV e os próximos jogos): cada membro monta o seu,
// peça por peça — pele, cabelo, chapéu, camisa, calça/bermuda/saia, calçado e o lenço. Os modelos
// são de verdade (Universal Base Characters, de Quaternius, CC0); a montagem fica em build.js.
//
// A escolha vira um código curto (ex.: "m21030a2b5100"), que vai para o servidor e para os outros
// jogadores: 1ª letra = m/f e depois um caractere (base 36) para cada escolha, na ordem de FIELDS.
import { api } from '../../../api.js';

export const SKIN_TONES = ['#ffffff', '#f1d2b8', '#d9a07a', '#b98059', '#8d5a3b', '#6a4128'];
export const HAIR_COLORS = [
  ['Preto', '#1b120c'], ['Castanho', '#3b2314'], ['Castanho claro', '#6b3a1f'], ['Ruivo', '#9a3b16'], ['Loiro', '#c79a3f'], ['Grisalho', '#9a9a9a'],
];
/** Cabelos (file = peça em build.js; null = sem cabelo). g: só para meninos/meninas. */
export const HAIRS = [
  { id: 'curto', name: 'Curto', file: 'hair:curto' },
  { id: 'raspado', name: 'Raspado', file: 'hair:raspado' },
  { id: 'longo', name: 'Comprido', file: 'hair:longo' },
  { id: 'coque', name: 'Coque', file: 'hair:coque' },
  { id: 'raspado-f', name: 'Bem curtinho', file: 'hair:raspado-f' },
  { id: 'careca', name: 'Sem cabelo', file: null },
];
export const HATS = [
  { id: 'nenhum', name: 'Sem chapéu' },
  { id: 'chapeu', name: 'Chapéu de desbravador' },
  { id: 'bone', name: 'Boné' },
  { id: 'gorro', name: 'Gorro' },
];
export const PALETTE = [
  ['Caqui', '#d8c49a'], ['Branco', '#f4f4f4'], ['Preto', '#2a2a2e'], ['Azul-marinho', '#26324f'], ['Azul', '#2f6fd6'], ['Vermelho', '#c8323a'],
  ['Amarelo', '#f2c94c'], ['Verde', '#2f7d4f'], ['Verde-oliva', '#5f7d3c'], ['Marrom', '#6b4a2b'], ['Rosa', '#d9668f'], ['Roxo', '#6d4bb8'],
  ['Bege', '#e8d6a8'],
];
const C = Object.fromEntries(PALETTE.map(([n, c]) => [n, c]));

/**
 * Camisas (20). style: camiseta (manga curta), manga (manga comprida), colete (sem manga),
 * colete-manga (colete com camisa de manga comprida por baixo).
 */
export const TOPS = [
  { id: 'gala', name: 'Camisa de gala (caqui)', style: 'manga', color: C.Caqui },
  { id: 'caqui-curta', name: 'Camisa caqui manga curta', style: 'camiseta', color: C.Caqui },
  { id: 'branca', name: 'Camiseta branca', style: 'camiseta', color: C.Branco },
  { id: 'amarela', name: 'Camiseta amarela', style: 'camiseta', color: C.Amarelo },
  { id: 'vermelha', name: 'Camiseta vermelha', style: 'camiseta', color: C.Vermelho },
  { id: 'azul', name: 'Camiseta azul', style: 'camiseta', color: C.Azul },
  { id: 'verde', name: 'Camiseta verde', style: 'camiseta', color: C.Verde },
  { id: 'preta', name: 'Camiseta preta', style: 'camiseta', color: C.Preto },
  { id: 'rosa', name: 'Camiseta rosa', style: 'camiseta', color: C.Rosa },
  { id: 'roxa', name: 'Camiseta roxa', style: 'camiseta', color: C.Roxo },
  { id: 'campo', name: 'Camisa de campo (oliva)', style: 'manga', color: C['Verde-oliva'] },
  { id: 'agasalho-azul', name: 'Agasalho azul', style: 'manga', color: C['Azul-marinho'] },
  { id: 'agasalho-vermelho', name: 'Agasalho vermelho', style: 'manga', color: C.Vermelho },
  { id: 'manga-branca', name: 'Camisa branca manga comprida', style: 'manga', color: C.Branco },
  { id: 'manga-verde', name: 'Blusa verde', style: 'manga', color: C.Verde },
  { id: 'colete-caqui', name: 'Colete de aventura caqui', style: 'colete-manga', color: C.Caqui, sleeve: C.Branco },
  { id: 'colete-verde', name: 'Colete de aventura verde', style: 'colete-manga', color: '#ffffff', sleeve: C.Caqui },
  { id: 'colete-marrom', name: 'Colete de trilha marrom', style: 'colete', color: C.Marrom },
  { id: 'colete-azul', name: 'Colete azul', style: 'colete', color: C.Azul },
  { id: 'colete-preto', name: 'Colete preto', style: 'colete-manga', color: C.Preto, sleeve: C.Vermelho },
];
/** Calças, bermudas e saias (as saias vão até o joelho). girls: só aparece para meninas. */
export const BOTTOMS = [
  { id: 'calca-marinho', name: 'Calça azul-marinho', style: 'calca', color: C['Azul-marinho'] },
  { id: 'calca-preta', name: 'Calça preta', style: 'calca', color: C.Preto },
  { id: 'calca-jeans', name: 'Calça jeans', style: 'calca', color: '#4b6fb0' },
  { id: 'calca-caqui', name: 'Calça caqui', style: 'calca', color: '#9c8660' },
  { id: 'calca-oliva', name: 'Calça verde-oliva', style: 'calca', color: C['Verde-oliva'] },
  { id: 'bermuda-jeans', name: 'Bermuda jeans', style: 'bermuda', color: '#4b6fb0' },
  { id: 'bermuda-caqui', name: 'Bermuda caqui', style: 'bermuda', color: '#9c8660' },
  { id: 'bermuda-preta', name: 'Bermuda preta', style: 'bermuda', color: C.Preto },
  { id: 'saia-marinho', name: 'Saia azul-marinho', style: 'saia', color: C['Azul-marinho'], girls: true },
  { id: 'saia-jeans', name: 'Saia jeans', style: 'saia', color: '#4b6fb0', girls: true },
  { id: 'saia-preta', name: 'Saia preta', style: 'saia', color: C.Preto, girls: true },
  { id: 'saia-rosa', name: 'Saia rosa', style: 'saia', color: C.Rosa, girls: true },
];
export const SHOES = [
  { id: 'tenis-branco', name: 'Tênis branco', style: 'tenis', color: '#f4f4f4', sole: '#d4d4d4' },
  { id: 'tenis-preto', name: 'Tênis preto', style: 'tenis', color: '#2a2a2e', sole: '#f4f4f4' },
  { id: 'tenis-vermelho', name: 'Tênis vermelho', style: 'tenis', color: C.Vermelho, sole: '#f4f4f4' },
  { id: 'tenis-azul', name: 'Tênis azul', style: 'tenis', color: C.Azul, sole: '#f4f4f4' },
  { id: 'sapato', name: 'Sapato social preto', style: 'sapato', color: '#141414', sole: '#2a2a2a' },
  { id: 'bota-marrom', name: 'Bota marrom', style: 'bota', color: '#6b4a2b' },
  { id: 'bota-preta', name: 'Bota preta', style: 'bota', color: '#2a2a2e' },
];

/** Campos do código, na ordem: [nome, lista de opções ou quantidade]. */
const FIELDS = [
  ['skin', SKIN_TONES.length], ['hair', HAIRS.length], ['hairColor', HAIR_COLORS.length], ['hat', HATS.length], ['hatColor', PALETTE.length],
  ['top', TOPS.length], ['bottom', BOTTOMS.length], ['shoes', SHOES.length], ['scarf', 2], ['beard', 2],
];
const DEFAULT = { g: 'm', skin: 1, hair: 0, hairColor: 1, hat: 0, hatColor: 0, top: 0, bottom: 0, shoes: 4, scarf: 1, beard: 0 };

/** Código → escolhas (números). Aceita os ids antigos (m01, f05...) e códigos inválidos viram o padrão. */
export function decodeLook(code) {
  const c = String(code || '');
  if (PRESETS[c]) return decodeLook(PRESETS[c]);
  if (!/^[mf][0-9a-z]{10}$/.test(c)) return { ...DEFAULT, g: c[0] === 'f' ? 'f' : 'm' };
  const o = { g: c[0] };
  FIELDS.forEach(([k, n], i) => { const v = parseInt(c[i + 1], 36); o[k] = Number.isFinite(v) && v < n ? v : DEFAULT[k]; });
  // saia só para meninas
  if (o.g === 'm' && BOTTOMS[o.bottom].girls) o.bottom = 0;
  return o;
}
export const encodeLook = (o) => o.g + FIELDS.map(([k]) => (o[k] || 0).toString(36)).join('');

/** Escolhas → descrição para montar o personagem (build.js). */
export function lookOf(code) {
  const o = decodeLook(code);
  const top = TOPS[o.top];
  const bottom = BOTTOMS[o.bottom];
  const shoes = SHOES[o.shoes];
  const hair = HAIRS[o.hair];
  return {
    id: encodeLook(o), g: o.g, name: o.g === 'f' ? 'Minha desbravadora' : 'Meu desbravador',
    skin: SKIN_TONES[o.skin], hair: hair.file, hairColor: HAIR_COLORS[o.hairColor][1],
    hat: HATS[o.hat].id, hatColor: PALETTE[o.hatColor][1],
    top, bottom, shoes, scarf: !!o.scarf, beard: o.g === 'm' && !!o.beard,
    top_color: top.color,
  };
}
/** Compatível com o código antigo: skinById(código) devolve a descrição do personagem. */
export const skinById = (code) => lookOf(code);

/** Personagens prontos (para os robôs e para quem ainda não montou o seu). Os ids antigos continuam valendo. */
const P = (g, o) => encodeLook({ ...DEFAULT, g, ...o });
export const PRESETS = {
  m01: P('m', { skin: 1, hair: 0, hairColor: 1, top: 0, bottom: 0, shoes: 4, scarf: 1 }),
  m03: P('m', { skin: 0, hair: 0, hairColor: 3, top: 10, bottom: 3, shoes: 5, scarf: 0 }),
  m07: P('m', { skin: 2, hair: 1, hairColor: 0, top: 15, bottom: 4, shoes: 5, scarf: 1, hat: 1, hatColor: 12 }),
  m09: P('m', { skin: 4, hair: 1, hairColor: 0, top: 11, bottom: 0, shoes: 0, scarf: 0 }),
  m13: P('m', { skin: 3, hair: 0, hairColor: 0, top: 3, bottom: 5, shoes: 1, scarf: 0, hat: 2, hatColor: 4 }),
  m15: P('m', { skin: 0, hair: 0, hairColor: 4, top: 2, bottom: 2, shoes: 2, scarf: 0 }),
  m17: P('m', { skin: 1, hair: 0, hairColor: 1, top: 17, bottom: 6, shoes: 5, scarf: 0, hat: 3, hatColor: 5 }),
  m22: P('m', { skin: 5, hair: 1, hairColor: 0, top: 5, bottom: 1, shoes: 3, scarf: 0 }),
  m27: P('m', { skin: 1, hair: 0, hairColor: 2, top: 6, bottom: 7, shoes: 0, scarf: 0 }),
  m28: P('m', { skin: 2, hair: 0, hairColor: 1, top: 0, bottom: 1, shoes: 4, scarf: 1, beard: 1 }),
  f01: P('f', { skin: 0, hair: 2, hairColor: 2, top: 0, bottom: 8, shoes: 4, scarf: 1 }),
  f03: P('f', { skin: 0, hair: 3, hairColor: 3, top: 10, bottom: 3, shoes: 5, scarf: 0 }),
  f05: P('f', { skin: 4, hair: 3, hairColor: 0, top: 16, bottom: 4, shoes: 5, scarf: 1, hat: 1, hatColor: 12 }),
  f07: P('f', { skin: 2, hair: 2, hairColor: 1, top: 8, bottom: 9, shoes: 0, scarf: 0 }),
  f12: P('f', { skin: 0, hair: 3, hairColor: 4, top: 3, bottom: 2, shoes: 1, scarf: 0 }),
  f15: P('f', { skin: 1, hair: 2, hairColor: 4, top: 1, bottom: 8, shoes: 4, scarf: 1 }),
  f17: P('f', { skin: 3, hair: 2, hairColor: 0, top: 9, bottom: 10, shoes: 3, scarf: 0, hat: 3, hatColor: 10 }),
  f24: P('f', { skin: 1, hair: 3, hairColor: 1, top: 14, bottom: 6, shoes: 6, scarf: 0 }),
  f28: P('f', { skin: 5, hair: 3, hairColor: 0, top: 0, bottom: 8, shoes: 4, scarf: 1 }),
  f30: P('f', { skin: 2, hair: 4, hairColor: 3, top: 12, bottom: 11, shoes: 2, scarf: 0 }),
};
export const PRESET_IDS = Object.keys(PRESETS);

/** O guarda (sem uso por enquanto, fica para os próximos jogos). */
export const GUARD = lookOf(P('m', { skin: 2, hair: 1, top: 11, bottom: 1, shoes: 6, scarf: 0 }));

// ───────────── Escolha salva (aparelho + servidor) ─────────────
const valid = (c) => /^[mf][0-9a-z]{10}$/.test(String(c)) || !!PRESETS[c];
export function readChoice() {
  try {
    const v = JSON.parse(window.localStorage.getItem('dbv-skin') || 'null');
    if (v?.skin && valid(v.skin)) return { skin: lookOf(v.skin).id };
  } catch { /* sem armazenamento */ }
  return { skin: PRESETS.m01 };
}
export function saveChoice(c) {
  try { window.localStorage.setItem('dbv-skin', JSON.stringify({ skin: c.skin })); } catch { /* sem armazenamento */ }
}

/** Lê a escolha salva no servidor (se houver) e guarda no aparelho. */
export async function syncChoice() {
  try {
    const r = await api.get('/jogos/skin');
    if (r?.skin && valid(r.skin)) { const c = { skin: lookOf(r.skin).id }; saveChoice(c); return c; }
  } catch { /* sem internet: fica a do aparelho */ }
  return readChoice();
}

/** Os personagens prontos como lista (compatibilidade com quem usava a lista de skins). */
export const SKINS = PRESET_IDS.map((id) => ({ ...lookOf(id), preset: id }));
