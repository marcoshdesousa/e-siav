// DesbravaCraft: geração do mundo (biomas, árvores, minérios), blocos alterados e malha 3D dos pedaços.
import * as THREE from 'three';
import { B, BLOCKS, getAtlas, isOpaque, uvOf } from './blocks.js';

export const CS = 16; // tamanho do pedaço (chunk)
export const CH = 64; // altura do mundo
export const SEA = 24;

// ───────────── Ruído (simplex 2D) ─────────────
function makeNoise(seed) {
  const p = new Uint8Array(512);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  let s = seed >>> 0 || 1;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  return (xin, yin) => {
    const sk = (xin + yin) * F2;
    const i = Math.floor(xin + sk);
    const j = Math.floor(yin + sk);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    for (const [x, y, gi] of [[x0, y0, p[ii + p[jj]]], [x1, y1, p[ii + i1 + p[jj + j1]]], [x2, y2, p[ii + 1 + p[jj + 1]]]]) {
      let tt = 0.5 - x * x - y * y;
      if (tt > 0) { tt *= tt; const g = grad[gi & 7]; n += tt * tt * (g[0] * x + g[1] * y); }
    }
    return 70 * n;
  };
}

function hash3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 2654435761) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const BIOME_NAME = { plains: 'Campos', forest: 'Floresta', desert: 'Deserto', snow: 'Neve', mountains: 'Montanhas', beach: 'Praia', ocean: 'Lago' };

export class World {
  constructor(seed) {
    this.seed = seed;
    this.n1 = makeNoise(seed);
    this.n2 = makeNoise(seed + 1);
    this.n3 = makeNoise(seed + 2);
    this.n4 = makeNoise(seed + 3);
    this.chunks = new Map(); // "cx,cz" -> Uint8Array
    this.changes = new Map(); // "cx,cz" -> Map(index -> id)
    this.onChange = null;
  }

  key(cx, cz) { return `${cx},${cz}`; }
  idx(x, y, z) { return (y * CS + z) * CS + x; }

  biomeAt(x, z) {
    const temp = this.n2(x / 320, z / 320);
    const wet = this.n3(x / 280 + 100, z / 280 - 50);
    const mount = this.n4(x / 200, z / 200);
    if (mount > 0.45) return 'mountains';
    if (temp > 0.35 && wet < 0.1) return 'desert';
    if (temp < -0.4) return 'snow';
    if (wet > 0.15) return 'forest';
    return 'plains';
  }

  heightAt(x, z) {
    const b = this.biomeAt(x, z);
    const base = this.n1(x / 90, z / 90) * 6 + this.n1(x / 30 + 7, z / 30 - 3) * 2.5 + this.n1(x / 12, z / 12) * 0.8;
    const mount = Math.max(0, this.n4(x / 200, z / 200) - 0.25) * 60;
    let h = SEA + 3 + base + mount;
    if (b === 'desert') h = SEA + 3 + base * 0.5;
    return Math.max(4, Math.min(CH - 8, Math.floor(h)));
  }

  /** Gera o pedaço (terreno, minérios, árvores) e aplica as alterações guardadas. */
  generate(cx, cz) {
    const data = new Uint8Array(CS * CS * CH);
    const set = (x, y, z, id) => { if (x >= 0 && x < CS && z >= 0 && z < CS && y >= 0 && y < CH) data[this.idx(x, y, z)] = id; };
    const heights = [];
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = cx * CS + x;
      const wz = cz * CS + z;
      const h = this.heightAt(wx, wz);
      const bio = this.biomeAt(wx, wz);
      heights.push(h);
      for (let y = 0; y <= h; y++) {
        let id = B.STONE;
        if (y === 0) id = B.BEDROCK;
        else if (y > h - 4) {
          if (bio === 'desert' || h <= SEA + 1) id = y === h ? B.SAND : y > h - 3 ? B.SAND : B.SANDSTONE;
          else if (bio === 'mountains' && h > SEA + 22) id = y === h && h > SEA + 30 ? B.SNOW : B.STONE;
          else if (y === h) id = bio === 'snow' ? B.SNOW_GRASS : B.GRASS;
          else id = B.DIRT;
        } else {
          // Minérios (mais raros quanto mais valiosos; diamante só bem fundo)
          const r = hash3(wx, y, wz, this.seed);
          if (r < 0.012) id = B.COAL_ORE;
          else if (r < 0.018 && y < 48) id = B.IRON_ORE;
          else if (r < 0.0205 && y < 28) id = B.GOLD_ORE;
          else if (r < 0.022 && y < 14) id = B.DIAMOND_ORE;
          else if (r < 0.026 && y < 40) id = B.GRAVEL;
        }
        set(x, y, z, id);
      }
      if (h < SEA) for (let y = h + 1; y <= SEA; y++) set(x, y, z, B.WATER);
      if (h < SEA && hash3(wx, 1, wz, this.seed) < 0.15) set(x, h, z, B.CLAY);
      // Plantas
      const r = hash3(wx, 7, wz, this.seed);
      if (h > SEA && (bio === 'plains' || bio === 'forest')) {
        if (r < 0.06) set(x, h + 1, z, B.TALL_GRASS);
        else if (r < 0.075) set(x, h + 1, z, B.FLOWER);
      }
    }
    // Árvores e cactos (inclusive as dos vizinhos que encostam neste pedaço)
    for (let dz = -2; dz < CS + 2; dz++) for (let dx = -2; dx < CS + 2; dx++) {
      const wx = cx * CS + dx;
      const wz = cz * CS + dz;
      const r = hash3(wx, 3, wz, this.seed);
      const bio = this.biomeAt(wx, wz);
      const chance = bio === 'forest' ? 0.045 : bio === 'plains' ? 0.006 : bio === 'snow' ? 0.02 : bio === 'desert' ? 0.008 : bio === 'mountains' ? 0.004 : 0;
      if (r >= chance) continue;
      const h = this.heightAt(wx, wz);
      if (h <= SEA) continue;
      if (bio === 'desert') {
        const ch = 2 + Math.floor(hash3(wx, 4, wz, this.seed) * 2);
        for (let y = 1; y <= ch; y++) set(dx, h + y, dz, B.CACTUS);
        continue;
      }
      const spruce = bio === 'snow' || bio === 'mountains';
      const birch = !spruce && hash3(wx, 5, wz, this.seed) < 0.25;
      const log = spruce ? B.SPRUCE_LOG : birch ? B.BIRCH_LOG : B.LOG;
      const leaf = spruce ? B.SPRUCE_LEAVES : B.LEAVES;
      const th = 4 + Math.floor(hash3(wx, 6, wz, this.seed) * 3);
      for (let y = 1; y <= th; y++) set(dx, h + y, dz, log);
      if (spruce) {
        for (let ly = 2; ly <= th + 1; ly++) {
          const rr = ly > th - 1 ? 0 : ly % 2 ? 2 : 1;
          for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) {
            if (Math.abs(a) + Math.abs(b) > rr + 1 || (a === 0 && b === 0 && ly <= th)) continue;
            const i = this.idx(dx + a, h + ly, dz + b);
            if (dx + a >= 0 && dx + a < CS && dz + b >= 0 && dz + b < CS && h + ly < CH && !data[i]) data[i] = leaf;
          }
        }
        set(dx, h + th + 2, dz, leaf);
      } else {
        for (let ly = th - 2; ly <= th + 1; ly++) {
          const rr = ly >= th ? 1 : 2;
          for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) {
            if (rr === 2 && Math.abs(a) === 2 && Math.abs(b) === 2) continue;
            if (a === 0 && b === 0 && ly <= th) continue;
            const x2 = dx + a;
            const z2 = dz + b;
            if (x2 >= 0 && x2 < CS && z2 >= 0 && z2 < CS && h + ly < CH && !data[this.idx(x2, h + ly, z2)]) data[this.idx(x2, h + ly, z2)] = leaf;
          }
        }
      }
    }
    const ch = this.changes.get(this.key(cx, cz));
    if (ch) for (const [i, id] of ch) data[i] = id;
    this.chunks.set(this.key(cx, cz), data);
    return data;
  }

  chunk(cx, cz) { return this.chunks.get(this.key(cx, cz)) || this.generate(cx, cz); }

  get(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= CH) return 0;
    const cx = Math.floor(x / CS);
    const cz = Math.floor(z / CS);
    const d = this.chunks.get(this.key(cx, cz));
    if (!d) return 0;
    return d[this.idx(x - cx * CS, y, z - cz * CS)];
  }

  /** Troca um bloco e guarda a alteração (para salvar e mandar aos outros jogadores). */
  set(x, y, z, id, { remote = false } = {}) {
    if (y < 0 || y >= CH) return false;
    const cx = Math.floor(x / CS);
    const cz = Math.floor(z / CS);
    const d = this.chunk(cx, cz);
    const i = this.idx(x - cx * CS, y, z - cz * CS);
    d[i] = id;
    const k = this.key(cx, cz);
    if (!this.changes.has(k)) this.changes.set(k, new Map());
    this.changes.get(k).set(i, id);
    this.onChange?.(x, y, z, id, remote);
    return true;
  }

  /** Alterações para salvar: { "cx,cz": { índice: bloco } } */
  exportChanges() {
    const out = {};
    for (const [k, m] of this.changes) out[k] = Object.fromEntries(m);
    return out;
  }
  importChanges(obj) {
    for (const [k, m] of Object.entries(obj || {})) {
      const map = this.changes.get(k) || new Map();
      for (const [i, id] of Object.entries(m)) map.set(Number(i), Number(id));
      this.changes.set(k, map);
    }
  }

  surfaceY(x, z) {
    this.chunk(Math.floor(x / CS), Math.floor(z / CS));
    for (let y = CH - 1; y > 0; y--) { const id = this.get(x, y, z); if (id && id !== B.WATER && BLOCKS[id]?.solid !== false && id !== B.LEAVES && id !== B.SPRUCE_LEAVES) return y + 1; }
    return SEA + 1;
  }
}

// ───────────── Malha 3D de um pedaço ─────────────
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], side: 1, light: 0.8 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], side: 1, light: 0.8 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], side: 0, light: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], side: 2, light: 0.5 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], side: 1, light: 0.9 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], side: 1, light: 0.7 },
];

let materials = null;
export function craftMaterials() {
  if (materials) return materials;
  const { tex } = getAtlas();
  materials = {
    solid: new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }),
    cutout: new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    water: new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }),
  };
  return materials;
}

function texFor(id, side) {
  const t = BLOCKS[id].tex;
  return t[Math.min(side, t.length - 1)] ?? t[0];
}

/** Monta a malha do pedaço: só as faces que dá para ver. */
export function buildChunkMesh(world, cx, cz) {
  const data = world.chunk(cx, cz);
  const buckets = { solid: { p: [], uv: [], c: [], i: [] }, cutout: { p: [], uv: [], c: [], i: [] }, water: { p: [], uv: [], c: [], i: [] } };
  const ox = cx * CS;
  const oz = cz * CS;
  const neighbor = (x, y, z) => {
    if (x >= 0 && x < CS && z >= 0 && z < CS) return y < 0 ? B.BEDROCK : y >= CH ? 0 : data[world.idx(x, y, z)];
    return world.get(ox + x, y, oz + z);
  };
  for (let y = 0; y < CH; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const id = data[world.idx(x, y, z)];
    if (!id) continue;
    const def = BLOCKS[id];
    if (!def) continue;
    if (def.plant || def.small) {
      // Planta/tocha: dois planos em X
      const b = buckets.cutout;
      const [u0, v0, u1, v1] = uvOf(def.tex[0]);
      const s = def.small ? 0.35 : 0.45;
      const h = def.small ? 0.7 : 0.9;
      for (const [a, c] of [[[0.5 - s, 0.5 - s], [0.5 + s, 0.5 + s]], [[0.5 - s, 0.5 + s], [0.5 + s, 0.5 - s]]]) {
        const base = b.p.length / 3;
        b.p.push(x + a[0], y, z + a[1], x + c[0], y, z + c[1], x + c[0], y + h, z + c[1], x + a[0], y + h, z + a[1]);
        b.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
        for (let k = 0; k < 4; k++) b.c.push(1, 1, 1);
        b.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      continue;
    }
    const water = id === B.WATER;
    const b = water ? buckets.water : def.transparent ? buckets.cutout : buckets.solid;
    for (const f of FACES) {
      const nid = neighbor(x + f.n[0], y + f.n[1], z + f.n[2]);
      if (water) { if (nid === B.WATER || isOpaque(nid)) continue; }
      else if (isOpaque(nid) || (def.transparent && nid === id)) continue;
      const [u0, v0, u1, v1] = uvOf(texFor(id, f.side));
      const base = b.p.length / 3;
      const top = water && f.n[1] === 1 ? 0.88 : 1;
      for (const v of f.v) b.p.push(x + v[0], y + (v[1] ? top : 0), z + v[2]);
      b.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      for (let k = 0; k < 4; k++) b.c.push(f.light, f.light, f.light);
      b.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const mats = craftMaterials();
  const group = new THREE.Group();
  for (const [name, b] of Object.entries(buckets)) {
    if (!b.i.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
    g.setIndex(b.i);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mats[name]);
    if (name === 'water') m.renderOrder = 2;
    group.add(m);
  }
  group.position.set(ox, 0, oz);
  return group;
}
