// Miniaturas (fotos) das skins e dos skates, desenhadas uma vez num renderizador escondido.
import * as THREE from 'three';
import { buildAvatar, loadRig, poseAvatar, studioEnv } from './build.js';
import { skinById } from './skins.js';

const cache = new Map();
let R = null;
function setup() {
  if (R) return R;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(180, 220);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight('#ffffff', '#8aa0c8', 0.9));
  const sun = new THREE.DirectionalLight('#fff6e8', 1.9);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(26, 180 / 220, 0.1, 30);
  R = { renderer, scene, cam };
  return R;
}

let queue = Promise.resolve();
/** Foto do personagem (id = código do personagem). */
export function thumb(kind, id) {
  const key = kind + id;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  queue = queue.then(() => loadRig()).then(() => new Promise((ok) => {
    window.setTimeout(() => {
      if (cache.has(key)) { ok(cache.get(key)); return; }
      const { renderer, scene, cam } = setup();
      let obj;
      obj = buildAvatar(skinById(id), 'surf');
      poseAvatar(obj, 'idle', 0);
      poseAvatar(obj, 'idle', 0.2);
      obj.rotation.y = Math.PI - 0.35;
      cam.position.set(0, 1.25, 4.4);
      cam.lookAt(0, 0.95, 0);
      scene.add(obj);
      renderer.render(scene, cam);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(obj);
      cache.set(key, url);
      ok(url);
    }, 0);
  }));
  return queue;
}
