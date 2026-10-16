// Surf DBV: trens (metrô de aço e vagão de carga aberto cheio de terra), rampa de metal e moedas.
// Os personagens e skates ficam em ../avatar. Tudo com material "de verdade" (metal, vidro, terra)
// e as peças são criadas uma vez só e reaproveitadas (não trava o jogo quando aparece trem novo).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const cache = new Map();
const once = (k, make) => { if (!cache.has(k)) cache.set(k, make()); return cache.get(k); };
/** Material liso do cenário (mantido com o nome antigo). */
export const toon = (color, extra = {}) => once('m' + color + JSON.stringify(extra), () => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...extra }));
const metal = (color, rough = 0.4, met = 0.7) => once(`metal${color}${rough}${met}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: met }));

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function roundRect(g, x, y, w, h, r, fill) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
  g.closePath(); g.fillStyle = fill; g.fill();
}
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }

export const TRAIN_W = 2.0;
export const TRAIN_BASE = 0.5;
export const TRAIN_BODY = 2.65;
export const TRAIN_H = TRAIN_BASE + TRAIN_BODY + 0.12; // altura do teto (onde dá para correr)

// ───────────── Metrô de aço ─────────────
// cor da faixa, cor da porta
const LIVERY = [['#dc2626', '#facc15'], ['#2563eb', '#f8fafc'], ['#16a34a', '#fde047'], ['#f59e0b', '#1e293b'], ['#7c3aed', '#f8fafc'], ['#0891b2', '#fef08a']];
const GRAFFITI = ['DBV', 'FÉ', 'PAZ', 'VIDA', 'AMOR', 'ALEGRIA', 'AMIGO'];

/** Lateral do metrô: aço escovado com frisos, janelas de vidro escuro, duas portas e a faixa colorida. */
function sideTexture(li, seed, plain) {
  const [band, door] = LIVERY[li];
  return canvasTex(1024, 256, (g, w, h) => {
    // aço escovado
    const steel = g.createLinearGradient(0, 0, 0, h);
    steel.addColorStop(0, '#e5e7eb'); steel.addColorStop(0.45, '#cbd5e1'); steel.addColorStop(1, '#94a3b8');
    g.fillStyle = steel; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 80, 1); }
    // frisos horizontais embaixo (chapa corrugada)
    for (let y = 168; y < h - 10; y += 9) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, y + 3, w, 2); }
    // faixa colorida
    g.fillStyle = band; g.fillRect(0, 140, w, 22);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 140, w, 3);
    // janelas (vidro escuro com reflexo)
    const doors = [w * 0.27, w * 0.73];
    for (let x = 22; x < w - 90; x += 112) {
      if (doors.some((d) => Math.abs(x + 43 - d) < 95)) continue;
      roundRect(g, x - 3, 25, 92, 92, 12, '#475569');
      const gl = g.createLinearGradient(x, 28, x + 86, 112);
      gl.addColorStop(0, '#1e3a5f'); gl.addColorStop(0.5, '#0b1729'); gl.addColorStop(1, '#14263f');
      roundRect(g, x, 28, 86, 86, 10, gl);
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.beginPath(); g.moveTo(x + 8, 110); g.lineTo(x + 34, 32); g.lineTo(x + 52, 32); g.lineTo(x + 26, 110); g.fill();
    }
    // portas
    for (const d of doors) {
      roundRect(g, d - 72, 16, 144, 232, 8, '#64748b');
      roundRect(g, d - 68, 20, 136, 226, 6, shade(door, 0.92));
      for (const s of [-1, 1]) {
        const gl = g.createLinearGradient(d + s * 34 - 24, 34, d + s * 34 + 24, 130);
        gl.addColorStop(0, '#1e3a5f'); gl.addColorStop(1, '#0b1729');
        roundRect(g, d + s * 34 - 24, 34, 48, 100, 8, gl);
      }
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(d - 1, 20, 2, 226);
      g.fillStyle = '#f59e0b'; g.fillRect(d - 68, 236, 136, 6);
    }
    // sujeira embaixo
    const dirt = g.createLinearGradient(0, h - 40, 0, h);
    dirt.addColorStop(0, 'rgba(60,45,30,0)'); dirt.addColorStop(1, 'rgba(60,45,30,.45)');
    g.fillStyle = dirt; g.fillRect(0, h - 40, w, 40);
    if (plain) return;
    // grafite (palavras do bem)
    const word = GRAFFITI[seed % GRAFFITI.length];
    g.save();
    g.translate(120 + (seed * 37) % 300, 228); g.rotate(-0.06);
    g.font = 'bold 70px "Arial Black", Arial';
    g.lineJoin = 'round';
    g.lineWidth = 16; g.strokeStyle = '#111'; g.strokeText(word, 0, 0);
    const tg = g.createLinearGradient(0, -60, 0, 0);
    const pal = [['#f472b6', '#fde047'], ['#22d3ee', '#a3e635'], ['#fb923c', '#facc15'], ['#c084fc', '#60a5fa']][seed % 4];
    tg.addColorStop(0, pal[0]); tg.addColorStop(1, pal[1]);
    g.fillStyle = tg; g.fillText(word, 0, 0);
    g.restore();
  });
}
/** Frente do metrô: para-brisa grande, letreiro aceso, faróis e para-choque. */
function frontTexture(li) {
  const [band] = LIVERY[li];
  return canvasTex(256, 320, (g, w, h) => {
    const steel = g.createLinearGradient(0, 0, w, 0);
    steel.addColorStop(0, '#94a3b8'); steel.addColorStop(0.5, '#e2e8f0'); steel.addColorStop(1, '#94a3b8');
    g.fillStyle = steel; g.fillRect(0, 0, w, h);
    roundRect(g, 18, 14, w - 36, 34, 6, '#111827');
    g.fillStyle = '#fb923c'; g.font = 'bold 24px "Arial Black", Arial'; g.textAlign = 'center'; g.fillText('DBV  EXPRESSO', w / 2, 40);
    roundRect(g, 14, 58, w - 28, 128, 14, '#334155');
    const gl = g.createLinearGradient(18, 62, w - 18, 182);
    gl.addColorStop(0, '#2b4a72'); gl.addColorStop(0.55, '#0b1729'); gl.addColorStop(1, '#1b2f4b');
    roundRect(g, 18, 62, w - 36, 120, 12, gl);
    g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(30, 175); g.lineTo(80, 66); g.lineTo(108, 66); g.lineTo(58, 175); g.fill();
    g.fillStyle = band; g.fillRect(0, 200, w, 26);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 300, w, 20);
  });
}

// Duas versões por cor (com e sem grafite): poucas texturas, para caber na memória do celular
function steelSideMat(li, seed, plain) {
  const v = plain ? 0 : seed % 2;
  return once(`side${li}:${v}`, () => new THREE.MeshStandardMaterial({ map: sideTexture(li, li * 2 + 1, !v), metalness: 0.45, roughness: 0.38 }));
}
/** Cria antes todas as texturas e materiais dos trens (assim nada trava quando aparece um trem novo). */
export function warmTrains() {
  for (let li = 0; li < LIVERY.length; li++) { steelSideMat(li, 0); steelSideMat(li, 1); frontMat(li); }
  for (let k = 0; k < ORE.length; k++) rustMat(k);
  earthMat();
  return [makeTrain(26, 1, true, false, 'metro'), makeTrain(26, 2, true, false, 'carga'), makeRamp(8)];
}
const frontMat = (li) => once(`front${li}`, () => new THREE.MeshStandardMaterial({ map: frontTexture(li), metalness: 0.45, roughness: 0.32 }));
const headLight = () => once('headlight', () => new THREE.MeshBasicMaterial({ color: '#fffbe6' }));
const glowMat = () => once('glowmat', () => new THREE.MeshBasicMaterial({ color: '#fff3c4', map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
let GLOW = null;
function glowTexture() {
  if (GLOW) return GLOW;
  GLOW = canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  });
  return GLOW;
}

// Peças comuns (geometria criada uma vez)
const G = {
  wheel: () => once('g:wheel', () => new THREE.CylinderGeometry(0.3, 0.3, 0.12, 18).rotateZ(Math.PI / 2)),
  axle: () => once('g:axle', () => new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8).rotateZ(Math.PI / 2)),
  bogie: () => once('g:bogie', () => new RoundedBoxGeometry(1.7, 0.26, 2.3, 2, 0.06)),
  spring: () => once('g:spring', () => new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10)),
  box: (w, h, d) => once(`g:box${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
  rbox: (w, h, d, r) => once(`g:rbox${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r)),
  plane: (w, h) => once(`g:plane${w}:${h}`, () => new THREE.PlaneGeometry(w, h)),
  sphere: () => once('g:sph', () => new THREE.SphereGeometry(0.13, 14, 10)),
};
function add(parent, geo, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Truques (as rodas) embaixo do vagão. */
function addBogies(g, z0, carLen) {
  const dark = metal('#1f2937', 0.6, 0.6);
  const wheelM = metal('#4b5563', 0.35, 0.85);
  for (const dz of [carLen / 2 - 1.7, -carLen / 2 + 1.7]) {
    add(g, G.bogie(), dark, 0, 0.42, z0 + dz, false);
    for (const ddz of [-0.75, 0.75]) {
      add(g, G.axle(), dark, 0, 0.3, z0 + dz + ddz, false);
      for (const s of [-1, 1]) add(g, G.wheel(), wheelM, s * 0.72, 0.3, z0 + dz + ddz, false);
    }
    for (const s of [-1, 1]) add(g, G.spring(), metal('#b45309', 0.5, 0.4), s * 0.7, 0.6, z0 + dz, false);
  }
  // caixas embaixo do vagão
  add(g, G.box(TRAIN_W - 0.5, 0.32, carLen - 5.2), dark, 0, 0.5, z0, false);
}

/** Um vagão de metrô (z0 = centro). */
function passengerCar(g, z0, carLen, li, seed, plain, first, moving) {
  const bodyGeo = G.rbox(TRAIN_W, TRAIN_BODY, carLen, 0.2);
  add(g, bodyGeo, metal('#cbd5e1', 0.42, 0.5), 0, TRAIN_BASE + TRAIN_BODY / 2, z0);
  const sideMat = steelSideMat(li, seed, plain);
  for (const s of [-1, 1]) {
    const side = add(g, G.plane(carLen - 0.35, TRAIN_BODY - 0.22), sideMat, s * (TRAIN_W / 2 + 0.006), TRAIN_BASE + TRAIN_BODY / 2, z0, false);
    side.rotation.y = (Math.PI / 2) * s;
  }
  // teto arredondado com ar-condicionado e respiros
  add(g, G.rbox(TRAIN_W - 0.1, 0.18, carLen - 0.2, 0.08), metal('#e2e8f0', 0.45, 0.55), 0, TRAIN_H - 0.09, z0);
  for (const dz of [-carLen * 0.25, carLen * 0.25]) {
    add(g, G.rbox(1.1, 0.24, 2.2, 0.07), metal('#94a3b8', 0.5, 0.6), 0, TRAIN_H + 0.06, z0 + dz, false);
    for (let k = -2; k <= 2; k++) add(g, G.box(0.9, 0.03, 0.06), metal('#334155', 0.6, 0.5), 0, TRAIN_H + 0.19, z0 + dz + k * 0.35, false);
  }
  addBogies(g, z0, carLen);
  if (!first) add(g, G.box(1.3, 2.2, 0.7), toon('#111827', { roughness: 0.95 }), 0, TRAIN_BASE + 1.3, z0 + carLen / 2 + 0.3, false); // sanfona
  if (first) {
    const zf = z0 + carLen / 2;
    const front = add(g, G.plane(TRAIN_W - 0.16, TRAIN_BODY - 0.14), frontMat(li), 0, TRAIN_BASE + TRAIN_BODY / 2, zf + 0.008, false);
    front.receiveShadow = false;
    // para-choque, engate e faróis
    add(g, G.rbox(TRAIN_W - 0.1, 0.34, 0.3, 0.08), metal('#1f2937', 0.5, 0.6), 0, TRAIN_BASE + 0.2, zf + 0.1);
    add(g, G.box(0.28, 0.2, 0.45), metal('#111827', 0.5, 0.7), 0, TRAIN_BASE + 0.02, zf + 0.3, false);
    for (const s of [-1, 1]) {
      const l = add(g, G.sphere(), headLight(), s * 0.62, TRAIN_BASE + 0.62, zf + 0.04, false);
      l.scale.set(1, 0.8, 0.4);
      if (moving) {
        const halo = add(g, G.plane(1.1, 1.1), glowMat(), s * 0.62, TRAIN_BASE + 0.62, zf + 0.12, false);
        halo.renderOrder = 2;
      }
    }
  }
}

// ───────────── Vagão de carga aberto (cheio de terra) ─────────────
const ORE = ['#7c2d12', '#365314', '#334155', '#92400e'];
function rustTexture(color) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = Math.random(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${Math.random() * 0.12})` : `rgba(180,90,40,${Math.random() * 0.14})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 4); }
    // nervuras verticais de reforço
    for (let x = 18; x < w; x += 46) {
      g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x, 0, 4, h);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 4, 0, 5, h);
    }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 10, w, 10);
    // escorrido de ferrugem e terra
    for (let i = 0; i < 26; i++) { const x = Math.random() * w; const gr = g.createLinearGradient(0, 8, 0, 70); gr.addColorStop(0, 'rgba(110,70,35,.5)'); gr.addColorStop(1, 'rgba(110,70,35,0)'); g.fillStyle = gr; g.fillRect(x, 8, 3 + Math.random() * 6, 30 + Math.random() * 50); }
  });
}
const rustMat = (k) => once(`rust${k}`, () => new THREE.MeshStandardMaterial({ map: rustTexture(ORE[k]), metalness: 0.35, roughness: 0.75 }));
const earthMat = () => once('earth', () => {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const v = 60 + Math.random() * 70; g.fillStyle = `rgba(${v + 40},${v + 10},${v - 20},.6)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 2.4, 0, 7); g.fill(); }
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(40,28,18,.6)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 0, 7); g.fill(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 5);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 1, metalness: 0 });
});
/** Monte de terra (mais alto no meio), o topo fica em TRAIN_H para dar para correr por cima. */
function earthGeo(carLen) {
  return once(`g:earth${carLen}`, () => {
    const geo = new THREE.PlaneGeometry(TRAIN_W - 0.14, carLen - 0.3, 10, Math.round(carLen * 2));
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (TRAIN_W / 2 - 0.07);
      const z = p.getZ(i) / (carLen / 2 - 0.15);
      const edge = Math.max(Math.abs(x), Math.abs(z) ** 6);
      const lump = Math.sin(p.getZ(i) * 1.7 + x * 2) * 0.05 + Math.sin(p.getZ(i) * 4.1) * 0.03;
      p.setY(i, -0.28 * edge * edge + (1 - edge) * lump);
    }
    geo.computeVertexNormals();
    return geo;
  });
}
function freightCar(g, z0, carLen, k) {
  const wallH = 2.1;
  const wallY = TRAIN_H - 0.18 - wallH / 2;
  const rust = rustMat(k);
  // chassi e piso
  add(g, G.box(TRAIN_W, 0.3, carLen), metal('#1f2937', 0.6, 0.5), 0, TRAIN_BASE + 0.4, z0);
  // paredes (laterais e cabeceiras) com a borda de cima reforçada
  for (const s of [-1, 1]) {
    add(g, G.box(0.08, wallH, carLen), rust, s * (TRAIN_W / 2 - 0.04), wallY, z0);
    add(g, G.box(0.16, 0.12, carLen), metal('#292524', 0.6, 0.6), s * (TRAIN_W / 2 - 0.04), TRAIN_H - 0.17, z0, false);
    add(g, G.box(TRAIN_W, wallH, 0.08), rust, 0, wallY, z0 + s * (carLen / 2 - 0.04));
    // escadinha na ponta
    for (let r = 0; r < 4; r++) add(g, G.box(0.5, 0.04, 0.04), metal('#facc15', 0.5, 0.4), s * (TRAIN_W / 2 + 0.03), TRAIN_BASE + 0.8 + r * 0.5, z0 + carLen / 2 - 0.6, false);
  }
  // a terra
  const e = add(g, earthGeo(carLen), earthMat(), 0, TRAIN_H, z0, false);
  e.receiveShadow = true;
  addBogies(g, z0, carLen);
  add(g, G.box(0.3, 0.25, 0.8), metal('#111827', 0.5, 0.6), 0, TRAIN_BASE + 0.25, z0 + carLen / 2 + 0.3, false); // engate
}

/**
 * Trem com um ou mais vagões; z = 0 é a frente (lado do jogador), cresce para trás (-z).
 * kind: 'metro' ou 'carga'. Devolve o grupo; em userData.edges ficam as beiradas de onde cai terra.
 */
export function makeTrain(len, seed = 0, moving = false, plain = false, kind = 'metro') {
  const g = new THREE.Group();
  const cars = Math.max(1, Math.round(len / 13));
  const carLen = Math.round(((len - (cars - 1) * 0.6) / cars) * 10) / 10;
  const li = seed % LIVERY.length;
  const edges = [];
  for (let i = 0; i < cars; i++) {
    const z0 = -i * (carLen + 0.6) - carLen / 2;
    if (kind === 'carga') {
      // cada vagão de terra de uma cor
      freightCar(g, z0, carLen, (seed + i) % ORE.length);
      edges.push([z0 + carLen / 2, z0 - carLen / 2]);
    } else passengerCar(g, z0, carLen, li, seed + i, plain, i === 0, moving);
  }
  if (kind === 'carga') {
    // frente do primeiro vagão com faróis (para ver o trem vindo)
    for (const s of [-1, 1]) {
      add(g, G.sphere(), headLight(), s * 0.62, TRAIN_BASE + 0.7, 0.04, false).scale.set(1, 0.8, 0.4);
      if (moving) add(g, G.plane(1.1, 1.1), glowMat(), s * 0.62, TRAIN_BASE + 0.7, 0.12, false).renderOrder = 2;
    }
  }
  g.userData.edges = edges;
  return g;
}

// ───────────── Rampa de metal (sobe até o teto do trem) ─────────────
function plateTexture() {
  return once('t:plate', () => {
    const t = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#9ca3af'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 6, 1); }
      // chapa xadrez (antiderrapante)
      for (let y = 8; y < h; y += 24) for (let x = (y / 24) % 2 ? 20 : 8; x < w; x += 24) {
        g.save(); g.translate(x, y); g.rotate((((x + y) / 24) % 2 ? 1 : -1) * 0.7);
        g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-7, -2, 14, 2);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-7, 0, 14, 2);
        g.restore();
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 4);
    return t;
  });
}
function hazardTexture() {
  return once('t:hazard', () => {
    const t = canvasTex(256, 32, (g, w, h) => {
      g.fillStyle = '#facc15'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#111827';
      for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); }
    });
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(4, 1);
    return t;
  });
}
/** Rampa com chapa antiderrapante, bordas zebradas, corrimão e pés de apoio. z = 0 é o começo (embaixo). */
export function makeRamp(len, height = TRAIN_H) {
  const g = new THREE.Group();
  const W = 1.95;
  const slope = Math.hypot(len, height);
  const ang = Math.atan2(height, len);
  const plateM = once('m:plate', () => new THREE.MeshStandardMaterial({ map: plateTexture(), metalness: 0.75, roughness: 0.42 }));
  const hazM = once('m:haz', () => new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6 }));
  const frame = metal('#374151', 0.5, 0.7);
  const tilt = new THREE.Group();
  tilt.rotation.x = ang; // sobe para -z
  tilt.position.set(0, 0, 0);
  g.add(tilt);
  // chapa (topo exatamente na linha da subida)
  add(tilt, G.box(W, 0.1, slope), plateM, 0, -0.05, -slope / 2);
  for (const s of [-1, 1]) {
    add(tilt, G.box(0.1, 0.22, slope), hazM, s * (W / 2 + 0.03), 0.02, -slope / 2);
    // corrimão
    add(tilt, G.box(0.05, 0.05, slope), metal('#e5e7eb', 0.3, 0.9), s * (W / 2 + 0.05), 0.75, -slope / 2, false);
    for (let k = 0.6; k < slope; k += 1.8) add(tilt, G.box(0.04, 0.75, 0.04), metal('#e5e7eb', 0.3, 0.9), s * (W / 2 + 0.05), 0.38, -k, false);
  }
  // pés de apoio
  for (let k = 1.6; k < len; k += 2) {
    const h = (k / len) * height;
    for (const s of [-1, 1]) add(g, G.box(0.12, 1, 0.12), frame, s * (W / 2 - 0.15), h / 2, -k, true).scale.y = h;
    add(g, G.box(W - 0.2, 0.08, 0.08), frame, 0, h * 0.5, -k, false);
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
    // Moeda dourada brilhante com o símbolo dos Desbravadores
    const face = new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.45, roughness: 0.3, emissive: '#ffb300', emissiveMap: tex, emissiveIntensity: 0.35 });
    coinParts = {
      faceGeo: new THREE.CircleGeometry(0.44, 32), face,
      rimGeo: new THREE.CylinderGeometry(0.44, 0.44, 0.1, 32, 1, true),
      rim: new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.75, roughness: 0.25, emissive: '#a16207', emissiveIntensity: 0.45 }),
    };
  }
  const g = new THREE.Group();
  const front = new THREE.Mesh(coinParts.faceGeo, coinParts.face);
  front.position.z = 0.051;
  const back = new THREE.Mesh(coinParts.faceGeo, coinParts.face);
  back.position.z = -0.051;
  back.rotation.y = Math.PI; // o verso também fica de pé, não de cabeça para baixo
  const rim = new THREE.Mesh(coinParts.rimGeo, coinParts.rim);
  rim.rotation.x = Math.PI / 2;
  g.add(front, back, rim);
  return g;
}

/** Lata de spray (fica na mão do personagem). Bico para +y. */
export function makeSprayCan() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(once('g:can', () => new THREE.CylinderGeometry(0.035, 0.035, 0.16, 16)), once('m:can', () => new THREE.MeshStandardMaterial({ color: '#dc2626', metalness: 0.6, roughness: 0.3 })));
  const label = new THREE.Mesh(once('g:canl', () => new THREE.CylinderGeometry(0.0355, 0.0355, 0.06, 16)), once('m:canl', () => new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.3, roughness: 0.4 })));
  const top = new THREE.Mesh(once('g:cant', () => new THREE.SphereGeometry(0.035, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), metal('#e5e7eb', 0.25, 0.9));
  top.position.y = 0.08;
  const cap = new THREE.Mesh(once('g:canc', () => new THREE.CylinderGeometry(0.014, 0.016, 0.03, 10)), toon('#111827'));
  cap.position.y = 0.118;
  g.add(body, label, top, cap);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.nozzle = cap;
  return g;
}

