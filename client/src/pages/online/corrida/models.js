// Corrida DBV: personagens arredondados (estilo desenho animado), trens, moedas e skate.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// ───────────── Materiais "desenho" ─────────────
const grad = (() => {
  const c = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(c, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const cache = new Map();
export const toon = (color, extra = {}) => {
  const k = color + JSON.stringify(extra);
  if (!cache.has(k)) cache.set(k, new THREE.MeshToonMaterial({ color, gradientMap: grad, ...extra }));
  return cache.get(k);
};
const cap = (r, len, seg = 12) => new THREE.CapsuleGeometry(r, len, 6, seg);
const sph = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent?.add(m);
  return m;
}

// ───────────── Personagens ─────────────
const SKIN = { claro: '#f6c9a0', medio: '#d79a6b', escuro: '#9a6440' };

/**
 * Desbravador(a) com o uniforme (camisa caqui com insígnias, lenço amarelo com anel, bermuda/saia
 * verde) ou o guarda. Tudo arredondado. As juntas (ombro, cotovelo, quadril, joelho) animam a corrida.
 */
export function makeRunner({ female = false, officer = false } = {}) {
  const root = new THREE.Group();
  const P = {};
  const skin = toon(officer ? SKIN.medio : female ? SKIN.claro : SKIN.medio);
  const shirt = toon(officer ? '#1e3a8a' : '#c9a66b');
  const pants = toon(officer ? '#172554' : '#1f4d33');
  const shoe = toon(officer ? '#111827' : '#f8fafc');
  const sole = toon(officer ? '#000000' : '#ef4444');
  const hairM = toon(female ? '#3b2314' : '#2a1a10');

  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);
  P.hips = hips;
  // Quadril / bermuda ou saia
  if (female && !officer) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.42, 18), pants);
    skirt.position.y = -0.12;
    skirt.castShadow = true;
    hips.add(skirt);
  } else {
    const pel = mesh(sph(0.2), pants, 0, -0.02, 0, hips);
    pel.scale.set(1.15, 0.8, 0.9);
  }
  // Pernas
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(0.11 * s, -0.06, 0);
    hips.add(thigh);
    const legMat = female && !officer ? skin : officer ? pants : skin;
    // bermuda cobre a coxa (menino); calça inteira (guarda)
    mesh(cap(0.085, 0.3), officer || !female ? pants : skin, 0, -0.2, 0, thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    thigh.add(knee);
    mesh(cap(0.072, 0.3), officer ? pants : legMat, 0, -0.19, 0, knee);
    if (!officer) mesh(cap(0.078, 0.06), toon('#f1f5f9'), 0, -0.3, 0, knee); // meia
    const foot = new THREE.Group();
    foot.position.y = -0.42;
    knee.add(foot);
    const s1 = mesh(cap(0.08, 0.14), shoe, 0, -0.02, -0.05, foot);
    s1.rotation.x = Math.PI / 2;
    const s2 = mesh(new THREE.BoxGeometry(0.15, 0.04, 0.3), sole, 0, -0.08, -0.05, foot);
    s2.castShadow = false;
    P[s < 0 ? 'thighL' : 'thighR'] = thigh;
    P[s < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  // Tronco
  const torso = new THREE.Group();
  torso.position.y = 0.0;
  hips.add(torso);
  P.torso = torso;
  const chest = mesh(cap(0.21, 0.26, 16), shirt, 0, 0.3, 0, torso);
  chest.scale.set(1.12, 1, 0.82);
  if (officer) {
    const belly = mesh(sph(0.24), shirt, 0, 0.2, -0.06, torso);
    belly.scale.set(1.05, 0.9, 1);
    const badge = mesh(new THREE.CircleGeometry(0.045, 6), toon('#facc15'), -0.1, 0.42, -0.19, torso);
    badge.castShadow = false;
    mesh(new THREE.TorusGeometry(0.21, 0.025, 6, 20), toon('#111827'), 0, 0.08, 0, torso).rotation.x = Math.PI / 2;
  } else {
    // Cinto, bolsos e insígnias nas mangas
    mesh(new THREE.TorusGeometry(0.205, 0.022, 6, 22), toon('#111111'), 0, 0.06, 0, torso).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      const pocket = mesh(new THREE.BoxGeometry(0.08, 0.07, 0.01), toon('#b38f55'), 0.09 * s, 0.38, -0.175, torso);
      pocket.castShadow = false;
    }
    // Lenço amarelo: volta no pescoço, triângulo nas costas e o anel na frente
    mesh(new THREE.TorusGeometry(0.105, 0.035, 8, 20), toon('#facc15'), 0, 0.56, 0, torso).rotation.x = Math.PI / 2;
    const tri = mesh(new THREE.ConeGeometry(0.15, 0.3, 3), toon('#facc15'), 0, 0.42, 0.15, torso);
    tri.rotation.x = Math.PI;
    tri.scale.z = 0.3;
    mesh(new THREE.TorusGeometry(0.03, 0.012, 6, 12), toon('#7c4a1e'), 0, 0.48, -0.17, torso);
    for (const s of [-1, 1]) { const e = mesh(cap(0.025, 0.12), toon('#facc15'), 0.03 * s, 0.38, -0.18, torso); e.rotation.z = 0.2 * s; }
  }
  // Braços
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(0.26 * s, 0.5, 0);
    torso.add(sh);
    mesh(cap(0.07, 0.2), shirt, 0, -0.12, 0, sh); // manga
    if (!officer) { const patch = mesh(new THREE.CircleGeometry(0.04, 12), toon('#dc2626'), 0.075 * s, -0.08, 0, sh); patch.rotation.y = (Math.PI / 2) * s; patch.castShadow = false; }
    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    sh.add(elbow);
    mesh(cap(0.058, 0.2), officer ? shirt : skin, 0, -0.12, 0, elbow);
    mesh(sph(0.068), skin, 0, -0.27, 0, elbow);
    P[s < 0 ? 'armL' : 'armR'] = sh;
    P[s < 0 ? 'elbowL' : 'elbowR'] = elbow;
  }
  // Cabeça
  const head = new THREE.Group();
  head.position.y = 0.72;
  torso.add(head);
  P.head = head;
  mesh(cap(0.05, 0.08), skin, 0, -0.08, 0, head); // pescoço
  const skull = mesh(sph(0.2, 24, 18), skin, 0, 0.12, 0, head);
  skull.scale.set(1, 1.06, 1);
  for (const s of [-1, 1]) {
    mesh(sph(0.045), skin, 0.195 * s, 0.11, 0.01, head); // orelhas
    const eye = mesh(sph(0.045), toon('#ffffff'), 0.075 * s, 0.14, -0.17, head);
    eye.scale.set(0.85, 1.15, 0.5);
    mesh(sph(0.026), toon('#1f2937'), 0.075 * s, 0.135, -0.195, head);
    mesh(sph(0.009), toon('#ffffff'), 0.068 * s, 0.15, -0.21, head);
    const brow = mesh(cap(0.012, 0.05), hairM, 0.078 * s, 0.215, -0.17, head);
    brow.rotation.z = Math.PI / 2 + 0.15 * s;
  }
  mesh(sph(0.03), toon(officer ? '#c98a5e' : '#e9a37c'), 0, 0.085, -0.2, head); // nariz
  const smile = mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI), toon('#7f1d1d'), 0, 0.04, -0.185, head);
  smile.rotation.z = Math.PI;
  if (officer) {
    const mus = mesh(cap(0.025, 0.1), toon('#3b2314'), 0, 0.055, -0.19, head);
    mus.rotation.z = Math.PI / 2;
    const hat = mesh(new THREE.CylinderGeometry(0.21, 0.2, 0.12, 20), toon('#172554'), 0, 0.3, 0, head);
    hat.rotation.x = -0.1;
    mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20, 1, false, 0, Math.PI), toon('#111827'), 0, 0.25, -0.08, head).rotation.y = Math.PI / 2;
    mesh(new THREE.CircleGeometry(0.035, 6), toon('#facc15'), 0, 0.31, -0.2, head);
  } else if (female) {
    // Cabelo comprido preso num rabo de cavalo, com franja
    const top = mesh(sph(0.215, 24, 16, 0), hairM, 0, 0.15, 0.02, head);
    top.scale.set(1.02, 1.0, 1.05);
    const bang = mesh(cap(0.06, 0.18), hairM, 0, 0.26, -0.15, head);
    bang.rotation.z = Math.PI / 2;
    const tie = mesh(new THREE.TorusGeometry(0.04, 0.015, 6, 12), toon('#dc2626'), 0, 0.2, 0.2, head);
    tie.rotation.x = 0.4;
    const tail = new THREE.Group();
    tail.position.set(0, 0.2, 0.22);
    head.add(tail);
    mesh(cap(0.06, 0.26), hairM, 0, -0.16, 0.03, tail);
    P.tail = tail;
    // Chapéu de desbravadora (boina)
    const beret = mesh(sph(0.2, 18, 10), toon('#14532d'), 0.04, 0.29, 0, head);
    beret.scale.set(1.05, 0.35, 1.05);
  } else {
    // Cabelo curto e boné virado para trás
    const hr = mesh(sph(0.208, 24, 16), hairM, 0, 0.15, 0.015, head);
    hr.scale.set(1.02, 0.98, 1.04);
    const capTop = mesh(new THREE.SphereGeometry(0.215, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#15803d'), 0, 0.19, 0, head);
    capTop.rotation.x = -0.12;
    const brim = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 18, 1, false, 0, Math.PI), toon('#14532d'), 0, 0.2, 0.17, head);
    brim.rotation.y = -Math.PI / 2;
    mesh(new THREE.CircleGeometry(0.05, 3), toon('#facc15'), 0, 0.28, -0.19, head).rotation.x = -0.4;
  }
  // Uma lata de spray na mão direita (só aparece na abertura)
  const can = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.15, 12), toon('#f97316'), 0, 0, 0, can);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), toon('#111111'), 0, 0.09, 0, can);
  can.position.set(0, -0.3, -0.03);
  can.visible = false;
  P.elbowR.add(can);
  P.can = can;
  root.userData.P = P;
  return root;
}

/** Poses e animações: run, jump, roll, stumble, skate, idle, spray, caught. */
export function pose(model, state, t, k = 0) {
  const P = model.userData.P;
  const w = 13;
  const s = Math.sin(t * w);
  const c = Math.cos(t * w);
  P.can.visible = state === 'spray';
  P.hips.rotation.set(0, 0, 0);
  P.torso.rotation.set(0, 0, 0);
  P.head.rotation.set(0, 0, 0);
  P.hips.position.y = 0.92;
  const legs = (a, b, ka, kb) => { P.thighL.rotation.x = a; P.thighR.rotation.x = b; P.kneeL.rotation.x = ka; P.kneeR.rotation.x = kb; };
  const arms = (a, b, ea, eb, za = 0.12, zb = -0.12) => { P.armL.rotation.set(a, 0, za); P.armR.rotation.set(b, 0, zb); P.elbowL.rotation.x = ea; P.elbowR.rotation.x = eb; };
  if (P.tail) P.tail.rotation.x = 0.4;
  switch (state) {
    case 'run':
      legs(s * 0.95, -s * 0.95, -Math.max(0, -s) * 1.5 - 0.2, -Math.max(0, s) * 1.5 - 0.2);
      arms(-s * 0.9, s * 0.9, 1.3, 1.3);
      P.hips.position.y = 0.92 + Math.abs(c) * 0.06;
      P.torso.rotation.x = -0.18;
      P.torso.rotation.y = s * 0.12;
      if (P.tail) P.tail.rotation.x = 0.5 + Math.abs(s) * 0.5;
      break;
    case 'jump':
      legs(0.9, -0.3, -1.6, -0.6);
      arms(-2.4, 0.6, 0.3, 1.2, 0.5, -0.3);
      P.torso.rotation.x = -0.1;
      if (P.tail) P.tail.rotation.x = 1.4;
      break;
    case 'roll':
      P.hips.position.y = 0.45;
      P.hips.rotation.x = -t * 14;
      legs(1.6, 1.6, -2.2, -2.2);
      arms(1.2, 1.2, 1.4, 1.4);
      break;
    case 'stumble': {
      // Tropeçou: corpo vai para frente e os braços balançam
      const f = Math.sin(k * Math.PI);
      legs(-0.4 + s * 0.3, 0.6, -0.8, -0.4);
      arms(-2.6 + Math.sin(t * 25) * 0.6, -2.2 + Math.cos(t * 25) * 0.6, 0.4, 0.4, 0.8, -0.8);
      P.torso.rotation.x = -0.7 * f;
      P.hips.position.y = 0.92 - f * 0.15;
      break;
    }
    case 'skate':
      legs(0.35, -0.45, -0.7, -0.6);
      arms(-0.3, 0.4, 0.4, 0.3, 1.0, -1.0);
      P.hips.position.y = 0.82 + Math.sin(t * 4) * 0.02;
      P.hips.rotation.y = 0.5;
      P.torso.rotation.y = -0.35;
      P.torso.rotation.x = -0.15;
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
    default: // idle
      legs(0, 0, -0.05, -0.05);
      arms(Math.sin(t * 2) * 0.05, -Math.sin(t * 2) * 0.05, 0.25, 0.25);
      P.hips.position.y = 0.92 + Math.sin(t * 2) * 0.01;
  }
}

// ───────────── Trens ─────────────
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const GRAFFITI = ['DBV', 'FÉ', 'PAZ', 'VIDA', 'SALVA', 'ALEGRIA', 'AMIGO'];
function sideTexture(color, stripe, seed, plain = false) {
  return canvasTex(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, color); gr.addColorStop(1, shade(color, 0.75));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = stripe; g.fillRect(0, h * 0.7, w, h * 0.07);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, h * 0.68, w, 4);
    // janelas
    for (let x = 40; x < w - 60; x += 120) {
      if (Math.abs(x - w / 2) < 90) continue;
      roundRect(g, x, 30, 86, 80, 14, '#0f2344');
      const rg = g.createLinearGradient(x, 30, x + 86, 110);
      rg.addColorStop(0, 'rgba(255,255,255,.35)'); rg.addColorStop(0.4, 'rgba(255,255,255,0)');
      roundRect(g, x + 4, 34, 78, 72, 11, rg);
    }
    // portas
    roundRect(g, w / 2 - 70, 26, 140, 200, 10, shade(color, 0.6));
    roundRect(g, w / 2 - 62, 36, 58, 100, 8, '#0f2344');
    roundRect(g, w / 2 + 4, 36, 58, 100, 8, '#0f2344');
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(w / 2 - 1, 26, 2, 200);
    // grafite colorido (palavras do bem)
    if (plain) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 26, w, 26); return; }
    const word = GRAFFITI[seed % GRAFFITI.length];
    const gx = 120 + (seed * 37) % 520;
    g.save();
    g.translate(gx, 190); g.rotate(-0.08);
    g.font = 'bold 62px "Arial Black", Arial';
    g.lineJoin = 'round';
    g.lineWidth = 14; g.strokeStyle = '#111';
    g.strokeText(word, 0, 0);
    const tg = g.createLinearGradient(0, -50, 0, 0);
    const pal = [['#f472b6', '#fde047'], ['#22d3ee', '#a3e635'], ['#fb923c', '#facc15'], ['#c084fc', '#60a5fa']][seed % 4];
    tg.addColorStop(0, pal[0]); tg.addColorStop(1, pal[1]);
    g.fillStyle = tg; g.fillText(word, 0, 0);
    g.restore();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 26, w, 26);
  });
}
function frontTexture(color, stripe) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    roundRect(g, 26, 22, w - 52, 100, 18, '#0f2344');
    const rg = g.createLinearGradient(26, 22, w, 122);
    rg.addColorStop(0, 'rgba(255,255,255,.4)'); rg.addColorStop(0.35, 'rgba(255,255,255,0)');
    roundRect(g, 30, 26, w - 60, 92, 15, rg);
    g.fillStyle = stripe; g.fillRect(0, 150, w, 18);
    for (const x of [52, w - 52]) { g.fillStyle = '#fef9c3'; g.beginPath(); g.arc(x, 200, 18, 0, 7); g.fill(); g.strokeStyle = '#94a3b8'; g.lineWidth = 5; g.stroke(); }
    roundRect(g, w / 2 - 34, 186, 68, 34, 6, '#1f2937');
    g.fillStyle = '#facc15'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillText('DBV', w / 2, 210);
  });
}
function roundRect(g, x, y, w, h, r, fill) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath(); g.fillStyle = fill; g.fill();
}
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }

const PALETTES = [['#e11d48', '#fde047'], ['#2563eb', '#f8fafc'], ['#16a34a', '#fde047'], ['#f59e0b', '#1e293b'], ['#7c3aed', '#f8fafc'], ['#0891b2', '#fef08a']];
const texCache = new Map();
function trainMats(pi, seed, plain = false) {
  const key = `${pi}:${seed % 7}:${plain}`;
  if (!texCache.has(key)) {
    const [c, s] = PALETTES[pi];
    texCache.set(key, {
      side: new THREE.MeshToonMaterial({ map: sideTexture(c, s, seed % 7, plain), gradientMap: grad }),
      front: new THREE.MeshToonMaterial({ map: frontTexture(c, s), gradientMap: grad }),
      body: toon(c),
    });
  }
  return texCache.get(key);
}

export const TRAIN_W = 2.0;
export const TRAIN_BASE = 0.5;
export const TRAIN_BODY = 2.65;
export const TRAIN_H = TRAIN_BASE + TRAIN_BODY + 0.12; // altura do teto (onde dá para correr)

/** Trem com um ou mais vagões; z = 0 é a frente (lado do jogador), cresce para trás (-z). */
export function makeTrain(len, seed = 0, moving = false, plain = false) {
  const g = new THREE.Group();
  const pi = seed % PALETTES.length;
  const cars = Math.max(1, Math.round(len / 13));
  const carLen = (len - (cars - 1) * 0.6) / cars;
  const bodyGeo = new RoundedBoxGeometry(TRAIN_W, TRAIN_BODY, carLen, 3, 0.16);
  for (let i = 0; i < cars; i++) {
    const m = trainMats(pi, seed + i, plain);
    const z0 = -i * (carLen + 0.6) - carLen / 2;
    const body = mesh(bodyGeo, m.body, 0, TRAIN_BASE + TRAIN_BODY / 2, z0, g);
    body.receiveShadow = true;
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(carLen - 0.3, TRAIN_BODY - 0.25), m.side);
      side.position.set(s * (TRAIN_W / 2 + 0.004), TRAIN_BASE + TRAIN_BODY / 2, z0);
      side.rotation.y = (Math.PI / 2) * s;
      g.add(side);
    }
    // Teto com o ar-condicionado
    const roof = mesh(new RoundedBoxGeometry(TRAIN_W - 0.15, 0.16, carLen - 0.3, 2, 0.06), toon('#cbd5e1'), 0, TRAIN_H - 0.08, z0, g);
    roof.receiveShadow = true;
    mesh(new RoundedBoxGeometry(0.9, 0.22, 1.6, 2, 0.06), toon('#94a3b8'), 0, TRAIN_H + 0.05, z0, g).castShadow = false;
    // Rodas e truques
    mesh(new THREE.BoxGeometry(TRAIN_W - 0.4, 0.3, carLen - 1), toon('#1f2937'), 0, 0.38, z0, g).castShadow = false;
    for (const dz of [carLen / 2 - 1.2, -carLen / 2 + 1.2]) for (const s of [-1, 1]) for (const ddz of [-0.45, 0.45]) {
      const wheel = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 16), toon('#374151'), s * 0.72, 0.28, z0 + dz + ddz, g);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = false;
    }
    if (i > 0) mesh(new THREE.BoxGeometry(0.3, 0.25, 0.8), toon('#111827'), 0, 0.7, z0 + carLen / 2 + 0.3, g).castShadow = false;
    if (i === 0) {
      const front = new THREE.Mesh(new THREE.PlaneGeometry(TRAIN_W - 0.2, TRAIN_BODY - 0.2), m.front);
      front.position.set(0, TRAIN_BASE + TRAIN_BODY / 2, 0.005);
      g.add(front);
      if (moving) {
        for (const s of [-1, 1]) {
          const l = new THREE.Mesh(sph(0.12), new THREE.MeshBasicMaterial({ color: '#fef9c3' }));
          l.position.set(s * 0.6, TRAIN_BASE + 0.55, 0.06);
          g.add(l);
        }
      }
    }
  }
  return g;
}

// ───────────── Moeda (frente e verso certinhos) ─────────────
let coinParts = null;
export function makeCoin() {
  if (!coinParts) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(100, 90, 20, 128, 128, 128);
    gr.addColorStop(0, '#fff7c2'); gr.addColorStop(0.55, '#fbbf24'); gr.addColorStop(1, '#b45309');
    x.fillStyle = gr; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
    x.strokeStyle = '#a16207'; x.lineWidth = 10; x.beginPath(); x.arc(128, 128, 108, 0, 7); x.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => { x.drawImage(img, 62, 56, 132, 132); tex.needsUpdate = true; };
    img.src = '/marca/logo.svg?v=4';
    const face = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    coinParts = {
      faceGeo: new THREE.CircleGeometry(0.4, 28), face,
      rimGeo: new THREE.CylinderGeometry(0.4, 0.4, 0.08, 28, 1, true),
      rim: new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.6, roughness: 0.3, emissive: '#7c4a03', emissiveIntensity: 0.4 }),
    };
  }
  const g = new THREE.Group();
  const front = new THREE.Mesh(coinParts.faceGeo, coinParts.face);
  front.position.z = 0.041;
  const back = new THREE.Mesh(coinParts.faceGeo, coinParts.face);
  back.position.z = -0.041;
  back.rotation.y = Math.PI; // o verso também fica de pé, não de cabeça para baixo
  const rim = new THREE.Mesh(coinParts.rimGeo, coinParts.rim);
  rim.rotation.x = Math.PI / 2;
  g.add(front, back, rim);
  return g;
}

// ───────────── Skate ─────────────
export function makeSkate() {
  const g = new THREE.Group();
  const deck = mesh(new RoundedBoxGeometry(0.42, 0.06, 1.15, 3, 0.03), toon('#1d4ed8'), 0, 0, 0, g);
  deck.castShadow = true;
  mesh(new RoundedBoxGeometry(0.36, 0.02, 1.0, 2, 0.01), toon('#facc15'), 0, 0.035, 0, g);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.45 }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.12;
  glow.scale.set(0.6, 1.3, 1);
  g.add(glow);
  for (const z of [-0.38, 0.38]) for (const s of [-1, 1]) {
    const w = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), toon('#f8fafc'), s * 0.15, -0.06, z, g);
    w.rotation.z = Math.PI / 2;
  }
  g.userData.glow = glow;
  return g;
}
