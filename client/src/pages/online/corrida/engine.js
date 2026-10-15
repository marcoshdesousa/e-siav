// Corrida DBV: corrida infinita em 3D nos trilhos (estilo "subway runner").
// Três trilhos; deslize para os lados para trocar, para cima para pular e para baixo para rolar.
// Trens parados e andando, rampas para subir no teto, barreiras baixas (pule) e altas (role).
// Bateu uma vez: o guarda chega perto. Bateu de novo enquanto ele está perto: pegou!
import * as THREE from 'three';

const LANE_W = 2.3;
const GRAVITY = 42;
const JUMP_V = 13.5;
const TRAIN_H = 3.3;
const ROLL_TIME = 0.65;
const CATCH_WINDOW = 9; // segundos com o guarda perto depois de bater
const START_SPEED = 13;
const MAX_SPEED = 34;

// ───────────── Texturas desenhadas no canvas ─────────────

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

function trackTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7b6f62'; g.fillRect(0, 0, w, h); // brita
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${40 + Math.random() * 60},${40 + Math.random() * 50},${30 + Math.random() * 40},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    const lanes = 3;
    for (let l = 0; l < lanes; l++) {
      const cx = ((l + 0.5) / lanes) * w;
      g.fillStyle = '#5a3d27'; // dormentes
      for (let y = 0; y < h; y += 32) g.fillRect(cx - 34, y + 6, 68, 12);
      g.fillStyle = '#c9ced6'; // trilhos
      g.fillRect(cx - 24, 0, 5, h); g.fillRect(cx + 19, 0, 5, h);
      g.fillStyle = '#6b7280';
      g.fillRect(cx - 24, 0, 2, h); g.fillRect(cx + 19, 0, 2, h);
    }
  }, [1, 30]);
}

function brickTexture(hue) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = `hsl(${hue},35%,38%)`; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
    for (let y = 0; y < h; y += 16) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      for (let x = (y / 16) % 2 ? 16 : 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
    }
    // pichações coloridas (desenhos abstratos)
    const cols = ['#f43f5e', '#22d3ee', '#a3e635', '#facc15', '#c084fc'];
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = cols[(hue + k) % cols.length]; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath();
      let x = 20 + Math.random() * 180; let y = 30 + Math.random() * 60;
      g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += 15 + Math.random() * 25; y += (Math.random() - 0.5) * 50; g.quadraticCurveTo(x - 10, y - 30, x, y); }
      g.stroke();
    }
  }, [4, 1]);
}

function buildingTexture(base) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 10; y += 28) for (let x = 10; x < w - 10; x += 28) {
      g.fillStyle = Math.random() < 0.3 ? '#fde68a' : '#1e293b';
      g.fillRect(x, y, 16, 18);
    }
  });
}

function trainTexture(color, stripe) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.fillStyle = stripe; g.fillRect(0, h * 0.68, w, h * 0.1);
    g.fillStyle = '#0f172a';
    for (let x = 20; x < w - 40; x += 62) g.fillRect(x, 18, 42, 36);
    g.fillStyle = 'rgba(255,255,255,.15)';
    for (let x = 20; x < w - 40; x += 62) g.fillRect(x + 4, 22, 12, 28);
    g.fillStyle = '#334155'; g.fillRect(w / 2 - 20, 14, 40, h * 0.62);
  });
}

function trainFrontTexture(color) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0f172a'; g.fillRect(14, 14, w - 28, 44);
    g.fillStyle = '#fef08a'; g.beginPath(); g.arc(28, 96, 9, 0, 7); g.arc(w - 28, 96, 9, 0, 7); g.fill();
    g.fillStyle = '#111'; g.fillRect(w / 2 - 22, 82, 44, 26);
  });
}

function stripesTexture() {
  return canvasTex(128, 32, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#dc2626';
    for (let x = -h; x < w; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  });
}

/** Moeda: dourada com o símbolo do App do DBV (o desenho chega quando a imagem carregar). */
function coinTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(50, 45, 10, 64, 64, 64);
  grad.addColorStop(0, '#fff3b0'); grad.addColorStop(0.6, '#f5b301'); grad.addColorStop(1, '#b7791f');
  g.fillStyle = grad; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
  g.strokeStyle = '#a16207'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => { g.drawImage(img, 30, 28, 68, 68); t.needsUpdate = true; };
  img.src = '/marca/logo.svg?v=4';
  return t;
}

/** Mural com o símbolo do DBV (o começo da história). */
function muralTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#9a4a2f'; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
  for (let y = 0; y < 256; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.fillStyle = '#22d3ee'; g.beginPath(); g.ellipse(256, 128, 230, 110, 0, 0, 7); g.fill();
  g.fillStyle = '#facc15'; g.font = 'bold 54px Arial Black, Arial'; g.textAlign = 'center';
  g.fillText('DBV', 400, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => { g.drawImage(img, 90, 18, 220, 220); t.needsUpdate = true; };
  img.src = '/marca/logo.svg?v=4';
  return t;
}

// ───────────── Personagens ─────────────

const SKINS = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69'];

/** Desbravador(a) com o uniforme: camisa caqui, lenço amarelo, calça/saia verde, cinto e sapato pretos. */
export function makePerson({ female = false, skin = SKINS[0], hair = '#2b1b10', officer = false } = {}) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const shirt = mat(officer ? '#1e3a8a' : '#c8a86b');
  const pants = mat(officer ? '#1e293b' : '#1f3d2b');
  const skinM = mat(skin);
  const parts = {};
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  // Pernas (giram no quadril)
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.17 * side, 0.95, 0);
    const leg = box(0.24, 0.85, 0.26, female && !officer ? skinM : pants);
    leg.position.y = -0.42;
    const shoe = box(0.27, 0.14, 0.4, mat('#111'));
    shoe.position.set(0, -0.86, -0.06);
    if (female && !officer) {
      const sock = box(0.25, 0.25, 0.27, mat('#f5f5f5'));
      sock.position.y = -0.7;
      hip.add(sock);
    }
    hip.add(leg, shoe);
    g.add(hip);
    parts[side < 0 ? 'legL' : 'legR'] = hip;
  }
  // Tronco
  const torso = box(0.62, 0.72, 0.36, shirt);
  torso.position.y = 1.32;
  g.add(torso);
  if (female && !officer) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.5, 10), pants);
    skirt.position.y = 0.82;
    g.add(skirt);
  }
  const belt = box(0.64, 0.08, 0.38, mat('#111'));
  belt.position.y = 1.0;
  g.add(belt);
  if (!officer) {
    // Lenço amarelo e anel
    const scarf = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 3), mat('#facc15'));
    scarf.rotation.x = Math.PI;
    scarf.position.set(0, 1.5, -0.2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 6, 10), mat('#6b4f1d'));
    ring.position.set(0, 1.56, -0.21);
    g.add(scarf, ring);
    // Insígnias nas mangas
    for (const side of [-1, 1]) {
      const patch = box(0.02, 0.12, 0.12, mat('#dc2626'));
      patch.position.set(0.33 * side, 1.5, 0);
      g.add(patch);
    }
  } else {
    const badge = box(0.12, 0.12, 0.02, mat('#facc15'));
    badge.position.set(0.15, 1.45, -0.19);
    g.add(badge);
  }
  // Braços (giram no ombro)
  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(0.4 * side, 1.62, 0);
    const arm = box(0.18, 0.42, 0.2, shirt);
    arm.position.y = -0.2;
    const fore = box(0.16, 0.36, 0.18, skinM);
    fore.position.y = -0.58;
    sh.add(arm, fore);
    g.add(sh);
    parts[side < 0 ? 'armL' : 'armR'] = sh;
  }
  // Cabeça
  const head = box(0.44, 0.46, 0.42, skinM);
  head.position.y = 1.94;
  g.add(head);
  const eyeM = mat('#111');
  for (const side of [-1, 1]) {
    const eye = box(0.06, 0.07, 0.02, eyeM);
    eye.position.set(0.1 * side, 1.98, -0.22);
    g.add(eye);
  }
  if (officer) {
    const cap = box(0.48, 0.14, 0.48, mat('#1e293b'));
    cap.position.y = 2.22;
    const brim = box(0.46, 0.04, 0.2, mat('#111'));
    brim.position.set(0, 2.16, -0.3);
    g.add(cap, brim);
  } else {
    const top = box(0.47, 0.12, 0.46, mat(hair));
    top.position.y = 2.2;
    const back = box(0.47, 0.34, 0.12, mat(hair));
    back.position.set(0, 2.02, 0.2);
    g.add(top, back);
    if (female) {
      // Cabelo comprido preso (rabo de cavalo)
      const tail = box(0.16, 0.5, 0.14, mat(hair));
      tail.position.set(0, 1.86, 0.32);
      const side1 = box(0.08, 0.36, 0.38, mat(hair));
      side1.position.set(-0.24, 1.98, 0.02);
      const side2 = side1.clone();
      side2.position.x = 0.24;
      g.add(tail, side1, side2);
      parts.tail = tail;
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.parts = parts;
  return g;
}

function animateRun(person, t, speed = 1, rolling = false, air = false) {
  const p = person.userData.parts;
  const s = Math.sin(t * 13 * speed);
  if (air) { p.legL.rotation.x = -0.9; p.legR.rotation.x = 0.4; p.armL.rotation.x = -2.4; p.armR.rotation.x = -2.2; return; }
  p.legL.rotation.x = s * 0.9;
  p.legR.rotation.x = -s * 0.9;
  p.armL.rotation.x = -s * 0.9;
  p.armR.rotation.x = s * 0.9;
  if (p.tail) p.tail.rotation.x = 0.3 + Math.abs(s) * 0.3;
  person.rotation.x = rolling ? 0 : -0.08;
}

// ───────────── Jogo ─────────────

export function createRunner(canvas, { female = false, onHud, onEnd, onSound }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#8fd3ff');
  scene.fog = new THREE.Fog('#bfe6ff', 60, 150);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 220);

  const hemi = new THREE.HemisphereLight('#ffffff', '#7a6a55', 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff7e0', 1.5);
  sun.position.set(-8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -14, near: 1, far: 60 });
  scene.add(sun, sun.target);

  // Chão com os trilhos (a textura corre, o chão acompanha o jogador)
  const trackTex = trackTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 3 + 0.6, 240), new THREE.MeshLambertMaterial({ map: trackTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const sideGround = new THREE.Mesh(new THREE.PlaneGeometry(80, 240), new THREE.MeshLambertMaterial({ color: '#9ca3af' }));
  sideGround.rotation.x = -Math.PI / 2;
  sideGround.position.y = -0.02;
  scene.add(sideGround);

  // Cenário dos lados (muros, prédios, postes), reaproveitado conforme o jogador avança
  const sideMats = [0, 1, 2, 3].map((k) => new THREE.MeshLambertMaterial({ map: brickTexture(k * 25) }));
  const bldMats = ['#64748b', '#78716c', '#57534e', '#475569', '#9a3412'].map((c) => new THREE.MeshLambertMaterial({ map: buildingTexture(c) }));
  const scenery = [];
  const SCEN_STEP = 14;
  for (let i = 0; i < 16; i++) {
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.6, SCEN_STEP), sideMats[(i + (side > 0 ? 1 : 0)) % sideMats.length]);
      const h = 8 + ((i * 7 + (side > 0 ? 3 : 0)) % 4) * 4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(8, h, SCEN_STEP - 2), bldMats[(i + (side > 0 ? 2 : 0)) % bldMats.length]);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), new THREE.MeshLambertMaterial({ color: '#374151' }));
      const grp = new THREE.Group();
      wall.position.set(side * (LANE_W * 1.5 + 0.9), 1.3, 0);
      b.position.set(side * (LANE_W * 1.5 + 6), h / 2, 0);
      pole.position.set(side * (LANE_W * 1.5 + 0.5), 3, SCEN_STEP / 2 - 1);
      grp.add(wall, b, pole);
      grp.position.z = -i * SCEN_STEP;
      grp.userData.side = side;
      scene.add(grp);
      scenery.push(grp);
    }
  }
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshLambertMaterial({ map: muralTexture() }));
  mural.position.set(-(LANE_W * 1.5 + 0.55), 1.6, 4);
  mural.rotation.y = Math.PI / 2;
  scene.add(mural);

  // Materiais e formas reaproveitados
  const trainColors = [['#dc2626', '#facc15'], ['#2563eb', '#f8fafc'], ['#16a34a', '#facc15'], ['#f59e0b', '#1e293b'], ['#7c3aed', '#f8fafc']];
  const trainMats = trainColors.map(([c, s]) => {
    const side = new THREE.MeshLambertMaterial({ map: trainTexture(c, s) });
    const front = new THREE.MeshLambertMaterial({ map: trainFrontTexture(c) });
    const top = new THREE.MeshLambertMaterial({ color: '#94a3b8' });
    return [side, side, top, top, front, front]; // +x, -x, +y, -y, +z, -z
  });
  const stripeMat = new THREE.MeshLambertMaterial({ map: stripesTexture() });
  const darkMat = new THREE.MeshLambertMaterial({ color: '#1f2937' });
  const rampMat = new THREE.MeshLambertMaterial({ color: '#a8a29e' });
  const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20);
  const coinTex = coinTexture();
  const coinMat = [new THREE.MeshLambertMaterial({ color: '#d4a017' }), new THREE.MeshBasicMaterial({ map: coinTex }), new THREE.MeshBasicMaterial({ map: coinTex })];

  // Jogador e guarda
  let player = makePerson({ female });
  scene.add(player);
  const officer = makePerson({ officer: true, skin: SKINS[1] });
  scene.add(officer);

  const st = {
    z: 0, lane: 0, prevLane: 0, x: 0, y: 0, vy: 0, roll: 0, speed: START_SPEED, t: 0, coins: 0, dist: 0,
    groundY: 0, alive: true, started: false, hitAt: -100, officerDist: 3, nextRowZ: -30, slow: 0, over: false,
  };
  const objects = [];
  const coins = [];

  const laneX = (l) => l * LANE_W;

  function addTrain(lane, zNear, len, moving) {
    const mats = trainMats[Math.floor(Math.random() * trainMats.length)];
    const m = new THREE.Mesh(new THREE.BoxGeometry(LANE_W * 0.86, TRAIN_H, len), mats);
    m.position.set(laneX(lane), TRAIN_H / 2, zNear - len / 2);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    objects.push({ type: 'train', lane, zNear, zFar: zNear - len, mesh: m, v: moving ? 9 + Math.random() * 6 : 0 });
  }
  function addRamp(lane, zNear, len) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(len, 0); shape.lineTo(len, TRAIN_H); shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: LANE_W * 0.8, bevelEnabled: false });
    const m = new THREE.Mesh(geo, rampMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(laneX(lane) - LANE_W * 0.4, 0, zNear);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    objects.push({ type: 'ramp', lane, zNear, zFar: zNear - len, mesh: m });
  }
  function addBarrier(lane, z, high) {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(LANE_W * 0.8, high ? 0.7 : 0.55, 0.15), stripeMat);
    board.position.y = high ? 1.85 : 0.75;
    g.add(board);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, high ? 2.2 : 0.9, 0.1), darkMat);
      leg.position.set(s * LANE_W * 0.36, high ? 1.1 : 0.45, 0);
      g.add(leg);
    }
    g.position.set(laneX(lane), 0, z);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    objects.push({ type: high ? 'high' : 'low', lane, zNear: z + 0.3, zFar: z - 0.3, mesh: g });
  }
  function addCoin(lane, z, y = 0.9) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.rotation.z = Math.PI / 2;
    m.position.set(laneX(lane), y, z);
    scene.add(m);
    coins.push({ lane, z, y, mesh: m });
  }
  function coinLine(lane, zStart, n, y = 0.9, arc = false) {
    for (let k = 0; k < n; k++) addCoin(lane, zStart - k * 2.2, arc ? y + Math.sin((k / (n - 1)) * Math.PI) * 2.2 : y);
  }

  /** Cria a próxima "fileira" de obstáculos, sempre deixando um caminho possível. */
  function spawnRow() {
    const z = st.nextRowZ;
    const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
    const free = lanes[0];
    const level = Math.min(1, st.t / 90);
    let rowLen = 14;
    for (const lane of lanes) {
      const r = Math.random();
      if (lane === free) {
        if (r < 0.45) coinLine(lane, z, 6);
        else if (r < 0.7) { addBarrier(lane, z - 4, Math.random() < 0.5); coinLine(lane, z - 0.5, 4, 0.9, false); }
        continue;
      }
      if (r < 0.32 + level * 0.15) {
        const len = 16 + Math.floor(Math.random() * 3) * 6;
        if (Math.random() < 0.4) {
          addRamp(lane, z, 8);
          addTrain(lane, z - 8, len, false);
          coinLine(lane, z - 10, Math.floor(len / 2.4), TRAIN_H + 0.9);
          rowLen = Math.max(rowLen, len + 8);
        } else {
          addTrain(lane, z, len, Math.random() < 0.15 + level * 0.25);
          rowLen = Math.max(rowLen, len);
        }
      } else if (r < 0.62) {
        const high = Math.random() < 0.45;
        addBarrier(lane, z - 3, high);
        if (!high) coinLine(lane, z + 1, 5, 1.0, true);
      } else if (r < 0.8) coinLine(lane, z, 5);
    }
    const gap = 12 + Math.random() * 10 + st.speed * 0.35;
    st.nextRowZ = z - rowLen - gap;
  }

  function removeObj(o) { scene.remove(o.mesh); o.mesh.geometry?.dispose?.(); }

  // ───────────── Controles ─────────────
  const input = {
    left: () => move(-1), right: () => move(1), up: () => jump(), down: () => roll(),
  };
  function move(d) {
    if (!st.alive || !st.started) return;
    const nl = Math.max(-1, Math.min(1, st.lane + d));
    if (nl === st.lane) return;
    // Bater de lado num trem: volta e tropeça
    const blocked = objects.some((o) => o.type === 'train' && o.lane === nl && st.z <= o.zNear + 0.6 && st.z >= o.zFar - 0.4 && st.y < TRAIN_H - 0.4 && !o.ghost);
    if (blocked) { stumble('side'); return; }
    st.prevLane = st.lane;
    st.lane = nl;
    onSound?.('move');
  }
  function jump() {
    if (!st.alive || !st.started) return;
    if (st.y <= st.groundY + 0.05) { st.vy = JUMP_V; st.roll = 0; onSound?.('jump'); }
  }
  function roll() {
    if (!st.alive || !st.started) return;
    st.roll = ROLL_TIME;
    if (st.y > st.groundY + 0.05) st.vy = -JUMP_V * 1.2; // no ar: desce rápido
    onSound?.('move');
  }

  // ───────────── Batidas ─────────────
  function stumble(kind) {
    if (!st.alive) return;
    if (st.t - st.hitAt < CATCH_WINDOW) { caught(); return; }
    st.hitAt = st.t;
    st.slow = 0.8;
    onSound?.('hit');
    onHud?.({ warn: kind === 'side' ? 'Cuidado! O guarda está perto!' : 'Bateu! O guarda está perto!' });
  }
  function caught() {
    st.alive = false;
    onSound?.('lose');
    setTimeout(() => finish(), 1400);
  }
  function finish() {
    if (st.over) return;
    st.over = true;
    onEnd?.({ coins: st.coins, dist: Math.floor(st.dist) });
  }

  // ───────────── Laço principal ─────────────
  let raf = 0;
  let last = 0;
  let hudAt = 0;
  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!st.started) { renderStill(dt); return; }
    st.t += dt;
    if (st.alive) {
      st.speed = Math.min(MAX_SPEED, START_SPEED + st.t * 0.2);
      const sp = st.speed * (st.slow > 0 ? 0.55 : 1);
      st.slow = Math.max(0, st.slow - dt);
      const prevZ = st.z;
      st.z -= sp * dt;
      st.dist += sp * dt;
      st.x += (laneX(st.lane) - st.x) * Math.min(1, dt * 14);
      st.roll = Math.max(0, st.roll - dt);
      // Trens andando vêm na direção do jogador
      for (const o of objects) if (o.v) { o.zNear += o.v * dt; o.zFar += o.v * dt; o.mesh.position.z += o.v * dt; }
      // Superfície embaixo (chão, rampa ou teto do trem)
      const lane = Math.round(st.x / LANE_W);
      let ground = 0;
      for (const o of objects) {
        if (o.lane !== lane || o.ghost) continue;
        if (o.type === 'ramp' && st.z <= o.zNear && st.z >= o.zFar) ground = Math.max(ground, ((o.zNear - st.z) / (o.zNear - o.zFar)) * TRAIN_H);
        if (o.type === 'train' && st.z <= o.zNear + 0.2 && st.z >= o.zFar && st.y >= TRAIN_H - 0.6) ground = Math.max(ground, TRAIN_H);
      }
      st.groundY = ground;
      st.vy -= GRAVITY * dt;
      st.y += st.vy * dt;
      if (st.y <= ground) {
        if (ground - st.y < 0.9 || st.vy < 0) { st.y = ground; st.vy = 0; }
      }
      // Batidas
      const h = st.roll > 0 ? 0.8 : 1.8;
      for (const o of objects) {
        if (o.lane !== lane || o.ghost) continue;
        if (o.type === 'train') {
          const inside = st.z <= o.zNear && st.z >= o.zFar;
          if (inside && st.y < TRAIN_H - 0.6) {
            // De frente: tropeça e "atravessa" (o trem fica transparente)
            o.ghost = true;
            o.mesh.material = o.mesh.material.map((m) => { const c = m.clone(); c.transparent = true; c.opacity = 0.35; return c; });
            stumble(prevZ > o.zNear ? 'front' : 'side');
          }
        } else if (o.type === 'low' || o.type === 'high') {
          if (st.z <= o.zNear && st.z >= o.zFar) {
            const hit = o.type === 'low' ? st.y < 0.95 + o.mesh.position.y : !(st.roll > 0) && st.y < 2.4;
            if (hit) { o.ghost = true; o.mesh.visible = false; stumble('front'); }
          }
        }
      }
      // Moedas
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.mesh.rotation.y += dt * 4;
        if (c.lane === lane && Math.abs(c.z - st.z) < 0.9 && Math.abs(c.y - (st.y + h / 2)) < 1.3) {
          st.coins++;
          onSound?.('coin');
          scene.remove(c.mesh);
          coins.splice(i, 1);
        } else if (c.z > st.z + 12) { scene.remove(c.mesh); coins.splice(i, 1); }
      }
      // Gera mais pista e limpa o que ficou para trás
      while (st.nextRowZ > st.z - 170) spawnRow();
      for (let i = objects.length - 1; i >= 0; i--) if (objects[i].zFar > st.z + 14) { removeObj(objects[i]); objects.splice(i, 1); }
    }
    // Guarda: perto logo depois de bater; depois de um tempo fica para trás
    const close = st.t - st.hitAt < CATCH_WINDOW || st.t < 2.5;
    const target = !st.alive ? 0.9 : close ? 1.9 : 16;
    st.officerDist += (target - st.officerDist) * Math.min(1, (st.alive ? 1.6 : 4) * (1 / 60));
    renderWorld(dt);
    if (now - hudAt > 120) {
      hudAt = now;
      onHud?.({ coins: st.coins, dist: Math.floor(st.dist), close: close && st.t > 2.5 });
    }
  }

  function placeScenery() {
    for (const s of scenery) {
      while (s.position.z > st.z + 20) s.position.z -= SCEN_STEP * 16;
    }
    ground.position.z = st.z - 90;
    sideGround.position.z = st.z - 90;
    trackTex.offset.y = (st.z / 240) * 30;
  }

  function renderWorld(dt) {
    placeScenery();
    player.position.set(st.x, st.y, st.z);
    const air = st.y > st.groundY + 0.2;
    animateRun(player, st.t, 1, st.roll > 0, air && st.alive);
    // rolar: abaixa e gira
    player.scale.y += ((st.roll > 0 ? 0.5 : 1) - player.scale.y) * Math.min(1, dt * 20);
    player.rotation.z = st.alive ? (laneX(st.lane) - st.x) * -0.08 : 0;
    if (!st.alive) { player.rotation.x = -1.2; player.position.y = 0.3; }
    officer.position.set(st.x * 0.8 + (st.lane <= 0 ? 0.7 : -0.7), st.groundY > 1 ? 0 : st.y * 0.3, st.z + st.officerDist);
    animateRun(officer, st.t + 0.3, 1);
    if (!st.alive) { officer.userData.parts.armL.rotation.x = -1.6; officer.userData.parts.armR.rotation.x = -1.6; }
    // Câmera atrás e acima, um pouco mais alta no teto dos trens
    const camY = 5.1 + st.y * 0.55;
    camera.position.x += (st.x * 0.7 - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (camY - camera.position.y) * Math.min(1, dt * 5);
    camera.position.z = st.z + 7.4;
    camera.lookAt(st.x * 0.85, 1.0 + st.y * 0.6, st.z - 8);
    sun.position.set(st.x - 8, 18, st.z + 6);
    sun.target.position.set(st.x, 0, st.z - 4);
    renderer.render(scene, camera);
  }

  // Antes de começar: o mural e o guarda chegando
  function renderStill(dt) {
    st.t += dt;
    placeScenery();
    player.position.set(-LANE_W * 0.9, 0, 3.2);
    player.rotation.y = Math.PI / 2 + Math.sin(st.t * 2) * 0.1;
    const pp = player.userData.parts;
    pp.armR.rotation.x = -1.8 + Math.sin(st.t * 10) * 0.25; // grafitando
    officer.position.set(LANE_W, 0, 9 - Math.min(4, st.t * 1.2));
    animateRun(officer, st.t, 0.6);
    camera.position.set(1.8, 3, 9.5);
    camera.lookAt(-1.2, 1.5, 2.5);
    renderer.render(scene, camera);
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
  raf = window.requestAnimationFrame(frame);

  return {
    input,
    start() {
      st.started = true;
      st.t = 0;
      st.hitAt = -100;
      player.rotation.set(0, 0, 0);
      player.userData.parts.armR.rotation.x = 0;
      st.officerDist = 3;
      onSound?.('whistle');
    },
    setFemale(f) {
      const pos = player.position.clone();
      const rot = player.rotation.clone();
      scene.remove(player);
      player = makePerson({ female: f });
      player.position.copy(pos);
      player.rotation.copy(rot);
      scene.add(player);
    },
    giveUp() { if (st.alive) { st.alive = false; finish(); } },
    dispose() {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    },
  };
}
