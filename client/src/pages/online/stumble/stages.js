// As 30 fases do Stumble DBV. Cada fase é uma sequência de trechos montados com peças arredondadas
// de brinquedo (plataformas com borda, barras listradas, pêndulos, pistões, plataformas móveis,
// esteiras, portas, cama elástica, pisos que caem...). Tudo se move em função do tempo da corrida,
// igual em todos os celulares. As geometrias e materiais ficam em cache (uma por tamanho) e a
// decoração estática vira InstancedMesh, para rodar bem no celular.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const W = 12; // largura da pista

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Paletas: chão, borda (rim), cores de destaque, obstáculos, céu (topo/horizonte), água e grama.
export const THEMES = [
  { floor: '#ffb330', trim: '#fff3da', alt: '#ff7a3d', acc: '#ff4f8b', obs: '#7b4dff', skyTop: '#3d9df3', skyBot: '#cdeefe', water: '#3cc8ea', grass: '#7fd65a', rock: '#c9a27a' },
  { floor: '#46d39f', trim: '#effff8', alt: '#1fb07c', acc: '#ff5470', obs: '#3d6bff', skyTop: '#28b2e6', skyBot: '#dcfbff', water: '#33b6dc', grass: '#93e26a', rock: '#b9a48c' },
  { floor: '#5ea7ff', trim: '#f2f7ff', alt: '#3a7cf0', acc: '#ffcf3a', obs: '#ff4d5e', skyTop: '#ff8f70', skyBot: '#ffe6b5', water: '#3ea4dc', grass: '#9fd65a', rock: '#c79a7a' },
  { floor: '#ff7cc4', trim: '#fff0fa', alt: '#e8529f', acc: '#2fd6e8', obs: '#ffa62b', skyTop: '#7a68ff', skyBot: '#ffd8f2', water: '#5aa6f0', grass: '#a5e06b', rock: '#c3a0c8' },
  { floor: '#ff9d42', trim: '#fff6ea', alt: '#ff7b1c', acc: '#3d8bff', obs: '#22b35e', skyTop: '#4ab3ff', skyBot: '#eaffdc', water: '#2fc5c8', grass: '#7bd64c', rock: '#c8a27e' },
];

// ───────────── Caches de geometria, textura e material ─────────────

const geoCache = new Map();
const cached = (key, make) => {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
};
const k2 = (n) => Math.round(n * 100) / 100;

/** Caixa arredondada do tamanho exato (escalar uma caixa unitária deforma os cantos). */
function rbox(w, h, d, r = 0.3) {
  const rr = Math.max(0.02, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  return cached(`rb${k2(w)},${k2(h)},${k2(d)},${k2(rr)}`, () => new RoundedBoxGeometry(w, h, d, 3, rr));
}
function roundRect(s, w, d, r) {
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
/** Tampa do piso (retângulo arredondado deitado). A UV sai em metros, então a textura repete certinho. */
function capGeo(w, d) {
  const r = Math.max(0.05, Math.min(0.35, w / 2 - 0.02, d / 2 - 0.02));
  return cached(`cap${k2(w)},${k2(d)}`, () => {
    const g = new THREE.ShapeGeometry(roundRect(new THREE.Shape(), w, d, r), 3);
    g.rotateX(-Math.PI / 2);
    return g;
  });
}
const G = {
  cyl: () => cached('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 24)),
  cylLo: () => cached('cylLo', () => new THREE.CylinderGeometry(1, 1, 1, 12)),
  sph: () => cached('sph', () => new THREE.SphereGeometry(1, 24, 16)),
  sphLo: () => cached('sphLo', () => new THREE.SphereGeometry(1, 14, 10)),
  dome: () => cached('dome', () => new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
  torus: (R, r) => cached(`tor${k2(R)},${k2(r)}`, () => new THREE.TorusGeometry(R, r, 10, 36)),
  cone: () => cached('cone', () => new THREE.ConeGeometry(1, 1, 14)),
  // Barra listrada deitada no eixo X, com o comprimento exato (a listra acompanha)
  bar: (len, r) => cached(`bar${k2(len)},${k2(r)}`, () => new THREE.CylinderGeometry(r, r, len, 20, 1).rotateZ(Math.PI / 2)),
  island: () => cached('island', () => new THREE.LatheGeometry([[0, -2.1], [0.35, -1.7], [0.7, -1], [0.92, -0.45], [1, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 14)),
  grass: () => cached('grass', () => new THREE.LatheGeometry([[0, 0.3], [0.8, 0.29], [1.02, 0.2], [1.06, 0.05], [1.02, -0.06]].map(([x, y]) => new THREE.Vector2(x, y)), 16)),
  gear: () => cached('gear', () => {
    // Engrenagem: dentes arredondados com um furo no meio
    const s = new THREE.Shape();
    const teeth = 12;
    for (let i = 0; i <= teeth * 4; i++) {
      const a = (i / (teeth * 4)) * Math.PI * 2;
      const rr = i % 4 < 2 ? 1 : 0.8;
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.28, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 4 });
    g.center();
    return g;
  }),
};

const texCache = new Map();
/** Textura desenhada num canvas (fica em cache pela chave). */
function canvasTex(key, w, h, draw, rep = 1) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (rep !== 1) t.repeat.set(rep, rep);
  texCache.set(key, t);
  return t;
}
// ───────────── Marca dos Desbravadores (emblema em /marca/logo.svg) ─────────────
// Cores oficiais: amarelo, vermelho e azul
export const DBV = { yellow: '#f9c71d', red: '#e92a2f', blue: '#235293' };
let logoImg = null;
const logoWait = [];
/** Chama fn(img) quando o emblema estiver carregado (no Node/testes não carrega nada). */
function onLogo(fn) {
  if (logoImg && logoImg.complete && logoImg.naturalWidth) { fn(logoImg); return; }
  logoWait.push(fn);
  if (logoImg || typeof Image === 'undefined') return;
  logoImg = new Image();
  logoImg.decoding = 'async';
  logoImg.onload = () => logoWait.splice(0).forEach((f) => { try { f(logoImg); } catch { /* canvas perdido */ } });
  logoImg.src = '/marca/logo.svg';
}
/** Desenha o emblema (triângulo) centrado em (cx, cy) com altura h. Antes de carregar, um triângulo simples. */
function drawLogo(g, cx, cy, h, img) {
  const w = h;
  if (img) { g.drawImage(img, cx - w / 2, cy - h / 2, w, h); return; }
  g.beginPath();
  g.moveTo(cx - w * 0.43, cy - h * 0.45); g.lineTo(cx + w * 0.43, cy - h * 0.45); g.lineTo(cx, cy + h * 0.45);
  g.closePath();
  g.fillStyle = DBV.red; g.fill();
  g.lineWidth = h * 0.06; g.strokeStyle = DBV.yellow; g.stroke();
}
/** Textura de canvas que é desenhada de novo quando o emblema carrega (draw recebe a imagem ou null). */
function logoTex(key, w, h, draw) {
  const t = canvasTex(key, w, h, (g, ww, hh) => draw(g, ww, hh, null));
  if (!t.logoDone && t.image?.getContext) {
    t.logoDone = true;
    onLogo((img) => { const g = t.image.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h, img); t.needsUpdate = true; });
  }
  return t;
}

const WHITE = new THREE.Color('#ffffff');
const BLACK = new THREE.Color('#000000');
const tint = (c, k) => '#' + new THREE.Color(c).lerp(k > 0 ? WHITE : BLACK, Math.abs(k)).getHexString();
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Tamanho (m) que cada padrão cobre no chão
const PAT_M = { check: 4, stripe: 3, dots: 2, arrows: 2.5, plain: 4, rings: 3, hazard: 2 };
const PAT = {
  check(g, s, c1, c2) {
    // Ladrilhos arredondados de dois tons, com rejunte
    g.fillStyle = tint(c1, -0.14); g.fillRect(0, 0, s, s);
    const h = s / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? c1 : c2;
      rr(g, i * h + 5, j * h + 5, h - 10, h - 10, 22);
      g.fill();
      const gr = g.createLinearGradient(i * h, j * h, i * h + h, j * h + h);
      gr.addColorStop(0, 'rgba(255,255,255,.22)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(0,0,0,.06)');
      g.fillStyle = gr;
      rr(g, i * h + 5, j * h + 5, h - 10, h - 10, 22);
      g.fill();
    }
  },
  stripe(g, s, c1, c2) {
    g.fillStyle = c1; g.fillRect(0, 0, s, s);
    g.fillStyle = c2;
    for (let k = -2; k < 4; k++) {
      g.beginPath();
      g.moveTo(k * s / 2, 0); g.lineTo(k * s / 2 + s / 4, 0); g.lineTo(k * s / 2 + s / 4 + s, s); g.lineTo(k * s / 2 + s, s);
      g.closePath(); g.fill();
    }
  },
  dots(g, s, c1, c2) {
    g.fillStyle = c1; g.fillRect(0, 0, s, s);
    g.fillStyle = c2;
    for (const [x, y] of [[0.25, 0.25], [0.75, 0.75], [0.25, 0.75], [0.75, 0.25]]) {
      g.beginPath(); g.arc(x * s, y * s, s * 0.13, 0, Math.PI * 2); g.fill();
    }
  },
  plain(g, s, c1, c2) {
    g.fillStyle = c1; g.fillRect(0, 0, s, s);
    g.strokeStyle = c2; g.lineWidth = 6;
    rr(g, 10, 10, s - 20, s - 20, 26); g.stroke();
  },
  rings(g, s, c1, c2) {
    g.fillStyle = c1; g.fillRect(0, 0, s, s);
    g.strokeStyle = c2; g.lineWidth = s * 0.07;
    for (const r of [0.38, 0.22]) { g.beginPath(); g.arc(s / 2, s / 2, s * r, 0, Math.PI * 2); g.stroke(); }
  },
  arrows(g, s, c1, c2) {
    // Setas da esteira (apontam para baixo no canvas = para trás na pista)
    g.fillStyle = c1; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,.06)';
    for (let k = 0; k < 8; k += 2) g.fillRect(0, k * s / 8, s, s / 8);
    g.fillStyle = c2; g.lineJoin = 'round';
    for (const cx of [0.25, 0.75]) {
      g.beginPath();
      g.moveTo((cx - 0.17) * s, 0.3 * s); g.lineTo(cx * s, 0.58 * s); g.lineTo((cx + 0.17) * s, 0.3 * s);
      g.lineTo((cx + 0.17) * s, 0.46 * s); g.lineTo(cx * s, 0.74 * s); g.lineTo((cx - 0.17) * s, 0.46 * s);
      g.closePath(); g.fill();
    }
  },
  hazard(g, s, c1, c2) {
    g.fillStyle = c1; g.fillRect(0, 0, s, s);
    g.fillStyle = c2;
    for (let k = -2; k < 4; k++) {
      g.beginPath();
      g.moveTo(k * s / 2, 0); g.lineTo(k * s / 2 + s / 4, 0); g.lineTo(k * s / 2 + s / 4 - s, s); g.lineTo(k * s / 2 - s, s);
      g.closePath(); g.fill();
    }
  },
};
function patTex(pat, c1, c2) {
  return canvasTex(`${pat}${c1}${c2}`, 256, 256, (g, s) => PAT[pat](g, s, c1, c2));
}

const matCache = new Map();
/** Plástico brilhante (MeshStandardMaterial), em cache por cor e opções. */
function std(color, o = {}) {
  const key = `${color}|${o.rough ?? ''}|${o.metal ?? ''}|${o.map?.uuid || ''}|${o.em || ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.42, metalness: o.metal ?? 0.04, map: o.map || null });
    if (o.em) { m.emissive.set(o.em); m.emissiveIntensity = o.emI ?? 0.3; }
    matCache.set(key, m);
  }
  return m;
}
const metal = () => std('#cbd5e1', { rough: 0.28, metal: 0.65 });
const dark = () => std('#3b4252', { rough: 0.35, metal: 0.4 });
/** Material com padrão no topo (UV em metros). */
function patMat(pat, c1, c2) {
  const key = `pat${pat}${c1}${c2}`;
  let m = matCache.get(key);
  if (!m) {
    const t = patTex(pat, c1, c2 || tint(c1, 0.16));
    t.repeat.set(1 / PAT_M[pat], 1 / PAT_M[pat]);
    t.offset.set(0.5, 0.5); // o centro do desenho fica no centro da peça
    m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.02 });
    matCache.set(key, m);
  }
  return m;
}
/** Listras de bala (candy) para barras e cabos: listra diagonal em volta do cilindro. */
function candyMat(c1, c2, len) {
  const key = `candy${c1}${c2}${k2(len)}`;
  let m = matCache.get(key);
  if (!m) {
    const base = patTex('stripe', c1, c2);
    const t = base.clone();
    t.repeat.set(1, Math.max(1, Math.round(len / 1.1)));
    t.needsUpdate = true;
    m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, metalness: 0.05 });
    matCache.set(key, m);
  }
  return m;
}

const _o = new THREE.Object3D();
const _c = new THREE.Color();

/** Contexto de construção: guarda as peças com colisão de cada fase. */
function makeCtx(scene, theme, r) {
  const group = new THREE.Group();
  scene.add(group);
  const batches = new Map();
  const ctx = { group, theme, r, plats: [], walls: [], hitters: [], winds: [], checkpoints: [0], updaters: [], finishZ: -9999, z: 0, owned: [] };

  /** Decoração estática repetida: vira um InstancedMesh por (geometria, material). */
  ctx.inst = (geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, color = null, cast = false) => {
    // Separado em blocos de 50 m de pista: o que fica atrás da câmera ou longe não é desenhado
    const key = geo.uuid + mat.uuid + (cast ? 'c' : '') + Math.floor(z / 50);
    let b = batches.get(key);
    if (!b) { b = { geo, mat, cast, m: [], c: [] }; batches.set(key, b); }
    _o.position.set(x, y, z);
    _o.rotation.set(rx, ry, rz);
    _o.scale.set(sx, sy, sz);
    _o.updateMatrix();
    b.m.push(_o.matrix.clone());
    b.c.push(color);
  };
  ctx.flush = () => {
    for (const b of batches.values()) {
      const im = new THREE.InstancedMesh(b.geo, b.mat, b.m.length);
      b.m.forEach((m, i) => im.setMatrixAt(i, m));
      if (b.c.some(Boolean)) b.c.forEach((c, i) => im.setColorAt(i, _c.set(c || '#ffffff')));
      im.castShadow = b.cast;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
      ctx.owned.push(im);
    }
    batches.clear();
  };

  /**
   * Plataforma (chão). top = altura do chão. move(t) -> {x, y, z} de deslocamento.
   * Extras: o.r (disco redondo), o.spin (gira em rad/s), o.tilt(t) (gangorra: ângulo em z),
   * move(t, out) escreve o deslocamento em out (sem criar objeto novo a cada quadro),
   * o.convX (rolo que empurra de lado), o.mesh (visual pronto, centrado em top - thick/2).
   */
  ctx.plat = (x, z, w, d, top, color, o = {}) => {
    if (o.mesh) {
      const thick = o.thick ?? 1;
      o.mesh.position.set(x, top - thick / 2, z);
      o.mesh.traverse((c) => { if (c.isMesh) { c.receiveShadow = true; c.castShadow = !!o.cast; } });
      group.add(o.mesh);
      const p = { x, z, w, d, top, thick, r: o.r || 0, spin: o.spin || 0, tilt: o.tilt, convX: o.convX || 0, kind: o.kind || 'normal', conv: o.conv || 0, move: o.move, mesh: o.mesh, ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0, gone: false, baseY: top - thick / 2 };
      if (!o.move && !o.noLegs) legs(ctx, x, z, w, d, top - thick);
      ctx.plats.push(p);
      return p;
    }
    let thick = o.thick ?? 1;
    let len = d;
    if (o.slope) { thick = 0.6; len = Math.hypot(Math.abs(o.slope.z1 - o.slope.z0), o.slope.y1 - o.slope.y0); }
    const rad = Math.min(0.34, thick / 2 - 0.02, w / 2 - 0.05, len / 2 - 0.05);
    const m = new THREE.Group();
    const body = new THREE.Mesh(rbox(w, thick, len, rad), std(o.rim || theme.trim, { rough: 0.38 }));
    body.receiveShadow = true;
    body.castShadow = !!o.cast;
    const cap = new THREE.Mesh(capGeo(w - 2 * rad, len - 2 * rad), patMat(o.pat || 'check', color, o.c2));
    cap.position.y = thick / 2 + 0.004;
    cap.receiveShadow = true;
    m.add(body, cap);
    m.position.set(x, top - thick / 2, z);
    group.add(m);
    const p = { x, z, w, d, top, thick, kind: o.kind || 'normal', conv: o.conv || 0, move: o.move, mesh: m, cap, ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0, slope: o.slope, gone: false, baseY: top - thick / 2 };
    if (o.slope) { // rampa: o chão sobe de y0 (z0) até y1 (z1)
      const ang = Math.atan2(o.slope.y1 - o.slope.y0, Math.abs(o.slope.z1 - o.slope.z0));
      m.position.set(x, (o.slope.y0 + o.slope.y1) / 2 - 0.3, (o.slope.z0 + o.slope.z1) / 2);
      m.rotation.x = ang;
    }
    // Colunas metálicas até a água embaixo dos pisos grandes e parados
    if (!o.move && !o.noLegs && w >= 4 && d >= 4) legs(ctx, x, z, w, d, top - thick);
    ctx.plats.push(p);
    return p;
  };
  /** Parede (bloqueia). knock: empurra com força. o.mesh: visual pronto (centrado na parede). */
  ctx.wall = (x, z, w, d, h, y0, color, o = {}) => {
    const m = o.mesh || new THREE.Mesh(rbox(w, h, d, 0.22), std(color));
    m.position.set(x, y0 + h / 2, z);
    m.traverse((c) => { if (c.isMesh) c.castShadow = true; });
    group.add(m);
    const wl = { x, z, w, d, h, y0, move: o.move, knock: o.knock || 0, mesh: m, ox: 0, oz: 0, fake: !!o.fake, gone: false };
    ctx.walls.push(wl);
    return wl;
  };
  ctx.deco = (mesh) => { group.add(mesh); return mesh; };
  ctx.mesh = (geo, mat, x, y, z, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  return ctx;
}

const WATER_Y = -12;

/** Colunas de sustentação (com anel e espuma na água). */
function legs(ctx, x, z, w, d, bottom) {
  const n = Math.max(1, Math.round(d / 11));
  for (let k = 0; k < n; k++) {
    const zz = z + d / 2 - (d / n) * (k + 0.5);
    for (const s of [-1, 1]) {
      const xx = x + s * Math.max(0, w / 2 - 1.3);
      const h = bottom - WATER_Y + 0.5;
      ctx.inst(G.cylLo(), dark(), xx, bottom - h / 2, zz, 0.32, h, 0.32);
      ctx.inst(G.torus(0.42, 0.1), metal(), xx, bottom - 0.25, zz, 1, 1, 1, Math.PI / 2);
      ctx.inst(G.torus(0.6, 0.14), std('#ffffff', { rough: 0.8 }), xx, WATER_Y + 0.05, zz, 1, 1, 1, Math.PI / 2);
    }
  }
}

// ───────────── Trechos ─────────────

/** Corrimão de tubo com postes de bolinha (só visual). */
function railings(ctx, z0, len, top = 0, half = W / 2) {
  const n = Math.max(2, Math.round(len / 2.4));
  for (const s of [-1, 1]) {
    const x = s * (half - 0.2);
    for (let k = 0; k <= n; k++) {
      const z = z0 - 0.4 - (len - 0.8) * (k / n);
      ctx.inst(G.cylLo(), std(ctx.theme.trim), x, top + 0.4, z, 0.09, 0.8, 0.09);
      ctx.inst(G.sphLo(), std(ctx.theme.acc, { rough: 0.25 }), x, top + 0.86, z, 0.17);
    }
    ctx.inst(G.cylLo(), std(ctx.theme.acc, { rough: 0.25 }), x, top + 0.82, z0 - len / 2, 0.075, len - 0.8, 0.075, Math.PI / 2);
    ctx.inst(G.cylLo(), std(ctx.theme.trim), x, top + 0.45, z0 - len / 2, 0.05, len - 0.8, 0.05, Math.PI / 2);
  }
}

/** Engrenagem grande girando ao lado da pista (decoração "mecânica"). */
function gear(ctx, x, y, z, s, color, speed) {
  const g = ctx.mesh(G.gear(), std(color, { rough: 0.3, metal: 0.35 }), x, y, z);
  g.scale.setScalar(s);
  g.rotation.y = Math.PI / 2;
  const hub = ctx.mesh(G.cyl(), metal(), 0, 0, 0, false);
  hub.scale.set(0.3, 0.5, 0.3);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  ctx.deco(g);
  ctx.updaters.push((t) => { g.rotation.z = t * speed; });
}

// Altura da faixa do arco: acima da câmera que segue o jogador (ela fica ~5,8 m acima dele)
const ARCH_Y = 9.7;

/** Arco com faixa (largada, ponto seguro e chegada) com o emblema dos Desbravadores e balões em cima. */
function arch(ctx, z, label, finish) {
  const th = ctx.theme;
  const half = W / 2 + 2.6;
  for (const s of [-1, 1]) {
    const post = ctx.mesh(rbox(1.3, 9.6, 1.3, 0.5), candyMat(finish ? DBV.blue : DBV.red, finish ? DBV.yellow : '#ffffff', 9.6), s * half, 4.8, z);
    ctx.deco(post);
    ctx.inst(rbox(2, 0.5, 2, 0.2), std(DBV.yellow), s * half, 0.25, z);
  }
  const banner = ctx.mesh(rbox(half * 2 + 1.6, 1.9, 0.7, 0.35), std(finish ? '#1f2937' : DBV.blue, { rough: 0.35 }), 0, ARCH_Y, z);
  ctx.deco(banner);
  const tex = logoTex(`label${label}${finish}`, 1024, 128, (g, w, h, img) => {
    if (finish) {
      for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111827' : '#ffffff'; g.fillRect(x * 32, y * 32, 32, 32); }
      g.fillStyle = DBV.blue; rr(g, 150, 8, 724, 112, 54); g.fill();
    } else {
      g.fillStyle = DBV.blue; g.fillRect(0, 0, w, h);
      // Faixas amarela e vermelha nas bordas
      g.fillStyle = DBV.yellow; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
      g.fillStyle = DBV.red; g.fillRect(0, 12, w, 6); g.fillRect(0, h - 18, w, 6);
    }
    drawLogo(g, finish ? 215 : 90, h / 2, 96, img);
    drawLogo(g, finish ? w - 215 : w - 90, h / 2, 96, img);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 76px Arial Black, Arial, sans-serif';
    const tw = g.measureText(label).width;
    g.font = '900 86px Arial Black, Arial, sans-serif';
    const dw = g.measureText('DBV').width;
    const gap = 34;
    const total = tw + gap + dw;
    const f = Math.min(1, (finish ? 520 : 700) / total); // texto comprido: aperta na horizontal
    g.save();
    g.translate(w / 2, 0);
    g.scale(f, 1);
    const x0 = -total / 2;
    g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.35)';
    g.font = '900 76px Arial Black, Arial, sans-serif';
    g.textAlign = 'left';
    g.strokeText(label, x0, h / 2 + 4); g.fillStyle = '#ffffff'; g.fillText(label, x0, h / 2 + 4);
    g.font = '900 86px Arial Black, Arial, sans-serif';
    g.strokeText('DBV', x0 + tw + gap, h / 2 + 4); g.fillStyle = DBV.yellow; g.fillText('DBV', x0 + tw + gap, h / 2 + 4);
    g.restore();
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const face = new THREE.Mesh(cached(`plane${half}`, () => new THREE.PlaneGeometry(half * 2 + 0.8, 1.55)), std('#ffffff', { map: tex, rough: 0.5, em: '#ffffff', emI: 0.12 }));
  face.position.set(0, ARCH_Y, z + 0.36);
  ctx.deco(face);
  // Balões nos dois pilares, balançando (nas cores dos Desbravadores)
  const cols = [DBV.yellow, DBV.red, '#ffffff', DBV.blue, th.acc];
  for (const s of [-1, 1]) {
    const bunch = new THREE.Group();
    bunch.position.set(s * half, ARCH_Y + 1.3, z);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const b = ctx.mesh(G.sph(), std(cols[k], { rough: 0.2 }), Math.cos(a) * 0.75, 0.9 + (k % 2) * 0.5, Math.sin(a) * 0.55, false);
      b.scale.set(0.62, 0.74, 0.62);
      bunch.add(b);
    }
    ctx.deco(bunch);
    ctx.updaters.push((t) => { bunch.rotation.z = Math.sin(t * 1.3 + s) * 0.08; bunch.position.y = ARCH_Y + 1.3 + Math.sin(t * 2 + s) * 0.12; });
  }
}

// ───────────── Bandeiras dos Desbravadores (balançam no shader: nenhum custo na CPU) ─────────────
const flagTime = { value: 0 };
const flagMats = new Map();
function flagMat(bg) {
  let m = flagMats.get(bg);
  if (m) return m;
  const tex = logoTex(`flag${bg}`, 256, 172, (g, w, h, img) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const stripe = bg === DBV.yellow ? DBV.red : DBV.yellow;
    g.fillStyle = stripe; g.fillRect(0, h - 22, w, 22); g.fillRect(0, 0, w, 10);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w * 0.5, h * 0.47, 62, 0, Math.PI * 2); g.fill();
    drawLogo(g, w * 0.5, h * 0.47, 104, img);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlagT = flagTime;
    sh.vertexShader = 'uniform float uFlagT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float fph = instanceMatrix[3].z * 0.7 + instanceMatrix[3].x;
      #else
        float fph = 0.0;
      #endif
      float fk = clamp(position.x / 1.9, 0.0, 1.0);
      transformed.z += sin(position.x * 3.2 - uFlagT * 5.0 + fph) * 0.16 * fk;
      transformed.y += sin(position.x * 2.1 - uFlagT * 3.0 + fph) * 0.05 * fk;`);
  };
  m.customProgramCacheKey = () => 'dbvflag';
  flagMats.set(bg, m);
  return m;
}
const flagGeo = () => cached('flag', () => new THREE.PlaneGeometry(1.9, 1.28, 10, 3).translate(0.95, 0, 0));
const FLAG_BG = [DBV.yellow, DBV.blue, DBV.red];
/** Mastros com bandeiras dos dois lados de um trecho (decoração instanciada). */
function flags(ctx, z0, len, half = W / 2 + 1.1, every = 9) {
  const n = Math.max(1, Math.floor(len / every));
  for (let k = 0; k < n; k++) {
    const z = z0 - (len / n) * (k + 0.5);
    for (const s of [-1, 1]) {
      ctx.inst(G.cylLo(), metal(), s * half, 2.4, z, 0.07, 4.8, 0.07, 0, 0, 0, null, true);
      ctx.inst(G.sphLo(), std(DBV.yellow, { rough: 0.25, metal: 0.3 }), s * half, 4.85, z, 0.14);
      // A bandeira sai do mastro para fora da pista
      ctx.inst(flagGeo(), flagMat(FLAG_BG[(k + (s > 0 ? 1 : 0)) % 3]), s * half, 4.0, z, 1, 1, 1, 0, s > 0 ? 0 : Math.PI, 0);
    }
  }
}

/** Placa grande com o emblema, de frente para quem vem correndo (fora da pista). */
function emblemSign(ctx, x, z, s = 3.2) {
  const tex = logoTex('emblemSign', 256, 256, (g, w, h, img) => { g.clearRect(0, 0, w, h); drawLogo(g, w / 2, h / 2, 240, img); });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  let m = matCache.get('emblemSign');
  if (!m) { m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.15, emissiveMap: tex }); matCache.set('emblemSign', m); }
  const plane = ctx.mesh(cached('emblemPlane', () => new THREE.PlaneGeometry(1, 1)), m, x, s * 0.5 + 1.4, z, false);
  plane.scale.setScalar(s);
  ctx.deco(plane);
  ctx.inst(G.cylLo(), metal(), x, 0.8, z - 0.05, 0.1, 1.6, 0.1);
  ctx.inst(rbox(1.2, 0.3, 1.2, 0.12), std(DBV.blue), x, 0.15, z - 0.05);
}

/** Cogumelo que empurra: caule branco e chapéu colorido com bolinhas (pulsa de leve). */
function bumper(ctx, x, z, capc) {
  ctx.inst(G.cyl(), std('#fff7ed', { rough: 0.6 }), x, 0.5, z, 0.55, 1.0, 0.55, 0, 0, 0, null, true);
  const cap = ctx.mesh(G.dome(), std('#ffffff', { map: patTex('dots', capc, '#ffffff'), rough: 0.3 }), x, 0.85, z);
  cap.scale.set(1.0, 0.62, 1.0);
  const rim = ctx.mesh(G.torus(0.98, 0.1), std(capc, { rough: 0.3 }), x, 0.86, z);
  rim.rotation.x = Math.PI / 2;
  ctx.deco(cap); ctx.deco(rim);
  const h = { type: 'bumper', x, z, r: 0.9 };
  ctx.hitters.push(h);
  ctx.updaters.push((t) => {
    // Pulsa sempre um pouquinho e dá um "boing" quando alguém bate
    const hit = h.hitAt != null && t - h.hitAt < 0.35 && t >= h.hitAt ? Math.sin(((t - h.hitAt) / 0.35) * Math.PI) * 0.25 : 0;
    const s = 1 + Math.max(0, Math.sin(t * 6 + x + z)) * 0.06 + hit;
    cap.scale.set(s, 0.62 / s, s);
  });
}

/** Círculo deitado com UV em metros (topo dos discos). */
function discCap(r) {
  return cached(`dcap${k2(r)}`, () => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r, 0, Math.PI * 2, false);
    return new THREE.ShapeGeometry(s, 24).rotateX(-Math.PI / 2);
  });
}

/** Barra giratória com cubo (usada no giro, nos discos e na hélice). */
function spinBar(ctx, cz, y, L, w, cx = 0, r = 0.27) {
  const th = ctx.theme;
  const rot = new THREE.Group();
  rot.position.set(cx, y, cz);
  rot.add(ctx.mesh(G.bar(L, r), candyMat(th.obs, '#ffffff', L), 0, 0, 0));
  for (const s of [-1, 1]) {
    const end = ctx.mesh(G.sph(), std(th.acc, { rough: 0.25 }), s * L / 2, 0, 0);
    end.scale.setScalar(r + 0.1);
    rot.add(end);
  }
  const hub = ctx.mesh(G.cyl(), std(th.acc, { rough: 0.25 }), 0, 0, 0);
  hub.scale.set(0.6, 0.6, 0.6);
  const cap = ctx.mesh(G.dome(), std(th.acc, { rough: 0.25 }), 0, 0.3, 0);
  cap.scale.set(0.6, 0.4, 0.6);
  rot.add(hub, cap);
  ctx.deco(rot);
  const h = { type: 'bar', cx, cz, y, L: L / 2, w, ang: 0 };
  ctx.hitters.push(h);
  return { rot, h };
}

// Linhas de vento: uma InstancedMesh por ventilador (12 riscos = 1 desenho), andando com o vento
const STREAKS = 14;
let windMat = null;
/**
 * Ventilador do lado s (-1 = esquerda, 1 = direita) na altura z. Liga e desliga em ciclo; ligado,
 * o vento empurra quem está na faixa dele para o outro lado (força de verdade, ver physics.js).
 */
function fan(ctx, z, s, ph, trackW, power = 4.6) {
  const th = ctx.theme;
  const fx = s * (trackW / 2 + 1.7);
  ctx.inst(G.cylLo(), dark(), fx, (WATER_Y + 0.4) / 2, z, 0.4, 0.4 - WATER_Y, 0.4);
  ctx.inst(rbox(1.6, 0.5, 1.6, 0.2), std(th.trim), fx, 0.15, z, 1, 1, 1, 0, 0, 0, null, true);
  const head = new THREE.Group();
  head.position.set(fx, 1.7, z);
  const ring = ctx.mesh(G.torus(1.55, 0.24), std('#ffffff', { rough: 0.3 }), 0, 0, 0);
  ring.rotation.y = Math.PI / 2;
  const ring2 = ctx.mesh(G.torus(1.32, 0.1), std(th.obs, { rough: 0.3 }), -s * 0.08, 0, 0, false);
  ring2.rotation.y = Math.PI / 2;
  const back = ctx.mesh(G.cyl(), std(th.obs, { rough: 0.35 }), s * 0.55, 0, 0);
  back.scale.set(0.75, 0.9, 0.75);
  back.rotation.z = Math.PI / 2;
  // Grade na frente (anéis finos) e a lâmpada que avisa quando vai ligar
  const grill = ctx.mesh(G.torus(0.8, 0.05), metal(), -s * 0.2, 0, 0, false);
  grill.rotation.y = Math.PI / 2;
  const lamp = ctx.mesh(G.sphLo(), new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0 }), s * 0.2, 1.85, 0, false);
  lamp.scale.setScalar(0.22);
  ctx.owned.push(lamp.material);
  head.add(ring, ring2, back, grill, lamp);
  const blades = new THREE.Group();
  blades.position.x = -s * 0.1;
  for (let j = 0; j < 4; j++) {
    const bl = ctx.mesh(rbox(0.12, 1.25, 0.55, 0.06), std(j % 2 ? th.acc : '#fde047', { rough: 0.3 }), 0, 0.62, 0, false);
    bl.rotation.y = 0.35;
    const arm = new THREE.Group();
    arm.rotation.x = (j / 4) * Math.PI * 2;
    arm.add(bl);
    blades.add(arm);
  }
  const hub = ctx.mesh(G.sphLo(), metal(), 0, 0, 0, false);
  hub.scale.setScalar(0.3);
  blades.add(hub);
  head.add(blades);
  ctx.deco(head);
  // Riscos de vento atravessando a pista
  if (!windMat) windMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, fog: false });
  const streak = cached('streak', () => new THREE.BoxGeometry(1, 0.16, 0.16));
  const im = new THREE.InstancedMesh(streak, windMat, STREAKS);
  im.frustumCulled = false;
  ctx.group.add(im);
  ctx.owned.push(im);
  const r = rng(Math.round(z * 31) + 7);
  const seeds = Array.from({ length: STREAKS }, () => ({ y: 0.3 + r() * 2.6, z: z + (r() - 0.5) * 4.6, o: r(), l: 1.2 + r() * 1.6 }));
  const span = trackW + 3;
  const wind = { x0: -trackW / 2 - 1.5, x1: trackW / 2 + 1.5, z0: z + 2.6, z1: z - 2.6, top: 4.5, fx: -s * power, k: 0, x: fx };
  ctx.winds.push(wind);
  let ang = 0;
  ctx.updaters.push((t, dt = 0.016) => {
    const e = Math.sin(t * 1.1 + ph);
    wind.k = Math.max(0, Math.min(1, (e + 0.15) * 3));
    ang += (2 + wind.k * 24) * dt;
    blades.rotation.x = ang;
    // A lâmpada acende um pouco antes de ligar (dá tempo de se preparar)
    lamp.material.emissiveIntensity = e > -0.45 ? 1.2 : 0;
    head.position.x = fx + (wind.k > 0.5 ? Math.sin(t * 40) * 0.025 : 0);
    const k = wind.k;
    for (let j = 0; j < STREAKS; j++) {
      const sd = seeds[j];
      const u = (t * 1.1 + sd.o) % 1;
      const px = s * (trackW / 2 + 1) - s * u * span;
      const a = k * Math.min(1, u * 5, (1 - u) * 5);
      _o.position.set(px, sd.y + Math.sin(t * 6 + j) * 0.08, sd.z);
      _o.rotation.set(0, 0, 0);
      _o.scale.set(a > 0.02 ? sd.l * (0.4 + k * 0.6) : 0, a, a);
      _o.updateMatrix();
      im.setMatrixAt(j, _o.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.visible = k > 0.02;
  });
}

/** Seta amarela pintada na mola mostrando para onde ela joga. */
function springArrow(ctx, x, y, z) {
  const tex = canvasTex('springArrow', 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.strokeStyle = 'rgba(21,128,61,.6)';
    g.lineWidth = 6;
    g.lineJoin = 'round';
    for (const y0 of [18, 62]) {
      g.beginPath();
      g.moveTo(20, y0 + 40); g.lineTo(64, y0); g.lineTo(108, y0 + 40); g.lineTo(108, y0 + 58); g.lineTo(64, y0 + 20); g.lineTo(20, y0 + 58);
      g.closePath(); g.stroke(); g.fill();
    }
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  let m = matCache.get('springArrow');
  if (!m) { m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }); matCache.set('springArrow', m); }
  ctx.inst(cached('arrowPlane', () => new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2)), m, x, y, z);
}

const SEG = {
  start(ctx) {
    const len = 14;
    ctx.plat(0, ctx.z - len / 2, W + 4, len, 0, ctx.theme.floor, { pat: 'check' });
    arch(ctx, ctx.z - len + 1, 'LARGADA', false);
    flags(ctx, ctx.z + 4, len + 2, W / 2 + 2.6, 6);
    emblemSign(ctx, -(W / 2 + 6), ctx.z - 8, 4.5);
    emblemSign(ctx, W / 2 + 6, ctx.z - 8, 4.5);
    return len;
  },
  floor(ctx, { len = 12 } = {}) {
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor);
    railings(ctx, ctx.z, len);
    if (len >= 6) flags(ctx, ctx.z, len);
    return len;
  },
  plaza(ctx) {
    // Praça do meio da fase: um respiro com bandeiras, emblema e arco de ponto seguro
    const len = 16;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - len / 2, W + 6, len, 0, th.floor, { pat: 'check', c2: tint(th.floor, 0.22) });
    arch(ctx, ctx.z - 3, 'PONTO SEGURO', false);
    flags(ctx, ctx.z - 4, len - 4, W / 2 + 2.4, 4);
    emblemSign(ctx, -(W / 2 + 5.5), ctx.z - 10, 3.6);
    emblemSign(ctx, W / 2 + 5.5, ctx.z - 10, 3.6);
    // Faixa no chão com as cores dos Desbravadores
    for (const [i, c] of [DBV.yellow, DBV.red, DBV.blue].entries()) ctx.inst(rbox(W + 4, 0.06, 0.6, 0.03), std(c, { rough: 0.5 }), 0, 0.03, ctx.z - 6.5 - i * 0.7);
    ctx.checkpoints.push(ctx.z - len + 2);
    return len;
  },
  launch(ctx, { up = 4 } = {}) {
    // Mola gigante que joga lá em cima de uma torre; depois desce por um escorregador
    const th = ctx.theme;
    const tz = ctx.z - 16;
    const p = ctx.plat(0, ctx.z - 3, 6, 3.6, 0.3, '#22c55e', { kind: 'bounce', thick: 0.5, pat: 'rings', c2: '#bbf7d0', rim: '#fde047', noLegs: true });
    p.aim = { x: 0, y: up, z: tz, w: W };
    springArrow(ctx, 0, 0.33, ctx.z - 3);
    for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) ctx.inst(G.torus(0.36, 0.08), metal(), sx * 1.8, -0.35 - j * 0.22, ctx.z - 3, 1, 1, 1, Math.PI / 2);
    ctx.plat(0, tz, W, 8, up, th.floor, { thick: up + 1, pat: 'check' });
    railings(ctx, tz + 4, 8, up);
    flags(ctx, tz + 4, 8, W / 2 + 1.1, 4);
    const sl = 12;
    ctx.plat(0, tz - 4 - sl / 2, W, sl, 0, th.alt, { pat: 'stripe', c2: tint(th.alt, 0.25), slope: { z0: tz - 4, z1: tz - 4 - sl, y0: up, y1: 0 } });
    ctx.checkpoints.push(ctx.z);
    return 16 + 4 + sl;
  },
  spinner(ctx, { low = false, n = 1 } = {}) {
    const len = 14 * n;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor, { pat: 'plain', c2: tint(ctx.theme.floor, 0.3) });
    const th = ctx.theme;
    for (let k = 0; k < n; k++) {
      const cz = ctx.z - 7 - k * 14;
      const y = low ? 0.45 : 1.25;
      const w = (k % 2 ? -1 : 1) * (low ? 1.5 : 1.1);
      const L = W - 0.6;
      // Base e cubo (hub) gordinho
      ctx.inst(G.cyl(), dark(), 0, 0.12, cz, 1.0, 0.24, 1.0, 0, 0, 0, null, true);
      ctx.inst(G.cyl(), metal(), 0, (y + 0.2) / 2, cz, 0.38, y + 0.2, 0.38, 0, 0, 0, null, true);
      const rot = new THREE.Group();
      rot.position.set(0, y, cz);
      const bar = ctx.mesh(G.bar(L, 0.27), candyMat(th.obs, '#ffffff', L), 0, 0, 0);
      const hub = ctx.mesh(G.cyl(), std(th.acc, { rough: 0.25 }), 0, 0, 0);
      hub.scale.set(0.62, 0.62, 0.62);
      const cap = ctx.mesh(G.dome(), std(th.acc, { rough: 0.25 }), 0, 0.31, 0);
      cap.scale.set(0.62, 0.4, 0.62);
      const ring = ctx.mesh(G.torus(0.62, 0.09), metal(), 0, 0, 0);
      ring.rotation.x = Math.PI / 2;
      rot.add(bar, hub, cap, ring);
      for (const s of [-1, 1]) {
        const end = ctx.mesh(G.sph(), std(th.acc, { rough: 0.25 }), s * L / 2, 0, 0);
        end.scale.setScalar(0.36);
        rot.add(end);
      }
      ctx.deco(rot);
      const h = { type: 'bar', cx: 0, cz, y, L: L / 2, w, ang: 0 };
      ctx.hitters.push(h);
      ctx.updaters.push((t) => { h.ang = t * w; rot.rotation.y = h.ang; });
      // Engrenagem no lado de fora
      gear(ctx, (k % 2 ? 1 : -1) * (W / 2 + 0.5), -0.9, cz, 2.2, th.obs, w * 0.6);
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  pendulums(ctx, { n = 3 } = {}) {
    const len = 8 + n * 7;
    const pw = 7;
    ctx.plat(0, ctx.z - len / 2, pw, len, 0, ctx.theme.floor, { pat: 'stripe', c2: tint(ctx.theme.floor, 0.2) });
    const th = ctx.theme;
    for (let k = 0; k < n; k++) {
      const pz = ctx.z - 6 - k * 7;
      // Pórtico: colunas saindo da água e viga em cima
      for (const s of [-1, 1]) {
        const h = 7.6 - WATER_Y;
        ctx.inst(G.cylLo(), std(th.trim), s * 5.6, 7.6 - h / 2, pz, 0.32, h, 0.32, 0, 0, 0, null, true);
        ctx.inst(G.sphLo(), std(th.acc, { rough: 0.25 }), s * 5.6, 7.75, pz, 0.48);
      }
      ctx.inst(rbox(11.6, 0.55, 0.7, 0.25), std(th.alt), 0, 7.45, pz, 1, 1, 1, 0, 0, 0, null, true);
      const pivot = new THREE.Group();
      pivot.position.set(0, 7.2, pz);
      const rod = ctx.mesh(G.cylLo(), metal(), 0, -2.75, 0);
      rod.scale.set(0.09, 5.1, 0.09);
      const ball = ctx.mesh(G.sph(), std(th.obs, { rough: 0.3 }), 0, -5.8, 0);
      ball.scale.setScalar(1.1);
      const band = ctx.mesh(G.torus(1.07, 0.13), std('#ffffff', { rough: 0.3 }), 0, -5.8, 0);
      band.rotation.y = Math.PI / 2;
      const band2 = ctx.mesh(G.torus(1.07, 0.13), std('#ffffff', { rough: 0.3 }), 0, -5.8, 0);
      band2.rotation.x = Math.PI / 2;
      const knob = ctx.mesh(G.sphLo(), metal(), 0, 0, 0);
      knob.scale.setScalar(0.3);
      pivot.add(rod, ball, band, band2, knob);
      ctx.deco(pivot);
      const ph = k * 1.3;
      const h = { type: 'ball', x: 0, y: 1.4, z: pz, r: 1.1, vx: 0 };
      ctx.hitters.push(h);
      ctx.updaters.push((t) => {
        const a = Math.sin(t * 1.6 + ph) * 1.0;
        pivot.rotation.z = a;
        h.x = Math.sin(a) * 5.8;
        h.y = 7.2 - Math.cos(a) * 5.8;
        h.vx = Math.cos(t * 1.6 + ph) * 1.6 * 5.8;
      });
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  pushers(ctx, { n = 4 } = {}) {
    const len = 6 + n * 5;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor);
    for (let k = 0; k < n; k++) {
      const z = ctx.z - 5 - k * 5;
      const s = k % 2 ? 1 : -1;
      const ph = k * 0.9;
      // Pistão: cabeça arredondada com faixa de perigo, haste e caixa do motor fora da pista
      const head = new THREE.Group();
      const body = ctx.mesh(rbox(4.4, 1.6, 1.4, 0.4), std(th.obs, { rough: 0.35 }), 0, 0, 0);
      const face = ctx.mesh(rbox(0.3, 1.2, 1.1, 0.12), patMat('hazard', '#fde047', '#1f2937'), -s * 2.24, 0, 0);
      const shaft = ctx.mesh(G.cylLo(), metal(), s * 5.4, 0, 0);
      shaft.scale.set(0.24, 6.4, 0.24);
      shaft.rotation.z = Math.PI / 2;
      head.add(body, face, shaft);
      const wl = ctx.wall(s * (W / 2 + 2.2), z, 4.4, 1.4, 1.6, 0, th.obs, { knock: 9, mesh: head });
      ctx.inst(rbox(2.6, 2.2, 2.2, 0.45), std(th.alt), s * (W / 2 + 7.4), 0.8, z, 1, 1, 1, 0, 0, 0, null, true);
      ctx.inst(G.cylLo(), dark(), s * (W / 2 + 7.4), (WATER_Y - 0.3) / 2, z, 0.35, -0.3 - WATER_Y, 0.35);
      ctx.inst(G.torus(0.6, 0.14), std('#ffffff', { rough: 0.8 }), s * (W / 2 + 7.4), WATER_Y + 0.05, z, 1, 1, 1, Math.PI / 2);
      ctx.updaters.push((t) => {
        const e = (Math.sin(t * 1.8 + ph) + 1) / 2; // 0..1
        wl.ox = -s * e * 6.2;
        wl.vx = -s * Math.cos(t * 1.8 + ph) * 1.8 * 3.1;
        wl.mesh.position.x = wl.x + wl.ox;
      });
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  moving(ctx, { rows = 3 } = {}) {
    const len = 1.5 + rows * 5.5;
    const th = ctx.theme;
    for (let k = 0; k < rows; k++) {
      const z = ctx.z - 3.5 - k * 5.5;
      const ph = k * 1.7;
      const amp = 3.5;
      const c = k % 2 ? th.alt : th.acc;
      const p = ctx.plat(0, z, 4, 4, 0, c, { cast: true, pat: 'rings', c2: tint(c, 0.35), move: (t, o) => { o.x = Math.sin(t * 1.1 + ph) * amp; o.y = 0; o.z = 0; return o; } });
      // Propulsor embaixo (anda junto)
      const jet = ctx.mesh(G.cone(), dark(), 0, -1.05, 0, false);
      jet.scale.set(0.9, 0.9, 0.9);
      jet.rotation.x = Math.PI;
      const glow = ctx.mesh(G.sphLo(), std('#fde68a', { em: '#fbbf24', emI: 0.9 }), 0, -1.5, 0, false);
      glow.scale.set(0.35, 0.2, 0.35);
      p.mesh.add(jet, glow);
      p.amp = amp;
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  bumpers(ctx) {
    const len = 22;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor, { pat: 'dots', c2: tint(ctx.theme.floor, 0.25) });
    railings(ctx, ctx.z, len);
    const spots = [[-3.4, 4], [3.4, 4], [0, 8.5], [-4.1, 13], [4.1, 13], [0, 17.5], [-2.6, 20], [2.6, 20]];
    spots.forEach(([x, dz], i) => bumper(ctx, x, ctx.z - dz, i % 2 ? th.acc : th.obs));
    return len;
  },
  conveyor(ctx, { len = 18, speed = 3.2 } = {}) {
    const th = ctx.theme;
    const p = ctx.plat(0, ctx.z - len / 2, W, len, 0, '#374151', { kind: 'conveyor', conv: speed, rim: '#4b5563' });
    // A tampa ganha uma textura própria com setas que andam
    const base = patTex('arrows', '#374151', th.acc);
    const tex = base.clone();
    tex.repeat.set(1 / PAT_M.arrows, 1 / PAT_M.arrows);
    tex.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1 });
    p.cap.material = mat;
    ctx.owned.push({ dispose: () => { mat.dispose(); tex.dispose(); } });
    railings(ctx, ctx.z, len);
    // Rolos nas pontas
    const rolls = [];
    for (const zz of [ctx.z - 0.25, ctx.z - len + 0.25]) {
      const rl = ctx.mesh(G.bar(W - 0.2, 0.32), candyMat('#fde047', '#1f2937', W), 0, -0.2, zz);
      ctx.deco(rl);
      rolls.push(rl);
    }
    ctx.updaters.push((t) => {
      tex.offset.y = (t * speed) / PAT_M.arrows;
      for (const rl of rolls) rl.rotation.x = t * speed / 0.32;
    });
    p.speed = speed;
    return len;
  },
  ramp(ctx, { up = 3 } = {}) {
    const len = 12;
    const c = ctx.theme.alt;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, c, { pat: 'stripe', c2: tint(c, 0.25), slope: { z0: ctx.z, z1: ctx.z - len, y0: 0, y1: up } });
    ctx.plat(0, ctx.z - len - 4, W, 8, up, ctx.theme.floor, { thick: up + 1 });
    ctx.plat(0, ctx.z - len - 8 - len / 2, W, len, 0, c, { pat: 'stripe', c2: tint(c, 0.25), slope: { z0: ctx.z - len - 8, z1: ctx.z - 2 * len - 8, y0: up, y1: 0 } });
    railings(ctx, ctx.z - len, 8, up);
    return 2 * len + 8;
  },
  doors(ctx) {
    const len = 10;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor);
    const n = 5;
    const dw = W / n;
    const z = ctx.z - 5;
    const solid = new Set();
    while (solid.size < 3) solid.add(Math.floor(ctx.r() * n));
    for (let k = 0; k < n; k++) {
      const x = -W / 2 + dw * (k + 0.5);
      const c = k % 2 ? th.acc : th.obs;
      const door = new THREE.Group();
      door.add(ctx.mesh(rbox(dw - 0.25, 2.6, 0.6, 0.22), std(c, { rough: 0.35 }), 0, 0, 0));
      const em = ctx.mesh(G.cyl(), std('#ffffff', { rough: 0.3 }), 0, 0.3, 0.3);
      em.scale.set(0.5, 0.08, 0.5);
      em.rotation.x = Math.PI / 2;
      const dot = ctx.mesh(G.cyl(), std(c, { rough: 0.3 }), 0, 0.3, 0.33);
      dot.scale.set(0.26, 0.08, 0.26);
      dot.rotation.x = Math.PI / 2;
      door.add(em, dot);
      ctx.wall(x, z, dw - 0.25, 0.6, 2.6, 0, c, { fake: !solid.has(k), mesh: door });
    }
    // Moldura: postes redondos entre as portas e a viga de cima
    for (let k = 0; k <= n; k++) {
      const x = -W / 2 + dw * k;
      ctx.inst(G.cyl(), std(th.trim), x, 1.3, z, 0.2, 2.6, 0.2, 0, 0, 0, null, true);
    }
    ctx.wall(0, z, W + 0.6, 0.8, 1.2, 2.6, th.alt, { mesh: ctx.mesh(rbox(W + 0.6, 1.2, 0.8, 0.4), candyMat(th.alt, th.trim, W), 0, 0, 0) });
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  bounce(ctx, { n = 2 } = {}) {
    const len = 6 + n * 8;
    const endZ = ctx.z - len + 1.5;
    for (let k = 0; k < n; k++) {
      const z = ctx.z - 3 - k * 8;
      const p = ctx.plat(0, z, 5, 3.2, 0.3, '#22c55e', { kind: 'bounce', thick: 0.5, pat: 'rings', c2: '#bbf7d0', rim: '#fde047', noLegs: true });
      // Cada mola joga o boneco no meio da próxima (a última, no chão do fim): pulo sempre confiável
      p.aim = k < n - 1 ? { x: 0, y: 0.3, z: z - 8, w: 5 } : { x: 0, y: 0, z: endZ, w: W };
      springArrow(ctx, 0, 0.33, z);
      const ring = ctx.mesh(G.torus(1.5, 0.16), std('#fde047', { rough: 0.25, em: '#facc15', emI: 0.3 }), 0, 0.5, z, false);
      ring.rotation.x = Math.PI / 2;
      ctx.deco(ring);
      // Molas embaixo
      for (const s of [-1, 1]) {
        for (let j = 0; j < 4; j++) ctx.inst(G.torus(0.32, 0.07), metal(), s * 1.5, -0.35 - j * 0.22, z, 1, 1, 1, Math.PI / 2);
        ctx.inst(G.cylLo(), dark(), s * 1.5, -1.4 + WATER_Y / 2, z, 0.2, -2 - WATER_Y, 0.2);
      }
      ctx.updaters.push((t) => { const b = Math.sin(t * 4 + k) * 0.08; ring.position.y = 0.55 + b; ring.scale.setScalar(1 + b * 0.6); });
      p.ring = ring;
    }
    ctx.plat(0, ctx.z - len + 1.5, W, 3, 0, ctx.theme.floor);
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  narrow(ctx) {
    const len = 18;
    const xs = [0, -3, 2.4, -1.2, 3, 0];
    const th = ctx.theme;
    for (let k = 0; k < xs.length; k++) {
      const c = k % 2 ? th.alt : th.floor;
      const p = ctx.plat(xs[k], ctx.z - 1.5 - k * 3, 2.4, 3.2, 0, c, { pat: 'dots', c2: tint(c, 0.3), noLegs: true });
      ctx.inst(G.cone(), std(th.rock, { rough: 0.8 }), p.x, -2.1, p.z, 1.1, 2.2, 1.4, Math.PI);
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  tiles(ctx, { rows = 5 } = {}) {
    const cols = 4;
    const tw = W / cols;
    const len = rows * 3.2 + 1;
    const th = ctx.theme;
    for (let r = 0; r < rows; r++) {
      const real = new Set();
      while (real.size < 2) real.add(Math.floor(ctx.r() * cols));
      for (let c = 0; c < cols; c++) {
        const col = (r + c) % 2 ? th.acc : th.alt;
        const p = ctx.plat(-W / 2 + tw * (c + 0.5), ctx.z - 1.6 - r * 3.2, tw - 0.2, 3, 0, col, { thick: 0.4, kind: real.has(c) ? 'normal' : 'fake', pat: 'rings', c2: tint(col, 0.35), noLegs: true });
        p.tile = true;
      }
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  stairs(ctx) {
    const steps = 6;
    const rise = 0.4;
    const len = steps * 2 + 6 + steps * 2;
    const th = ctx.theme;
    for (let k = 0; k < steps; k++) ctx.plat(0, ctx.z - 1 - k * 2, W, 2, rise * (k + 1), k % 2 ? th.alt : th.floor, { thick: rise * (k + 1) + 0.5, pat: 'plain', noLegs: true });
    ctx.plat(0, ctx.z - steps * 2 - 3, W, 6, rise * steps, th.floor, { thick: rise * steps + 0.5 });
    for (let k = 0; k < steps; k++) ctx.plat(0, ctx.z - steps * 2 - 7 - k * 2, W, 2, rise * (steps - k - 1) + 0.01, k % 2 ? th.floor : th.alt, { thick: rise * (steps - k - 1) + 0.51, pat: 'plain', noLegs: true });
    legs(ctx, 0, ctx.z - len / 2, W, len, -0.5);
    return len;
  },
  sweeper(ctx) {
    // Barra baixa e comprida girando no meio: pule na hora certa.
    const len = 20;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - len / 2, W + 2, len, 0, ctx.theme.floor, { pat: 'rings', c2: tint(ctx.theme.floor, 0.25) });
    const cz = ctx.z - len / 2;
    const L = W + 6;
    const rot = new THREE.Group();
    rot.position.set(0, 0.45, cz);
    rot.add(ctx.mesh(G.bar(L, 0.3), candyMat(th.obs, '#ffffff', L), 0, 0, 0));
    for (const s of [-1, 1]) {
      const end = ctx.mesh(G.sph(), std(th.acc, { rough: 0.25 }), s * L / 2, 0, 0);
      end.scale.setScalar(0.42);
      rot.add(end);
    }
    const hub = ctx.mesh(G.cyl(), std(th.acc, { rough: 0.25 }), 0, 0.2, 0);
    hub.scale.set(0.95, 1.1, 0.95);
    const cap = ctx.mesh(G.dome(), std(th.acc, { rough: 0.25 }), 0, 0.75, 0);
    cap.scale.set(0.95, 0.5, 0.95);
    const ring = ctx.mesh(G.torus(0.95, 0.12), metal(), 0, 0.3, 0);
    ring.rotation.x = Math.PI / 2;
    rot.add(hub, cap, ring);
    ctx.deco(rot);
    ctx.inst(G.cyl(), dark(), 0, 0.1, cz, 1.4, 0.2, 1.4, 0, 0, 0, null, true);
    const h = { type: 'bar', cx: 0, cz, y: 0.45, L: L / 2, w: 1.6, ang: 0 };
    ctx.hitters.push(h);
    ctx.updaters.push((t) => { h.ang = t * 1.6; rot.rotation.y = h.ang; });
    gear(ctx, -(W / 2 + 1.5), -1, cz - 4, 2.6, th.alt, -1);
    gear(ctx, W / 2 + 1.5, -1, cz + 4, 2.6, th.alt, 1);
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  hammers(ctx, { n = 4 } = {}) {
    // Martelos que batem na pista vindo dos lados (alternando o lado)
    const len = 4 + n * 6;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor, { pat: 'stripe', c2: tint(ctx.theme.floor, 0.2) });
    const L = 5;
    for (let k = 0; k < n; k++) {
      const z = ctx.z - 5 - k * 6;
      const s = k % 2 ? 1 : -1;
      const px = s * (W / 2 + 0.9);
      // Caixa do eixo em cima de uma coluna
      ctx.inst(rbox(1.4, 1.5, 1.8, 0.4), std(th.alt), px, 0.9, z, 1, 1, 1, 0, 0, 0, null, true);
      ctx.inst(G.cylLo(), dark(), px, (0.2 + WATER_Y) / 2, z, 0.4, 0.2 - WATER_Y, 0.4);
      const pivot = new THREE.Group();
      pivot.position.set(px, 1.0, z);
      const handle = ctx.mesh(G.cylLo(), candyMat('#fde68a', '#b45309', L), 0, L / 2, 0);
      handle.scale.set(0.2, L, 0.2);
      const head = new THREE.Group();
      head.position.y = L;
      const hc = ctx.mesh(G.cyl(), std(th.obs, { rough: 0.3 }), 0, 0, 0);
      hc.scale.set(1.0, 2.3, 1.0);
      hc.rotation.x = Math.PI / 2;
      head.add(hc);
      for (const e of [-1, 1]) {
        const rim = ctx.mesh(G.torus(0.95, 0.16), std('#ffffff', { rough: 0.3 }), 0, 0, e * 1.12);
        const capd = ctx.mesh(G.dome(), std(th.acc, { rough: 0.3 }), 0, 0, e * 1.15);
        capd.scale.set(0.9, 0.35, 0.9);
        capd.rotation.x = e * Math.PI / 2;
        head.add(rim, capd);
      }
      const axle = ctx.mesh(G.cyl(), metal(), 0, 0, 0);
      axle.scale.set(0.35, 1.9, 0.35);
      axle.rotation.x = Math.PI / 2;
      pivot.add(handle, head, axle);
      ctx.deco(pivot);
      const ph = k * 1.1;
      const h = { type: 'ball', x: px, y: 6, z, r: 1.15, vx: 0 };
      ctx.hitters.push(h);
      ctx.updaters.push((t) => {
        const e = (Math.sin(t * 1.9 + ph) + 1) / 2;
        const de = Math.cos(t * 1.9 + ph) * 0.95;
        const th2 = 1.48 * e * e * (3 - 2 * e);
        pivot.rotation.z = s * th2;
        h.x = px - s * L * Math.sin(th2);
        h.y = 1.0 + L * Math.cos(th2);
        h.vx = -s * L * Math.cos(th2) * 1.48 * 6 * e * (1 - e) * de;
      });
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  discs(ctx, { n = 3 } = {}) {
    // Discos giratórios (carrossel): quem está em cima gira junto
    const R0 = 4.4;
    const gap = 1.3;
    const len = 1.2 + n * (2 * R0 + gap);
    const th = ctx.theme;
    for (let k = 0; k < n; k++) {
      const cz = ctx.z - 1.2 - R0 - k * (2 * R0 + gap);
      const spin = (k % 2 ? -1 : 1) * 0.55;
      const c = k % 2 ? th.acc : th.alt;
      const g = new THREE.Group();
      g.add(ctx.mesh(cached(`disc${R0}`, () => new THREE.CylinderGeometry(R0, R0 - 0.35, 1, 48)), std(th.trim, { rough: 0.38 }), 0, 0, 0, false));
      g.add(ctx.mesh(discCap(R0 - 0.3), patMat('rings', c, tint(c, 0.35)), 0, 0.505, 0, false));
      const rim = ctx.mesh(G.torus(R0 - 0.12, 0.14), std(th.obs, { rough: 0.3 }), 0, 0.5, 0, false);
      rim.rotation.x = Math.PI / 2;
      g.add(rim);
      // Pininhos na borda (mostram que está girando)
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2;
        const pin = ctx.mesh(G.sphLo(), std('#ffffff', { rough: 0.3 }), Math.cos(a) * (R0 - 0.55), 0.55, Math.sin(a) * (R0 - 0.55), false);
        pin.scale.set(0.22, 0.14, 0.22);
        g.add(pin);
      }
      const dome = ctx.mesh(G.dome(), std(th.obs, { rough: 0.3 }), 0, 0.5, 0, false);
      dome.scale.set(0.8, 0.3, 0.8);
      g.add(dome);
      ctx.plat(0, cz, 2 * R0, 2 * R0, 0, null, { mesh: g, r: R0, spin, noLegs: true });
      ctx.inst(G.cylLo(), dark(), 0, (WATER_Y - 1) / 2, cz, 0.9, -1 - WATER_Y, 0.9);
      ctx.inst(G.torus(1.1, 0.16), std('#ffffff', { rough: 0.8 }), 0, WATER_Y + 0.05, cz, 1, 1, 1, Math.PI / 2);
      // No disco do meio, uma barra baixa gira ao contrário
      if (k % 2) {
        const { rot, h } = spinBar(ctx, cz, 0.45, 2 * R0 - 1.2, -spin * 2.6);
        ctx.updaters.push((t) => { h.ang = t * h.w; rot.rotation.y = h.ang; });
      }
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  boulders(ctx) {
    // Rampa com bolas gigantes rolando para baixo em 3 faixas
    const L = 26;
    const up = 4;
    const top = 6;
    const down = 8;
    const len = L + top + down;
    const th = ctx.theme;
    const z0 = ctx.z;
    const zTop = ctx.z - L;
    ctx.plat(0, ctx.z - L / 2, W, L, 0, th.alt, { pat: 'stripe', c2: tint(th.alt, 0.25), slope: { z0, z1: zTop, y0: 0, y1: up } });
    ctx.plat(0, zTop - top / 2, W, top, up, th.floor, { thick: up + 1 });
    ctx.plat(0, zTop - top - down / 2, W, down, 0, th.alt, { pat: 'stripe', c2: tint(th.alt, 0.25), slope: { z0: zTop - top, z1: zTop - top - down, y0: up, y1: 0 } });
    railings(ctx, zTop, top, up);
    const P = 4.2;
    const v = 8;
    const r = 1.1;
    const lanes = [-3.8, 0, 3.8];
    lanes.forEach((x, k) => {
      const ball = new THREE.Group();
      const b = ctx.mesh(G.sph(), std('#ffffff', { map: patTex('stripe', k === 1 ? th.obs : th.acc, '#ffffff'), rough: 0.3 }), 0, 0, 0);
      b.scale.setScalar(r);
      ball.add(b);
      ctx.deco(ball);
      // Canhãozinho no topo de cada faixa
      ctx.inst(rbox(1.6, 1.4, 1.6, 0.5), std(th.obs), x, up + 0.7, zTop - top + 0.9, 1, 1, 1, 0, 0, 0, null, true);
      ctx.inst(G.torus(0.6, 0.18), std('#1f2937'), x, up + 0.8, zTop - top + 1.75, 1, 1, 1, 0, 0, 0, null, false);
      const h = { type: 'roll', x, y: 0, z: zTop, r, vz: v, z0, z1: zTop, off: true };
      ctx.hitters.push(h);
      const ph = k * (P / 3) + 0.5;
      ctx.updaters.push((t) => {
        const u = (((t + ph) % P) + P) % P;
        const s = u * v - 1.5;
        if (s < L) {
          const ss = Math.max(0, s);
          h.z = zTop + ss;
          h.y = up * (1 - ss / L) + r;
          h.off = s < 0;
          ball.scale.setScalar(Math.min(1, u * 3));
          b.rotation.x = ss / r;
        } else {
          // No pé da rampa a bola some (vira confete)
          h.off = true;
          h.z = z0;
          h.y = r;
          ball.scale.setScalar(Math.max(0, 1 - (s - L) / 1.5));
        }
        ball.position.set(x, h.y, h.z);
      });
    });
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  axes(ctx, { n = 4 } = {}) {
    // Machados balançando por cima da pista larga
    const len = 6 + n * 6;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, th.floor, { pat: 'check' });
    const Lr = 5.6;
    const py = 7.4;
    for (let k = 0; k < n; k++) {
      const pz = ctx.z - 5 - k * 6;
      for (const s of [-1, 1]) {
        const h = py + 0.4 - WATER_Y;
        ctx.inst(G.cylLo(), std(th.trim), s * (W / 2 + 0.6), py + 0.4 - h / 2, pz, 0.3, h, 0.3, 0, 0, 0, null, true);
        ctx.inst(G.sphLo(), std(th.acc, { rough: 0.25 }), s * (W / 2 + 0.6), py + 0.55, pz, 0.45);
      }
      ctx.inst(rbox(W + 1.8, 0.55, 0.7, 0.25), std(th.alt), 0, py + 0.2, pz, 1, 1, 1, 0, 0, 0, null, true);
      const pivot = new THREE.Group();
      pivot.position.set(0, py, pz);
      const handle = ctx.mesh(G.cylLo(), candyMat('#fde68a', '#92400e', Lr), 0, -Lr / 2, 0);
      handle.scale.set(0.16, Lr, 0.16);
      const blade = ctx.mesh(rbox(0.4, 1.5, 2.6, 0.3), std('#e2e8f0', { rough: 0.2, metal: 0.7 }), 0, -Lr, 0);
      const edge = ctx.mesh(rbox(0.22, 0.3, 2.7, 0.1), std(th.obs, { rough: 0.3 }), 0, -Lr - 0.82, 0);
      const knob = ctx.mesh(G.sphLo(), std(th.obs, { rough: 0.3 }), 0, -Lr + 0.85, 0);
      knob.scale.setScalar(0.35);
      pivot.add(handle, blade, edge, knob);
      ctx.deco(pivot);
      const ph = k * 1.25;
      const h = { type: 'ball', x: 0, y: 2, z: pz, r: 1.25, vx: 0 };
      ctx.hitters.push(h);
      ctx.updaters.push((t) => {
        const a = Math.sin(t * 1.7 + ph) * 1.05;
        pivot.rotation.z = a;
        h.x = Math.sin(a) * Lr;
        h.y = py - Math.cos(a) * Lr;
        h.vx = Math.cos(t * 1.7 + ph) * 1.7 * 1.05 * Lr;
      });
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  seesaw(ctx, { n = 3 } = {}) {
    // Gangorras que balançam de um lado para o outro (escorrega para o lado mais baixo)
    const pw = 6.5;
    const pl = 8;
    const gap = 1.2;
    const len = gap + n * (pl + gap);
    const th = ctx.theme;
    for (let k = 0; k < n; k++) {
      const z = ctx.z - gap - pl / 2 - k * (pl + gap);
      const c = k % 2 ? th.acc : th.floor;
      const g = new THREE.Group();
      g.add(ctx.mesh(rbox(pw, 0.8, pl, 0.32), std(th.trim, { rough: 0.38 }), 0, 0, 0, false));
      const cap = ctx.mesh(capGeo(pw - 0.64, pl - 0.64), patMat('stripe', c, tint(c, 0.25)), 0, 0.404, 0, false);
      g.add(cap);
      const ph = k * 1.6;
      ctx.plat(0, z, pw, pl, 0, null, { mesh: g, thick: 0.8, noLegs: true, tilt: (t) => Math.sin(t * 1.15 + ph) * 0.26 });
      // Eixo e pedestal
      const axle = ctx.mesh(G.cylLo(), metal(), 0, -0.55, z);
      axle.scale.set(0.35, pl + 0.6, 0.35);
      axle.rotation.x = Math.PI / 2;
      ctx.deco(axle);
      ctx.inst(rbox(1.4, 1.2, pl - 1, 0.4), std(th.obs), 0, -1.2, z, 1, 1, 1, 0, 0, 0, null, false);
      ctx.inst(G.cylLo(), dark(), 0, (WATER_Y - 1.8) / 2, z, 0.5, -1.8 - WATER_Y, 0.5);
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  honey(ctx, { rows = 8 } = {}) {
    // Favo de mel: hexágonos que tremem, caem quando alguém pisa e voltam depois
    const Rh = 1.25;
    const dzr = 1.5 * Rh;
    const dxc = Rh * Math.sqrt(3);
    const len = rows * dzr + 1.2;
    const hex = cached('hex', () => new THREE.CylinderGeometry(Rh * 0.96, Rh * 0.86, 0.6, 6));
    const hexTop = cached('hexTop', () => new THREE.CylinderGeometry(Rh * 0.78, Rh * 0.78, 0.04, 6));
    const cols = ['#fbbf24', '#f59e0b', '#fcd34d'];
    for (let r = 0; r < rows; r++) {
      const odd = r % 2;
      const nC = odd ? 4 : 5;
      for (let c = 0; c < nC; c++) {
        const x = (c - (nC - 1) / 2) * dxc;
        const z = ctx.z - 0.6 - Rh - r * dzr;
        const col = cols[(r + c) % 3];
        const g = new THREE.Group();
        g.add(ctx.mesh(hex, std(col, { rough: 0.3 }), 0, 0, 0, false));
        g.add(ctx.mesh(hexTop, std(tint(col, 0.35), { rough: 0.25 }), 0, 0.31, 0, false));
        const p = ctx.plat(x, z, 2.0, 2.0, 0, null, { mesh: g, thick: 0.6, kind: 'crumble', noLegs: true });
        p.tile = true;
      }
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  ice(ctx, { len = 24 } = {}) {
    // Gelo escorregadio com cogumelos no caminho
    ctx.plat(0, ctx.z - len / 2, W, len, 0, '#c7ecff', { kind: 'ice', pat: 'check', c2: '#eaf8ff', rim: '#ffffff' });
    const th = ctx.theme;
    const r = ctx.r;
    for (let dz = 5; dz < len - 3; dz += 4.5) {
      const x = (r() - 0.5) * (W - 3);
      bumper(ctx, x, ctx.z - dz, Math.round(dz) % 2 ? th.acc : '#38bdf8');
    }
    // Floquinhos de neve (enfeite)
    for (let k = 0; k < 6; k++) ctx.inst(G.sphLo(), std('#ffffff', { rough: 0.9 }), (k % 2 ? 1 : -1) * (W / 2 - 0.4), 0.15, ctx.z - 2 - k * (len - 4) / 5, 0.35, 0.25, 0.35);
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  fans(ctx, { n = 3 } = {}) {
    // Ventiladores dos lados ligam e desligam: o vento empurra para fora da pista
    const len = 6 + n * 8;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, th.floor, { pat: 'stripe', c2: tint(th.floor, 0.2) });
    for (let k = 0; k < n; k++) fan(ctx, ctx.z - 5 - k * 8, k % 2 ? 1 : -1, k * 2.1, W);
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  windbridge(ctx, { n = 3 } = {}) {
    // Ponte estreita entre ventiladores gigantes: vento forte vindo dos dois lados, um de cada vez
    const len = 6 + n * 8;
    const bw = 6.5;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - 1.5, W, 3, 0, th.floor, { pat: 'plain', noLegs: true });
    ctx.plat(0, ctx.z - len / 2, bw, len - 6, 0, th.alt, { pat: 'arrows', c2: tint(th.alt, 0.3) });
    ctx.plat(0, ctx.z - len + 1.5, W, 3, 0, th.floor, { pat: 'plain', noLegs: true });
    for (let k = 0; k < n; k++) {
      const z = ctx.z - 6 - k * 8;
      fan(ctx, z, -1, k * 2.4, bw, 5.4);
      fan(ctx, z - 2.6, 1, k * 2.4 + Math.PI / 1.1, bw, 5.4);
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  logs(ctx, { n = 4 } = {}) {
    // Troncos girando: em cima deles o jogador é levado para o lado
    const Ll = 5.2;
    const gap = 1.3;
    const r = 1.1;
    const len = gap + n * (Ll + gap);
    const th = ctx.theme;
    const geo = cached('logz', () => new THREE.CylinderGeometry(r, r, Ll, 24).rotateX(Math.PI / 2));
    for (let k = 0; k < n; k++) {
      const z = ctx.z - gap - Ll / 2 - k * (Ll + gap);
      const conv = (k % 2 ? -1 : 1) * 2.6;
      const g = new THREE.Group();
      const log = ctx.mesh(geo, candyMat(k % 2 ? th.acc : '#f59e0b', '#fff7ed', Ll), 0, 0, 0, false);
      g.add(log);
      for (const e of [-1, 1]) {
        const rim = ctx.mesh(G.torus(r - 0.02, 0.12), std(th.obs, { rough: 0.3 }), 0, 0, e * (Ll / 2 - 0.15), false);
        g.add(rim);
      }
      ctx.plat(0, z, 2.2, Ll, 0, null, { mesh: g, thick: 2 * r, convX: conv, noLegs: true });
      ctx.updaters.push((t) => { log.rotation.z = -t * conv / r; });
      for (const e of [-1, 1]) {
        ctx.inst(G.cylLo(), dark(), 0, (WATER_Y - r) / 2, z + e * (Ll / 2 + 0.2), 0.25, -r - WATER_Y, 0.25);
        ctx.inst(G.sphLo(), metal(), 0, -r, z + e * (Ll / 2 + 0.2), 0.35);
      }
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  lifts(ctx, { rows = 4 } = {}) {
    // Elevadores: plataformas subindo e descendo fora de ritmo
    const len = 1.5 + rows * 5.5;
    const th = ctx.theme;
    for (let k = 0; k < rows; k++) {
      const z = ctx.z - 3.5 - k * 5.5;
      const ph = k * 1.9;
      const x = k % 2 ? 1.2 : -1.2;
      const c = k % 2 ? th.obs : th.acc;
      const p = ctx.plat(x, z, 4.2, 4.2, 0, c, { cast: true, pat: 'rings', c2: tint(c, 0.35), move: (t, o) => { o.x = 0; o.y = Math.sin(t * 1.2 + ph) * 1.8; o.z = 0; return o; } });
      const piston = ctx.mesh(G.cylLo(), metal(), 0, -7.5, 0, false);
      piston.scale.set(0.35, 14, 0.35);
      p.mesh.add(piston);
      ctx.inst(G.cylLo(), dark(), x, (WATER_Y - 4.5) / 2, z, 0.6, -4.5 - WATER_Y, 0.6);
      ctx.inst(G.torus(0.62, 0.12), std(th.trim), x, -4.5, z, 1, 1, 1, Math.PI / 2);
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  holewalls(ctx, { n = 3 } = {}) {
    // Paredes andando de lado com um buraco: passe pelo buraco
    const len = 4 + n * 7;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, th.floor, { pat: 'check' });
    railings(ctx, ctx.z, len);
    const hole = 2.8;
    const pw = 12;
    for (let k = 0; k < n; k++) {
      const z = ctx.z - 5 - k * 7;
      const c = k % 2 ? th.obs : th.acc;
      const ph = k * 2.1;
      const parts = [-1, 1].map((s) => {
        const m = new THREE.Group();
        m.add(ctx.mesh(rbox(pw, 3, 0.8, 0.38), std(c, { rough: 0.35 }), 0, 0, 0));
        m.add(ctx.mesh(rbox(pw - 0.4, 0.3, 0.9, 0.14), std('#ffffff', { rough: 0.3 }), 0, 0.9, 0));
        // Bolinhas na borda do buraco
        m.add(ctx.mesh(G.sphLo(), std('#fde047', { rough: 0.25, em: '#facc15', emI: 0.3 }), -s * (pw / 2), 1.6, 0));
        m.children[2].scale.setScalar(0.35);
        return ctx.wall(s * (hole / 2 + pw / 2), z, pw, 0.8, 3, 0, c, { mesh: m });
      });
      for (const wl of parts) wl.hole = true;
      ctx.updaters.push((t) => {
        const hx = Math.sin(t * 0.9 + ph) * 3.4;
        const vx = Math.cos(t * 0.9 + ph) * 0.9 * 3.4;
        for (const wl of parts) { wl.ox = hx; wl.vx = vx; wl.mesh.position.x = wl.x + hx; }
      });
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  finish(ctx) {
    const len = 12;
    const th = ctx.theme;
    ctx.plat(0, ctx.z - len / 2, W + 4, len, 0, '#ffffff', { pat: 'check', c2: '#eef2ff', rim: th.acc });
    // Faixa quadriculada no chão e arco de chegada
    const tex = canvasTex('finishline', 512, 64, (g) => {
      for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111827' : '#ffffff'; g.fillRect(x * 32, y * 32, 32, 32); }
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const line = ctx.mesh(cached('fline', () => new THREE.PlaneGeometry(W + 3.2, 1.6).rotateX(-Math.PI / 2)), std('#ffffff', { map: tex, rough: 0.6 }), 0, 0.02, ctx.z - 2, false);
    ctx.deco(line);
    arch(ctx, ctx.z - 2, 'CHEGADA', true);
    flags(ctx, ctx.z + 1, len, W / 2 + 2.6, 5);
    emblemSign(ctx, -(W / 2 + 6), ctx.z - len + 3, 5);
    emblemSign(ctx, W / 2 + 6, ctx.z - len + 3, 5);
    // Pódio de festa no fundo
    ctx.inst(rbox(4, 1.2, 3, 0.4), std(th.alt), 0, 0.6, ctx.z - len + 2.2, 1, 1, 1, 0, 0, 0, null, true);
    ctx.inst(rbox(3, 0.8, 3, 0.35), std(th.obs), -3.6, 0.4, ctx.z - len + 2.2, 1, 1, 1, 0, 0, 0, null, true);
    ctx.inst(rbox(3, 0.5, 3, 0.25), std(th.acc), 3.6, 0.25, ctx.z - len + 2.2, 1, 1, 1, 0, 0, 0, null, true);
    ctx.finishZ = ctx.z - 2;
    return len;
  },
};

// ───────────── As 30 fases ─────────────
// Cada fase tem duas metades separadas por uma praça (ponto seguro): ~400 a 480 m, de 1 a 2 minutos.

const F6 = ['floor', { len: 6 }];
const F4 = ['floor', { len: 4 }];
export const STAGES = [
  { name: 'Trilha da Largada', segs: [['floor', { len: 8 }], ['spinner'], ['doors'], F6, ['conveyor'], ['spinner', { low: true }], ['bumpers'], ['doors'], F6, ['holewalls', { n: 2 }], ['fans', { n: 2 }], ['spinner'], ['plaza'], ['pendulums'], F6, ['tiles', { rows: 4 }], F4, ['hammers', { n: 3 }], ['bounce'], ['sweeper'], F6, ['doors'], ['moving', { rows: 3 }], F6, ['pushers', { n: 3 }], ['finish']] },
  { name: 'Ponte dos Pêndulos', segs: [['floor', { len: 8 }], ['pendulums'], F6, ['pendulums', { n: 4 }], F6, ['spinner'], ['pendulums', { n: 5 }], F6, ['axes', { n: 3 }], ['plaza'], ['narrow'], ['pendulums', { n: 3 }], F6, ['seesaw', { n: 2 }], F6, ['windbridge', { n: 2 }], ['axes', { n: 4 }], F6, ['bounce'], ['pendulums', { n: 4 }], ['finish']] },
  { name: 'Fábrica de Pistões', segs: [['floor', { len: 8 }], ['pushers'], ['conveyor', { len: 14 }], ['pushers', { n: 5 }], F6, ['hammers', { n: 3 }], ['pushers', { n: 6 }], F6, ['holewalls'], ['plaza'], ['conveyor', { len: 16, speed: 3.6 }], ['pushers', { n: 4 }], ['lifts', { rows: 3 }], F6, ['spinner', { low: true }], ['hammers', { n: 4 }], F6, ['fans', { n: 2 }], ['pushers', { n: 5 }], ['finish']] },
  { name: 'Lago das Plataformas', segs: [['floor', { len: 8 }], ['moving'], F6, ['moving', { rows: 4 }], F6, ['narrow'], ['moving', { rows: 5 }], F6, ['lifts', { rows: 3 }], F6, ['moving', { rows: 4 }], ['plaza'], ['logs', { n: 3 }], F6, ['bounce', { n: 3 }], ['moving', { rows: 4 }], F6, ['discs', { n: 2 }], F6, ['lifts', { rows: 4 }], F6, ['moving', { rows: 3 }], F6, ['bounce'], ['finish']] },
  { name: 'Pula-Pula', segs: [['floor', { len: 8 }], ['bounce'], ['spinner', { low: true }], ['bounce', { n: 3 }], F6, ['bumpers'], ['bounce', { n: 3 }], F6, ['bounce', { n: 4 }], ['plaza'], ['launch'], ['bumpers'], ['bounce', { n: 3 }], F6, ['sweeper'], ['launch', { up: 5 }], ['bounce', { n: 4 }], F6, ['spinner'], ['bounce', { n: 2 }], ['finish']] },
  { name: 'Portas da Sorte', segs: [['floor', { len: 8 }], ['doors'], F6, ['doors'], F6, ['doors'], ['pushers', { n: 3 }], ['doors'], F6, ['doors'], F6, ['doors'], ['holewalls'], ['doors'], ['pushers', { n: 3 }], ['plaza'], ['doors'], ['spinner'], ['doors'], F6, ['tiles', { rows: 4 }], F4, ['doors'], ['sweeper'], ['doors'], ['holewalls', { n: 2 }], ['doors'], F6, ['doors'], ['pendulums', { n: 2 }], ['finish']] },
  { name: 'Pisos Traiçoeiros', segs: [['floor', { len: 8 }], ['tiles'], F6, ['tiles', { rows: 6 }], F6, ['spinner', { low: true }], ['tiles', { rows: 7 }], F4, ['honey', { rows: 8 }], F6, ['spinner'], ['tiles', { rows: 5 }], ['plaza'], ['honey', { rows: 10 }], F6, ['fans', { n: 2 }], ['tiles', { rows: 6 }], F6, ['bounce'], ['tiles', { rows: 5 }], F4, ['sweeper'], ['honey', { rows: 8 }], F4, ['spinner'], F6, ['finish']] },
  { name: 'Montanha Russa', segs: [['floor', { len: 8 }], ['ramp'], ['spinner'], ['ramp', { up: 4 }], F6, ['ramp', { up: 5 }], ['sweeper'], F6, ['boulders'], ['plaza'], ['launch'], ['spinner', { low: true }], ['ramp', { up: 4 }], ['hammers', { n: 3 }], ['boulders'], F6, ['stairs'], ['finish']] },
  { name: 'Corredor dos Martelos', segs: [['floor', { len: 8 }], ['hammers'], F6, ['hammers'], ['spinner'], ['hammers', { n: 5 }], F6, ['axes'], ['hammers', { n: 3 }], ['plaza'], ['pushers', { n: 4 }], ['hammers', { n: 4 }], F6, ['windbridge', { n: 2 }], ['axes', { n: 3 }], F6, ['hammers', { n: 6 }], ['bounce'], ['finish']] },
  { name: 'Hélice Gigante', segs: [['floor', { len: 8 }], ['sweeper'], F6, ['spinner', { n: 2 }], ['sweeper'], F6, ['spinner', { low: true, n: 2 }], ['sweeper'], F6, ['discs', { n: 2 }], F4, ['sweeper'], ['plaza'], ['fans', { n: 3 }], ['sweeper'], ['spinner', { n: 2 }], F6, ['discs', { n: 2 }], F4, ['sweeper'], ['pushers', { n: 3 }], ['finish']] },
  { name: 'Parque dos Bumpers', segs: [['floor', { len: 8 }], ['bumpers'], ['conveyor', { len: 12 }], ['bumpers'], F6, ['pushers', { n: 3 }], ['bumpers'], F6, ['ice'], ['bumpers'], ['plaza'], ['bounce', { n: 2 }], ['bumpers'], ['fans', { n: 2 }], ['bumpers'], ['spinner', { low: true }], ['ice', { len: 20 }], ['bumpers'], F6, ['holewalls', { n: 2 }], ['bumpers'], ['finish']] },
  { name: 'Equilibrista', segs: [['floor', { len: 8 }], ['narrow'], F6, ['narrow'], ['pendulums', { n: 2 }], ['narrow'], F6, ['pendulums'], F6, ['seesaw'], F6, ['narrow'], ['plaza'], ['windbridge', { n: 3 }], ['narrow'], ['seesaw', { n: 3 }], F6, ['logs', { n: 3 }], ['narrow'], F6, ['pendulums', { n: 3 }], ['finish']] },
  { name: 'Escadaria', segs: [['floor', { len: 8 }], ['stairs'], ['spinner'], ['stairs'], F6, ['stairs'], ['spinner', { low: true }], F6, ['lifts', { rows: 3 }], F6, ['plaza'], ['launch'], ['stairs'], ['hammers', { n: 3 }], ['stairs'], F6, ['lifts', { rows: 4 }], F6, ['ramp', { up: 5 }], ['sweeper'], ['finish']] },
  { name: 'Esteira Maluca', segs: [['floor', { len: 8 }], ['conveyor', { len: 22, speed: 4 }], ['pushers'], ['conveyor', { len: 16, speed: 4.2 }], ['bumpers'], ['conveyor', { len: 18, speed: 4.2 }], F6, ['spinner'], ['logs', { n: 3 }], F6, ['conveyor', { len: 14 }], ['plaza'], ['conveyor', { len: 20, speed: 4.4 }], ['hammers', { n: 3 }], ['conveyor', { len: 16, speed: 4 }], ['fans', { n: 2 }], ['logs', { n: 4 }], F6, ['conveyor', { len: 22, speed: 4.6 }], ['pushers', { n: 3 }], ['spinner'], F6, ['finish']] },
  { name: 'Ilhas Flutuantes', segs: [['floor', { len: 8 }], ['moving', { rows: 2 }], F4, ['narrow'], ['moving', { rows: 3 }], F6, ['moving', { rows: 4 }], F6, ['bounce'], ['moving', { rows: 3 }], F6, ['lifts', { rows: 3 }], ['plaza'], ['launch'], ['moving', { rows: 4 }], F6, ['discs', { n: 2 }], F4, ['lifts', { rows: 4 }], F6, ['bounce', { n: 3 }], ['moving', { rows: 4 }], F6, ['narrow'], ['finish']] },
  { name: 'Mistura Total', segs: [['floor', { len: 8 }], ['spinner'], ['tiles', { rows: 4 }], F4, ['hammers'], ['doors'], ['pushers', { n: 3 }], ['sweeper'], F6, ['fans', { n: 2 }], ['honey', { rows: 6 }], F6, ['discs', { n: 2 }], ['plaza'], ['axes', { n: 3 }], ['bounce'], ['logs', { n: 3 }], F6, ['holewalls', { n: 2 }], ['seesaw', { n: 2 }], F6, ['lifts', { rows: 3 }], F6, ['boulders'], ['finish']] },
  { name: 'Salto no Vazio', segs: [['floor', { len: 8 }], ['bounce', { n: 3 }], ['narrow'], ['bounce'], ['moving', { rows: 3 }], F6, ['bounce', { n: 3 }], F6, ['logs', { n: 3 }], F6, ['bounce'], ['plaza'], ['launch', { up: 5 }], ['narrow'], ['bounce', { n: 4 }], ['moving', { rows: 4 }], F6, ['launch'], ['tiles', { rows: 5 }], F4, ['bounce', { n: 3 }], ['finish']] },
  { name: 'Rodamoinho', segs: [['floor', { len: 8 }], ['sweeper'], ['bumpers'], ['sweeper'], F6, ['spinner', { n: 2 }], ['sweeper'], F6, ['discs'], F6, ['plaza'], ['spinner', { low: true, n: 2 }], ['sweeper'], ['discs', { n: 2 }], F6, ['fans', { n: 3 }], ['sweeper'], ['spinner', { n: 2 }], F6, ['discs'], ['finish']] },
  { name: 'Desafio do Acampamento', segs: [['floor', { len: 8 }], ['pushers'], ['pendulums'], ['tiles', { rows: 4 }], F4, ['ramp'], ['hammers'], ['moving', { rows: 3 }], F6, ['axes', { n: 3 }], ['seesaw', { n: 2 }], ['plaza'], ['windbridge', { n: 2 }], ['honey', { rows: 8 }], F6, ['bounce', { n: 2 }], ['logs', { n: 3 }], F6, ['doors'], ['sweeper'], ['finish']] },
  { name: 'Grande Final DBV', segs: [['floor', { len: 8 }], ['spinner', { n: 2 }], ['moving', { rows: 3 }], F4, ['hammers'], ['doors'], ['sweeper'], ['pendulums'], ['bumpers'], F6, ['boulders'], ['holewalls', { n: 2 }], ['plaza'], ['launch'], ['fans', { n: 3 }], ['tiles', { rows: 5 }], F4, ['axes', { n: 3 }], ['discs', { n: 2 }], F6, ['pushers', { n: 4 }], ['finish']] },
  { name: 'Carrossel Maluco', segs: [['floor', { len: 8 }], ['discs'], F6, ['spinner'], ['discs'], F6, ['sweeper'], ['discs', { n: 2 }], F6, ['bumpers'], ['spinner', { low: true }], ['plaza'], ['discs', { n: 4 }], F6, ['fans', { n: 2 }], ['discs', { n: 3 }], F6, ['sweeper'], ['discs', { n: 2 }], ['bumpers'], ['finish']] },
  { name: 'Avalanche de Bolas', segs: [['floor', { len: 8 }], ['boulders'], F6, ['spinner'], ['boulders'], F6, ['pushers', { n: 3 }], ['boulders'], ['bumpers'], ['plaza'], ['boulders'], ['hammers', { n: 3 }], ['boulders'], F6, ['bounce'], ['boulders'], ['finish']] },
  { name: 'Machados do Ferreiro', segs: [['floor', { len: 8 }], ['axes'], F6, ['hammers'], ['axes', { n: 5 }], F6, ['pendulums'], ['axes', { n: 3 }], F6, ['hammers', { n: 3 }], ['plaza'], ['axes', { n: 4 }], ['narrow'], ['hammers', { n: 4 }], F6, ['axes', { n: 5 }], ['pendulums', { n: 3 }], F6, ['axes', { n: 3 }], ['finish']] },
  { name: 'Gangorra Gigante', segs: [['floor', { len: 8 }], ['seesaw'], F6, ['narrow'], ['seesaw', { n: 4 }], F6, ['bounce', { n: 2 }], ['seesaw'], F6, ['spinner'], ['plaza'], ['seesaw', { n: 4 }], F6, ['windbridge', { n: 2 }], ['seesaw', { n: 3 }], F6, ['logs', { n: 3 }], ['seesaw', { n: 3 }], ['bounce'], ['finish']] },
  { name: 'Favo de Mel', segs: [['floor', { len: 8 }], ['honey'], F6, ['spinner', { low: true }], ['honey', { rows: 10 }], F6, ['hammers', { n: 3 }], ['honey', { rows: 12 }], F6, ['doors'], ['honey'], F6, ['tiles', { rows: 5 }], F4, ['plaza'], ['honey', { rows: 12 }], F6, ['fans', { n: 2 }], ['honey', { rows: 10 }], F6, ['sweeper'], ['honey', { rows: 14 }], F6, ['bounce', { n: 2 }], ['honey', { rows: 8 }], F4, ['spinner', { low: true }], F6, ['finish']] },
  { name: 'Pista de Gelo', segs: [['floor', { len: 8 }], ['ice'], F6, ['sweeper'], ['ice', { len: 30 }], ['pushers', { n: 4 }], ['ice'], ['spinner', { low: true }], ['ice', { len: 20 }], F6, ['plaza'], ['ice', { len: 28 }], ['fans', { n: 2 }], ['ice', { len: 24 }], ['hammers', { n: 3 }], ['ice', { len: 26 }], F6, ['bumpers'], F6, ['finish']] },
  { name: 'Vendaval', segs: [['floor', { len: 8 }], ['fans'], F6, ['narrow'], ['fans', { n: 4 }], F6, ['moving', { rows: 3 }], F6, ['fans'], ['bumpers'], ['plaza'], ['windbridge', { n: 3 }], F6, ['fans', { n: 4 }], ['bounce'], ['windbridge', { n: 2 }], F6, ['fans', { n: 3 }], ['narrow'], F6, ['finish']] },
  { name: 'Troncos Rolantes', segs: [['floor', { len: 8 }], ['logs'], F6, ['conveyor', { len: 16 }], ['logs', { n: 5 }], F6, ['spinner'], ['logs'], F6, ['hammers', { n: 3 }], ['plaza'], ['logs', { n: 5 }], F6, ['fans', { n: 2 }], ['logs', { n: 4 }], ['conveyor', { len: 14, speed: 4 }], ['logs', { n: 6 }], F6, ['spinner'], F6, ['finish']] },
  { name: 'Elevadores', segs: [['floor', { len: 8 }], ['lifts'], F6, ['stairs'], ['lifts', { rows: 5 }], F6, ['pushers', { n: 3 }], ['lifts'], F6, ['sweeper'], ['plaza'], ['launch'], ['lifts', { rows: 5 }], F6, ['moving', { rows: 3 }], F6, ['lifts', { rows: 4 }], ['stairs'], ['lifts', { rows: 4 }], F6, ['hammers', { n: 3 }], ['finish']] },
  { name: 'Paredão Furado', segs: [['floor', { len: 8 }], ['holewalls'], F6, ['doors'], ['holewalls', { n: 4 }], ['spinner'], ['holewalls'], F6, ['pushers', { n: 4 }], ['holewalls', { n: 2 }], ['plaza'], ['holewalls', { n: 4 }], ['fans', { n: 2 }], ['holewalls', { n: 3 }], F6, ['doors'], ['holewalls', { n: 4 }], F6, ['sweeper'], F6, ['finish']] },
];

// ───────────── Cenário em volta da pista ─────────────

function skyTex(th) {
  return canvasTex(`sky${th.skyTop}${th.skyBot}`, 4, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, th.skyTop);
    gr.addColorStop(0.55, tint(th.skyTop, 0.45));
    gr.addColorStop(0.8, th.skyBot);
    gr.addColorStop(1, th.skyBot);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}
function waterTex(th) {
  return canvasTex(`water${th.water}`, 256, 256, (g, s) => {
    g.fillStyle = th.water; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 5; g.lineCap = 'round';
    const r = rng(7);
    for (let k = 0; k < 14; k++) {
      const x = r() * s;
      const y = r() * s;
      const l = 20 + r() * 40;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + l * 0.3, y - 6, x + l * 0.7, y + 6, x + l, y);
      g.stroke();
    }
  });
}

function scenery(ctx, index) {
  const th = ctx.theme;
  const r = rng(index * 7919 + 13);
  const L = ctx.length;
  // Água: clara, brilhante e com ondinhas andando
  const wt = waterTex(th);
  wt.repeat.set(70, 90);
  const water = new THREE.Mesh(cached('water', () => new THREE.PlaneGeometry(1000, 1300).rotateX(-Math.PI / 2)), std('#ffffff', { map: wt, rough: 0.18, metal: 0.1 }));
  water.position.set(0, WATER_Y, -L / 2);
  water.receiveShadow = true;
  ctx.group.add(water);
  ctx.updaters.push((t) => { wt.offset.set(t * 0.012, t * 0.02); flagTime.value = t; });
  // Ilhas flutuantes com árvores dos dois lados (longe da pista)
  const greens = [th.grass, tint(th.grass, -0.15), tint(th.grass, 0.15)];
  const crowns = ['#4ade80', '#22c55e', tint(th.grass, -0.1), '#86efac', th.acc];
  let side = 1;
  for (let z = 40; z > -L - 70; z -= 14 + r() * 12) {
    side = r() < 0.75 ? -side : side;
    const x = side * (22 + r() * 46);
    const y = -8 + r() * 12;
    const s = 3 + r() * 5;
    ctx.inst(G.island(), std(th.rock, { rough: 0.85 }), x, y, z, s, s * (0.8 + r() * 0.5), s, 0, r() * 6);
    ctx.inst(G.grass(), std('#ffffff', { rough: 0.7 }), x, y, z, s, s * 0.8, s, 0, 0, 0, greens[Math.floor(r() * 3)]);
    const trees = 1 + Math.floor(r() * 3);
    for (let k = 0; k < trees; k++) {
      const a = r() * Math.PI * 2;
      const d = r() * s * 0.55;
      const tx = x + Math.cos(a) * d;
      const tz = z + Math.sin(a) * d;
      const ts = 0.8 + r() * 0.9;
      const ty = y + s * 0.22;
      ctx.inst(G.cylLo(), std('#a16207', { rough: 0.8 }), tx, ty + ts * 0.9, tz, 0.22 * ts, 1.8 * ts, 0.22 * ts);
      if (r() < 0.5) ctx.inst(G.sphLo(), std('#ffffff', { rough: 0.6 }), tx, ty + ts * 2.4, tz, ts * 1.2, ts * 1.1, ts * 1.2, 0, 0, 0, crowns[Math.floor(r() * crowns.length)]);
      else ctx.inst(G.cone(), std('#ffffff', { rough: 0.6 }), tx, ty + ts * 2.6, tz, ts * 1.1, ts * 2.6, ts * 1.1, 0, 0, 0, crowns[Math.floor(r() * 3)]);
    }
  }
  // Nuvens fofas (bolas brancas juntas)
  const cloud = std('#ffffff', { rough: 0.95, em: '#ffffff', emI: 0.35 });
  for (let z = 60; z > -L - 120; z -= 22 + r() * 18) {
    const x = (r() < 0.5 ? -1 : 1) * (30 + r() * 80);
    const y = 14 + r() * 26;
    const s = 3 + r() * 4;
    const puffs = 4 + Math.floor(r() * 3);
    for (let k = 0; k < puffs; k++) {
      const ps = s * (0.55 + r() * 0.5) * (k === 0 ? 1.3 : 1);
      ctx.inst(G.sphLo(), cloud, x + (k - puffs / 2) * s * 0.7, y + r() * s * 0.4, z + (r() - 0.5) * s, ps, ps * 0.8, ps);
    }
  }
  // Balões soltos perto da pista
  const balloon = std('#ffffff', { rough: 0.2 });
  const bcol = [th.acc, th.obs, th.alt, '#fde047', '#ffffff'];
  for (let z = -10; z > -L; z -= 16 + r() * 14) {
    const x = (r() < 0.5 ? -1 : 1) * (11 + r() * 8);
    const y = 3 + r() * 7;
    ctx.inst(G.sphLo(), balloon, x, y, z, 0.6, 0.72, 0.6, 0, 0, 0, bcol[Math.floor(r() * bcol.length)]);
    ctx.inst(G.cylLo(), std('#e5e7eb'), x, y - 1.6, z, 0.015, 2.2, 0.015);
  }
}

/** Monta a fase na cena e devolve as peças com colisão. */
export function buildStage(scene, index, seed) {
  const st = STAGES[index % STAGES.length];
  const theme = THEMES[index % THEMES.length];
  const ctx = makeCtx(scene, theme, rng(seed));
  ctx.z = 0;
  ctx.z -= SEG.start(ctx);
  for (const [type, opts] of st.segs) {
    const len = SEG[type](ctx, opts);
    ctx.z -= len;
  }
  ctx.length = -ctx.z;
  scenery(ctx, index);
  ctx.flush();
  scene.background = skyTex(theme);
  // Névoa leve: dá profundidade (o fim da pista some suave no horizonte)
  scene.fog = new THREE.Fog(theme.skyBot, 60, 230);
  const owned = ctx.owned;
  return { ...ctx, name: st.name, theme, dispose: () => owned.forEach((o) => o.dispose()) };
}
