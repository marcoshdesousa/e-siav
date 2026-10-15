// Corrida DBV: corrida infinita em 3D nos trilhos (estilo "subway runner").
// Três trilhos: deslize para os lados para trocar, para cima para pular e para baixo para rolar.
// Trens parados e andando, rampas para o teto, barreiras baixas (pule) e altas (role), skate.
// Bateu uma vez: tropeça e o guarda chega perto. Bateu de novo com ele perto: pegou!
import * as THREE from 'three';
import { makeCoin, makeRunner, makeSkate, makeTrain, pose, toon, TRAIN_H } from './models.js';

const LANE_W = 2.4;
const GRAVITY = 40;
const JUMP_V = 13;
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

export function createRunner(canvas, { female = false, onHud, onEnd, onSound }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#cfe9ff', 70, 160);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 240);

  scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a66', 1.5));
  const sun = new THREE.DirectionalLight('#fff4dc', 1.8);
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
  let player = makeRunner({ female });
  scene.add(player);
  const officer = makeRunner({ officer: true });
  officer.visible = false;
  scene.add(officer);
  const skate = makeSkate();
  skate.visible = false;
  scene.add(skate);

  // Partículas (poeira, brilho das moedas, explosão do skate, tinta do spray)
  const parts = [];
  const pGeo = new THREE.SphereGeometry(0.08, 6, 4);
  function burst(x, y, z, n, colors, speed = 5, life = 0.7, size = 1, grav = 12) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
      m.position.set(x, y, z);
      m.scale.setScalar(size * rnd(0.6, 1.4));
      scene.add(m);
      parts.push({ m, vx: rnd(-1, 1) * speed, vy: rnd(0.3, 1.2) * speed, vz: rnd(-1, 1) * speed, life, max: life, grav });
    }
  }

  const st = {
    z: 8.6, lane: 0, x: 0, y: 0, prevY: 0, vy: 0, roll: 0, speed: START_SPEED, t: 0, coins: 0, dist: 0,
    groundY: 0, alive: true, phase: 'menu', hitAt: -100, officerDist: 2.2, nextRowZ: -26, slow: 0, over: false,
    stumble: 0, shake: 0, skate: 0, skateWait: 0, invuln: 0, story: 0,
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
  const trainAt = (lane, z, pad = 0) => objects.find((o) => o.type === 'train' && !o.ghost && o.lane === lane && z <= o.zNear + pad && z >= o.zFar - pad);
  function move(d) {
    if (!playing()) return;
    const nl = Math.max(-1, Math.min(1, st.lane + d));
    if (nl === st.lane) return;
    const tr = trainAt(nl, st.z, 0.3);
    if (tr && st.y < TRAIN_H - 0.35) { hit('side', tr); return; }
    st.lane = nl;
    onSound?.('whoosh');
  }
  function jump() {
    if (!playing()) return;
    if (st.y <= st.groundY + 0.06) { st.vy = JUMP_V; st.roll = 0; onSound?.('jump'); }
  }
  function roll() {
    if (!playing()) return;
    st.roll = ROLL_TIME;
    if (st.y > st.groundY + 0.06) st.vy = -JUMP_V * 1.3;
    onSound?.('whoosh');
  }
  const input = { left: () => move(-1), right: () => move(1), up: jump, down: roll };
  function useSkate() {
    if (!playing() || st.skate > 0 || st.skateWait > 0) return false;
    st.skate = SKATE_TIME;
    onSound?.('skate');
    burst(st.x, st.y + 0.2, st.z, 14, ['#38bdf8', '#facc15', '#ffffff'], 4, 0.5);
    return true;
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
    if (!st.alive || st.invuln > 0) return;
    if (obj && kind !== 'side') ghost(obj);
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
    if (st.t - st.hitAt < CATCH_WINDOW) { caught(); return; }
    st.hitAt = st.t;
    st.slow = 0.9;
    st.stumble = 0.7;
    st.invuln = 0.8;
    st.shake = kind === 'front' ? 0.45 : 0.25;
    onSound?.(kind === 'front' ? 'crash' : 'hit');
    burst(st.x, 0.3, st.z - 0.4, 14, ['#d6d3d1', '#a8a29e', '#78716c'], 3, 0.6);
    onHud?.({ warn: kind === 'side' ? 'Esbarrou! O guarda está chegando!' : 'Bateu! O guarda está perto!' });
  }
  function caught() {
    st.alive = false;
    st.shake = 0.6;
    onSound?.('crash');
    setTimeout(() => onSound?.('whistle'), 300);
    setTimeout(() => finish(), 1600);
  }
  function finish() {
    if (st.over) return;
    st.over = true;
    onEnd?.({ coins: st.coins, dist: Math.floor(st.dist) });
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
    if (st.skate > 0) { st.skate -= dt; if (st.skate <= 0) { st.skate = 0; st.skateWait = SKATE_WAIT; onSound?.('pop'); } }
    else st.skateWait = Math.max(0, st.skateWait - dt);
    const prevZ = st.z;
    st.z -= sp * dt;
    st.dist += sp * dt;
    st.x += (laneX(st.lane) - st.x) * Math.min(1, dt * 15);
    st.roll = Math.max(0, st.roll - dt);
    for (const o of objects) if (o.v) { o.zNear += o.v * dt; o.zFar += o.v * dt; o.mesh.position.z += o.v * dt; }
    const lane = Math.round(st.x / LANE_W);
    st.prevY = st.y;
    st.groundY = surfaceAt(lane, st.z, st.y);
    st.vy -= GRAVITY * dt;
    st.y += st.vy * dt;
    if (st.y <= st.groundY && st.vy <= 0) {
      if (st.prevY > st.groundY + 0.5) burst(st.x, st.groundY + 0.05, st.z, 5, ['#e7e5e4'], 2, 0.35);
      st.y = st.groundY; st.vy = 0;
    } else if (st.y < st.groundY) st.y = st.groundY; // subindo a rampa
    const h = st.roll > 0 ? 0.8 : 1.75;
    for (const o of objects) {
      if (o.lane !== lane || o.ghost) continue;
      if (o.type === 'train') {
        if (st.z <= o.zNear && st.z >= o.zFar && st.y < TRAIN_H - 0.45) hit(prevZ > o.zNear - 0.05 ? 'front' : 'side', o);
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
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (c.lane === lane && Math.abs(c.z - st.z) < 0.9 && Math.abs(c.y - (st.y + h / 2)) < 1.4) {
        st.coins++;
        onSound?.('coin');
        burst(c.mesh.position.x, c.mesh.position.y, c.z, 6, ['#fde047', '#fbbf24', '#ffffff'], 2.5, 0.35, 0.7);
        scene.remove(c.mesh);
        coins.splice(i, 1);
      } else if (c.z > st.z + 14) { scene.remove(c.mesh); coins.splice(i, 1); }
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
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      p.vy -= p.grav * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      p.m.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); }
    }
    for (const c of coins) { c.mesh.rotation.y = clock * 3; c.mesh.position.y = c.y + Math.sin(clock * 3 + c.z) * 0.06; }
    for (const s of scenery) while (s.position.z > st.z + 26) s.position.z -= STEP * 15;
    ground.position.z = st.z - 90; side.position.z = st.z - 90; rails.position.z = st.z - 90;
    trackTex.offset.y = (st.z / 260) * 40;

    if (st.phase === 'menu' || st.phase === 'story') {
      // Abertura: pichando o símbolo no trem; na história o guarda chega apitando
      player.position.set(laneX(1) - 1.9, 0, 8.6);
      const turn = st.phase === 'story' ? Math.min(1, Math.max(0, (st.story - 1.7) * 2.5)) : 0;
      player.rotation.y = -Math.PI / 2 + turn * (Math.PI / 2);
      pose(player, turn > 0 ? 'idle' : 'spray', clock);
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
        pose(officer, st.story < 1.9 ? 'run' : 'caught', clock);
      } else officer.visible = false;
      camera.position.lerp(st.phase === 'story' && st.story > 1.7 ? camStory : camIntro, Math.min(1, dt * 2.2));
      camera.lookAt(camLook);
      renderer.render(scene, camera);
      return;
    }
    // Correndo
    player.position.set(st.x, st.y + (st.skate > 0 ? 0.16 : 0), st.z);
    player.rotation.y = (laneX(st.lane) - st.x) * -0.12;
    const air = st.y > st.groundY + 0.25;
    const state = !st.alive ? 'caught' : st.roll > 0 ? 'roll' : st.stumble > 0 ? 'stumble' : air ? 'jump' : st.skate > 0 ? 'skate' : 'run';
    pose(player, state, st.t, 1 - st.stumble / 0.7);
    if (!st.alive) player.rotation.y = Math.PI;
    skate.visible = st.skate > 0 && st.alive;
    if (skate.visible) {
      skate.position.set(st.x, st.y + 0.1, st.z);
      skate.rotation.y = 0.15 * Math.sin(clock * 2);
      skate.userData.glow.material.opacity = 0.35 + Math.sin(clock * 10) * 0.15;
    }
    const close = st.t - st.hitAt < CATCH_WINDOW || st.t < 2.5;
    const target = !st.alive ? 0.9 : close ? 2.3 : 16;
    st.officerDist += (target - st.officerDist) * Math.min(1, dt * (st.alive ? 1.6 : 4));
    officer.visible = true;
    officer.position.set(st.x + (st.lane <= 0 ? 0.8 : -0.8), Math.min(st.y, 0.01), st.z + st.officerDist);
    officer.rotation.y = 0;
    pose(officer, st.alive ? 'run' : 'caught', st.t + 0.3);
    const sh = st.shake > 0 ? st.shake * 0.5 : 0;
    const want = new THREE.Vector3(st.x * 0.75 + rnd(-sh, sh), 4.9 + st.y * 0.6 + rnd(-sh, sh), st.z + 7.6);
    camera.position.lerp(want, Math.min(1, dt * 8));
    camera.lookAt(st.x * 0.85, 1.1 + st.y * 0.65, st.z - 8);
    sun.position.set(st.x - 8, 20, st.z + 6);
    sun.target.position.set(st.x, 0, st.z - 4);
    renderer.render(scene, camera);
    if (now - hudAt > 100) {
      hudAt = now;
      onHud?.({ coins: st.coins, dist: Math.floor(st.dist), close: close && st.t > 2.5, skate: st.skate, skateWait: st.skateWait });
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
    setFemale(f) {
      scene.remove(player);
      player = makeRunner({ female: f });
      scene.add(player);
    },
    giveUp() { if (st.alive && st.phase === 'run') { st.alive = false; finish(); } },
    dispose() {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
    },
  };
}
