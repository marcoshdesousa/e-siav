// Personagens dos jogos, com cara de boneco de vinil (liso, brilhante, cantos redondos): o mesmo
// visual vira um adolescente no Surf DBV (style 'surf') e um bonequinho cabeçudo no Stumble DBV
// (style 'stumble'). Tênis grandes, mãos redondinhas, olhos grandes com brilho.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ───────────── Materiais ─────────────
/** Degraus de luz (ainda usado pelo skate). */
export const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([80, 150, 210, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const mats = new Map();
/** Plástico liso (o nome ficou de quando era desenho; hoje é material "de boneco"). */
export function toon(color, extra) {
  const k = color + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...(extra || {}) }));
  return mats.get(k);
}
const skinMat = (c) => toon(c, { roughness: 0.6 });
const cloth = (c) => toon(c, { roughness: 0.78 });
const gloss = (c) => toon(c, { roughness: 0.25 });

/** Luz de estúdio (reflexos suaves) para o renderizador. Uma vez por renderizador.
 *  Use com scene.environmentIntensity ~0.5 para não lavar as cores. */
const envs = new WeakMap();
export function studioEnv(renderer) {
  if (!envs.has(renderer)) {
    const pm = new THREE.PMREMGenerator(renderer);
    envs.set(renderer, pm.fromScene(new RoomEnvironment(), 0.04).texture);
    renderer.toneMapping = THREE.NeutralToneMapping;
    pm.dispose();
  }
  return envs.get(renderer);
}

const G = {
  sph: (r, w = 24, h = 18) => new THREE.SphereGeometry(r, w, h),
  cap: (r, l, s = 16) => new THREE.CapsuleGeometry(r, l, 8, s),
  cyl: (a, b, h, s = 20) => new THREE.CylinderGeometry(a, b, h, s),
  tor: (r, t, a = Math.PI * 2, s = 28) => new THREE.TorusGeometry(r, t, 10, s, a),
};

/** Parte do corpo (malha com sombra), posicionada e escalada dentro de um grupo. */
function part(geo, mat, parent, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.set(sx, sy, sz);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  g.add(m);
  parent?.add(g);
  return g;
}
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }
function mix(a, b, k) { const c = new THREE.Color(a).lerp(new THREE.Color(b), k); return `#${c.getHexString()}`; }

// ───────────── Estampa da camisa (textura desenhada) ─────────────
const texCache = new Map();
function shirtTexture(s) {
  const key = s.id;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const t = s.top;
  // Base com leve degradê (dá volume)
  const base = g.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, mix(t.color, '#ffffff', 0.08)); base.addColorStop(1, shade(t.color, 0.9));
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  const mid = 256; // frente do corpo
  const line = (x, w, col) => { g.fillStyle = col; g.fillRect(x - w / 2, 0, w, 256); };
  if (t.type === 'xadrez') {
    for (let x = 0; x < 512; x += 40) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 14, 256); }
    for (let y = 0; y < 256; y += 40) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, 512, 14); }
    for (let x = 20; x < 512; x += 40) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, 0, 4, 256); }
  }
  if (t.stripe) for (let y = 30; y < 256; y += 60) { g.fillStyle = t.color2; g.fillRect(0, y, 512, 16); }
  if (t.type === 'jaqueta' || t.type === 'moletom') { line(mid, 10, t.color2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(mid - 1, 0, 2, 256); }
  if (t.type === 'jaqueta') { line(mid, 34, shade(t.color, 0.82)); line(mid, 6, t.color2); }
  if (t.type === 'camisa-aberta') { line(mid, 90, t.color2); line(mid - 46, 6, shade(t.color, 0.7)); line(mid + 46, 6, shade(t.color, 0.7)); }
  if (t.type === 'colete') { line(mid, 80, t.color2); for (const dx of [-75, 75]) { g.fillStyle = shade(t.color, 0.8); g.fillRect(mid + dx - 22, 120, 44, 34); } }
  if (t.type === 'terno') { line(mid, 70, t.color2); g.fillStyle = '#b91c1c'; g.beginPath(); g.moveTo(mid - 10, 10); g.lineTo(mid + 10, 10); g.lineTo(mid + 8, 170); g.lineTo(mid, 190); g.lineTo(mid - 8, 170); g.fill(); }
  if (t.type === 'jaleco') { line(mid, 6, shade(t.color, 0.8)); for (let y = 40; y < 240; y += 50) { g.fillStyle = t.color2; g.beginPath(); g.arc(mid + 14, y, 6, 0, 7); g.fill(); } g.fillStyle = t.color2; g.fillRect(mid + 60, 70, 40, 6); }
  if (t.type === 'polo') { for (let y = 30; y < 110; y += 30) { g.fillStyle = t.color2; g.beginPath(); g.arc(mid, y, 5, 0, 7); g.fill(); } }
  if (t.type === 'uniforme') {
    for (const dx of [-70, 70]) { g.fillStyle = shade(t.color, 0.82); g.fillRect(mid + dx - 26, 60, 52, 44); g.fillStyle = shade(t.color, 0.7); g.fillRect(mid + dx - 26, 60, 52, 8); }
    for (let y = 30; y < 250; y += 46) { g.fillStyle = '#5c3d1e'; g.beginPath(); g.arc(mid, y, 5, 0, 7); g.fill(); }
    g.fillStyle = '#dc2626'; g.beginPath(); g.arc(mid + 120, 80, 14, 0, 7); g.fill();
  }
  if (t.number) {
    g.font = 'bold 110px "Arial Black", Arial'; g.textAlign = 'center';
    g.lineWidth = 10; g.strokeStyle = shade(t.color, 0.6); g.strokeText(t.number, mid, 190);
    g.fillStyle = t.color2; g.fillText(t.number, mid, 190);
  }
  if (t.logo) {
    g.fillStyle = t.color2; g.beginPath(); g.moveTo(mid - 44, 50); g.lineTo(mid + 44, 50); g.lineTo(mid, 140); g.closePath(); g.fill();
    g.fillStyle = t.color; g.beginPath(); g.moveTo(mid - 24, 64); g.lineTo(mid + 24, 64); g.lineTo(mid, 112); g.closePath(); g.fill();
  }
  if (t.flower) for (let k = 0; k < 14; k++) {
    const x = (k * 97) % 512; const y = 30 + ((k * 61) % 200);
    g.fillStyle = t.color2; for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + Math.cos(p * 1.26) * 10, y + Math.sin(p * 1.26) * 10, 7, 0, 7); g.fill(); }
    g.fillStyle = '#facc15'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
  }
  if (t.paint) for (let k = 0; k < 10; k++) { g.fillStyle = ['#ec4899', '#22d3ee', '#facc15', '#a3e635'][k % 4]; g.beginPath(); g.arc((k * 131) % 512, 40 + (k * 53) % 180, 10 + (k % 3) * 8, 0, 7); g.fill(); }
  // Barra (punho da camisa) mais escura
  g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, 236, 512, 20);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

/**
 * Proporções. surf: adolescente estilo "runner" (cabeça grande, pernas finas, tênis enormes).
 * stumble: bonequinho de vinil (cabeça enorme, corpo pequeno, mãos e pés grandes).
 */
const STYLE = {
  surf: { thigh: 0.4, shin: 0.4, legR: 0.082, torsoH: 0.46, torsoR: 0.21, head: 0.29, upper: 0.25, lower: 0.235, armR: 0.067, neck: 0.075, shoe: 1.45, hand: 1.35, eye: 0.21 },
  stumble: { thigh: 0.15, shin: 0.15, legR: 0.105, torsoH: 0.38, torsoR: 0.285, head: 0.46, upper: 0.15, lower: 0.13, armR: 0.085, neck: 0, shoe: 1.45, hand: 1.55, eye: 0.25 },
};
for (const S of Object.values(STYLE)) S.hip = S.thigh + S.shin + S.legR * 1.05;

const SLEEVE = { camiseta: 'curta', polo: 'curta', uniforme: 'curta', 'camisa-aberta': 'curta', vestido: 'curta', regata: 'sem', manga: 'longa', moletom: 'longa', jaqueta: 'longa', jaleco: 'longa', terno: 'longa', xadrez: 'longa', colete: 'longa' };

/** Tênis de cano baixo: solado grosso branco, corpo arredondado e biqueira colorida. */
function sneaker(foot, s, S) {
  const k = S.shoe;
  const L = S.legR * 3.5 * k;
  const Wd = S.legR * 2.25 * k;
  const soleH = S.legR * 0.62 * k;
  const yBase = -S.legR * 1.05;
  const dark = new THREE.Color(s.shoes).getHSL({}).l < 0.25;
  const soleCol = dark ? '#e5e7eb' : '#ffffff';
  part(new RoundedBoxGeometry(Wd * 0.92, soleH, L, 4, soleH * 0.48), gloss(soleCol), foot, { y: yBase + soleH / 2, z: -L * 0.2 });
  // linha colorida no solado
  part(new RoundedBoxGeometry(Wd * 0.93, soleH * 0.22, L * 1.005, 2, soleH * 0.1), toon(s.shoes2), foot, { y: yBase + soleH * 0.72, z: -L * 0.2, shadow: false });
  // corpo do tênis
  part(G.sph(1, 22, 16), toon(s.shoes, { roughness: 0.45 }), foot, { y: yBase + soleH + S.legR * 0.28 * k, z: -L * 0.17, sx: Wd * 0.47, sy: S.legR * 0.85 * k, sz: L * 0.48 });
  // biqueira
  part(G.sph(1, 18, 12), toon(s.shoes2, { roughness: 0.4 }), foot, { y: yBase + soleH + S.legR * 0.12 * k, z: -L * 0.5, sx: Wd * 0.44, sy: S.legR * 0.5 * k, sz: L * 0.2 });
  // gola (onde entra o pé)
  const collar = part(G.tor(S.legR * 1.02, S.legR * 0.3, Math.PI * 2, 20), toon(s.shoes2), foot, { y: yBase + soleH + S.legR * 0.95 * k, z: L * 0.02 });
  collar.rotation.x = Math.PI / 2;
  // cadarço (faixa clara em cima)
  const lace = part(new RoundedBoxGeometry(Wd * 0.42, S.legR * 0.12, L * 0.34, 2, S.legR * 0.05), toon('#f8fafc'), foot, { y: yBase + soleH + S.legR * 0.98 * k, z: -L * 0.26, shadow: false });
  lace.rotation.x = -0.32;
}

/** Mão fechadinha (luva de boneco) com polegar. */
function hand(parent, skin, S, side, y) {
  const r = S.armR * S.hand;
  part(G.sph(r, 18, 14), skin, parent, { y, sx: 0.95, sy: 1.08, sz: 0.88 });
  part(G.sph(r * 0.42, 12, 10), skin, parent, { x: -side * r * 0.62, y: y + r * 0.25, z: -r * 0.45 });
}

/** Monta o personagem. Fica de frente para -z (de costas para a câmera que vem de trás). */
export function buildAvatar(s, style = 'surf') {
  const S = STYLE[style];
  const root = new THREE.Group();
  const P = {};
  const skin = skinMat(s.skin);
  const topM = new THREE.MeshStandardMaterial({ map: shirtTexture(s), roughness: 0.78 });
  const topPlain = cloth(s.top.color);
  const bottom = s.bottom.type === 'vestido' ? s.top.color : s.bottom.color;
  const pantsM = cloth(bottom);
  const sleeve = SLEEVE[s.top.type] || 'curta';
  const sleeveM = s.top.type === 'colete' ? cloth(s.top.color2) : topPlain;

  const hips = new THREE.Group();
  hips.position.y = S.hip;
  root.add(hips);
  P.hips = hips;

  // ── Pernas
  const longPants = s.bottom.type === 'calca';
  const shorts = s.bottom.type === 'bermuda';
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(S.torsoR * (style === 'stumble' ? 0.56 : 0.5) * side, -0.02, 0);
    hips.add(thigh);
    part(G.cap(S.legR * (shorts ? 1.32 : longPants ? 1.08 : 1), S.thigh * 0.78), longPants || shorts ? pantsM : skin, thigh, { y: -S.thigh / 2 });
    if (shorts) part(G.cyl(S.legR * 1.38, S.legR * 1.42, S.thigh * 0.18), cloth(shade(bottom, 0.85)), thigh, { y: -S.thigh * 0.82 });
    const knee = new THREE.Group();
    knee.position.y = -S.thigh;
    thigh.add(knee);
    part(G.cap(S.legR * (longPants ? 1.02 : 0.88), S.shin * 0.74), longPants ? pantsM : skin, knee, { y: -S.shin / 2 });
    if (longPants) part(G.cyl(S.legR * 1.12, S.legR * 1.16, S.shin * 0.14), cloth(shade(bottom, 0.85)), knee, { y: -S.shin * 0.9 });
    else part(G.cyl(S.legR * 0.98, S.legR * 0.94, S.shin * 0.3), cloth('#f8fafc'), knee, { y: -S.shin * 0.84 }); // meia
    const foot = new THREE.Group();
    foot.position.y = -S.shin;
    knee.add(foot);
    sneaker(foot, s, S);
    P[side < 0 ? 'thighL' : 'thighR'] = thigh;
    P[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  // Saia / vestido (rodado, no joelho ou abaixo)
  if (['saia', 'saia-longa', 'vestido'].includes(s.bottom.type)) {
    const len = s.bottom.type === 'saia-longa' ? S.thigh + S.shin * 0.85 : S.thigh * 1.08;
    const R0 = S.torsoR;
    const pts = [new THREE.Vector2(R0 * 0.9, 0.06), new THREE.Vector2(R0 * 1.02, -len * 0.3), new THREE.Vector2(R0 * 1.35, -len * 0.8), new THREE.Vector2(R0 * 1.5, -len), new THREE.Vector2(R0 * 1.42, -len - 0.025), new THREE.Vector2(R0 * 1.3, -len * 0.95)];
    const skirt = part(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: bottom, roughness: 0.75, side: THREE.DoubleSide }), hips);
    skirt.scale.z = 0.86;
    P.skirt = skirt;
  } else {
    part(G.sph(S.torsoR * 0.96), pantsM, hips, { y: 0.0, sy: 0.58, sz: style === 'stumble' ? 0.86 : 0.7 });
  }

  // ── Tronco (camisa com estampa)
  const torso = new THREE.Group();
  hips.add(torso);
  P.torso = torso;
  const R = S.torsoR;
  const H = S.torsoH;
  const prof = [
    new THREE.Vector2(0.001, -0.01), new THREE.Vector2(R * 0.9, -0.01), new THREE.Vector2(R * 0.96, H * 0.06), new THREE.Vector2(R * 0.97, H * 0.3), new THREE.Vector2(R * 1.03, H * 0.62),
    new THREE.Vector2(R * 1.0, H * 0.84), new THREE.Vector2(R * 0.8, H * 0.97), new THREE.Vector2(R * 0.4, H * 1.03), new THREE.Vector2(0.001, H * 1.04),
  ];
  const body = part(new THREE.LatheGeometry(prof, 36), topM, torso);
  body.scale.z = style === 'stumble' ? 0.9 : 0.74;
  if (s.top.type === 'jaleco') {
    const coat = part(new THREE.LatheGeometry([new THREE.Vector2(R * 0.98, 0.02), new THREE.Vector2(R * 1.08, -0.22), new THREE.Vector2(R * 1.12, -0.24)], 28), new THREE.MeshStandardMaterial({ color: s.top.color, roughness: 0.75, side: THREE.DoubleSide }), torso);
    coat.scale.z = 0.8;
  }
  if (s.top.type === 'moletom') {
    // Capuz caído nas costas e bolso canguru
    part(G.sph(R * 0.62, 20, 14), topPlain, torso, { y: H * 0.95, z: R * 0.52, sx: 1.15, sy: 0.6, sz: 0.75 });
    part(new RoundedBoxGeometry(R * 1.1, H * 0.24, 0.05, 2, 0.02), cloth(shade(s.top.color, 0.88)), torso, { y: H * 0.28, z: -R * 0.7 });
    for (const sd of [-1, 1]) part(G.cyl(0.008, 0.008, H * 0.28, 6), cloth('#f8fafc'), torso, { x: sd * R * 0.18, y: H * 0.8, z: -R * 0.74, shadow: false });
  }
  if (s.top.type === 'polo' || s.top.type === 'terno' || s.top.type === 'jaleco' || s.top.type === 'uniforme') {
    const col = part(G.tor(R * 0.46, R * 0.11, Math.PI * 2, 24), s.top.type === 'terno' ? cloth('#ffffff') : topPlain, torso, { y: H * 0.99 });
    col.rotation.x = Math.PI / 2;
  }
  // Pescoço e cabeça
  const head = new THREE.Group();
  head.position.y = H + S.neck + S.head * 0.9;
  torso.add(head);
  P.head = head;
  if (S.neck) part(G.cyl(S.head * 0.3, S.head * 0.34, S.neck + 0.08), skin, head, { y: -S.head * 0.9 - S.neck / 2 + 0.03 });
  buildHead(head, s, S, style);

  // ── Braços
  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set((R * 0.97 + S.armR * 0.55) * side, H * 0.85, 0);
    torso.add(sh);
    part(G.sph(S.armR * 1.12), sleeve === 'sem' ? skin : sleeveM, sh);
    part(G.cap(S.armR, S.upper * 0.72), sleeve === 'sem' ? skin : sleeveM, sh, { y: -S.upper / 2 });
    if (sleeve === 'curta') part(G.cyl(S.armR * 1.2, S.armR * 1.28, S.upper * 0.42), sleeveM, sh, { y: -S.upper * 0.3 });
    const elbow = new THREE.Group();
    elbow.position.y = -S.upper;
    sh.add(elbow);
    part(G.cap(S.armR * (sleeve === 'longa' ? 1.0 : 0.9), S.lower * 0.72), sleeve === 'longa' ? sleeveM : skin, elbow, { y: -S.lower / 2 });
    if (sleeve === 'longa') part(G.cyl(S.armR * 1.08, S.armR * 1.12, S.lower * 0.16), cloth(shade(s.top.type === 'colete' ? s.top.color2 : s.top.color, 0.82)), elbow, { y: -S.lower * 0.9 });
    hand(elbow, skin, S, side, -S.lower - S.armR * S.hand * 0.55);
    P[side < 0 ? 'armL' : 'armR'] = sh;
    P[side < 0 ? 'elbowL' : 'elbowR'] = elbow;
  }

  // ── Acessórios
  const acc = s.acc?.type;
  if (acc === 'mochila') {
    part(new RoundedBoxGeometry(R * 1.3, H * 0.62, R * 0.62, 4, R * 0.22), cloth(s.acc.color), torso, { y: H * 0.52, z: R * 0.98 });
    part(new RoundedBoxGeometry(R * 0.9, H * 0.24, R * 0.2, 3, R * 0.08), cloth(shade(s.acc.color, 0.82)), torso, { y: H * 0.4, z: R * 1.32 });
    for (const sd of [-1, 1]) { const st = part(G.tor(R * 0.42, 0.02, Math.PI, 14), cloth(shade(s.acc.color, 0.7)), torso, { x: sd * R * 0.48, y: H * 0.72 }); st.rotation.y = Math.PI / 2; }
  }
  if (acc === 'lenco') {
    const ring = part(G.tor(R * 0.5, R * 0.13), cloth(s.acc.color), torso, { y: H * 0.98 });
    ring.rotation.x = Math.PI / 2;
    const tri = part(new THREE.ConeGeometry(R * 0.75, H * 0.55, 3), cloth(s.acc.color), torso, { y: H * 0.68, z: R * 0.72 });
    tri.rotation.x = Math.PI; tri.scale.z = 0.25;
    part(G.tor(R * 0.12, R * 0.05), gloss('#7c4a1e'), torso, { y: H * 0.82, z: -R * 0.74 });
    for (const sd of [-1, 1]) { const e = part(G.cap(R * 0.09, H * 0.2), cloth(s.acc.color), torso, { x: sd * R * 0.12, y: H * 0.62, z: -R * 0.74 }); e.rotation.z = 0.25 * sd; }
  }
  if (acc === 'cachecol') {
    const ring = part(G.tor(R * 0.55, R * 0.2), cloth(s.acc.color), torso, { y: H * 0.98 });
    ring.rotation.x = Math.PI / 2;
    part(new RoundedBoxGeometry(R * 0.35, H * 0.5, R * 0.16, 2, R * 0.06), cloth(s.acc.color), torso, { x: R * 0.3, y: H * 0.65, z: -R * 0.72 });
  }
  if (acc === 'fone') {
    const band = part(G.tor(S.head * 1.02, S.head * 0.07, Math.PI, 20), gloss(s.acc.color), head, { y: S.head * 0.05 });
    band.rotation.y = Math.PI / 2;
    for (const sd of [-1, 1]) part(G.cyl(S.head * 0.24, S.head * 0.24, S.head * 0.16, 20), gloss(s.acc.color), head, { x: sd * S.head * 1.0, y: -S.head * 0.05 }).rotation.z = Math.PI / 2;
  }
  root.userData.P = P;
  root.userData.style = style;
  return root;
}

function buildHead(head, s, S, style) {
  const r = S.head;
  const skin = skinMat(s.skin);
  const big = style === 'stumble';
  part(G.sph(r, 32, 24), skin, head, { sy: big ? 0.96 : 1.03, sx: big ? 1.06 : 1, sz: 0.98 });
  // Orelhas
  for (const sd of [-1, 1]) part(G.sph(r * 0.2), skin, head, { x: sd * r * 0.98, y: -r * 0.04, sx: 0.55 });
  // Olhos: branco, íris grande, pupila, dois brilhos e pálpebra de cima
  const ey = big ? r * 0.02 : r * 0.04;
  const ex = big ? r * 0.37 : r * 0.36;
  const er = r * S.eye;
  const iris = new THREE.Color(s.eyes || '#3b2a1a');
  if (big) iris.lerp(new THREE.Color('#0f0a07'), 0.45);
  for (const sd of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sd * ex, ey, -r * 0.84);
    eye.rotation.y = sd * -0.3;
    head.add(eye);
    part(G.sph(er, 20, 16), gloss('#ffffff'), eye, { sx: 0.8, sy: big ? 1.12 : 1.0, sz: 0.5, shadow: false });
    part(G.sph(er * (big ? 0.7 : 0.62), 18, 14), gloss(`#${iris.getHexString()}`), eye, { y: -er * 0.06, z: -er * 0.32, sx: 1, sy: 1.1, sz: 0.4, shadow: false });
    part(G.sph(er * 0.3, 12, 10), gloss('#0b0b0f'), eye, { y: -er * 0.06, z: -er * 0.45, sy: 1.1, sz: 0.35, shadow: false });
    const hi = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    part(G.sph(er * 0.17, 10, 8), hi, eye, { x: sd * -er * 0.2, y: er * 0.24, z: -er * 0.52, shadow: false });
    part(G.sph(er * 0.08, 8, 6), hi, eye, { x: sd * er * 0.2, y: -er * 0.25, z: -er * 0.5, shadow: false });
    // Pálpebra/linha dos cílios
    const lid = part(G.tor(er * 0.8, er * (s.g === 'f' ? 0.12 : 0.08), Math.PI * 0.85, 14), gloss('#1b1420'), eye, { y: er * 0.06, z: -er * 0.2, shadow: false });
    lid.rotation.z = Math.PI * 0.075;
    if (s.g === 'f') for (const k of [0, 1]) {
      const lash = part(G.cap(er * 0.05, er * 0.22, 6), gloss('#1b1420'), eye, { x: sd * er * (0.62 + k * 0.12), y: er * (0.62 - k * 0.22), z: -er * 0.2, shadow: false });
      lash.rotation.z = sd * -(0.8 + k * 0.3);
    }
    // Sobrancelha
    const brow = part(G.cap(r * 0.04, r * 0.2, 8), toon(shade(s.hairColor, 0.9)), head, { x: sd * ex, y: ey + er * 1.38, z: -r * 0.86, shadow: false });
    brow.rotation.z = Math.PI / 2 + sd * 0.14;
  }
  // Nariz
  part(G.sph(r * (big ? 0.075 : 0.085)), skinMat(shade(s.skin, 0.94)), head, { y: -r * (big ? 0.16 : 0.13), z: -r * 0.99, sy: 0.85, shadow: false });
  // Boca: no bonequinho, sorrisão aberto; no adolescente, sorriso de canto
  if (big) {
    const mouth = part(new THREE.SphereGeometry(r * 0.11, 18, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gloss('#5b1220'), head, { y: -r * 0.3, z: -r * 0.92, sx: 1.25, sy: 0.8, sz: 0.35, shadow: false });
    mouth.rotation.x = -0.3;
    part(G.sph(r * 0.045), gloss('#e85d75'), head, { y: -r * 0.36, z: -r * 0.955, sx: 1.4, sy: 0.55, sz: 0.4, shadow: false });
  } else {
    const smile = part(G.tor(r * 0.15, r * 0.03, Math.PI, 16), gloss('#7f1d1d'), head, { y: -r * 0.3, z: -r * 0.9, shadow: false });
    smile.rotation.set(-0.3, 0.12, Math.PI);
  }
  for (const sd of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(r * 0.13, 20), new THREE.MeshBasicMaterial({ color: '#fb7185', transparent: true, opacity: 0.3, depthWrite: false }));
    cheek.position.set(sd * r * 0.56, -r * 0.2, -r * 0.84);
    cheek.rotation.y = Math.PI + sd * -0.6;
    head.add(cheek);
  }
  buildHair(head, s, r);
  buildHat(head, s, r);
  if (s.acc?.type === 'oculos') {
    for (const sd of [-1, 1]) {
      const lens = new THREE.Mesh(G.cyl(er * 1.0, er * 1.0, 0.01, 22), new THREE.MeshStandardMaterial({ color: s.acc.color, roughness: 0.1, transparent: true, opacity: 0.55 }));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(sd * ex, ey, -r * 1.0);
      head.add(lens);
      const rim = new THREE.Mesh(G.tor(er * 1.02, er * 0.15, Math.PI * 2, 22), gloss('#111827'));
      rim.position.copy(lens.position);
      head.add(rim);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(ex * 0.6, er * 0.16, er * 0.16), gloss('#111827'));
    bridge.position.set(0, ey + er * 0.2, -r * 1.0);
    head.add(bridge);
  }
}

function buildHair(head, s, r) {
  const hm = toon(s.hairColor, { roughness: 0.62 });
  const hs = new THREE.MeshStandardMaterial({ color: s.hairColor, roughness: 0.62, side: THREE.DoubleSide });
  const shell = (rr, phiS, phiL, thS, thL, opts = {}) => part(new THREE.SphereGeometry(rr, 32, 20, phiS, phiL, thS, thL), hs, head, opts);
  const h = s.hair;
  if (h === 'raspado') { shell(r * 1.02, 0, Math.PI * 2, 0, Math.PI * 0.42); return; }
  // Base: topo da cabeça e a nuca
  shell(r * 1.07, 0, Math.PI * 2, 0, Math.PI * 0.4);
  shell(r * 1.06, 0, Math.PI, Math.PI * 0.35, Math.PI * 0.32);
  const fr = (x, y, z, sx, sy, sz, rz = 0) => { const f = part(G.sph(r * 0.4), hm, head, { x, y, z, sx, sy, sz }); f.rotation.z = rz; return f; };
  if (h === 'curto' || h === 'lateral' || h === 'topete' || h === 'longo-m') fr(r * 0.15, r * 0.62, -r * 0.62, 1.5, 0.5, 0.75, -0.25);
  if (h === 'lateral') fr(-r * 0.35, r * 0.55, -r * 0.6, 1.2, 0.55, 0.7, 0.4);
  if (h === 'topete') fr(0, r * 0.95, -r * 0.45, 1.3, 0.8, 1, 0);
  if (h === 'espetado') for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const c = part(new THREE.ConeGeometry(r * 0.2, r * 0.55, 10), hm, head, { x: Math.cos(a) * r * 0.45, y: r * 0.9, z: Math.sin(a) * r * 0.45 + r * 0.05 });
    c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
  }
  if (h === 'cacheado') for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    part(G.sph(r * 0.24), hm, head, { x: Math.cos(a) * r * 0.82, y: r * 0.45 + (k % 2) * r * 0.2, z: Math.sin(a) * r * 0.82 + r * 0.05 });
  }
  if (h === 'black') part(G.sph(r * 1.18, 30, 22), hm, head, { y: r * 0.42, z: r * 0.32, sz: 0.82 });
  if (h === 'longo-m') shell(r * 1.08, 0, Math.PI, Math.PI * 0.55, Math.PI * 0.3);
  if (['longo', 'ondulado', 'chanel', 'rabo', 'coque', 'trancas', 'maria'].includes(h)) {
    // Franja de menina
    fr(-r * 0.2, r * 0.6, -r * 0.64, 1.3, 0.55, 0.7, 0.3);
    fr(r * 0.3, r * 0.62, -r * 0.6, 1.0, 0.5, 0.7, -0.35);
  }
  if (h === 'longo' || h === 'ondulado') {
    const pts = [new THREE.Vector2(r * 1.02, 0), new THREE.Vector2(r * 1.05, -r * 0.6), new THREE.Vector2(r * 0.96, -r * 1.55), new THREE.Vector2(r * 0.8, -r * 1.72)];
    const back = part(new THREE.LatheGeometry(pts, 28, -Math.PI * 0.62, Math.PI * 1.24), hs, head);
    back.scale.z = 0.85;
    if (h === 'ondulado') for (let k = 0; k < 6; k++) part(G.sph(r * 0.22), hm, head, { x: Math.cos(k) * r * 0.75, y: -r * 1.4, z: Math.abs(Math.sin(k)) * r * 0.75 });
  }
  if (h === 'chanel') {
    const pts = [new THREE.Vector2(r * 1.06, 0), new THREE.Vector2(r * 1.1, -r * 0.5), new THREE.Vector2(r * 1.0, -r * 0.75)];
    part(new THREE.LatheGeometry(pts, 28, -Math.PI * 0.68, Math.PI * 1.36), hs, head);
  }
  if (h === 'rabo') {
    part(G.tor(r * 0.12, r * 0.05), gloss('#ec4899'), head, { y: r * 0.35, z: r * 0.95 });
    const tail = new THREE.Group();
    tail.position.set(0, r * 0.35, r * 1.0);
    head.add(tail);
    part(G.cap(r * 0.18, r * 0.7), hm, tail, { y: -r * 0.45, z: r * 0.12 });
    head.userData.tail = tail;
  }
  if (h === 'coque') part(G.sph(r * 0.36), hm, head, { y: r * 0.8, z: r * 0.5 });
  if (h === 'trancas' || h === 'maria') {
    for (const sd of [-1, 1]) {
      if (h === 'maria') {
        part(G.sph(r * 0.28), hm, head, { x: sd * r * 0.95, y: r * 0.3, z: r * 0.2 });
        part(G.cap(r * 0.15, r * 0.5), hm, head, { x: sd * r * 1.1, y: -r * 0.2, z: r * 0.25 });
      } else for (let k = 0; k < 4; k++) part(G.sph(r * 0.15), hm, head, { x: sd * r * 0.8, y: -r * 0.3 - k * r * 0.25, z: r * 0.25 });
    }
  }
}

function buildHat(head, s, r) {
  const t = s.hat?.type;
  if (!t) return;
  const hm = toon(s.hat.color, { roughness: 0.6 });
  const hs = new THREE.MeshStandardMaterial({ color: s.hat.color, roughness: 0.6, side: THREE.DoubleSide });
  const dome = (rr, th = Math.PI * 0.5) => part(new THREE.SphereGeometry(rr, 30, 16, 0, Math.PI * 2, 0, th), hs, head, { y: r * 0.08 });
  if (t === 'bone' || t === 'bone-tras') {
    dome(r * 1.12, Math.PI * 0.45);
    const brim = part(G.cyl(r * 0.7, r * 0.7, r * 0.06, 26), hm, head, { y: r * 0.45, z: (t === 'bone' ? -1 : 1) * r * 0.95, sz: 0.75 });
    brim.rotation.x = (t === 'bone' ? 1 : -1) * 0.15;
    part(G.sph(r * 0.09), toon('#ffffff'), head, { y: r * 1.18 });
  }
  if (t === 'gorro') {
    dome(r * 1.1, Math.PI * 0.5).position.y = r * 0.3;
    const band = part(G.tor(r * 0.98, r * 0.13), toon(shade(s.hat.color, 0.85)), head, { y: r * 0.4 });
    band.rotation.x = Math.PI / 2;
    part(G.sph(r * 0.25), toon('#f8fafc', { roughness: 0.9 }), head, { y: r * 1.42 });
  }
  if (t === 'faixa') { const b = part(G.tor(r * 1.03, r * 0.08), hm, head, { y: r * 0.45 }); b.rotation.x = Math.PI / 2 + 0.15; }
  if (t === 'chapeu') {
    part(G.cyl(r * 1.7, r * 1.7, r * 0.06, 36), hm, head, { y: r * 0.55 });
    part(G.cyl(r * 0.85, r * 1.0, r * 0.6, 28), hm, head, { y: r * 0.85 });
    part(G.cyl(r * 1.0, r * 1.01, r * 0.13, 28), toon('#7c2d12'), head, { y: r * 0.62 });
  }
  if (t === 'boina') part(G.sph(r * 1.05, 28, 18), hm, head, { x: r * 0.12, y: r * 0.72, sy: 0.38 });
  if (t === 'capacete') {
    dome(r * 1.16, Math.PI * 0.5).position.y = r * 0.3;
    part(G.tor(r * 1.08, r * 0.07), toon(shade(s.hat.color, 0.7)), head, { y: r * 0.36 }).rotation.x = Math.PI / 2;
  }
  if (t === 'chef') {
    part(G.cyl(r * 0.85, r * 0.9, r * 0.45, 26), hm, head, { y: r * 0.95 });
    part(G.sph(r * 0.95), hm, head, { y: r * 1.45, sy: 0.75 });
  }
}

/**
 * Animações: idle, run, jump, roll, stumble, skate, skatelie, spray, caught, crash, dive, air, wave, fly, pogo.
 * k: progresso de 0 a 1 para animações curtas (tropeço, batida).
 */
export function poseAvatar(model, state, t, k = 0) {
  const P = model.userData.P;
  const stumble = model.userData.style === 'stumble';
  const hipY = stumble ? STYLE.stumble.hip : STYLE.surf.hip;
  const s = Math.sin(t * 13);
  const c = Math.cos(t * 13);
  P.hips.position.set(0, hipY, 0);
  P.hips.rotation.set(0, 0, 0);
  P.torso.rotation.set(0, 0, 0);
  P.head.rotation.set(0, 0, 0);
  const legs = (a, b, ka, kb) => { P.thighL.rotation.set(a, 0, 0); P.thighR.rotation.set(b, 0, 0); P.kneeL.rotation.x = ka; P.kneeR.rotation.x = kb; };
  const arms = (a, b, ea, eb, za = 0.15, zb = -0.15) => { P.armL.rotation.set(a, 0, za); P.armR.rotation.set(b, 0, zb); P.elbowL.rotation.x = ea; P.elbowR.rotation.x = eb; };
  const tail = P.head.userData.tail;
  if (tail) tail.rotation.x = 0.3;
  switch (state) {
    case 'run':
      legs(s * 0.95, -s * 0.95, -Math.max(0, -s) * 1.5 - 0.15, -Math.max(0, s) * 1.5 - 0.15);
      arms(-s * 0.95, s * 0.95, 1.2, 1.2);
      P.hips.position.y = hipY + Math.abs(c) * (stumble ? 0.05 : 0.06);
      P.torso.rotation.x = -0.15;
      P.torso.rotation.y = s * 0.12;
      P.head.rotation.y = -s * 0.08;
      if (tail) tail.rotation.x = 0.4 + Math.abs(s) * 0.5;
      break;
    case 'jump':
    case 'air':
      legs(0.9, -0.25, -1.5, -0.5);
      arms(-2.5, 0.5, 0.3, 1.0, 0.45, -0.3);
      P.torso.rotation.x = -0.08;
      if (tail) tail.rotation.x = 1.3;
      break;
    case 'pogo': {
      // Pula-pula: pernas juntas, braços abertos para cima
      const b = Math.max(0, Math.sin(t * 6)) * 0.6;
      legs(0.05, 0.05, -0.1 - b, -0.1 - b);
      arms(-2.7, -2.7, 0.2, 0.2, 0.5, -0.5);
      if (tail) tail.rotation.x = 1.2;
      break;
    }
    case 'fly':
      // Foguete nas costas: corpo inclinado para a frente, pernas para trás
      P.hips.rotation.x = -0.55;
      legs(-0.2 + Math.sin(t * 8) * 0.12, -0.25 - Math.sin(t * 8) * 0.12, -0.6, -0.5);
      arms(0.25, 0.25, 0.4, 0.4, 0.9, -0.9);
      P.head.rotation.x = 0.4;
      if (tail) tail.rotation.x = 1.4;
      break;
    case 'roll':
      P.hips.position.y = hipY * 0.5;
      P.hips.rotation.x = -t * 14;
      legs(1.7, 1.7, -2.3, -2.3);
      arms(1.3, 1.3, 1.5, 1.5);
      break;
    case 'stumble': {
      const f = Math.sin(Math.min(1, k) * Math.PI);
      legs(-0.4 + s * 0.3, 0.7, -0.9, -0.4);
      arms(-2.6 + Math.sin(t * 25) * 0.6, -2.2 + Math.cos(t * 25) * 0.6, 0.4, 0.4, 0.8, -0.8);
      P.torso.rotation.x = -0.6 * f;
      P.hips.position.y = hipY - f * 0.12;
      break;
    }
    case 'skate':
      legs(0.35, -0.45, -0.75, -0.6);
      arms(-0.35, 0.35, 0.5, 0.4, 1.0, -1.0);
      P.hips.position.y = hipY - 0.1 + Math.sin(t * 4) * 0.015;
      P.hips.rotation.y = 0.55;
      P.torso.rotation.y = -0.4;
      P.torso.rotation.x = -0.12;
      P.head.rotation.y = -0.25;
      break;
    case 'skatelie':
      // Deitado de barriga no skate (rolando com o skate)
      P.hips.position.y = 0.32;
      P.hips.rotation.x = -Math.PI / 2 + 0.15;
      legs(0.1, -0.1, -0.2, -0.2);
      arms(-2.9, -2.9, 0.1, 0.1, 0.25, -0.25);
      P.head.rotation.x = 1.1;
      break;
    case 'spray':
      legs(0.05, -0.05, -0.1, -0.1);
      arms(-0.3, -1.45 + Math.sin(t * 6) * 0.25, 0.3, 0.25 + Math.sin(t * 9) * 0.15, 0.15, -0.1 + Math.sin(t * 6) * 0.3);
      P.head.rotation.x = -0.1;
      break;
    case 'caught':
      legs(0.2, -0.2, -0.3, -0.3);
      arms(-2.8, -2.8, 0, 0, 0.4, -0.4);
      break;
    case 'crash':
      // Bateu de frente: cai para trás
      P.hips.position.y = hipY * (1 - k * 0.7);
      P.hips.rotation.x = k * 1.3;
      legs(-0.6 * k, -0.3 * k, -0.3, -0.5);
      arms(-1.5 * k, -2.0 * k, 0.2, 0.2, 0.9, -0.9);
      break;
    case 'dive':
      P.hips.position.y = hipY * 0.7;
      P.hips.rotation.x = -1.3;
      legs(0.3, 0.3, -0.2, -0.2);
      arms(-3, -3, 0, 0, 0.2, -0.2);
      break;
    case 'wave':
      legs(0, 0, -0.05, -0.05);
      arms(0.05, -2.6 + Math.sin(t * 8) * 0.3, 0.2, 0.4, 0.15, -0.6 + Math.sin(t * 8) * 0.3);
      P.head.rotation.z = Math.sin(t * 2) * 0.08;
      break;
    default:
      legs(0, 0, -0.05, -0.05);
      arms(Math.sin(t * 2) * 0.05, -Math.sin(t * 2) * 0.05, 0.25, 0.25);
      P.hips.position.y = hipY + Math.sin(t * 2) * 0.01;
      P.head.rotation.y = Math.sin(t * 0.7) * 0.15;
  }
  // A saia abre junto com as pernas (as pernas não atravessam o tecido)
  if (P.skirt) {
    const a = Math.min(1.6, Math.max(Math.abs(P.thighL.rotation.x), Math.abs(P.thighR.rotation.x)));
    P.skirt.scale.set(1 + a * 0.18, 1 - a * 0.08, 0.86 + a * 0.55);
    P.skirt.rotation.x = (P.thighL.rotation.x + P.thighR.rotation.x) * 0.25;
  }
}

/** Altura total aproximada (para a câmera e etiquetas). */
export const avatarHeight = (style) => (style === 'stumble' ? 1.7 : 1.9);
