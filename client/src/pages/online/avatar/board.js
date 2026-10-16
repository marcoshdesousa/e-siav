// Skates do Surf DBV: shape com bico e rabeta levantados, lixa estampada, rodas com brilho
// e luz por baixo. Comprimento no eixo z (bico para -z).
import * as THREE from 'three';
import { toon } from './build.js';

const W = 0.44;
const L = 1.3;
const texCache = new Map();

function deckTexture(b) {
  if (texCache.has(b.id)) return texCache.get(b.id);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 768;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 768);
  grad.addColorStop(0, b.c1); grad.addColorStop(1, b.pattern === 'degrade' ? b.c2 : b.c1);
  g.fillStyle = grad; g.fillRect(0, 0, 256, 768);
  g.fillStyle = b.c2; g.strokeStyle = b.c2;
  const star = (x, y, r) => { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5; const rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
  switch (b.pattern) {
    case 'listras': for (let x = -256; x < 512; x += 64) { g.beginPath(); g.moveTo(x, 768); g.lineTo(x + 30, 768); g.lineTo(x + 286, 0); g.lineTo(x + 256, 0); g.fill(); } break;
    case 'chamas':
      for (let k = 0; k < 7; k++) { const x = 18 + k * 37; g.beginPath(); g.moveTo(x - 30, 768); g.quadraticCurveTo(x - 30, 520, x, 330 + (k % 3) * 60); g.quadraticCurveTo(x + 30, 520, x + 30, 768); g.fill(); }
      g.fillStyle = b.glow; for (let k = 0; k < 7; k++) { const x = 18 + k * 37; g.beginPath(); g.moveTo(x - 15, 768); g.quadraticCurveTo(x - 15, 620, x, 520 + (k % 2) * 50); g.quadraticCurveTo(x + 15, 620, x + 15, 768); g.fill(); }
      break;
    case 'estrelas': for (let k = 0; k < 14; k++) star((k * 83) % 220 + 18, 50 + k * 50, 14 + (k % 3) * 8); break;
    case 'ondas': g.lineWidth = 16; for (let y = 60; y < 768; y += 70) { g.beginPath(); for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 26 + y) * 14); g.stroke(); } break;
    case 'xadrez': for (let y = 0; y < 768; y += 48) for (let x = 0; x < 256; x += 48) if (((x + y) / 48) % 2 === 0) g.fillRect(x, y, 48, 48); break;
    case 'bolinhas': for (let y = 30; y < 768; y += 56) for (let x = ((y / 56) % 2) * 28 + 20; x < 256; x += 56) { g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); } break;
    case 'raio':
      g.beginPath(); g.moveTo(150, 60); g.lineTo(60, 420); g.lineTo(130, 400); g.lineTo(90, 710); g.lineTo(200, 330); g.lineTo(130, 350); g.closePath(); g.fill();
      g.strokeStyle = b.glow; g.lineWidth = 8; g.stroke();
      break;
    case 'logo': {
      g.lineWidth = 18;
      g.beginPath(); g.moveTo(40, 230); g.lineTo(216, 230); g.lineTo(128, 520); g.closePath(); g.fill();
      g.fillStyle = b.c1; g.beginPath(); g.moveTo(84, 262); g.lineTo(172, 262); g.lineTo(128, 410); g.closePath(); g.fill();
      g.font = 'bold 54px "Arial Black", Arial'; g.textAlign = 'center'; g.fillStyle = b.c2; g.fillText('DBV', 128, 620);
      break;
    }
    case 'galaxia':
      for (let k = 0; k < 6; k++) { const rg = g.createRadialGradient(128, 80 + k * 130, 5, 128, 80 + k * 130, 120); rg.addColorStop(0, b.c2); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 256, 768); }
      g.fillStyle = '#ffffff'; for (let k = 0; k < 70; k++) { g.beginPath(); g.arc((k * 97) % 256, (k * 211) % 768, (k % 3) + 1, 0, 7); g.fill(); }
      break;
    case 'degrade': g.globalAlpha = 0.35; for (let y = 0; y < 768; y += 96) g.fillRect(0, y, 256, 30); g.globalAlpha = 1; break;
    default: g.fillRect(0, 300, 256, 168);
  }
  // Faixas laterais (borda colorida) e parafusos
  g.fillStyle = b.glow; g.fillRect(0, 0, 14, 768); g.fillRect(242, 0, 14, 768);
  g.fillStyle = 'rgba(0,0,0,.55)';
  for (const y of [170, 598]) for (const x of [96, 160]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(b.id, t);
  return t;
}

function deckGeometry() {
  const r = W / 2;
  const h = L / 2 - r;
  const s = new THREE.Shape();
  s.moveTo(-r, -h);
  s.lineTo(-r, h);
  s.absarc(0, h, r, Math.PI, 0, true);
  s.lineTo(r, -h);
  s.absarc(0, -h, r, 0, Math.PI, true);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 18 });
  // Shape no plano XY → deita no XZ (y vira -z, o bico fica para -z)
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.045, 0);
  // Levanta bico e rabeta
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const e = Math.max(0, Math.abs(z) - L * 0.3);
    p.setY(i, p.getY(i) + e * e * 1.6);
  }
  geo.computeVertexNormals();
  return geo;
}
let DECK = null;

/** Lateral do shape: as lâminas de madeira coladas (maple), como num skate de verdade. */
let PLY = null;
function plyMat() {
  if (PLY) return PLY;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 32;
  const g = c.getContext('2d');
  const cols = ['#e7c9a0', '#b9875a', '#e7c9a0', '#2563eb', '#e7c9a0', '#b9875a', '#e7c9a0'];
  cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, (i * 32) / cols.length, 64, 32 / cols.length + 1); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  PLY = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  return PLY;
}
const metalM = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.28 });
const darkM = new THREE.MeshStandardMaterial({ color: '#1f2937', metalness: 0.6, roughness: 0.45 });
const truckGeo = {
  base: new THREE.BoxGeometry(0.16, 0.025, 0.11),
  hanger: new THREE.CylinderGeometry(0.035, 0.03, 0.34, 10).rotateZ(Math.PI / 2),
  king: new THREE.CylinderGeometry(0.018, 0.018, 0.07, 8),
  bush: new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10),
  wheel: new THREE.CylinderGeometry(0.058, 0.058, 0.06, 20).rotateZ(Math.PI / 2),
  hub: new THREE.CylinderGeometry(0.024, 0.024, 0.064, 12).rotateZ(Math.PI / 2),
};

/** Monta um skate (shape de madeira com lixa estampada, trucks de metal e rodas). Topo da lixa em y ≈ 0.2. */
export function buildBoard(b) {
  DECK ||= deckGeometry();
  const root = new THREE.Group();
  const board = new THREE.Group();
  root.add(board);
  board.position.y = 0.13;
  const tex = deckTexture(b);
  tex.repeat.set(1 / W, 1 / L);
  tex.offset.set(0.5, 0.5);
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 });
  // A ExtrudeGeometry tem 2 grupos: [0] tampas (topo/base) e [1] laterais (as lâminas de madeira)
  const deck = new THREE.Mesh(DECK, [top, plyMat()]);
  deck.castShadow = true;
  deck.receiveShadow = true;
  board.add(deck);
  // Trucks (base, eixo, parafuso e borrachas) e rodas de poliuretano com rolamento
  const wheelM = new THREE.MeshStandardMaterial({ color: b.glow, roughness: 0.5, metalness: 0.05 });
  const bushM = new THREE.MeshStandardMaterial({ color: b.c2, roughness: 0.8 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; board.add(m); return m; };
  for (const z of [-0.4, 0.4]) {
    add(truckGeo.base, darkM, 0, -0.012, z);
    add(truckGeo.king, metalM, 0, -0.045, z);
    add(truckGeo.bush, bushM, 0, -0.04, z + (z > 0 ? -0.04 : 0.04));
    add(truckGeo.hanger, metalM, 0, -0.075, z);
    for (const x of [-0.17, 0.17]) {
      const w = add(truckGeo.wheel, wheelM, x, -0.075, z);
      w.userData.wheel = true;
      add(truckGeo.hub, metalM, x, -0.075, z);
    }
  }
  // Aletas (alguns modelos)
  if (b.fins === 1) for (const x of [-0.12, 0.12]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 3), toon(b.c2));
    f.scale.z = 0.25;
    f.rotation.set(Math.PI / 2 - 0.5, 0, 0);
    f.position.set(x, 0.0, 0.55);
    board.add(f);
  }
  if (b.fins === 2) for (const sd of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.32), toon(b.glow));
    f.position.set(sd * 0.27, 0.03, 0.12);
    f.rotation.y = sd * -0.25;
    board.add(f);
  }
  // Luz de baixo (aditiva, discreta)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.6), new THREE.MeshBasicMaterial({ color: b.glow, map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.012;
  root.add(glow);
  root.userData.board = board;
  root.userData.glow = glow;
  return root;
}

let GLOW = null;
function glowTex() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.5, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  GLOW = new THREE.CanvasTexture(c);
  return GLOW;
}

/** Animação do skate: flutua um pouco; no pulo dá um giro (kickflip). k = progresso do giro 0..1. */
export function poseBoard(root, t, flip = 0) {
  const board = root.userData.board;
  board.position.y = 0.13 + Math.sin(t * 5) * 0.012;
  board.rotation.set(0, 0, 0);
  if (flip > 0 && flip < 1) {
    const e = 1 - (1 - flip) ** 2;
    board.rotation.z = e * Math.PI * 2;
    board.rotation.y = Math.sin(flip * Math.PI) * 0.4;
    board.position.y += Math.sin(flip * Math.PI) * 0.25;
  }
  root.userData.glow.material.opacity = 0.45 + Math.sin(t * 6) * 0.12;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
/**
 * Põe o personagem em cima do skate: as solas dos tênis apoiadas na lixa (ou, deitado, o corpo
 * encostando na prancha), centralizado no skate. Chame depois de animar o personagem.
 * bodyPoint vem de build.js (passado para não criar dependência circular).
 */
export function standOnBoard(model, deck, bodyPoint, lie = false) {
  const board = deck.userData.board;
  deck.updateMatrixWorld(true);
  const top = board.localToWorld(_a.set(0, 0.057, 0));
  const p = bodyPoint(model, lie ? 'baixo' : 'pes', _b);
  const parent = model.parent;
  // diferença no espaço do pai do personagem
  const tl = parent ? parent.worldToLocal(top.clone()) : top.clone();
  const pl = parent ? parent.worldToLocal(p.clone()) : p.clone();
  model.position.y += tl.y - pl.y;
  if (!lie) { model.position.x += tl.x - pl.x; model.position.z += tl.z - pl.z; }
}
