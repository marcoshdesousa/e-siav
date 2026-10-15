// Surf DBV: trens e moedas (os personagens e skates ficam em ../avatar).
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
const sph = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent?.add(m);
  return m;
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
