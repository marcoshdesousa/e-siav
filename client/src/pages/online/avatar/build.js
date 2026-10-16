// Personagens dos jogos: modelos de verdade do "Universal Base Characters" (Quaternius, CC0) com as
// animações do "Universal Animation Library" (mesmo esqueleto). O personagem é montado peça por
// peça (ver skins.js): o corpo-base (só aparece o que a roupa não cobre), a camisa, a calça/bermuda
// ou saia, o calçado, o cabelo, o chapéu e o lenço, tudo preso num único esqueleto.
//  - 'surf' (grande): proporção de adolescente (cabeça um pouquinho maior);
//  - 'stumble' (pequeno): versão pequenininha (cabeção, pernas mais curtas).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// ───────────── Arquivos ─────────────
const BASE = '/models/chars/';
const PIECES = ['Peasant_Body', 'Ranger_Body', 'Ranger_Arms', 'Ranger_Legs', 'Ranger_Feet'];
const pieceFile = (g, n) => `parts/${g === 'm' ? 'Male' : 'Female'}_${g === 'm' && n === 'Ranger_Feet' ? 'Ranger_Feet_Boots' : n}.gltf`;
const PARTS = {
  ...Object.fromEntries(['m', 'f'].flatMap((g) => PIECES.map((n) => [`piece:${g}:${n}`, pieceFile(g, n)]))),
  'body:m': 'base/Superhero_Male_FullBody.gltf', 'body:f': 'base/Superhero_Female_FullBody.gltf',
  'hair:curto': 'hair/Hair_SimpleParted.gltf', 'hair:raspado': 'hair/Hair_Buzzed.gltf', 'hair:longo': 'hair/Hair_Long.gltf',
  'hair:coque': 'hair/Hair_Buns.gltf', 'hair:raspado-f': 'hair/Hair_BuzzedFemale.gltf', 'hair:barba': 'hair/Hair_Beard.gltf',
  'brows:m': 'hair/Eyebrows_Regular.gltf', 'brows:f': 'hair/Eyebrows_Female.gltf',
};
let RIG = null;
let rigPromise = null;
const loader = new GLTFLoader();
/** Carrega o esqueleto com as animações e todas as peças dos personagens (uma vez só). */
export function loadRig() {
  if (!rigPromise) {
    rigPromise = Promise.all([
      loader.loadAsync('/models/dbv-rig.glb?v=2'),
      ...Object.entries(PARTS).map(([k, f]) => loader.loadAsync(BASE + f).then((g) => [k, g.scene])),
    ]).then(([rig, ...parts]) => {
      RIG = { clips: new Map(rig.animations.map((a) => [a.name, a])), parts: new Map(parts) };
      return RIG;
    });
    rigPromise.catch(() => { rigPromise = null; });
  }
  return rigPromise;
}
export const rigLoaded = () => !!RIG;

// ───────────── Recortes: some com a parte do corpo (ou da calça) que a roupa cobre ─────────────
// Para cada vértice: o osso que mais o move e onde ele fica ao longo do osso (t: 0 no começo, 1 no fim).
const NEXT = { upperarm_l: 'lowerarm_l', upperarm_r: 'lowerarm_r', lowerarm_l: 'hand_l', lowerarm_r: 'hand_r', thigh_l: 'calf_l', thigh_r: 'calf_r', calf_l: 'foot_l', calf_r: 'foot_r' };
const vinfo = new WeakMap();
function vertexInfo(mesh) {
  if (vinfo.has(mesh.geometry)) return vinfo.get(mesh.geometry);
  const g = mesh.geometry;
  const bones = mesh.skeleton.bones;
  const pos = bones.map((_b, k) => new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[k].clone().invert()));
  const byName = new Map(bones.map((b, k) => [b.name, k]));
  const si = g.attributes.skinIndex;
  const sw = g.attributes.skinWeight;
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const names = [];
  const ts = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    let best = 0;
    let bi = 0;
    for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > best) { best = w; bi = si.getComponent(i, c); } }
    const name = bones[bi].name;
    names.push(name);
    const next = byName.get(NEXT[name]);
    if (next != null) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.bindMatrix);
      const a = pos[bi];
      const d = pos[next].clone().sub(a);
      ts[i] = v.sub(a).dot(d) / d.lengthSq();
    }
  }
  const info = { names, ts };
  vinfo.set(g, info);
  return info;
}
const cutCache = new Map();
/** Copia da malha só com os triângulos em que hide(osso, t) é falso nos 3 vértices. */
function cutMesh(mesh, key, hide) {
  const k = mesh.geometry.uuid + key;
  if (!cutCache.has(k)) {
    const { names, ts } = vertexInfo(mesh);
    const idx = mesh.geometry.index.array;
    const out = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t]; const b = idx[t + 1]; const c = idx[t + 2];
      if (!hide(names[a], ts[a]) && !hide(names[b], ts[b]) && !hide(names[c], ts[c])) out.push(a, b, c);
    }
    const geo = mesh.geometry.clone();
    geo.setIndex(out);
    cutCache.set(k, geo);
  }
  mesh.geometry = cutCache.get(k);
}
const side = (n) => n.replace(/_[lr]$/, '');
/** O que a roupa cobre no corpo-base (para não atravessar o tecido). */
function bodyHider(top, bottom, shoes) {
  return (n, t) => {
    const b = side(n);
    if (b === 'pelvis' || b.startsWith('spine') || b === 'clavicle') return true;
    if (b === 'upperarm') return top.style === 'camiseta' ? t < 0.62 : top.style === 'colete' ? t < 0.14 : true;
    if (b === 'lowerarm' || b === 'hand') return top.style === 'manga' || top.style === 'colete-manga';
    if (b === 'thigh') return bottom.style === 'calca' ? true : bottom.style === 'bermuda' ? t < 0.9 : t < 0.88;
    if (b === 'calf') return (bottom.style === 'calca' && t < 0.55) || (shoes.style === 'bota' && t > 0.5);
    if (b === 'ball' || b === 'ball_leaf') return true;
    if (b === 'foot') return shoes.style === 'bota';
    return false;
  };
}
const shortsHider = (n, t) => { const b = side(n); return b === 'calf' || b === 'foot' || b === 'ball' || b === 'ball_leaf' || (b === 'thigh' && t > 0.92); };

// ───────────── Materiais ─────────────
/** Degraus de luz (usado pelo skate). */
export const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([80, 150, 210, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const mats = new Map();
/** Material liso (usado por peças do cenário e do skate). */
export function toon(color, extra) {
  const k = color + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...(extra || {}) }));
  return mats.get(k);
}
/** Luz de estúdio (reflexos suaves). Use com scene.environmentIntensity ~0.5. */
const envs = new WeakMap();
export function studioEnv(renderer) {
  if (!envs.has(renderer)) {
    const pm = new THREE.PMREMGenerator(renderer);
    envs.set(renderer, pm.fromScene(new RoomEnvironment(), 0.04).texture);
    pm.dispose();
    renderer.toneMapping = THREE.NeutralToneMapping;
  }
  return envs.get(renderer);
}
// Material tingido (um por cor, compartilhado entre personagens iguais)
const tinted = new Map();
function tint(mat, color) {
  const key = mat.uuid + color;
  if (!tinted.has(key)) { const m = mat.clone(); m.color.set(color); tinted.set(key, m); }
  return tinted.get(key);
}

/** Lenço amarelo (triângulo no peito) com o anel, preso no pescoço. */
let SCARF = null;
function makeScarf(g = 'm') {
  if (!SCARF) {
    const cloth = new THREE.MeshStandardMaterial({ color: '#f5c518', roughness: 0.8, side: THREE.DoubleSide });
    const ring = new THREE.MeshStandardMaterial({ color: '#c99a2e', roughness: 0.3, metalness: 0.8 });
    const tri = new THREE.BufferGeometry();
    // triângulo um pouco dobrado (acompanha o peito)
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, -0.01, 0.13, 0, -0.01, 0, -0.21, 0.03, -0.13, 0, -0.01, 0, -0.21, 0.03, 0.13, 0, -0.01], 3));
    tri.computeVertexNormals();
    SCARF = { cloth, ring, tri, collar: new THREE.TorusGeometry(0.088, 0.024, 8, 22), knot: new THREE.TorusGeometry(0.026, 0.011, 8, 14) };
  }
  const grp = new THREE.Group();
  const front = g === 'f' ? 0.05 : 0.02; // o peito da menina fica mais à frente
  const collar = new THREE.Mesh(SCARF.collar, SCARF.cloth);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1, 1.15, 1);
  const tri = new THREE.Mesh(SCARF.tri, SCARF.cloth);
  tri.position.set(0, -0.01, 0.105 + front);
  tri.rotation.x = -0.25 - front * 3;
  tri.scale.set(0.72, 0.78, 1);
  const knot = new THREE.Mesh(SCARF.knot, SCARF.ring);
  knot.position.set(0, -0.055, 0.13 + front);
  grp.add(collar, tri, knot);
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return grp;
}

const std = new Map();
const mat = (color, rough = 0.75, metal = 0, extra = {}) => {
  const k = `${color}${rough}${metal}${JSON.stringify(extra)}`;
  if (!std.has(k)) std.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  return std.get(k);
};
const pmesh = (geo, m, x = 0, y = 0, z = 0, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent?.add(o); return o; };

/** Chapéus (rígidos, presos na cabeça). y = 0 é o alto da cabeça; olha para +z. */
const HATG = {};
function makeHat(kind, color) {
  const g = new THREE.Group();
  if (kind === 'bone') {
    HATG.crown ||= new THREE.SphereGeometry(0.114, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    HATG.brim ||= new THREE.CylinderGeometry(0.115, 0.115, 0.012, 24, 1, false, -Math.PI / 2, Math.PI);
    HATG.button ||= new THREE.SphereGeometry(0.014, 8, 6);
    const c = pmesh(HATG.crown, mat(color, 0.8), 0, -0.072, 0.02, g);
    c.scale.set(1, 0.98, 1.1);
    pmesh(HATG.brim, mat(color, 0.8), 0, -0.068, 0.12, g).scale.set(0.9, 1, 0.85);
    pmesh(HATG.button, mat(color, 0.8), 0, 0.04, 0.02, g);
  } else if (kind === 'chapeu') {
    // chapéu de campanha (como o dos desbravadores e escoteiros): aba larga e copa com 4 vincos
    HATG.wide ||= new THREE.CylinderGeometry(0.235, 0.235, 0.012, 36);
    HATG.peak ||= new THREE.CylinderGeometry(0.055, 0.128, 0.105, 4, 1).rotateY(Math.PI / 4);
    HATG.band ||= new THREE.CylinderGeometry(0.128, 0.128, 0.03, 4, 1, true).rotateY(Math.PI / 4);
    pmesh(HATG.wide, mat(color, 0.9), 0, -0.05, 0.015, g);
    pmesh(HATG.peak, mat(color, 0.9), 0, 0.008, 0.015, g);
    pmesh(HATG.band, mat('#4a3020', 0.7), 0, -0.03, 0.015, g);
  } else if (kind === 'gorro') {
    HATG.beanie ||= new THREE.SphereGeometry(0.117, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    HATG.rim ||= new THREE.TorusGeometry(0.113, 0.02, 8, 28).rotateX(Math.PI / 2);
    pmesh(HATG.beanie, mat(color, 0.95), 0, -0.07, 0.015, g).scale.set(1, 1.08, 1.1);
    pmesh(HATG.rim, mat(color, 0.95), 0, -0.065, 0.015, g).scale.set(1.04, 1, 1.12);
  }
  return g;
}

/** Tênis e sapato (rígidos, presos no pé). Monta do calcanhar até a ponta do pé. */
const SHOEG = {};
function makeShoe(shoe, heel, toe, groundY) {
  const g = new THREE.Group();
  const len = Math.hypot(toe.x - heel.x, toe.z - heel.z) + 0.07;
  const low = shoe.style === 'sapato';
  const h = low ? 0.1 : 0.12;
  const key = `${len.toFixed(3)}${low}`;
  SHOEG[key] ||= {
    heel: new RoundedBoxGeometry(0.122, h, len * 0.58, 3, 0.04),
    toe: new RoundedBoxGeometry(0.118, h * 0.62, len * 0.55, 3, 0.035),
    sole: new RoundedBoxGeometry(0.13, 0.028, len + 0.01, 2, 0.012),
    lace: new THREE.BoxGeometry(0.05, 0.008, 0.08),
  };
  const G = SHOEG[key];
  const up = mat(shoe.color, low ? 0.25 : 0.7, low ? 0.2 : 0);
  pmesh(G.sole, mat(shoe.sole || '#d4d4d4', 0.9), 0, 0.014, 0, g);
  pmesh(G.heel, up, 0, 0.028 + h / 2, -len * 0.21, g);
  pmesh(G.toe, up, 0, 0.028 + h * 0.31, len * 0.22, g);
  if (!low) pmesh(G.lace, mat('#f4f4f4', 0.9), 0, 0.028 + h * 0.62 + 0.004, len * 0.1, g).rotation.x = -0.35;
  g.position.set((heel.x + toe.x) / 2, groundY, (heel.z + toe.z) / 2);
  g.rotation.y = Math.atan2(toe.x - heel.x, toe.z - heel.z);
  return g;
}

/** Saia até o joelho, presa no quadril e nas coxas (balança junto com as pernas). */
function makeSkirt(bones, color) {
  const B = (n) => bones.get(n).getWorldPosition(new THREE.Vector3());
  const pel = B('pelvis');
  const tl = B('thigh_l');
  const tr = B('thigh_r');
  const kl = B('calf_l');
  const top = pel.y + 0.07;
  const bottom = kl.y + 0.02;
  const rx = Math.abs(tl.x - tr.x) / 2 + 0.1;
  const rz = 0.13;
  const SEG = 28;
  const ROWS = 7;
  const pos = [];
  const idx = [];
  const si = [];
  const sw = [];
  const lx = Math.sign(tl.x - pel.x) || 1; // de que lado fica a coxa esquerda
  for (let r = 0; r <= ROWS; r++) {
    const h = r / ROWS;
    const sx = rx * (1 + h * 0.5);
    const sz = rz * (1 + h * 0.75);
    for (let k = 0; k <= SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      const x = Math.sin(a) * sx;
      const z = Math.cos(a) * sz + 0.005;
      pos.push(pel.x + x, top + (bottom - top) * h + Math.sin(a * 6) * 0.006 * h, pel.z + z);
      const wt = Math.min(0.85, h * 1.05);
      const fl = Math.min(1, Math.max(0, 0.5 + (x * lx) / (2 * sx) * 1.4));
      si.push(0, 1, 2, 0);
      sw.push(1 - wt, wt * fl, wt * (1 - fl), 0);
    }
  }
  for (let r = 0; r < ROWS; r++) for (let k = 0; k < SEG; k++) {
    const a = r * (SEG + 1) + k; const b = a + 1; const c = a + SEG + 1; const d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.SkinnedMesh(geo, mat(color, 0.85, 0, { side: THREE.DoubleSide }));
  m.castShadow = true;
  m.frustumCulled = false;
  return { mesh: m, skeleton: new THREE.Skeleton([bones.get('pelvis'), bones.get('thigh_l'), bones.get('thigh_r')]) };
}

const STYLE = {
  surf: { scale: 1.0, head: 1.12, legs: 1 },
  stumble: { scale: 0.7, head: 1.6, legs: 0.8 },
};

/**
 * Monta o personagem (as peças precisam estar carregadas: loadRig()). Fica de frente para -z.
 * s: descrição do personagem (lookOf em skins.js).
 */
export function buildAvatar(s, style = 'surf') {
  if (!RIG) throw new Error('Personagens ainda não carregaram');
  const S = STYLE[style] || STYLE.surf;
  const g = s.g === 'f' ? 'f' : 'm';
  const top = s.top;
  const bottom = s.bottom;
  const shoes = s.shoes;
  // Peças (chave, papel da cor, recorte)
  const pieces = [[`body:${g}`, 'body']];
  pieces.push([`piece:${g}:${top.style.startsWith('colete') ? 'Ranger_Body' : 'Peasant_Body'}`, 'top']);
  if (top.style === 'manga' || top.style === 'colete-manga') pieces.push([`piece:${g}:Ranger_Arms`, 'sleeve']);
  if (bottom.style !== 'saia') pieces.push([`piece:${g}:Ranger_Legs`, bottom.style === 'bermuda' ? 'shorts' : 'bottom']);
  if (shoes.style === 'bota') pieces.push([`piece:${g}:Ranger_Feet`, 'shoes']);
  if (s.hair) pieces.push([s.hair, 'hair']);
  if (s.beard) pieces.push(['hair:barba', 'hair']);
  pieces.push([`brows:${g}`, 'hair']);
  const color = { top: top.color, sleeve: top.sleeve || top.color, bottom: bottom.color, shorts: bottom.color, shoes: shoes.color, hair: s.hairColor };
  const scenes = pieces.filter(([k]) => RIG.parts.has(k)).map(([k, role]) => {
    const sc = cloneRig(RIG.parts.get(k));
    sc.traverse((o) => { if (o.isMesh) o.userData.role = role; });
    return sc;
  });
  const main = scenes[0];
  // Recortes (antes de trocar o esqueleto, enquanto cada malha ainda tem o seu)
  const hideBody = bodyHider(top, bottom, shoes);
  const bodyKey = `${top.style}|${bottom.style}|${shoes.style}`;
  for (const sc of scenes) sc.traverse((o) => {
    if (!o.isSkinnedMesh || !o.geometry.index) return;
    if (o.userData.role === 'body') cutMesh(o, bodyKey, hideBody);
    if (o.userData.role === 'shorts') cutMesh(o, 'shorts', shortsHider);
  });
  // Um esqueleto só: as outras peças passam a usar os ossos do corpo-base
  const bones = new Map();
  main.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
  for (let i = 1; i < scenes.length; i++) {
    const meshes = [];
    scenes[i].traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
    for (const m of meshes) {
      const sk = new THREE.Skeleton(m.skeleton.bones.map((b) => bones.get(b.name) || b), m.skeleton.boneInverses);
      main.add(m);
      m.bind(sk, m.bindMatrix);
    }
  }
  // Cores: cada peça com a sua cor, a pele e o cabelo
  main.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    const n = o.material.name || '';
    const c = color[o.userData.role];
    if (/Superhero|Regular/.test(n)) { if (s.skin && s.skin !== '#ffffff') o.material = tint(o.material, s.skin); } else if (/Hair/.test(n)) {
      if (s.hairColor) o.material = tint(o.material, s.hairColor);
    } else if (c && c !== '#ffffff') o.material = tint(o.material, c);
  });
  main.updateMatrixWorld(true);
  const B = (n) => bones.get(n);
  const W = (n) => B(n).getWorldPosition(new THREE.Vector3());
  // Saia (procedural, presa no quadril e nas coxas)
  if (bottom.style === 'saia') {
    const { mesh, skeleton } = makeSkirt(bones, bottom.color);
    main.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
  }
  // Tênis/sapato em cada pé (presos no osso do pé)
  if (shoes.style !== 'bota') {
    const ground = Math.min(W('ball_leaf_l').y, W('ball_leaf_r').y) - 0.012;
    for (const sd of ['l', 'r']) {
      const shoe = makeShoe(shoes, W(`foot_${sd}`), W(`ball_leaf_${sd}`), ground);
      main.add(shoe);
      B(`foot_${sd}`).attach(shoe);
    }
  }
  // Chapéu no alto da cabeça (antes de aumentar a cabeça, para crescer junto)
  if (s.hat && s.hat !== 'nenhum') {
    const hat = makeHat(s.hat, s.hatColor);
    const h = W('Head');
    // y = 0 do chapéu no alto da cabeça (crânio: ~0,21 acima do osso da cabeça)
    hat.position.set(h.x, h.y + (g === 'f' ? 0.215 : 0.21), h.z);
    main.add(hat);
    B('Head').attach(hat);
  }
  // Lenço no pescoço (preso no peito, acompanha o corpo)
  if (s.scarf) {
    const scarf = makeScarf(g);
    main.add(scarf);
    scarf.position.copy(W('neck_01'));
    scarf.position.y -= 0.035;
    scarf.position.z += 0.005;
    B('spine_03').attach(scarf);
  }
  // Proporções do estilo (cabeça maior, pernas mais curtas no pequenininho)
  B('Head').scale.setScalar(S.head);
  for (const n of ['thigh_l', 'thigh_r', 'calf_l', 'calf_r']) B(n).scale.set(1, S.legs, 1);
  const root = new THREE.Group();
  const rig = new THREE.Group();
  rig.add(main);
  rig.rotation.y = Math.PI; // os modelos olham para +z; o jogo usa -z
  rig.scale.setScalar(S.scale);
  root.add(rig);
  // Pés no chão (as pernas curtas sobem os pés)
  root.updateMatrixWorld(true);
  const footY = Math.min(B('ball_leaf_l').getWorldPosition(new THREE.Vector3()).y, B('ball_leaf_r').getWorldPosition(new THREE.Vector3()).y);
  rig.position.y = -footY + 0.012 * S.scale;
  root.updateMatrixWorld(true);
  const fl = B('foot_l').getWorldPosition(new THREE.Vector3()).y;
  const bl = B('ball_l').getWorldPosition(new THREE.Vector3()).y;
  const mixer = new THREE.AnimationMixer(main);
  root.userData = { style, rig: main, mixer, actions: new Map(), state: null, clip: null, current: null, lastT: null, soleDrop: (fl + bl) / 2 };
  return root;
}

// ───────────── Animações ─────────────
// estado -> animação do esqueleto. clip: animação principal; mix: [[outra, peso]] misturadas junto;
// once: toca uma vez e para no fim; speed: velocidade; yaw: gira o corpo; pitch: inclina para a frente.
const ANIM = {
  surf: {
    idle: { clip: 'Idle_Loop' },
    run: { clip: 'Sprint_Loop', speed: 1.05 },
    jump: { clip: 'NinjaJump_Idle_Loop', fade: 0.12 },
    air: { clip: 'NinjaJump_Idle_Loop', fade: 0.12 },
    pogo: { clip: 'Jump_Loop' },
    roll: { clip: 'Roll', once: true, speed: 2.1, fade: 0.08 },
    // Tropeço: continua correndo, mas o corpo vai para a frente como quem quase cai
    stumble: { clip: 'Sprint_Loop', mix: [['Hit_Stomach', 1.1, true]], speed: 1.0, fade: 0.06 },
    // Em cima do skate: de lado, joelhos um pouco dobrados e braços soltos (sem abrir as pernas)
    skate: { clip: 'Idle_Loop', mix: [['Crouch_Idle_Loop', 0.3]], yaw: Math.PI / 2, alignFeet: true, speed: 0.8 },
    skatelie: { clip: 'Slide_Loop' },
    // Pichando: braço esticado com a lata de spray apontada para o trem
    spray: { clip: 'Spell_Simple_Idle_Loop' },
    caught: { clip: 'Jump_Loop', speed: 0.45, fade: 0.25 }, // pendurado por uma perna: a outra dobrada
    grab: { clip: 'Crouch_Idle_Loop', fade: 0.25 }, // o guarda agacha para pegar o tornozelo
    hold: { clip: 'Idle_Loop', fade: 0.3 }, // o guarda (o braço que segura é posto pelo jogo)
    carry: { clip: 'Walk_Loop', fade: 0.3 }, // o guarda indo embora carregando
    crash: { clip: 'Hit_Knockback', once: true, fade: 0.05 },
    down: { clip: 'Death01', once: true, speed: 1.6, fade: 0.15 }, // caído de costas no chão
    dive: { clip: 'Swim_Fwd_Loop' },
    // Foguete: em pé, inclinado para a frente, pernas juntas (como voando com uma mochila-foguete)
    fly: { clip: 'Idle_Loop', speed: 0.6, pitch: 0.42, fade: 0.25 },
    wave: { clip: 'Celebration' },
    win: { clip: 'Dance_Loop' },
    lose: { clip: 'Crying' },
    fall: { clip: 'LiftAir_Fall_Air_Loop' },
  },
  stumble: {
    idle: { clip: 'Idle_Loop' },
    run: { clip: 'Jog_Fwd_Loop', speed: 1.25 },
    jump: { clip: 'Jump_Loop', fade: 0.1 },
    air: { clip: 'Jump_Loop', fade: 0.1 },
    stumble: { clip: 'Hit_Knockback', once: true, fade: 0.06 },
    dive: { clip: 'Swim_Fwd_Loop', fade: 0.08 },
    wave: { clip: 'Celebration' },
    win: { clip: 'Dance_Loop' },
    lose: { clip: 'Crying' },
    fall: { clip: 'LiftAir_Fall_Air_Loop' },
  },
};

function action(U, name) {
  let a = U.actions.get(name);
  if (!a) {
    const clip = RIG.clips.get(name);
    if (!clip) return null;
    a = U.mixer.clipAction(clip);
    U.actions.set(name, a);
  }
  return a;
}

/**
 * Anima o personagem. t: relógio em segundos (o passo é a diferença entre as chamadas).
 * Estados: idle, run, jump, air, pogo, roll, stumble, skate, skatelie, spray, caught, hold, carry,
 * crash, down, dive, fly, wave, win, lose, fall.
 */
export function poseAvatar(model, state, t) {
  const U = model.userData;
  if (!U?.mixer) return;
  let dt = U.lastT == null ? 0 : t - U.lastT;
  U.lastT = t;
  if (!(dt > 0) || dt > 0.25) dt = dt > 0.25 ? 0.25 : 0;
  const table = ANIM[U.style] || ANIM.surf;
  const spec = table[state] || ANIM.surf[state] || table.idle;
  if (U.state !== state) {
    U.state = state;
    U.rig.rotation.set(spec.pitch || 0, spec.yaw || 0, 0);
    const fade = spec.fade ?? 0.18;
    const layers = [[spec.clip, 1, spec.once], ...(spec.mix || [])];
    const next = new Set();
    for (const [name, w, once] of layers) {
      const a = action(U, name);
      if (!a) continue;
      next.add(a);
      const restart = once || !a.isRunning() || !U.active?.has(a);
      a.stopFading();
      a.enabled = true;
      a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = !!once;
      a.timeScale = spec.speed || 1;
      a.setEffectiveWeight(w);
      if (restart) { a.reset(); a.setEffectiveWeight(w); a.play(); if (U.active?.size) a.fadeIn(fade); }
    }
    for (const a of U.active || []) if (!next.has(a)) a.fadeOut(fade);
    U.active = next;
    U.clip = spec.clip;
  }
  U.mixer.update(dt);
  // No skate: gira o corpo até os dois pés ficarem na linha da prancha (nenhum pé para fora)
  if (spec.alignFeet) {
    model.updateMatrixWorld(true);
    const a = model.worldToLocal(U.rig.getObjectByName('foot_l').getWorldPosition(_fa));
    const b = model.worldToLocal(U.rig.getObjectByName('foot_r').getWorldPosition(_fb));
    let d = Math.atan2(b.x - a.x, b.z - a.z);
    if (d > Math.PI / 2) d -= Math.PI;
    if (d < -Math.PI / 2) d += Math.PI;
    U.rig.rotation.y -= d;
  }
}
const _fa = new THREE.Vector3();
const _fb = new THREE.Vector3();

/** Põe um objeto (lata de spray, por exemplo) na mão do personagem. */
export function holdProp(model, prop, hand = 'hand_l') {
  const bone = model.userData.rig.getObjectByName(hand);
  bone.add(prop);
  return prop;
}

/**
 * Aponta um osso (braço, perna) para uma direção do mundo, depois da animação: o osso gira até
 * o osso filho ficar na direção pedida. Usado para o guarda levantar o braço segurando o personagem.
 */
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
export function aimBone(model, boneName, childName, dir, k = 1) {
  const rig = model.userData.rig;
  const bone = rig.getObjectByName(boneName);
  const child = rig.getObjectByName(childName);
  model.updateMatrixWorld(true);
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  const cur = _b.sub(_a).normalize();
  _q.setFromUnitVectors(cur, _a.copy(dir).normalize());
  if (k < 1) _q.slerp(_q2.identity(), 1 - k);
  // rotação no mundo -> rotação local do osso
  bone.parent.getWorldQuaternion(_q2);
  const parentInv = _q2.clone().invert();
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(_q);
  bone.quaternion.copy(parentInv.multiply(_q2));
  bone.updateMatrixWorld(true);
}

/**
 * Ponto do mundo de uma parte do corpo, já com a animação aplicada: 'pes' (meio da sola dos
 * dois tênis), 'maos' (meio das duas mãos) ou 'baixo' (ponto mais baixo do corpo, para deitar).
 */
const _v = new THREE.Vector3();
export function bodyPoint(model, what, out = new THREE.Vector3()) {
  model.updateMatrixWorld(true);
  const rig = model.userData.rig;
  const get = (n) => rig.getObjectByName(n).getWorldPosition(_v);
  if (what === 'pes') {
    out.set(0, 0, 0);
    for (const n of ['foot_l', 'foot_r', 'ball_l', 'ball_r']) out.add(get(n));
    out.multiplyScalar(0.25);
    out.y -= model.userData.soleDrop * model.scale.y;
    return out;
  }
  if (what === 'maos') {
    out.copy(get('hand_l')).add(get('hand_r')).multiplyScalar(0.5);
    return out;
  }
  let low = Infinity;
  rig.traverse((o) => { if (o.isBone || (o.type === 'Object3D' && o.parent && o.name)) { const y = o.getWorldPosition(_v).y; if (y < low) { low = y; out.copy(_v); } } });
  out.y -= 0.09 * model.scale.y;
  return out;
}

/** Altura total aproximada (para a câmera e etiquetas). */
export const avatarHeight = (style) => (style === 'stumble' ? 1.3 : 1.95);
