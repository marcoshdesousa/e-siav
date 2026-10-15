// Surf DBV: corrida infinita em 3D nos trilhos (estilo "subway runner").
// Três trilhos: deslize para os lados para trocar, para cima para pular e para baixo para rolar.
// Trens parados e andando, rampas para o teto, barreiras baixas (pule) e altas (role), skate.
// Bater de frente num trem acaba a corrida (o personagem para na frente do trem, nunca entra).
// Esbarrar ou bater numa barreira: tropeça e o guarda chega perto. De novo com ele perto: pegou!
import * as THREE from 'three';
import { makeCoin, makeTrain, toon, TRAIN_H } from './models.js';
import { buildAvatar, poseAvatar, studioEnv } from '../avatar/build.js';
import { createParticles, makePogo, makePowerup, makeRocket, POWERS, POWER_TYPES } from './powerups.js';
import { buildBoard, poseBoard } from '../avatar/board.js';
import { boardById, skinById } from '../avatar/skins.js';

/** O guarda que corre atrás. */
const OFFICER = {
  id: 'guarda', name: 'Guarda', g: 'm', skin: '#d9a07a', hair: 'curto', hairColor: '#1f2937', eyes: '#3b2a1a', shoes: '#111827', shoes2: '#111827',
  top: { type: 'jaqueta', color: '#1e3a8a', color2: '#facc15' }, bottom: { type: 'calca', color: '#172554' }, hat: { type: 'bone', color: '#172554' },
};

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

function trackTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#8a7f72'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const v = 70 + Math.random() * 80; g.fillStyle = `rgba(${v},${v - 8},${v - 18},.55)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3); }
    for (let l = 0; l < 3; l++) {
      const cx = ((l + 0.5) / 3) * w;
      for (let y = 0; y < h; y += 42) {
        const gr = g.createLinearGradient(0, y, 0, y + 18);
        gr.addColorStop(0, '#6b4a2e'); gr.addColorStop(1, '#4a3220');
        g.fillStyle = gr; g.fillRect(cx - 66, y + 10, 132, 18);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - 66, y + 28, 132, 4);
      }
    }
  }, [1, 40]);
}
function wallTexture(seed) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = ['#8f4a37', '#7c6f64', '#6b7280', '#9a5b3c'][seed % 4]; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2;
    for (let y = 0; y < h; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (y / 22) % 2 ? 22 : 0; x < w; x += 44) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 22); g.stroke(); } }
    const cols = ['#f472b6', '#22d3ee', '#a3e635', '#facc15', '#c084fc', '#fb923c'];
    for (let k = 0; k < 2; k++) {
      g.save();
      g.translate(60 + k * 240 + (seed * 13) % 60, 150);
      g.rotate(-0.1 + k * 0.08);
      g.font = 'bold 58px "Arial Black", Arial';
      g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = '#111';
      const word = ['JESUS', 'FÉ', 'AMOR', 'PAZ', 'DBV', 'ALEGRIA'][(seed + k * 3) % 6];
      g.strokeText(word, 0, 0);
      g.fillStyle = cols[(seed + k) % cols.length]; g.fillText(word, 0, 0);
      g.restore();
    }
  }, [3, 1]);
}
function buildingTexture(base) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 24; y < h - 20; y += 52) for (let x = 18; x < w - 18; x += 56) {
      g.fillStyle = Math.random() < 0.3 ? '#fde68a' : '#1e293b'; g.fillRect(x, y, 34, 38);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, 34, 6);
    }
  });
}
function stripesTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#dc2626';
    for (let x = -h; x < w + h; x += 64) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 32, h); g.lineTo(x + 32 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  });
}
function skyTexture() {
  return canvasTex(16, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3b82f6'); gr.addColorStop(0.55, '#7dd3fc'); gr.addColorStop(1, '#fde7c4');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
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
  scene.fog = new THREE.Fog('#cfe9ff', 70, 160);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 240);

  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a66', 1.35));
  const sun = new THREE.DirectionalLight('#fff4dc', 1.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 18, bottom: -18, near: 1, far: 70 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  // Chão com dormentes, trilhos de verdade e o cascalho dos lados
  const trackTex = trackTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 3 + 1, 260), new THREE.MeshLambertMaterial({ map: trackTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(90, 260), new THREE.MeshLambertMaterial({ color: '#a8a29e' }));
  side.rotation.x = -Math.PI / 2;
  side.position.y = -0.02;
  scene.add(side);
  const rails = new THREE.Group();
  const railMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.35 });
  for (let l = -1; l <= 1; l++) for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 260), railMat);
    r.position.set(l * LANE_W + s * 0.55, 0.07, 0);
    r.receiveShadow = true;
    rails.add(r);
  }
  scene.add(rails);

  // Cenário que se repete: muros grafitados, prédios, postes com luz e árvores
  const scenery = [];
  const STEP = 16;
  const wallMats = [0, 1, 2, 3].map((k) => new THREE.MeshLambertMaterial({ map: wallTexture(k) }));
  const bldMats = ['#64748b', '#9a3412', '#475569', '#78716c', '#1e40af', '#b45309'].map((c) => new THREE.MeshLambertMaterial({ map: buildingTexture(c) }));
  for (let i = 0; i < 15; i++) {
    for (const s of [-1, 1]) {
      const grp = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.8, STEP), wallMats[(i * 2 + (s > 0 ? 1 : 0)) % 4]);
      wall.position.set(s * (LANE_W * 1.5 + 1.3), 1.4, 0);
      wall.receiveShadow = true;
      const h = 10 + ((i * 7 + (s > 0 ? 3 : 0)) % 5) * 4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(9, h, STEP - 2), bldMats[(i + (s > 0 ? 2 : 0)) % bldMats.length]);
      b.position.set(s * (LANE_W * 1.5 + 7.5), h / 2, 0);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.5, STEP - 1.6), toon('#334155'));
      roof.position.set(b.position.x, h + 0.25, 0);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6.5, 8), toon('#374151'));
      pole.position.set(s * (LANE_W * 1.5 + 0.8), 3.25, STEP / 2 - 1);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), toon('#374151'));
      arm.position.set(s * (LANE_W * 1.5 + 0.2), 6.4, STEP / 2 - 1);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#fef3c7' }));
      lamp.position.set(s * (LANE_W * 1.5 - 0.4), 6.25, STEP / 2 - 1);
      grp.add(wall, b, roof, pole, arm, lamp);
      if ((i + (s > 0 ? 1 : 0)) % 3 === 0) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 2, 8), toon('#7c4a1e'));
        trunk.position.y = 1;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), toon('#16a34a'));
        crown.position.y = 2.6;
        tree.add(trunk, crown);
        tree.position.set(s * (LANE_W * 1.5 + 3), 0, -STEP / 4);
        grp.add(tree);
      }
      grp.position.z = -i * STEP + 24;
      scene.add(grp);
      scenery.push(grp);
    }
  }

  const stripeMat = new THREE.MeshLambertMaterial({ map: stripesTexture() });

  // Jogador, guarda, skate
  const shadowed = (m) => { m.traverse((o) => { if (o.isMesh && o.material.type !== 'MeshBasicMaterial') o.castShadow = true; }); return m; };
  let player = shadowed(buildAvatar(skinById(skin), 'surf'));
  scene.add(player);
  const officer = shadowed(buildAvatar(OFFICER, 'surf'));
  officer.scale.setScalar(1.08);
  officer.visible = false;
  scene.add(officer);
  let skate = buildBoard(boardById(board));
  skate.visible = false;
  scene.add(skate);

  // Partículas brilhantes (poeira, brilho das moedas, explosão do skate, tinta do spray, poderes)
  const fx = createParticles(scene);
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
    stumble: 0, shake: 0, skate: 0, skateWait: 0, invuln: 0, story: 0, flip: -1, dead: null, deadAt: 0, deadZ: 0,
    power: { ima: 0, estrela: 0, foguete: 0, pulapula: 0 }, lastPowerAt: 0,
  };
  const objects = [];
  const coins = [];
  const laneX = (l) => l * LANE_W;

  function addTrain(lane, zNear, len, moving, plain = false) {
    const m = makeTrain(len, plain ? 2 : Math.floor(Math.random() * 1000), moving, plain);
    m.position.set(laneX(lane), 0, zNear);
    scene.add(m);
    const o = { type: 'train', lane, zNear, zFar: zNear - len, mesh: m, v: moving ? rnd(8, 13) : 0 };
    objects.push(o);
    return o;
  }
  function addRamp(lane, zNear, len) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(len, TRAIN_H); shape.lineTo(len, 0); shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.9, bevelEnabled: false });
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, toon('#94a3b8'));
    m.rotation.y = Math.PI / 2;
    m.position.set(-0.95, 0, 0);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    for (let k = 1; k < len; k += 1.2) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 0.25), toon('#facc15'));
      step.position.set(0, (k / len) * TRAIN_H + 0.04, -k);
      step.rotation.x = Math.atan2(TRAIN_H, len);
      g.add(step);
    }
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
  function addCoin(lane, z, y = 1) {
    const m = makeCoin();
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
    if (bh > 0.6 && st.y < bh - 0.35) { hit('side', null); return; }
    st.lane = nl;
    onSound?.('whoosh');
  }
  function jump() {
    if (!playing()) return;
    if (st.power.foguete > 0) return;
    if (st.y <= st.groundY + 0.06) {
      const pg = st.power.pulapula > 0;
      st.vy = pg ? JUMP_V * 1.62 : JUMP_V;
      st.roll = 0;
      onSound?.(pg ? 'boing' : 'jump');
      if (st.skate > 0) st.flip = 0;
      if (pg) burst(st.x, st.groundY + 0.1, st.z, 10, ['#86efac', '#ffffff'], 3, 0.45, 0.8, 4);
    }
  }
  function roll() {
    if (!playing() || st.power.foguete > 0) return;
    st.roll = ROLL_TIME;
    if (st.y > st.groundY + 0.06) st.vy = -JUMP_V * 1.3;
    onSound?.('whoosh');
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
    burst(st.x, 0.3, st.z - 0.4, 14, ['#d6d3d1', '#a8a29e', '#78716c'], 3, 0.6);
    onHud?.({ warn: kind === 'side' ? 'Esbarrou! O guarda está chegando!' : 'Bateu! O guarda está perto!' });
  }
  function caught(how) {
    if (!st.alive) return;
    st.alive = false;
    st.dead = how;
    st.deadAt = st.t;
    st.deadZ = st.z;
    st.roll = 0;
    st.shake = how === 'crash' ? 0.7 : 0.6;
    onSound?.('crash');
    if (how === 'crash') onHud?.({ warn: 'Bateu de frente no trem!' });
    setTimeout(() => onSound?.('whistle'), 400);
    setTimeout(() => finish(), 2000);
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
    for (const o of objects) if (o.v) { o.zNear += o.v * dt; o.zFar += o.v * dt; o.mesh.position.z += o.v * dt; }
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
      if (st.prevY > st.groundY + 0.5) burst(st.x, st.groundY + 0.05, st.z, 7, ['#f5f5f4', '#d6d3d1'], 2.2, 0.4, 0.9, 2);
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
          // Derruba a barreira e tropeça
          o.ghost = true;
          o.mesh.rotation.x = -1.3;
          o.mesh.position.y = 0.1;
          hit('front', null);
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
        onSound?.('coin');
        burst(c.mesh.position.x, c.mesh.position.y, c.z, val > 1 ? 9 : 6, val > 1 ? ['#fde047', '#fb923c', '#ffffff'] : ['#fde047', '#fbbf24', '#ffffff'], 2.6, 0.4, 0.75, 2, true);
        scene.remove(c.mesh);
        coins.splice(i, 1);
      } else if (c.z > st.z + 14) { scene.remove(c.mesh); coins.splice(i, 1); }
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
        if (Math.random() < 0.6) {
          const tx = decal.position.x - 0.05;
          const ty = 1.95 + (0.5 - p.y) * 2.2;
          const tz = 8.6 + (p.x - 0.5) * 2.2;
          burst(tx - 0.25, ty, tz, 1, ['#facc15', '#ef4444', '#2563eb'], 0.4, 0.3, 0.45, 0);
        }
      }
      if (st.phase === 'story') {
        st.story += dt;
        officer.visible = true;
        officer.position.set(laneX(-1) + 0.6, 0, Math.max(11, 24 - st.story * 7));
        officer.rotation.y = 0;
        poseAvatar(officer, st.story < 1.9 ? 'run' : 'caught', clock);
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
    const deadK = Math.min(1, (st.t - st.deadAt) / 0.45);
    let pz = st.z;
    if (st.dead === 'crash') pz = st.deadZ + Math.sin(deadK * Math.PI * 0.5) * 0.7; // quica para trás
    const flying = st.power.foguete > 0 && st.alive;
    const pogoOn = st.power.pulapula > 0 && st.alive && !onSkate;
    const lift = onSkate && !lie ? 0.2 : onSkate ? 0.08 : pogoOn ? 0.62 : 0;
    player.position.set(st.x, st.y + lift, pz);
    player.rotation.y = (laneX(st.lane) - st.x) * -0.12;
    let state = st.dead === 'crash' ? 'crash' : !st.alive ? 'caught' : lie ? 'skatelie' : st.roll > 0 ? 'roll' : st.stumble > 0 ? 'stumble' : onSkate ? 'skate' : air ? 'jump' : 'run';
    if (flying) state = 'fly';
    else if (pogoOn && st.alive && st.roll <= 0) state = 'pogo';
    poseAvatar(player, state, st.t, st.dead === 'crash' ? deadK : 1 - st.stumble / 0.7);
    if (st.dead === 'caught') player.rotation.y = Math.PI;
    // Foguete nas costas (com fogo e rastro), pula-pula nos pés, anel do ímã e brilho da estrela
    rocketPack.visible = flying;
    if (flying) {
      rocketPack.position.set(st.x, st.y + 1.15, pz + 0.32);
      rocketPack.rotation.set(-0.55, 0, 0);
      const f = rocketPack.userData.flame;
      f.scale.set(1, 0.8 + Math.random() * 0.5, 1);
      if (Math.random() < 0.8) burst(st.x + rnd(-0.15, 0.15), st.y + 0.75, pz + 0.75, 1, ['#fb923c', '#f97316', '#f87171'], 1.2, 0.4, 0.6, -2);
    }
    pogo.visible = pogoOn;
    if (pogoOn) {
      pogo.position.set(st.x, st.y, pz - 0.05);
      const squash = air ? 1 : 0.8 + Math.abs(Math.sin(clock * 10)) * 0.2;
      pogo.userData.spring.scale.y = squash;
    }
    magnetRing.visible = st.power.ima > 0 && st.alive;
    if (magnetRing.visible) {
      magnetRing.position.set(st.x, st.y + 0.08, pz);
      const pulse = 1 + Math.sin(clock * 8) * 0.12;
      magnetRing.scale.set(pulse, pulse, 1);
      magnetRing.material.opacity = st.power.ima < 2 ? (Math.sin(clock * 20) > 0 ? 0.6 : 0.15) : 0.6;
    }
    if (st.power.estrela > 0 && st.alive && Math.random() < 0.35) burst(st.x + rnd(-0.4, 0.4), st.y + rnd(0.4, 1.8), pz + 0.2, 1, ['#fde047', '#ffffff'], 0.6, 0.5, 0.7, 0, true);
    skate.visible = onSkate && !flying;
    if (skate.visible) {
      skate.position.set(st.x, st.y, st.z);
      skate.rotation.y = player.rotation.y;
      poseBoard(skate, clock, st.flip);
    }
    const close = st.t - st.hitAt < CATCH_WINDOW || st.t < 2.5;
    const target = !st.alive ? (st.dead === 'crash' ? 1.6 : 0.9) : close ? 2.3 : 16;
    st.officerDist += (target - st.officerDist) * Math.min(1, dt * (st.alive ? 1.6 : 4));
    officer.visible = true;
    officer.position.set(st.x + (st.lane <= 0 ? 0.8 : -0.8), Math.min(st.y, 0.01), pz + st.officerDist);
    officer.rotation.y = 0;
    poseAvatar(officer, st.alive || st.officerDist > 2 ? 'run' : 'caught', st.t + 0.3);
    const sh = st.shake > 0 ? st.shake * 0.5 : 0;
    const want = new THREE.Vector3(st.x * 0.75 + rnd(-sh, sh), (flying ? 3.2 + st.y * 0.85 : 4.9 + st.y * 0.6) + rnd(-sh, sh), st.z + (flying ? 6.6 : 7.6));
    camera.position.lerp(want, Math.min(1, dt * 8));
    camera.lookAt(st.x * 0.85, flying ? st.y - 0.6 : 1.1 + st.y * 0.65, st.z - 8);
    sun.position.set(st.x - 8, 20, st.z + 6);
    sun.target.position.set(st.x, 0, st.z - 4);
    renderer.render(scene, camera);
    if (now - hudAt > 100) {
      hudAt = now;
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
      player = shadowed(buildAvatar(skinById(sk), 'surf'));
      scene.add(player);
      scene.remove(skate);
      skate = buildBoard(boardById(bd));
      skate.visible = false;
      scene.add(skate);
    },
    /** Para os testes automáticos. */
    _debug: { st, addTrain, activate, addPowerup },
    giveUp() { if (st.alive && st.phase === 'run') { st.alive = false; finish(); } },
    dispose() {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
    },
  };
}
