// Personagens dos jogos, feitos do zero sobre um esqueleto com animações de verdade (captura de
// movimento do "Universal Animation Library", de Quaternius, CC0): correr, pular, rolar, escorregar,
// tomar batida, ser levantado, comemorar... O corpo é gerado aqui, liso e com "pele" que dobra nas
// juntas (SkinnedMesh), em dois estilos:
//  - 'surf': adolescente estilo "runner" (cabeção, roupa larga, tênis enormes);
//  - 'stumble': feijãozinho estilo "Stumble Guys" (corpo e cabeça num só, perninhas e bracinhos curtos).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ───────────── Esqueleto e animações ─────────────
let RIG = null;
let rigPromise = null;
/** Carrega o esqueleto com as animações (uma vez só). */
export function loadRig() {
  if (!rigPromise) {
    rigPromise = new GLTFLoader().loadAsync('/models/dbv-rig.glb?v=1').then((g) => {
      RIG = { scene: g.scene, clips: new Map(g.animations.map((a) => [a.name, a])) };
      return RIG;
    });
    rigPromise.catch(() => { rigPromise = null; });
  }
  return rigPromise;
}
export const rigLoaded = () => !!RIG;

// ───────────── Materiais ─────────────
/** Degraus de luz (usado pelo skate). */
export const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([80, 150, 210, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const mats = new Map();
/** Material liso de boneco (o nome ficou de quando era desenho). */
export function toon(color, extra) {
  const k = color + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...(extra || {}) }));
  return mats.get(k);
}
const skinMat = (c) => toon(c, { roughness: 0.62 });
const cloth = (c) => toon(c, { roughness: 0.8 });
const gloss = (c) => toon(c, { roughness: 0.25 });

/** Luz de estúdio (reflexos suaves). Use com scene.environmentIntensity ~0.5. */
const envs = new WeakMap();
export function studioEnv(renderer) {
  if (!envs.has(renderer)) {
    const pm = new THREE.PMREMGenerator(renderer);
    envs.set(renderer, pm.fromScene(new RoomEnvironment(), 0.04).texture);
    pm.dispose();
    renderer.toneMapping = THREE.NeutralToneMapping;
  }
  return envs.get(renderer);
}

function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }
function mix(a, b, k) { const c = new THREE.Color(a).lerp(new THREE.Color(b), k); return `#${c.getHexString()}`; }

// ───────────── Malha com "pele" (pesos nos ossos) ─────────────
class MeshBuild {
  constructor() { this.p = []; this.n = []; this.uv = []; this.si = []; this.sw = []; this.ix = []; }
  get count() { return this.p.length / 3; }
  vert(pos, nor, u, v, ws) {
    this.p.push(pos.x, pos.y, pos.z); this.n.push(nor.x, nor.y, nor.z); this.uv.push(u, v);
    const w = ws.filter((x) => x[1] > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = w.reduce((a, x) => a + x[1], 0) || 1;
    for (let i = 0; i < 4; i++) { this.si.push(w[i] ? w[i][0] : 0); this.sw.push(w[i] ? w[i][1] / tot : 0); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.ix);
    return g;
  }
}

/**
 * Tubo liso passando pelas juntas (braço, perna, tronco...). Cada trecho segue o osso da junta
 * de onde ele sai; perto das juntas o peso se divide entre os dois ossos (a dobra fica lisa).
 * pts: posições das juntas; rad: [lado, frente] em cada junta; bn: osso de cada junta.
 * o: { s0, s1 (pedaço do tubo, 0..1), capStart, capEnd, front, blend, startBone, segs, steps }
 */
function tube(mb, pts, rad, bn, o = {}) {
  const { s0 = 0, s1 = 1, capStart = false, capEnd = false, front = V(0, 0, 1), blend = 0.35, startBone = null, segs = 22, steps = 7, grow = 0 } = o;
  const n = pts.length;
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = L[n - 1];
  const count = Math.max(2, Math.round(steps * (n - 1) * (s1 - s0)) + 1);
  const rings = [];
  for (let k = 0; k < count; k++) {
    const s = s0 + ((s1 - s0) * k) / (count - 1);
    const d = s * total;
    let i = 0;
    while (i < n - 2 && d > L[i + 1]) i++;
    const t = Math.min(1, Math.max(0, (d - L[i]) / (L[i + 1] - L[i] || 1)));
    const e = t * t * (3 - 2 * t);
    const c = pts[i].clone().lerp(pts[i + 1], t);
    const r = [rad[i][0] + (rad[i + 1][0] - rad[i][0]) * e + grow, rad[i][1] + (rad[i + 1][1] - rad[i][1]) * e + grow];
    const ws = [[bn[i], 1]];
    const prev = i > 0 ? bn[i - 1] : startBone;
    if (t < blend && prev != null && prev !== bn[i]) ws.push([prev, 0.5 * (1 - t / blend)]);
    if (t > 1 - blend && i + 1 < n && bn[i + 1] !== bn[i]) ws.push([bn[i + 1], 0.5 * ((t - (1 - blend)) / blend)]);
    ws[0][1] = 1 - ws.slice(1).reduce((a, x) => a + x[1], 0);
    rings.push({ c, r, ws, v: (s - s0) / (s1 - s0 || 1) });
  }
  // Direção do tubo em cada anel
  rings.forEach((rg, k) => {
    const a = rings[Math.max(0, k - 1)].c;
    const b = rings[Math.min(rings.length - 1, k + 1)].c;
    rg.T = b.clone().sub(a).normalize();
    if (!Number.isFinite(rg.T.x) || rg.T.lengthSq() < 0.5) rg.T = pts[1].clone().sub(pts[0]).normalize();
    let f = front.clone().sub(rg.T.clone().multiplyScalar(front.dot(rg.T)));
    if (f.lengthSq() < 1e-4) f = V(0, 1, 0).sub(rg.T.clone().multiplyScalar(rg.T.y));
    rg.f = f.normalize();
    rg.sd = rg.T.clone().cross(rg.f).normalize();
  });
  const ring = (c, r, f, sd, ws, v, scale = 1, along = null, alongK = 0) => {
    const start = mb.count;
    for (let j = 0; j <= segs; j++) {
      const u = j / segs;
      const a = u * Math.PI * 2;
      const cf = -Math.cos(a);
      const ss = Math.sin(a);
      const pos = c.clone().addScaledVector(f, cf * r[1] * scale).addScaledVector(sd, ss * r[0] * scale);
      const nor = f.clone().multiplyScalar(cf / r[1]).addScaledVector(sd, ss / r[0]).normalize();
      if (along) nor.multiplyScalar(Math.cos(alongK)).addScaledVector(along, Math.sin(alongK)).normalize();
      mb.vert(pos, nor, 1 - u, v, ws);
    }
    return start;
  };
  const join = (a, b) => { for (let j = 0; j < segs; j++) mb.ix.push(a + j, b + j, a + j + 1, b + j, b + j + 1, a + j + 1); };
  let last = null;
  if (capStart) {
    const g = rings[0];
    const rc = Math.min(g.r[0], g.r[1]);
    for (let q = 6; q >= 1; q--) {
      const phi = (q / 6) * (Math.PI / 2);
      const back = g.T.clone().negate();
      const st = ring(g.c.clone().addScaledVector(back, Math.sin(phi) * rc), g.r, g.f, g.sd, g.ws, 0, Math.max(0.001, Math.cos(phi)), back, phi);
      if (last != null) join(last, st);
      last = st;
    }
  }
  for (const g of rings) {
    const st = ring(g.c, g.r, g.f, g.sd, g.ws, g.v);
    if (last != null) join(last, st);
    last = st;
  }
  if (capEnd) {
    const g = rings[rings.length - 1];
    const rc = Math.min(g.r[0], g.r[1]);
    for (let q = 1; q <= 6; q++) {
      const phi = (q / 6) * (Math.PI / 2);
      const st = ring(g.c.clone().addScaledVector(g.T, Math.sin(phi) * rc), g.r, g.f, g.sd, g.ws, 1, Math.max(0.001, Math.cos(phi)), g.T, phi);
      join(last, st);
      last = st;
    }
  }
}

/** Saia rodada que balança com as pernas (pesos no quadril e nas coxas). */
function skirt(mb, top, len, r0, r1, bones) {
  const segs = 30;
  const steps = 7;
  let last = null;
  for (let k = 0; k <= steps; k++) {
    const d = k / steps;
    const y = top.y - len * d;
    const r = r0 + (r1 - r0) * Math.pow(d, 0.8);
    const start = mb.count;
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const x = Math.sin(a);
      const z = -Math.cos(a) * 0.86;
      const pos = V(top.x + x * r, y, top.z + z * r);
      const nor = V(x, 0.25, z).normalize();
      const side = x > 0 ? bones.thighL : bones.thighR;
      const k2 = Math.min(1, Math.abs(x) * 1.6) * d * 0.7;
      mb.vert(pos, nor, j / segs, 1 - d, [[bones.pelvis, 1 - k2], [side, k2]]);
    }
    if (last != null) for (let j = 0; j < segs; j++) mb.ix.push(last + j, start + j, last + j + 1, start + j, start + j + 1, last + j + 1);
    last = start;
  }
}

// ───────────── Estampas (texturas desenhadas) ─────────────
const texCache = new Map();
function drawShirt(g, s, W, H) {
  const t = s.top;
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, mix(t.color, '#ffffff', 0.08)); base.addColorStop(1, shade(t.color, 0.9));
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const k = H / 256;
  const mid = W / 2;
  const line = (x, w, col) => { g.fillStyle = col; g.fillRect(x - w / 2, 0, w, H); };
  if (t.type === 'xadrez') {
    for (let x = 0; x < W; x += 40) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 14, H); }
    for (let y = 0; y < H; y += 40) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, W, 14); }
  }
  if (t.stripe) for (let y = 30 * k; y < H; y += 60 * k) { g.fillStyle = t.color2; g.fillRect(0, y, W, 16 * k); }
  if (t.type === 'jaqueta' || t.type === 'moletom') { line(mid, 10, t.color2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(mid - 1, 0, 2, H); }
  if (t.type === 'jaqueta') { line(mid, 34, shade(t.color, 0.82)); line(mid, 6, t.color2); }
  if (t.type === 'camisa-aberta') { line(mid, 90, t.color2); line(mid - 46, 6, shade(t.color, 0.7)); line(mid + 46, 6, shade(t.color, 0.7)); }
  if (t.type === 'colete') { line(mid, 80, t.color2); }
  if (t.type === 'terno') { line(mid, 70, t.color2); g.fillStyle = '#b91c1c'; g.beginPath(); g.moveTo(mid - 10, 10); g.lineTo(mid + 10, 10); g.lineTo(mid + 8, H * 0.66); g.lineTo(mid, H * 0.74); g.lineTo(mid - 8, H * 0.66); g.fill(); }
  if (t.type === 'jaleco') { line(mid, 6, shade(t.color, 0.8)); for (let y = 40 * k; y < H; y += 50 * k) { g.fillStyle = t.color2; g.beginPath(); g.arc(mid + 14, y, 6, 0, 7); g.fill(); } }
  if (t.type === 'polo') for (let y = 30 * k; y < 110 * k; y += 30 * k) { g.fillStyle = t.color2; g.beginPath(); g.arc(mid, y, 5, 0, 7); g.fill(); }
  if (t.type === 'uniforme') {
    for (const dx of [-70, 70]) { g.fillStyle = shade(t.color, 0.82); g.fillRect(mid + dx - 26, 40 * k, 52, 44 * k); g.fillStyle = shade(t.color, 0.7); g.fillRect(mid + dx - 26, 40 * k, 52, 8 * k); }
    for (let y = 30 * k; y < H; y += 46 * k) { g.fillStyle = '#5c3d1e'; g.beginPath(); g.arc(mid, y, 5, 0, 7); g.fill(); }
    g.fillStyle = '#dc2626'; g.beginPath(); g.arc(mid + 120, 70 * k, 14, 0, 7); g.fill();
  }
  if (t.number) {
    g.font = `bold ${Math.round(110 * k)}px "Arial Black", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = shade(t.color, 0.6); g.strokeText(t.number, mid, H * 0.55);
    g.fillStyle = t.color2; g.fillText(t.number, mid, H * 0.55);
  }
  if (t.logo) {
    g.fillStyle = t.color2; g.beginPath(); g.moveTo(mid - 44, 40 * k); g.lineTo(mid + 44, 40 * k); g.lineTo(mid, 130 * k); g.closePath(); g.fill();
    g.fillStyle = t.color; g.beginPath(); g.moveTo(mid - 24, 54 * k); g.lineTo(mid + 24, 54 * k); g.lineTo(mid, 102 * k); g.closePath(); g.fill();
  }
  if (t.flower) for (let q = 0; q < 14; q++) {
    const x = (q * 97) % W; const y = (30 + ((q * 61) % 200)) * k;
    g.fillStyle = t.color2; for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + Math.cos(p * 1.26) * 10, y + Math.sin(p * 1.26) * 10, 7, 0, 7); g.fill(); }
    g.fillStyle = '#facc15'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
  }
  if (t.paint) for (let q = 0; q < 10; q++) { g.fillStyle = ['#ec4899', '#22d3ee', '#facc15', '#a3e635'][q % 4]; g.beginPath(); g.arc((q * 131) % W, (40 + (q * 53) % 180) * k, 10 + (q % 3) * 8, 0, 7); g.fill(); }
}
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}
/** Camisa do adolescente (barra mais escura embaixo e gola em cima). */
const shirtTex = (s) => canvasTex('shirt:' + s.id, 512, 256, (g, W, H) => {
  drawShirt(g, s, W, H);
  g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, H - 14, W, 14);
});
/** Feijãozinho: calça/saia embaixo, camisa no meio e pele em cima (a cabeça). */
function beanTex(s, vWaist, vNeck) {
  return canvasTex(`bean:${s.id}:${vWaist.toFixed(2)}:${vNeck.toFixed(2)}`, 512, 512, (g, W, H) => {
    const y = (v) => (1 - v) * H;
    const bottom = s.bottom.type === 'vestido' ? s.top.color : s.bottom.color;
    g.fillStyle = s.skin; g.fillRect(0, 0, W, H);
    // camisa
    g.save();
    g.translate(0, y(vNeck));
    drawShirt(g, s, W, y(vWaist) - y(vNeck));
    g.restore();
    // gola
    g.fillStyle = shade(s.top.color, 0.8);
    g.fillRect(0, y(vNeck) - 8, W, 12);
    // calça / saia
    g.fillStyle = bottom; g.fillRect(0, y(vWaist), W, H - y(vWaist));
    if (s.bottom.type !== 'vestido') { g.fillStyle = shade(bottom, 0.75); g.fillRect(0, y(vWaist), W, 10); }
    if (['jaqueta', 'moletom', 'jaleco', 'camisa-aberta'].includes(s.top.type) && s.bottom.type === 'calca') { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(W / 2 - 1, y(vWaist), 2, H); }
  });
}

/**
 * Proporções (em metros do esqueleto, antes da escala):
 *  surf: escala 1 (≈1,85 m com o cabeção); stumble: escala 0,62 e feijão grande.
 */
const STYLE = {
  surf: { scale: 1.0, headR: 0.19, eye: 0.21, shoe: 1.3, hand: 1.05 },
  stumble: { scale: 0.62, headR: 0.3, eye: 0.25, shoe: 1.65, hand: 1.45 },
};
const SLEEVE = { camiseta: 'curta', polo: 'curta', uniforme: 'curta', 'camisa-aberta': 'curta', vestido: 'curta', regata: 'sem', manga: 'longa', moletom: 'longa', jaqueta: 'longa', jaleco: 'longa', terno: 'longa', xadrez: 'longa', colete: 'longa' };

/** Monta o personagem (o esqueleto precisa estar carregado: loadRig()). Fica de frente para -z. */
export function buildAvatar(s, style = 'surf') {
  if (!RIG) throw new Error('Esqueleto dos personagens ainda não carregou');
  const S = STYLE[style];
  const stumble = style === 'stumble';
  const rig = cloneRig(RIG.scene);
  const bones = [];
  const idx = {};
  rig.traverse((o) => { if (o !== rig && o.name && o.name !== 'Rig' && o.name !== 'AuxScene') { idx[o.name] = bones.length; bones.push(o); } });
  rig.updateMatrixWorld(true);
  const P = (n) => bones[idx[n]].getWorldPosition(V());
  const B = idx;
  const skin = skinMat(s.skin);
  const bottomColor = s.bottom.type === 'vestido' ? s.top.color : s.bottom.color;
  const pants = cloth(bottomColor);
  const sleeve = SLEEVE[s.top.type] || 'curta';
  const sleeveCol = s.top.type === 'colete' ? s.top.color2 : s.top.color;
  const builds = new Map(); // material -> MeshBuild
  const mb = (mat) => { if (!builds.has(mat)) builds.set(mat, new MeshBuild()); return builds.get(mat); };

  // Peças rígidas presas num osso (cabeça, mãos, tênis, acessórios), alinhadas com o corpo parado
  const attach = (boneName, pos) => {
    const b = bones[idx[boneName]];
    const g = new THREE.Group();
    const m = new THREE.Matrix4().copy(b.matrixWorld).invert().multiply(new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z));
    m.decompose(g.position, g.quaternion, g.scale);
    b.add(g);
    g.userData.rigid = true;
    return g;
  };

  const legs = (side) => {
    const sfx = side > 0 ? '_l' : '_r';
    const pts = [P('thigh' + sfx), P('calf' + sfx), P('foot' + sfx)];
    const bn = [B['thigh' + sfx], B['calf' + sfx], B['foot' + sfx]];
    return { pts, bn };
  };
  const arms = (side) => {
    const sfx = side > 0 ? '_l' : '_r';
    const sh = P('upperarm' + sfx);
    const inner = sh.clone().add(V(-side * 0.05, 0, 0));
    return { pts: [inner, sh, P('lowerarm' + sfx), P('hand' + sfx)], bn: [B['upperarm' + sfx], B['upperarm' + sfx], B['lowerarm' + sfx], B['hand' + sfx]] };
  };

  if (!stumble) {
    // ── Adolescente
    const longPants = s.bottom.type === 'calca';
    const shorts = s.bottom.type === 'bermuda';
    for (const side of [1, -1]) {
      const { pts, bn } = legs(side);
      const R = [[0.088, 0.09], [0.07, 0.072], [0.056, 0.06]];
      const Rp = R.map(([a, b]) => [a + 0.018, b + 0.018]); // calça larga
      if (longPants) tube(mb(pants), pts, Rp, bn, { capStart: true, capEnd: false, startBone: B.pelvis });
      else {
        tube(mb(skin), pts, R, bn, { s0: 0.25, s1: 1, capEnd: false });
        if (shorts) tube(mb(pants), pts, Rp.map(([a, b]) => [a + 0.006, b + 0.006]), bn, { s0: 0, s1: 0.48, capStart: true, startBone: B.pelvis });
        tube(mb(cloth('#f8fafc')), pts, R.map(([a, b]) => [a + 0.006, b + 0.006]), bn, { s0: 0.82, s1: 1 }); // meia
      }
      if (longPants) tube(mb(cloth(shade(bottomColor, 0.82))), pts, Rp.map(([a, b]) => [a + 0.006, b + 0.006]), bn, { s0: 0.9, s1: 1 }); // barra
    }
    // Quadril (calça) e tronco (camisa)
    const pel = P('pelvis');
    tube(mb(pants), [P('spine_01'), pel, pel.clone().add(V(0, -0.1, 0.01))], [[0.15, 0.112], [0.162, 0.12], [0.155, 0.112]], [B.spine_01, B.pelvis, B.pelvis], { capEnd: true, front: V(0, 0, 1) });
    if (['saia', 'saia-longa', 'vestido'].includes(s.bottom.type)) {
      const len = s.bottom.type === 'saia-longa' ? 0.62 : 0.45;
      skirt(mb(new THREE.MeshStandardMaterial({ color: bottomColor, roughness: 0.78, side: THREE.DoubleSide })), pel.clone().add(V(0, 0.06, 0)), len, 0.165, 0.27, { pelvis: B.pelvis, thighL: B.thigh_l, thighR: B.thigh_r });
    }
    const torsoPts = [pel.clone().add(V(0, -0.02, 0)), P('spine_01'), P('spine_02'), P('spine_03'), P('neck_01').add(V(0, -0.02, 0))];
    const torsoR = [[0.158, 0.117], [0.152, 0.11], [0.165, 0.115], [0.19, 0.125], [0.11, 0.09]];
    const shirt = new THREE.MeshStandardMaterial({ map: shirtTex(s), roughness: 0.8 });
    tube(mb(shirt), torsoPts, torsoR, [B.pelvis, B.spine_01, B.spine_02, B.spine_03, B.neck_01], { capEnd: true, front: V(0, 0, 1), segs: 28 });
    // Pescoço
    tube(mb(skin), [P('spine_03').add(V(0, 0.08, 0)), P('neck_01'), P('Head')], [[0.06, 0.06], [0.058, 0.058], [0.055, 0.055]], [B.spine_03, B.neck_01, B.Head], {});
    // Braços: manga (curta ou comprida) e pele
    for (const side of [1, -1]) {
      const { pts, bn } = arms(side);
      const R = [[0.062, 0.062], [0.062, 0.062], [0.05, 0.052], [0.042, 0.044]];
      const Rs = R.map(([a, b]) => [a + 0.014, b + 0.014]);
      if (sleeve === 'longa') {
        tube(mb(cloth(sleeveCol)), pts, Rs, bn, { capStart: true, startBone: B.spine_03 });
        tube(mb(cloth(shade(sleeveCol, 0.82))), pts, Rs.map(([a, b]) => [a + 0.004, b + 0.004]), bn, { s0: 0.9, s1: 1 });
      } else {
        tube(mb(skin), pts, R, bn, { capStart: true, startBone: B.spine_03 });
        if (sleeve === 'curta') tube(mb(cloth(sleeveCol)), pts, Rs.map(([a, b]) => [a + 0.006, b + 0.006]), bn, { s0: 0, s1: 0.42, capStart: true, startBone: B.spine_03 });
      }
    }
  } else {
    // ── Feijãozinho (corpo e cabeça num só)
    for (const side of [1, -1]) {
      const { pts, bn } = legs(side);
      const R = [[0.11, 0.11], [0.1, 0.1], [0.09, 0.092]];
      const shorts = s.bottom.type === 'bermuda';
      tube(mb(shorts ? skin : pants), pts, R, bn, { s0: 0.3, s1: 1 });
      if (shorts) tube(mb(pants), pts, R.map(([a, b]) => [a + 0.01, b + 0.01]), bn, { s0: 0.3, s1: 0.55 });
    }
    const pel = P('pelvis');
    const head = P('Head');
    const beanPts = [pel.clone().add(V(0, -0.24, 0.0)), pel, P('spine_01'), P('spine_02'), P('spine_03'), P('neck_01'), head, head.clone().add(V(0, 0.2, 0.005))];
    const beanR = [[0.27, 0.25], [0.335, 0.3], [0.35, 0.31], [0.355, 0.315], [0.35, 0.31], [0.335, 0.3], [0.315, 0.29], [0.25, 0.235]];
    const beanB = [B.pelvis, B.pelvis, B.spine_01, B.spine_02, B.spine_03, B.neck_01, B.Head, B.Head];
    // altura (0..1 ao longo do feijão) da cintura e do pescoço, para pintar a roupa
    const Ls = [0];
    for (let i = 1; i < beanPts.length; i++) Ls.push(Ls[i - 1] + beanPts[i].distanceTo(beanPts[i - 1]));
    const Lt = Ls[Ls.length - 1];
    const vWaist = (Ls[1] + 0.06) / Lt;
    const vNeck = (Ls[4] + (Ls[5] - Ls[4]) * 0.55) / Lt;
    const beanMat = new THREE.MeshStandardMaterial({ map: beanTex(s, vWaist, vNeck), roughness: 0.6 });
    tube(mb(beanMat), beanPts, beanR, beanB, { capStart: true, capEnd: true, segs: 32, steps: 6 });
    if (['saia', 'saia-longa', 'vestido'].includes(s.bottom.type)) {
      // babado da saia
      tube(mb(cloth(bottomColor)), [beanPts[0].clone().add(V(0, 0.07, 0)), beanPts[0].clone().add(V(0, -0.02, 0))], [[0.31, 0.29], [0.34, 0.32]], [B.pelvis, B.pelvis], { segs: 32 });
    }
    for (const side of [1, -1]) {
      const { pts, bn } = arms(side);
      const R = [[0.085, 0.085], [0.085, 0.085], [0.078, 0.078], [0.07, 0.07]];
      if (sleeve === 'longa') tube(mb(cloth(sleeveCol)), pts, R, bn, { s0: 0.15, s1: 1 });
      else {
        tube(mb(skin), pts, R, bn, { s0: 0.15, s1: 1 });
        if (sleeve === 'curta') tube(mb(cloth(sleeveCol)), pts, R.map(([a, b]) => [a + 0.012, b + 0.012]), bn, { s0: 0.15, s1: 0.5 });
      }
    }
  }

  // Malhas com pele (todas usam o mesmo esqueleto)
  const meshes = [];
  for (const [mat, b] of builds) {
    const m = new THREE.SkinnedMesh(b.geometry(), mat);
    m.castShadow = true;
    m.frustumCulled = false;
    rig.add(m);
    meshes.push(m);
  }
  rig.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const m of meshes) m.bind(skeleton, m.matrixWorld);

  // ── Peças rígidas: mãos, tênis, cabeça, rosto, cabelo, chapéu e acessórios
  for (const side of [1, -1]) {
    const sfx = side > 0 ? '_l' : '_r';
    const hp = P('hand' + sfx);
    const k = S.hand;
    const g = attach('hand' + sfx, hp.clone().add(V(side * 0.055 * k, 0, 0)));
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.058 * k, 18, 14), skin);
    h.scale.set(1.15, 0.9, 1.0);
    h.castShadow = true;
    g.add(h);
    const th = new THREE.Mesh(new THREE.SphereGeometry(0.024 * k, 10, 8), skin);
    th.position.set(-side * 0.01 * k, 0.025 * k, 0.045 * k);
    g.add(th);
    const fp = P('foot' + sfx);
    const shoe = attach('foot' + sfx, V(fp.x, 0, fp.z));
    shoe.add(sneaker(s, S.shoe));
  }
  const headC = stumble ? P('Head').add(V(0, 0.12, 0.0)) : P('Head').add(V(0, 0.15, 0.02));
  const headG = attach('Head', headC);
  const face = new THREE.Group(); // o rosto foi desenhado olhando para -z: gira para +z (frente do esqueleto)
  face.rotation.y = Math.PI;
  headG.add(face);
  buildHead(face, s, S.headR, S.eye, stumble);
  // Acessórios no corpo
  const acc = s.acc?.type;
  const chest = P('spine_03');
  if (acc === 'mochila') {
    const g = attach('spine_02', P('spine_02').add(V(0, 0.02, stumble ? -0.33 : -0.15)));
    const k = stumble ? 1.5 : 1;
    const bag = new THREE.Mesh(new RoundedBoxGeometry(0.26 * k, 0.32 * k, 0.13 * k, 4, 0.05 * k), cloth(s.acc.color));
    bag.castShadow = true;
    g.add(bag);
    const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.18 * k, 0.12 * k, 0.05 * k, 3, 0.02 * k), cloth(shade(s.acc.color, 0.82)));
    pocket.position.set(0, -0.07 * k, -0.08 * k);
    g.add(pocket);
  }
  if (acc === 'lenco' || acc === 'cachecol') {
    const k = stumble ? 1.75 : 1;
    const g = attach('spine_03', V(chest.x, stumble ? P('neck_01').y - 0.05 : chest.y + 0.12, chest.z));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1 * k, 0.03 * k, 10, 28), cloth(s.acc.color));
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1, 0.85, 1);
    g.add(ring);
    if (acc === 'lenco') {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.12 * k, 0.2 * k, 3), cloth(s.acc.color));
      tri.rotation.x = Math.PI; tri.scale.z = 0.25;
      tri.position.set(0, -0.08 * k, -0.1 * k);
      g.add(tri);
      const woggle = new THREE.Mesh(new THREE.TorusGeometry(0.02 * k, 0.009 * k, 8, 14), gloss('#7c4a1e'));
      woggle.position.set(0, -0.04 * k, 0.1 * k);
      g.add(woggle);
      for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.015 * k, 0.07 * k, 4, 8), cloth(s.acc.color)); e.position.set(sd * 0.02 * k, -0.1 * k, 0.1 * k); e.rotation.z = 0.25 * sd; g.add(e); }
    } else {
      const end = new THREE.Mesh(new RoundedBoxGeometry(0.06 * k, 0.2 * k, 0.03 * k, 2, 0.01), cloth(s.acc.color));
      end.position.set(0.05 * k, -0.1 * k, 0.1 * k);
      g.add(end);
    }
  }

  // Junta as peças pequenas de cada grupo rígido por material (bem menos desenhos por quadro no celular)
  const rigids = [];
  rig.traverse((o) => { if (o.userData.rigid) rigids.push(o); });
  rigids.forEach(mergeRigid);

  // Raiz: vira de frente para -z (como o resto do jogo)
  const root = new THREE.Group();
  rig.rotation.y = Math.PI;
  rig.scale.setScalar(S.scale);
  root.add(rig);
  const mixer = new THREE.AnimationMixer(rig);
  root.userData = { style, rig, mixer, actions: new Map(), state: null, clip: null, current: null, lastT: null };
  return root;
}

/** Junta as malhas de um grupo (já posicionadas) numa malha por material. */
function mergeRigid(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map();
  const kill = [];
  group.traverse((o) => {
    if (!o.isMesh || o === group) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (m.determinant() < 0) { const pos = g.attributes.position; for (let i = 0; i < pos.count; i += 3) { for (const a of Object.values(g.attributes)) { const t = a.array.slice(i * a.itemSize, (i + 1) * a.itemSize); a.array.copyWithin(i * a.itemSize, (i + 2) * a.itemSize, (i + 3) * a.itemSize); a.array.set(t, (i + 2) * a.itemSize); } } }
    const key = o.material.uuid;
    if (!byMat.has(key)) byMat.set(key, { mat: o.material, geos: [], shadow: false });
    const e = byMat.get(key);
    e.geos.push(g);
    e.shadow = e.shadow || o.castShadow;
    kill.push(o);
  });
  for (const o of kill) o.parent.remove(o);
  for (const { mat, geos, shadow } of byMat.values()) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = shadow;
    group.add(mesh);
  }
}

/** Tênis grande (solado branco grosso, corpo arredondado, biqueira e gola coloridas). */
function sneaker(s, k) {
  const g = new THREE.Group();
  const L = 0.27 * k;
  const W = 0.13 * k;
  const soleH = 0.05 * k;
  const zc = 0.04; // centro do pé (para a frente)
  const dark = new THREE.Color(s.shoes).getHSL({}).l < 0.25;
  const sole = new THREE.Mesh(new RoundedBoxGeometry(W * 0.94, soleH, L * 0.94, 4, soleH * 0.48), gloss(dark ? '#e5e7eb' : '#ffffff'));
  sole.position.set(0, soleH / 2, zc);
  const band = new THREE.Mesh(new RoundedBoxGeometry(W * 0.95, soleH * 0.24, L * 0.945, 2, soleH * 0.1), toon(s.shoes2));
  band.position.set(0, soleH * 0.68, zc);
  // corpo do tênis: mais largo que o solado em cima (fica "fofinho", como tênis de desenho)
  const upper = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), toon(s.shoes, { roughness: 0.45 }));
  upper.scale.set(W * 0.52, 0.11 * k, L * 0.5);
  upper.position.set(0, soleH * 0.75, zc);
  const toe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), toon(s.shoes2, { roughness: 0.4 }));
  toe.scale.set(W * 0.47, 0.06 * k, L * 0.22);
  toe.position.set(0, soleH * 0.8, zc + L * 0.29);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.045 * k, 0.014 * k, 10, 22), toon(s.shoes2));
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, soleH + 0.07 * k, zc - L * 0.12);
  const lace = new THREE.Mesh(new RoundedBoxGeometry(W * 0.36, 0.012 * k, L * 0.28, 2, 0.005 * k), toon('#f8fafc'));
  lace.position.set(0, soleH + 0.062 * k, zc + L * 0.08);
  lace.rotation.x = 0.4;
  for (const m of [sole, upper, toe]) m.castShadow = true;
  g.add(sole, band, upper, toe, collar, lace);
  return g;
}

/** Cabeça (no feijãozinho, só o rosto, o cabelo e o chapéu: a cabeça é o próprio corpo). Desenhada olhando para -z. */
function buildHead(head, s, r, eyeK, bean) {
  const skin = skinMat(s.skin);
  const part = (geo, mat, o = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(o.x || 0, o.y || 0, o.z || 0);
    m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1);
    m.castShadow = o.shadow !== false;
    head.add(m);
    return m;
  };
  if (!bean) {
    part(new THREE.SphereGeometry(r, 32, 24), skin, { sy: 1.04, sz: 0.97 });
    for (const sd of [-1, 1]) part(new THREE.SphereGeometry(r * 0.2, 14, 10), skin, { x: sd * r * 0.98, y: -r * 0.05, sx: 0.55 });
  }
  // Olhos grandes: branco, íris, pupila, dois brilhos e a linha dos cílios
  const ey = bean ? -r * 0.02 : r * 0.04;
  const ex = bean ? r * 0.33 : r * 0.36;
  const er = r * eyeK;
  const ez = bean ? -r * 0.86 : -r * 0.84;
  const iris = new THREE.Color(s.eyes || '#3b2a1a');
  if (bean) iris.lerp(new THREE.Color('#0f0a07'), 0.4);
  const hiM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const sd of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sd * ex, ey, ez);
    eye.rotation.y = sd * -0.3;
    head.add(eye);
    const add = (geo, mat, o) => { const m = new THREE.Mesh(geo, mat); m.position.set(o.x || 0, o.y || 0, o.z || 0); m.scale.set(o.sx || 1, o.sy || 1, o.sz || 1); eye.add(m); return m; };
    add(new THREE.SphereGeometry(er, 20, 16), gloss('#ffffff'), { sx: 0.8, sy: bean ? 1.12 : 1, sz: 0.5 });
    add(new THREE.SphereGeometry(er * (bean ? 0.72 : 0.64), 18, 14), gloss(`#${iris.getHexString()}`), { y: -er * 0.06, z: -er * 0.32, sy: 1.1, sz: 0.4 });
    add(new THREE.SphereGeometry(er * 0.32, 12, 10), gloss('#0b0b0f'), { y: -er * 0.06, z: -er * 0.45, sy: 1.1, sz: 0.35 });
    add(new THREE.SphereGeometry(er * 0.18, 10, 8), hiM, { x: sd * -er * 0.2, y: er * 0.25, z: -er * 0.52 });
    add(new THREE.SphereGeometry(er * 0.08, 8, 6), hiM, { x: sd * er * 0.2, y: -er * 0.25, z: -er * 0.5 });
    const lid = add(new THREE.TorusGeometry(er * 0.8, er * (s.g === 'f' ? 0.12 : 0.08), 8, 16, Math.PI * 0.85), gloss('#1b1420'), { y: er * 0.06, z: -er * 0.2 });
    lid.rotation.z = Math.PI * 0.075;
    if (s.g === 'f') for (const q of [0, 1]) {
      const lash = add(new THREE.CapsuleGeometry(er * 0.05, er * 0.22, 4, 6), gloss('#1b1420'), { x: sd * er * (0.62 + q * 0.12), y: er * (0.62 - q * 0.22), z: -er * 0.2 });
      lash.rotation.z = sd * -(0.8 + q * 0.3);
    }
    const brow = part(new THREE.CapsuleGeometry(r * 0.038, r * 0.2, 4, 8), toon(shade(s.hairColor, 0.9)), { x: sd * ex, y: ey + er * 1.42, z: ez - r * 0.02, shadow: false });
    brow.rotation.z = Math.PI / 2 + sd * 0.14;
  }
  part(new THREE.SphereGeometry(r * (bean ? 0.07 : 0.085), 12, 10), skinMat(shade(s.skin, 0.93)), { y: -r * (bean ? 0.17 : 0.13), z: ez - r * 0.13, sy: 0.85, shadow: false });
  // Boca: sorrisão aberto no feijãozinho, sorriso de canto no adolescente
  if (bean) {
    const mouth = part(new THREE.SphereGeometry(r * 0.11, 18, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gloss('#5b1220'), { y: -r * 0.31, z: ez - r * 0.03, sx: 1.25, sy: 0.8, sz: 0.35, shadow: false });
    mouth.rotation.x = -0.3;
    part(new THREE.SphereGeometry(r * 0.045, 10, 8), gloss('#e85d75'), { y: -r * 0.37, z: ez - r * 0.07, sx: 1.4, sy: 0.55, sz: 0.4, shadow: false });
  } else {
    const smile = part(new THREE.TorusGeometry(r * 0.15, r * 0.03, 8, 16, Math.PI), gloss('#7f1d1d'), { y: -r * 0.3, z: -r * 0.9, shadow: false });
    smile.rotation.set(-0.3, 0.12, Math.PI);
  }
  for (const sd of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(r * 0.13, 20), new THREE.MeshBasicMaterial({ color: '#fb7185', transparent: true, opacity: 0.32, depthWrite: false }));
    cheek.position.set(sd * r * 0.55, -r * 0.2, ez + r * 0.04);
    cheek.rotation.y = Math.PI + sd * -0.6;
    head.add(cheek);
  }
  buildHair(head, s, r, part);
  buildHat(head, s, r, part);
  if (s.acc?.type === 'oculos') {
    for (const sd of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(er, er, 0.01, 22), new THREE.MeshStandardMaterial({ color: s.acc.color, roughness: 0.1, transparent: true, opacity: 0.55 }));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(sd * ex, ey, ez - r * 0.16);
      head.add(lens);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(er * 1.02, er * 0.15, 8, 22), gloss('#111827'));
      rim.position.copy(lens.position);
      head.add(rim);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(ex * 0.6, er * 0.16, er * 0.16), gloss('#111827'));
    bridge.position.set(0, ey + er * 0.2, ez - r * 0.16);
    head.add(bridge);
  }
  if (s.acc?.type === 'fone') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.07, 8, 24, Math.PI), gloss(s.acc.color));
    band.rotation.y = Math.PI / 2;
    head.add(band);
    for (const sd of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.24, r * 0.24, r * 0.16, 20), gloss(s.acc.color)); cup.rotation.z = Math.PI / 2; cup.position.set(sd * r * 1.02, -r * 0.05, 0); head.add(cup); }
  }
}

function buildHair(head, s, r, part) {
  const hm = toon(s.hairColor, { roughness: 0.62 });
  const hs = new THREE.MeshStandardMaterial({ color: s.hairColor, roughness: 0.62, side: THREE.DoubleSide });
  const shell = (rr, phiS, phiL, thS, thL) => part(new THREE.SphereGeometry(rr, 32, 20, phiS, phiL, thS, thL), hs);
  const h = s.hair;
  if (h === 'raspado') { shell(r * 1.02, 0, Math.PI * 2, 0, Math.PI * 0.42); return; }
  shell(r * 1.07, 0, Math.PI * 2, 0, Math.PI * 0.4);
  shell(r * 1.06, 0, Math.PI, Math.PI * 0.35, Math.PI * 0.32);
  const fr = (x, y, z, sx, sy, sz, rz = 0) => { const f = part(new THREE.SphereGeometry(r * 0.4, 18, 14), hm, { x, y, z, sx, sy, sz }); f.rotation.z = rz; return f; };
  if (h === 'curto' || h === 'lateral' || h === 'topete' || h === 'longo-m') fr(r * 0.15, r * 0.62, -r * 0.62, 1.5, 0.5, 0.75, -0.25);
  if (h === 'lateral') fr(-r * 0.35, r * 0.55, -r * 0.6, 1.2, 0.55, 0.7, 0.4);
  if (h === 'topete') fr(0, r * 0.95, -r * 0.45, 1.3, 0.8, 1, 0);
  if (h === 'espetado') for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const c = part(new THREE.ConeGeometry(r * 0.2, r * 0.55, 10), hm, { x: Math.cos(a) * r * 0.45, y: r * 0.9, z: Math.sin(a) * r * 0.45 + r * 0.05 });
    c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
  }
  if (h === 'cacheado') for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    part(new THREE.SphereGeometry(r * 0.24, 14, 10), hm, { x: Math.cos(a) * r * 0.82, y: r * 0.45 + (k % 2) * r * 0.2, z: Math.sin(a) * r * 0.82 + r * 0.05 });
  }
  if (h === 'black') part(new THREE.SphereGeometry(r * 1.18, 30, 22), hm, { y: r * 0.42, z: r * 0.32, sz: 0.82 });
  if (h === 'longo-m') shell(r * 1.08, 0, Math.PI, Math.PI * 0.55, Math.PI * 0.3);
  if (['longo', 'ondulado', 'chanel', 'rabo', 'coque', 'trancas', 'maria'].includes(h)) {
    fr(-r * 0.2, r * 0.6, -r * 0.64, 1.3, 0.55, 0.7, 0.3);
    fr(r * 0.3, r * 0.62, -r * 0.6, 1.0, 0.5, 0.7, -0.35);
  }
  if (h === 'longo' || h === 'ondulado') {
    const pts = [new THREE.Vector2(r * 1.02, 0), new THREE.Vector2(r * 1.05, -r * 0.6), new THREE.Vector2(r * 0.96, -r * 1.55), new THREE.Vector2(r * 0.8, -r * 1.72)];
    const back = part(new THREE.LatheGeometry(pts, 28, -Math.PI * 0.62, Math.PI * 1.24), hs);
    back.scale.z = 0.85;
    if (h === 'ondulado') for (let k = 0; k < 6; k++) part(new THREE.SphereGeometry(r * 0.22, 12, 10), hm, { x: Math.cos(k) * r * 0.75, y: -r * 1.4, z: Math.abs(Math.sin(k)) * r * 0.75 });
  }
  if (h === 'chanel') {
    const pts = [new THREE.Vector2(r * 1.06, 0), new THREE.Vector2(r * 1.1, -r * 0.5), new THREE.Vector2(r * 1.0, -r * 0.75)];
    part(new THREE.LatheGeometry(pts, 28, -Math.PI * 0.68, Math.PI * 1.36), hs);
  }
  if (h === 'rabo') {
    part(new THREE.TorusGeometry(r * 0.12, r * 0.05, 8, 16), gloss('#ec4899'), { y: r * 0.35, z: r * 0.95 });
    const tail = part(new THREE.CapsuleGeometry(r * 0.18, r * 0.7, 6, 12), hm, { y: r * 0.0, z: r * 1.15 });
    tail.rotation.x = 0.45;
  }
  if (h === 'coque') part(new THREE.SphereGeometry(r * 0.36, 18, 14), hm, { y: r * 0.8, z: r * 0.5 });
  if (h === 'trancas' || h === 'maria') {
    for (const sd of [-1, 1]) {
      if (h === 'maria') {
        part(new THREE.SphereGeometry(r * 0.28, 14, 10), hm, { x: sd * r * 0.95, y: r * 0.3, z: r * 0.2 });
        part(new THREE.CapsuleGeometry(r * 0.15, r * 0.5, 6, 10), hm, { x: sd * r * 1.1, y: -r * 0.2, z: r * 0.25 });
      } else for (let k = 0; k < 4; k++) part(new THREE.SphereGeometry(r * 0.15, 12, 10), hm, { x: sd * r * 0.8, y: -r * 0.3 - k * r * 0.25, z: r * 0.25 });
    }
  }
}

function buildHat(head, s, r, part) {
  const t = s.hat?.type;
  if (!t) return;
  const hm = toon(s.hat.color, { roughness: 0.6 });
  const hs = new THREE.MeshStandardMaterial({ color: s.hat.color, roughness: 0.6, side: THREE.DoubleSide });
  const dome = (rr, th = Math.PI * 0.5, y = r * 0.08) => part(new THREE.SphereGeometry(rr, 30, 16, 0, Math.PI * 2, 0, th), hs, { y });
  if (t === 'bone' || t === 'bone-tras') {
    dome(r * 1.12, Math.PI * 0.45);
    const brim = part(new THREE.CylinderGeometry(r * 0.7, r * 0.7, r * 0.06, 26), hm, { y: r * 0.45, z: (t === 'bone' ? -1 : 1) * r * 0.95, sz: 0.75 });
    brim.rotation.x = (t === 'bone' ? 1 : -1) * 0.15;
    part(new THREE.SphereGeometry(r * 0.09, 10, 8), toon('#ffffff'), { y: r * 1.18 });
  }
  if (t === 'gorro') {
    dome(r * 1.1, Math.PI * 0.5, r * 0.3);
    const band = part(new THREE.TorusGeometry(r * 0.98, r * 0.13, 10, 28), toon(shade(s.hat.color, 0.85)), { y: r * 0.4 });
    band.rotation.x = Math.PI / 2;
    part(new THREE.SphereGeometry(r * 0.25, 14, 10), toon('#f8fafc', { roughness: 0.9 }), { y: r * 1.42 });
  }
  if (t === 'faixa') { const b = part(new THREE.TorusGeometry(r * 1.03, r * 0.08, 8, 28), hm, { y: r * 0.45 }); b.rotation.x = Math.PI / 2 + 0.15; }
  if (t === 'chapeu') {
    part(new THREE.CylinderGeometry(r * 1.7, r * 1.7, r * 0.06, 36), hm, { y: r * 0.55 });
    part(new THREE.CylinderGeometry(r * 0.85, r * 1.0, r * 0.6, 28), hm, { y: r * 0.85 });
    part(new THREE.CylinderGeometry(r * 1.0, r * 1.01, r * 0.13, 28), toon('#7c2d12'), { y: r * 0.62 });
  }
  if (t === 'boina') part(new THREE.SphereGeometry(r * 1.05, 28, 18), hm, { x: r * 0.12, y: r * 0.72, sy: 0.38 });
  if (t === 'capacete') {
    dome(r * 1.16, Math.PI * 0.5, r * 0.3);
    const b = part(new THREE.TorusGeometry(r * 1.08, r * 0.07, 8, 28), toon(shade(s.hat.color, 0.7)), { y: r * 0.36 });
    b.rotation.x = Math.PI / 2;
  }
  if (t === 'chef') {
    part(new THREE.CylinderGeometry(r * 0.85, r * 0.9, r * 0.45, 26), hm, { y: r * 0.95 });
    part(new THREE.SphereGeometry(r * 0.95, 20, 14), hm, { y: r * 1.45, sy: 0.75 });
  }
}

// ───────────── Animações ─────────────
// estado -> animação do esqueleto. once: toca uma vez e para no fim; speed: velocidade; yaw: gira o corpo.
const ANIM = {
  surf: {
    idle: { clip: 'Idle_Loop' },
    run: { clip: 'Sprint_Loop', speed: 1.05 },
    jump: { clip: 'NinjaJump_Idle_Loop', fade: 0.12 },
    air: { clip: 'NinjaJump_Idle_Loop', fade: 0.12 },
    pogo: { clip: 'Jump_Loop' },
    roll: { clip: 'Roll', once: true, speed: 2.1, fade: 0.08 },
    stumble: { clip: 'Hit_Stomach', once: true, speed: 1.3, fade: 0.06 },
    skate: { clip: 'Sword_Idle', yaw: 1.15 },
    skatelie: { clip: 'Slide_Loop' },
    spray: { clip: 'Idle_Torch_Loop' },
    caught: { clip: 'Surprise', speed: 1.4 }, // de cabeça para baixo: braços balançando e pernas esticadas
    hold: { clip: 'Celebration', speed: 0.8 }, // o guarda levanta o personagem com os braços para cima
    crash: { clip: 'Hit_Knockback', once: true, fade: 0.05 },
    dive: { clip: 'Swim_Fwd_Loop' },
    fly: { clip: 'Swim_Fwd_Loop', speed: 0.7 },
    wave: { clip: 'Celebration' },
    win: { clip: 'Dance_Loop' },
    lose: { clip: 'Crying' },
    fall: { clip: 'LiftAir_Fall_Air_Loop' },
  },
  stumble: {
    idle: { clip: 'Idle_Loop' },
    run: { clip: 'Jog_Fwd_Loop', speed: 1.25 },
    jump: { clip: 'Jump_Loop', fade: 0.1 },
    air: { clip: 'Jump_Loop', fade: 0.1 },
    stumble: { clip: 'Hit_Knockback', once: true, fade: 0.06 },
    dive: { clip: 'Swim_Fwd_Loop', fade: 0.08 },
    wave: { clip: 'Celebration' },
    win: { clip: 'Dance_Loop' },
    lose: { clip: 'Crying' },
    fall: { clip: 'LiftAir_Fall_Air_Loop' },
  },
};

/**
 * Anima o personagem. t: relógio em segundos (o passo é a diferença entre as chamadas).
 * Estados: idle, run, jump, air, pogo, roll, stumble, skate, skatelie, spray, caught, hold, crash,
 * dive, fly, wave, win, lose, fall.
 */
export function poseAvatar(model, state, t) {
  const U = model.userData;
  if (!U?.mixer) return;
  let dt = U.lastT == null ? 0 : t - U.lastT;
  U.lastT = t;
  if (!(dt > 0) || dt > 0.25) dt = dt > 0.25 ? 0.25 : 0;
  const table = ANIM[U.style] || ANIM.surf;
  const spec = table[state] || ANIM.surf[state] || table.idle;
  if (U.state !== state) {
    U.state = state;
    U.rig.rotation.y = Math.PI + (spec.yaw || 0);
    if (U.clip !== spec.clip || spec.once) {
      const clip = RIG.clips.get(spec.clip);
      let a = U.actions.get(spec.clip);
      if (!a) { a = U.mixer.clipAction(clip); U.actions.set(spec.clip, a); }
      a.reset();
      a.setLoop(spec.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = !!spec.once;
      a.timeScale = spec.speed || 1;
      a.enabled = true;
      a.setEffectiveWeight(1);
      a.play();
      if (U.current && U.current !== a) a.crossFadeFrom(U.current, spec.fade ?? 0.18, false);
      U.current = a;
      U.clip = spec.clip;
    } else if (U.current) U.current.timeScale = spec.speed || 1;
  }
  U.mixer.update(dt);
}

/** Altura total aproximada (para a câmera e etiquetas). */
export const avatarHeight = (style) => (style === 'stumble' ? 1.25 : 1.9);
