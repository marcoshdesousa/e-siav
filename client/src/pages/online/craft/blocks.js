// DesbravaCraft: blocos, itens, ferramentas, comidas e receitas. As texturas são desenhadas em
// pixel (16x16) num atlas gerado na hora — nada de imagem de fora.
import * as THREE from 'three';

// ───────────── Blocos ─────────────
// tex: [cima, lados, baixo] (nomes das texturas). hard: dureza. tool: ferramenta certa. tier: nível mínimo.
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, WATER: 6, LOG: 7, LEAVES: 8, PLANKS: 9, GLASS: 10,
  COAL_ORE: 11, IRON_ORE: 12, GOLD_ORE: 13, DIAMOND_ORE: 14, BEDROCK: 15, SNOW_GRASS: 16, SPRUCE_LOG: 17,
  SPRUCE_LEAVES: 18, CACTUS: 19, TABLE: 20, FURNACE: 21, TORCH: 22, WOOL: 23, BRICKS: 24, GRAVEL: 25,
  BIRCH_LOG: 26, FLOWER: 27, TALL_GRASS: 28, SNOW: 29, SANDSTONE: 30, CLAY: 31,
};

export const BLOCKS = {
  [B.GRASS]: { name: 'Grama', tex: ['grass_top', 'grass_side', 'dirt'], hard: 0.6, tool: 'pa', drop: B.DIRT },
  [B.DIRT]: { name: 'Terra', tex: ['dirt'], hard: 0.5, tool: 'pa' },
  [B.STONE]: { name: 'Pedra', tex: ['stone'], hard: 1.5, tool: 'picareta', tier: 1, drop: B.COBBLE },
  [B.COBBLE]: { name: 'Pedregulho', tex: ['cobble'], hard: 2, tool: 'picareta', tier: 1 },
  [B.SAND]: { name: 'Areia', tex: ['sand'], hard: 0.5, tool: 'pa', fall: true },
  [B.WATER]: { name: 'Água', tex: ['water'], hard: Infinity, liquid: true, transparent: true },
  [B.LOG]: { name: 'Tronco', tex: ['log_top', 'log', 'log_top'], hard: 2, tool: 'machado' },
  [B.LEAVES]: { name: 'Folhas', tex: ['leaves'], hard: 0.2, transparent: true, drop: null, dropChance: [[136, 0.06], [B.LEAVES, 0]] },
  [B.PLANKS]: { name: 'Tábuas', tex: ['planks'], hard: 2, tool: 'machado' },
  [B.GLASS]: { name: 'Vidro', tex: ['glass'], hard: 0.3, transparent: true, drop: null },
  [B.COAL_ORE]: { name: 'Minério de carvão', tex: ['coal_ore'], hard: 3, tool: 'picareta', tier: 1, drop: 101 },
  [B.IRON_ORE]: { name: 'Minério de ferro', tex: ['iron_ore'], hard: 3, tool: 'picareta', tier: 2 },
  [B.GOLD_ORE]: { name: 'Minério de ouro', tex: ['gold_ore'], hard: 3, tool: 'picareta', tier: 3 },
  [B.DIAMOND_ORE]: { name: 'Minério de diamante', tex: ['diamond_ore'], hard: 3, tool: 'picareta', tier: 3, drop: 104 },
  [B.BEDROCK]: { name: 'Rocha-mãe', tex: ['bedrock'], hard: Infinity },
  [B.SNOW_GRASS]: { name: 'Grama com neve', tex: ['snow', 'snow_side', 'dirt'], hard: 0.6, tool: 'pa', drop: B.DIRT },
  [B.SPRUCE_LOG]: { name: 'Tronco de pinheiro', tex: ['spruce_top', 'spruce_log', 'spruce_top'], hard: 2, tool: 'machado' },
  [B.SPRUCE_LEAVES]: { name: 'Folhas de pinheiro', tex: ['spruce_leaves'], hard: 0.2, transparent: true, drop: null },
  [B.CACTUS]: { name: 'Cacto', tex: ['cactus_top', 'cactus', 'cactus_top'], hard: 0.4 },
  [B.TABLE]: { name: 'Bancada de trabalho', tex: ['table_top', 'table_side', 'planks'], hard: 2.5, tool: 'machado', use: 'bancada' },
  [B.FURNACE]: { name: 'Fornalha', tex: ['furnace_top', 'furnace', 'furnace_top'], hard: 3.5, tool: 'picareta', tier: 1, use: 'fornalha' },
  [B.TORCH]: { name: 'Tocha', tex: ['torch'], hard: 0, small: true, solid: false, transparent: true },
  [B.WOOL]: { name: 'Lã', tex: ['wool'], hard: 0.8 },
  [B.BRICKS]: { name: 'Tijolos', tex: ['bricks'], hard: 2, tool: 'picareta', tier: 1 },
  [B.GRAVEL]: { name: 'Cascalho', tex: ['gravel'], hard: 0.6, tool: 'pa', fall: true },
  [B.BIRCH_LOG]: { name: 'Tronco de bétula', tex: ['birch_top', 'birch_log', 'birch_top'], hard: 2, tool: 'machado' },
  [B.FLOWER]: { name: 'Flor', tex: ['flower'], hard: 0, plant: true, solid: false, transparent: true },
  [B.TALL_GRASS]: { name: 'Mato', tex: ['tall_grass'], hard: 0, plant: true, solid: false, transparent: true, drop: null },
  [B.SNOW]: { name: 'Bloco de neve', tex: ['snow'], hard: 0.4, tool: 'pa' },
  [B.SANDSTONE]: { name: 'Arenito', tex: ['sandstone_top', 'sandstone', 'sandstone_top'], hard: 0.8, tool: 'picareta', tier: 1 },
  [B.CLAY]: { name: 'Argila', tex: ['clay'], hard: 0.6, tool: 'pa' },
};
export const isSolid = (id) => id !== 0 && BLOCKS[id] && BLOCKS[id].solid !== false && !BLOCKS[id].liquid;
export const isOpaque = (id) => id !== 0 && BLOCKS[id] && !BLOCKS[id].transparent;

// ───────────── Itens ─────────────
export const ITEMS = {
  100: { name: 'Graveto', icon: 'stick' },
  101: { name: 'Carvão', icon: 'coal', fuel: 8 },
  102: { name: 'Barra de ferro', icon: 'iron_ingot' },
  103: { name: 'Barra de ouro', icon: 'gold_ingot' },
  104: { name: 'Diamante', icon: 'diamond' },
  130: { name: 'Carne crua', icon: 'beef', food: 3, cook: 131 },
  131: { name: 'Bife assado', icon: 'steak', food: 8 },
  132: { name: 'Frango cru', icon: 'chicken', food: 2, cook: 133 },
  133: { name: 'Frango assado', icon: 'cooked_chicken', food: 6 },
  134: { name: 'Carne de ovelha crua', icon: 'mutton', food: 2, cook: 135 },
  135: { name: 'Carne de ovelha assada', icon: 'cooked_mutton', food: 6 },
  136: { name: 'Maçã', icon: 'apple', food: 4 },
  137: { name: 'Pena', icon: 'feather' },
  138: { name: 'Linha', icon: 'string' },
};
const TOOL_MAT = [['madeira', 1, 2, 60, '#a0703c'], ['pedra', 2, 4, 130, '#8a8a8a'], ['ferro', 3, 6, 250, '#e5e7eb'], ['diamante', 4, 8, 1500, '#5eead4']];
const TOOL_KIND = [['picareta', 'Picareta'], ['machado', 'Machado'], ['pa', 'Pá'], ['espada', 'Espada']];
TOOL_MAT.forEach(([mat, tier, speed, uses, color], m) => {
  TOOL_KIND.forEach(([kind, label], k) => {
    ITEMS[110 + m * 4 + k] = { name: `${label} de ${mat}`, icon: `tool_${kind}`, color, tool: kind, tier, speed, uses, damage: kind === 'espada' ? 3 + tier : 1 + tier * 0.5 };
  });
});
// Combustível também serve com madeira
export const FUEL = { 101: 8, [B.LOG]: 2, [B.SPRUCE_LOG]: 2, [B.BIRCH_LOG]: 2, [B.PLANKS]: 1, 100: 0.5 };
export const SMELT = { [B.SAND]: B.GLASS, [B.COBBLE]: B.STONE, [B.IRON_ORE]: 102, [B.GOLD_ORE]: 103, [B.CLAY]: B.BRICKS, 130: 131, 132: 133, 134: 135, [B.LOG]: 101 };

export const itemName = (id) => (id < 100 ? BLOCKS[id]?.name : ITEMS[id]?.name) || '?';
export const maxStack = (id) => (ITEMS[id]?.tool ? 1 : 64);

// ───────────── Receitas (livro de receitas: toque para fazer) ─────────────
// grid: 2 = dá para fazer no inventário; 3 = precisa da bancada perto.
const LOGS = [B.LOG, B.SPRUCE_LOG, B.BIRCH_LOG];
export const RECIPES = [
  { out: [B.PLANKS, 4], need: [[LOGS, 1]], grid: 2 },
  { out: [100, 4], need: [[B.PLANKS, 2]], grid: 2 },
  { out: [B.TABLE, 1], need: [[B.PLANKS, 4]], grid: 2 },
  { out: [B.TORCH, 4], need: [[101, 1], [100, 1]], grid: 2 },
  { out: [B.SANDSTONE, 1], need: [[B.SAND, 4]], grid: 2 },
  { out: [B.WOOL, 1], need: [[138, 4]], grid: 2 },
  { out: [B.FURNACE, 1], need: [[B.COBBLE, 8]], grid: 3 },
  { out: [B.BRICKS, 1], need: [[B.CLAY, 4]], grid: 2 },
];
const MAT_ITEM = [[B.PLANKS], [B.COBBLE], [102], [104]];
const KIND_COST = { picareta: 3, machado: 3, pa: 1, espada: 2 };
const KIND_STICK = { picareta: 2, machado: 2, pa: 2, espada: 1 };
TOOL_MAT.forEach((_, m) => TOOL_KIND.forEach(([kind], k) => {
  RECIPES.push({ out: [110 + m * 4 + k, 1], need: [[MAT_ITEM[m][0], KIND_COST[kind]], [100, KIND_STICK[kind]]], grid: 3 });
}));

// ───────────── Texturas (pixel art) ─────────────
const TILE = 16;
const NAMES = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'cobble', 'sand', 'water', 'log_top', 'log', 'leaves', 'planks', 'glass',
  'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'bedrock', 'snow', 'snow_side', 'spruce_top', 'spruce_log', 'spruce_leaves',
  'cactus_top', 'cactus', 'table_top', 'table_side', 'furnace_top', 'furnace', 'torch', 'wool', 'bricks', 'gravel', 'birch_top',
  'birch_log', 'flower', 'tall_grass', 'sandstone_top', 'sandstone', 'clay', 'crack1', 'crack2', 'crack3', 'crack4',
];
export const TEX_INDEX = Object.fromEntries(NAMES.map((n, i) => [n, i]));
const COLS = 8;
const ROWS = Math.ceil(NAMES.length / COLS);

function hash(i, j, s) {
  let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
};

function paint(g, name, ox, oy) {
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(ox + x, oy + y, 1, 1); };
  const noise = (base, amt, seed) => { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px(x, y, shade(base, 1 - amt / 2 + hash(x, y, seed) * amt)); };
  const ore = (dot, seed) => { noise('#7d7d7d', 0.25, 3); for (let k = 0; k < 7; k++) { const x = 2 + Math.floor(hash(k, 1, seed) * 11); const y = 2 + Math.floor(hash(k, 2, seed) * 11); px(x, y, dot); px(x + 1, y, dot); px(x, y + 1, shade(dot, 0.8)); } };
  switch (name) {
    case 'grass_top': noise('#5da832', 0.35, 1); break;
    case 'grass_side': noise('#866043', 0.3, 2); for (let x = 0; x < TILE; x++) { const h = 3 + Math.floor(hash(x, 0, 9) * 3); for (let y = 0; y < h; y++) px(x, y, shade('#5da832', 0.85 + hash(x, y, 4) * 0.3)); } break;
    case 'dirt': noise('#866043', 0.35, 2); break;
    case 'stone': noise('#7d7d7d', 0.25, 3); break;
    case 'cobble': noise('#6f6f6f', 0.5, 5); for (let k = 0; k < 18; k++) px(Math.floor(hash(k, 3, 6) * 16), Math.floor(hash(k, 4, 6) * 16), '#3f3f3f'); break;
    case 'sand': noise('#dbd3a0', 0.18, 7); break;
    case 'water': noise('#2f5fd0', 0.2, 8); break;
    case 'log_top': noise('#a0794a', 0.2, 10); for (let r = 2; r < 8; r += 2) { g.strokeStyle = '#7a5a33'; g.strokeRect(ox + 8 - r, oy + 8 - r, r * 2, r * 2); } g.strokeStyle = '#5c3d1e'; g.strokeRect(ox + 0.5, oy + 0.5, 15, 15); break;
    case 'log': for (let x = 0; x < TILE; x++) for (let y = 0; y < TILE; y++) px(x, y, shade('#6b4f2a', 0.8 + hash(x, Math.floor(y / 3), 11) * 0.35)); break;
    case 'leaves': for (let x = 0; x < TILE; x++) for (let y = 0; y < TILE; y++) if (hash(x, y, 12) > 0.18) px(x, y, shade('#3f8a2e', 0.7 + hash(x, y, 13) * 0.5)); break;
    case 'planks': for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px(x, y, y % 4 === 3 ? '#7a5a33' : shade('#b08a50', 0.88 + hash(x, Math.floor(y / 4), 14) * 0.2)); break;
    case 'glass': g.strokeStyle = '#cfe8ef'; g.strokeRect(ox + 0.5, oy + 0.5, 15, 15); px(3, 3, '#fff'); px(4, 4, '#fff'); px(5, 5, '#fff'); break;
    case 'coal_ore': ore('#1c1c1c', 15); break;
    case 'iron_ore': ore('#d8a983', 16); break;
    case 'gold_ore': ore('#f5d442', 17); break;
    case 'diamond_ore': ore('#5ef2e5', 18); break;
    case 'bedrock': noise('#3a3a3a', 0.8, 19); break;
    case 'snow': noise('#f5f8ff', 0.08, 20); break;
    case 'snow_side': noise('#866043', 0.3, 2); for (let x = 0; x < TILE; x++) { const h = 3 + Math.floor(hash(x, 0, 21) * 3); for (let y = 0; y < h; y++) px(x, y, '#f5f8ff'); } break;
    case 'spruce_top': noise('#6b5232', 0.2, 22); g.strokeStyle = '#4a3820'; g.strokeRect(ox + 4.5, oy + 4.5, 7, 7); break;
    case 'spruce_log': for (let x = 0; x < TILE; x++) for (let y = 0; y < TILE; y++) px(x, y, shade('#3d2c1a', 0.8 + hash(x, Math.floor(y / 2), 23) * 0.4)); break;
    case 'spruce_leaves': for (let x = 0; x < TILE; x++) for (let y = 0; y < TILE; y++) if (hash(x, y, 24) > 0.15) px(x, y, shade('#2d5a3a', 0.7 + hash(x, y, 25) * 0.5)); break;
    case 'cactus_top': noise('#5b8f2b', 0.2, 26); break;
    case 'cactus': noise('#3f7d1d', 0.25, 27); for (let y = 1; y < TILE; y += 4) { px(2, y, '#d9e6a5'); px(13, y + 2, '#d9e6a5'); } break;
    case 'table_top': paint(g, 'planks', ox, oy); g.strokeStyle = '#4a3820'; g.strokeRect(ox + 2.5, oy + 2.5, 11, 11); g.beginPath(); g.moveTo(ox + 8, oy + 3); g.lineTo(ox + 8, oy + 13); g.moveTo(ox + 3, oy + 8); g.lineTo(ox + 13, oy + 8); g.stroke(); break;
    case 'table_side': paint(g, 'planks', ox, oy); for (let x = 3; x < 13; x++) px(x, 4, '#555'); px(4, 6, '#999'); px(5, 6, '#999'); px(10, 6, '#c27a3a'); px(11, 7, '#c27a3a'); break;
    case 'furnace_top': noise('#6f6f6f', 0.3, 28); break;
    case 'furnace': noise('#6f6f6f', 0.3, 29); g.fillStyle = '#1c1c1c'; g.fillRect(ox + 4, oy + 8, 8, 5); g.fillStyle = '#f97316'; g.fillRect(ox + 5, oy + 11, 6, 2); break;
    case 'torch': g.fillStyle = '#7a5a33'; g.fillRect(ox + 7, oy + 6, 2, 10); g.fillStyle = '#fde047'; g.fillRect(ox + 6, oy + 3, 4, 4); g.fillStyle = '#f97316'; g.fillRect(ox + 7, oy + 4, 2, 2); break;
    case 'wool': noise('#eeeeee', 0.12, 30); break;
    case 'bricks': for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { const row = Math.floor(y / 4); const off = row % 2 ? 4 : 0; px(x, y, y % 4 === 3 || (x + off) % 8 === 7 ? '#c9c2b5' : shade('#a24a35', 0.85 + hash(x, y, 31) * 0.25)); } break;
    case 'gravel': for (let x = 0; x < TILE; x++) for (let y = 0; y < TILE; y++) px(x, y, ['#857b77', '#6b6461', '#9d948f', '#5a524f'][Math.floor(hash(x, y, 32) * 4)]); break;
    case 'birch_top': noise('#c9b886', 0.2, 33); break;
    case 'birch_log': noise('#e6e2d3', 0.1, 34); for (let k = 0; k < 6; k++) { const y = Math.floor(hash(k, 1, 35) * 15); const x = Math.floor(hash(k, 2, 35) * 12); for (let d = 0; d < 4; d++) px(x + d, y, '#2b2b2b'); } break;
    case 'flower': g.fillStyle = '#3f8a2e'; g.fillRect(ox + 7, oy + 8, 2, 8); g.fillStyle = '#e11d48'; g.fillRect(ox + 5, oy + 3, 6, 5); g.fillStyle = '#fde047'; g.fillRect(ox + 7, oy + 5, 2, 2); break;
    case 'tall_grass': for (let k = 0; k < 7; k++) { const x = 1 + k * 2; const h = 6 + Math.floor(hash(k, 0, 36) * 9); g.fillStyle = shade('#4f9a35', 0.8 + hash(k, 1, 36) * 0.4); g.fillRect(ox + x, oy + 16 - h, 1, h); } break;
    case 'sandstone_top': noise('#d8c98f', 0.12, 37); break;
    case 'sandstone': noise('#d8c98f', 0.12, 38); for (let x = 0; x < TILE; x++) { px(x, 3, '#c2b07a'); px(x, 12, '#c2b07a'); } break;
    case 'clay': noise('#9fa6b2', 0.12, 39); break;
    default:
      if (name.startsWith('crack')) {
        const n = Number(name.slice(5));
        for (let k = 0; k < n * 8; k++) { const x = Math.floor(hash(k, 1, 40) * 16); const y = Math.floor(hash(k, 2, 40) * 16); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(ox + x, oy + y, 1 + (k % 2), 1); }
      }
  }
}

let atlas = null;
/** Atlas com todas as texturas (16x16 cada). */
export function getAtlas() {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = COLS * TILE;
  c.height = ROWS * TILE;
  const g = c.getContext('2d');
  NAMES.forEach((n, i) => paint(g, n, (i % COLS) * TILE, Math.floor(i / COLS) * TILE));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  atlas = { canvas: c, tex, cols: COLS, rows: ROWS };
  return atlas;
}
/** Coordenadas UV de uma textura do atlas. */
export function uvOf(name) {
  const i = TEX_INDEX[name] ?? 0;
  const u0 = (i % COLS) / COLS;
  const v1 = 1 - Math.floor(i / COLS) / ROWS;
  const pad = 0.001;
  return [u0 + pad, v1 - 1 / ROWS + pad, u0 + 1 / COLS - pad, v1 - pad];
}

// ───────────── Ícones (inventário) ─────────────
const iconCache = new Map();
/** Ícone (data URL) de um bloco ou item, para o inventário. */
export function iconOf(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (id < 100 && BLOCKS[id]) {
    const { canvas } = getAtlas();
    const t = BLOCKS[id].tex;
    const draw = (name, dx, dy, w, h) => { const i = TEX_INDEX[name]; g.drawImage(canvas, (i % COLS) * TILE, Math.floor(i / COLS) * TILE, TILE, TILE, dx, dy, w, h); };
    if (BLOCKS[id].plant || BLOCKS[id].small) draw(t[0], 0, 0, 32, 32);
    else {
      draw(t[1] || t[0], 2, 10, 28, 20);
      draw(t[0], 2, 2, 28, 10);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(2, 10, 28, 20);
    }
  } else {
    const it = ITEMS[id];
    const col = it?.color || '#a0703c';
    g.fillStyle = col;
    const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    switch (it?.icon) {
      case 'stick': r(14, 4, 4, 24, '#7a5a33'); break;
      case 'coal': r(8, 8, 16, 16, '#1c1c1c'); r(10, 10, 4, 4, '#444'); break;
      case 'iron_ingot': r(6, 12, 20, 9, '#e5e7eb'); r(6, 12, 20, 3, '#fff'); break;
      case 'gold_ingot': r(6, 12, 20, 9, '#facc15'); r(6, 12, 20, 3, '#fef08a'); break;
      case 'diamond': g.beginPath(); g.moveTo(16, 4); g.lineTo(28, 14); g.lineTo(16, 28); g.lineTo(4, 14); g.closePath(); g.fillStyle = '#5eead4'; g.fill(); break;
      case 'beef': case 'mutton': case 'chicken': r(7, 9, 18, 14, it.icon === 'chicken' ? '#f4c7b0' : '#d9534f'); r(10, 12, 6, 4, '#fff'); break;
      case 'steak': case 'cooked_mutton': case 'cooked_chicken': r(7, 9, 18, 14, '#8b4513'); r(10, 12, 6, 4, '#c08050'); break;
      case 'apple': g.beginPath(); g.arc(16, 18, 10, 0, 7); g.fillStyle = '#dc2626'; g.fill(); r(15, 4, 2, 6, '#7a5a33'); break;
      case 'feather': r(14, 4, 4, 24, '#f5f5f5'); r(12, 6, 2, 16, '#e5e5e5'); break;
      case 'string': for (let k = 0; k < 6; k++) r(6 + k * 3, 6 + k * 3, 3, 3, '#e5e7eb'); break;
      default:
        if (it?.tool) {
          for (let k = 0; k < 8; k++) r(8 + k * 2, 24 - k * 2, 3, 3, '#7a5a33'); // cabo
          if (it.tool === 'picareta') { r(6, 4, 22, 4, col); r(4, 6, 4, 6, col); r(26, 6, 4, 6, col); }
          if (it.tool === 'machado') { r(16, 3, 10, 10, col); }
          if (it.tool === 'pa') { r(20, 2, 8, 9, col); }
          if (it.tool === 'espada') { g.fillStyle = '#7a5a33'; g.fillRect(4, 24, 6, 6); for (let k = 0; k < 9; k++) r(9 + k * 2, 20 - k * 2, 4, 4, col); }
        } else r(8, 8, 16, 16, '#999');
    }
  }
  const url = c.toDataURL();
  iconCache.set(id, url);
  return url;
}
