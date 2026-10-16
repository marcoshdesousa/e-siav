// Surf DBV: corrida infinita em 3D nos trilhos (estilo "subway runner").
// Três trilhos: deslize para os lados para trocar, para cima para pular e para baixo para rolar.
// Trens parados e andando, rampas para o teto, barreiras baixas (pule) e altas (role), skate.
// Bater de frente num trem acaba a corrida (o personagem para na frente do trem, nunca entra).
// Esbarrar ou bater numa barreira: tropeça e o guarda chega perto. De novo com ele perto: pegou!
import * as THREE from 'three';
import { makeCoin, makeRamp, makeSprayCan, makeTrain, toon, TRAIN_H, TRAIN_W, warmTrains } from './models.js';
import { aimBone, bodyPoint, buildAvatar, holdProp, poseAvatar, studioEnv } from '../avatar/build.js';
import { createParticles, makePogo, makePowerup, makeRocket, POWERS, POWER_TYPES } from './powerups.js';
import { buildBoard, poseBoard, standOnBoard } from '../avatar/board.js';
import { boardById, GUARD as OFFICER, skinById } from '../avatar/skins.js';


const LANE_W = 2.4;
const GRAVITY = 40;
const JUMP_V = 13;
const FLY_Y = 8.2; // altura do voo de foguete
const ROLL_TIME = 0.7;
const CATCH_WINDOW = 9;
const START_SPEED = 13;
const MAX_SPEED = 32;
export const SKATE_TIME = 10;
export const SKATE_WAIT = 3;

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

function noise(g, w, h, n, alpha, light = true) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
}
/** Leito da linha: brita miúda e dormentes de concreto (um por trilho). */
function trackTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#7d7468'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 85 + Math.random() * 90; g.fillStyle = `rgba(${v},${v - 6},${v - 14},.75)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 0.8 + Math.random() * 2.2, 0, 7); g.fill(); }
    for (let l = 0; l < 3; l++) {
      const cx = ((l + 0.5) / 3) * w;
      for (let y = 0; y < h; y += 42) {
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(cx - 68, y + 13, 136, 20);
        const gr = g.createLinearGradient(0, y + 10, 0, y + 28);
        gr.addColorStop(0, '#b8b2a7'); gr.addColorStop(1, '#8c867b');
        g.fillStyle = gr; g.fillRect(cx - 66, y + 10, 132, 18);
        for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; g.fillRect(cx - 66 + Math.random() * 132, y + 10 + Math.random() * 18, 2, 2); }
        // grampos do trilho
        g.fillStyle = '#3f3f46'; for (const sx of [-34, -22, 22, 34]) g.fillRect(cx + sx - 3, y + 14, 6, 10);
      }
    }
  }, [1, 40]);
}
/** Muro de concreto com placas, manchas de chuva e grafite (palavras do bem). */
function wallTexture(seed) {
  return canvasTex(512, 256, (g, w, h) => {
    const base = ['#a8a29e', '#9ca3af', '#a3a3a3', '#b0a596'][seed % 4];
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    noise(g, w, h, 5000, 0.12, false); noise(g, w, h, 3000, 0.1);
    // juntas das placas
    for (let x = 0; x < w; x += 128) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x + 3, 0, 2, h); }
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 14, w, 4);
    // escorridos de chuva
    for (let i = 0; i < 30; i++) { const x = Math.random() * w; const gr = g.createLinearGradient(0, 18, 0, 18 + 80 + Math.random() * 90); gr.addColorStop(0, 'rgba(40,40,40,.25)'); gr.addColorStop(1, 'rgba(40,40,40,0)'); g.fillStyle = gr; g.fillRect(x, 18, 4 + Math.random() * 10, 170); }
    const cols = ['#f472b6', '#22d3ee', '#a3e635', '#facc15', '#c084fc', '#fb923c'];
    for (let k = 0; k < 2; k++) {
      g.save();
      g.translate(40 + k * 250 + (seed * 13) % 50, 165);
      g.rotate(-0.08 + k * 0.07);
      g.font = 'bold 64px "Arial Black", Arial';
      g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#111';
      const word = ['JESUS', 'FÉ', 'AMOR', 'PAZ', 'DBV', 'ALEGRIA'][(seed + k * 3) % 6];
      g.strokeText(word, 0, 0);
      const gr = g.createLinearGradient(0, -55, 0, 0);
      gr.addColorStop(0, cols[(seed + k) % cols.length]); gr.addColorStop(1, cols[(seed + k + 2) % cols.length]);
      g.fillStyle = gr; g.fillText(word, 0, 0);
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.7)'; g.strokeText(word, 0, 0);
      g.restore();
    }
    const dirt = g.createLinearGradient(0, h - 60, 0, h);
    dirt.addColorStop(0, 'rgba(60,50,40,0)'); dirt.addColorStop(1, 'rgba(60,50,40,.5)');
    g.fillStyle = dirt; g.fillRect(0, h - 60, w, 60);
  }, [3, 1]);
}
/** Fachada de prédio: tijolo ou concreto, janelas com moldura, vidro refletindo o céu, algumas acesas. */
function buildingTexture(base, brick) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (brick) {
      for (let y = 0; y < h; y += 6) for (let x = (y / 6) % 2 ? 0 : 7; x < w; x += 14) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.1})`; g.fillRect(x, y, 13, 5); }
      g.fillStyle = 'rgba(255,255,255,.06)'; for (let y = 5; y < h; y += 6) g.fillRect(0, y, w, 1);
    } else noise(g, w, h, 3000, 0.1, false);
    for (let y = 22; y < h - 30; y += 54) {
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y + 44, w, 5); // laje entre andares
      for (let x = 16; x < w - 30; x += 58) {
        g.fillStyle = '#e7e5e4'; g.fillRect(x - 3, y - 3, 42, 46);
        const lit = Math.random() < 0.18;
        const gl = g.createLinearGradient(x, y, x + 36, y + 40);
        if (lit) { gl.addColorStop(0, '#fde68a'); gl.addColorStop(1, '#f59e0b'); } else { gl.addColorStop(0, '#9cc3e6'); gl.addColorStop(0.5, '#3b5b7d'); gl.addColorStop(1, '#1e293b'); }
        g.fillStyle = gl; g.fillRect(x, y, 36, 40);
        g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(x, y + 30); g.lineTo(x + 16, y); g.lineTo(x + 24, y); g.lineTo(x + 6, y + 40); g.lineTo(x, y + 40); g.fill();
        g.fillStyle = '#d6d3d1'; g.fillRect(x - 1, y + 19, 38, 2); g.fillRect(x + 17, y, 2, 40);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 4, y + 42, 44, 4); // peitoril
        if (Math.random() < 0.12) { g.fillStyle = '#cbd5e1'; g.fillRect(x + 6, y + 44, 24, 12); g.fillStyle = '#64748b'; g.fillRect(x + 8, y + 46, 20, 2); } // ar-condicionado
      }
    }
    const shadow = g.createLinearGradient(0, h - 90, 0, h);
    shadow.addColorStop(0, 'rgba(0,0,0,0)'); shadow.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = shadow; g.fillRect(0, h - 90, w, 90);
  });
}
function stripesTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#dc2626';
    for (let x = -h; x < w + h; x += 64) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 32, h); g.lineTo(x + 32 + h, 0); g.lineTo(x + h, 0); g.fill(); }
    noise(g, w, h, 600, 0.15, false);
  });
}
function skyTexture() {
  return canvasTex(16, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2f6fd6'); gr.addColorStop(0.45, '#78b6ee'); gr.addColorStop(0.75, '#cfe6f7'); gr.addColorStop(1, '#f6e7cf');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function cloudTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 22; i++) {
      const x = 40 + Math.random() * (w - 80);
      const y = 50 + Math.random() * 40;
      const r = 18 + Math.random() * 30;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,.9)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

/** Grafite do símbolo dos Desbravadores aparecendo aos poucos (o spray "pinta" a imagem). */
function makeGraffiti() {
  const S = 256;
  const src = document.createElement('canvas'); src.width = src.height = S;
  const mask = document.createElement('canvas'); mask.width = mask.height = S;
  const out = document.createElement('canvas'); out.width = out.height = S;
  const sg = src.getContext('2d');
  const img = new Image();
  img.onload = () => {
    sg.drawImage(img, 28, 6, 200, 200);
    sg.font = 'bold 44px "Arial Black", Arial'; sg.textAlign = 'center';
    sg.lineWidth = 9; sg.strokeStyle = '#111'; sg.strokeText('DBV', 128, 246); sg.fillStyle = '#facc15'; sg.fillText('DBV', 128, 246);
  };
  img.src = '/marca/logo.svg?v=4';
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mg = mask.getContext('2d');
  const og = out.getContext('2d');
  return {
    tex,
    paint(k) {
      // O spray faz um zigue-zague de cima para baixo
      const y = Math.min(1, k) * S;
      const x = (Math.sin(k * 40) * 0.5 + 0.5) * S;
      mg.fillStyle = '#fff';
      mg.globalAlpha = 0.5;
      for (let i = 0; i < 26; i++) { mg.beginPath(); mg.arc(x + rnd(-30, 30), y + rnd(-26, 26), rnd(6, 22), 0, 7); mg.fill(); }
      mg.globalAlpha = 1;
      og.clearRect(0, 0, S, S);
      og.drawImage(src, 0, 0);
      og.globalCompositeOperation = 'destination-in';
      og.drawImage(mask, 0, 0);
      og.globalCompositeOperation = 'source-over';
      tex.needsUpdate = true;
      return { x: x / S, y: y / S };
    },
    full() { og.clearRect(0, 0, S, S); og.drawImage(src, 0, 0); tex.needsUpdate = true; },
  };
}

export function createRunner(canvas, { skin = 'm01', board = 'b01', onHud, onEnd, onSound }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#dbe9f4', 60, 165);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 240);

  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight('#dceeff', '#8a7a66', 1.15));
  const sun = new THREE.DirectionalLight('#ffe9c4', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 18, bottom: -18, near: 1, far: 70 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  // Chão com dormentes, trilhos de verdade e o cascalho dos lados
  const trackTex = trackTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 3 + 1, 260), new THREE.MeshStandardMaterial({ map: trackTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(90, 260), new THREE.MeshStandardMaterial({ color: '#8d867b', roughness: 1 }));
  side.rotation.x = -Math.PI / 2;
  side.position.y = -0.02;
  scene.add(side);
  const rails = new THREE.Group();
  const railMat = new THREE.MeshStandardMaterial({ color: '#6b6158', metalness: 0.7, roughness: 0.55 });
  const railTop = new THREE.MeshStandardMaterial({ color: '#e5e7eb', metalness: 0.95, roughness: 0.2 });
  const railGeo = new THREE.BoxGeometry(0.1, 0.13, 260);
  const railTopGeo = new THREE.BoxGeometry(0.075, 0.025, 260);
  for (let l = -1; l <= 1; l++) for (const s of [-1, 1]) {
    const r = new THREE.Mesh(railGeo, railMat);
    r.position.set(l * LANE_W + s * 0.55, 0.065, 0);
    r.receiveShadow = true;
    const t = new THREE.Mesh(railTopGeo, railTop);
    t.position.set(l * LANE_W + s * 0.55, 0.14, 0);
    rails.add(r, t);
  }
  scene.add(rails);

  // Cenário que se repete: muros de concreto grafitados, prédios com janelas, postes e árvores
  const scenery = [];
  const STEP = 16;
  const wallMats = [0, 1, 2, 3].map((k) => new THREE.MeshStandardMaterial({ map: wallTexture(k), roughness: 0.95 }));
  const bldMats = [['#8b5a43', true], ['#a1a1aa', false], ['#9a3412', true], ['#d6d3d1', false], ['#6b7280', false], ['#b45309', true]]
    .map(([c, brick]) => new THREE.MeshStandardMaterial({ map: buildingTexture(c, brick), roughness: 0.85 }));
  // um material por prédio e altura (a textura repete conforme o número de andares)
  const bldCache = new Map();
  const bldMat = (k, h) => {
    const key = k + ':' + h;
    if (!bldCache.has(key)) {
      const m = bldMats[k].clone();
      m.map = bldMats[k].map.clone();
      m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
      m.map.repeat.set(2, h / 26);
      m.map.needsUpdate = true;
      bldCache.set(key, m);
    }
    return bldCache.get(key);
  };
  const roofMat = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.9 });
  const poleMat = new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.5, metalness: 0.6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fff7d6' });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.95 });
  const leafMats = ['#2f7d32', '#3f8f3a', '#4b9b3c'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
  const walkMat = new THREE.MeshStandardMaterial({ color: '#b8b3aa', roughness: 0.95 });
  const geo = {
    wall: new THREE.BoxGeometry(0.5, 2.8, STEP), cap: new THREE.BoxGeometry(0.7, 0.16, STEP),
    pole: new THREE.CylinderGeometry(0.07, 0.1, 6.5, 10), arm: new THREE.BoxGeometry(1.4, 0.07, 0.07), lamp: new THREE.BoxGeometry(0.5, 0.08, 0.22),
    trunk: new THREE.CylinderGeometry(0.14, 0.22, 2.2, 8), leaf: new THREE.IcosahedronGeometry(1, 1), tank: new THREE.CylinderGeometry(0.8, 0.8, 1.4, 14),
    walk: new THREE.BoxGeometry(3.5, 0.2, STEP),
  };
  for (let i = 0; i < 15; i++) {
    for (const s of [-1, 1]) {
      const grp = new THREE.Group();
      const wall = new THREE.Mesh(geo.wall, wallMats[(i * 2 + (s > 0 ? 1 : 0)) % 4]);
      wall.position.set(s * (LANE_W * 1.5 + 1.3), 1.4, 0);
      wall.receiveShadow = true;
      const cap = new THREE.Mesh(geo.cap, roofMat);
      cap.position.set(wall.position.x, 2.85, 0);
      const walk = new THREE.Mesh(geo.walk, walkMat);
      walk.position.set(s * (LANE_W * 1.5 + 3.2), 0.1, 0);
      walk.receiveShadow = true;
      const h = 10 + ((i * 7 + (s > 0 ? 3 : 0)) % 5) * 4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(9, h, STEP - 2), bldMat((i + (s > 0 ? 2 : 0)) % bldMats.length, h));
      b.position.set(s * (LANE_W * 1.5 + 9.5), h / 2, 0);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.5, STEP - 1.6), roofMat);
      roof.position.set(b.position.x, h + 0.25, 0);
      grp.add(wall, cap, walk, b, roof);
      if ((i + (s > 0 ? 1 : 0)) % 4 === 0) {
        const tank = new THREE.Mesh(geo.tank, poleMat);
        tank.position.set(b.position.x - s, h + 1.2, 2);
        grp.add(tank);
      }
      const pole = new THREE.Mesh(geo.pole, poleMat);
      pole.position.set(s * (LANE_W * 1.5 + 0.8), 3.25, STEP / 2 - 1);
      const arm = new THREE.Mesh(geo.arm, poleMat);
      arm.position.set(s * (LANE_W * 1.5 + 0.2), 6.4, STEP / 2 - 1);
      const lamp = new THREE.Mesh(geo.lamp, lampMat);
      lamp.position.set(s * (LANE_W * 1.5 - 0.4), 6.33, STEP / 2 - 1);
      grp.add(pole, arm, lamp);
      if ((i + (s > 0 ? 1 : 0)) % 3 === 0) {
        // árvore de copa irregular (vários "tufos")
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(geo.trunk, trunkMat);
        trunk.position.y = 1.1;
        trunk.castShadow = true;
        tree.add(trunk);
        for (let k = 0; k < 4; k++) {
          const leaf = new THREE.Mesh(geo.leaf, leafMats[(i + k) % 3]);
          const r = 0.8 + ((i * 3 + k) % 3) * 0.25;
          leaf.scale.setScalar(r);
          leaf.position.set(Math.cos(k * 2.1) * 0.55, 2.6 + (k % 2) * 0.5, Math.sin(k * 2.1) * 0.55);
          leaf.rotation.set(k, k * 2, 0);
          leaf.castShadow = true;
          tree.add(leaf);
        }
        tree.position.set(s * (LANE_W * 1.5 + 3), 0.2, -STEP / 4);
        grp.add(tree);
      }
      grp.position.z = -i * STEP + 24;
      scene.add(grp);
      scenery.push(grp);
    }
  }
  // Nuvens bem longe
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
  const clouds = [];
  for (let k = 0; k < 7; k++) {
    const c = new THREE.Sprite(cloudMat);
    c.scale.set(60 + k * 6, 26, 1);
    c.position.set(-70 + k * 24, 38 + (k % 3) * 8, -150);
    scene.add(c);
    clouds.push(c);
  }

  const stripeMat = new THREE.MeshStandardMaterial({ map: stripesTexture(), roughness: 0.6 });

  // Jogador, guarda, skate
  const shadowed = (m) => { m.traverse((o) => { if (o.isMesh && o.material.type !== 'MeshBasicMaterial') o.castShadow = true; }); return m; };
  // A lata de spray fica sempre na mão (pichando, correndo, pulando)
  const withCan = (m) => { const can = makeSprayCan(); can.position.set(0.02, 0.06, 0.05); can.rotation.set(0, 0, Math.PI / 2); holdProp(m, can); m.userData.can = can; return m; };
  let player = shadowed(withCan(buildAvatar(skinById(skin), 'surf')));
  scene.add(player);
  const officer = shadowed(buildAvatar(OFFICER, 'surf'));
  officer.scale.setScalar(1.22); // o guarda é grandão (segura o personagem de cabeça para baixo)
  officer.visible = false;
  scene.add(officer);
  let skate = buildBoard(boardById(board));
  skate.visible = false;
  scene.add(skate);

  // Partículas brilhantes (poeira, brilho das moedas, explosão do skate, tinta do spray, poderes)
  const fx = createParticles(scene);
  // Terra caindo dos vagões abertos e poeira (sem brilho)
  const dirt = createParticles(scene, 220, { additive: false });
  const dust = (x, y, z, n, colors, speed, life, size, grav) => dirt.burst(x, y, z, n, { colors, speed, life, size, grav, up: 0.2 });
  function burst(x, y, z, n, colors, speed = 5, life = 0.7, size = 1, grav = 12, star = false) {
    fx.burst(x, y, z, n, { colors, speed, life, size: 0.42 * size, grav, star, up: 0.3 });
  }

  // Poderes: foguete nas costas, pula-pula nos pés e o anel do ímã
  const rocketPack = makeRocket(0.82);
  rocketPack.visible = false;
  scene.add(rocketPack);
  const pogo = makePogo(1.15);
  pogo.visible = false;
  scene.add(pogo);
  const magnetRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  magnetRing.rotation.x = Math.PI / 2;
  magnetRing.visible = false;
  scene.add(magnetRing);
  const powerups = [];

  const st = {
    z: 8.6, lane: 0, x: 0, y: 0, prevY: 0, vy: 0, roll: 0, speed: START_SPEED, t: 0, coins: 0, dist: 0,
    groundY: 0, alive: true, phase: 'menu', hitAt: -100, officerDist: 2.2, nextRowZ: -26, slow: 0, over: false,
    stumble: 0, bump: 0, shake: 0, skate: 0, skateWait: 0, invuln: 0, story: 0, flip: -1, dead: null, deadAt: 0, deadZ: 0,
    power: { ima: 0, estrela: 0, foguete: 0, pulapula: 0 }, lastPowerAt: 0,
  };
  const objects = [];
  const coins = [];
  const laneX = (l) => l * LANE_W;

  function addTrain(lane, zNear, len, moving, plain = false, kind = null) {
    const k = kind || (plain ? 'metro' : Math.random() < 0.38 ? 'carga' : 'metro');
    const m = makeTrain(len, plain ? 2 : Math.floor(Math.random() * 1000), moving, plain, k);
    m.position.set(laneX(lane), 0, zNear);
    scene.add(m);
    const o = { type: 'train', kind: k, lane, zNear, zFar: zNear - len, mesh: m, v: moving ? rnd(8, 13) : 0 };
    objects.push(o);
    return o;
  }
  function addRamp(lane, zNear, len) {
    const g = makeRamp(len);
    g.position.set(laneX(lane), 0, zNear);
    scene.add(g);
    objects.push({ type: 'ramp', lane, zNear, zFar: zNear - len, mesh: g });
  }
  function addBarrier(lane, z, high) {
    const g = new THREE.Group();
    if (high) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(LANE_W * 0.85, 0.55, 0.18), stripeMat);
      bar.position.y = 1.75;
      g.add(bar);
      const sign = new THREE.Mesh(new THREE.CircleGeometry(0.28, 3), toon('#facc15'));
      sign.position.set(0, 2.3, 0.1);
      sign.rotation.z = Math.PI / 2;
      g.add(sign);
      for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), toon('#1f2937')); post.position.set(s * LANE_W * 0.42, 1.2, 0); g.add(post); }
    } else {
      const board = new THREE.Mesh(new THREE.BoxGeometry(LANE_W * 0.8, 0.45, 0.15), stripeMat);
      board.position.y = 0.72;
      g.add(board);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.5), toon('#334155'));
        leg.position.set(s * LANE_W * 0.34, 0.47, 0);
        g.add(leg);
      }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#f97316' }));
      lamp.position.set(LANE_W * 0.3, 1.0, 0);
      g.add(lamp);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(laneX(lane), 0, z);
    scene.add(g);
    objects.push({ type: high ? 'high' : 'low', lane, zNear: z + 0.35, zFar: z - 0.35, mesh: g });
  }
  // Moedas reaproveitadas (o foguete solta centenas de uma vez: criar todas travaria o jogo)
  const coinPool = [];
  for (let k = 0; k < 160; k++) coinPool.push(makeCoin());
  const dropCoin = (m) => { scene.remove(m); coinPool.push(m); };
  function addCoin(lane, z, y = 1) {
    const m = coinPool.pop() || makeCoin();
    m.position.set(laneX(lane), y, z);
    scene.add(m);
    coins.push({ lane, z, y, mesh: m });
  }
  function addPowerup(lane, z, type) {
    const m = makePowerup(type);
    m.scale.setScalar(1.35);
    m.position.set(laneX(lane), 1.3, z);
    scene.add(m);
    powerups.push({ lane, z, type, mesh: m });
  }
  /** Moedas lá no alto (voo de foguete): fileiras trocando de trilho de vez em quando. */
  function skyCoins(z0, len) {
    let lane = st.lane;
    for (let z = z0; z > z0 - len; z -= 2.4) {
      if (Math.random() < 0.06) lane = Math.max(-1, Math.min(1, lane + (Math.random() < 0.5 ? -1 : 1)));
      addCoin(lane, z, FLY_Y + 0.6);
    }
  }
  function coinLine(lane, z0, n, y = 1, arc = false) {
    for (let k = 0; k < n; k++) addCoin(lane, z0 - k * 2.2, arc ? y + Math.sin((k / (n - 1)) * Math.PI) * 2.2 : y);
  }

  /** Próxima fileira de obstáculos, sempre deixando um caminho possível. */
  function spawnRow() {
    const z = st.nextRowZ;
    const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
    const free = lanes[0];
    const level = Math.min(1, st.t / 80);
    let rowLen = 14;
    for (const lane of lanes) {
      const r = Math.random();
      if (lane === free) {
        const quiet = !POWER_TYPES.some((k) => st.power[k] > 0);
        if (quiet && st.t > 6 && st.t - st.lastPowerAt > 14 && Math.random() < 0.35) {
          st.lastPowerAt = st.t;
          addPowerup(lane, z - 2, POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)]);
          coinLine(lane, z - 6, 4);
          continue;
        }
        if (st.power.pulapula > 0 && r < 0.6) { coinLine(lane, z, 7, 2.5, true); for (let k = 0; k < 5; k++) addCoin(lane, z - 18 - k * 2.2, 5.6); continue; }
        if (r < 0.45) coinLine(lane, z, 7);
        else if (r < 0.75) { const high = Math.random() < 0.45; addBarrier(lane, z - 4, high); coinLine(lane, z, 5, high ? 0.6 : 1, !high); }
        continue;
      }
      if (r < 0.34 + level * 0.15) {
        const len = 13 + Math.floor(Math.random() * 3) * 13;
        if (Math.random() < 0.4) {
          addRamp(lane, z, 8);
          addTrain(lane, z - 8, len, false);
          coinLine(lane, z - 10, Math.floor(len / 2.4), TRAIN_H + 1);
          rowLen = Math.max(rowLen, len + 8);
        } else {
          addTrain(lane, z, len, Math.random() < 0.12 + level * 0.25);
          rowLen = Math.max(rowLen, len);
        }
      } else if (r < 0.62) {
        addBarrier(lane, z - 3, Math.random() < 0.45);
      } else if (r < 0.8) coinLine(lane, z, 5);
    }
    st.nextRowZ = z - rowLen - (12 + Math.random() * 10 + st.speed * 0.35);
  }

  // Abertura: um trem parado do lado e o símbolo sendo pichado nele
  const graffiti = makeGraffiti();
  addTrain(1, 15, 13, false, true);
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: graffiti.tex, transparent: true, depthWrite: false }));
  decal.position.set(laneX(1) - 1.01, 1.95, 8.6);
  decal.rotation.y = -Math.PI / 2;
  decal.renderOrder = 3;
  scene.add(decal);

  // ───────────── Controles ─────────────
  const playing = () => st.phase === 'run' && st.alive;
  /** Altura do bloco (trem ou rampa) num trilho; 0 se o trilho está livre ali. */
  const blockH = (lane, z, pad = 0) => {
    let h = 0;
    for (const o of objects) {
      if (o.lane !== lane || z > o.zNear + pad || z < o.zFar - pad) continue;
      if (o.type === 'train') h = Math.max(h, TRAIN_H);
      if (o.type === 'ramp') h = Math.max(h, ((o.zNear - z) / (o.zNear - o.zFar)) * TRAIN_H);
    }
    return h;
  };
  function move(d) {
    if (!playing()) return;
    const nl = Math.max(-1, Math.min(1, st.lane + d));
    if (nl === st.lane) return;
    const bh = blockH(nl, st.z, 0.3);
    if (bh > 0.6 && st.y < bh - 0.35) { st.bump = d; hit('side', null); return; }
    st.lane = nl;
    onSound?.('lane');
  }
  function jump() {
    if (!playing()) return;
    if (st.power.foguete > 0) return;
    if (st.y <= st.groundY + 0.06) {
      const pg = st.power.pulapula > 0;
      st.vy = pg ? JUMP_V * 1.62 : JUMP_V;
      st.roll = 0;
      onSound?.(pg ? 'boing' : 'hop');
      if (st.skate > 0) st.flip = 0;
      if (pg) burst(st.x, st.groundY + 0.1, st.z, 10, ['#86efac', '#ffffff'], 3, 0.45, 0.8, 4);
    }
  }
  function roll() {
    if (!playing() || st.power.foguete > 0) return;
    st.roll = ROLL_TIME;
    if (st.y > st.groundY + 0.06) st.vy = -JUMP_V * 1.3;
    onSound?.('slide');
  }
  const input = { left: () => move(-1), right: () => move(1), up: jump, down: roll };
  function useSkate() {
    if (!playing() || st.skate > 0 || st.skateWait > 0 || st.power.foguete > 0) return false;
    st.skate = SKATE_TIME;
    onSound?.('skate');
    burst(st.x, st.y + 0.2, st.z, 14, ['#38bdf8', '#facc15', '#ffffff'], 4, 0.5);
    return true;
  }

  /** Pegou um poder. */
  function activate(type) {
    st.power[type] = POWERS[type].time;
    onSound?.('power');
    onHud?.({ warn: `${POWERS[type].name}!`, good: true });
    burst(st.x, st.y + 1.2, st.z - 0.3, 26, [POWERS[type].color, '#ffffff', '#fde047'], 5, 0.8, 1.2, 3, true);
    if (type === 'foguete') {
      onSound?.('rocket');
      st.roll = 0;
      st.skateWait = Math.max(st.skateWait, 0);
      // Moedas no céu por todo o voo
      skyCoins(st.z - 10, st.speed * POWERS.foguete.time);
    }
  }

  // ───────────── Batidas ─────────────
  function ghost(o) {
    if (o.ghost) return;
    o.ghost = true;
    o.mesh.traverse((m) => {
      if (!m.isMesh) return;
      m.material = m.material.clone();
      m.material.transparent = true;
      m.material.opacity = 0.35;
    });
  }
  function hit(kind, obj) {
    if (!st.alive || st.invuln > 0 || st.power.foguete > 0) return;
    if (obj && obj.type !== 'train') ghost(obj);
    if (st.skate > 0) {
      // Com skate: o skate explode e a corrida continua
      st.skate = 0;
      st.skateWait = SKATE_WAIT;
      st.invuln = 1.2;
      st.shake = 0.5;
      onSound?.('explode');
      burst(st.x, st.y + 0.5, st.z - 0.5, 34, ['#f97316', '#facc15', '#ef4444', '#38bdf8', '#ffffff'], 7, 0.8, 1.6);
      onHud?.({ warn: 'O skate explodiu!' });
      return;
    }
    if (st.t - st.hitAt < CATCH_WINDOW) { caught('caught'); return; }
    st.hitAt = st.t;
    st.slow = 0.9;
    st.stumble = 0.7;
    st.invuln = 0.8;
    st.shake = kind === 'front' ? 0.45 : 0.25;
    onSound?.(kind === 'front' ? 'crash' : 'hit');
    dust(st.x, st.y + 0.1, st.z - 0.2, 12, ['#a8a29e', '#8b8378', '#d6d3d1'], 2.4, 0.7, 0.5, 4);
    // estrelinhas rodando na cabeça (ficou tonto com o tropeço)
    burst(st.x, st.y + 2.05, st.z, 7, ['#fde047', '#ffffff', '#fb923c'], 1.3, 0.9, 0.7, -0.4, true);
    onHud?.({ warn: kind === 'side' ? 'Esbarrou! O guarda está chegando!' : 'Bateu! O guarda está perto!' });
  }
  function caught(how) {
    if (!st.alive) return;
    st.alive = false;
    st.dead = how;
    st.deadAt = st.t;
    st.deadZ = st.z;
    st.deadX = st.x;
    st.roll = 0;
    st.skate = 0;
    st.shake = how === 'crash' ? 0.7 : 0.6;
    onSound?.('crash');
    if (how === 'crash') onHud?.({ warn: 'Bateu de frente!' });
    setTimeout(() => onSound?.('whistle'), 500);
    setTimeout(() => finish(), 4800);
  }
  /** Bateu de frente num trem. Sem skate: acaba. Com skate: o skate explode e o personagem
   *  desvia para um trilho livre (ou pula para o teto, se não houver). Nunca entra no trem. */
  function frontCrash(o) {
    if (st.power.foguete > 0) return;
    if (st.skate > 0 || st.invuln > 0) {
      if (st.skate > 0) {
        st.skate = 0;
        st.skateWait = SKATE_WAIT;
        st.invuln = 1.2;
        st.shake = 0.5;
        st.flip = -1;
        onSound?.('explode');
        burst(st.x, st.y + 0.5, st.z - 0.5, 34, ['#f97316', '#facc15', '#ef4444', '#38bdf8', '#ffffff'], 7, 0.8, 1.6);
        onHud?.({ warn: 'O skate explodiu!' });
        const free = [-1, 0, 1].filter((l) => l !== o.lane && blockH(l, st.z - 1, 1.2) < 0.6).sort((a, b) => Math.abs(a - st.lane) - Math.abs(b - st.lane))[0];
        if (free !== undefined) st.lane = free;
        else { st.vy = 17.5; st.roll = 0; }
      }
      return;
    }
    caught('crash');
  }
  function finish() {
    if (st.over) return;
    st.over = true;
    onEnd?.({ coins: st.coins, dist: Math.floor(st.dist), crash: st.dead === 'crash' });
  }

  // ───────────── Física ─────────────
  function surfaceAt(lane, z, prevY) {
    let top = 0;
    for (const o of objects) {
      if (o.lane !== lane || o.ghost) continue;
      if (o.type === 'ramp' && z <= o.zNear && z >= o.zFar) {
        const h = ((o.zNear - z) / (o.zNear - o.zFar)) * TRAIN_H;
        if (prevY >= h - 0.9) top = Math.max(top, h);
      }
      // Teto do trem: vale se os pés já estavam em cima no quadro anterior (não atravessa caindo
      // rápido no celular mais lento) e com uma folguinha na beirada.
      if (o.type === 'train' && z <= o.zNear + 0.3 && z >= o.zFar - 0.3 && prevY >= TRAIN_H - 0.4) top = Math.max(top, TRAIN_H);
    }
    return top;
  }

  function stepRun(dt) {
    st.t += dt;
    st.speed = Math.min(MAX_SPEED, START_SPEED + st.t * 0.18);
    const sp = st.speed * (st.slow > 0 ? 0.6 : 1);
    st.slow = Math.max(0, st.slow - dt);
    st.stumble = Math.max(0, st.stumble - dt);
    st.invuln = Math.max(0, st.invuln - dt);
    st.shake = Math.max(0, st.shake - dt);
    for (const k of POWER_TYPES) {
      if (st.power[k] <= 0) continue;
      st.power[k] = Math.max(0, st.power[k] - dt);
      if (st.power[k] === 0) {
        onSound?.('pop');
        if (k === 'foguete') { st.invuln = 1.8; st.vy = 0; }
      }
    }
    if (st.skate > 0) { st.skate -= dt; if (st.skate <= 0) { st.skate = 0; st.skateWait = SKATE_WAIT; onSound?.('pop'); } }
    else st.skateWait = Math.max(0, st.skateWait - dt);
    for (const o of objects) {
      if (!o.v) continue;
      // Trem andando freia antes de chegar em outro trem, rampa ou barreira no mesmo trilho
      const step = o.v * dt;
      const block = objects.some((b) => b !== o && b.lane === o.lane && b.zFar > o.zNear - 0.5 && b.zFar < o.zNear + step + 1.5);
      if (block) { o.v = 0; continue; }
      o.zNear += step; o.zFar += step; o.mesh.position.z += step;
    }
    let nz = st.z - sp * dt;
    // Frente dos trens: o personagem nunca passa da frente (só por cima)
    for (const o of objects) {
      if (o.type !== 'train' || Math.abs(st.x - laneX(o.lane)) > 1.25 || st.y >= TRAIN_H - 0.45) continue;
      const front = o.zNear + 0.5;
      if (nz < front && st.z > o.zFar) {
        nz = Math.max(nz, front);
        if (st.alive && Math.abs(st.x - laneX(o.lane)) < 0.9) frontCrash(o);
        if (!st.alive) break;
      }
    }
    if (!st.alive) { st.z = nz; st.deadZ = nz; return; }
    st.dist += Math.max(0, st.z - nz);
    st.z = nz;
    st.x += (laneX(st.lane) - st.x) * Math.min(1, dt * 15);
    st.bump *= Math.max(0, 1 - dt * 7); // esbarrão de lado: dá um tranco para o lado e volta
    st.roll = Math.max(0, st.roll - dt);
    if (st.flip >= 0) { st.flip += dt / 0.55; if (st.flip >= 1) st.flip = -1; }
    const lane = Math.round(st.x / LANE_W);
    st.prevY = st.y;
    st.groundY = surfaceAt(lane, st.z, st.y);
    if (st.power.foguete > 0) {
      // Voando: sobe rápido até a altura do voo e fica lá
      st.vy = 0;
      st.y = Math.min(FLY_Y, st.y + Math.max(2, (FLY_Y - st.y) * 6) * dt);
    } else {
      st.vy -= GRAVITY * dt * (st.invuln > 0 && st.y > TRAIN_H + 1 ? 0.55 : 1);
      st.y += st.vy * dt;
    }
    if (st.power.foguete > 0) { /* no ar */ } else if (st.y <= st.groundY && st.vy <= 0) {
      if (st.prevY > st.groundY + 0.5) { burst(st.x, st.groundY + 0.05, st.z, 7, ['#f5f5f4', '#d6d3d1'], 2.2, 0.4, 0.9, 2); onSound?.('land'); }
      st.y = st.groundY; st.vy = 0;
    } else if (st.y < st.groundY) st.y = st.groundY; // subindo a rampa
    const h = st.roll > 0 ? 0.8 : 1.75;
    for (const o of objects) {
      if (o.lane !== lane || o.ghost) continue;
      if (o.type === 'train') {
        // Segurança: se por algum motivo ficou dentro do trem, sobe para o teto
        if (st.z <= o.zNear && st.z >= o.zFar && st.y < TRAIN_H - 0.45) { st.y = TRAIN_H; st.vy = 0; }
      } else if ((o.type === 'low' || o.type === 'high') && st.z <= o.zNear && st.z >= o.zFar) {
        const bad = o.type === 'low' ? st.y < 0.9 : !(st.roll > 0) && st.y < 2.3;
        if (bad) {
          if (st.skate > 0 || st.invuln > 0 || st.power.foguete > 0) {
            // Com skate (ou piscando depois de uma batida): derruba a barreira e segue
            o.ghost = true;
            o.mesh.rotation.x = -1.3;
            o.mesh.position.y = 0.1;
            hit('front', null);
          } else {
            // Bateu de frente na barreira: acabou (como no trem). Fica na frente dela, nunca dentro.
            st.z = o.zNear + 0.45;
            caught('crash');
          }
        }
      }
    }
    const magnet = st.power.ima > 0;
    const val = st.power.estrela > 0 ? 2 : 1;
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      // Ímã: puxa as moedas por perto (qualquer trilho) até o personagem
      if (magnet && !c.mag && c.z < st.z + 1 && c.z > st.z - 26 && Math.abs(c.y - st.y) < 4.5) c.mag = true;
      let got = c.lane === lane && Math.abs(c.z - st.z) < 0.9 && Math.abs(c.y - (st.y + h / 2)) < 1.4;
      if (c.mag) {
        const m = c.mesh.position;
        const k = Math.min(1, dt * 9);
        m.x += (st.x - m.x) * k; m.y += (st.y + 1 - m.y) * k; c.z += (st.z - 0.2 - c.z) * k; m.z = c.z;
        c.y = m.y;
        got = got || (Math.abs(m.x - st.x) < 0.7 && Math.abs(c.z - st.z) < 0.9);
      }
      if (got) {
        st.coins += val;
        // moedas seguidas vão subindo o tom (até dar meio segundo sem pegar nenhuma)
        st.streak = st.t - (st.lastCoinAt ?? -9) < 0.5 ? (st.streak || 0) + 1 : 0;
        st.lastCoinAt = st.t;
        onSound?.('coinstreak', st.streak);
        burst(c.mesh.position.x, c.mesh.position.y, c.z, val > 1 ? 9 : 6, val > 1 ? ['#fde047', '#fb923c', '#ffffff'] : ['#fde047', '#fbbf24', '#ffffff'], 2.6, 0.4, 0.75, 2, true);
        dropCoin(c.mesh);
        coins.splice(i, 1);
      } else if (c.z > st.z + 14) { dropCoin(c.mesh); coins.splice(i, 1); }
    }
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      if (pu.lane === lane && Math.abs(pu.z - st.z) < 1.1 && Math.abs(st.y + 0.9 - pu.mesh.position.y) < 1.7) {
        activate(pu.type);
        scene.remove(pu.mesh);
        powerups.splice(i, 1);
      } else if (pu.z > st.z + 14) { scene.remove(pu.mesh); powerups.splice(i, 1); }
    }
    while (st.nextRowZ > st.z - 175) spawnRow();
    for (let i = objects.length - 1; i >= 0; i--) if (objects[i].zFar > st.z + 16) { scene.remove(objects[i].mesh); objects.splice(i, 1); }
  }

  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _v3 = new THREE.Vector3();
  const onCarga = () => objects.some((o) => o.kind === 'carga' && o.lane === Math.round(st.x / LANE_W) && st.z <= o.zNear && st.z >= o.zFar);
  const bone = (m, n, out) => m.userData.rig.getObjectByName(n).getWorldPosition(out);
  /**
   * Fim da corrida: o personagem cai de costas, o guarda chega, agacha, pega por um tornozelo,
   * levanta de cabeça para baixo e vai embora carregando (a câmera mostra de lado).
   */
  function endScene(s, dt) {
    const crash = st.dead === 'crash';
    const T_DOWN = crash ? 0.45 : 0.35;
    const T_GRAB = 1.35;
    const T_LIFT = 1.8;
    const T_UP = 2.45;
    const T_GO = 2.9;
    const ax = st.deadX;
    // o personagem cai de costas (um pouquinho para trás na batida de frente): pés em fz, cabeça para +z
    const fz = st.deadZ + (crash ? 0.8 : 0.2);
    // o guarda passa correndo do lado, para nos pés e vira de frente para o personagem
    const side = ax + (st.lane >= 1 ? -0.85 : 0.85);
    const gz = fz - 0.62;
    if (s < T_LIFT) {
      // caindo e caído no chão
      const back = crash ? Math.sin(Math.min(1, s / T_DOWN) * Math.PI * 0.5) * 0.8 : 0.2;
      player.position.set(ax, 0, st.deadZ + back);
      player.rotation.set(0, 0, 0);
      poseAvatar(player, s < T_DOWN ? (crash ? 'crash' : 'stumble') : 'down', st.t);
    }
    // o guarda chega correndo e para do lado do pé
    officer.visible = true;
    const walk = s > T_GO ? (s - T_GO) * 1.25 : 0;
    if (s < T_GRAB) {
      const k = Math.min(1, s / T_GRAB);
      const from = st.deadZ + st.officerDist;
      const ez = 1 - (1 - k) ** 2;
      // corre do lado do personagem (sem atravessar) e no fim entra no trilho, nos pés dele
      const inLane = Math.max(0, (k - 0.75) / 0.25);
      officer.position.set(side + (ax - side) * inLane, 0, from + (gz - from) * ez);
      officer.rotation.set(0, k > 0.85 ? Math.PI * Math.min(1, (k - 0.85) / 0.15) : 0, 0);
      poseAvatar(officer, 'run', st.t + 0.3);
    } else {
      officer.position.set(ax, 0, gz + walk);
      officer.rotation.set(0, Math.PI, 0); // virado para o personagem e depois vai embora carregando
      poseAvatar(officer, s < T_LIFT ? 'grab' : s < T_GO ? 'hold' : 'carry', st.t);
      // o braço do guarda desce até o tornozelo e depois sobe, segurando o personagem na frente dele
      const up = Math.min(1, Math.max(0, (s - T_LIFT) / (T_UP - T_LIFT)));
      const reach = Math.min(1, (s - T_GRAB) / 0.25);
      const dir = _v3.set(0.12, -0.75 + up * 1.55, 0.7 - up * 0.15).normalize();
      aimBone(officer, 'upperarm_l', 'lowerarm_l', dir, reach);
      aimBone(officer, 'lowerarm_l', 'hand_l', dir, reach);
      if (s >= T_LIFT) {
        const hand = bone(officer, 'hand_l', _v1);
        // de cabeça para baixo pendurado pelo tornozelo; enquanto sobe, o corpo vai de deitado a reto
        poseAvatar(player, 'caught', st.t);
        const L = 1.85;
        const ang = Math.asin(Math.min(1, Math.max(0, (hand.y - 0.18) / L)));
        player.rotation.set(Math.PI / 2 + ang, 0, Math.sin(st.t * 2.2) * 0.08 * up);
        player.position.set(hand.x, 0, hand.z);
        player.updateMatrixWorld(true);
        // a perna presa fica reta, apontando para a mão
        const legDir = _v2.set(0, 1, 0);
        aimBone(player, 'thigh_r', 'calf_r', legDir.copy(hand).sub(bone(player, 'thigh_r', _v2)).normalize());
        aimBone(player, 'calf_r', 'foot_r', legDir.copy(hand).sub(bone(player, 'calf_r', _v2)).normalize());
        const foot = bone(player, 'foot_r', _v2);
        player.position.add(_v3.copy(hand).sub(foot));
        player.position.y += 0.04;
      }
    }
    // câmera de lado mostrando o guarda levando o personagem
    if (s > 0.35) {
      const want = _v2.set(ax + 3.8, 2.2, fz + 2.8 + walk * 0.9);
      camera.position.lerp(want, Math.min(1, dt * 2.4));
      camera.lookAt(ax, 1.45, fz + 0.4 + walk * 0.9);
    } else {
      camera.position.y += (3 - camera.position.y) * dt * 3;
      camera.lookAt(ax, 1, st.deadZ);
    }
  }

  // ───────────── Laço ─────────────
  let raf = 0;
  let last = 0;
  let hudAt = 0;
  let clock = 0;
  const camIntro = new THREE.Vector3(-4.2, 3.0, 4.4);
  const camLook = new THREE.Vector3(1.0, 0.6, 8.6);
  const camStory = new THREE.Vector3(-1.5, 3.4, 15.5);
  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    // Pausado: a cena fica parada (só desenha de novo)
    if (st.paused) { renderer.render(scene, camera); return; }
    clock += dt;
    if (st.phase === 'run') { if (st.alive) stepRun(dt); else st.t += dt; }
    fx.update(dt);
    for (const c of coins) { c.mesh.rotation.y = clock * 3; if (!c.mag) c.mesh.position.y = c.y + Math.sin(clock * 3 + c.z) * 0.06; }
    for (const pu of powerups) {
      const u = pu.mesh.userData;
      pu.mesh.position.y = 1.3 + Math.sin(clock * 2.5 + pu.z) * 0.15;
      u.icon.rotation.y = clock * 2;
      u.ring.rotation.set(Math.PI / 2 + Math.sin(clock * 1.7) * 0.4, clock * 1.3, 0);
      u.glow.material.opacity = 0.55 + Math.sin(clock * 5) * 0.2;
    }
    for (const s of scenery) while (s.position.z > st.z + 26) s.position.z -= STEP * 15;
    ground.position.z = st.z - 90; side.position.z = st.z - 90; rails.position.z = st.z - 90;
    for (const c of clouds) c.position.z = st.z - 150;
    trackTex.offset.y = (st.z / 260) * 40;

    if (st.phase === 'menu' || st.phase === 'story') {
      // Abertura: pichando o símbolo no trem; na história o guarda chega apitando
      player.position.set(laneX(1) - 1.9, 0, 8.6);
      const turn = st.phase === 'story' ? Math.min(1, Math.max(0, (st.story - 1.7) * 2.5)) : 0;
      player.rotation.y = -Math.PI / 2 + turn * (Math.PI / 2);
      poseAvatar(player, turn > 0 ? 'idle' : 'spray', clock);
      if (st.phase === 'menu' || st.story < 1.6) {
        const k = st.phase === 'menu' ? (clock * 0.11) % 1.3 : 0.55 + st.story * 0.45;
        const p = graffiti.paint(k);
        // jato de tinta saindo do bico da lata até o ponto que está sendo pintado
        const noz = player.userData.can.userData.nozzle.getWorldPosition(_v1);
        const tx = decal.position.x - 0.04;
        const ty = 1.95 + (0.5 - p.y) * 2.2;
        const tz = 8.6 + (p.x - 0.5) * 2.2;
        for (let i = 0; i < 2; i++) {
          const f = Math.random();
          burst(noz.x + (tx - noz.x) * f, noz.y + (ty - noz.y) * f, noz.z + (tz - noz.z) * f, 1, ['#facc15', '#ef4444', '#2563eb'], 0.25, 0.25, 0.3 + f * 0.4, 0);
        }
      }
      if (st.phase === 'story') {
        st.story += dt;
        officer.visible = true;
        officer.position.set(laneX(-1) + 0.6, 0, Math.max(11, 24 - st.story * 7));
        officer.rotation.y = 0;
        poseAvatar(officer, st.story < 1.9 ? 'run' : 'hold', clock);
      } else officer.visible = false;
      camera.position.lerp(st.phase === 'story' && st.story > 1.7 ? camStory : camIntro, Math.min(1, dt * 2.2));
      camera.lookAt(camLook);
      renderer.render(scene, camera);
      return;
    }
    // Correndo
    const onSkate = st.skate > 0 && st.alive;
    const air = st.y > st.groundY + 0.25;
    const lie = onSkate && st.roll > 0;
    const sinceDead = st.t - st.deadAt;
    const flying = st.power.foguete > 0 && st.alive;
    const pogoOn = st.power.pulapula > 0 && st.alive && !onSkate;
    if (!st.alive && st.dead) {
      endScene(sinceDead, dt);
    } else {
      const lift = onSkate && !lie ? 0.2 : onSkate ? 0.08 : pogoOn ? 0.62 : 0;
      player.position.set(st.x + st.bump * 0.45, st.y + lift, st.z);
      // inclina para o lado ao trocar de trilho; no tropeço o corpo dá um tranco para a frente
      const trip = st.stumble > 0 ? Math.sin((1 - st.stumble / 0.7) * Math.PI) * 0.35 : 0;
      player.rotation.set(trip, (laneX(st.lane) - st.x) * -0.12 - st.bump * 0.5, (laneX(st.lane) - st.x) * 0.06);
      let state = lie ? 'skatelie' : st.roll > 0 ? 'roll' : st.stumble > 0 ? 'stumble' : onSkate ? 'skate' : air ? 'jump' : 'run';
      if (flying) state = 'fly';
      else if (pogoOn && st.roll <= 0) state = 'pogo';
      poseAvatar(player, state, st.t);
      // correndo em cima da terra do vagão: levanta poeira
      if (!air && st.groundY > TRAIN_H - 0.1 && Math.random() < 0.5 && onCarga()) dust(st.x, st.y + 0.05, st.z + 0.3, 2, ['#8b6b4a', '#a0805c'], 1.6, 0.5, 0.35, 5);
    }
    // Foguete nas costas (preso nas costas, com fogo e rastro), pula-pula nos pés, ímã e estrela
    rocketPack.visible = flying;
    if (flying) {
      const back = player.userData.rig.getObjectByName('spine_03').getWorldPosition(_v1);
      const pitch = 0.42;
      rocketPack.position.set(back.x, back.y + Math.sin(pitch) * 0.24 - 0.12, back.z + Math.cos(pitch) * 0.24);
      rocketPack.rotation.set(-pitch, 0, 0);
      const f = rocketPack.userData.flame;
      f.scale.set(1, 0.8 + Math.random() * 0.5, 1);
      if (Math.random() < 0.85) burst(back.x + rnd(-0.12, 0.12), back.y - 0.75, back.z + 0.55, 1, ['#fb923c', '#f97316', '#fde047'], 1.0, 0.45, 0.65, -1.5);
    }
    pogo.visible = pogoOn;
    if (pogoOn) {
      pogo.position.set(st.x, st.y, st.z - 0.05);
      const squash = air ? 1 : 0.8 + Math.abs(Math.sin(clock * 10)) * 0.2;
      pogo.userData.spring.scale.y = squash;
    }
    magnetRing.visible = st.power.ima > 0 && st.alive;
    if (magnetRing.visible) {
      magnetRing.position.set(st.x, st.y + 0.08, st.z);
      const pulse = 1 + Math.sin(clock * 8) * 0.12;
      magnetRing.scale.set(pulse, pulse, 1);
      magnetRing.material.opacity = st.power.ima < 2 ? (Math.sin(clock * 20) > 0 ? 0.6 : 0.15) : 0.6;
    }
    if (st.power.estrela > 0 && st.alive && Math.random() < 0.35) burst(st.x + rnd(-0.4, 0.4), st.y + rnd(0.4, 1.8), st.z + 0.2, 1, ['#fde047', '#ffffff'], 0.6, 0.5, 0.7, 0, true);
    skate.visible = onSkate && !flying;
    if (skate.visible) {
      skate.position.set(st.x, st.y, st.z);
      skate.rotation.y = player.rotation.y;
      poseBoard(skate, clock, 0);
      // pés apoiados na lixa (ou deitado na prancha); no pulo o skate gira embaixo dos pés
      standOnBoard(player, skate, bodyPoint, lie);
      if (st.flip >= 0) poseBoard(skate, clock, st.flip);
    }
    // Terra caindo pelas beiradas dos vagões abertos perto do jogador
    for (const o of objects) {
      if (o.kind !== 'carga' || o.zFar > st.z + 6 || o.zNear < st.z - 70) continue;
      const rate = o.v ? 0.9 : 0.25;
      if (Math.random() > rate) continue;
      const e = o.mesh.userData.edges[Math.floor(Math.random() * o.mesh.userData.edges.length)];
      const z = o.mesh.position.z + rnd(e[1] + 0.4, e[0] - 0.4);
      const sd = Math.random() < 0.5 ? -1 : 1;
      dust(laneX(o.lane) + sd * (TRAIN_W / 2 + 0.05), TRAIN_H - 0.12, z, 1 + (Math.random() < 0.3 ? 1 : 0), ['#6b4a2b', '#7c5a3a', '#5a3d22'], 0.5, 1.1, 0.32, 9);
    }
    if (st.alive) {
      const close = st.t - st.hitAt < CATCH_WINDOW || st.t < 2.5;
      const target = close ? 2.3 : 16;
      st.officerDist += (target - st.officerDist) * Math.min(1, dt * 1.6);
      officer.visible = true;
      officer.position.set(st.x + (st.lane <= 0 ? 0.8 : -0.8), Math.min(st.y, 0.01), st.z + st.officerDist);
      officer.rotation.set(0, 0, 0);
      poseAvatar(officer, 'run', st.t + 0.3);
      const sh = st.shake > 0 ? st.shake * 0.5 : 0;
      const want = _v2.set(st.x * 0.75 + rnd(-sh, sh), (flying ? 3.2 + st.y * 0.85 : 4.9 + st.y * 0.6) + rnd(-sh, sh), st.z + (flying ? 6.6 : 7.6));
      camera.position.lerp(want, Math.min(1, dt * 8));
      camera.lookAt(st.x * 0.85, flying ? st.y - 0.6 : 1.1 + st.y * 0.65, st.z - 8);
    }
    sun.position.set(st.x - 8, 20, st.z + 6);
    sun.target.position.set(st.x, 0, st.z - 4);
    renderer.render(scene, camera);
    if (now - hudAt > 100) {
      hudAt = now;
      const close = st.alive && st.t - st.hitAt < CATCH_WINDOW;
      onHud?.({ coins: st.coins, dist: Math.floor(st.dist), close: close && st.t > 2.5 && !flying, skate: st.skate, skateWait: st.skateWait, power: { ...st.power } });
    }
  }

  function resize() {
    const w = canvas.clientWidth || 360;
    const h = canvas.clientHeight || 640;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new window.ResizeObserver(resize);
  ro.observe(canvas);
  camera.position.copy(camIntro);
  // Prepara antes (texturas e sombreadores) tudo o que vai aparecer, para não dar travadinha na corrida
  {
    const warm = warmTrains();
    warm.forEach((w, i) => { w.position.set(i * 3 - 3, 0, -30); scene.add(w); });
    const pu = POWER_TYPES.map((t, i) => { const m = makePowerup(t); m.position.set(i, 1, -20); scene.add(m); return m; });
    const c = makeCoin(); c.position.set(0, 1, -18); scene.add(c);
    rocketPack.visible = pogo.visible = magnetRing.visible = officer.visible = true;
    try { renderer.compile(scene, camera); } catch { /* sem problema */ }
    [...warm, ...pu, c].forEach((w) => scene.remove(w));
    rocketPack.visible = pogo.visible = magnetRing.visible = officer.visible = false;
  }
  raf = window.requestAnimationFrame(frame);

  return {
    input,
    useSkate,
    /** História: termina de pichar, o guarda chega apitando e a corrida começa. */
    story() {
      st.phase = 'story';
      st.story = 0;
      onSound?.('spray');
      setTimeout(() => onSound?.('whistle'), 1500);
    },
    start() {
      graffiti.full();
      st.phase = 'run';
      st.t = 0;
      st.hitAt = -100;
      st.z = 8.6; st.x = 0; st.lane = 0;
      st.officerDist = 2.3;
    },
    setLook(sk, bd) {
      scene.remove(player);
      player = shadowed(withCan(buildAvatar(skinById(sk), 'surf')));
      scene.add(player);
      scene.remove(skate);
      skate = buildBoard(boardById(bd));
      skate.visible = false;
      scene.add(skate);
    },
    /** Para os testes automáticos. */
    _debug: {
      st, addTrain, addRamp, activate, addPowerup,
      clear() { for (const o of objects) scene.remove(o.mesh); objects.length = 0; st.nextRowZ = st.z - 400; },
    },
    pause() { if (st.phase === 'run' && st.alive) st.paused = true; return st.paused; },
    resume() { st.paused = false; },
    giveUp() { if (st.alive && st.phase === 'run') { st.alive = false; finish(); } },
    dispose() {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
    },
  };
}
