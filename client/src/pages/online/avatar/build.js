// Personagens dos jogos: modelos de verdade do "Universal Base Characters" (Quaternius, CC0) com as
// animações do "Universal Animation Library" (mesmo esqueleto). Cada skin junta uma roupa inteira
// (aventureiro ou casual), a cabeça do corpo-base, o cabelo e as sobrancelhas, tudo preso num único
// esqueleto. As cores da roupa, da pele e do cabelo tingem as texturas.
//  - 'surf': proporção de adolescente (cabeça um pouquinho maior);
//  - 'stumble': versão pequenininha (cabeção, pernas mais curtas).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ───────────── Arquivos ─────────────
const BASE = '/models/chars/';
const PARTS = {
  'outfit:ranger:m': 'outfits/Male_Ranger.gltf', 'outfit:ranger:f': 'outfits/Female_Ranger.gltf',
  'outfit:casual:m': 'outfits/Male_Peasant.gltf', 'outfit:casual:f': 'outfits/Female_Peasant.gltf',
  'body:m': 'base/Superhero_Male_FullBody.gltf', 'body:f': 'base/Superhero_Female_FullBody.gltf',
  'hair:curto': 'hair/Hair_SimpleParted.gltf', 'hair:raspado': 'hair/Hair_Buzzed.gltf', 'hair:longo': 'hair/Hair_Long.gltf',
  'hair:coque': 'hair/Hair_Buns.gltf', 'hair:raspado-f': 'hair/Hair_BuzzedFemale.gltf',
  'brows:m': 'hair/Eyebrows_Regular.gltf', 'brows:f': 'hair/Eyebrows_Female.gltf',
};
let RIG = null;
let rigPromise = null;
const loader = new GLTFLoader();
/** Carrega o esqueleto com as animações e todas as peças dos personagens (uma vez só). */
export function loadRig() {
  if (!rigPromise) {
    rigPromise = Promise.all([
      loader.loadAsync('/models/dbv-rig.glb?v=1'),
      ...Object.entries(PARTS).map(([k, f]) => loader.loadAsync(BASE + f).then((g) => [k, g.scene])),
    ]).then(([rig, ...parts]) => {
      RIG = { clips: new Map(rig.animations.map((a) => [a.name, a])), parts: new Map(parts) };
      // Corpo-base: fica só a cabeça e o pescoço (o resto do corpo é a roupa)
      for (const k of ['body:m', 'body:f']) headOnly(RIG.parts.get(k));
      return RIG;
    });
    rigPromise.catch(() => { rigPromise = null; });
  }
  return rigPromise;
}
export const rigLoaded = () => !!RIG;

function headOnly(scene) {
  scene.traverse((o) => {
    if (!o.isSkinnedMesh || !o.geometry.index) return;
    const keep = new Set();
    o.skeleton.bones.forEach((b, k) => { if (b.name === 'Head' || b.name === 'neck_01') keep.add(k); });
    const si = o.geometry.attributes.skinIndex;
    const sw = o.geometry.attributes.skinWeight;
    const head = (v) => { let best = 0; let bi = 0; for (let c = 0; c < 4; c++) { const w = sw.getComponent(v, c); if (w > best) { best = w; bi = si.getComponent(v, c); } } return keep.has(bi); };
    const idx = o.geometry.index.array;
    const out = [];
    for (let t = 0; t < idx.length; t += 3) if (head(idx[t]) && head(idx[t + 1]) && head(idx[t + 2])) out.push(idx[t], idx[t + 1], idx[t + 2]);
    o.geometry = o.geometry.clone();
    o.geometry.setIndex(out);
  });
}

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

const STYLE = {
  surf: { scale: 1.0, head: 1.12, legs: 1 },
  stumble: { scale: 0.7, head: 1.6, legs: 0.8 },
};

/** Monta o personagem (as peças precisam estar carregadas: loadRig()). Fica de frente para -z. */
export function buildAvatar(s, style = 'surf') {
  if (!RIG) throw new Error('Personagens ainda não carregaram');
  const S = STYLE[style] || STYLE.surf;
  const keys = [`outfit:${s.outfit || 'ranger'}:${s.g}`, `body:${s.g}`, `hair:${s.hair}`, `brows:${s.g}`].filter((k) => RIG.parts.has(k));
  const scenes = keys.map((k) => cloneRig(RIG.parts.get(k)));
  const main = scenes[0];
  // Um esqueleto só: as outras peças passam a usar os ossos da roupa
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
  // Cores: roupa, pele e cabelo
  main.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    const n = o.material.name || '';
    if (/Ranger|Peasant/.test(n) && s.cloth && s.cloth !== '#ffffff') o.material = tint(o.material, s.cloth);
    else if (/Superhero|Regular/.test(n) && s.skin && s.skin !== '#ffffff') o.material = tint(o.material, s.skin);
    else if (/Hair/.test(n) && s.hairColor) o.material = tint(o.material, s.hairColor);
  });
  // Proporções do estilo (cabeça maior, pernas mais curtas no pequenininho)
  const B = (n) => bones.get(n);
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
// estado -> animação do esqueleto. once: toca uma vez e para no fim; speed: velocidade; yaw: gira o corpo.
const ANIM = {
  surf: {
    idle: { clip: 'Idle_Loop' },
    run: { clip: 'Sprint_Loop', speed: 1.05 },
    jump: { clip: 'NinjaJump_Idle_Loop', fade: 0.12 },
    air: { clip: 'NinjaJump_Idle_Loop', fade: 0.12 },
    pogo: { clip: 'Jump_Loop' },
    roll: { clip: 'Roll', once: true, speed: 2.1, fade: 0.08 },
    stumble: { clip: 'Hit_Stomach', once: true, speed: 1.3, fade: 0.06 },
    skate: { clip: 'Sword_Idle', yaw: 1.15 },
    skatelie: { clip: 'Slide_Loop' },
    spray: { clip: 'Idle_Torch_Loop' },
    caught: { clip: 'Surprise', speed: 1.4 }, // de cabeça para baixo: braços balançando e pernas esticadas
    hold: { clip: 'Celebration', speed: 0.8 }, // o guarda levanta o personagem com os braços para cima
    crash: { clip: 'Hit_Knockback', once: true, fade: 0.05 },
    dive: { clip: 'Swim_Fwd_Loop' },
    fly: { clip: 'Swim_Fwd_Loop', speed: 0.7 },
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

/**
 * Anima o personagem. t: relógio em segundos (o passo é a diferença entre as chamadas).
 * Estados: idle, run, jump, air, pogo, roll, stumble, skate, skatelie, spray, caught, hold, crash,
 * dive, fly, wave, win, lose, fall.
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
    U.rig.rotation.y = spec.yaw || 0;
    if (U.clip !== spec.clip || spec.once) {
      const clip = RIG.clips.get(spec.clip);
      let a = U.actions.get(spec.clip);
      if (!a) { a = U.mixer.clipAction(clip); U.actions.set(spec.clip, a); }
      a.reset();
      a.setLoop(spec.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = !!spec.once;
      a.timeScale = spec.speed || 1;
      a.enabled = true;
      a.setEffectiveWeight(1);
      a.play();
      if (U.current && U.current !== a) a.crossFadeFrom(U.current, spec.fade ?? 0.18, false);
      U.current = a;
      U.clip = spec.clip;
    } else if (U.current) U.current.timeScale = spec.speed || 1;
  }
  U.mixer.update(dt);
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
