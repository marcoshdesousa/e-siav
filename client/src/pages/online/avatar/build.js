// Personagens dos jogos (estilo desenho animado, com contorno): o mesmo visual vira um
// adolescente no Surf DBV (style 'surf') e um bonequinho cabeçudo no Stumble DBV (style 'stumble').
import * as THREE from 'three';

// ───────────── Materiais ─────────────
export const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([80, 150, 210, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const mats = new Map();
export function toon(color, extra) {
  const k = color + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(k)) mats.set(k, new THREE.MeshToonMaterial({ color, gradientMap, ...(extra || {}) }));
  return mats.get(k);
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: '#1b1420', side: THREE.BackSide });

const G = {
  sph: (r, w = 20, h = 16) => new THREE.SphereGeometry(r, w, h),
  cap: (r, l, s = 14) => new THREE.CapsuleGeometry(r, l, 6, s),
  cyl: (a, b, h, s = 18) => new THREE.CylinderGeometry(a, b, h, s),
  tor: (r, t, a = Math.PI * 2, s = 24) => new THREE.TorusGeometry(r, t, 8, s, a),
};

/** Parte do corpo: malha + contorno escuro (casca virada para dentro, um pouco maior). */
function part(geo, mat, parent, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, outline = 0.035, shadow = true } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.set(sx, sy, sz);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  g.add(m);
  if (outline) {
    const o = new THREE.Mesh(geo, OUTLINE);
    geo.computeBoundingSphere();
    const r = geo.boundingSphere.radius || 1;
    o.scale.setScalar(1 + outline / r);
    g.add(o);
  }
  parent?.add(g);
  return g;
}

// ───────────── Estampa da camisa (textura desenhada) ─────────────
const texCache = new Map();
function shirtTexture(s) {
  const key = s.id;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const t = s.top;
  g.fillStyle = t.color; g.fillRect(0, 0, 512, 256);
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
  // dobra na barra
  g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, 238, 512, 18);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }

const STYLE = {
  surf: { hip: 0.84, thigh: 0.39, shin: 0.39, legR: 0.088, torsoH: 0.5, torsoR: 0.215, head: 0.255, upper: 0.25, lower: 0.25, armR: 0.068, eye: 1, neck: 0.06 },
  stumble: { hip: 0.42, thigh: 0.17, shin: 0.17, legR: 0.11, torsoH: 0.42, torsoR: 0.3, head: 0.42, upper: 0.17, lower: 0.15, armR: 0.085, eye: 1.25, neck: 0.0 },
};

const SLEEVE = { camiseta: 'curta', polo: 'curta', uniforme: 'curta', 'camisa-aberta': 'curta', vestido: 'curta', regata: 'sem', manga: 'longa', moletom: 'longa', jaqueta: 'longa', jaleco: 'longa', terno: 'longa', xadrez: 'longa', colete: 'longa' };

/** Monta o personagem. Fica de frente para -z (de costas para a câmera que vem de trás). */
export function buildAvatar(s, style = 'surf') {
  const S = STYLE[style];
  const root = new THREE.Group();
  const P = {};
  const skin = toon(s.skin);
  const topM = new THREE.MeshToonMaterial({ map: shirtTexture(s), gradientMap });
  const topPlain = toon(s.top.color);
  const bottom = s.bottom.type === 'vestido' ? s.top.color : s.bottom.color;
  const pantsM = toon(bottom);
  const sleeve = SLEEVE[s.top.type] || 'curta';
  const sleeveM = s.top.type === 'colete' ? toon(s.top.color2) : topPlain;

  const hips = new THREE.Group();
  hips.position.y = S.hip;
  root.add(hips);
  P.hips = hips;

  // ── Pernas
  const longPants = s.bottom.type === 'calca';
  const shorts = s.bottom.type === 'bermuda';
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(S.torsoR * 0.52 * side, -0.02, 0);
    hips.add(thigh);
    part(G.cap(S.legR * (shorts ? 1.2 : 1), S.thigh * 0.75), longPants || shorts ? pantsM : skin, thigh, { y: -S.thigh / 2 });
    const knee = new THREE.Group();
    knee.position.y = -S.thigh;
    thigh.add(knee);
    part(G.cap(S.legR * 0.88, S.shin * 0.72), longPants ? pantsM : skin, knee, { y: -S.shin / 2 });
    if (!longPants) part(G.cyl(S.legR * 0.95, S.legR * 0.9, S.shin * 0.3), toon('#f8fafc'), knee, { y: -S.shin * 0.82, outline: 0.02 }); // meia
    // Tênis
    const foot = new THREE.Group();
    foot.position.y = -S.shin;
    knee.add(foot);
    const fs = style === 'stumble' ? 1.25 : 1;
    const shoe = part(G.cap(S.legR * 1.05 * fs, S.legR * 1.6 * fs), toon(s.shoes), foot, { y: -S.legR * 0.55, z: -S.legR * 0.7 });
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1, 1, 0.75);
    part(new THREE.BoxGeometry(S.legR * 2.15 * fs, S.legR * 0.5, S.legR * 3.8 * fs), toon(s.shoes2), foot, { y: -S.legR * 1.2, z: -S.legR * 0.75, outline: 0.015 });
    P[side < 0 ? 'thighL' : 'thighR'] = thigh;
    P[side < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  // Saia / vestido (rodado, abaixo do joelho na saia longa)
  if (['saia', 'saia-longa', 'vestido'].includes(s.bottom.type)) {
    const len = s.bottom.type === 'saia-longa' ? S.thigh + S.shin * 0.85 : S.thigh * 1.05;
    const pts = [new THREE.Vector2(S.torsoR * 0.92, 0.05), new THREE.Vector2(S.torsoR * 1.05, -len * 0.4), new THREE.Vector2(S.torsoR * 1.55, -len), new THREE.Vector2(S.torsoR * 1.45, -len - 0.02)];
    const skirt = part(new THREE.LatheGeometry(pts, 28), new THREE.MeshToonMaterial({ color: bottom, gradientMap, side: THREE.DoubleSide }), hips, { outline: 0 });
    skirt.scale.z = 0.85;
    P.skirt = skirt;
  } else {
    part(G.sph(S.torsoR * 0.95), pantsM, hips, { y: 0.0, sy: 0.55, sz: style === 'stumble' ? 0.86 : 0.68 });
  }

  // ── Tronco (camisa com estampa)
  const torso = new THREE.Group();
  hips.add(torso);
  P.torso = torso;
  const R = S.torsoR;
  const H = S.torsoH;
  const prof = [
    new THREE.Vector2(0.001, 0), new THREE.Vector2(R * 0.92, 0.0), new THREE.Vector2(R * 0.95, H * 0.25), new THREE.Vector2(R * 1.02, H * 0.6),
    new THREE.Vector2(R * 1.0, H * 0.82), new THREE.Vector2(R * 0.78, H * 0.96), new THREE.Vector2(R * 0.35, H * 1.02), new THREE.Vector2(0.001, H * 1.03),
  ];
  const body = part(new THREE.LatheGeometry(prof, 32), topM, torso, { y: 0.0, outline: 0.03 });
  body.scale.z = style === 'stumble' ? 0.9 : 0.72;
  if (s.top.type === 'jaleco') {
    const coat = part(new THREE.LatheGeometry([new THREE.Vector2(R * 0.98, 0.02), new THREE.Vector2(R * 1.08, -0.22), new THREE.Vector2(R * 1.12, -0.24)], 24), new THREE.MeshToonMaterial({ color: s.top.color, gradientMap, side: THREE.DoubleSide }), torso, { outline: 0 });
    coat.scale.z = 0.8;
  }
  if (s.top.type === 'moletom') {
    const hood = part(G.tor(R * 0.55, R * 0.2), topPlain, torso, { y: H * 0.98, z: R * 0.35 });
    hood.rotation.x = Math.PI / 2 + 0.5;
    part(new THREE.BoxGeometry(R * 1.1, H * 0.25, 0.05), toon(shade(s.top.color, 0.85)), torso, { y: H * 0.3, z: -R * 0.68, outline: 0.012 });
  }
  if (s.top.type === 'polo' || s.top.type === 'terno' || s.top.type === 'jaleco') {
    const col = part(G.tor(R * 0.45, R * 0.12, Math.PI * 2, 20), s.top.type === 'terno' ? toon('#ffffff') : topPlain, torso, { y: H * 0.98, outline: 0.012 });
    col.rotation.x = Math.PI / 2;
  }
  // Pescoço e cabeça
  const head = new THREE.Group();
  head.position.y = H + S.neck + S.head * 0.92;
  torso.add(head);
  P.head = head;
  if (S.neck) part(G.cyl(S.head * 0.33, S.head * 0.36, S.neck + 0.06), skin, head, { y: -S.head * 0.92 - S.neck / 2 + 0.02, outline: 0.015 });
  buildHead(head, s, S, style);

  // ── Braços
  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set((R * 0.98 + S.armR * 0.6) * side, H * 0.86, 0);
    torso.add(sh);
    part(G.sph(S.armR * 1.1), sleeve === 'sem' ? skin : sleeveM, sh, { outline: 0.02 }); // ombro
    part(G.cap(S.armR, S.upper * 0.7), sleeve === 'sem' ? skin : sleeveM, sh, { y: -S.upper / 2 });
    if (sleeve === 'curta') part(G.cyl(S.armR * 1.15, S.armR * 1.2, S.upper * 0.18), sleeveM, sh, { y: -S.upper * 0.55, outline: 0.012 });
    const elbow = new THREE.Group();
    elbow.position.y = -S.upper;
    sh.add(elbow);
    part(G.cap(S.armR * 0.9, S.lower * 0.7), sleeve === 'longa' ? sleeveM : skin, elbow, { y: -S.lower / 2 });
    if (sleeve === 'longa') part(G.cyl(S.armR * 1.0, S.armR * 1.05, S.lower * 0.15), toon(shade(s.top.type === 'colete' ? s.top.color2 : s.top.color, 0.8)), elbow, { y: -S.lower * 0.9, outline: 0.01 });
    part(G.sph(S.armR * 1.15), skin, elbow, { y: -S.lower - S.armR * 0.6 });
    P[side < 0 ? 'armL' : 'armR'] = sh;
    P[side < 0 ? 'elbowL' : 'elbowR'] = elbow;
  }

  // ── Acessórios
  const acc = s.acc?.type;
  if (acc === 'mochila') {
    const bag = part(new THREE.CapsuleGeometry(R * 0.6, H * 0.35, 6, 12), toon(s.acc.color), torso, { y: H * 0.55, z: R * 0.95, sz: 0.55 });
    bag.scale.x = 1.2;
    part(new THREE.BoxGeometry(R * 0.7, H * 0.22, 0.06), toon(shade(s.acc.color, 0.8)), torso, { y: H * 0.4, z: R * 1.28, outline: 0.012 });
    for (const sd of [-1, 1]) { const st = part(G.tor(R * 0.42, 0.018, Math.PI, 12), toon(shade(s.acc.color, 0.7)), torso, { x: sd * R * 0.5, y: H * 0.72, outline: 0 }); st.rotation.y = Math.PI / 2; }
  }
  if (acc === 'lenco') {
    const ring = part(G.tor(R * 0.5, R * 0.14), toon(s.acc.color), torso, { y: H * 0.97, outline: 0.012 });
    ring.rotation.x = Math.PI / 2;
    const tri = part(new THREE.ConeGeometry(R * 0.75, H * 0.55, 3), toon(s.acc.color), torso, { y: H * 0.68, z: R * 0.72, outline: 0.012 });
    tri.rotation.x = Math.PI; tri.scale.z = 0.25;
    part(G.tor(R * 0.13, R * 0.05), toon('#7c4a1e'), torso, { y: H * 0.82, z: -R * 0.74, outline: 0 });
    for (const sd of [-1, 1]) { const e = part(G.cap(R * 0.09, H * 0.2), toon(s.acc.color), torso, { x: sd * R * 0.12, y: H * 0.62, z: -R * 0.74, outline: 0.01 }); e.rotation.z = 0.25 * sd; }
  }
  if (acc === 'cachecol') {
    const ring = part(G.tor(R * 0.55, R * 0.2), toon(s.acc.color), torso, { y: H * 0.98, outline: 0.015 });
    ring.rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(R * 0.35, H * 0.5, R * 0.18), toon(s.acc.color), torso, { x: R * 0.3, y: H * 0.65, z: -R * 0.72, outline: 0.012 });
  }
  if (acc === 'fone') {
    const band = part(G.tor(R * 0.6, R * 0.07, Math.PI, 16), toon(s.acc.color), torso, { y: H * 1.0, z: -R * 0.1, outline: 0.012 });
    band.rotation.x = Math.PI / 2;
    for (const sd of [-1, 1]) part(G.cyl(R * 0.22, R * 0.22, R * 0.15), toon(s.acc.color), torso, { x: sd * R * 0.58, y: H * 1.0, z: -R * 0.15, outline: 0.012 }).rotation.z = Math.PI / 2;
  }
  // Tudo mais certinho no chão: os pés tocam y = 0
  root.userData.P = P;
  root.userData.style = style;
  return root;
}

function buildHead(head, s, S, style) {
  const r = S.head;
  const skin = toon(s.skin);
  const skull = part(G.sph(r, 28, 22), skin, head, { outline: 0.03 });
  skull.scale.set(1, 1.04, 0.98);
  const big = style === 'stumble';
  // Orelhas
  for (const sd of [-1, 1]) part(G.sph(r * 0.2), skin, head, { x: sd * r * 0.98, y: -r * 0.02, sx: 0.6, outline: 0.015 });
  // Olhos (grandes, com íris, pupila e brilho)
  const ey = big ? r * 0.08 : r * 0.05;
  const ex = big ? r * 0.36 : r * 0.38;
  const er = r * (big ? 0.24 : 0.22);
  for (const sd of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sd * ex, ey, -r * 0.86);
    head.add(eye);
    const white = new THREE.Mesh(G.sph(er, 16, 12), toon('#ffffff'));
    white.scale.set(0.82, 1.05, 0.45);
    eye.add(white);
    const iris = new THREE.Mesh(G.sph(er * 0.62, 14, 10), toon(s.eyes || '#3b2a1a'));
    iris.position.set(0, -er * 0.05, -er * 0.3);
    iris.scale.set(1, 1.1, 0.4);
    eye.add(iris);
    const pupil = new THREE.Mesh(G.sph(er * 0.32, 10, 8), toon('#0b0b0f'));
    pupil.position.set(0, -er * 0.05, -er * 0.43);
    pupil.scale.set(1, 1.1, 0.3);
    eye.add(pupil);
    const hi = new THREE.Mesh(G.sph(er * 0.16, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    hi.position.set(sd * -er * 0.18, er * 0.22, -er * 0.5);
    eye.add(hi);
    eye.rotation.y = sd * -0.28;
    if (s.g === 'f') {
      // Cílios
      const lash = new THREE.Mesh(G.tor(er * 0.8, er * 0.09, Math.PI * 0.8, 10), toon('#1b1420'));
      lash.position.set(0, er * 0.12, -er * 0.25);
      lash.rotation.z = Math.PI * 0.1;
      eye.add(lash);
    }
    // Sobrancelha
    const brow = part(G.cap(r * 0.035, r * 0.2), toon(s.hairColor), head, { x: sd * ex, y: ey + er * 1.45, z: -r * 0.88, outline: 0 });
    brow.rotation.z = Math.PI / 2 + sd * 0.12;
  }
  part(G.sph(r * 0.08), toon(shade(s.skin, 0.9)), head, { y: -r * 0.12, z: -r * 0.99, outline: 0 }); // nariz
  const smile = new THREE.Mesh(G.tor(r * 0.16, r * 0.035, Math.PI, 14), toon('#8b1d2c'));
  smile.position.set(0, -r * 0.3, -r * 0.9);
  smile.rotation.set(-0.25, 0, Math.PI);
  head.add(smile);
  for (const sd of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(r * 0.12, 16), new THREE.MeshBasicMaterial({ color: '#fb7185', transparent: true, opacity: 0.35 }));
    cheek.position.set(sd * r * 0.55, -r * 0.18, -r * 0.82);
    cheek.rotation.y = Math.PI + sd * -0.55;
    head.add(cheek);
  }
  buildHair(head, s, r);
  buildHat(head, s, r);
  if (s.acc?.type === 'oculos') {
    for (const sd of [-1, 1]) {
      const lens = new THREE.Mesh(G.cyl(er * 0.95, er * 0.95, 0.01, 18), new THREE.MeshToonMaterial({ color: s.acc.color, gradientMap, transparent: true, opacity: 0.8 }));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(sd * ex, ey, -r * 1.0);
      head.add(lens);
      const rim = new THREE.Mesh(G.tor(er * 0.98, er * 0.12, Math.PI * 2, 18), toon('#111827'));
      rim.position.copy(lens.position);
      head.add(rim);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(ex * 0.6, er * 0.15, er * 0.15), toon('#111827'));
    bridge.position.set(0, ey + er * 0.2, -r * 1.0);
    head.add(bridge);
  }
}

function buildHair(head, s, r) {
  const hm = toon(s.hairColor);
  const shell = (rr, phiS, phiL, thS, thL, opts = {}) => part(new THREE.SphereGeometry(rr, 28, 18, phiS, phiL, thS, thL), new THREE.MeshToonMaterial({ color: s.hairColor, gradientMap, side: THREE.DoubleSide }), head, { ...opts, outline: 0 });
  const h = s.hair;
  if (h === 'raspado') { shell(r * 1.02, 0, Math.PI * 2, 0, Math.PI * 0.42, { outline: 0 }); return; }
  // Base: topo da cabeça e a nuca
  shell(r * 1.07, 0, Math.PI * 2, 0, Math.PI * 0.4);
  shell(r * 1.06, 0, Math.PI, Math.PI * 0.35, Math.PI * 0.32);
  const fr = (x, y, z, sx, sy, sz, rz = 0) => { const f = part(G.sph(r * 0.4), hm, head, { x, y, z, sx, sy, sz, outline: 0.015 }); f.rotation.z = rz; return f; };
  if (h === 'curto' || h === 'lateral' || h === 'topete' || h === 'longo-m') fr(r * 0.15, r * 0.62, -r * 0.62, 1.5, 0.5, 0.75, -0.25);
  if (h === 'lateral') fr(-r * 0.35, r * 0.55, -r * 0.6, 1.2, 0.55, 0.7, 0.4);
  if (h === 'topete') fr(0, r * 0.95, -r * 0.45, 1.3, 0.8, 1, 0);
  if (h === 'espetado') for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const c = part(new THREE.ConeGeometry(r * 0.2, r * 0.55, 8), hm, head, { x: Math.cos(a) * r * 0.45, y: r * 0.9, z: Math.sin(a) * r * 0.45 + r * 0.05, outline: 0.012 });
    c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
  }
  if (h === 'cacheado') for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    part(G.sph(r * 0.24), hm, head, { x: Math.cos(a) * r * 0.82, y: r * 0.45 + (k % 2) * r * 0.2, z: Math.sin(a) * r * 0.82 + r * 0.05, outline: 0.012 });
  }
  if (h === 'black') part(G.sph(r * 1.25), hm, head, { y: r * 0.35, z: r * 0.15, sz: 0.95, outline: 0.02 });
  if (h === 'longo-m') shell(r * 1.08, 0, Math.PI, Math.PI * 0.55, Math.PI * 0.3);
  if (['longo', 'ondulado', 'chanel', 'rabo', 'coque', 'trancas', 'maria'].includes(h)) {
    // Franja de menina
    fr(-r * 0.2, r * 0.6, -r * 0.64, 1.3, 0.55, 0.7, 0.3);
    fr(r * 0.3, r * 0.62, -r * 0.6, 1.0, 0.5, 0.7, -0.35);
  }
  if (h === 'longo' || h === 'ondulado') {
    const pts = [new THREE.Vector2(r * 1.02, 0), new THREE.Vector2(r * 1.04, -r * 0.6), new THREE.Vector2(r * 0.95, -r * 1.6), new THREE.Vector2(r * 0.8, -r * 1.75)];
    const back = part(new THREE.LatheGeometry(pts, 24, -Math.PI * 0.62, Math.PI * 1.24), new THREE.MeshToonMaterial({ color: s.hairColor, gradientMap, side: THREE.DoubleSide }), head, { outline: 0 });
    back.scale.z = 0.85;
    if (h === 'ondulado') for (let k = 0; k < 6; k++) part(G.sph(r * 0.22), hm, head, { x: Math.cos(k) * r * 0.75, y: -r * 1.4, z: Math.abs(Math.sin(k)) * r * 0.75, outline: 0.01 });
  }
  if (h === 'chanel') {
    const pts = [new THREE.Vector2(r * 1.06, 0), new THREE.Vector2(r * 1.1, -r * 0.5), new THREE.Vector2(r * 1.0, -r * 0.75)];
    part(new THREE.LatheGeometry(pts, 24, -Math.PI * 0.68, Math.PI * 1.36), new THREE.MeshToonMaterial({ color: s.hairColor, gradientMap, side: THREE.DoubleSide }), head, { outline: 0 });
  }
  if (h === 'rabo') {
    part(G.tor(r * 0.12, r * 0.05), toon('#ec4899'), head, { y: r * 0.35, z: r * 0.95, outline: 0 });
    const tail = new THREE.Group();
    tail.position.set(0, r * 0.35, r * 1.0);
    head.add(tail);
    part(G.cap(r * 0.17, r * 0.7), hm, tail, { y: -r * 0.45, z: r * 0.12, outline: 0.015 });
    head.userData.tail = tail;
  }
  if (h === 'coque') part(G.sph(r * 0.36), hm, head, { y: r * 0.8, z: r * 0.5, outline: 0.015 });
  if (h === 'trancas' || h === 'maria') {
    for (const sd of [-1, 1]) {
      if (h === 'maria') {
        part(G.sph(r * 0.28), hm, head, { x: sd * r * 0.95, y: r * 0.3, z: r * 0.2, outline: 0.015 });
        part(G.cap(r * 0.15, r * 0.5), hm, head, { x: sd * r * 1.1, y: -r * 0.2, z: r * 0.25, outline: 0.015 });
      } else for (let k = 0; k < 4; k++) part(G.sph(r * 0.15), hm, head, { x: sd * r * 0.8, y: -r * 0.3 - k * r * 0.25, z: r * 0.25, outline: 0.012 });
    }
  }
}

function buildHat(head, s, r) {
  const t = s.hat?.type;
  if (!t) return;
  const hm = toon(s.hat.color);
  const dome = (rr, th = Math.PI * 0.5) => part(new THREE.SphereGeometry(rr, 26, 14, 0, Math.PI * 2, 0, th), new THREE.MeshToonMaterial({ color: s.hat.color, gradientMap, side: THREE.DoubleSide }), head, { y: r * 0.08, outline: 0 });
  if (t === 'bone' || t === 'bone-tras') {
    dome(r * 1.12, Math.PI * 0.45);
    const brim = part(G.cyl(r * 0.7, r * 0.7, r * 0.06, 22), hm, head, { y: r * 0.45, z: (t === 'bone' ? -1 : 1) * r * 0.95, sz: 0.75, outline: 0.012 });
    brim.rotation.x = (t === 'bone' ? 1 : -1) * 0.15;
    part(G.sph(r * 0.09), toon('#ffffff'), head, { y: r * 1.18, outline: 0 });
  }
  if (t === 'gorro') {
    dome(r * 1.1, Math.PI * 0.5).position.y = r * 0.3;
    const band = part(G.tor(r * 0.98, r * 0.13), toon(shade(s.hat.color, 0.85)), head, { y: r * 0.4, outline: 0.012 });
    band.rotation.x = Math.PI / 2;
    part(G.sph(r * 0.25), toon('#f8fafc'), head, { y: r * 1.42, outline: 0.012 });
  }
  if (t === 'faixa') { const b = part(G.tor(r * 1.03, r * 0.08), hm, head, { y: r * 0.45, outline: 0.01 }); b.rotation.x = Math.PI / 2 + 0.15; }
  if (t === 'chapeu') {
    part(G.cyl(r * 1.7, r * 1.7, r * 0.06, 32), hm, head, { y: r * 0.55, outline: 0.015 });
    part(G.cyl(r * 0.85, r * 1.0, r * 0.6, 24), hm, head, { y: r * 0.85, outline: 0.015 });
    part(G.cyl(r * 1.0, r * 1.01, r * 0.13, 24), toon('#7c2d12'), head, { y: r * 0.62, outline: 0 });
  }
  if (t === 'boina') part(G.sph(r * 1.05), hm, head, { x: r * 0.12, y: r * 0.72, sy: 0.38, outline: 0.015 });
  if (t === 'capacete') {
    dome(r * 1.16, Math.PI * 0.5).position.y = r * 0.3;
    part(G.tor(r * 1.08, r * 0.07), toon(shade(s.hat.color, 0.7)), head, { y: r * 0.36, outline: 0 }).rotation.x = Math.PI / 2;
  }
  if (t === 'chef') {
    part(G.cyl(r * 0.85, r * 0.9, r * 0.45, 22), hm, head, { y: r * 0.95, outline: 0.015 });
    part(G.sph(r * 0.95), hm, head, { y: r * 1.45, sy: 0.75, outline: 0.015 });
  }
}

/**
 * Animações: idle, run, jump, roll, stumble, skate, skatelie, spray, caught, dive, air, wave.
 * k: progresso de 0 a 1 para animações curtas (tropeço, mergulho).
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
    P.skirt.scale.set(1 + a * 0.18, 1 - a * 0.08, 0.85 + a * 0.55);
    P.skirt.rotation.x = (P.thighL.rotation.x + P.thighR.rotation.x) * 0.25;
  }
}

/** Altura total aproximada (para a câmera e etiquetas). */
export const avatarHeight = (style) => (style === 'stumble' ? 1.75 : 1.8);
